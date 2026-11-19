/**
 * Request types for authenticated routes
 *
 * - AuthenticatedUser: what JwtStrategy.validate() attaches to request.user on
 *   every route behind PassportJwtAuthGuard (the claims of a valid access token)
 * - AuthenticatedRequest: an Express request that passed PassportJwtAuthGuard
 * - LoginRequest: the login request after LocalStrategy validated the credentials
 */

import type { Request } from 'express';
import { UserRole } from '../../entities/users/user.types';

export interface AuthenticatedUser {
  userId: number;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** LocalStrategy.validate() returns the same shape as the access-token claims. */
export interface LoginRequest extends Request {
  user: AuthenticatedUser;
}
