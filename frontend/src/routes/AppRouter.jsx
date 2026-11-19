import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/login/LoginPage';
import ResetPasswordPage from '../pages/ResetPassword/ResetPasswordPage';
import DashboardLayout from '../components/layout/DashboardLayout';
import DashboardHome from '../pages/Dashboard/DashboardHome';
import DashboardAnalysis from '../pages/Dashboard/DashboardAnalysis';
import DashboardReports from '../pages/Dashboard/DashboardReports';
import DashboardTraceability from '../pages/Dashboard/DashboardTraceability';
import DashboardAnalytics from '../pages/Dashboard/DashboardAnalytics';
import DashboardUserManagement from '../pages/Dashboard/DashboardUserManagement';
import NotFoundPage from '../pages/NotFound/NotFoundPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProtectedRoute from './auth/ProtectedRoute';
import useAuth from '../hooks/useAuth';

// Pages only administrators may open (the API enforces the same roles)
const ADMIN_ONLY = ['ADMIN'];

/**
 * Root route: sends authenticated users to the dashboard and everyone else to the login page.
 */
const HomeRedirect = () => {
  const { isAuthenticated, initializing } = useAuth();
  
  // Wait for the stored session to load before redirecting, to avoid a flash of the login page.
  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen" role="status">
        <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
        <span className="ml-3 text-gray-600">Loading…</span>
      </div>
    );
  }
  
  return <Navigate to={isAuthenticated ? '/dashboard/home' : '/login'} replace />;
};

const AppRouter = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* Dashboard routes require authentication */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/home" replace />} />
          <Route path="home" element={<DashboardHome />} />
          <Route path="analysis" element={<DashboardAnalysis />} />
          <Route path="reports" element={<DashboardReports />} />
          <Route
            path="audit-trail"
            element={<ProtectedRoute roles={ADMIN_ONLY}><DashboardTraceability /></ProtectedRoute>}
          />
          <Route
            path="analytics"
            element={<ProtectedRoute roles={ADMIN_ONLY}><DashboardAnalytics /></ProtectedRoute>}
          />
          <Route
            path="users"
            element={<ProtectedRoute roles={ADMIN_ONLY}><DashboardUserManagement /></ProtectedRoute>}
          />
        </Route>
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;
