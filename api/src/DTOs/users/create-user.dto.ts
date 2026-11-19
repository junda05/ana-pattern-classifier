/**
 * DTO (Data Transfer Object) for creating users
 *
 * Defines the data structure required to create a new user
 *
 * Required fields:
 * - username: Unique username
 * - fullName: User's full name
 * - email: Unique email address
 * - password: Plain-text password (hashed automatically)
 * - professionalCard: Professional license number
 *
 * Optional fields:
 * - role: User role (default: STANDARD)
 *
 * Validations applied:
 * - Uniqueness of username and email (in the service)
 * - Field format and length
 * - Strong password validation
 */

import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../entities/users/user.types';

export class CreateUserDto {
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'The username may only contain letters, numbers, hyphens and underscores.',
  })
  @Length(3, 50, {
    message: 'The username must be between 3 and 50 characters long.',
  })
  @IsString({ message: 'The username must be a string.' })
  @IsNotEmpty({ message: 'Username is required.' })
  username: string;

  @Length(1, 100, {
    message: 'The full name must be between 1 and 100 characters long.',
  })
  @IsString({ message: 'The full name must be a string.' })
  @IsNotEmpty({ message: 'Full name is required.' })
  fullName: string;

  @Length(1, 100, { message: 'The email must be at most 100 characters long.' })
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @Length(8, 255, {
    message: 'The password must be between 8 and 255 characters long.',
  })
  @MinLength(8, { message: 'The password must be at least 8 characters long.' })
  @IsString({ message: 'The password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;

  @Length(1, 50, {
    message:
      'The professional license number must be between 1 and 50 characters long.',
  })
  @IsString({ message: 'The professional license number must be a string.' })
  @IsNotEmpty({ message: 'Professional license number is required.' })
  professionalCard: string;

  @IsEnum(UserRole, { message: 'Invalid role. Must be ADMIN or STANDARD.' })
  @IsOptional()
  role?: UserRole;
}
