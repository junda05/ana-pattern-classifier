import React from 'react';
import { customClasses } from '../../config/colors';

/**
 * Two-column layout for the authentication pages: form on the left, branding on the right.
 */
const AuthLayout = ({ children, brandingContent }) => {
  return (
    <div className="font-sans h-screen overflow-hidden relative">
      <div className={customClasses.container.main}>
        {/* Left column: form */}
        <div className={customClasses.container.form}>
          {children}
        </div>
        
        {/* Right column: branding */}
        <div className={customClasses.container.brand}>
          {brandingContent}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
