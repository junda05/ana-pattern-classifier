import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import useAuth from '../../hooks/useAuth';
import { NotificationProvider } from '../../context/NotificationContext';

jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));

const renderForm = () =>
  render(
    <NotificationProvider>
      <LoginForm />
    </NotificationProvider>
  );

describe('LoginForm', () => {
  it('validates the fields before calling login', async () => {
    const login = jest.fn();
    useAuth.mockReturnValue({ login, loading: false });
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(screen.getByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits the trimmed-down credentials to login', async () => {
    const login = jest.fn().mockResolvedValue({ ok: true });
    useAuth.mockReturnValue({ login, loading: false });
    renderForm();

    await userEvent.type(screen.getByLabelText('Username'), 'jdoe');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(login).toHaveBeenCalledWith('jdoe', 'secret-password');
  });

  it('reports an unexpected failure through the notification system', async () => {
    const login = jest.fn().mockRejectedValue(new Error('boom'));
    useAuth.mockReturnValue({ login, loading: false });
    renderForm();

    await userEvent.type(screen.getByLabelText('Username'), 'jdoe');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText('An unexpected error occurred while logging in.')).toBeInTheDocument();
  });
});
