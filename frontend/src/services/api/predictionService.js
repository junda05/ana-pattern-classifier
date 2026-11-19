/**
 * Image classification through the API prediction proxy
 *
 * The browser never talks to the prediction service directly: each image is
 * posted to POST /api/v1/predictions/analyze with the user's JWT, and the API
 * forwards it to the predictor with its own credentials.
 *
 * Responsibilities:
 * - Sending each image (multipart field "file") to the API
 * - Turning each response into the shape used by the analysis screens, keeping the
 *   API-issued image hash and prediction signature that the save endpoints require
 * - Reporting per-image failures without failing the whole batch
 */

import axiosClient from '../../config/axios';
import { getFormattedClassName, resolveClassKey, ClassificationLevel } from '../../config/classMapping';
import { getApiErrorMessage } from '../utils/apiErrors';

// Predictions run the full hierarchical model chain and can take a while.
const PREDICTION_TIMEOUT_MS = 120000;

export const PREDICTION_UNAVAILABLE_MESSAGE =
  'The prediction service is unavailable. Please try again in a moment.';

const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/**
 * Message to show for a failed prediction request.
 *
 * @param {Error} error - Axios error
 * @returns {string} User-facing message
 */
const toPredictionErrorMessage = (error) => {
  const status = error.response?.status;

  if (UNAVAILABLE_STATUSES.has(status)) {
    return PREDICTION_UNAVAILABLE_MESSAGE;
  }
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The analysis took too long. Please try again in a moment.'
      : 'Could not connect to the server. Check your connection and try again.';
  }
  return getApiErrorMessage(error, 'The image could not be analyzed.');
};

/**
 * Classifies one image.
 *
 * @param {{ id: string, file: File }} image - Image and its stable id
 * @returns {Promise<Object>} Analysis result (or a failed entry)
 */
const predictImage = async ({ id, file }) => {
  const failed = (errorMessage) => ({
    id,
    fileName: file.name,
    error: true,
    errorMessage,
    confidence: 0,
    formattedPattern: 'Processing Error',
    details: `Error: ${errorMessage}`,
  });

  let data;
  try {
    const formData = new FormData();
    formData.append('file', file);

    ({ data } = await axiosClient.post('/predictions/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: PREDICTION_TIMEOUT_MS,
    }));
  } catch (error) {
    return failed(toPredictionErrorMessage(error));
  }

  // The raw class key is the source of truth; display names are never reverse-mapped.
  const predictionKey = resolveClassKey(data?.prediction_key);
  if (!predictionKey || data.prediction_key !== predictionKey) {
    return failed('The prediction service returned an unrecognized pattern.');
  }

  // Both values are signed by the API and must be sent back unchanged when saving:
  // the API signs 'general' when the level is missing, and never signs a missing percentage.
  if (typeof data.confidence_percentage !== 'number') {
    return failed('The prediction service returned no confidence percentage.');
  }
  const level = data.classification_level || ClassificationLevel.GENERAL;
  const confidence = data.confidence_percentage;

  return {
    id,
    fileName: file.name,
    error: false,
    predictionKey,
    classificationLevel: level,
    confidence,
    formattedPattern: getFormattedClassName(predictionKey, level),
    patchStatistics: data.patch_statistics || null,
    classProbabilities: data.class_probabilities || null,
    // Issued by the API over the image hash, class, confidence and level; sent back when saving
    // so the API can check the prediction was not altered. Without it the image cannot be saved.
    imageSha256: data.imageSha256 || null,
    signature: data.signature || null,
  };
};

/**
 * Classifies a batch of images, one request per image.
 *
 * @param {Array<{ id: string, file: File }>} images - Images with stable ids
 * @returns {Promise<Array>} One result per image, in the same order, carrying the image id
 */
export const predictImages = async (images) => {
  if (!images || images.length === 0) {
    throw new Error('No images were provided for analysis.');
  }

  return Promise.all(images.map(predictImage));
};
