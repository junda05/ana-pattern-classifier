import React from 'react';
import Logo from '../ui/Logo';

/**
 * Login form header: product monogram and welcome headings.
 */
const LoginHeader = () => {
  return (
    <>
      {/* Product monogram in the top-left corner */}
      <div className="absolute top-6 left-6">
        <Logo size="small" showName={false} decorative />
      </div>
      
      {/* Welcome headings */}
      <div className="max-w-sm w-full pl-8 ml-20 mt-12">
        <h1 className="mb-1 text-5xl md:text-5xl text-3xl text-brand-gray font-bold text-justify">
          Welcome to
        </h1>
        <h2 className="text-5xl md:text-5xl text-4xl text-brand-red font-bold mb-6 text-left">
          ANA Pattern Classifier
        </h2>
        <p className="text-ink-secondary text-lg md:text-[1rem] text-base mb-10 font-semibold leading-relaxed text-left">
          Sign in to your account to continue.
        </p>
      </div>
    </>
  );
};

export default LoginHeader;
