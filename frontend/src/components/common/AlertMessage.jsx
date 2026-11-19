import React, { useState, useEffect, useCallback } from 'react';
import { SuccessIcon, ErrorIcon, WarningIcon, InfoIcon } from '../Icons/icons';
import { colors } from '../../config/colors';
import { ANIMATION_DURATIONS } from '../../config/notificationConfig';
import './AlertMessage.css';

/**
 * Responsive alert message with success, error, warning and info variants.
 * Supports an optional title, a dismiss button, auto-close and animated
 * enter/exit transitions, and exposes the variant to assistive technology.
 *
 * @param {Object} props
 * @param {string} props.type - Alert variant (success, error, warning, info)
 * @param {string} props.message - Message text
 * @param {boolean} props.dismissible - Whether the alert shows a dismiss button
 * @param {Function} props.onClose - Called after the alert closes
 * @param {string} props.title - Optional title
 * @param {number} props.autoCloseMs - Auto-close delay in milliseconds (0 disables it)
 * @param {boolean} props.showIcon - Whether to show the variant icon
 */
const AlertMessage = ({
  type = 'info',
  message,
  dismissible = true,
  onClose,
  title,
  children,
  autoCloseMs = 0, // 0 disables auto-close (NotificationContext normally handles it)
  showIcon = true
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback((event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!isExiting) {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose && onClose();
      }, ANIMATION_DURATIONS.EXIT);
    }
  }, [onClose, isExiting]);

  useEffect(() => {
    if (autoCloseMs > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseMs);

      return () => clearTimeout(timer);
    }
  }, [handleClose, autoCloseMs]);

  if (!message && !children) return null;
  if (!isVisible) return null;

  const typeConfig = {
    success: {
      bgColor: colors.notifications.success.background,
      borderColor: colors.notifications.success.border,
      textColor: colors.notifications.success.text,
      titleColor: colors.notifications.success.text,
      iconColor: colors.notifications.success.text,
      IconComponent: SuccessIcon,
      ariaLabel: 'Success message'
    },
    error: {
      bgColor: colors.notifications.error.background,
      borderColor: colors.notifications.error.border,
      textColor: colors.notifications.error.text,
      titleColor: colors.notifications.error.text,
      iconColor: colors.notifications.error.text,
      IconComponent: ErrorIcon,
      ariaLabel: 'Error message'
    },
    warning: {
      bgColor: colors.notifications.warning.background,
      borderColor: colors.notifications.warning.border,
      textColor: colors.notifications.warning.text,
      titleColor: colors.notifications.warning.text,
      iconColor: colors.notifications.warning.text,
      IconComponent: WarningIcon,
      ariaLabel: 'Warning message'
    },
    info: {
      bgColor: colors.notifications.info.background,
      borderColor: colors.notifications.info.border,
      textColor: colors.notifications.info.text,
      titleColor: colors.notifications.info.text,
      iconColor: colors.notifications.info.text,
      IconComponent: InfoIcon,
      ariaLabel: 'Information message'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const { IconComponent } = config;

  return (
    <div 
      className={`
        alert-container flex items-start p-3 sm:p-4 rounded-lg border mb-4 shadow-lg
        transition-all duration-500 ease-in-out
        ${isExiting ? 'opacity-0 transform translate-x-full scale-95' : 'opacity-100 transform translate-x-0 scale-100'}
        relative w-full max-w-full text-sm
        overflow-hidden mx-auto
        backdrop-blur-sm
      `}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.textColor
      }}
      role="alert"
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      {showIcon && (
        <div 
          className="mr-2 sm:mr-3 mt-0.5 flex-shrink-0" 
          style={{ color: config.iconColor }}
          aria-hidden="true"
        >
          <IconComponent size="md" />
        </div>
      )}
      
      <div className="flex-1 min-w-0 overflow-hidden">
        {title && (
          <div 
            className="alert-title font-semibold mb-1 text-sm sm:text-base"
            style={{ color: config.titleColor }}
          >
            {title}
          </div>
        )}
        
        <div 
          className="alert-text-wrapper leading-5"
          style={{ color: config.textColor }}
        >
          {message || children}
        </div>
      </div>
      
      {dismissible && (
        <button
          type="button"
          onClick={handleClose}
          className={`
            ml-1 sm:ml-2 flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 
            flex items-center justify-center
            rounded-full transition-all duration-200
            hover:bg-black/10 dark:hover:bg-white/20
            hover:scale-110 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current
            focus:ring-offset-transparent
          `}
          style={{ color: config.iconColor }}
          aria-label="Dismiss message"
          title="Close"
        >
          <span className="text-lg sm:text-xl font-bold leading-none">×</span>
        </button>
      )}
    </div>
  );
};

export default AlertMessage;