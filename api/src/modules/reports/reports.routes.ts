/**
 * Route constants for the reports module
 *
 * Centralizes the module routes in one file
 * for easier maintenance and to avoid duplication
 */

export const REPORT_ROUTES = {
  BASE: 'api/v1/reports',
  SEARCH: 'search',
  GET_BY_ID: ':id',
} as const;
