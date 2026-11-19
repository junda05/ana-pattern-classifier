import React from 'react';
import { customClasses } from '../../config/colors';
import LoadingSpinner from './LoadingSpinner';

/**
 * Reusable button with variants and sizes, keeping the ANA Pattern Classifier look consistent.
 */
const Button = ({ 
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  width = 'auto',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center border-0 font-medium cursor-pointer transition-all duration-200 ease-in-out tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-opacity-50 min-h-[2.5rem] whitespace-nowrap overflow-hidden';
  
  // The compact "table" size uses its own, flatter variant styles.
  const getVariantClasses = (variant, size) => {
    if (size === 'table') {
      return {
        primary: 'bg-brand-red text-white hover:bg-brand-red-hover rounded-md transition-colors',
        secondary: 'border border-brand-red bg-white text-brand-red hover:bg-brand-red hover:text-white rounded-md transition-colors',
        verified: 'bg-emerald-600 text-white hover:bg-emerald-700 rounded-md transition-colors',
      }[variant] || 'bg-brand-red text-white hover:bg-brand-red-hover rounded-md transition-colors';
    }

    // Disabled secondary buttons show the filled (hover) style, dimmed by the disabled opacity.
    if (variant === 'secondary' && (disabled || loading)) {
      return 'bg-brand-red text-white border-brand-red rounded-lg';
    }

    return {
      primary: 'bg-brand-red text-white hover:bg-brand-red-hover hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-xl rounded-lg',
      secondary: customClasses.button.secondary + ' rounded-lg',
      verified: 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-xl rounded-lg',
    }[variant] || 'bg-brand-red text-white hover:bg-brand-red-hover hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-xl rounded-lg';
  };
  
  const sizeClasses = {
    small: 'py-1 px-3 text-xs',
    medium: 'py-2 px-8 text-base',
    large: 'py-3 px-12 text-lg',
    table: 'py-1 px-3 text-xs rounded-md transition-colors',
  };
  
  const widthClasses = {
    auto: 'w-auto',
    full: 'w-full',
    '3/5': 'w-3/5',
    '1/2': 'w-1/2',
    '2/3': 'w-2/3',
  };
  
  const disabledClasses = (disabled || loading)
    ? 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none'
    : '';

  const variantClass = getVariantClasses(variant, size);
  const baseClass = size === 'table' ? 'inline-flex items-center justify-center font-medium cursor-pointer tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-opacity-50 whitespace-nowrap overflow-hidden' : baseClasses;

  const buttonClasses = `
    ${baseClass}
    ${variantClass}
    ${sizeClasses[size]}
    ${widthClasses[width]}
    ${disabledClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      <div className="flex items-center justify-center min-w-full">
        {loading ? (
          <div className="flex items-center justify-center">
            <LoadingSpinner 
              size={size === 'small' ? 'sm' : 'md'} 
              color="white" 
              label={null}
            />
            <span className="sr-only">Loading…</span>
          </div>
        ) : (
          children
        )}
      </div>
    </button>
  );
};

export default Button;
