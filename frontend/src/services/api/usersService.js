import axiosClient from '../../config/axios';
import { getApiErrorMessage } from '../utils/apiErrors';

/**
 * User management service
 *
 * Endpoints:
 * GET    /api/v1/users           -> Lists users (paginated)
 * GET    /api/v1/users/:id       -> Returns a user by ID
 * POST   /api/v1/users           -> Creates a user
 * PATCH  /api/v1/users/:id       -> Updates a user
 * DELETE /api/v1/users/:id       -> Deactivates a user (soft delete)
 *
 * Every method throws an Error whose message can be shown as is: the API
 * message for client errors, otherwise a friendly default. JWT tokens are
 * attached by the shared axios client.
 */

/**
 * Turns a failed request into an Error with a user-facing message.
 *
 * @param {Error} error - Axios error
 * @param {string} fallback - Friendly default message
 * @returns {Error} Error to throw
 */
const toUserError = (error, fallback) => {
  const status = error.response?.status;
  if (status === 401) {
    return new Error('Your session has expired. Please log in again.');
  }
  if (status === 403) {
    return new Error('You do not have permission to perform this action.');
  }
  return new Error(getApiErrorMessage(error, fallback));
};

const usersService = {
  /**
   * Returns a paginated list of users
   *
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Results per page (default: 10)
   * @returns {Promise<Object>} Response with the structure:
   * {
   *   data: Array<{ userId, username, fullName, email, role, lastLogin, isActive, dateJoined }>,
   *   total: number,
   *   page: number,
   *   limit: number,
   *   totalPages: number
   * }
   */
  listUsers: async (page = 1, limit = 10) => {
    try {
      const { data } = await axiosClient.get('/users', {
        params: { page, limit }
      });
      return data;
    } catch (error) {
      throw toUserError(error, 'Could not load the user list.');
    }
  },

  /**
   * Returns the full data of a specific user
   *
   * @param {number} userId - ID of the user to fetch
   * @returns {Promise<Object>} User with the UserDetailDto structure:
   * {
   *   userId: number,
   *   username: string,
   *   fullName: string,
   *   email: string,
   *   professionalCard: string,
   *   role: 'ADMIN' | 'STANDARD',
   *   isActive: boolean,
   *   dateJoined: Date,
   *   lastLogin: Date | null
   * }
   */
  getUser: async (userId) => {
    try {
      const { data } = await axiosClient.get(`/users/${userId}`);
      return data;
    } catch (error) {
      throw toUserError(error, 'Could not load the user.');
    }
  },

  /**
   * Creates a new user in the system
   *
   * @param {Object} userData - Data of the user to create
   * @param {string} userData.username - Unique username (3-50 characters; letters, numbers, - and _ only)
   * @param {string} userData.fullName - Full name (1-100 characters)
   * @param {string} userData.email - Unique, valid email
   * @param {string} userData.password - Password (at least 8 characters)
   * @param {string} userData.professionalCard - Professional license number (1-50 characters)
   * @param {string} [userData.role='STANDARD'] - Role: 'ADMIN' or 'STANDARD'
   * @returns {Promise<Object>} Created user (without password)
   */
  createUser: async (userData) => {
    try {
      const { data } = await axiosClient.post('/users', userData);
      return data;
    } catch (error) {
      throw toUserError(error, 'Could not create the user.');
    }
  },

  /**
   * Updates the data of an existing user
   *
   * @param {number} userId - ID of the user to update
   * @param {Object} userData - Data to update (all optional)
   * @param {string} [userData.fullName] - Full name
   * @param {string} [userData.email] - Email
   * @param {string} [userData.professionalCard] - Professional license number
   * @param {string} [userData.role] - Role: 'ADMIN' or 'STANDARD'
   * @param {boolean} [userData.isActive] - Active/inactive status
   * @returns {Promise<Object>} Updated user
   */
  updateUser: async (userId, userData) => {
    try {
      const { data } = await axiosClient.patch(`/users/${userId}`, userData);
      return data;
    } catch (error) {
      throw toUserError(error, 'Could not update the user.');
    }
  },

  /**
   * Deactivates a user (soft delete)
   *
   * @param {number} userId - ID of the user to deactivate
   * @returns {Promise<void>}
   */
  deleteUser: async (userId) => {
    try {
      await axiosClient.delete(`/users/${userId}`);
    } catch (error) {
      throw toUserError(error, 'Could not deactivate the user.');
    }
  },
};

export default usersService;
