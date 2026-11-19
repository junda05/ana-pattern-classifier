import React, { useState } from 'react';
import { colors } from '../../config/colors';
import { Edit, UserX, User } from 'lucide-react';
import Badge from '../ui/Badge';
import RoleBadge from '../ui/RoleBadge';
import { formatDate } from '../../services/utils/dateUtils';

/**
 * System users table: each user's details plus the edit and deactivate actions.
 * Rows carry role codes and the isActive flag; labels are applied here for display.
 */
const UsersTable = ({ users, onEdit, onDelete, editLoading = false }) => {
  // Row whose Edit button was clicked last; shows the loading label while editLoading is true.
  const [editingUserId, setEditingUserId] = useState(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 table-fixed">
        <thead style={{ backgroundColor: colors.overlay.light }}>
          <tr>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700" style={{ width: '24%' }}>
              User
            </th>
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700" style={{ width: '26%' }}>
              Email
            </th>
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700" style={{ width: '14%' }}>
              Role
            </th>
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700" style={{ width: '12%' }}>
              Status
            </th>
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700" style={{ width: '16%' }}>
              Last Login
            </th>
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700" style={{ width: '8%' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-3">
                <div className="text-sm font-medium truncate" style={{ color: colors.text.dark }}>
                  {user.fullName}
                </div>
                <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.secondary }}>
                  <User size={12} style={{ color: colors.text.secondary }} aria-hidden="true" />
                  <span className="truncate">{user.username}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <div className="text-sm truncate" style={{ color: colors.text.primary }}>
                  {user.email}
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <RoleBadge role={user.role} />
              </td>
              <td className="px-3 py-3 text-center">
                <Badge type={user.isActive ? 'success' : 'neutral'} size="sm">
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-3 py-3 text-center">
                <div className="text-xs" style={{ color: colors.text.secondary }}>
                  {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUserId(user.id);
                      onEdit(user);
                    }}
                    disabled={editLoading}
                    aria-busy={editLoading && editingUserId === user.id}
                    aria-label={`Edit ${user.fullName}`}
                    className="p-2 rounded-md transition-colors hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ color: colors.accent.blue.text }}
                    title="Edit user"
                  >
                    {editLoading && editingUserId === user.id ? (
                      <span className="text-xs font-medium">Loading…</span>
                    ) : (
                      <Edit size={18} aria-hidden="true" />
                    )}
                  </button>
                  {user.isActive && (
                    <button
                      type="button"
                      onClick={() => onDelete(user)}
                      aria-label={`Deactivate ${user.fullName}`}
                      className="p-2 rounded-md transition-colors hover:bg-red-50"
                      style={{ color: colors.state.error }}
                      title="Deactivate user"
                    >
                      <UserX size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No users found.</p>
        </div>
      )}
    </div>
  );
};

export default UsersTable;
