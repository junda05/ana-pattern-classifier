import React, { createContext, useState, useCallback, useRef, useMemo } from 'react';
import NotificationContainer from '../components/common/NotificationContainer';
import { NOTIFICATION_DURATIONS } from '../config/notificationConfig';

/**
 * App-wide toast notifications, kept separate from the auth context.
 *
 * - Several notifications can be shown at once, each with a unique ID.
 * - Auto-close delay is configurable per notification.
 * - Identical notifications raised within a short window are dropped.
 */
const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const idCounter = useRef(0);
  const timersRef = useRef(new Map());
  const notificationsRef = useRef(notifications);

  React.useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `notification_${idCounter.current}_${Date.now()}`;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addNotification = useCallback((notification) => {
    const now = Date.now();

    const isDuplicate = notificationsRef.current.some(notif => {
      const elapsed = now - notif.timestamp;
      return notif.type === notification.type &&
             notif.message === notification.message &&
             notif.title === (notification.title || getDefaultTitle(notification.type)) &&
             elapsed < NOTIFICATION_DURATIONS.DUPLICATE_WINDOW;
    });

    if (isDuplicate) {
      return null;
    }

    const id = generateId();

    let duration = notification.autoCloseMs;
    if (duration === undefined) {
      switch(notification.type) {
        case 'success':
          duration = NOTIFICATION_DURATIONS.SUCCESS;
          break;
        case 'error':
          duration = NOTIFICATION_DURATIONS.ERROR;
          break;
        case 'warning':
          duration = NOTIFICATION_DURATIONS.WARNING;
          break;
        case 'info':
          duration = NOTIFICATION_DURATIONS.INFO;
          break;
        default:
          duration = NOTIFICATION_DURATIONS.DEFAULT;
      }
    }

    const newNotification = {
      id,
      type: 'info',
      dismissible: true,
      ...notification,
      autoCloseMs: duration,
      timestamp: now
    };

    setNotifications(prev => [...prev, newNotification]);

    return id;
  }, [generateId]);

  const getDefaultTitle = (type) => {
    switch(type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': return 'Information';
      default: return 'Information';
    }
  };

  const clearNotifications = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();

    setNotifications([]);
  }, []);

  const showSuccess = useCallback((message, options = {}) => {
    return addNotification({
      type: 'success',
      title: options.title || 'Success',
      message,
      autoCloseMs: NOTIFICATION_DURATIONS.SUCCESS,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, options = {}) => {
    return addNotification({
      type: 'error',
      title: options.title || 'Error',
      message,
      autoCloseMs: NOTIFICATION_DURATIONS.ERROR,
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return addNotification({
      type: 'warning',
      title: options.title || 'Warning',
      message,
      autoCloseMs: NOTIFICATION_DURATIONS.WARNING,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return addNotification({
      type: 'info',
      title: options.title || 'Information',
      message,
      autoCloseMs: NOTIFICATION_DURATIONS.INFO,
      ...options
    });
  }, [addNotification]);

  const value = useMemo(() => ({
    durations: NOTIFICATION_DURATIONS,

    removeNotification,
    clearNotifications,

    showSuccess,
    showError,
    showWarning,
    showInfo,
  }), [
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
