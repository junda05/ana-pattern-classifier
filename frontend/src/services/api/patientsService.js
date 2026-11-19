import axios from '../../config/axios';

/**
 * Patients service
 */

const patientsService = {
  /**
   * Creates a patient
   * @param {Object} patientData - Patient data
   * @returns {Promise<Object>} - Created patient
   */
  createPatient: async (patientData) => {
    const response = await axios.post('/patients', patientData);
    return response.data;
  },

  /**
   * Finds a patient by document
   * @param {string} documentType - Document type
   * @param {string} documentNumber - Document number
   * @returns {Promise<Object>} - Patient data (a 404 error means no patient has this document)
   */
  getPatientByDocument: async (documentType, documentNumber) => {
    const response = await axios.get('/patients/document', {
      params: { documentType, documentNumber }
    });
    return response.data;
  }
};

export default patientsService;
