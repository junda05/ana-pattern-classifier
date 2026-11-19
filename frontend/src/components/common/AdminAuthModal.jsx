/**
 * Asks for administrator credentials before a sensitive action is allowed.
 */

import React, { useState } from 'react';
import ModalBase from '../ui/ModalBase';
import InputField from '../ui/InputField';
import PasswordField from '../ui/PasswordField';
import Button from '../ui/Button';
import { Shield } from 'lucide-react';
import { colors } from '../../config/colors';
import { TOO_MANY_REQUESTS_MESSAGE } from '../../services/utils/apiErrors';

const AdminAuthModal = ({ isOpen, onClose, onAuthenticated, title, subtitle }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onAuthenticated(username.trim(), password);
      // Success: do NOT call handleClose(). The parent closes the modal once
      // its adminAuthenticated state changes.
    } catch (err) {
      // Always the same generic message, so the response never reveals whether
      // the user exists, is an administrator or is active. Rate limiting (429)
      // says nothing about the account, so it is explained as such.
      setError(err?.response?.status === 429 ? TOO_MANY_REQUESTS_MESSAGE : 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      title={title || "Administrator Authentication"}
      subtitle={subtitle || "Enter your administrator credentials to continue."}
      icon={Shield}
      maxWidth="max-w-md"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div 
            className="text-sm p-3 rounded-lg mb-4"
            style={{ 
              backgroundColor: `${colors.primary.red}10`,
              color: colors.text.primary
            }}
          >
            <p>
              This action requires administrator privileges.
              Please verify your identity.
            </p>
          </div>

          <InputField
            id="admin-username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            label="Administrator Username"
            placeholder="Enter your username"
            disabled={loading}
            required
            data-autofocus
          />

          <PasswordField
            id="admin-password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            label="Password"
            placeholder="Enter your password"
            disabled={loading}
            required
          />

          {error && (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ 
                backgroundColor: `${colors.state.error}15`,
                color: colors.state.error
              }}
            >
              {error}
            </div>
          )}

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
              Authenticate
            </Button>
          </div>
        </form>
      </div>
    </ModalBase>
  );
};

export default AdminAuthModal;
