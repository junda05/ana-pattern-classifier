import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { colors, shadows } from '../../config/colors';
import { Icon } from '../Icons/icons';
import useAuth from '../../hooks/useAuth';
import { useNavigationGuard } from '../../context/NavigationGuardContext';

/**
 * Dashboard menu. Menu links and Log Out ask for confirmation first while a page
 * holds unsaved work (see NavigationGuardContext).
 */
const DashboardSidebar = ({ collapsed, onToggle, collapseButtonRef }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { confirmLeave, hasUnsavedWork } = useNavigationGuard();

  const allMenuItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/dashboard/home',
      icon: <Icon name="home" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN', 'STANDARD'] // Visible to all roles
    },
    {
      id: 'analysis',
      label: 'ANA Analysis',
      path: '/dashboard/analysis',
      icon: <Icon name="ana" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN', 'STANDARD'] // Visible to all roles
    },
    {
      id: 'reports',
      label: 'Reports',
      path: '/dashboard/reports',
      icon: <Icon name="reports" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN', 'STANDARD'] // Visible to all roles
    },
    {
      id: 'audit-trail',
      label: 'Audit Trail',
      path: '/dashboard/audit-trail',
      icon: <Icon name="auditTrail" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN'] // Admin only
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: '/dashboard/analytics',
      icon: <Icon name="reports" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN'] // Admin only
    },
    {
      id: 'users',
      label: 'User Management',
      path: '/dashboard/users',
      icon: <Icon name="users" size="md" className="text-gray-600" aria-hidden="true" />,
      allowedRoles: ['ADMIN'] // Admin only
    }
  ];

  // Filter the menu by the user's role
  const menuItems = allMenuItems.filter(item => {
    const userRole = user?.role;
    return item.allowedRoles.includes(userRole);
  });

  const logoutAndLeave = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      navigate('/login');
    }
  };

  const handleLogout = () => confirmLeave(logoutAndLeave);

  // A plain click on a link that leaves the current page asks first when there is unsaved work
  // (a link to the current page with no navigation state leaves nothing behind)
  const handleMenuClick = (event, path) => {
    const modified = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const staysOnPage = path === location.pathname && !location.state;
    if (modified || staysOnPage || !hasUnsavedWork()) return;
    event.preventDefault();
    confirmLeave(() => navigate(path));
  };

  const itemClasses = (isActive) =>
    `p-3 rounded-lg flex items-center mb-2 menu-item-transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 ${
      isActive ? 'bg-brand-red/10 border-l-4 border-brand-red active' : 'hover:bg-red-50'
    }`;

  return (
    <aside
      id="dashboard-sidebar"
      className={`fixed left-0 top-0 h-screen bg-white shadow-lg sidebar-transition z-40 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-[280px]'
      }`}
      style={{
        transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: shadows.sidebar
      }}
      // A collapsed sidebar is off-screen: keep its links out of the tab order and the accessibility tree
      inert={collapsed}
      aria-hidden={collapsed || undefined}
    >
      <div className="p-4">
        {/* Current user */}
        <div className="flex items-center justify-between mb-4 mt-4">
          <div className="flex items-center">
            <div
              className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center"
              style={{ color: colors.primary.red }}
            >
              <Icon name="user" size="lg" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-800 text-left">
                {user?.fullName || user?.username || 'User'}
              </p>
              {user?.email && (
                <p className="text-xs text-gray-500 text-left">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <button
            ref={collapseButtonRef}
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            aria-controls="dashboard-sidebar"
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
          >
            <Icon name="chevronLeft" size="lg" className="text-gray-600" aria-hidden="true" />
          </button>
        </div>

        {/* Red divider */}
        <div
          className="h-px my-4"
          style={{ backgroundColor: colors.primary.red }}
        ></div>

        {/* Menu */}
        <nav aria-label="Main" className="mt-4">
          <ul>
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end
                  onClick={(event) => handleMenuClick(event, item.path)}
                  className={({ isActive }) => itemClasses(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      {item.icon}
                      <span
                        className={`ml-3 ${isActive ? 'font-semibold' : ''}`}
                        style={{ color: isActive ? colors.primary.redHover : colors.text.muted }}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Log out */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-3 rounded-lg flex items-center menu-item-transition hover:bg-red-50 absolute bottom-4 left-4 right-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
        >
          <Icon name="logout" size="md" className="text-gray-600" aria-hidden="true" />
          <span className="ml-3 text-gray-600">Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
