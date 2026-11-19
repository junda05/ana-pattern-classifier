/**
 * Role-based access guard
 *
 * Protects routes by checking that the authenticated user has one of the required roles.
 *
 * Usage:
 * @UseGuards(PassportJwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 *
 * How it works:
 * 1. Reads the required roles from the @Roles decorator
 * 2. Takes the user from the request (attached by PassportJwtAuthGuard)
 * 3. Checks that the user's role is among the allowed roles
 *
 * Important: this guard must run AFTER PassportJwtAuthGuard
 * so that the user is already authenticated.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../entities/users/user.types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authenticated-request';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      // No roles specified: allow access
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();

    if (!user) {
      throw new ForbiddenException('User is not authenticated.');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }
}
