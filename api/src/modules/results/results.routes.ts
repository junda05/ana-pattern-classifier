/**
 * Route constants for the results module
 *
 * Centralizes the module routes for easier maintenance
 * and to avoid duplicated strings (DRY)
 *
 * Usage in controllers:
 * @Controller(RESULT_ROUTES.BASE)
 * @Get(RESULT_ROUTES.GET_ALL)
 */

export const RESULT_ROUTES = {
  BASE: 'api/v1/results',
  GET_ALL: '', // GET /api/v1/results
  GET_BY_ID: ':id', // GET /api/v1/results/:id
  CREATE_BATCH_WITH_FILES: 'batch/with-files', // POST /api/v1/results/batch/with-files
  ADD_PREDICTIONS_TO_RESULT: ':id/predictions/with-files', // POST /api/v1/results/:id/predictions/with-files
  UPDATE: ':id', // PATCH /api/v1/results/:id

  // Correction routes
  CREATE_CORRECTION: 'corrections', // POST /api/v1/results/corrections (predictionId in the body)
  CREATE_BATCH_CORRECTIONS: 'corrections/batch', // POST /api/v1/results/corrections/batch (several corrections in a single audit record)
  GET_CORRECTIONS: ':id/corrections', // GET /api/v1/results/:id/corrections (corrections of a result)
  GET_LATEST_CORRECTION: ':id/corrections/latest', // GET /api/v1/results/:id/corrections/latest

  // Statistics routes
  GET_STATISTICS: 'statistics', // GET /api/v1/results/statistics (Analytics dashboard statistics)
} as const;
