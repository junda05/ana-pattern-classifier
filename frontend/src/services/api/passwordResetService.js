/**
 * Password reset service
 *
 * Requests for the password reset flow. Request errors are rethrown unchanged
 * (callers read them with getApiErrorMessage). Some endpoints answer failures
 * with a 2xx envelope ({ success: false, detail } or { valid: false, message }),
 * which callers must check as well.
 *
 * Endpoints:
 * POST /api/v1/auth/request-password-reset      -> Creates a password reset request (always a generic success)
 * POST /api/v1/auth/validate-reset-token        -> Validates a reset token
 * POST /api/v1/auth/validate-admin-and-token    -> Validates administrator credentials and a reset token
 * POST /api/v1/auth/reset-password              -> Sets the new password
 */

import axiosClient from '../../config/axios';

const passwordResetService = {
  /**
   * Requests a password reset
   *
   * @param {string} username - Username
   * @returns {Promise<Object>} { success: true, message } (the same for every username)
   */
  requestPasswordReset: async (username) => {
    const { data } = await axiosClient.post('/auth/request-password-reset', { username });
    return data;
  },

  /**
   * Validates a password reset token
   *
   * @param {string} token - Token to validate
   * @returns {Promise<Object>} { valid, message?, user? }
   */
  validateResetToken: async (token) => {
    const { data } = await axiosClient.post('/auth/validate-reset-token', { token });
    return data;
  },

  /**
   * Resets the password with a valid token
   *
   * @param {string} token - Password reset token
   * @param {string} newPassword - New password
   * @param {string} approvalToken - Short-lived approval token issued by
   *   validate-admin-and-token to the administrator who approved the reset
   * @returns {Promise<Object>} Response with a confirmation message
   */
  resetPassword: async (token, newPassword, approvalToken) => {
    const { data } = await axiosClient.post('/auth/reset-password', {
      token,
      newPassword,
      approvalToken,
    });
    return data;
  },

  /**
   * Validates the administrator credentials and the reset token in one request
   *
   * @param {string} token - Password reset token
   * @param {string} adminUsername - Administrator username
   * @param {string} adminPassword - Administrator password
   * @returns {Promise<Object>} { success, valid, user, admin, approvalToken }
   */
  validateAdminAndToken: async (token, adminUsername, adminPassword) => {
    const { data } = await axiosClient.post('/auth/validate-admin-and-token', {
      token,
      adminUsername,
      adminPassword,
    });
    return data;
  },
};

export default passwordResetService;
