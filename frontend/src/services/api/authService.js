import axiosClient from '../../config/axios';
import { saveTokens, clearTokens, getRefreshToken, getTokens } from '../utils/tokenStorage';
import { getApiErrorMessage } from '../utils/apiErrors';

/**
 * Authentication service
 *
 * Endpoints:
 * POST /api/v1/auth/login              -> { access, refresh }
 * POST /api/v1/auth/refresh-access     -> { access, refresh? }
 * POST /api/v1/auth/logout             -> blacklists the refresh token
 * GET  /api/v1/auth/profile            -> user data
 *                                         ({ success: true, user: {...} })
 */

const authService = {
  /**
   * Logs in and loads the full profile of the user
   *
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Token pair plus the full `user` profile
   */
  login: async (username, password) => {
    try {
      // 1. Get the token pair
      const { data: tokenData } = await axiosClient.post('/auth/login', {
        username,
        password
      });

      // 2. Store the tokens so the profile request is authenticated
      saveTokens({
        access: tokenData.access,
        refresh: tokenData.refresh,
        user: { username } // Placeholder until the profile is loaded
      });

      // 3. Load the full profile
      const fullUserData = await authService.getProfile();

      // 4. Store the tokens together with the full profile
      saveTokens({
        access: tokenData.access,
        refresh: tokenData.refresh,
        user: fullUserData
      });

      return {
        ...tokenData,
        user: fullUserData
      };
    } catch (error) {
      // Login or profile request failed: drop any stored tokens
      clearTokens();
      throw error;
    }
  },

  /**
   * Logs out: asks the server to revoke the refresh token, then always clears local tokens.
   * A 400 means the token was already revoked and counts as success; any other
   * failure is rethrown (after the local session is cleared) so the caller can warn the user.
   */
  logout: async () => {
    try {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        // Send the refresh token so the server blacklists it
        await axiosClient.post('/auth/logout', {
          refresh: refreshToken
        });
      }
    } catch (error) {
      if (error.response?.status !== 400) {
        throw error;
      }
    } finally {
      // Always clear the local tokens
      clearTokens();
    }
  },

  /**
   * Returns the full profile of the authenticated user
   * Request errors are rethrown unchanged so callers can read `error.response`.
   *
   * @returns {Promise<Object>} The `user` object returned by GET /auth/profile
   */
  getProfile: async () => {
    const { data } = await axiosClient.get('/auth/profile');

    // Response shape { success: true, user: {...} } (auth controller envelope)
    if (data.success === false) {
      throw new Error(getApiErrorMessage(data, 'Could not retrieve the profile.'));
    }
    return data.user || data;
  },

  /**
   * Reloads the profile and updates the user stored with the tokens
   * Used when restoring a session on page load
   *
   * @returns {Promise<Object>} Updated user profile
   */
  updateStoredUser: async () => {
    const updatedUser = await authService.getProfile();

    // Keep the stored tokens; replace only the user profile
    const currentTokens = getTokens();
    if (currentTokens) {
      saveTokens({
        ...currentTokens,
        user: updatedUser
      });
    }

    return updatedUser;
  }
};

export default authService;
