/**
 * Custom decorator that defines the roles required by a route
 *
 * Specifies which roles can access an endpoint
 *
 * Usage:
 * @Roles(UserRole.ADMIN)
 * @Roles(UserRole.ADMIN, UserRole.STANDARD)
 *
 * Must be used together with RolesGuard:
 * @UseGuards(PassportJwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 * async someMethod() { ... }
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../entities/users/user.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
