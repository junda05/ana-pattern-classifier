import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ForbiddenPage from '../../pages/Forbidden/ForbiddenPage';

/**
 * Redirects unauthenticated users to the login page, remembering where they came from.
 * When `roles` is given, signed-in users whose role is not listed see the forbidden page.
 * (The API enforces the same roles; this only keeps the UI from dead-ending on a 403.)
 *
 * @param {string[]} [roles] - Role codes allowed to open the page (e.g. ['ADMIN'])
 */
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, initializing, user } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen" role="status">
        <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
        <span className="ml-3 text-gray-600">Verifying session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <ForbiddenPage />;
  }

  return children;
};

export default ProtectedRoute;
