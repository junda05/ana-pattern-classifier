import React from 'react';

/**
 * Reusable empty state for tables and lists (the shared "no results" UI).
 */
const EmptyState = ({ 
  icon, 
  title, 
  description,
  message, // Plain message, used when neither title nor description is given
  className = '' 
}) => {
  // Default icon: an empty document
  const defaultIcon = (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className="h-12 w-12 mx-auto mb-4 text-gray-400" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <div className={`py-8 text-center text-gray-500 ${className}`}>
      {icon || defaultIcon}
      {title && <h4 className="text-lg font-medium text-gray-700 mb-2">{title}</h4>}
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {message && !title && !description && (
        <p className="text-sm text-gray-500">{message}</p>
      )}
    </div>
  );
};

export default EmptyState;