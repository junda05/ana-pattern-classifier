import { getApiErrorMessage, isConflictError, TOO_MANY_REQUESTS_MESSAGE, VERIFIED_LOCKED_MESSAGE } from './apiErrors';

const httpError = (status, data) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

describe('getApiErrorMessage', () => {
  it('reads the NestJS "message" string', () => {
    const error = httpError(409, { statusCode: 409, message: 'A patient with this document already exists.', error: 'Conflict' });
    expect(getApiErrorMessage(error, 'Fallback.')).toBe('A patient with this document already exists.');
  });

  it('shows every message of a validation array', () => {
    const error = httpError(400, {
      statusCode: 400,
      message: ['Each uploaded image needs exactly one prediction.', 'Observations must be at most 1000 characters long.'],
      error: 'Bad Request',
    });
    expect(getApiErrorMessage(error, 'Fallback.')).toBe(
      'Each uploaded image needs exactly one prediction. Observations must be at most 1000 characters long.'
    );
  });

  it('reads "detail" from the auth controller envelopes', () => {
    const error = httpError(400, { success: false, error: 'Error changing the password', detail: 'The token has expired.' });
    expect(getApiErrorMessage(error, 'Fallback.')).toBe('The token has expired.');
  });

  it('accepts an envelope object returned with a 200 status', () => {
    expect(getApiErrorMessage({ success: false, detail: 'Invalid token.' }, 'Fallback.')).toBe('Invalid token.');
    expect(getApiErrorMessage({ success: false, valid: false, message: 'Invalid token.' }, 'Fallback.')).toBe('Invalid token.');
  });

  it('never returns the generic axios message', () => {
    expect(getApiErrorMessage(httpError(400, {}), 'Could not save the user.')).toBe('Could not save the user.');
  });

  it('uses the fallback for server errors and missing responses', () => {
    expect(getApiErrorMessage(httpError(500, { statusCode: 500, message: 'Internal server error' }), 'Could not load users.')).toBe('Could not load users.');
    expect(getApiErrorMessage(new Error('Network Error'), 'Could not load users.')).toBe('Could not load users.');
  });

  it('always explains a 429 in plain words, whatever the body says', () => {
    expect(TOO_MANY_REQUESTS_MESSAGE).toBe('Too many requests. Please try again later.');
    expect(getApiErrorMessage(httpError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }), 'Fallback.'))
      .toBe('Too many requests. Please try again later.');
    expect(getApiErrorMessage(httpError(429, undefined), 'Fallback.')).toBe('Too many requests. Please try again later.');
  });

  it('shows the API message of a 409, or the locked-result message when it has none', () => {
    expect(VERIFIED_LOCKED_MESSAGE).toBe('Verified results cannot be modified.');
    expect(getApiErrorMessage(httpError(409, { statusCode: 409, message: 'Invalid status transition from VERIFIED to PENDING.' }), 'Fallback.'))
      .toBe('Invalid status transition from VERIFIED to PENDING.');
    expect(getApiErrorMessage(httpError(409, {}), 'Fallback.')).toBe('Verified results cannot be modified.');
  });

  it('recognizes a 409 conflict', () => {
    expect(isConflictError(httpError(409, {}))).toBe(true);
    expect(isConflictError(httpError(400, {}))).toBe(false);
    expect(isConflictError(new Error('Network Error'))).toBe(false);
  });
});
