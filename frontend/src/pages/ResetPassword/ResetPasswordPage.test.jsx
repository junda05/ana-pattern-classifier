import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';
import passwordResetService from '../../services/api/passwordResetService';

jest.mock('../../services/api/passwordResetService', () => ({
  __esModule: true,
  default: {
    validateResetToken: jest.fn(),
    validateAdminAndToken: jest.fn(),
    resetPassword: jest.fn(),
  },
}));

const targetUser = {
  fullName: 'Jane Doe',
  username: 'jdoe',
  email: 'jane.doe@example.com',
  role: 'STANDARD',
};

const LoginProbe = () => {
  const location = useLocation();
  return <p>Login page: {location.state?.message}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reset-password?token=reset-token']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );

const httpError = (status, data) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

const authenticateAdmin = async (user) => {
  await user.type(await screen.findByLabelText('Administrator Username'), 'admin');
  await user.type(screen.getByLabelText('Password'), 'admin-password');
  await user.click(screen.getByRole('button', { name: 'Authenticate' }));
};

const submitNewPassword = async (user) => {
  await user.type(await screen.findByLabelText('New Password'), 'N3w-password');
  await user.type(screen.getByLabelText('Confirm New Password'), 'N3w-password');
  await user.click(screen.getByRole('button', { name: 'Reset Password' }));
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    passwordResetService.validateResetToken.mockResolvedValue({ success: true, valid: true, user: targetUser });
    passwordResetService.validateAdminAndToken.mockResolvedValue({
      success: true,
      valid: true,
      user: targetUser,
      admin: { userId: 1, fullName: 'Dr. Jane Doe' },
      approvalToken: 'approval-token',
    });
    passwordResetService.resetPassword.mockResolvedValue({ success: true, message: 'Password updated successfully.' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tells the administrator to wait when authentication is rate-limited (429)', async () => {
    passwordResetService.validateAdminAndToken.mockRejectedValue(httpError(429, { statusCode: 429, message: 'Too Many Requests' }));
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeInTheDocument();
    expect(screen.queryByText('Incorrect username or password.')).not.toBeInTheDocument();
  });

  it('resets the password with the approval token issued to the administrator', async () => {
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);
    await submitNewPassword(user);

    expect(passwordResetService.validateAdminAndToken).toHaveBeenCalledWith('reset-token', 'admin', 'admin-password');
    expect(passwordResetService.resetPassword).toHaveBeenCalledWith('reset-token', 'N3w-password', 'approval-token');
  });

  it('shows the role label instead of the role code', async () => {
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);

    expect(await screen.findByText('Standard')).toBeInTheDocument();
    expect(screen.queryByText('STANDARD')).not.toBeInTheDocument();
  });

  it('renders a single Back to Login button', async () => {
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);

    expect(await screen.findAllByRole('button', { name: 'Back to Login' })).toHaveLength(1);
  });

  it('shows the detail of an auth-controller error envelope', async () => {
    passwordResetService.resetPassword.mockResolvedValue({
      success: false,
      error: 'Error changing the password',
      detail: 'The token has expired.',
    });
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);
    await submitNewPassword(user);

    expect(await screen.findByText('The token has expired.')).toBeInTheDocument();
  });

  it('shows the message of a NestJS error response', async () => {
    passwordResetService.resetPassword.mockRejectedValue(
      httpError(403, { statusCode: 403, message: 'The approval has expired. Authenticate again.', error: 'Forbidden' })
    );
    const user = userEvent.setup();
    renderPage();

    await authenticateAdmin(user);
    await submitNewPassword(user);

    expect(await screen.findByText('The approval has expired. Authenticate again.')).toBeInTheDocument();
  });

  it('hands a success message to the login page', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await authenticateAdmin(user);
    await submitNewPassword(user);
    expect(await screen.findByText('Password Updated')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Login page: Password updated successfully for Jane Doe.')).toBeInTheDocument();
  });
});
