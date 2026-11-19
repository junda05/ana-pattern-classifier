/**
 * Route constants for the patients module
 *
 * Centralizes all routes of the module for easier maintenance
 * and to avoid duplicated strings
 *
 * Usage in controllers:
 * @Controller(PATIENT_ROUTES.BASE)
 * @Get(PATIENT_ROUTES.GET_ALL)
 */

export const PATIENT_ROUTES = {
  BASE: 'api/v1/patients',
  GET_ALL: '', // GET /api/v1/patients
  GET_BY_DOCUMENT: 'document', // GET /api/v1/patients/document
  GET_BY_ID: ':id', // GET /api/v1/patients/:id
  CREATE: '', // POST /api/v1/patients
  UPDATE: ':id', // PATCH /api/v1/patients/:id
  DELETE: ':id', // DELETE /api/v1/patients/:id
} as const;
