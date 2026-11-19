/**
 * DTO (Data Transfer Object) for updating users
 *
 * Defines the data structure used to update existing users
 *
 * Characteristics:
 * - All fields are optional (partial update)
 * - Excludes immutable fields such as userId, username, password and lastLogin
 * - Allows personal information to be updated
 * - Includes role and active status for administrators
 *
 * Updatable fields:
 * - fullName: full name
 * - email: email (checked for uniqueness)
 * - professionalCard: professional license number
 * - role: user role (administrators only)
 * - isActive: active/inactive status (administrators only)
 *
 * Typical usage:
 * - Profile updates by the user
 * - User administration
 * - Role and status changes
 *
 * Validation:
 * - All fields are optional
 * - Fields that are sent must pass their validation rules
 */

import {
  IsString,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsOptional,
  Length,
} from 'class-validator';
import { UserRole } from '../../entities/users/user.types';

export class UpdateUserDto {
  @Length(1, 100, {
    message: 'The full name must be between 1 and 100 characters long.',
  })
  @IsString({ message: 'The full name must be a string.' })
  @IsOptional()
  fullName?: string;

  @Length(1, 100, { message: 'The email must be at most 100 characters long.' })
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @IsOptional()
  email?: string;

  @Length(1, 50, {
    message:
      'The professional license number must be between 1 and 50 characters long.',
  })
  @IsString({ message: 'The professional license number must be a string.' })
  @IsOptional()
  professionalCard?: string;

  @IsEnum(UserRole, { message: 'Invalid role. Must be ADMIN or STANDARD.' })
  @IsOptional()
  role?: UserRole;

  @IsBoolean({ message: 'The active status must be a boolean (true/false).' })
  @IsOptional()
  isActive?: boolean;
}
