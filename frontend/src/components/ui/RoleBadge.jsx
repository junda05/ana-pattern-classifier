import React from 'react';
import { formatRoleLabel } from '../../services/utils/constants';
import { colors } from '../../config/colors';

/**
 * Badge colors per role code
 */
const ROLE_BADGE_STYLES = {
  ADMIN: colors.role.admin,
  STANDARD: colors.role.standard,
};

const DEFAULT_ROLE_BADGE_STYLE = colors.role.fallback;

/**
 * Pill showing a role, colored by role code. Used by the users table and the audit trail.
 *
 * @param {string|null} role - Role code ('ADMIN' | 'STANDARD')
 * @param {string} [label] - Text to show instead of the role label (e.g. "System")
 */
const RoleBadge = ({ role, label }) => {
  const style = ROLE_BADGE_STYLES[role] || DEFAULT_ROLE_BADGE_STYLE;
  return (
    <span
      className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border"
      style={{ backgroundColor: style.background, color: style.text, borderColor: style.border }}
    >
      {label || formatRoleLabel(role)}
    </span>
  );
};

export default RoleBadge;
