import axios from 'axios';
import axiosClient from './axios';
import { getTokens, saveTokens } from '../services/utils/tokenStorage';
import sessionManager from '../services/utils/sessionManager';

const storedUser = { userId: 7, username: 'jdoe', fullName: 'Jane Doe', role: 'STANDARD' };

const httpError = (status, config) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.config = config;
  error.response = { status, data: { statusCode: status, message: 'Error' }, config };
  return error;
};

const unauthorized = (config) => httpError(401, config);

const ok = (config) => Promise.resolve({ data: { ok: true, auth: config.headers.Authorization }, status: 200, statusText: 'OK', headers: {}, config });

/**
 * Adapter that answers 401 while the request carries the expired access token
 * and 200 once it carries a refreshed one.
 */
const expiredTokenAdapter = (seen) => (config) => {
  seen.push(`${config.url} ${config.headers.Authorization}`);
  return config.headers.Authorization === 'Bearer expired-access' ? Promise.reject(unauthorized(config)) : ok(config);
};

describe('axios client token refresh', () => {
  let originalAdapter;

  beforeEach(() => {
    localStorage.clear();
    originalAdapter = axiosClient.defaults.adapter;
    jest.spyOn(sessionManager, 'handleRefreshTokenExpired').mockImplementation(() => {});
    jest.spyOn(sessionManager, 'handleInvalidToken').mockImplementation(() => {});
  });

  afterEach(() => {
    axiosClient.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  it('keeps the stored user when saving the refreshed tokens', async () => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });

    const seen = [];
    axiosClient.defaults.adapter = expiredTokenAdapter(seen);
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'new-access', refresh: 'refresh-2' } });

    const response = await axiosClient.get('/results');

    expect(response.data).toEqual({ ok: true, auth: 'Bearer new-access' });
    expect(seen).toEqual(['/results Bearer expired-access', '/results Bearer new-access']);
    expect(getTokens()).toEqual({ access: 'new-access', refresh: 'refresh-2', user: storedUser });
  });

  it('shares one refresh between concurrent 401 responses and retries every request', async () => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    const seen = [];
    axiosClient.defaults.adapter = expiredTokenAdapter(seen);
    let finishRefresh;
    const post = jest.spyOn(axios, 'post').mockReturnValue(new Promise((resolve) => { finishRefresh = resolve; }));

    const requests = Promise.all([axiosClient.get('/results'), axiosClient.get('/patients'), axiosClient.get('/users')]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishRefresh({ data: { access: 'new-access', refresh: 'refresh-2' } });
    const responses = await requests;

    expect(post).toHaveBeenCalledTimes(1);
    expect(responses.map((response) => response.data.auth)).toEqual(['Bearer new-access', 'Bearer new-access', 'Bearer new-access']);
    expect(getTokens().access).toBe('new-access');
  });

  it('gives the refresh call its own timeout', async () => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    axiosClient.defaults.adapter = expiredTokenAdapter([]);
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'new-access' } });

    await axiosClient.get('/results');

    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh-access$/),
      { refresh: 'refresh-1' },
      expect.objectContaining({ timeout: expect.any(Number) })
    );
    expect(post.mock.calls[0][2].timeout).toBeGreaterThan(0);
  });

  it('ends the session when the refresh endpoint answers 401', async () => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    axiosClient.defaults.adapter = expiredTokenAdapter([]);
    jest.spyOn(axios, 'post').mockRejectedValue(httpError(401, {}));

    await expect(axiosClient.get('/results')).rejects.toMatchObject({ response: { status: 401 } });

    expect(sessionManager.handleRefreshTokenExpired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a network error', () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })],
    ['a timeout', () => Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' })],
    ['a server error', () => httpError(503, {})],
  ])('keeps the tokens and rejects the original request on %s during refresh', async (_label, makeError) => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    axiosClient.defaults.adapter = expiredTokenAdapter([]);
    const refreshError = makeError();
    jest.spyOn(axios, 'post').mockRejectedValue(refreshError);

    await expect(axiosClient.get('/results')).rejects.toBe(refreshError);

    expect(getTokens()).toEqual({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    expect(sessionManager.handleRefreshTokenExpired).not.toHaveBeenCalled();
    expect(sessionManager.handleInvalidToken).not.toHaveBeenCalled();
  });

  it('does not refresh on a 401 from the login route', async () => {
    saveTokens({ access: 'expired-access', refresh: 'refresh-1', user: storedUser });
    axiosClient.defaults.adapter = (config) => Promise.reject(unauthorized(config));
    const post = jest.spyOn(axios, 'post');

    await expect(axiosClient.post('/auth/login', { username: 'jdoe' })).rejects.toMatchObject({ response: { status: 401 } });

    expect(post).not.toHaveBeenCalled();
    expect(getTokens().refresh).toBe('refresh-1');
    expect(sessionManager.handleRefreshTokenExpired).not.toHaveBeenCalled();
  });
});
