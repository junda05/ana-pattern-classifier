/**
 * Route constants for the files module
 *
 * Centralizes every HTTP route of FilesController
 * following the DRY (Don't Repeat Yourself) principle
 *
 * Endpoint groups:
 * - predictions/* : images analyzed by users
 * - reference/*   : reference-image gallery, one folder per PredictionClass value
 */

export const FILES_ROUTES = {
  BASE: 'api/v1/files',

  // Prediction image endpoints
  GET_PREDICTION_IMAGE: 'predictions/:filename', // GET /api/v1/files/predictions/:filename

  // Reference gallery endpoints ('classes' must be declared before ':className')
  GET_REFERENCE_CLASSES: 'reference/classes', // GET /api/v1/files/reference/classes
  GET_REFERENCE_IMAGES: 'reference/:className', // GET /api/v1/files/reference/:className
  GET_REFERENCE_IMAGE: 'reference/:className/:filename', // GET /api/v1/files/reference/:className/:filename
} as const;
