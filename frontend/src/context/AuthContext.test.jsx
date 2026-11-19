import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from './AuthContext';
import { NotificationProvider } from './NotificationContext';
import useAuth from '../hooks/useAuth';
import authService from '../services/api/authService';

jest.mock('../services/api/authService', () => ({
  __esModule: true,
  default: { login: jest.fn(), logout: jest.fn(), updateStoredUser: jest.fn() },
}));

const httpError = (status, data) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

const LoginButton = () => {
  const { login, authError } = useAuth();
  return (
    <>
      <button type="button" onClick={() => login('jdoe', 'wrong-password')}>
        Log In
      </button>
      {authError && <p data-testid="auth-error">{authError}</p>}
    </>
  );
};

const renderWithProviders = () =>
  render(
    <NotificationProvider>
      <AuthProvider>
        <LoginButton />
      </AuthProvider>
    </NotificationProvider>
  );

describe('AuthContext login errors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows "Incorrect username or password." for a NestJS 401', async () => {
    authService.login.mockRejectedValue(
      httpError(401, { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' })
    );
    renderWithProviders();

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findAllByText('Incorrect username or password.')).not.toHaveLength(0);
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Incorrect username or password.');
  });

  it('shows the API message for other client errors', async () => {
    authService.login.mockRejectedValue(
      httpError(403, { statusCode: 403, message: 'This account is inactive.', error: 'Forbidden' })
    );
    renderWithProviders();

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findAllByText('This account is inactive.')).not.toHaveLength(0);
  });

  it('shows a connection message when the server does not answer', async () => {
    authService.login.mockRejectedValue(new Error('Network Error'));
    renderWithProviders();

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(
      await screen.findAllByText('Could not connect to the server. Check your internet connection and try again.')
    ).not.toHaveLength(0);
  });

  it('explains a rate-limited login (429)', async () => {
    authService.login.mockRejectedValue(
      httpError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
    );
    renderWithProviders();

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findAllByText('Too many requests. Please try again later.')).not.toHaveLength(0);
  });
});
