import axiosClient from '../../config/axios';

/**
 * Results service
 *
 * Endpoints:
 * GET   /api/v1/results                              -> Paginated list of results
 * GET   /api/v1/results/:id                          -> Detail of a result
 * PATCH /api/v1/results/:id                          -> Updates a result (status/observations)
 * POST  /api/v1/results/batch/with-files             -> Creates a result with predictions and image files
 * POST  /api/v1/results/:id/predictions/with-files   -> Saves changes to an existing result (images, corrections, status)
 * POST  /api/v1/results/corrections/batch            -> Creates corrections in batch
 * GET   /api/v1/results/statistics                   -> Result statistics
 */

const resultsService = {
  /**
   * Returns a paginated list of results
   *
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.limit - Results per page (default: 10)
   * @param {string} params.status - Status filter: PENDING | VERIFIED | CORRECTED (optional)
   * @param {string} params.search - Patient full name or document number contains, case-insensitive (optional)
   * @returns {Promise<Object>} Paginated list of results
   *
   * Response:
   * {
   *   data: ResultListDto[],
   *   total: number,
   *   page: number,
   *   limit: number,
   *   totalPages: number
   * }
   */
  getResults: async ({ page = 1, limit = 10, status = null, search = '' } = {}) => {
    const params = { page, limit };
    if (status) {
      params.status = status;
    }
    const searchText = (search || '').trim();
    if (searchText) {
      params.search = searchText;
    }

    const { data } = await axiosClient.get('/results', { params });
    return data;
  },

  /**
   * Returns the full detail of a result
   *
   * @param {number} resultId - Result ID
   * @returns {Promise<Object>} Full result detail (ResultDetailDto)
   */
  getResultById: async (resultId) => {
    const { data } = await axiosClient.get(`/results/${resultId}`);
    return data;
  },

  /**
   * Creates a result with several predictions AND their image files
   *
   * Uploads the files and creates the result in a single multipart/form-data
   * request: the files go in the "images" field and the result data, as a
   * JSON string, in the "data" field.
   *
   * The result is attributed to the authenticated user (taken from the JWT
   * by the API); the body carries no user ID.
   *
   * @param {Object} resultData - Result data (CreateBatchResultsWithFilesDto)
   * @param {number} resultData.patientId - Patient ID
   * @param {Array} resultData.predictions - Exactly one prediction per file, in the same order as the files (no imagePath)
   * @param {string} resultData.predictions[].prediction - Original classifier prediction (PredictionClass key)
   * @param {number} resultData.predictions[].confidencePercentage - Confidence percentage (analyze confidence_percentage, unchanged)
   * @param {string} resultData.predictions[].classificationLevel - Analyze classification_level: general | competent | expert
   * @param {string} resultData.predictions[].dilution - Dilution
   * @param {string} resultData.predictions[].signature - Signature issued by POST /predictions/analyze
   *   for the image at the same index (the API rejects a prediction whose signature does not verify)
   * @param {Array} [resultData.corrections] - Corrections of the new predictions (optional)
   * @param {number} resultData.corrections[].imageIndex - Index of the corrected prediction/file (0-based)
   * @param {string} resultData.corrections[].correctedPrediction - Corrected class (PredictionClass key)
   * @param {string} [resultData.corrections[].observations] - Correction observations
   * @param {string} [resultData.observations] - General observations
   * @param {string} [resultData.status] - Result status (PENDING or VERIFIED); ignored when
   *   corrections are present, because the result then becomes CORRECTED
   * @param {File[]} imageFiles - Image files
   * @returns {Promise<Object>} Created result
   */
  createResultBatchWithFiles: async (resultData, imageFiles) => {
    if (!imageFiles || imageFiles.length === 0) {
      throw new Error('Provide at least one image.');
    }

    if (imageFiles.length !== resultData.predictions.length) {
      throw new Error(
        `The number of images (${imageFiles.length}) must match the number of predictions (${resultData.predictions.length}).`
      );
    }

    const formData = new FormData();

    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    formData.append('data', JSON.stringify(resultData));

    const { data } = await axiosClient.post('/results/batch/with-files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data;
  },

  /**
   * Saves every change to an existing result in ONE request (one API transaction):
   * new images with their predictions, dilution edits, corrections, observations and status.
   *
   * @param {number} resultId - ID of the existing result
   * @param {Object} addData - Changes (AddPredictionsToResultDto); at least one field
   * @param {Array} [addData.newPredictions] - New predictions, one per file (no imagePath),
   *   each { prediction, confidencePercentage, classificationLevel, signature, dilution } like the batch create items
   * @param {Array} [addData.updatedDilutions] - [{ predictionId, dilution }] of predictions of this result
   * @param {Array} [addData.corrections] - [{ imageIndex, correctedPrediction, observations? }]; imageIndex indexes newPredictions
   * @param {Array} [addData.existingCorrections] - [{ predictionId, correctedPrediction, observations? }]
   * @param {string|null} [addData.observations] - Result observations; null clears them
   * @param {string} [addData.status] - PENDING | VERIFIED (any correction makes the result CORRECTED)
   * @param {File[]} [imageFiles] - New image files (index i ↔ newPredictions[i]); empty without new predictions
   * @returns {Promise<Object>} Updated result detail plus `addedPredictionIds`: the ids of the
   *   predictions created by this request, in upload order (index i ↔ imageFiles[i])
   */
  addPredictionsToResult: async (resultId, addData, imageFiles = []) => {
    const newPredictionCount = addData.newPredictions?.length || 0;
    if (imageFiles.length !== newPredictionCount) {
      throw new Error(
        `The number of images (${imageFiles.length}) must match the number of new predictions (${newPredictionCount}).`
      );
    }

    const formData = new FormData();

    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    formData.append('data', JSON.stringify(addData));

    const { data } = await axiosClient.post(`/results/${resultId}/predictions/with-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data;
  },

  /**
   * Updates only the status of a result
   *
   * @param {number} resultId - Result ID
   * @param {string} status - New status (PENDING, CORRECTED, VERIFIED)
   * @returns {Promise<Object>} Updated result
   */
  updateStatus: async (resultId, status) => {
    const { data } = await axiosClient.patch(`/results/${resultId}`, { status });
    return data;
  },

  /**
   * Updates a result (status, observations, etc.)
   *
   * @param {number} resultId - Result ID
   * @param {Object} updateData - Fields to update
   * @param {string} updateData.status - New status (optional)
   * @param {string} updateData.observations - New observations (optional)
   * @returns {Promise<Object>} Updated result
   */
  updateResult: async (resultId, updateData) => {
    const { data } = await axiosClient.patch(`/results/${resultId}`, updateData);
    return data;
  },

  /**
   * Creates several corrections in batch with A SINGLE audit record
   *
   * @param {Object[]} corrections - Corrections
   * @param {number} corrections[].predictionId - ID of the prediction to correct
   * @param {string} corrections[].correctedPrediction - Corrected prediction (PredictionClass)
   * @param {string} corrections[].observations - Correction observations (optional)
   * @returns {Promise<Object[]>} Created corrections
   */
  createCorrectionsBatch: async (corrections) => {
    const { data } = await axiosClient.post(
      `/results/corrections/batch`,
      { corrections }
    );
    return data;
  },

  /**
   * Returns the result statistics for the Analytics dashboard
   *
   * Metrics are computed from the database AT PREDICTION (IMAGE) LEVEL:
   * - Total validated: predictions in results with status VERIFIED or CORRECTED
   * - Precision: % of validated predictions without corrections
   * - Correction rate: % of validated predictions with corrections
   *
   * @param {Object} params - Optional parameters
   * @param {string} params.dateFrom - Start date as YYYY-MM-DD (optional)
   * @param {string} params.dateTo - End date as YYYY-MM-DD (optional)
   * @returns {Promise<Object>} Computed statistics
   *
   * Response:
   * {
   *   totalValidated: number,                  // Validated predictions
   *   precision: number,                       // % of predictions without corrections
   *   correctionRate: number,                  // % of predictions with corrections
   *   totalVerifiedWithoutCorrections: number, // Correctly classified predictions
   *   totalCorrected: number                   // Corrected predictions
   * }
   */
  getStatistics: async ({ dateFrom = null, dateTo = null } = {}) => {
    const params = {};
    if (dateFrom) {
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      params.dateTo = dateTo;
    }

    const { data } = await axiosClient.get('/results/statistics', { params });
    return data;
  }
};

export default resultsService;
