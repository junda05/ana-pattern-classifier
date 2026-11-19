import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import useAuth from '../../hooks/useAuth';

jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/dashboard/home" element={<p>Home page</p>} />
        <Route
          path="/dashboard/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <p>User management</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/reports"
          element={
            <ProtectedRoute>
              <p>Reports</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

const signedInAs = (role) =>
  useAuth.mockReturnValue({
    isAuthenticated: true,
    initializing: false,
    user: { userId: 1, username: 'jdoe', fullName: 'Jane Doe', role },
  });

describe('ProtectedRoute', () => {
  it('sends anonymous visitors to the login page', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, initializing: false, user: null });

    renderAt('/dashboard/reports');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('waits for the stored session before deciding', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, initializing: true, user: null });

    renderAt('/dashboard/users');

    expect(screen.getByText('Verifying session…')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('shows the forbidden page to a STANDARD user on an admin-only route', () => {
    signedInAs('STANDARD');

    renderAt('/dashboard/users');

    expect(screen.queryByText('User management')).not.toBeInTheDocument();
    expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
  });

  it('lets the forbidden page return to Home', async () => {
    signedInAs('STANDARD');
    renderAt('/dashboard/users');

    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('renders the admin-only page for an ADMIN', () => {
    signedInAs('ADMIN');

    renderAt('/dashboard/users');

    expect(screen.getByText('User management')).toBeInTheDocument();
  });

  it('renders routes without a role restriction for any signed-in user', () => {
    signedInAs('STANDARD');

    renderAt('/dashboard/reports');

    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});
