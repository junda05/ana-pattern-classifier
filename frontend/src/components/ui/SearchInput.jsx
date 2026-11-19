import React, { useId } from 'react';
import { colors } from '../../config/colors';

/**
 * Reusable text input for search forms and filters.
 * Pass `label` for a visible label, or `ariaLabel` when the context makes a visible one redundant.
 * `error` marks the field invalid and shows the message under it, linked as its description.
 */
const SearchInput = ({ 
  id,
  name,
  label,
  placeholder = '',
  value,
  onChange,
  type = 'text',
  disabled = false,
  className = '',
  ariaLabel,
  error
}) => {
  // Every field gets a programmatic name: the visible label when there is one, else `ariaLabel`.
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={fieldId} 
          className="block text-sm text-gray-600 mb-1"
        >
          {label}
        </label>
      )}
      <input
        type={type}
        id={fieldId}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full border rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:border-transparent ${error ? 'border-red-500' : 'border-gray-300'}`}
        style={{ 
          '--tw-ring-color': colors.primary.red 
        }}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default SearchInput;
