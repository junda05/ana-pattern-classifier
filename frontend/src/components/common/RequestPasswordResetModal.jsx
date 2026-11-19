/**
 * Lets a user request a password reset by username. The system administrator
 * receives the reset link by email and sets the new password.
 */

import React, { useCallback, useEffect, useState } from 'react';
import ModalBase from '../ui/ModalBase';
import InputField from '../ui/InputField';
import Button from '../ui/Button';
import { Mail, CheckCircle } from 'lucide-react';
import { colors } from '../../config/colors';
import { NOTIFICATION_DURATIONS } from '../../config/notificationConfig';
import passwordResetService from '../../services/api/passwordResetService';
import { getApiErrorMessage } from '../../services/utils/apiErrors';

const RequestPasswordResetModal = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await passwordResetService.requestPasswordReset(username.trim());

      if (data?.success === false) {
        setError(getApiErrorMessage(data, 'Could not process the request.'));
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the request. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    setUsername('');
    setError('');
    setSuccess(false);
    onClose();
  }, [onClose]);

  // Close automatically a moment after the confirmation is shown.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(handleClose, NOTIFICATION_DURATIONS.SUCCESS);
    return () => clearTimeout(timer);
  }, [success, handleClose]);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Password Reset"
      subtitle="The administrator will receive an email to reset your password."
      icon={Mail}
      maxWidth="max-w-lg"
      showCloseButton={!loading}
      closeOnOverlayClick={!loading}
    >
      <div className="px-8 py-6">
        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div 
              className="text-sm p-4 rounded-lg"
              style={{ 
                backgroundColor: `${colors.primary.red}10`,
                color: colors.text.primary
              }}
            >
              <p>
                When you request a password reset, an email is sent to the{' '}
                <strong>system administrator</strong>, who will follow the link
                and set your new password.
              </p>
            </div>

            <InputField
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              label="Username"
              placeholder="Enter your username"
              error={error}
              disabled={loading}
              required
              data-autofocus
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
                className="flex-1"
              >
                Send Request
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div 
                className="p-4 rounded-full"
                style={{ backgroundColor: `${colors.state.success}15` }}
              >
                <CheckCircle 
                  size={48} 
                  style={{ color: colors.state.success }} 
                />
              </div>
            </div>
            <h3 
              className="text-xl font-semibold mb-2"
              style={{ color: colors.text.dark }}
            >
              Request Sent
            </h3>
            <p 
              className="text-sm mb-4"
              style={{ color: colors.text.primary }}
            >
              If the account exists, the system administrator has been notified and
              will receive an email with a link to reset your password.
            </p>
            <p 
              className="text-xs"
              style={{ color: colors.text.secondary }}
            >
              Closing automatically…
            </p>
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default RequestPasswordResetModal;
