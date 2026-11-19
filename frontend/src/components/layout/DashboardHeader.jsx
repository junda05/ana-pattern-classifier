import React from 'react';
import Logo from '../ui/Logo';

const DashboardHeader = () => {
  return (
    <div className="absolute top-4 right-6 z-20">
      <Logo size="small" />
    </div>
  );
};

export default DashboardHeader;
