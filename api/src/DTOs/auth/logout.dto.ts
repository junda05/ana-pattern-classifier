/**
 * DTO for user logout
 *
 * Body of the POST /logout endpoint
 *
 * Fields:
 * - refresh: refresh token to invalidate
 *
 * Usage:
 * - The frontend sends the refresh token to invalidate it
 * - The server adds the token to the blacklist
 * - The revoked token cannot be used again
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutDto {
  @IsString({ message: 'The refresh token must be a string.' })
  @IsNotEmpty({ message: 'The refresh token is required.' })
  refresh: string;
}
