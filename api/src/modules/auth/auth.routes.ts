/**
 * Route constants for the authentication module
 *
 * Centralizes all routes of the module for easier maintenance
 * and to avoid duplicated strings (DRY principle)
 *
 * Usage in controllers:
 * @Controller(AUTH_ROUTES.BASE)
 * @Post(AUTH_ROUTES.LOGIN)
 */

export const AUTH_ROUTES = {
  BASE: 'api/v1/auth',
  LOGIN: 'login', // POST /api/v1/auth/login
  REFRESH_TOKEN: 'refresh-access', // POST /api/v1/auth/refresh-access
  LOGOUT: 'logout', // POST /api/v1/auth/logout
  PROFILE: 'profile', // GET /api/v1/auth/profile
  REQUEST_PASSWORD_RESET: 'request-password-reset', // POST /api/v1/auth/request-password-reset
  VALIDATE_RESET_TOKEN: 'validate-reset-token', // POST /api/v1/auth/validate-reset-token
  RESET_PASSWORD: 'reset-password', // POST /api/v1/auth/reset-password
  VALIDATE_ADMIN_AND_TOKEN: 'validate-admin-and-token', // POST /api/v1/auth/validate-admin-and-token
} as const;
