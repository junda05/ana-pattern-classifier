/**
 * Guard that protects routes with JWTs
 *
 * Responsibilities:
 * - Extends Passport's AuthGuard with the 'jwt' strategy
 * - Validates the JWT sent in the Authorization: Bearer <token> header
 * - Rejects blacklisted tokens
 * - Runs JwtStrategy.validate() automatically
 * - Lets routes marked with the @Public() decorator through
 *
 * Usage:
 * - Applied to protected routes (profile, logout, etc.)
 * - Intercepts requests before they reach the controller
 * - Extracts and validates the JWT from the header
 * - Checks the blacklist automatically
 *
 * Validation flow:
 * 1. The client sends a request with the Authorization: Bearer <token> header
 * 2. The guard extracts the token from the header
 * 3. JwtStrategy decodes and validates the token
 * 4. JwtStrategy checks whether the token is blacklisted
 * 5. If valid, the user data is attached to request.user
 * 6. The controller can read request.user.userId and request.user.username
 *
 * Security:
 * - Expired tokens: rejected by the JWT verification
 * - Blacklisted tokens: rejected by JwtStrategy
 * - Malformed tokens: rejected by the JWT verification
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PassportJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Skip authentication for routes marked with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
