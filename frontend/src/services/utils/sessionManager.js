/**
 * Session manager
 * Ends the session when the refresh token expires or a token is invalid,
 * and notifies the registered listeners
 */
import { clearTokens } from './tokenStorage';
import logger from './logger';
import { NOTIFICATION_DURATIONS, NOTIFICATION_TITLES } from '../../config/notificationConfig';

class SessionManager {
  constructor() {
    this.listeners = new Set();
    this.notificationCallback = null;

    // Guards against handling the same expiry several times
    this.sessionExpiredHandled = false;
    this.redirectTimeout = null;
  }

  /**
   * Registers the callback used to show notifications
   */
  setNotificationCallback(callback) {
    this.notificationCallback = callback;
  }

  /**
   * Handles an expired refresh token. Listeners (AuthContext) clear the user,
   * and ProtectedRoute then redirects to the login page.
   */
  handleRefreshTokenExpired() {
    if (this.sessionExpiredHandled) {
      return;
    }
    
    this.sessionExpiredHandled = true;
    
    clearTokens();
    this.notifySessionExpired();
    
    if (this.notificationCallback) {
      this.notificationCallback({
        type: 'warning',
        title: NOTIFICATION_TITLES.SESSION_EXPIRED,
        message: 'Your session ended due to inactivity. Please log in again to continue.',
        autoCloseMs: NOTIFICATION_DURATIONS.SESSION_EXPIRED,
        dismissible: true
      });
    }
    
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
    }
    
    this.redirectTimeout = setTimeout(() => {
      this.sessionExpiredHandled = false;
    }, NOTIFICATION_DURATIONS.SESSION_EXPIRED + 1000);
  }

  /**
   * Handles invalid or corrupted tokens
   */
  handleInvalidToken() {
    if (this.sessionExpiredHandled) {
      return;
    }
    
    this.sessionExpiredHandled = true;
    
    clearTokens();
    this.notifySessionExpired();
    
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
    }
    
    this.redirectTimeout = setTimeout(() => {
      this.sessionExpiredHandled = false;
    }, 2000);
  }

  /**
   * Registers a session change listener
   * @returns {Function} Unsubscribe function
   */
  addSessionListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies every listener that the session has expired
   */
  notifySessionExpired() {
    this.listeners.forEach(callback => {
      try {
        callback({ type: 'SESSION_EXPIRED' });
      } catch (error) {
        logger.error('Session listener failed:', error);
      }
    });
  }

  /**
   * Resets the expiry guard
   */
  reset() {
    this.sessionExpiredHandled = false;
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
      this.redirectTimeout = null;
    }
  }

  /**
   * Removes every listener and callback
   */
  cleanup() {
    this.listeners.clear();
    this.notificationCallback = null;
    this.reset();
  }
}

// Singleton instance
const sessionManager = new SessionManager();

export default sessionManager;