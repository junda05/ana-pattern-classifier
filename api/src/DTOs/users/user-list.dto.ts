/**
 * DTO for paginated user lists
 *
 * Contains only the fields needed to display users in a list
 *
 * Fields:
 * - userId: user ID
 * - username: username
 * - fullName: full name
 * - email: email
 * - role: user role
 * - isActive: active/inactive status
 * - dateJoined: registration date
 * - lastLogin: last login
 */

import { UserRole } from '../../entities/users/user.types';

export interface UserListDto {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  dateJoined: Date;
  lastLogin?: Date;
}
