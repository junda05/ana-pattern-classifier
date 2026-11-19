/**
 * DTO for renewing access tokens
 *
 * Body of the POST /refresh-access endpoint
 *
 * Fields:
 * - refresh: valid refresh token used to issue a new access token
 *
 * Flow:
 * 1. The frontend detects that the access token is about to expire
 * 2. It sends the refresh token to obtain a new access token
 * 3. The server validates the refresh token and issues a new access token
 * 4. The frontend replaces its access token without a new login
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'The refresh token must be a string.' })
  @IsNotEmpty({ message: 'The refresh token is required.' })
  refresh: string;
}
