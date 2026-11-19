import React, { forwardRef, useId } from 'react';
import { customClasses } from '../../config/colors';
import logger from '../../services/utils/logger';

/**
 * Text input with a floating label in the ANA Pattern Classifier style.
 */
const InputField = forwardRef(({
  id,
  type = 'text',
  placeholder,
  label,
  required = false,
  className = '',
  error,
  children, // catch children if passed
  ...props
}, ref) => {
  if (children) {
    logger.warn('InputField does not support children. Any children passed will be ignored.');
  }

  const hasError = error && error.trim() !== '';
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="form-group">
      <input
        ref={ref}
        type={type}
        id={fieldId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={`form-input ${customClasses.input} ${hasError ? 'border-red-500 focus:border-red-500' : ''} ${className}`}
        placeholder={placeholder}
        required={required}
        {...props}
      />
      <label htmlFor={fieldId} className="form-label">
        {label}
      </label>
      {/* Always reserve space for the error so the layout does not shift */}
      <div className="mt-1 h-1">
        {hasError && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;
