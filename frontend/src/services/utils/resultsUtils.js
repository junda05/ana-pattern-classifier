/**
 * Result data helpers: transform result list items from the backend shape to
 * the rows shown on Home.
 */
import { formatDate } from './dateUtils';

/**
 * Transforms a backend result list item (ResultListDto) into a Home table row
 *
 * @param {Object} backendResult - { resultId, dateAndHour, status, patient, user, predictionsCount }
 * @returns {Object|null} Row with the patient's name, document and contact details
 */
export const transformBackendResultToFrontend = (backendResult) => {
  if (!backendResult) return null;

  return {
    id: backendResult.resultId,
    patientName: backendResult.patient?.fullName || 'N/A',
    documentNumber: backendResult.patient?.documentNumber || 'N/A',
    // No default: a missing document type is shown as "Unknown", never guessed
    documentType: backendResult.patient?.documentType || null,
    dateTime: formatDate(backendResult.dateAndHour),
    status: backendResult.status,
    predictionsCount: backendResult.predictionsCount || 0,
    patientId: backendResult.patient?.patientId,
    patientEmail: backendResult.patient?.email,
    patientPhoneNumber: backendResult.patient?.phoneNumber,
    patientPhonePrefix: backendResult.patient?.phonePrefix
  };
};

/**
 * Transforms an array of backend results
 *
 * @param {Array} backendResults - Results from the backend
 * @returns {Array} Transformed results
 */
export const transformBackendResultsToFrontend = (backendResults) => {
  if (!Array.isArray(backendResults)) {
    return [];
  }

  return backendResults
    .map(transformBackendResultToFrontend)
    .filter(result => result !== null);
};
