/**
 * Shared constants, display-label maps and formatters
 *
 * Sections:
 * - Dilutions
 * - File utilities
 * - Document types
 * - Genders
 * - User roles
 * - Result statuses
 * - Booleans
 * - Activity and entity types (audit trail)
 * - Phone prefixes
 */

// =============================================================================
// DILUTIONS
// =============================================================================

/**
 * Available sample dilutions
 */
export const DILUTION_OPTIONS = [
  { value: '80', label: '1:80' },
  { value: '160', label: '1:160' },
  { value: '320', label: '1:320' },
  { value: '640', label: '1:640' },
  { value: '1280', label: '1:1280' },
  { value: '2560', label: '1:2560' },
];

/**
 * Dilution mapping (value → label)
 */
const DILUTION_MAP = {
  '80': '1:80',
  '160': '1:160',
  '320': '1:320',
  '640': '1:640',
  '1280': '1:1280',
  '2560': '1:2560',
};

/**
 * Formats a dilution in the standard 1:X form
 * @param {string|number} dilution - Dilution value
 * @returns {string} Formatted dilution (e.g. "1:80")
 */
export const formatDilution = (dilution) => {
  return DILUTION_MAP[String(dilution)] || `1:${dilution}`;
};

// =============================================================================
// FILE UTILITIES
// =============================================================================

/**
 * Extracts the original file name from a stored file path
 * Strips the UUID and timestamp of the uuid-timestamp-filename.ext format
 *
 * @param {string} filePath - Full file path
 * @returns {string} Original file name
 *
 * @example
 * extractShortFilename('abc123-1234567890-image.jpg') // 'image.jpg'
 * extractShortFilename('/uploads/abc123-1234567890-photo.png') // 'photo.png'
 * extractShortFilename('simple-file.jpg') // 'simple-file.jpg'
 */
export const extractShortFilename = (filePath) => {
  if (!filePath) return '';

  // File name without the directory
  const filename = filePath.split(/[/\\]/).pop();

  // uuid-timestamp-originalname.ext: capture everything after the timestamp
  const match = filename.match(/^[a-f0-9-]+-\d+-(.+)$/i);

  if (match && match[1]) {
    return match[1];
  }

  // Not in the stored-file format: return the name unchanged
  return filename;
};

// =============================================================================
// DOCUMENT TYPES
// =============================================================================

/**
 * Patient document types: the single source of their full and short labels
 */
export const DOCUMENT_TYPES = [
  { value: 'NATIONAL_ID', label: 'National ID card', shortLabel: 'National ID' },
  { value: 'MINOR_ID', label: 'Minor ID card', shortLabel: 'Minor ID' },
  { value: 'FOREIGNER_ID', label: 'Foreign resident ID', shortLabel: 'Foreign resident ID' },
  { value: 'PASSPORT', label: 'Passport', shortLabel: 'Passport' },
  { value: 'BIRTH_CERTIFICATE', label: 'Birth certificate', shortLabel: 'Birth cert.' },
];

const DOCUMENT_TYPE_BY_VALUE = Object.fromEntries(DOCUMENT_TYPES.map((type) => [type.value, type]));

/**
 * Formats a document type as its full name
 * @param {string} documentType - Document type code
 * @returns {string} Full document name
 */
export const formatDocumentType = (documentType) => {
  if (!documentType) return 'Unknown';
  return DOCUMENT_TYPE_BY_VALUE[documentType]?.label || documentType;
};

/**
 * Formats a document type as its short label
 * @param {string} documentType - Document type code
 * @returns {string} Short label (e.g. 'National ID', 'Passport'), or 'Unknown' when missing
 */
export const formatDocumentTypeShort = (documentType) => {
  if (!documentType) return 'Unknown';
  return DOCUMENT_TYPE_BY_VALUE[documentType]?.shortLabel || documentType;
};

/**
 * Formats a full document as short type label and number
 * @param {string} documentType - Document type code
 * @param {string} documentNumber - Document number
 * @returns {string} Format "National ID - 1234567890"
 */
export const formatDocumentWithNumber = (documentType, documentNumber) => {
  if (!documentType || !documentNumber) {
    return documentNumber || '-';
  }
  return `${formatDocumentTypeShort(documentType)} - ${documentNumber}`;
};

// =============================================================================
// GENDERS
// =============================================================================

/**
 * Available genders
 */
export const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Gender mapping (code → label)
 */
const GENDER_MAP = {
  'M': 'Male',
  'F': 'Female',
  'O': 'Other',
  'OTHER': 'Other',
};

/**
 * Formats a gender code as its label
 * @param {string} gender - Gender code
 * @returns {string} Gender label
 */
export const formatGender = (gender) => {
  return GENDER_MAP[gender] || gender;
};

