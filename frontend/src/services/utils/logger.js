/**
 * Centralized logger.
 *
 * Writes to the console in development builds only, so production users never
 * see console noise. Expected outcomes (e.g. a 404 "patient not found") are
 * handled by the UI and are not logged at all.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
};

export default logger;
