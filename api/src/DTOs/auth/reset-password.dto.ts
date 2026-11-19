/**
 * DTO for resetting a password with a token
 *
 * Used when the recovery link is opened, an administrator has approved the
 * change (POST /auth/validate-admin-and-token) and the new password is set.
 *
 * Validation:
 * - token: required; must be valid and not expired
 * - newPassword: required; at least 8 characters
 * - approvalToken: required; the approval token returned by
 *   validate-admin-and-token (valid for 10 minutes)
 */

import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'The token is required.' })
  @IsString({ message: 'The token must be a string.' })
  token: string;

  @IsNotEmpty({ message: 'The new password is required.' })
  @IsString({ message: 'The password must be a string.' })
  @MinLength(8, { message: 'The password must be at least 8 characters long.' })
  newPassword: string;

  @IsNotEmpty({ message: 'The administrator approval is required.' })
  @IsString({ message: 'The administrator approval must be a string.' })
  approvalToken: string;
}
