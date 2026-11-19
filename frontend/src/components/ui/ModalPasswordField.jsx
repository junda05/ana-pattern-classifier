import React, { useId, useState } from 'react';
import { colors } from '../../config/colors';

/**
 * Password input for modals, with a show/hide toggle and an inline validation message.
 */
const ModalPasswordField = ({ 
  icon: Icon, 
  label, 
  error,
  className = '',
  ...props 
}) => {
  const [showPassword, setShowPassword] = useState(false);
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
          type={showPassword ? 'text' : 'password'}
          className={`
            w-full ${Icon ? 'pl-10' : 'pl-4'} pr-10 py-2.5 rounded-lg border transition-all duration-200
            text-sm placeholder-gray-400
            focus:outline-none focus:ring-2 focus:border-transparent
            ${hasError
              ? 'border-red-300'
              : 'border-gray-300'
            }
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
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
          aria-label="Show password"
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {hasError && (
        <p id={errorId} className="text-xs text-red-600 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default ModalPasswordField;
