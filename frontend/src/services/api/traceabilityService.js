import axiosClient from '../../config/axios';

/**
 * Audit trail service
 *
 * Endpoints:
 * GET  /api/v1/traceability              -> Paginated list of audit records
 * GET  /api/v1/traceability/:id          -> Full detail of an audit record
 */

const traceabilityService = {
  /**
   * Returns a paginated list of audit records
   *
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.limit - Records per page (default: 10, at most 100)
   * @param {string} [params.from] - ISO 8601 instant, inclusive
   * @param {string} [params.to] - ISO 8601 instant, exclusive
   * @param {string} [params.userName] - Full name of the user who acted contains (case-insensitive)
   * @param {string} [params.activityType] - Activity type code (ACTIVITY_TYPES)
   * @returns {Promise<Object>} Paginated list of records
   *
   * Response:
   * {
   *   data: TraceabilityListDto[],
   *   total: number,
   *   page: number,
   *   limit: number,
   *   totalPages: number
   * }
   */
  getRecords: async ({ page = 1, limit = 10, from, to, userName, activityType } = {}) => {
    const params = { page, limit };
    if (from) params.from = from;
    if (to) params.to = to;
    if (userName) params.userName = userName;
    if (activityType) params.activityType = activityType;
    const { data } = await axiosClient.get('/traceability', { params });
    return data;
  },

  /**
   * Returns the full detail of an audit record
   *
   * @param {number} traceabilityId - Audit record ID
   * @returns {Promise<Object>} Full record detail (TraceabilityDetailDto)
   *
   * The response includes:
   * - General information (date, activity type)
   * - The user who performed the activity
   * - The affected entity (patient, user or result)
   * - The changed fields with their previous and new values
   */
  getRecordById: async (traceabilityId) => {
    const { data } = await axiosClient.get(`/traceability/${traceabilityId}`);
    return data;
  }
};

export default traceabilityService;