// =============================================================================
// USER ROLES
// =============================================================================

/**
 * Role display labels (role code → label). The single source of role labels:
 * forms, filters and tables work with the codes and use these only for display.
 */
export const ROLE_LABELS = Object.freeze({
  ADMIN: 'Administrator',
  STANDARD: 'Standard',
});

/**
 * Role options for selects: value is the role code, label is for display
 */
export const USER_ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Formats a role code for display
 * @param {string} role - Role code ('ADMIN' | 'STANDARD'); an existing label is kept
 * @returns {string} Role label, or 'Unknown role'
 */
export const formatRoleLabel = (role) => {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return Object.values(ROLE_LABELS).includes(role) ? role : 'Unknown role';
};

// =============================================================================
// RESULT STATUSES
// =============================================================================

/**
 * Result status mapping (code → label)
 */
const RESULT_STATUS_MAP = {
  'PENDING': 'Pending',
  'VERIFIED': 'Verified',
  'CORRECTED': 'Corrected',
};

/**
 * Formats a result status code as its label
 * @param {string} status - Status code (backend format)
 * @returns {string} Status label
 */
export const formatResultStatus = (status) => {
  return RESULT_STATUS_MAP[status] || status || 'Pending';
};

// =============================================================================
// BOOLEANS
// =============================================================================

/**
 * Boolean mapping (value → label)
 */
const BOOLEAN_MAP = {
  'true': 'Yes',
  'True': 'Yes',
  'TRUE': 'Yes',
  'false': 'No',
  'False': 'No',
  'FALSE': 'No',
};

/**
 * Formats a boolean value as a label
 * @param {boolean|string} value - Boolean value
 * @returns {string} 'Yes' or 'No' (other strings are returned unchanged)
 */
export const formatBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return BOOLEAN_MAP[String(value)] || String(value);
};

// =============================================================================
// ACTIVITY TYPES (AUDIT TRAIL)
// =============================================================================

/**
 * Audit-trail activity type codes. Mirrors the backend `ActivityType` enum
 * (api/src/entities/traceabilities/traceability.types.ts) exactly.
 * Branch on these codes, never on the display labels returned by the API.
 */
export const ACTIVITY_TYPES = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_EXPIRED: 'PASSWORD_RESET_EXPIRED',
});

/**
 * Activity type display labels (code → label)
 */
const ACTIVITY_TYPE_MAP = {
  [ACTIVITY_TYPES.CREATE]: 'Create',
  [ACTIVITY_TYPES.UPDATE]: 'Update',
  [ACTIVITY_TYPES.DELETE]: 'Delete',
  [ACTIVITY_TYPES.PASSWORD_RESET_REQUEST]: 'Password reset requested',
  [ACTIVITY_TYPES.PASSWORD_RESET_COMPLETED]: 'Password reset completed',
  [ACTIVITY_TYPES.PASSWORD_RESET_EXPIRED]: 'Password reset link expired',
};

/**
 * Formats an activity type code as its display label
 * @param {string} activityType - Activity type code (backend format)
 * @returns {string} Display label
 */
export const formatActivityType = (activityType) => {
  return ACTIVITY_TYPE_MAP[activityType] || activityType;
};

// =============================================================================
// ENTITY TYPES (AUDIT TRAIL)
// =============================================================================

/**
 * Audit-trail entity type codes. Mirrors the backend `EntityType` enum.
 */
export const ENTITY_TYPES = Object.freeze({
  USER: 'USER',
  PATIENT: 'PATIENT',
  RESULT: 'RESULT',
  CORRECTION: 'CORRECTION',
});

/**
 * Entity type display labels (code → label)
 */
const ENTITY_TYPE_MAP = {
  [ENTITY_TYPES.USER]: 'User',
  [ENTITY_TYPES.PATIENT]: 'Patient',
  [ENTITY_TYPES.RESULT]: 'Result',
  [ENTITY_TYPES.CORRECTION]: 'Correction',
};

/**
 * Formats an entity type code as its display label
 * @param {string} entityType - Entity type code (backend format)
 * @returns {string} Display label
 */
export const formatEntityType = (entityType) => {
  return ENTITY_TYPE_MAP[entityType] || entityType;
};

// =============================================================================
// PHONE PREFIXES
// =============================================================================

/**
 * Default phone prefix preselected in the patient registration form.
 */
export const DEFAULT_PHONE_PREFIX = '+1';

/**
 * Common international phone prefixes.
 */
export const PHONE_PREFIXES = [
  { value: '+1', label: '+1 (USA/Canada)' },
  { value: '+34', label: '+34 (Spain)' },
  { value: '+52', label: '+52 (Mexico)' },
];
