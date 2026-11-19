/**
 * Types and enums for the patients module
 *
 * Definitions:
 *
 * DocumentType - Valid identity document types:
 * - NATIONAL_ID: National ID card
 * - MINOR_ID: Minor ID card
 * - FOREIGNER_ID: Foreign resident ID
 * - PASSPORT: Passport
 * - BIRTH_CERTIFICATE: Birth certificate
 *
 * Gender - Patient gender:
 * - M: Male
 * - F: Female
 * - OTHER: Other
 */

export enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  MINOR_ID = 'MINOR_ID',
  FOREIGNER_ID = 'FOREIGNER_ID',
  PASSPORT = 'PASSPORT',
  BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE',
}

export enum Gender {
  M = 'M',
  F = 'F',
  OTHER = 'OTHER',
}

/** Default phone country prefix stored for new patients. */
export const DEFAULT_PHONE_PREFIX = '+1';
