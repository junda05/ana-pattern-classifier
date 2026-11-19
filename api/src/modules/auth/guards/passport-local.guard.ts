/**
 * Guard for the local (username/password) authentication strategy
 *
 * Responsibilities:
 * - Extends Passport's AuthGuard with the 'local' strategy
 * - Validates the username/password credentials on the login endpoint
 * - Runs LocalStrategy.validate() automatically
 *
 * Usage:
 * - Applied to the POST /login endpoint
 * - Intercepts the request before it reaches the controller
 * - If the credentials are valid, passes the user on to the controller
 * - Otherwise, throws UnauthorizedException automatically
 *
 * Flow:
 * 1. The client sends POST /login with { username, password }
 * 2. The guard runs LocalStrategy.validate()
 * 3. LocalStrategy calls AuthService.validateUser()
 * 4. If valid, the user is attached to request.user
 * 5. The controller can read request.user
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PassportLocalGuard extends AuthGuard('local') {}
