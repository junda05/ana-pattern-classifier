/**
 * Types and constants for the file management module
 *
 * Defines:
 * - Allowed MIME types for medical images
 * - Valid file extensions
 * - File size limits
 * - Storage paths
 */

/**
 * Allowed image MIME types
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/bmp',
  'image/tiff',
] as const;

/**
 * Allowed file extensions
 */
export const ALLOWED_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.bmp',
  '.tiff',
] as const;

/**
 * Maximum file size in bytes (10MB)
 * Configurable through the MAX_FILE_SIZE environment variable
 */
export const MAX_FILE_SIZE =
  Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB by default

/**
 * Default root folder for uploads when UPLOADS_DIR is not set
 * (relative to the working directory)
 */
export const DEFAULT_UPLOADS_DIR = './uploads';

/**
 * Subfolder (under the uploads root) for prediction images
 */
export const PREDICTIONS_SUBDIR = 'predictions';

/**
 * Subfolder (under the uploads root) for the reference-image gallery
 * Layout: one folder per PredictionClass value, e.g. reference/NUCLEAR_HOMOGENEOUS/
 */
export const REFERENCE_SUBDIR = 'reference';

/**
 * Maximum number of images (predictions) one result can hold, saved ones
 * included (checked by the append endpoint)
 */
export const MAX_IMAGES_PER_RESULT = 20;

/**
 * Maximum number of files per request: a request never carries more images
 * than one result can hold
 */
export const MAX_FILES_PER_REQUEST = MAX_IMAGES_PER_RESULT;

/**
 * Allowed MIME type
 */
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Allowed file extension
 */
export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];
