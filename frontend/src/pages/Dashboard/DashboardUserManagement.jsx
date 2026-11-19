import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { colors } from '../../config/colors';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import SearchSelect from '../../components/ui/SearchSelect';
import UsersTable from '../../components/users/UsersTable';
import UserFormModal from '../../components/users/UserFormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import InlineError from '../../components/ui/InlineError';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useNotifications from '../../hooks/useNotifications';
import { UserPlus } from 'lucide-react';
import usersService from '../../services/api/usersService';
import { USER_ROLES } from '../../services/utils/constants';
import { pluralize } from '../../services/utils/stringUtils';

/**
 * Maps a user list item from the API to the table row shape.
 * The role stays a code ('ADMIN' | 'STANDARD'); labels are applied for display only.
 */
const toUserRow = (user) => ({
  id: user.userId,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
  lastLogin: user.lastLogin || null,
});

/**
 * User Management page: administrators create, edit and deactivate user accounts.
 */
const DashboardUserManagement = () => {
  const { showSuccess, showInfo, showError } = useNotifications();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await usersService.listUsers(1, 100);
      const rows = response.data.map(toUserRow);
      setUsers(rows);
      setTotalUsers(response.total ?? rows.length);
    } catch (error) {
      setUsers([]);
      setLoadError(error.message || 'Could not load the user list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    return users.filter(user => {
      const matchesSearch = searchLower === '' ||
        user.fullName?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower);

      const matchesRole = !roleFilter || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUser = async (user) => {
    try {
      setLoadingModal(true);
      // The list row lacks some fields (e.g. the professional license number), so fetch the full user
      const fullUser = await usersService.getUser(user.id);

      setSelectedUser({
        id: fullUser.userId,
        fullName: fullUser.fullName,
        username: fullUser.username,
        email: fullUser.email,
        professionalCard: fullUser.professionalCard || '',
        role: fullUser.role,
        isActive: fullUser.isActive !== false,
        dateJoined: fullUser.dateJoined,
      });
      setIsUserModalOpen(true);
    } catch (error) {
      showError(error.message || 'Could not load the user details.');
    } finally {
      setLoadingModal(false);
    }
  };

  const handleSaveUser = async (userData) => {
    // The modal has already validated and saved the user; just refresh the list.
    await loadUsers();
    showSuccess(userData.id ? 'User updated successfully.' : 'User created successfully.');
  };

  const handleConfirmDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await usersService.deleteUser(userToDeactivate.id);
      setUserToDeactivate(null);
      await loadUsers();
      showSuccess('User deactivated successfully.');
    } catch (error) {
      showError(error.message || 'Could not deactivate the user.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const closeDeactivateDialog = useCallback(() => setUserToDeactivate(null), []);

  const handleClearFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    showInfo('Filters cleared.');
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: colors.primary.red }}
        >
          User Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage user accounts and their roles.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SearchInput
              id="searchTerm"
              name="searchTerm"
              label="Search"
              placeholder="Search by name, username or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:col-span-2"
            />

            <SearchSelect
              id="roleFilter"
              name="roleFilter"
              label="Filter by Role"
              placeholder="All Roles"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={USER_ROLES}
            />
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t" style={{ borderColor: colors.border.light }}>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              {!loading && !loadError && `Showing ${filteredUsers.length} of ${pluralize(totalUsers, 'user')}`}
            </div>

            <div className="flex gap-3">
              {(searchTerm || roleFilter) && (
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}

              <Button
                variant="primary"
                size="medium"
                onClick={handleCreateUser}
              >
                <UserPlus size={18} className="mr-2" />
                New User
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64" role="status">
            <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
            <p className="mt-4 text-gray-600">Loading users…</p>
          </div>
        ) : loadError ? (
          <InlineError message={loadError} onRetry={loadUsers} />
        ) : (
          <UsersTable
            users={filteredUsers}
            onEdit={handleEditUser}
            onDelete={setUserToDeactivate}
            editLoading={loadingModal}
          />
        )}
      </div>

      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={selectedUser}
        onSave={handleSaveUser}
      />

      <ConfirmDialog
        isOpen={!!userToDeactivate}
        title="Deactivate User?"
        confirmLabel="Deactivate User"
        destructive
        loading={isDeactivating}
        onConfirm={handleConfirmDeactivate}
        onCancel={closeDeactivateDialog}
      >
        <p className="mb-2">
          You are about to deactivate <strong>{userToDeactivate?.fullName}</strong>.
        </p>
        <p style={{ color: colors.text.secondary }}>
          The user will lose access immediately. Their records are kept, but they will no longer be able to log in.
        </p>
      </ConfirmDialog>
    </div>
  );
};

export default DashboardUserManagement;
