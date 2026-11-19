import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalBase from './ModalBase';
import ConfirmDialog from './ConfirmDialog';

const Harness = ({ onClose = () => {}, closeOnEscape, confirmPlacement = 'none', onConfirmCancel = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const confirm = (
    <ConfirmDialog
      isOpen={confirming}
      title="Discard Changes?"
      destructive
      onConfirm={() => setConfirming(false)}
      onCancel={() => {
        onConfirmCancel();
        setConfirming(false);
      }}
    >
      Unsaved changes will be lost.
    </ConfirmDialog>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit Patient
      </button>
      <ModalBase
        isOpen={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Edit Patient"
        subtitle="Update the patient details."
        closeOnEscape={closeOnEscape}
        footer={<button type="button">Save</button>}
      >
        <label htmlFor="patient-name">Full Name</label>
        <input id="patient-name" />
        <button type="button" onClick={() => setConfirming(true)}>
          Discard
        </button>
        {confirmPlacement === 'nested' && confirm}
      </ModalBase>
      {confirmPlacement === 'sibling' && confirm}
    </>
  );
};

describe('ModalBase', () => {
  it('is an accessible modal dialog named by its title', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Edit Patient' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit Patient' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Update the patient details.');
  });

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Edit Patient' }));

    // Without a data-autofocus field, focus lands on the first control of the dialog
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Edit Patient' }));

    screen.getByRole('button', { name: 'Save' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Edit Patient' });
    await user.click(opener);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('ignores Escape when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Harness onClose={onClose} closeOnEscape={false} />);
    await user.click(screen.getByRole('button', { name: 'Edit Patient' }));

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit Patient' })).toBeInTheDocument();
  });

  it.each(['nested', 'sibling'])(
    'closes only the confirm dialog, once, on Escape when it is open over the modal (%s)',
    async (confirmPlacement) => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const onConfirmCancel = jest.fn();
      render(<Harness onClose={onClose} onConfirmCancel={onConfirmCancel} confirmPlacement={confirmPlacement} />);
      await user.click(screen.getByRole('button', { name: 'Edit Patient' }));
      const discard = screen.getByRole('button', { name: 'Discard' });
      await user.click(discard);
      expect(screen.getByRole('dialog', { name: 'Discard Changes?' })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(onConfirmCancel).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: 'Discard Changes?' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Edit Patient' })).toBeInTheDocument();
      expect(discard).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirmCancel).toHaveBeenCalledTimes(1);
    }
  );
});
