/**
 * Display labels for entity fields
 *
 * Centralizes the mapping from technical field names to the human-readable
 * labels shown to users.
 *
 * Mainly used by:
 * - The audit trail (TraceabilityService)
 * - Reports and exports
 * - Validation messages
 *
 * Principles:
 * - DRY: a single source of truth for labels
 * - SRP: only maps technical names to display labels
 * - Maintainability: easy to update and extend
 */

/**
 * Full mapping from technical field names to display labels
 */
export const FIELD_LABELS: Record<string, string> = {
  // ============================================================================
  // USER FIELDS
  // ============================================================================
  username: 'Username',
  fullName: 'Full name',
  email: 'Email',
  professionalCard: 'Professional license',
  role: 'Role',
  isActive: 'Active',
  password: 'Password',
  password_reset_request: 'Password reset request',

  // ============================================================================
  // PATIENT FIELDS
  // ============================================================================
  documentType: 'Document type',
  documentNumber: 'Document number',
  gender: 'Gender',
  birthDate: 'Date of birth',
  phonePrefix: 'Phone prefix',
  phoneNumber: 'Phone number',

  // ============================================================================
  // RESULT AND PREDICTION FIELDS
  // ============================================================================
  prediction: 'Prediction',
  confidencePercentage: 'Confidence',
  observations: 'Observations',
  status: 'Status',
  patientId: 'Patient ID',
  userId: 'User ID',
  dateAndHour: 'Date and time',
  predictionsCount: 'Images analyzed',
  correctionsCount: 'Corrections made',
  dilution: 'Dilution',
  imagePath: 'Image path',

  // ============================================================================
  // PREFIXED RESULT FIELDS (used by corrections)
  // ============================================================================
  resultId: 'Result ID',
  resultStatus: 'Result status',
  resultDateAndHour: 'Result date and time',
  resultObservations: 'Result observations',

  // ============================================================================
  // CORRECTION FIELDS
  // ============================================================================
  predictionId: 'Prediction ID',
  originalPrediction: 'Original prediction',
  correctedPrediction: 'Corrected prediction',
  correctedBy: 'Corrected by',
  correctedResultId: 'Correction ID',

  // ============================================================================
  // OPERATION FIELDS (audit trail)
  // ============================================================================
  newPredictionsAdded: 'New images added',
  addedPredictions: 'Added predictions',
  // dilutionUpdated is handled dynamically as dilutionUpdated_N

  // ============================================================================
  // PREFIXED PATIENT FIELDS (used by results)
  // ============================================================================
  patientFullName: 'Patient full name',
  patientDocumentType: 'Patient document type',
  patientDocumentNumber: 'Patient document number',
  patientGender: 'Patient gender',
  patientBirthDate: 'Patient date of birth',
  patientEmail: 'Patient email',
  patientPhonePrefix: 'Patient phone prefix',
  patientPhoneNumber: 'Patient phone number',
};

/**
 * Label used for the dynamic dilutionUpdated_N fields
 */
export const DILUTION_UPDATED_LABEL = 'Dilution changed';

/**
 * Returns the display label for a technical field name
 * Supports dynamic fields with special patterns
 *
 * @param fieldName - Technical field name
 * @returns Display label, or the original name if no mapping exists
 *
 * @example
 * getFieldLabel('username') // 'Username'
 * getFieldLabel('patientFullName') // 'Patient full name'
 * getFieldLabel('dilutionUpdated_0') // 'Dilution changed'
 * getFieldLabel('unknownField') // 'unknownField'
 */
export function getFieldLabel(fieldName: string): string {
  // Handle dynamic fields matching the dilutionUpdated_N pattern
  if (fieldName.startsWith('dilutionUpdated_')) {
    return DILUTION_UPDATED_LABEL;
  }

  // Look up the static mapping
  return FIELD_LABELS[fieldName] || fieldName;
}
