import React from 'react';
import Logo from '../ui/Logo';

/**
 * Branding panel shown on the right-hand side of the authentication pages.
 */
const BrandingSection = () => {
  return (
    <div className="flex flex-col justify-center items-center h-full text-center">
      <Logo size="large" tone="inverse" className="max-w-full h-auto" />
      <p className="mt-6 text-white text-sm md:text-lg font-semibold tracking-wide opacity-90">
        AI-assisted HEp-2 IIF pattern classification
      </p>
    </div>
  );
};

export default BrandingSection;
