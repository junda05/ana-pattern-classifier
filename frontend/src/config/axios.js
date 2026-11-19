/**
 * HTTP client for the NestJS API
 *
 * Timeouts:
 * - DEFAULT (30 s): regular operations (login, profile, etc.)
 * - REFRESH (10 s): the access-token refresh call
 *
 * The interceptors take care of:
 * - Attaching the JWT access token as the Authorization header
 * - Refreshing the access token on a 401 response (one refresh shared by concurrent 401s)
 * - Ending the session only when the refresh endpoint answers 401; any other refresh
 *   failure (network, timeout, 5xx) keeps the tokens and rejects the original request
 */

import axios from 'axios';
import { getAccessToken, getRefreshToken, getTokens, saveTokens, clearTokens } from '../services/utils/tokenStorage';
import sessionManager from '../services/utils/sessionManager';

const API_BASE = process.env.REACT_APP_API_BASE_URL;

const TIMEOUT_CONFIG = {
  DEFAULT: 30000,
  REFRESH: 10000,
};

const axiosClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: TIMEOUT_CONFIG.DEFAULT,
  maxBodyLength: Infinity,
  maxContentLength: Infinity
});

// Pending refresh, shared so parallel 401s trigger a single refresh
let refreshInFlight = null;

/**
 * Refreshes the access token (once for every concurrent caller) and stores the new tokens.
 *
 * @param {string} refresh - Current refresh token
 * @returns {Promise<string>} New access token
 */
const refreshAccessToken = (refresh) => {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE}/auth/refresh-access`, { refresh }, { timeout: TIMEOUT_CONFIG.REFRESH })
      .then(({ data }) => {
        // Keep the stored profile: without it the session cannot be restored on reload
        saveTokens({
          access: data.access,
          refresh: data.refresh ?? refresh,
          user: getTokens()?.user
        });
        return data.access;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const setupInterceptors = (client) => {
  client.interceptors.request.use(
    (config) => {
      const access = getAccessToken();
      if (access) {
        config.headers.Authorization = `Bearer ${access}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;

      // 401 on a request that has not been retried yet
      if (error.response && error.response.status === 401 && !original._retry) {
        // CRITICAL: do not handle 401 on the login route
        // A 401 there is expected for wrong credentials
        const isAuthRoute = original.url?.includes('/auth/login');

        if (isAuthRoute) {
          // Let the error propagate unprocessed
          return Promise.reject(error);
        }

        original._retry = true;
        const refresh = getRefreshToken();

        // No refresh token: the session has already ended
        if (!refresh) {
          clearTokens();
          sessionManager.handleInvalidToken();
          return Promise.reject(error);
        }

        try {
          const access = await refreshAccessToken(refresh);
          original.headers.Authorization = `Bearer ${access}`;
          return client(original);
        } catch (e) {
          // Only a 401 from the refresh endpoint means the refresh token is no longer valid.
          // Network errors, timeouts and server errors keep the tokens: the session may
          // still be valid once the API is reachable again.
          if (e.response?.status === 401) {
            sessionManager.handleRefreshTokenExpired();
          }
          return Promise.reject(e);
        }
      }

      return Promise.reject(error);
    }
  );
};

setupInterceptors(axiosClient);

export default axiosClient;
