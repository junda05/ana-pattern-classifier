import axiosClient from '../../config/axios';

/**
 * Clinical reports service (finalized results)
 *
 * Endpoints:
 * GET  /api/v1/reports/search    -> Searches reports by patient name or document
 * GET  /api/v1/reports/:id       -> Full detail of a clinical report
 *
 * Only finalized results (VERIFIED or CORRECTED) are returned.
 * JWT tokens are attached by the shared axios client.
 */

const reportsService = {
  /**
   * Searches clinical reports by patient name or document
   * Only finalized results (VERIFIED or CORRECTED) are returned
   *
   * @param {Object} params - Search parameters
   * @param {string} params.patientName - Patient name (partial match, optional)
   * @param {string} params.patientDocument - Patient document number (exact match, optional)
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.limit - Results per page (default: 10, max: 50)
   * @returns {Promise<Object>} Paginated list of reports
   *
   * Validation:
   * - At least one of patientName or patientDocument is required
   *
   * Response:
   * {
   *   data: ReportListDto[],
   *   total: number,
   *   page: number,
   *   limit: number,
   *   totalPages: number
   * }
   */
  searchReports: async ({ patientName, patientDocument, page = 1, limit = 10 } = {}) => {
    if (!patientName && !patientDocument) {
      throw new Error('Enter at least one search criterion (patient name or document number).');
    }

    const params = { page, limit };

    if (patientName) {
      params.patientName = patientName.trim();
    }

    if (patientDocument) {
      params.patientDocument = patientDocument.trim();
    }

    const { data } = await axiosClient.get('/reports/search', { params });
    return data;
  },

  /**
   * Returns the full detail of a clinical report
   *
   * @param {number} reportId - Result (report) ID
   * @returns {Promise<Object>} Full report detail (ReportDetailDto)
   *
   * The response includes:
   * - Full patient information (name, document, gender, date of birth, contact)
   * - Responsible physician (the user who verified the result or authored its latest correction)
   * - verifiedBy / verifiedAt when the result was verified
   * - Every prediction of the result (ordered) with its image and final pattern
   *   (the latest correction if any, otherwise the model prediction)
   * - Creation and last-modification dates
   * - Analysis observations
   */
  getReportById: async (reportId) => {
    const { data } = await axiosClient.get(`/reports/${reportId}`);
    return data;
  }
};

export default reportsService;
