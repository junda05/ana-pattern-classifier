import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import BrandingSection from '../../components/layout/BrandingSection';
import LoginHeader from '../../components/common/LoginHeader';
import LoginForm from '../../components/common/LoginForm';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const DEFAULT_LANDING_PAGE = '/dashboard/home';

/**
 * Path to return to after login: the page ProtectedRoute redirected from, if any.
 *
 * @param {Object} from - Location saved by ProtectedRoute
 * @returns {string} Path with its query string and hash
 */
const returnPathFrom = (from) => {
  if (!from?.pathname || from.pathname === '/login') {
    return DEFAULT_LANDING_PAGE;
  }
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
};

/**
 * Login page.
 * - Already authenticated users go back to the page they originally requested
 *   (ProtectedRoute's `state.from`), or to Home.
 * - A message passed by the previous page (`state.message`, e.g. after a
 *   password reset) is shown once and then removed from the history state.
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, initializing } = useAuth();
  const [flashMessage] = useState(() => location.state?.message || null);

  // Drop the message from the history entry so a refresh does not show it again.
  useEffect(() => {
    if (location.state?.message) {
      const { message, ...rest } = location.state;
      navigate(location.pathname, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!initializing && isAuthenticated) {
      const from = location.state?.from;
      navigate(returnPathFrom(from), { replace: true, state: from?.state });
    }
  }, [isAuthenticated, initializing, navigate, location.state]);

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen" role="status">
        <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
        <span className="ml-3 text-gray-600">Loading…</span>
      </div>
    );
  }

  // The effect above handles the redirect; render nothing meanwhile.
  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthLayout brandingContent={<BrandingSection />}>
      <LoginHeader />
      {flashMessage && (
        <div className="max-w-sm w-full pl-8 ml-20 mb-6">
          <p
            role="status"
            className="p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-800"
          >
            {flashMessage}
          </p>
        </div>
      )}
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
