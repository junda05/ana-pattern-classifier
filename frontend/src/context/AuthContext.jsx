import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import authService from '../services/api/authService';
import { clearTokens, getTokens } from '../services/utils/tokenStorage';
import useNotifications from '../hooks/useNotifications';
import sessionManager from '../services/utils/sessionManager';
import { NOTIFICATION_DURATIONS, NOTIFICATION_TITLES } from '../config/notificationConfig';
import { getApiErrorMessage } from '../services/utils/apiErrors';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState(null);

  const { showSuccess, showError, showWarning } = useNotifications();

  // Route session-manager notices (expiry warnings, forced logout) through the toast system.
  useEffect(() => {
    sessionManager.setNotificationCallback((notification) => {
      if (notification.type === 'warning') {
        showWarning(notification.message, {
          title: notification.title,
          autoCloseMs: notification.autoCloseMs,
          dismissible: notification.dismissible
        });
      } else if (notification.type === 'error') {
        showError(notification.message, {
          title: notification.title,
          autoCloseMs: notification.autoCloseMs
        });
      }
    });

    const removeSessionListener = sessionManager.addSessionListener((event) => {
      if (event.type === 'SESSION_EXPIRED') {
        setUser(null);
        setAuthError('Session expired.');
        setLoading(false);
      }
    });

    return () => {
      removeSessionListener();
      sessionManager.cleanup();
    };
  }, [showWarning, showError]);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authService.login(username, password);
      const userData = data.user || { username };
      setUser(userData);

      showSuccess(`Welcome, ${userData.fullName || userData.username}.`, {
        title: NOTIFICATION_TITLES.LOGIN_SUCCESS,
      });

      return { ok: true };
    } catch (e) {
      let errorMsg;
      let title = NOTIFICATION_TITLES.LOGIN_ERROR;

      if (!e.response) {
        errorMsg = 'Could not connect to the server. Check your internet connection and try again.';
        title = NOTIFICATION_TITLES.CONNECTION_ERROR;
      } else if (e.response.status === 401) {
        // The API answers wrong credentials with a NestJS 401; never reveal which field was wrong.
        errorMsg = 'Incorrect username or password.';
        title = NOTIFICATION_TITLES.CREDENTIALS_ERROR;
      } else {
        errorMsg = getApiErrorMessage(e, 'Could not log in. Please try again.');
      }

      setAuthError(errorMsg);

      showError(errorMsg, {
        title: title,
        autoCloseMs: NOTIFICATION_DURATIONS.AUTH_ERROR
      });

      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      showSuccess('You have been logged out.', {
        title: NOTIFICATION_TITLES.LOGOUT_SUCCESS,
        autoCloseMs: NOTIFICATION_DURATIONS.LOGOUT
      });
    } catch (error) {
      showError('The server could not complete the logout, but your local session has been closed.', {
        title: NOTIFICATION_TITLES.LOGOUT_ERROR,
        autoCloseMs: NOTIFICATION_DURATIONS.LOGOUT
      });
    } finally {
      clearTokens();
      setUser(null);
      setLoading(false);
    }
  }, [showSuccess, showError]);

  const loadInitialSession = useCallback(async () => {
    setInitializing(true);
    try {
      const tokens = getTokens();
      if (tokens?.user && tokens?.access) {
        try {
          const fullUserData = await authService.updateStoredUser();
          setUser(fullUserData);
        } catch (error) {
          if (!error.response) {
            // API unreachable: keep the stored session; requests will report their own errors.
            setUser(tokens.user);
          } else if (error.response.status !== 401) {
            // A 401 means the refresh also failed and sessionManager already ended the session.
            clearTokens();
            setUser(null);
          }
        }
      }
    } catch (error) {
      sessionManager.handleInvalidToken();
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialSession();
  }, [loadInitialSession]);

  const value = useMemo(() => ({
    user,
    loading: loading || initializing, // loading also covers initializing
    authError,
    login,
    logout,
    isAuthenticated: !!user,
    initializing
  }), [user, loading, initializing, authError, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
