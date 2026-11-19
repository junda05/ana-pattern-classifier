import React from 'react';
import { colors } from '../../config/colors';

/**
 * Pill badge: a 10 % tint of the hue with a darker text of the same hue (4.5:1 or better).
 * Types: success, warning, danger, info, purple, pink; anything else is neutral.
 */
const Badge = ({ type, children, className = '' }) => {
  const { background, text } = colors.badge[type] || colors.badge.neutral;

  return (
    <span
      className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${className}`}
      style={{ backgroundColor: background, color: text }}
    >
      {children}
    </span>
  );
};

export default Badge;
