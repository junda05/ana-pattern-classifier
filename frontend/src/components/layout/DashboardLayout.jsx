import React, { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import DashboardFooter from './DashboardFooter';
import { Icon } from '../Icons/icons';
import { NavigationGuardProvider } from '../../context/NavigationGuardContext';

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const collapseButtonRef = useRef(null);
  const expandButtonRef = useRef(null);
  const toggledRef = useRef(false);

  const toggleSidebar = () => {
    toggledRef.current = true;
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // The toggle that was pressed disappears (or becomes inert): move focus to its counterpart
  useEffect(() => {
    if (!toggledRef.current) return;
    toggledRef.current = false;
    (sidebarCollapsed ? expandButtonRef : collapseButtonRef).current?.focus();
  }, [sidebarCollapsed]);

  return (
    <NavigationGuardProvider>
      <div 
        className="min-h-screen bg-surface-app"
        style={{ 
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}
      >
        <DashboardHeader />
      
        <div className="flex">
          <DashboardSidebar 
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            collapseButtonRef={collapseButtonRef}
          />
        
          {/* Reopens the sidebar while it is collapsed */}
          {sidebarCollapsed && (
            <button
              ref={expandButtonRef}
              type="button"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              aria-expanded="false"
              aria-controls="dashboard-sidebar"
              className="fixed left-5 top-5 z-50 bg-white rounded-full shadow-lg w-10 h-10 flex items-center justify-center transition-all duration-300 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
            >
              <Icon name="chevronRight" size="lg" className="text-gray-600" aria-hidden="true" />
            </button>
          )}
        
          {/* Main content */}
          <main 
            className="flex-1 dashboard-transition"
            style={{ marginLeft: sidebarCollapsed ? '0' : '280px' }}
          >
            <div className="p-8">
              <Outlet />
            </div>
            <DashboardFooter />
          </main>
        </div>
      </div>
    </NavigationGuardProvider>
  );
};

export default DashboardLayout;
