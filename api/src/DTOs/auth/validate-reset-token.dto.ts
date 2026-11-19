/**
 * DTO for validating a recovery token
 *
 * Used to check whether a token is valid before showing
 * the new-password form
 *
 * Validation:
 * - token: required; must be valid and not expired
 */

import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateResetTokenDto {
  @IsNotEmpty({ message: 'The token is required.' })
  @IsString({ message: 'The token must be a string.' })
  token: string;
}
