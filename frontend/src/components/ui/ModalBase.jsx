import React, { useId, useRef } from 'react';
import { colors } from '../../config/colors';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Base modal shared by every dialog in the app: header (icon, title, subtitle),
 * scrollable body and optional footer.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, named by the title and described by
 * the subtitle; focus moves inside on open (to the `data-autofocus` element if any),
 * Tab is trapped, Escape closes (only the topmost dialog) and focus returns to the
 * opener on close. Mark the preferred first field with `data-autofocus` rather than
 * `autoFocus`.
 */
const ModalBase = ({ 
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth = 'max-w-3xl',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ariaLabel,
}) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const subtitleId = useId();
  useFocusTrap(dialogRef, isOpen, closeOnEscape ? onClose : undefined);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col focus:outline-none`}
        style={{ 
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        {(title || Icon) && (
          <div 
            className="relative px-8 py-6 border-b flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${colors.primary.red}08 0%, ${colors.primary.redLight}05 100%)`,
              borderColor: colors.border.light
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div 
                    className="p-3 rounded-xl flex-shrink-0"
                    style={{ 
                      backgroundColor: `${colors.primary.red}15`,
                    }}
                  >
                    <Icon size={28} style={{ color: colors.primary.red }} />
                  </div>
                )}
                <div>
                  {title && (
                    <h2 
                      id={titleId}
                      className="text-2xl font-semibold mb-1"
                      style={{ color: colors.text.dark }}
                    >
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p 
                      id={subtitleId}
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                  style={{ color: colors.text.secondary }}
                  aria-label="Close dialog"
                >
                  <X size={24} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="px-8 py-5 border-t flex-shrink-0"
            style={{ 
              backgroundColor: colors.background.lightGray,
              borderColor: colors.border.light 
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default ModalBase;
