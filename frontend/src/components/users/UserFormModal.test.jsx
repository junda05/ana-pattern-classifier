import { render, screen } from '@testing-library/react';
import UserFormModal from './UserFormModal';
import { NotificationProvider } from '../../context/NotificationContext';

const renderModal = (user = null) =>
  render(
    <NotificationProvider>
      <UserFormModal isOpen onClose={() => {}} onSave={() => {}} user={user} />
    </NotificationProvider>
  );

describe('UserFormModal', () => {
  it('is a modal dialog named by its title', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'New User' })).toHaveAttribute('aria-modal', 'true');
  });

  it('gives every field of the new-user form a programmatic label', () => {
    renderModal();

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Creation Date')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Professional License No.')).toBeInTheDocument();
    expect(screen.getByLabelText('System Role').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
  });

  it('lets keyboard users reveal a password with a toggle button', () => {
    renderModal();

    const toggles = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggles).toHaveLength(2);
    toggles.forEach((toggle) => {
      expect(toggle).not.toHaveAttribute('tabindex', '-1');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
