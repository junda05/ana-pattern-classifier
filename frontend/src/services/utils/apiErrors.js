/**
 * Reading user-facing messages from API errors.
 *
 * The API answers errors in two shapes:
 * - NestJS exceptions: { statusCode, message: string | string[], error }
 * - Auth controller envelopes: { success: false, error, detail } or
 *   { success: false, valid: false, message }
 *
 * The generic axios message ("Request failed with status code 400") is never
 * shown to users.
 */

/** Shown for every 429 (the API rate-limits the authentication routes). */
export const TOO_MANY_REQUESTS_MESSAGE = 'Too many requests. Please try again later.';

/** Shown for a 409 without a message (a verified result was changed meanwhile). */
export const VERIFIED_LOCKED_MESSAGE = 'Verified results cannot be modified.';

/**
 * Whether an API call failed with 409 Conflict (e.g. the result was verified meanwhile,
 * or the status transition is not allowed).
 *
 * @param {Error|Object} error - Axios error
 * @returns {boolean}
 */
export const isConflictError = (error) => error?.response?.status === 409;

const messageText = (value) => {
  if (Array.isArray(value)) {
    // Validation errors list every problem; show them all
    const messages = value.filter((item) => typeof item === 'string' && item.trim() !== '');
    return messages.length > 0 ? messages.join(' ') : null;
  }
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

/**
 * Message carried by an API response body, if any.
 *
 * @param {Object} data - Response body
 * @returns {string|null} Message, or null
 */
const messageFromBody = (data) => {
  if (!data || typeof data !== 'object') return null;
  return messageText(data.message) || messageText(data.detail);
};

/**
 * Returns the message to show for a failed API call.
 *
 * Client errors (4xx) show the API message; server errors (5xx) and requests
 * that never got a response show the caller's friendly fallback. A 429 always
 * shows TOO_MANY_REQUESTS_MESSAGE; a 409 without a message shows VERIFIED_LOCKED_MESSAGE.
 *
 * @param {Error|Object} error - Axios error, or an envelope body returned with a 2xx status
 * @param {string} fallback - Friendly default message
 * @returns {string} Message to show
 */
export const getApiErrorMessage = (error, fallback) => {
  if (!error) return fallback;

  // Envelope body returned with a 2xx status ({ success: false, ... })
  if (!(error instanceof Error) && !error.response) {
    return messageFromBody(error) || fallback;
  }

  const status = error.response?.status;
  if (!status || status >= 500) {
    return fallback;
  }
  if (status === 429) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
  if (status === 409) {
    return messageFromBody(error.response.data) || VERIFIED_LOCKED_MESSAGE;
  }

  return messageFromBody(error.response.data) || fallback;
};
