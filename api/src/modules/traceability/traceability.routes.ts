/**
 * Route constants for the audit-trail (traceability) module
 *
 * Centralizes the module routes for easier maintenance
 * and to avoid duplicated strings (DRY)
 *
 * Usage in controllers:
 * @Controller(TRACEABILITY_ROUTES.BASE)
 * @Get(TRACEABILITY_ROUTES.GET_ALL)
 */

export const TRACEABILITY_ROUTES = {
  BASE: 'api/v1/traceability',
  GET_ALL: '', // GET /api/v1/traceability
  GET_BY_ID: ':id', // GET /api/v1/traceability/:id
} as const;
