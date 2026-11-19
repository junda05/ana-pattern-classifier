import {
  formatBoolean,
  formatResultStatus,
  formatRoleLabel,
  formatDocumentType,
  formatGender,
  formatDilution,
  formatActivityType,
  formatEntityType,
  ACTIVITY_TYPES,
} from './constants';

import { formatDate, formatDateOnly } from './dateUtils';
import { pluralize } from './stringUtils';
import { getFormattedClassName } from '../../config/classMapping';
import traceabilityService from '../api/traceabilityService';

/** Records per request when exporting (the API maximum). */
export const EXPORT_PAGE_SIZE = 100;

/**
 * Local midnight that starts a YYYY-MM-DD day, or null for an empty or malformed value.
 *
 * @param {string} day - Date from a date input (YYYY-MM-DD)
 * @param {number} [offsetDays=0] - Days to add (1 gives the next local midnight)
 * @returns {Date|null}
 */
const localMidnight = (day, offsetDays = 0) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  if (!match) return null;
  const [, year, month, date] = match.map(Number);
  return new Date(year, month - 1, date + offsetDays);
};

/**
 * Audit-trail API filters from the page filters. The chosen days are local days: `from` is
 * the local midnight that starts the first day (inclusive) and `to` the local midnight after
 * the last day (exclusive), both sent as ISO instants. Blank filters are left out.
 *
 * @param {Object} filters
 * @param {string} [filters.userName] - Full name contains
 * @param {string} [filters.dateFrom] - First day (YYYY-MM-DD)
 * @param {string} [filters.dateTo] - Last day (YYYY-MM-DD)
 * @param {string} [filters.activityType] - Activity type code
 * @returns {{ userName?, from?, to?, activityType? }}
 */
export const buildTraceabilityQuery = ({ userName, dateFrom, dateTo, activityType } = {}) => {
  const query = {};
  const name = (userName || '').trim();
  if (name) query.userName = name;
  const from = localMidnight(dateFrom);
  if (from) query.from = from.toISOString();
  const to = localMidnight(dateTo, 1);
  if (to) query.to = to.toISOString();
  if (activityType) query.activityType = activityType;
  return query;
};

/**
 * Loads every audit record matching the filters, EXPORT_PAGE_SIZE per request.
 *
 * @param {Object} query - Filters from buildTraceabilityQuery
 * @param {Function} [onProgress] - Called after each page with { loaded, total }
 * @returns {Promise<Array>} Rows as transformTraceabilityListFromBackend returns them
 */
export const fetchAllTraceabilityRecords = async (query, onProgress) => {
  const records = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await traceabilityService.getRecords({ ...query, page, limit: EXPORT_PAGE_SIZE });
    const rows = transformTraceabilityListFromBackend(response.data);
    records.push(...rows);
    totalPages = response.totalPages || 1;
    onProgress?.({ loaded: records.length, total: response.total ?? records.length });
    if (rows.length === 0) break;
    page += 1;
  } while (page <= totalPages);
  return records;
};

/** Name the API gives to audit records created by the system itself (seed, bootstrap). */
const SYSTEM_USER_NAME = 'System';

/**
 * Formats a date and time for the audit trail, such as "Sep 24, 2026, 1:55 PM"
 */
export const formatDateTime = (isoDate) => (isoDate ? formatDate(isoDate) : '-');

/**
 * Role label of the user who performed an activity; system records have no role.
 *
 * @param {string|null} role - Role code
 * @param {string} userName - Name of the user who performed the activity
 * @returns {string} Role label, "System" or "Unknown role"
 */
export const formatActorRole = (role, userName) => {
  if (!role && userName === SYSTEM_USER_NAME) return SYSTEM_USER_NAME;
  return formatRoleLabel(role);
};

/**
 * Badge type of an activity type. One mapping for the list and the detail view.
 */
export const getActivityBadgeType = (activityType) => {
  switch (activityType) {
    case ACTIVITY_TYPES.CREATE:
      return 'success';
    case ACTIVITY_TYPES.UPDATE:
      return 'info';
    case ACTIVITY_TYPES.DELETE:
      return 'danger';
    default:
      return 'warning';
  }
};

/**
 * Returns the badge type of a validation (result) status
 */
export const getValidationBadgeType = (status) => {
  const typeMap = {
    'PENDING': 'warning',
    'VERIFIED': 'success',
    'CORRECTED': 'info'
  };
  return typeMap[status] || 'warning';
};

const COUNT_FIELDS = {
  correctionscount: 'correction',
  predictionscount: 'image',
  newpredictionsadded: 'new image',
};

/**
 * Formats a field value for display. Every relabelling applies only to the
 * fields it belongs to (a role code in an observation stays as written).
 *
 * @param {string} fieldName - Field name (API camelCase)
 * @param {any} value - Value to format
 * @returns {string} Display value
 */
