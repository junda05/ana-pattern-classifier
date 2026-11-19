import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar';
import useAuth from '../../hooks/useAuth';
import { NavigationGuardProvider, useUnsavedChangesGuard } from '../../context/NavigationGuardContext';

jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <DashboardSidebar collapsed={false} onToggle={() => {}} />
    </MemoryRouter>
  );

const LocationProbe = () => <p data-testid="location">{useLocation().pathname}</p>;

const renderSidebarWithRoutes = ({ collapsed = false, onToggle = () => {}, path = '/dashboard/home' } = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardSidebar collapsed={collapsed} onToggle={onToggle} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

const standardUser = { userId: 1, username: 'jdoe', fullName: 'Dr. Jane Doe', role: 'STANDARD' };

describe('DashboardSidebar', () => {
  it("shows the user's full name from the profile", () => {
    useAuth.mockReturnValue({
      user: { userId: 1, username: 'jdoe', fullName: 'Dr. Jane Doe', email: 'jane.doe@example.com', role: 'STANDARD' },
      logout: jest.fn(),
    });

    renderSidebar();

    expect(screen.getByText('Dr. Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument();
  });

  it('falls back to the username when the profile has no full name', () => {
    useAuth.mockReturnValue({ user: { userId: 1, username: 'jdoe', role: 'STANDARD' }, logout: jest.fn() });

    renderSidebar();

    expect(screen.getByText('jdoe')).toBeInTheDocument();
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });

  describe('keyboard navigation', () => {
    it('renders the menu as links inside a labelled navigation landmark', () => {
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });

      renderSidebarWithRoutes();

      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(nav).toContainElement(screen.getByRole('link', { name: 'Home' }));
      expect(screen.getByRole('link', { name: 'ANA Analysis' })).toHaveAttribute('href', '/dashboard/analysis');
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    it('navigates when a menu item is reached with Tab and activated with Enter', async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });
      renderSidebarWithRoutes();

      const reports = screen.getByRole('link', { name: 'Reports' });
      let steps = 0;
      while (!reports.matches(':focus') && steps < 10) {
        await user.tab();
        steps += 1;
      }
      expect(reports).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/reports');
    });

    it('logs out from a real button', async () => {
      const user = userEvent.setup();
      const logout = jest.fn().mockResolvedValue(undefined);
      useAuth.mockReturnValue({ user: standardUser, logout });
      renderSidebarWithRoutes();

      screen.getByRole('button', { name: 'Log Out' }).focus();
      await user.keyboard('{Enter}');

      expect(logout).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    });

    it('exposes the collapse button state', async () => {
      const user = userEvent.setup();
      const onToggle = jest.fn();
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });
      renderSidebarWithRoutes({ onToggle });

      const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
      expect(collapse).toHaveAttribute('aria-expanded', 'true');
      expect(collapse).toHaveAttribute('aria-controls', 'dashboard-sidebar');

      await user.click(collapse);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('takes the collapsed menu out of the tab order', () => {
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });

      renderSidebarWithRoutes({ collapsed: true });

      expect(screen.getByRole('complementary', { hidden: true })).toHaveAttribute('inert');
      expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    });
  });

  describe('unsaved analysis guard', () => {
    const UnsavedPage = () => {
      useUnsavedChangesGuard(true);
      return <LocationProbe />;
    };

    const renderGuarded = (path = '/dashboard/analysis', state = null) =>
      render(
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
          <NavigationGuardProvider>
            <DashboardSidebar collapsed={false} onToggle={() => {}} />
            <Routes>
              <Route path="*" element={<UnsavedPage />} />
            </Routes>
          </NavigationGuardProvider>
        </MemoryRouter>
      );

    it('asks before a menu link leaves unsaved work', async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });
      renderGuarded();

      await user.click(screen.getByRole('link', { name: 'Reports' }));
      expect(screen.getByRole('dialog', { name: 'Leave Without Saving?' })).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/analysis');

      await user.click(screen.getByRole('button', { name: 'Stay' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/analysis');

      await user.click(screen.getByRole('link', { name: 'Reports' }));
      await user.click(screen.getByRole('button', { name: 'Leave' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/reports');
    });

    it('asks before leaving a continued result for a new analysis', async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: standardUser, logout: jest.fn() });
      renderGuarded('/dashboard/analysis', { continueResultId: 42 });

      await user.click(screen.getByRole('link', { name: 'ANA Analysis' }));

      expect(screen.getByRole('dialog', { name: 'Leave Without Saving?' })).toBeInTheDocument();
    });

    it('asks before logging out with unsaved work', async () => {
      const user = userEvent.setup();
      const logout = jest.fn().mockResolvedValue(undefined);
      useAuth.mockReturnValue({ user: standardUser, logout });
      renderGuarded();

      await user.click(screen.getByRole('button', { name: 'Log Out' }));
      expect(screen.getByRole('dialog', { name: 'Leave Without Saving?' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Stay' }));
      expect(logout).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Log Out' }));
      await user.click(screen.getByRole('button', { name: 'Leave' }));
      expect(logout).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    });
  });
});
