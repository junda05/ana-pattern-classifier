import React, { useId } from 'react';
import { colors } from '../../config/colors';

/**
 * Reusable select for forms and modals, with an optional leading icon,
 * a custom dropdown arrow and an inline validation message.
 * Options may be strings or `{ value, label }` objects.
 */
const ModalSelect = ({ 
  icon: Icon, 
  label, 
  error, 
  options = [],
  placeholder = 'Select an option',
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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Icon size={18} style={{ color: hasError ? colors.state.error : colors.text.secondary }} />
          </div>
        )}
        <select
          className={`
            w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 rounded-lg border transition-all duration-200
            text-sm appearance-none cursor-pointer
            focus:outline-none focus:ring-2 focus:border-transparent
            ${hasError
              ? 'border-red-300'
              : 'border-gray-300'
            }
            ${props.disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
          `}
          style={{
            color: colors.text.primary,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${encodeURIComponent(hasError ? colors.state.error : colors.primary.red)}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.5em 1.5em',
            '--tw-ring-color': hasError ? colors.state.error : colors.primary.red
          }}
          {...props}
          id={fieldId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option 
              key={typeof option === 'string' ? option : option.value} 
              value={typeof option === 'string' ? option : option.value}
            >
              {typeof option === 'string' ? option : option.label}
            </option>
          ))}
        </select>
      </div>
      {hasError && (
        <p id={errorId} className="text-xs text-red-600 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default ModalSelect;
