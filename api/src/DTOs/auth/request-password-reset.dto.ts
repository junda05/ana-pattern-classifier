/**
 * DTO for a password reset request
 *
 * Used when a user forgets their password and requests
 * a recovery link
 *
 * Validation:
 * - username: required
 */

import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordResetDto {
  @IsNotEmpty({ message: 'Username is required.' })
  @IsString({ message: 'The username must be a string.' })
  username: string;
}
