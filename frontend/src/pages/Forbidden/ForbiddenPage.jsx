import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from '../../components/ui/Button';

/**
 * Shown inside the dashboard when the signed-in user's role cannot open the requested page.
 */
const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <ShieldAlert size={48} className="text-brand-red mb-4" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-8">You don't have access to this page.</p>
      <Button variant="primary" onClick={() => navigate('/dashboard/home')}>
        Back to Home
      </Button>
    </div>
  );
};

export default ForbiddenPage;
