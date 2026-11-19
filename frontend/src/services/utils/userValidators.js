/**
 * Centralized validators for user management
 * Aligned with the NestJS backend validations
 *
 * Validation rules according to the backend DTOs:
 *
 * CreateUserDto:
 * - username: 3-50 characters; letters, numbers, - and _ only
 * - fullName: 1-100 characters
 * - email: valid format, at most 100 characters
 * - password: 8-255 characters
 * - professionalCard: 1-50 characters
 * - role: 'ADMIN' or 'STANDARD' (codes, never display labels)
 *
 * UpdateUserDto:
 * - All fields are optional
 * - If sent, they must pass the same validations
 */

import { ROLE_LABELS } from './constants';

/**
 * Validates the username
 * Rule: 3-50 characters; letters, numbers, hyphens and underscores only
 */
const validateUsername = (username) => {
  if (!username || username.trim() === '') {
    return 'Username is required.';
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters long.';
  }

  if (trimmed.length > 50) {
    return 'Username must be at most 50 characters long.';
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, hyphens and underscores.';
  }

  return null;
};

/**
 * Validates the full name
 * Rule: 1-100 characters
 */
const validateFullName = (fullName) => {
  if (!fullName || fullName.trim() === '') {
    return 'Full name is required.';
  }

  const trimmed = fullName.trim();

  if (trimmed.length < 1) {
    return 'Full name is required.';
  }

  if (trimmed.length > 100) {
    return 'Full name must be at most 100 characters long.';
  }

  return null;
};

/**
 * Validates the email
 * Rule: valid format, at most 100 characters
 */
const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return 'Email is required.';
  }

  const trimmed = email.trim();

  if (trimmed.length > 100) {
    return 'Email must be at most 100 characters long.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Enter a valid email address.';
  }

  return null;
};

/**
 * Validates the password
 * Rule: 8-255 characters
 */
const validatePassword = (password) => {
  if (!password || password === '') {
    return 'Password is required.';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (password.length > 255) {
    return 'Password must be at most 255 characters long.';
  }

  return null;
};

/**
 * Validates the password confirmation
 */
const validatePasswordConfirm = (password, confirmPassword) => {
  if (!confirmPassword || confirmPassword === '') {
    return 'Confirm the password.';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }

  return null;
};

/**
 * Validates the professional license number
 * Rule: 1-50 characters (required on create, optional on update)
 */
const validateProfessionalCard = (professionalCard) => {
  if (!professionalCard || professionalCard.trim() === '') {
    return 'Professional license number is required.';
  }

  const trimmed = professionalCard.trim();

  if (trimmed.length > 50) {
    return 'Professional license number must be at most 50 characters long.';
  }

  return null;
};

/**
 * Validates the user role
 * Forms work with the role codes ('ADMIN', 'STANDARD'); labels are for display only
 */
const validateRole = (role) => {
  if (role && !Object.keys(ROLE_LABELS).includes(role)) {
    return 'Invalid role.';
  }

  return null;
};

/**
 * Create-user form validators
 * Every field is required except role
 */
export const createUserValidators = {
  username: validateUsername,
  fullName: validateFullName,
  email: validateEmail,
  password: validatePassword,
  confirmPassword: (value, values) => validatePasswordConfirm(values.password, value),
  professionalCard: validateProfessionalCard,
  role: validateRole,
};

/**
 * Update-user form validators
 * Every field is optional, but must be valid when sent
 */
export const updateUserValidators = {
  fullName: (value) => (value && value.trim()) ? validateFullName(value) : null,
  email: (value) => (value && value.trim()) ? validateEmail(value) : null,
  professionalCard: (value) => (value && value.trim()) ? validateProfessionalCard(value) : null,
  role: (value) => value ? validateRole(value) : null,
};
