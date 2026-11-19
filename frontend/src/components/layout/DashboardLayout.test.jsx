import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { useUnsavedChangesGuard } from '../../context/NavigationGuardContext';

jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));

describe('DashboardLayout', () => {
  it('keeps keyboard focus on the toggle when the sidebar collapses and expands', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { userId: 1, fullName: 'Dr. Jane Doe', role: 'STANDARD' }, logout: jest.fn() });
    render(
      <MemoryRouter initialEntries={['/dashboard/home']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route path="home" element={<p>Home page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveFocus();
    expect(expand).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  });

  it('guards the menu for pages that hold unsaved work', async () => {
    const UnsavedPage = () => {
      useUnsavedChangesGuard(true);
      return <p>Analysis page</p>;
    };
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { userId: 1, fullName: 'Dr. Jane Doe', role: 'STANDARD' }, logout: jest.fn() });
    render(
      <MemoryRouter initialEntries={['/dashboard/analysis']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route path="analysis" element={<UnsavedPage />} />
            <Route path="home" element={<p>Home page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('link', { name: 'Home' }));

    expect(screen.getByRole('dialog', { name: 'Leave Without Saving?' })).toBeInTheDocument();
    expect(screen.getByText('Analysis page')).toBeInTheDocument();
  });
});
