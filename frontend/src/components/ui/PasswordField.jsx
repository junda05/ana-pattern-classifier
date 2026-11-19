import React, { useId, useState, forwardRef } from 'react';
import { customClasses, colors } from '../../config/colors';
import { Icon } from '../Icons/icons';

/**
 * Password input with a built-in show/hide toggle, styled like InputField.
 */
const PasswordField = forwardRef(({
  id,
  placeholder,
  label,
  required = false,
  className = '',
  error,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  
  const hasError = error && error.trim() !== '';
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="form-group relative">
      <input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        id={fieldId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={`form-input ${customClasses.input} pr-12 ${hasError ? 'border-red-500 focus:border-red-500' : ''} ${className}`}
        style={{ paddingRight: '3rem' }}
        placeholder={placeholder}
        required={required}
        {...props}
      />
      <label htmlFor={fieldId} className="form-label">
        {label}
      </label>
      
      {/* Show/hide password toggle */}
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 p-1 rounded transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
        style={{
          color: colors.primary.red,
          zIndex: 10,
          top: '1rem',
          transform: 'translateY(0)'
        }}
        onMouseEnter={(e) => {
          e.target.style.color = colors.primary.redLight;
        }}
        onMouseLeave={(e) => {
          e.target.style.color = colors.primary.red;
        }}
        aria-label="Show password"
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <Icon name="eyeOff" size="md" />
        ) : (
          <Icon name="eye" size="md" />
        )}
      </button>
      
      {/* Always reserve space for the error so the layout does not shift */}
      <div className="mt-1">
        {hasError && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

PasswordField.displayName = 'PasswordField';

export default PasswordField;
