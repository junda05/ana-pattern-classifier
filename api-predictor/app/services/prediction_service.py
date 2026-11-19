"""
Image prediction service with hierarchical ICAP classification
"""

import io
import logging
import os
import tempfile
import threading
from collections import Counter
from typing import Any

import anyio
import cv2
import numpy as np
from fastapi import status
from PIL import Image

from app.core.class_mapping import ClassificationLevel, HierarchyNavigator, ModelConfig
from app.core.config import get_settings
from app.core.errors import InvalidImageError, ModelsUnavailableError

logger = logging.getLogger(__name__)


class PredictionService:
    """
    Service that performs hierarchical image predictions using YOLOv8
    Implements 3-level ICAP classification: General → Competent → Expert
    """

    def __init__(self):
        self.settings = get_settings()
        self.models = {}
        # Ultralytics models are not thread-safe: one inference at a time, in a worker
        # thread with its own token so the shared threadpool is never starved
        self._inference_limiter = anyio.CapacityLimiter(1)
        self._load_all_models()

    @property
    def is_ready(self) -> bool:
        """
        True when the general model, required for every prediction, is loaded
        """
        return 'general' in self.models

    @staticmethod
    def _load_checkpoint(model_path: str) -> Any:
        # Imported here: ultralytics pulls in torch, which only real inference needs
        from ultralytics import YOLO

        return YOLO(model_path)

    def _load_all_models(self) -> None:
        """
        Load every trained YOLOv8 model used for hierarchical classification.

        A missing or unreadable checkpoint is logged and skipped. Without the
        general model the service stays up but reports itself as not ready
        (health 503, predictions 503).
        """
        logger.info("Loading hierarchical classification models")

        base_path = os.path.join(os.path.dirname(__file__), '..', '..')

        for model_key, model_info in ModelConfig.MODELS.items():
            model_path = os.path.normpath(os.path.join(base_path, model_info['path']))

            if not os.path.exists(model_path):
                logger.warning("Model '%s' not found at: %s", model_key, model_path)
                continue

            try:
                self.models[model_key] = self._load_checkpoint(model_path)
            except Exception:
                logger.exception("Failed to load model '%s'", model_key)
                continue

            logger.info("Model '%s' loaded (level: %s, classes: %d)",
                        model_key, model_info['level'].value, len(model_info['classes']))

        logger.info("Models loaded: %d/%d", len(self.models), len(ModelConfig.MODELS))

        if not self.is_ready:
            logger.error("The general model is required and could not be loaded; "
                         "predictions are unavailable")

    def validate_image(self, image_data: bytes) -> None:
        """
        Check that the data is a complete, decodable image within the size limit

        Args:
            image_data: Raw image bytes

        Raises:
            InvalidImageError: 400 if the data is empty or not a valid image,
                413 if it exceeds the configured maximum size or pixel count
        """
        if len(image_data) == 0:
            raise InvalidImageError("The file is empty.")

        max_size = self.settings.max_file_size
        if len(image_data) > max_size:
            raise InvalidImageError(
                f"The file exceeds the maximum size of {max_size // (1024 * 1024)} MB.",
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        max_pixels = self.settings.max_image_pixels
        too_many_pixels = InvalidImageError(
            f"The image exceeds the maximum of {max_pixels:,} pixels.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

        try:
            with Image.open(io.BytesIO(image_data)) as image:
                # Checked before decoding, so a small file cannot expand into a huge bitmap
                width, height = image.size
                if width * height > max_pixels:
                    raise too_many_pixels
                # load() decodes the pixel data, so truncated files are rejected too
                image.load()
        except InvalidImageError:
            raise
        except Image.DecompressionBombError as error:
            raise too_many_pixels from error
        except Exception as error:
            raise InvalidImageError("The file is not a valid image.") from error

    def _apply_clahe_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE + Gaussian blur to the image's green channel.

        Args:
            image (np.ndarray): Image in BGR or RGB format

        Returns:
            np.ndarray: Preprocessed image (green channel with CLAHE + blur)
        """
        green_channel = image[:, :, 1]

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_image = clahe.apply(green_channel)

        filtered_image = cv2.GaussianBlur(clahe_image, (3, 3), 0)

        return filtered_image

    def _create_patches(self, image: np.ndarray, patch_size: int = 640,
                        overlap: float = 0.4) -> list[np.ndarray]:
        """
        Split an image into overlapping patches. Patches are created once
        and reused at every classification level.

        Args:
            image: Image preprocessed with CLAHE + Gaussian blur (grayscale)
            patch_size: Patch size (default 640)
            overlap: Overlap between patches (default 0.4 = 40%)

        Returns:
            List of patches as numpy arrays
        """
        if len(image.shape) == 3:
            if image.shape[2] == 3:
                image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            elif image.shape[2] == 1:
                image = image[:, :, 0]

        height, width = image.shape
        patches = []

        step = int(patch_size * (1 - overlap))

        for y in range(0, height - patch_size + 1, step):
            for x in range(0, width - patch_size + 1, step):
                patch = image[y:y+patch_size, x:x+patch_size]
                if patch.shape == (patch_size, patch_size):
                    patches.append(patch)

        if len(patches) == 0:
            image_resized = cv2.resize(image, (patch_size, patch_size))
            patches.append(image_resized)

        return patches

    def _predict_patch(self, patch: np.ndarray, model_key: str) -> tuple[str, float, np.ndarray]:
        """
        Predict the class of a single patch using a specific model

        Args:
            patch: Patch as a numpy array
            model_key: Key of the model to use

        Returns:
            Tuple (predicted_class, confidence, probabilities)
        """
        if model_key not in self.models:
            raise ValueError(f"Model '{model_key}' is not loaded")

        fd, temp_path = tempfile.mkstemp(suffix='.png')
        os.close(fd)

        try:
            if not cv2.imwrite(temp_path, patch):
                raise ValueError("Could not write the patch to a temporary file")

            results = self.models[model_key](temp_path, verbose=False)
            probs = results[0].probs

            if probs is not None:
                predicted_idx = probs.top1
                confidence_value = float(probs.top1conf.item())
                probabilities = probs.data.cpu().numpy()

                model_classes = ModelConfig.get_model_classes(model_key)
                predicted_class = model_classes[predicted_idx]

                return predicted_class, confidence_value, probabilities
            else:
                raise ValueError("Could not obtain probabilities for the patch")

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def _hybrid_voting(self, patch_predictions: list[str], patch_confidences: list[float],
                       all_probabilities: list[np.ndarray], model_key: str) -> tuple[str, float, np.ndarray]:
        """
        Run hybrid voting over the patch predictions

        Adaptive voting with several strategies:
        - Rare-class detection from the maximum per-patch probability
        - Statistical analysis of the probabilities
        - Traditional hybrid voting for common classes

        Args:
            patch_predictions: Predicted class for each patch
            patch_confidences: Confidence for each patch
            all_probabilities: Probability array for each patch
            model_key: Key of the model used

        Returns:
            Tuple (final_class, final_confidence, final_probabilities)
        """
        all_probabilities = np.array(all_probabilities)
        patch_confidences = np.array(patch_confidences)
        model_classes = ModelConfig.get_model_classes(model_key)

        # Rare-class detection: MITOTIC
        if model_key == 'general' and 'MITOTIC' in model_classes:
            mitotic_idx = model_classes.index('MITOTIC')

            # Inspect ALL MITOTIC probabilities
            mitotic_probabilities = all_probabilities[:, mitotic_idx]

            # Highest MITOTIC probability across all patches
            max_mitotic_prob = np.max(mitotic_probabilities)
            mean_mitotic_prob = np.mean(mitotic_probabilities)
            patches_with_mitotic_evidence = np.sum(mitotic_probabilities > 0.50)

            logger.debug(
                "MITOTIC probability analysis: max %.2f%%, mean %.2f%%, patches with evidence (>50%%): %d/%d",
                max_mitotic_prob * 100, mean_mitotic_prob * 100,
                patches_with_mitotic_evidence, len(mitotic_probabilities),
            )

            # Strategy 1: if the maximum MITOTIC probability is very high (>=70%), consider MITOTIC.
            # This catches cases where MITOTIC has a high probability but is not the winning class
            if max_mitotic_prob >= 0.70:
                best_mitotic_idx = np.argmax(mitotic_probabilities)
                best_mitotic_confidence = mitotic_probabilities[best_mitotic_idx]

                # Check whether that patch predicts MITOTIC as its class
                if patch_predictions[best_mitotic_idx] == 'MITOTIC':
                    final_probabilities = all_probabilities[best_mitotic_idx].copy()

                    logger.info(
                        "Rare class detected: MITOTIC (maximum probability strategy): "
                        "patch %d with %.2f%% MITOTIC probability",
                        best_mitotic_idx + 1, best_mitotic_confidence * 100,
                    )

                    return 'MITOTIC', float(best_mitotic_confidence), final_probabilities

            # Strategy 2: several patches with moderate (>30%) MITOTIC evidence
            patches_with_moderate_evidence = np.sum(mitotic_probabilities > 0.30)
            if patches_with_moderate_evidence >= 2:
                moderate_indices = np.where(mitotic_probabilities > 0.30)[0]
                avg_moderate_confidence = np.mean(mitotic_probabilities[moderate_indices])

                # If the mean over those patches is high (>=50%), consider MITOTIC
                if avg_moderate_confidence >= 0.50:
                    best_idx = moderate_indices[np.argmax(mitotic_probabilities[moderate_indices])]
                    final_probabilities = all_probabilities[best_idx].copy()

                    logger.info(
                        "Rare class detected: MITOTIC (accumulated evidence strategy): "
                        "%d patches with moderate evidence (>30%%), mean probability %.2f%%",
                        patches_with_moderate_evidence, avg_moderate_confidence * 100,
                    )

                    return 'MITOTIC', float(avg_moderate_confidence), final_probabilities

        # Traditional hybrid voting for normal (non-rare) classes

        # Step 1: majority vote (60% weight)
        vote_counts = Counter(patch_predictions)
        majority_class = vote_counts.most_common(1)[0][0]
        majority_weight = 0.6

        # Step 2: confidence-weighted average (40% weight)
        confidence_weights = patch_confidences / np.sum(patch_confidences)
        weighted_probabilities = np.average(all_probabilities, weights=confidence_weights, axis=0)
        confidence_weight = 0.4

        # Step 3: combine both methods
        final_probabilities = np.zeros(len(model_classes))

        majority_idx = model_classes.index(majority_class)
        majority_strength = vote_counts[majority_class] / len(patch_predictions)
        final_probabilities[majority_idx] += majority_weight * majority_strength

        final_probabilities += confidence_weight * weighted_probabilities

        final_probabilities = final_probabilities / np.sum(final_probabilities)

        # Final class and confidence
        final_class_idx = np.argmax(final_probabilities)
        final_class = model_classes[final_class_idx]
        final_confidence = float(final_probabilities[final_class_idx])

        return final_class, final_confidence, final_probabilities

    def _predict_level(self, patches: list[np.ndarray], model_key: str,
                       level: ClassificationLevel) -> dict[str, Any]:
        """
        Run the prediction at one level using the preprocessed patches

        Args:
            patches: Preprocessed patches
            model_key: Key of the model to use
            level: Classification level

        Returns:
            Dict with the prediction results at this level
        """
        patch_predictions = []
        patch_confidences = []
        all_probabilities = []

        for i, patch in enumerate(patches):
            try:
                pred_class, confidence, probabilities = self._predict_patch(patch, model_key)
                patch_predictions.append(pred_class)
                patch_confidences.append(confidence)
                all_probabilities.append(probabilities)

                # Per-patch detail for the GENERAL level (diagnostics)
                if model_key == 'general' and logger.isEnabledFor(logging.DEBUG):
                    model_classes = ModelConfig.get_model_classes(model_key)
                    probs_str = " | ".join(f"{cls[:3]}:{prob*100:.1f}%"
                                           for cls, prob in zip(model_classes, probabilities, strict=True))
                    logger.debug("Patch %2d: %-15s (%.1f%%) | %s",
                                 i + 1, pred_class, confidence * 100, probs_str)

            except Exception as e:
                logger.warning("Failed to predict a patch with model '%s': %s", model_key, e)
                continue

        if not patch_predictions:
            raise ValueError(f"Could not obtain valid predictions at level {level.value}")

        final_class, final_confidence, final_probabilities = self._hybrid_voting(
            patch_predictions, patch_confidences, all_probabilities, model_key
        )

        # Patch statistics
        vote_counts = Counter(patch_predictions)
        total_patches = len(patch_predictions)

        model_classes = ModelConfig.get_model_classes(model_key)
        class_probabilities = {
            class_name: float(prob)
            for class_name, prob in zip(model_classes, final_probabilities, strict=True)
        }

        patch_stats = {}
        for class_name in model_classes:
            count = vote_counts.get(class_name, 0)
            percentage = (count / total_patches) * 100
            avg_conf = np.mean([conf for i, conf in enumerate(patch_confidences)
                             if patch_predictions[i] == class_name]) * 100 if count > 0 else 0
            patch_stats[class_name] = {
                'count': int(count),
                'percentage': float(round(percentage, 1)),
                'avg_confidence': float(round(avg_conf, 1))
            }

        return {
            'prediction': final_class,
            'confidence': float(final_confidence),
            'confidence_percentage': float(round(final_confidence * 100, 2)),
            'class_probabilities': class_probabilities,
            'patch_statistics': {
                'total_patches': int(total_patches),
                'average_confidence': float(round(np.mean(patch_confidences) * 100, 1)),
                'min_confidence': float(round(np.min(patch_confidences) * 100, 1)),
                'max_confidence': float(round(np.max(patch_confidences) * 100, 1)),
                'by_class': patch_stats
            }
        }

    @staticmethod
    def _log_level_result(level: ClassificationLevel, result: dict[str, Any], threshold: float) -> None:
        logger.info("Level %s: prediction %s, confidence %s%% (threshold %s%%)",
                    level.value, result['prediction'], result['confidence_percentage'], threshold * 100)

    def _hierarchical_classification(self, patches: list[np.ndarray]) -> dict[str, Any]:
        """
        Run the full hierarchical classification: General → Competent → Expert

        Args:
            patches: Preprocessed patches (reused at every level)

        Returns:
            Dict with the hierarchical classification results. `final_key` is the
            raw class key behind the display name in `final_prediction`.
        """
        hierarchy_path = []
        current_level = ClassificationLevel.GENERAL
        general_class = None
        competent_class = None
        final_note = None

        logger.info("Starting hierarchical classification")

        # General level
        try:
            general_result = self._predict_level(patches, 'general', current_level)
            general_class = general_result['prediction']
            general_confidence = general_result['confidence']

            hierarchy_path.append({
                'level': current_level,
                'prediction': general_class,
                'confidence': general_confidence,
                'confidence_percentage': general_result['confidence_percentage'],
                'passed_threshold': True
            })

            self._log_level_result(current_level, general_result,
                                   HierarchyNavigator.get_threshold(current_level))

            # Decide whether to continue to the next level
            next_level_info = HierarchyNavigator.get_next_level(general_class)

            if not next_level_info:
                logger.info("Classification finished at general level: class '%s' has no lower levels",
                            general_class)

                final_prediction = HierarchyNavigator.format_final_prediction(current_level, general_class)
                return {
                    'final_prediction': final_prediction,
                    'final_key': general_class,
                    'classification_level': current_level,
                    'hierarchy_path': hierarchy_path,
                    'final_result': general_result,
                    'note': final_note
                }

        except Exception:
            logger.exception("Failure at general level")
            raise

        # Competent level, or Expert level (Mitotic)
        next_level, next_model = next_level_info
        current_level = next_level

        if next_model not in self.models:
            logger.warning("Model '%s' not available", next_model)
            final_note = f"No {current_level.value} model is available for this class"
            final_prediction = HierarchyNavigator.format_final_prediction(
                ClassificationLevel.GENERAL, general_class
            )

            hierarchy_path.append({
                'level': current_level,
                'prediction': None,
                'confidence': None,
                'note': final_note,
                'model_not_available': True
            })

            return {
                'final_prediction': final_prediction,
                'final_key': general_class,
                'classification_level': ClassificationLevel.GENERAL,
                'hierarchy_path': hierarchy_path,
                'final_result': general_result,
                'note': final_note
            }

        try:
            competent_expert_result = self._predict_level(patches, next_model, current_level)
            predicted_class = competent_expert_result['prediction']
            confidence = competent_expert_result['confidence']
            threshold = HierarchyNavigator.get_threshold(current_level)

            self._log_level_result(current_level, competent_expert_result, threshold)

            if confidence < threshold:
                logger.info("Low confidence at %s level; returning the general level classification",
                            current_level.value)

                final_note = (
                    f"Low confidence at {current_level.value} level "
                    f"({competent_expert_result['confidence_percentage']}% < {threshold * 100}%); "
                    f"classified at general level"
                )
                final_prediction = HierarchyNavigator.format_final_prediction(
                    ClassificationLevel.GENERAL, general_class
                )

                hierarchy_path.append({
                    'level': current_level,
                    'prediction': predicted_class,
                    'confidence': confidence,
                    'confidence_percentage': competent_expert_result['confidence_percentage'],
                    'passed_threshold': False,
                    'threshold': threshold
                })

                return {
                    'final_prediction': final_prediction,
                    'final_key': general_class,
                    'classification_level': ClassificationLevel.GENERAL,
                    'hierarchy_path': hierarchy_path,
                    'final_result': general_result,
                    'note': final_note
                }

            # Confidence is high enough
            hierarchy_path.append({
                'level': current_level,
                'prediction': predicted_class,
                'confidence': confidence,
                'confidence_percentage': competent_expert_result['confidence_percentage'],
                'passed_threshold': True
            })

            if current_level == ClassificationLevel.EXPERT:
                # Already at the expert level (Mitotic case)
                logger.info("Classification finished at expert level")

                final_prediction = HierarchyNavigator.format_final_prediction(current_level, predicted_class)
                return {
                    'final_prediction': final_prediction,
                    'final_key': predicted_class,
                    'classification_level': current_level,
                    'hierarchy_path': hierarchy_path,
                    'final_result': competent_expert_result,
                    'note': final_note
                }

            # At the competent level
            competent_class = predicted_class

            # Special case AC-18
            class_info = HierarchyNavigator.get_class_info(current_level, competent_class)
            if class_info and class_info.get('is_expert_level'):
                logger.info("Classification finished at competent level: %s", class_info.get('note'))

                final_note = class_info.get('note')
                final_prediction = HierarchyNavigator.format_final_prediction(current_level, competent_class)

                return {
                    'final_prediction': final_prediction,
                    'final_key': competent_class,
                    'classification_level': ClassificationLevel.EXPERT,  # AC-18 is an expert-level pattern
                    'hierarchy_path': hierarchy_path,
                    'final_result': competent_expert_result,
                    'note': final_note
                }

        except Exception:
            logger.exception("Failure at %s level", current_level.value)
            final_note = f"Error at {current_level.value} level; classified at general level"
            final_prediction = HierarchyNavigator.format_final_prediction(
                ClassificationLevel.GENERAL, general_class
            )

            return {
                'final_prediction': final_prediction,
                'final_key': general_class,
                'classification_level': ClassificationLevel.GENERAL,
                'hierarchy_path': hierarchy_path,
                'final_result': general_result,
                'note': final_note
            }

        # Expert level (from Competent)
        expert_level_info = HierarchyNavigator.get_next_level(general_class, competent_class)

        if not expert_level_info:
            class_info = HierarchyNavigator.get_class_info(ClassificationLevel.COMPETENT, competent_class)
            if class_info and 'note' in class_info:
                final_note = class_info.get('note')

            logger.info("Classification finished at competent level%s",
                        f": {final_note}" if final_note else "")

            final_prediction = HierarchyNavigator.format_final_prediction(
                ClassificationLevel.COMPETENT, competent_class
            )

            return {
                'final_prediction': final_prediction,
                'final_key': competent_class,
                'classification_level': ClassificationLevel.COMPETENT,
                'hierarchy_path': hierarchy_path,
                'final_result': competent_expert_result,
                'note': final_note
            }

        expert_level, expert_model = expert_level_info
        current_level = expert_level

        if expert_model not in self.models:
            logger.warning("Model '%s' not available", expert_model)
            final_note = "No expert model is available for this class"
            final_prediction = HierarchyNavigator.format_final_prediction(
                ClassificationLevel.COMPETENT, competent_class
            )

            hierarchy_path.append({
                'level': current_level,
                'prediction': None,
                'confidence': None,
                'note': final_note,
                'model_not_available': True
            })

            return {
                'final_prediction': final_prediction,
                'final_key': competent_class,
                'classification_level': ClassificationLevel.COMPETENT,
                'hierarchy_path': hierarchy_path,
                'final_result': competent_expert_result,
                'note': final_note
            }

        try:
            expert_result = self._predict_level(patches, expert_model, current_level)
            expert_class = expert_result['prediction']
            expert_confidence = expert_result['confidence']
            threshold = HierarchyNavigator.get_threshold(current_level)

            self._log_level_result(current_level, expert_result, threshold)

            if expert_confidence < threshold:
                logger.info("Low confidence at expert level; returning the competent level classification")

                final_note = (
                    f"Low confidence at expert level "
                    f"({expert_result['confidence_percentage']}% < {threshold * 100}%); "
                    f"classified at competent level"
                )
                final_prediction = HierarchyNavigator.format_final_prediction(
                    ClassificationLevel.COMPETENT, competent_class
                )

                hierarchy_path.append({
                    'level': current_level,
                    'prediction': expert_class,
                    'confidence': expert_confidence,
                    'confidence_percentage': expert_result['confidence_percentage'],
                    'passed_threshold': False,
                    'threshold': threshold
                })

                return {
                    'final_prediction': final_prediction,
                    'final_key': competent_class,
                    'classification_level': ClassificationLevel.COMPETENT,
                    'hierarchy_path': hierarchy_path,
                    'final_result': competent_expert_result,
                    'note': final_note
                }

            # Confidence is high enough at the expert level
            hierarchy_path.append({
                'level': current_level,
                'prediction': expert_class,
                'confidence': expert_confidence,
                'confidence_percentage': expert_result['confidence_percentage'],
                'passed_threshold': True
            })

            logger.info("Classification finished at expert level")

            final_prediction = HierarchyNavigator.format_final_prediction(current_level, expert_class)

            return {
                'final_prediction': final_prediction,
                'final_key': expert_class,
                'classification_level': current_level,
                'hierarchy_path': hierarchy_path,
                'final_result': expert_result,
                'note': final_note
            }

        except Exception:
            logger.exception("Failure at expert level")
            final_note = "Error at expert level; classified at competent level"
            final_prediction = HierarchyNavigator.format_final_prediction(
                ClassificationLevel.COMPETENT, competent_class
            )

            return {
                'final_prediction': final_prediction,
                'final_key': competent_class,
                'classification_level': ClassificationLevel.COMPETENT,
                'hierarchy_path': hierarchy_path,
                'final_result': competent_expert_result,
                'note': final_note
            }

    async def predict_image(self, image_data: bytes, filename: str) -> dict[str, Any]:
        """
        Run the hierarchical prediction on an image without blocking the event loop

        Validation and inference run in a worker thread, one image at a time.
        Arguments, result and errors are those of `_predict_image_sync`.
        """
        return await anyio.to_thread.run_sync(
            self._predict_image_sync, image_data, filename, limiter=self._inference_limiter
        )

    _SUPPORTED_ARRAY_DTYPES = (np.uint8, np.uint16)

    @staticmethod
    def _normalize_mode(image: Image.Image) -> Image.Image:
        """
        Bring an image to a mode that preprocessing reads correctly

        - RGB, single-band L and I;16 images are left untouched.
        - Grey modes (bilevel, grey with an alpha band) become L, so neither
          booleans nor the alpha band reach OpenCV.
        - Colour modes (palette with or without transparency, RGBA, CMYK,
          YCbCr, ...) become RGB, so channel 1 is always green for CLAHE.
        - 32-bit integer (I) and floating-point (F) images are rejected outright:
          they have no lossless 8-bit path, and letting them through would have
          OpenCV's PNG encoder saturate their values to black or white instead
          of raising, so a corrupted patch would still get a confident class.

        Raises:
            InvalidImageError: 400 if Pillow cannot convert the mode, the mode is
                I or F, or the normalized image is not 8-bit/16-bit
        """
        mode = image.mode
        if mode in ('I', 'F'):
            raise InvalidImageError("Unsupported image mode.")

        if mode in ('RGB', 'L') or mode.startswith('I;16'):
            return image

        try:
            # Pillow's base mode is 'L' for every grey mode; anything else is colour
            target = 'L' if Image.getmodebase(mode) == 'L' else 'RGB'
            image = image.convert(target)
        except (KeyError, ValueError) as error:
            raise InvalidImageError("Unsupported image mode.") from error

        if np.array(image).dtype not in PredictionService._SUPPORTED_ARRAY_DTYPES:
            raise InvalidImageError("Unsupported image mode.")

        return image

    def _preprocess(self, image_data: bytes) -> list[np.ndarray]:
        """
        Decode the image, apply CLAHE + Gaussian blur and cut the patches

        Args:
            image_data: Raw image bytes (already validated)

        Returns:
            Patches created once and reused at every classification level
        """
        image_pil = self._normalize_mode(Image.open(io.BytesIO(image_data)))
        image_array = np.array(image_pil)
        logger.debug("Image loaded: %s (mode %s)", image_array.shape, image_pil.mode)

        # Apply CLAHE + Gaussian blur
        if len(image_array.shape) == 3:
            processed_image = self._apply_clahe_filter(image_array)
        else:
            processed_image = image_array

        patches = self._create_patches(processed_image, patch_size=640, overlap=0.4)
        logger.info("Preprocessing completed: %d patches of 640x640 with 40%% overlap", len(patches))
        return patches

    def _predict_image_sync(self, image_data: bytes, filename: str) -> dict[str, Any]:
        """
        Run the hierarchical prediction on an image

        Args:
            image_data: Raw image bytes
            filename: Image file name

        Returns:
            Dict with the hierarchical prediction results. `prediction` is the
            display name and `prediction_key` the raw class key.

        Raises:
            InvalidImageError: If the image is empty, too large, not decodable or in an
                unsupported mode
            ModelsUnavailableError: If the general model is not loaded
        """
        self.validate_image(image_data)

        if not self.is_ready:
            raise ModelsUnavailableError()

        try:
            # Preprocessing: done only once. The file name is only logged at DEBUG
            # level because laboratories may put identifiers in it.
            logger.info("Processing image (%d bytes)", len(image_data))
            logger.debug("Image file name: %s", filename)

            patches = self._preprocess(image_data)

            # Hierarchical classification
            if self.settings.enable_hierarchical_classification:
                hierarchical_result = self._hierarchical_classification(patches)

                logger.info("Final prediction: %s (level: %s)%s",
                            hierarchical_result['final_prediction'],
                            hierarchical_result['classification_level'].value,
                            f"; note: {hierarchical_result['note']}"
                            if hierarchical_result.get('note') else "")

                final_result = hierarchical_result['final_result']

                return {
                    "filename": filename,
                    "prediction": hierarchical_result['final_prediction'],
                    "prediction_key": hierarchical_result['final_key'],
                    "confidence": final_result['confidence'],
                    "confidence_percentage": final_result['confidence_percentage'],
                    "class_probabilities": final_result['class_probabilities'],
                    "patch_statistics": final_result['patch_statistics'],
                    "classification_level": hierarchical_result['classification_level'].value,
                    "note": hierarchical_result.get('note'),
                    "voting_method": "hybrid_voting",
                    "status": "success"
                }

            else:
                # Legacy mode: general classification only
                logger.warning("Legacy mode: general classification only "
                               "(enable_hierarchical_classification=False)")
                general_result = self._predict_level(patches, 'general', ClassificationLevel.GENERAL)

                return {
                    "filename": filename,
                    "prediction": general_result['prediction'],
                    "prediction_key": general_result['prediction'],
                    "confidence": general_result['confidence'],
                    "confidence_percentage": general_result['confidence_percentage'],
                    "class_probabilities": general_result['class_probabilities'],
                    "patch_statistics": general_result['patch_statistics'],
                    "voting_method": "hybrid_voting",
                    "status": "success"
                }

        except InvalidImageError:
            raise
        except Exception as e:
            logger.exception("Error during prediction")
            return {
                "filename": filename,
                "error": str(e),
                "status": "error"
            }


_shared_service: PredictionService | None = None
_shared_service_lock = threading.Lock()


def get_prediction_service() -> PredictionService:
    """
    Return the shared service, loading the models on first use.

    Concurrent first calls wait for a single construction instead of each
    loading the checkpoints.
    """
    global _shared_service
    with _shared_service_lock:
        if _shared_service is None:
            _shared_service = PredictionService()
        return _shared_service


def reset_prediction_service() -> None:
    """
    Forget the shared service so the next call builds a new one (used by tests)
    """
    global _shared_service
    with _shared_service_lock:
        _shared_service = None


def __getattr__(name: str):
    # Backwards-compatible `from app.services.prediction_service import prediction_service`
    if name == "prediction_service":
        return get_prediction_service()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
