import { useContext } from 'react';
import NotificationContext from '../context/NotificationContext';

/**
 * Access the notification API (showSuccess, showError, showWarning, showInfo, …).
 *
 * @returns {Object} Notification context value
 */
export default function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
}
