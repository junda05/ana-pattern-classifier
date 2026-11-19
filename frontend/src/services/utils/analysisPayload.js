/**
 * Builds the save payloads of the analysis workflow.
 *
 * Every selected image carries a stable id from the moment it is added; the
 * analysis result of an image carries the same id. Predictions, files,
 * dilutions and corrections are therefore matched by id, never by array
 * position, so removed or failed images cannot shift data onto another image.
 */
import { normalizePredictionToEnum } from '../../config/classMapping';

/** Most images one result can hold (saved plus new). */
export const MAX_IMAGES_PER_RESULT = 20;

let localIdCounter = 0;

/**
 * Observations as the API stores them: blank text (or none) is sent as null, which clears them.
 *
 * @param {string|null|undefined} text - Observations typed by the user
 * @returns {string|null}
 */
export const normalizeObservations = (text) => (typeof text === 'string' && text.trim() !== '' ? text : null);

/**
 * Returns a unique id for an image added in this browser session.
 * crypto.randomUUID is only available in secure contexts, hence the fallback.
 *
 * @returns {string} Unique id
 */
export const createLocalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  localIdCounter += 1;
  return `image-${Date.now().toString(36)}-${localIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Whether an analysis result can be saved: it succeeded and carries the API signature.
 *
 * @param {Object|undefined} result - Analysis result of one image
 * @returns {boolean}
 */
export const isSignedResult = (result) => Boolean(result && !result.error && result.signature);

/**
 * New predictions to save: the successfully analyzed images, in upload order, each with
 * the signature the API issued for it. The class key, confidence percentage and classification
 * level are the analyze values unchanged: the API verifies the signature over them.
 *
 * @param {Array<{id, file, dilution}>} images - Selected images
 * @param {Object<string, Object>} resultsById - Analysis results keyed by image id
 * @returns {{ predictions: Array, files: File[], indexById: Object<string, number> }}
 */
export const buildNewPredictions = (images, resultsById) => {
  const saved = images.filter((image) => resultsById[image.id] && !resultsById[image.id].error);

  return {
    predictions: saved.map((image) => ({
      prediction: resultsById[image.id].predictionKey,
      confidencePercentage: resultsById[image.id].confidence,
      classificationLevel: resultsById[image.id].classificationLevel,
      signature: resultsById[image.id].signature,
      dilution: image.dilution,
    })),
    files: saved.map((image) => image.file),
    indexById: Object.fromEntries(saved.map((image, index) => [image.id, index])),
  };
};

/**
 * Corrections of new predictions, addressed by their index in the saved list.
 * A "correction" to the class the model predicted changes nothing and is left out.
 *
 * @param {Object<string, string>} correctionsById - Corrected class key per image id
 * @param {Object<string, number>} indexById - Index of each saved image (from buildNewPredictions)
 * @param {Array<{prediction}>} [predictions] - Saved predictions (from buildNewPredictions), for the model classes
 * @returns {Array<{imageIndex, correctedPrediction}>|null} Corrections, or null if one is not a known class
 */
export const buildNewCorrections = (correctionsById, indexById, predictions = []) => {
  const corrections = Object.entries(correctionsById)
    .filter(([id, value]) => value && indexById[id] !== undefined)
    .map(([id, value]) => ({ imageIndex: indexById[id], correctedPrediction: normalizePredictionToEnum(value) }))
    .filter((correction) => correction.correctedPrediction !== predictions[correction.imageIndex]?.prediction)
    .sort((a, b) => a.imageIndex - b.imageIndex);

  return corrections.some((correction) => !correction.correctedPrediction) ? null : corrections;
};

/**
 * Corrections of predictions that are already saved.
 * A "correction" to the prediction's own class changes nothing and is left out.
 *
 * @param {Object<string, string>} correctionsByPredictionId - Corrected class key per prediction id
 * @param {Array<{predictionId, prediction}>} [existingPredictions] - Saved predictions, for the model classes
 * @returns {Array<{predictionId, correctedPrediction}>|null} Corrections, or null if one is not a known class
 */
export const buildExistingCorrections = (correctionsByPredictionId, existingPredictions = []) => {
  const modelClassById = Object.fromEntries(
    existingPredictions.map((prediction) => [prediction.predictionId, normalizePredictionToEnum(prediction.prediction)])
  );
  const corrections = Object.entries(correctionsByPredictionId)
    .filter(([, value]) => value)
    .map(([predictionId, value]) => ({
      predictionId: Number(predictionId),
      correctedPrediction: normalizePredictionToEnum(value),
    }))
    .filter((correction) => correction.correctedPrediction !== modelClassById[correction.predictionId]);

  return corrections.some((correction) => !correction.correctedPrediction) ? null : corrections;
};

/**
 * Adds the correction notes (from the correction form) to every correction.
 * They never become the result observations.
 *
 * @param {Array<Object>} corrections - Corrections
 * @param {string} notes - Correction notes
 * @returns {Array<Object>} Corrections, with `observations` when there are notes
 */
export const withCorrectionNotes = (corrections, notes) => {
  const text = normalizeObservations(notes);
  return text ? corrections.map((correction) => ({ ...correction, observations: text })) : corrections;
};

/**
 * Dilution changes on saved predictions.
 *
 * @param {Array} existingPredictions - Saved predictions
 * @param {Object<number, string>} dilutionEdits - New dilution per prediction id
 * @returns {Array<{predictionId, dilution}>} Only the dilutions that changed
 */
export const buildDilutionUpdates = (existingPredictions, dilutionEdits) =>
  existingPredictions
    .filter((prediction) => dilutionEdits[prediction.predictionId] && dilutionEdits[prediction.predictionId] !== prediction.dilution)
    .map((prediction) => ({ predictionId: prediction.predictionId, dilution: dilutionEdits[prediction.predictionId] }));

/**
 * Saved predictions after a successful append: the response lists them all; otherwise the
 * new predictions are added under the ids the API reported (addedPredictionIds, upload order).
 *
 * @param {Array} existingPredictions - Predictions saved before the append
 * @param {Array} newPredictions - Predictions sent in the append (from buildNewPredictions)
 * @param {Object} response - Append response (result detail + addedPredictionIds)
 * @returns {Array} Saved predictions
 */
export const applyAppendResponse = (existingPredictions, newPredictions, response) => {
  if (Array.isArray(response?.predictions)) {
    return response.predictions;
  }
  const addedIds = Array.isArray(response?.addedPredictionIds) ? response.addedPredictionIds : [];
  return [
    ...existingPredictions,
    ...newPredictions.map((prediction, index) => ({ ...prediction, predictionId: addedIds[index] })),
  ];
};
