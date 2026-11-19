/**
 * DTO for a full user record
 *
 * Includes every field of the user entity except the password
 *
 * Fields:
 * - userId: user ID
 * - username: username
 * - fullName: full name
 * - email: email
 * - professionalCard: professional license number
 * - role: user role
 * - isActive: active/inactive status
 * - dateJoined: registration date
 * - lastLogin: last login
 */

import { UserRole } from '../../entities/users/user.types';

export interface UserDetailDto {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  professionalCard: string;
  role: UserRole;
  isActive: boolean;
  dateJoined: Date;
  lastLogin?: Date;
}
