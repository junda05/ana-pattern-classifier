/**
 * Confidence levels of ANA pattern predictions
 *
 * Defines the thresholds, badge types and colors used to display
 * how confident the classifier is in each prediction
 */

import { colors } from './colors';

/**
 * Confidence thresholds (percentage)
 */
const ConfidenceThresholds = {
  HIGH: 95,      // >= 95%
  MEDIUM: 85,    // 85% - 94.9%
  LOW: 0         // < 85%
};

/**
 * Badge type for each confidence level
 */
const ConfidenceBadgeType = {
  HIGH: 'success',    // Green
  MEDIUM: 'warning',  // Yellow
  LOW: 'danger'       // Red
};

/**
 * Colors for each confidence level
 */
const ConfidenceColors = colors.confidence;

/**
 * Returns the confidence level for a percentage
 *
 * @param {number} confidencePercentage - Confidence percentage (0-100)
 * @returns {string} Confidence level ('HIGH', 'MEDIUM', 'LOW')
 */
const getConfidenceLevel = (confidencePercentage) => {
  const confidence = parseFloat(confidencePercentage);

  if (isNaN(confidence)) return 'LOW';

  if (confidence >= ConfidenceThresholds.HIGH) {
    return 'HIGH';
  } else if (confidence >= ConfidenceThresholds.MEDIUM) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
};

/**
 * Returns the badge type for a confidence percentage
 *
 * @param {number} confidencePercentage - Confidence percentage (0-100)
 * @returns {string} Badge type ('success', 'warning', 'danger')
 */
export const getConfidenceBadgeType = (confidencePercentage) => {
  const level = getConfidenceLevel(confidencePercentage);
  return ConfidenceBadgeType[level];
};

/**
 * Returns the colors for a confidence percentage
 *
 * @param {number} confidencePercentage - Confidence percentage (0-100)
 * @returns {Object} Colors object (bg, bgLight, text, border)
 */
export const getConfidenceColors = (confidencePercentage) => {
  const level = getConfidenceLevel(confidencePercentage);
  return ConfidenceColors[level];
};

/**
 * Formats the text of the confidence badge
 *
 * @param {number} confidencePercentage - Confidence percentage (0-100)
 * @returns {string} Text formatted as "Confidence: XX.X%"
 */
export const formatConfidenceText = (confidencePercentage) => {
  const confidence = parseFloat(confidencePercentage);

  if (isNaN(confidence)) return 'Confidence: N/A';

  return `Confidence: ${confidence.toFixed(1)}%`;
};

/**
 * Gets the badge type for a prediction class
 * Maps classes to standard badge types
 *
 * @param {string} predictionClass - Prediction class
 * @returns {string} Badge type ('info', 'secondary', 'danger', etc.)
 */
export const getPredictionClassBadgeType = (predictionClass) => {
  if (!predictionClass) return 'secondary';

  const classUpper = predictionClass.toUpperCase();

  if (classUpper.includes('NUCLEAR') || classUpper.includes('NUCLEOLAR')) {
    return 'info';  // Blue for Nuclear
  }
  if (classUpper.includes('CYTOPLASM')) {
    return 'purple';  // Purple for Cytoplasmic
  }
  if (classUpper.includes('MITOTIC')) {
    return 'pink';  // Pink for Mitotic
  }
  if (classUpper.includes('NEGATIVE')) {
    return 'secondary';  // Gray for Negative
  }

  return 'secondary';
};

