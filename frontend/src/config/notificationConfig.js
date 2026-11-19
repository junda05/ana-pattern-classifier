/**
 * Notification settings
 *
 * Durations, titles and defaults shared by every notification in the app.
 */

/**
 * Notification durations in milliseconds
 * Every auto-close delay must use these constants
 */
export const NOTIFICATION_DURATIONS = {
  // Per notification type
  DEFAULT: 5000,
  SUCCESS: 4000,
  ERROR: 7000,
  WARNING: 6000,
  INFO: 4000,

  // Specific cases
  SESSION_EXPIRED: 6000,
  CONNECTION_ERROR: 7000,
  AUTH_ERROR: 6000,
  LOGOUT: 4000,

  // Window in which an identical notification is treated as a duplicate
  DUPLICATE_WINDOW: 1000,
};

/**
 * Animation durations in milliseconds
 */
export const ANIMATION_DURATIONS = {
  EXIT: 500,
  ENTER: 500,
  STAGGER: 100,
  BUTTON_HOVER: 200,
};

/**
 * Default notification titles
 */
export const NOTIFICATION_TITLES = {
  SUCCESS: 'Success',
  ERROR: 'Error',
  WARNING: 'Warning',
  INFO: 'Information',

  // Authentication
  LOGIN_SUCCESS: 'Logged In',
  LOGIN_ERROR: 'Login Error',
  CREDENTIALS_ERROR: 'Incorrect Credentials',
  CONNECTION_ERROR: 'Connection Error',
  SESSION_EXPIRED: 'Session Expired',
  LOGOUT_SUCCESS: 'Logged Out',
  LOGOUT_ERROR: 'Warning',
};