export const formatFieldValue = (fieldName, value) => {
  if (value === null || value === undefined) {
    return '(empty)';
  }

  const strValue = String(value).trim();
  if (!strValue || strValue === 'null' || strValue === 'undefined') {
    return '(empty)';
  }

  const field = fieldName ? fieldName.toLowerCase() : '';

  if (COUNT_FIELDS[field]) {
    return Number.isNaN(parseInt(strValue, 10)) ? strValue : pluralize(strValue, COUNT_FIELDS[field]);
  }
  if (field === 'role' || field.endsWith('role')) {
    return formatRoleLabel(strValue);
  }
  if (field.includes('status')) {
    return formatResultStatus(strValue);
  }
  if (/^(is|has)[a-z]/.test(field)) {
    return formatBoolean(strValue);
  }
  if (field.includes('documenttype')) {
    return formatDocumentType(strValue);
  }
  if (field === 'gender' || field.endsWith('gender')) {
    return formatGender(strValue);
  }
  if (field.includes('prediction')) {
    return getFormattedClassName(strValue);
  }
  if (field.includes('dilution')) {
    return formatDilution(strValue);
  }
  if (field.includes('phone')) {
    return strValue;
  }
  if (field.includes('birth')) {
    return formatDateOnly(value);
  }
  if (field.includes('date') || field.includes('hour')) {
    const dateValue = new Date(value);
    if (!Number.isNaN(dateValue.getTime())) {
      return formatDateTime(dateValue);
    }
  }

  return strValue;
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/**
 * Builds the CSV text of the audit-trail list rows.
 * Columns: date and time, user, role, activity, entity.
 *
 * @param {Array} records - Rows from transformTraceabilityListFromBackend
 * @returns {string} CSV text (header + one line per record)
 */
export const buildAuditCsv = (records) => {
  const header = ['Date and Time', 'User', 'Role', 'Activity', 'Entity'];
  const rows = records.map((record) => [
    formatDateTime(record.dateTime),
    record.userName || '-',
    formatActorRole(record.userRole, record.userName),
    record.activityTypeLabel || formatActivityType(record.activityType) || '-',
    record.entityType ? formatEntityType(record.entityType) : '-',
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
};

/**
 * Downloads the audit-trail rows as a CSV file (opens in Excel)
 */
export const exportToCSV = (records, filename = 'audit-trail.csv') => {
  // UTF-8 BOM so spreadsheet apps detect the encoding
  const blob = new Blob(['\ufeff' + buildAuditCsv(records)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Transforms the audit-trail list returned by the API into the frontend format
 *
 * `activityType` holds the backend code (compare it with ACTIVITY_TYPES);
 * `activityTypeLabel` is display text only.
 *
 * @param {Array} backendData - Array of TraceabilityListDto from the backend
 * @returns {Array} Transformed array for the frontend
 */
export const transformTraceabilityListFromBackend = (backendData) => {
  if (!backendData || !Array.isArray(backendData)) {
    return [];
  }

  return backendData.map(item => ({
    id: item.traceabilityId,
    userName: item.userFullName,
    userRole: item.userRole || null,
    dateTime: item.dateAndHour,
    activityType: item.activityType,
    activityTypeLabel: item.activityTypeLabel,
    entityType: item.entityType || null,
  }));
};

/**
 * Transforms the audit-record detail returned by the API into the frontend format
 *
 * `activityType` holds the backend code (compare it with ACTIVITY_TYPES);
 * `activityTypeLabel` is display text only.
 *
 * @param {Object} backendDetail - TraceabilityDetailDto from the backend
 * @returns {Object} Transformed object for the frontend
 */
export const transformTraceabilityDetailFromBackend = (backendDetail) => {
  if (!backendDetail) {
    return null;
  }

  const {
    traceabilityId,
    generalInfo,
    userInfo,
    entityType,
    entityTypeLabel,
    patientInfo,
    affectedUserInfo,
    resultInfo,
    fieldChanges
  } = backendDetail;

  return {
    id: traceabilityId,

    // General information
    dateTime: generalInfo?.dateAndHour,
    activityType: generalInfo?.activityType,
    activityTypeLabel: generalInfo?.activityTypeLabel,

    // User who performed the activity (system records have no user id or role)
    userName: userInfo?.fullName,
    userRole: userInfo?.role || null,
    userId: userInfo?.userId,

    // Entity type (code) and its display label
    entityType,
    entityTypeLabel,

    // Full information of the affected patient
    patientName: patientInfo?.fullName,
    patientDocumentType: patientInfo?.documentType,
    patientDocument: patientInfo?.documentNumber,
    patientGender: patientInfo?.gender,
    patientBirthDate: patientInfo?.birthDate,
    patientEmail: patientInfo?.email,
    patientPhonePrefix: patientInfo?.phonePrefix,
    patientPhoneNumber: patientInfo?.phoneNumber,

    affectedUserName: affectedUserInfo?.fullName,
    affectedUserUsername: affectedUserInfo?.username,
    affectedUserRole: affectedUserInfo?.role || null,
    affectedUserEmail: affectedUserInfo?.email,

    resultStatus: resultInfo?.status,
    resultDateTime: resultInfo?.dateAndHour,
    resultObservations: resultInfo?.observations,
    predictionsCount: resultInfo?.predictionsCount,
    predictions: resultInfo?.predictions || [],
    newPredictionsAdded: resultInfo?.newPredictionsAdded || 0,
    addedPredictions: resultInfo?.addedPredictions || [],
    originalResultDateTime: resultInfo?.originalResultDateTime,

    // Changed fields (array of changes)
    fieldChanges: fieldChanges || []
  };
};
