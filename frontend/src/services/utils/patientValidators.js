/**
 * Patient form validators
 * Each validator returns an error message, or null when the value is valid
 */

import { DOCUMENT_TYPES, GENDERS, PHONE_PREFIXES } from './constants';

/**
 * Validates the full name
 * @param {string} value - Name to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateFullName = (value) => {
  if (!value || value.trim() === '') {
    return 'Full name is required.';
  }
  if (value.length < 3) {
    return 'Full name must be at least 3 characters long.';
  }
  if (value.length > 100) {
    return 'Full name must be at most 100 characters long.';
  }
  // Letters (including the accented vowels and n with tilde used in Spanish names) and spaces
  if (!/^[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\s]+$/.test(value)) {
    return 'Full name can only contain letters and spaces.';
  }
  return null;
};

/**
 * Validates the document type
 * @param {string} value - Document type to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateDocumentType = (value) => {
  if (!value || value.trim() === '') {
    return 'Document type is required.';
  }
  const validTypes = DOCUMENT_TYPES.map((type) => type.value);
  if (!validTypes.includes(value)) {
    return 'Invalid document type.';
  }
  return null;
};

/**
 * Validates the document number
 * @param {string} value - Document number to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateDocumentNumber = (value) => {
  if (!value || value.trim() === '') {
    return 'Document number is required.';
  }
  if (value.length < 5) {
    return 'Document number must be at least 5 characters long.';
  }
  if (value.length > 20) {
    return 'Document number must be at most 20 characters long.';
  }
  if (!/^[a-zA-Z0-9]+$/.test(value)) {
    return 'Document number can only contain letters and numbers.';
  }
  return null;
};

/**
 * Validates the gender
 * @param {string} value - Gender code to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateGender = (value) => {
  if (!value || value.trim() === '') {
    return 'Gender is required.';
  }
  const validGenders = ['M', 'F', 'OTHER'];
  if (!validGenders.includes(value)) {
    return 'Invalid gender.';
  }
  return null;
};

/**
 * Validates the date of birth
 * @param {string} value - Date to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateBirthDate = (value) => {
  if (!value || value.trim() === '') {
    return 'Date of birth is required.';
  }

  const birthDate = new Date(value);
  const today = new Date();

  if (isNaN(birthDate.getTime())) {
    return 'Invalid date of birth.';
  }

  if (birthDate > today) {
    return 'Date of birth cannot be in the future.';
  }

  // Reject dates more than 120 years ago
  const oldestAllowed = new Date();
  oldestAllowed.setFullYear(oldestAllowed.getFullYear() - 120);

  if (birthDate < oldestAllowed) {
    return 'Date of birth cannot be more than 120 years ago.';
  }

  return null;
};

/**
 * Validates the phone prefix
 * @param {string} value - Prefix to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validatePhonePrefix = (value) => {
  if (!value || value.trim() === '') {
    return 'Phone prefix is required.';
  }
  if (!/^\+\d{1,4}$/.test(value)) {
    return 'The prefix must use the format +XX (e.g. +1).';
  }
  return null;
};

/**
 * Validates the phone number
 * @param {string} value - Phone number to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validatePhoneNumber = (value) => {
  if (!value || value.trim() === '') {
    return 'Phone number is required.';
  }
  if (value.length < 7) {
    return 'Phone number must have at least 7 digits.';
  }
  if (value.length > 15) {
    return 'Phone number must have at most 15 digits.';
  }
  if (!/^\d+$/.test(value)) {
    return 'Phone number can only contain digits.';
  }
  return null;
};

/**
 * Validates the email (optional field)
 * @param {string} value - Email to validate
 * @returns {string|null} - Error message, or null if valid
 */
const validateEmail = (value) => {
  if (!value || value.trim() === '') {
    return null;
  }

  if (value.length > 50) {
    return 'Email must be at most 50 characters long.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Invalid email.';
  }

  return null;
};

/**
 * Validators for the create-patient form, keyed by field name
 */
export const createPatientValidators = {
  fullName: validateFullName,
  documentType: validateDocumentType,
  documentNumber: validateDocumentNumber,
  gender: validateGender,
  birthDate: validateBirthDate,
  phonePrefix: validatePhonePrefix,
  phoneNumber: validatePhoneNumber,
  email: validateEmail,
};

// Re-exported for existing imports
export { DOCUMENT_TYPES, GENDERS, PHONE_PREFIXES };
