import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

const renderDialog = (props = {}) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(
    <ConfirmDialog
      isOpen
      title="Deactivate User?"
      confirmLabel="Deactivate User"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      Jane Doe will no longer be able to log in.
    </ConfirmDialog>
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('shows the title, the message and both actions', () => {
    renderDialog();

    expect(screen.getByText('Deactivate User?')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe will no longer be able to log in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('Deactivate User?')).not.toBeInTheDocument();
  });

  it('cancels on Escape', async () => {
    const { onConfirm, onCancel } = renderDialog();

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms when Enter is pressed on the confirm button', async () => {
    const { onConfirm, onCancel } = renderDialog();

    screen.getByRole('button', { name: 'Deactivate User' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('starts on the cancel button for destructive actions', () => {
    renderDialog({ destructive: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('starts on the confirm button for non-destructive actions', () => {
    renderDialog({ destructive: false });

    expect(screen.getByRole('button', { name: 'Deactivate User' })).toHaveFocus();
  });

  it('blocks both actions and Escape while the action is running', async () => {
    const { onConfirm, onCancel } = renderDialog({ loading: true });

    await userEvent.keyboard('{Escape}');

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deactivate User|Loading/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
