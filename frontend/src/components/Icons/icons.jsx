import React from 'react';
import logger from '../../services/utils/logger';
import {
  // Navigation and UI
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Search,
  User,
  Users,

  // Primary actions
  Upload,
  LogOut,

  // Analysis categories
  Microscope,
  FileText,
  Activity,
  Database,

  // Status and notifications
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,

  // Visibility toggles
  Eye,
  EyeOff
} from 'lucide-react';

// Standardized size scale
const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 48
};

const getSizeClasses = (size) => {
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-7 w-7',
    xxl: 'h-8 w-8'
  };
  return sizeMap[size] || sizeMap.md;
};

// HEp-2 cell icon used for ANA (antinuclear antibody) analysis
const ANAIcon = ({ size = 'md', color = "currentColor", className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`${getSizeClasses(size)} ${className}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth="1.5"
  >
    {/* Cell membrane */}
    <circle cx="12" cy="12" r="8" strokeWidth="1.5"/>
    {/* Nucleus */}
    <circle cx="12" cy="12" r="4" strokeWidth="1.5"/>
    {/* Nucleoli */}
    <circle cx="10.5" cy="11.5" r="1" strokeWidth="1"/>
    <circle cx="13.5" cy="12.5" r="1" strokeWidth="1"/>
    {/* Chromatin */}
    <path strokeWidth="0.75" d="M9 9.5l1.5 1M13.5 14l1.5 1M14.5 9.5l-1 1.5M9.5 14.5l1.5-1" />
  </svg>
);

// Legacy icons kept for backward compatibility
const CellIcon = ({ size = 'md', color = "currentColor", className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`${getSizeClasses(size)} ${className}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth="1.5"
  >
    <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="6" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="1" fill={color}/>
    <path d="M8 8l8 8M16 8l-8 8" strokeWidth="0.5" opacity="0.3"/>
  </svg>
);

// Multi-nucleus cell icon
const CellComplexIcon = ({ size = 'md', color = "currentColor", className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`${getSizeClasses(size)} ${className}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth="1.5"
  >
    <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="2.5" strokeWidth="1.5"/>
    <circle cx="14" cy="14" r="2.5" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="1" fill={color}/>
    <path d="M7 7l3 3M17 17l-3-3M17 7l-3 3M7 17l3-3" strokeWidth="0.8" opacity="0.4"/>
  </svg>
);

// Wraps a Lucide icon so it accepts the shared size keys
const createLucideWrapper = (LucideIcon) => {
  return ({ size = 'md', color = "currentColor", className = "", ...props }) => (
    <LucideIcon
      size={ICON_SIZES[size]}
      color={color}
      className={className}
      {...props}
    />
  );
};

// Status icons
export const SuccessIcon = createLucideWrapper(CheckCircle);
export const ErrorIcon = createLucideWrapper(XCircle);
export const WarningIcon = createLucideWrapper(AlertTriangle);
export const InfoIcon = createLucideWrapper(Info);

// Visibility icons
export const EyeIcon = createLucideWrapper(Eye);
export const EyeSlashIcon = createLucideWrapper(EyeOff);

// Icon registry, keyed by the names accepted by <Icon name="…" />
export const Icons = {
  // === Navigation and UI ===
  home: createLucideWrapper(Home),
  search: createLucideWrapper(Search),
  user: createLucideWrapper(User),
  users: createLucideWrapper(Users),
  chevronLeft: createLucideWrapper(ChevronLeft),
  chevronRight: createLucideWrapper(ChevronRight),
  arrowLeft: createLucideWrapper(ArrowLeft),

  // === Medical analysis ===
  ana: ANAIcon,
  microscope: createLucideWrapper(Microscope),

  // === Primary actions ===
  upload: createLucideWrapper(Upload),
  logout: createLucideWrapper(LogOut),

  // === Data management ===
  reports: createLucideWrapper(FileText),
  auditTrail: createLucideWrapper(Activity),
  database: createLucideWrapper(Database),

  // === Visibility ===
  eye: createLucideWrapper(Eye),
  eyeOff: createLucideWrapper(EyeOff),

  // === Legacy (backward compatibility) ===
  cell: CellIcon,
  cellComplex: CellComplexIcon
};

// Renders any registered icon by name
export const Icon = ({
  name,
  size = 'md',
  color = "currentColor",
  className = "",
  ...props
}) => {
  const IconComponent = Icons[name];

  if (!IconComponent) {
    logger.warn(`Icon "${name}" is not registered.`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      {...props}
    />
  );
};

export default Icons;