import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import useAuth from '../../hooks/useAuth';
import { NotificationProvider } from '../../context/NotificationContext';

jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));

const LocationProbe = () => {
  const location = useLocation();
  return <pre data-testid="location-state">{JSON.stringify(location.state)}</pre>;
};

const renderLogin = (entry) =>
  render(
    <NotificationProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <LoginPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/dashboard/home" element={<p>Home page</p>} />
          <Route path="/dashboard/reports" element={<p>Reports page</p>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>
  );

describe('LoginPage', () => {
  it('returns to the page the user originally requested after logging in', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, initializing: false, loading: false, login: jest.fn() });

    renderLogin({ pathname: '/login', state: { from: { pathname: '/dashboard/reports', search: '', hash: '' } } });

    expect(screen.getByText('Reports page')).toBeInTheDocument();
  });

  it('goes to Home when no page was requested', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, initializing: false, loading: false, login: jest.fn() });

    renderLogin('/login');

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('shows a message passed by the previous page once, then drops it from the history state', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, initializing: false, loading: false, login: jest.fn() });

    renderLogin({ pathname: '/login', state: { message: 'Password updated successfully for Jane Doe.' } });

    expect(screen.getByRole('status')).toHaveTextContent('Password updated successfully for Jane Doe.');
    expect(screen.getByTestId('location-state')).not.toHaveTextContent('Password updated');
  });
});
