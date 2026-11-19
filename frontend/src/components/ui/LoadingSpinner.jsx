import React from 'react';

/**
 * Shared loading indicator used across the app.
 * "circle" is the page-level spinner; "dots" (default) is the SVG spinner used inside buttons.
 *
 * Accessibility: rendered inside a `role="status"` region with visually hidden text
 * (`label`, default "Loading…"). Pass `label={null}` when the caller already shows the
 * text in its own status region (or inside a button); the spinner is then decorative.
 */
const LoadingSpinner = ({
  size = 'md',
  color = 'white',
  type = 'dots',
  className = '',
  label = 'Loading…'
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const marginClasses = {
    sm: '-ml-1 mr-2',
    md: '-ml-1 mr-3',
    lg: '-ml-1 mr-4',
    xl: '-ml-2 mr-4'
  };

  const withStatus = (visual) => {
    if (label === null) return visual;
    return (
      <span role="status" className="inline-flex">
        {visual}
        <span className="sr-only">{label}</span>
      </span>
    );
  };

  if (type === 'circle') {
    const borderColor = color === 'white' ? 'border-white' : 'border-brand-red';

    return withStatus(
      <span
        aria-hidden="true"
        className={`inline-block animate-spin rounded-full border-b-2 ${borderColor} ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return withStatus(
    <svg
      aria-hidden="true"
      className={`animate-spin ${sizeClasses[size]} ${marginClasses[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export default LoadingSpinner;
