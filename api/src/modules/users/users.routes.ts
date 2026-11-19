/**
 * Route constants for the users module
 *
 * Centralizes all routes of the module for easier maintenance
 * and to avoid duplicated strings
 *
 * Usage in controllers:
 * @Controller(USER_ROUTES.BASE)
 * @Get(USER_ROUTES.GET_ALL)
 */

export const USER_ROUTES = {
  BASE: 'api/v1/users',
  GET_ALL: '', // GET /api/v1/users
  GET_BY_ID: ':id', // GET /api/v1/users/:id
  CREATE: '', // POST /api/v1/users
  UPDATE: ':id', // PATCH /api/v1/users/:id
  DELETE: ':id', // DELETE /api/v1/users/:id
} as const;
