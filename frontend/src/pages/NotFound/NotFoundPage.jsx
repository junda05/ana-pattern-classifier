import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

/**
 * Shown for unknown URLs. "Back to Home" goes to the root route, which sends
 * signed-in users to the dashboard and everyone else to the login page.
 */
const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Decorative elements */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-brand-red/10 rounded-full animate-pulse"></div>
          </div>
          <div className="relative">
            <h1 className="text-8xl font-bold text-brand-red mb-2 animate-bounce">404</h1>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Page Not Found
            </h2>
            <p className="text-brand-gray text-lg">
              The page you are looking for does not exist or has been moved.
            </p>
          </div>

          {/* Illustration */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <svg className="w-24 h-24 text-brand-red/20" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-red rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Action button */}
          <div className="space-y-4">
            <Button
              onClick={() => navigate('/')}
              variant="primary"
              size="medium"
              className="w-auto"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Button>

            <p className="text-sm text-gray-500">
              Or use the main menu to find what you need.
            </p>
          </div>
        </div>

        {/* Footer decoration */}
        <div className="mt-12 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-brand-red rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-brand-red rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-brand-red rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;