import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import ModalBase from './ModalBase';
import Button from './Button';
import { colors } from '../../config/colors';

/**
 * Shared confirmation dialog for irreversible or final actions.
 *
 * - Escape (or Cancel, or the close button) cancels. Escape is handled by ModalBase's
 *   focus trap, so it closes only this dialog when it is open over another one.
 * - Enter on the focused confirm button confirms.
 * - Focus starts on Cancel for destructive actions, so a stray Enter never
 *   destroys anything; otherwise it starts on the confirm button.
 * - While `loading` is true both actions and Escape are blocked and the
 *   confirm button shows a spinner (prevents double submission).
 *
 * @param {boolean} isOpen - Whether the dialog is shown
 * @param {string} title - Question shown as the dialog title (e.g. "Deactivate User?")
 * @param {React.ReactNode} children - Explanation of the consequences
 * @param {string} confirmLabel - Label of the confirm button
 * @param {string} cancelLabel - Label of the cancel button
 * @param {boolean} destructive - Irreversible action (warning icon, focus on Cancel)
 * @param {boolean} loading - The confirmed action is running
 * @param {Function} onConfirm - Called when the user confirms
 * @param {Function} onCancel - Called when the user cancels
 */
const ConfirmDialog = ({
  isOpen,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const handleClose = () => {
    if (!loading) onCancel();
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      icon={destructive ? AlertTriangle : HelpCircle}
      maxWidth="max-w-md"
      showCloseButton={!loading}
      closeOnOverlayClick={!loading}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus={destructive || undefined}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading} data-autofocus={!destructive || undefined}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="px-8 py-6 text-sm" style={{ color: colors.text.primary }}>
        {children}
      </div>
    </ModalBase>
  );
};

export default ConfirmDialog;
