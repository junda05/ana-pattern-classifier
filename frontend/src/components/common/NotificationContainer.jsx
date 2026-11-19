import React from 'react';
import AlertMessage from './AlertMessage';
import { ANIMATION_DURATIONS } from '../../config/notificationConfig';

/**
 * Stack of active notifications: centered at the top on mobile, top-right on
 * larger screens, with a staggered slide-in animation.
 *
 * @param {Object} props
 * @param {Array} props.notifications - Notifications to display
 * @param {Function} props.onClose - Dismisses a notification by id
 */
const NotificationContainer = ({ notifications = [], onClose }) => {
  if (!notifications.length) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 sm:left-auto sm:right-4 sm:transform-none sm:translate-x-0 z-50 w-full max-w-sm sm:max-w-md pointer-events-none px-4 sm:px-0">
      <div className="space-y-3 pointer-events-auto w-full">
        {notifications.map((notif, index) => (
          <div
            key={notif.id}
            className="transform transition-all duration-500 ease-out w-full animate-slide-in-from-right"
            style={{
              transformOrigin: 'right center',
              animationDelay: `${index * ANIMATION_DURATIONS.STAGGER}ms`
            }}
          >
            <AlertMessage
              type={notif.type}
              message={notif.message}
              title={notif.title}
              dismissible={notif.dismissible}
              autoCloseMs={notif.autoCloseMs}
              showIcon={notif.showIcon !== false}
              onClose={() => onClose(notif.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;