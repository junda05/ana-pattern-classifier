import axios from '../../config/axios';

/**
 * Files service for the reference-image gallery
 * The gallery is keyed by pattern class (PredictionClass values, e.g. NUCLEAR_HOMOGENEOUS)
 * Every URL goes through the API with JWT authentication
 */

const filesService = {
  /**
   * Gets the pattern classes that have a reference-image folder
   * @returns {Promise<string[]>} - Array of PredictionClass values (empty if there is no gallery)
   */
  getReferenceClasses: async () => {
    const response = await axios.get('/files/reference/classes');
    return response.data;
  },

  /**
   * Gets the reference images of one pattern class
   * @param {string} className - PredictionClass value (e.g. NUCLEAR_HOMOGENEOUS)
   * @returns {Promise<Array<{filename: string, url: string}>>} - Images whose url is relative to
   *   the API base (e.g. "/files/reference/NUCLEAR_HOMOGENEOUS/example-1.jpg"); load them with
   *   useAuthorizedImage, which sends the JWT
   */
  getReferenceImagesByClass: async (className) => {
    const response = await axios.get(`/files/reference/${encodeURIComponent(className)}`);
    return response.data;
  },

  /**
   * Returns the file name without its extension
   * @param {string} filename - File name
   * @returns {string} - File name without extension
   */
  getImageName: (filename) => {
    if (!filename) return '';
    return filename.replace(/\.(jpg|jpeg|png|bmp|tiff)$/i, '');
  }
};

export default filesService;
