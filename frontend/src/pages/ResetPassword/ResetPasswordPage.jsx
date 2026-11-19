/**
 * Password reset page, opened from the emailed reset link (?token=…).
 * An administrator must authenticate before setting the user's new password.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import BrandingSection from '../../components/layout/BrandingSection';
import PasswordField from '../../components/ui/PasswordField';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AdminAuthModal from '../../components/common/AdminAuthModal';
import { CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { colors } from '../../config/colors';
import { NOTIFICATION_DURATIONS } from '../../config/notificationConfig';
import passwordResetService from '../../services/api/passwordResetService';
import { getApiErrorMessage } from '../../services/utils/apiErrors';
import { formatRoleLabel } from '../../services/utils/constants';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  // Short-lived token proving that an administrator approved this reset
  const [approvalToken, setApprovalToken] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  // Validate the token on load; the form stays hidden until an administrator authenticates.
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        setTokenMessage('No reset token was provided.');
        setValidating(false);
        return;
      }

      try {
        const data = await passwordResetService.validateResetToken(token);

        if (data.valid) {
          setTokenValid(true);
          setUserInfo(data.user);
          setShowAdminModal(true);
        } else {
          setTokenValid(false);
          setTokenMessage(getApiErrorMessage(data, 'This password reset link is not valid.'));
        }
      } catch (err) {
        setTokenValid(false);
        setTokenMessage(getApiErrorMessage(err, 'Could not validate the password reset link.'));
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // After a successful reset, go to the login page, which shows the confirmation once.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => {
      navigate('/login', {
        state: { message: `Password updated successfully for ${userInfo?.fullName || 'the user'}.` },
      });
    }, NOTIFICATION_DURATIONS.SUCCESS);
    return () => clearTimeout(timer);
  }, [success, navigate, userInfo]);

  /**
   * Validates the administrator's credentials. Any failure is rethrown and
   * AdminAuthModal shows one generic message, so the response never reveals
   * whether the account exists, is an administrator or is active.
   */
  const handleAdminAuthentication = async (adminUsername, adminPassword) => {
    const data = await passwordResetService.validateAdminAndToken(token, adminUsername, adminPassword);

    if (!data.valid || !data.admin || !data.approvalToken) {
      throw new Error('Authentication failed.');
    }

    setApprovalToken(data.approvalToken);
    setUserInfo(data.user);
    setAdminAuthenticated(true);
    setShowAdminModal(false);
    return data.admin;
  };

  // Closing the admin modal without authenticating abandons the reset.
  const handleAdminModalClose = () => {
    if (!adminAuthenticated) {
      navigate('/login');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const data = await passwordResetService.resetPassword(token, password, approvalToken);

      if (data?.success === false) {
        setError(getApiErrorMessage(data, 'Could not change the password.'));
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="flex items-center justify-center h-screen" role="status">
        <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
        <span className="ml-3 text-gray-600">Validating reset link…</span>
      </div>
    );
  }

  // Invalid or expired token
  if (!tokenValid) {
    return (
      <AuthLayout brandingContent={<BrandingSection />}>
        <div className="max-w-md w-full mx-auto text-center">
          <div className="flex flex-col items-center justify-center mb-6">
            <div 
              className="p-4 rounded-full"
              style={{ backgroundColor: `${colors.state.error}15` }}
            >
              <AlertCircle size={48} style={{ color: colors.state.error }} />
            </div>
          </div>
          <h2 
            className="text-2xl font-semibold mb-4"
            style={{ color: colors.text.dark }}
          >
            Invalid Reset Link
          </h2>
          <p 
            className="text-base mb-6"
            style={{ color: colors.text.primary }}
          >
            {tokenMessage || 'This password reset link is invalid or has expired.'}
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!adminAuthenticated) {
    return (
      <>
        <AuthLayout brandingContent={<BrandingSection />}>
          <div className="max-w-md w-full mx-auto">
            <div className="flex flex-col items-center justify-center" role="status">
              <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
              <span className="mt-4 text-gray-600">Waiting for administrator authentication…</span>
            </div>
          </div>
        </AuthLayout>
        <AdminAuthModal
          isOpen={showAdminModal}
          onClose={handleAdminModalClose}
          onAuthenticated={handleAdminAuthentication}
          title="Administrator Authentication"
          subtitle="Verify your identity to reset this user's password."
        />
      </>
    );
  }

  if (success) {
    return (
      <AuthLayout brandingContent={<BrandingSection />}>
        <div className="max-w-md w-full mx-auto text-center">
          <div className="flex flex-col items-center justify-center mb-6">
            <div 
              className="p-4 rounded-full"
              style={{ backgroundColor: `${colors.state.success}15` }}
            >
              <CheckCircle size={48} style={{ color: colors.state.success }} />
            </div>
          </div>
          <h2 
            className="text-2xl font-semibold mb-4"
            style={{ color: colors.text.dark }}
          >
            Password Updated
          </h2>
          <p 
            className="text-base mb-2"
            style={{ color: colors.text.primary }}
          >
            The user's password was updated successfully.
          </p>
          {userInfo && (
            <div 
              className="text-sm mb-4 p-3 rounded-lg text-left"
              style={{ 
                backgroundColor: `${colors.primary.red}10`,
                color: colors.text.primary 
              }}
            >
              <p className="font-semibold mb-1">User: {userInfo.fullName}</p>
              <p className="text-xs" style={{ color: colors.text.secondary }}>
                {userInfo.username} - {userInfo.email}
              </p>
            </div>
          )}
          <p 
            className="text-sm mb-6"
            style={{ color: colors.text.secondary }}
          >
            Redirecting to the login page…
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout brandingContent={<BrandingSection />}>
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center mb-4">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${colors.primary.red}15` }}
            >
              <Lock size={32} style={{ color: colors.primary.red }} />
            </div>
            <h2 
              className="text-3xl font-semibold mt-3"
              style={{ color: colors.text.dark }}
            >
              Reset Password
            </h2>
          </div>
          <p 
            className="text-sm mb-4"
            style={{ color: colors.text.secondary }}
          >
            As an administrator, set a new password for this user.
          </p>
          {userInfo && (
            <div 
              className="mt-4 p-4 rounded-lg text-left"
              style={{ 
                backgroundColor: `${colors.primary.red}10`
              }}
            >
              <p 
                className="font-semibold mb-2"
                style={{ color: colors.text.dark }}
              >
                Resetting password for:
              </p>
              <div className="space-y-1">
                <p 
                  className="text-sm"
                  style={{ color: colors.text.primary }}
                >
                  <strong>Full name:</strong> {userInfo.fullName}
                </p>
                <p 
                  className="text-sm"
                  style={{ color: colors.text.primary }}
                >
                  <strong>Username:</strong> {userInfo.username}
                </p>
                <p 
                  className="text-sm"
                  style={{ color: colors.text.primary }}
                >
                  <strong>Email:</strong> {userInfo.email}
                </p>
                <p 
                  className="text-sm"
                  style={{ color: colors.text.primary }}
                >
                  <strong>Role:</strong> {formatRoleLabel(userInfo.role)}
                </p>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <PasswordField
            id="password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            label="New Password"
            placeholder="At least 8 characters"
            disabled={loading}
            required
            autoFocus
          />

          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            label="Confirm New Password"
            placeholder="Re-enter the password"
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

          <div className="space-y-3 pt-4">
            <div className="flex justify-center">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
              >
                Reset Password
              </Button>
            </div>

            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => navigate('/login')}
                disabled={loading}
              >
                Back to Login
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
