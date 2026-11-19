import React, { useCallback, useState } from 'react';
import InputField from '../ui/InputField';
import PasswordField from '../ui/PasswordField';
import Button from '../ui/Button';
import RequestPasswordResetModal from './RequestPasswordResetModal';
import { loginValidators } from '../../services/utils/validators';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import useNotifications from '../../hooks/useNotifications';
import { NOTIFICATION_DURATIONS, NOTIFICATION_TITLES } from '../../config/notificationConfig';
import { colors } from '../../config/colors';

/**
 * Login form: field state, basic validation and the password reset request link.
 */
const LoginForm = () => {
  const { login, loading } = useAuth();
  const { showError } = useNotifications();
  const { values, errors, onChange, isValid } = useForm(
    { username: '', password: '' },
    loginValidators
  );
  const [showResetModal, setShowResetModal] = useState(false);
  const closeResetModal = useCallback(() => setShowResetModal(false), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isValid()) {
      return;
    }
    
    try {
      // AuthContext reports failures and LoginPage redirects after a successful login.
      await login(values.username, values.password);
    } catch (error) {
      showError('An unexpected error occurred while logging in.', {
        title: NOTIFICATION_TITLES.LOGIN_ERROR,
        autoCloseMs: NOTIFICATION_DURATIONS.ERROR
      });
    }
  };

  return (
    <div className="max-w-sm w-full pl-8 ml-20">
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField
          id="username"
          name="username"
          type="text"
          value={values.username}
          onChange={onChange}
          label="Username"
          placeholder="Enter your username"
          error={errors.username}
          disabled={loading}
          required
        />
        
        <PasswordField
          id="password"
          name="password"
          value={values.password}
          onChange={onChange}
          label="Password"
          placeholder="Enter your password"
          error={errors.password}
          disabled={loading}
          required
        />
        
        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            variant="primary"
            width="3/5"
            disabled={loading}
            loading={loading}
          >
            Log In
          </Button>
        </div>

        {/* Password reset request link */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="text-sm hover:underline transition-colors"
            style={{ color: colors.primary.red }}
            disabled={loading}
          >
            Forgot your password?
          </button>
        </div>
      </form>

      <RequestPasswordResetModal
        isOpen={showResetModal}
        onClose={closeResetModal}
      />
    </div>
  );
};

export default LoginForm;
