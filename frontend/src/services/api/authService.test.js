import axiosClient from '../../config/axios';
import authService from './authService';
import { saveTokens, getTokens } from '../utils/tokenStorage';

jest.mock('../../config/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const httpError = (status) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data: { statusCode: status, message: 'Unauthorized' } };
  return error;
};

describe('authService', () => {
  beforeEach(() => localStorage.clear());

  it('getProfile rethrows the axios error so callers can read its status', async () => {
    const error = httpError(401);
    axiosClient.get.mockRejectedValue(error);

    await expect(authService.getProfile()).rejects.toBe(error);
  });

  it('logout clears the local session even when the server call fails', async () => {
    saveTokens({ access: 'a', refresh: 'r', user: { userId: 1 } });
    axiosClient.post.mockRejectedValue(httpError(500));

    await expect(authService.logout()).rejects.toThrow();

    expect(getTokens()).toBeNull();
  });

  it('logout treats an already revoked refresh token (400) as success', async () => {
    saveTokens({ access: 'a', refresh: 'r', user: { userId: 1 } });
    axiosClient.post.mockRejectedValue(httpError(400));

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(getTokens()).toBeNull();
  });
});
