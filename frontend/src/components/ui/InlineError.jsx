import React from 'react';
import Button from './Button';

/**
 * Inline error state for a screen or section that failed to load, with an
 * optional retry action (so a failed request is never mistaken for "no data").
 *
 * @param {string} message - What failed, e.g. "Could not load results."
 * @param {Function} [onRetry] - Retries the failed request
 * @param {string} [retryLabel] - Label of the retry button
 */
const InlineError = ({ message, onRetry, retryLabel = 'Try Again', className = '' }) => (
  <div
    role="alert"
    className={`flex items-center justify-between gap-4 p-4 rounded-lg border border-red-200 bg-red-50 ${className}`}
  >
    <p className="text-sm text-red-800">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="small" onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  </div>
);

export default InlineError;
