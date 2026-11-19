/**
 * Passport local strategy for username/password authentication
 *
 * Responsibilities:
 * - Implements Passport.js's 'local' strategy
 * - Validates user credentials (username/password)
 * - Delegates the check to AuthService
 *
 * Configuration:
 * - Expected fields: 'username' and 'password' (Passport defaults)
 * - Works with both HTML form and JSON bodies
 *
 * Validation flow:
 * 1. PassportLocalGuard triggers this strategy
 * 2. Passport reads username and password from the request body
 * 3. validate() runs with the credentials
 * 4. AuthService.validateUser() checks the credentials
 * 5. If valid, the user data is returned
 * 6. Otherwise, UnauthorizedException is thrown
 *
 * validate():
 * - Parameters: username (string), password (string)
 * - Returns: the user data if valid
 * - Throws: UnauthorizedException if the credentials are wrong
 *
 * Typical usage:
 * - Login endpoint
 * - Initial user authentication
 * - Issuing JWTs after a successful check
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../authenticated-request';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
    // By default the local strategy reads the 'username' and 'password' fields from the request body
  }

  async validate(
    username: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.authService.validateUser({
      username,
      password,
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
