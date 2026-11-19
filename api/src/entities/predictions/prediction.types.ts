/**
 * Types and enums for the Prediction entity
 *
 * Dilution - standard sample dilutions used in the analysis:
 * - Values: 80, 160, 320, 640, 1280, 2560 (meaning 1:80, 1:160, 1:320, 1:640, 1:1280, 1:2560)
 */

export enum Dilution {
  DILUTION_80 = '80',
  DILUTION_160 = '160',
  DILUTION_320 = '320',
  DILUTION_640 = '640',
  DILUTION_1280 = '1280',
  DILUTION_2560 = '2560',
}

/**
 * Hierarchical level of a model prediction, as reported by the prediction
 * service (classification_level). Covered by the prediction signature.
 */
export enum ClassificationLevel {
  GENERAL = 'general',
  COMPETENT = 'competent',
  EXPERT = 'expert',
}
