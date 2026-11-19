import React, { useId } from 'react';
import { colors } from '../../config/colors';

/**
 * Reusable select for search forms and filters.
 */
const SearchSelect = ({ 
  id,
  name,
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  ariaLabel
}) => {
  // Every field gets a programmatic name: the visible label when there is one, else `ariaLabel`.
  const generatedId = useId();
  const fieldId = id || generatedId;

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
      <select
        id={fieldId}
        aria-label={label ? undefined : ariaLabel}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-md py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent appearance-none cursor-pointer transition-all duration-200"
        style={{
          '--tw-ring-color': colors.primary.red,
          color: colors.text.primary,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${encodeURIComponent(colors.primary.red)}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.5rem center',
          backgroundSize: '1.5em 1.5em'
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option, index) => (
          <option
            key={index}
            value={typeof option === 'string' ? option : option.value}
          >
            {typeof option === 'string' ? option : option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SearchSelect;
