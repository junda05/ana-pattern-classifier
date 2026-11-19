/**
 * Types and enumerations for the audit-trail (traceability) module
 *
 * Definitions:
 *
 * ActivityType - Recorded activity types:
 * - CREATE: An entity was created
 * - UPDATE: An entity was updated
 * - DELETE: An entity was deleted
 * - PASSWORD_RESET_REQUEST: A password reset was requested
 * - PASSWORD_RESET_COMPLETED: A password reset was completed
 * - PASSWORD_RESET_EXPIRED: A password reset token expired
 *
 * EntityType - Traceable entity types:
 * - USER: User
 * - PATIENT: Patient
 * - RESULT: Result
 * - CORRECTION: Correction
 *
 * Clients must branch on the enum values (codes), never on the labels below,
 * which are display text only.
 */

export enum ActivityType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_EXPIRED = 'PASSWORD_RESET_EXPIRED',
}

export enum EntityType {
  USER = 'USER',
  PATIENT = 'PATIENT',
  RESULT = 'RESULT',
  CORRECTION = 'CORRECTION',
}

export const ACTIVITY_TYPE_CHOICES = [
  { value: ActivityType.CREATE, label: 'Create' },
  { value: ActivityType.UPDATE, label: 'Update' },
  { value: ActivityType.DELETE, label: 'Delete' },
  {
    value: ActivityType.PASSWORD_RESET_REQUEST,
    label: 'Password reset requested',
  },
  {
    value: ActivityType.PASSWORD_RESET_COMPLETED,
    label: 'Password reset completed',
  },
  {
    value: ActivityType.PASSWORD_RESET_EXPIRED,
    label: 'Password reset link expired',
  },
];

export const ENTITY_TYPE_CHOICES = [
  { value: EntityType.USER, label: 'User' },
  { value: EntityType.PATIENT, label: 'Patient' },
  { value: EntityType.RESULT, label: 'Result' },
  { value: EntityType.CORRECTION, label: 'Correction' },
];

/** Display name of the actor of system actions (audit records with a null userId). */
export const SYSTEM_ACTOR_NAME = 'System';
