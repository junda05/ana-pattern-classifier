import axiosClient from '../../config/axios';
import usersService from './usersService';

jest.mock('../../config/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const httpError = (status, data = {}) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

describe('usersService error messages', () => {
  it('shows the API message for a client error', async () => {
    axiosClient.post.mockRejectedValue(
      httpError(409, { statusCode: 409, message: 'The username jdoe is already in use.', error: 'Conflict' })
    );

    await expect(usersService.createUser({ username: 'jdoe' })).rejects.toThrow('The username jdoe is already in use.');
  });

  it('shows the first validation message of a 400', async () => {
    axiosClient.patch.mockRejectedValue(
      httpError(400, { statusCode: 400, message: ['email must be an email'], error: 'Bad Request' })
    );

    await expect(usersService.updateUser(1, { email: 'x' })).rejects.toThrow('email must be an email');
  });

  it('falls back to the friendly message instead of the generic axios text', async () => {
    axiosClient.get.mockRejectedValue(httpError(500, { statusCode: 500, message: 'Internal server error' }));

    await expect(usersService.listUsers()).rejects.toThrow('Could not load the user list.');
  });

  it('uses the friendly message when the server is unreachable', async () => {
    axiosClient.get.mockRejectedValue(new Error('Network Error'));

    await expect(usersService.getUser(3)).rejects.toThrow('Could not load the user.');
  });

  it('says "deactivate" when deactivation fails', async () => {
    axiosClient.delete.mockRejectedValue(httpError(500));

    await expect(usersService.deleteUser(3)).rejects.toThrow('Could not deactivate the user.');
  });
});
