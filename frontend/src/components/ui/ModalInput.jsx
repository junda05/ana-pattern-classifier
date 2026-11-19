import React, { useId } from 'react';
import { colors } from '../../config/colors';

/**
 * Reusable input for forms and modals, with an optional leading icon
 * and an inline validation message. Supports every HTML input type.
 */
const ModalInput = ({ 
  icon: Icon, 
  label, 
  error, 
  type = 'text',
  className = '',
  ...props 
}) => {
  const hasError = error && error.trim() !== '';
  const generatedId = useId();
  const fieldId = props.id || generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium" style={{ color: colors.text.primary }}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon size={18} style={{ color: hasError ? colors.state.error : colors.text.secondary }} />
          </div>
        )}
        <input
          type={type}
          className={`
            w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 rounded-lg border transition-all duration-200
            text-sm placeholder-gray-400
            focus:outline-none focus:ring-2 focus:border-transparent
            ${hasError
              ? 'border-red-300'
              : 'border-gray-300'
            }
            ${props.disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
          `}
          style={{
            color: colors.text.primary,
            '--tw-ring-color': hasError ? colors.state.error : colors.primary.red
          }}
          {...props}
          id={fieldId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
        />
      </div>
      {hasError && (
        <p id={errorId} className="text-xs text-red-600 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default ModalInput;
