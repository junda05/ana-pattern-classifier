/**
 * Passport JWT strategy for protected routes
 *
 * Responsibilities:
 * - Implements Passport.js's 'jwt' strategy
 * - Validates JWTs on protected routes
 * - Accepts access tokens only: refresh tokens (type 'refresh') and
 *   password-reset approval tokens (with a 'purpose' claim) are rejected
 * - Rejects revoked (blacklisted) tokens
 * - Rejects tokens of users that no longer exist or were deactivated, so a
 *   deactivated user loses access immediately (not when the token expires)
 * - Rejects tokens issued before the user's last password reset
 *   (Users.passwordChangedAt)
 * - Extracts the token from the Authorization header
 *
 * Configuration:
 * - Extraction: Bearer token from the Authorization header
 * - Secret: read from environment variables
 * - Expiration is not ignored: expired tokens are rejected
 * - passReqToCallback enabled: the request is available to extract the token
 *
 * Validation flow:
 * 1. PassportJwtAuthGuard triggers this strategy
 * 2. Passport extracts the token from the Authorization header
 * 3. The JWT is decoded and verified with the secret
 * 4. validate() runs with the request and the payload
 * 5. The token kind and the blacklist are checked
 * 6. The user is loaded: missing or inactive users, and tokens issued before
 *    the last password reset, are rejected; the stored role is used
 * 7. If valid, the user data is returned and attached to request.user
 *
 * validate():
 * - Returns: { userId, username, role } for request.user (AuthenticatedUser);
 *   the role is read from the database (not the token claim), so demoting a
 *   user takes effect on the next request
 * - Throws: UnauthorizedException for non-access tokens, access tokens without
 *   valid sub/username/role claims, revoked tokens, tokens of missing or
 *   inactive users, or tokens issued before the last password reset
 */

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenBlacklistService } from '../token-blacklist.service';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../authenticated-request';
import { UserRole } from '../../../entities/users/user.types';
import {
  PASSWORD_CHANGED_MESSAGE,
  issuedBeforePasswordChange,
} from '../password-change';

export interface JwtPayload {
  sub: number;
  username?: string;
  role?: string;
  /** 'refresh' for refresh tokens; absent (or 'access') for access tokens */
  type?: string;
  /** Set on special-purpose tokens (e.g. password-reset approval) */
  purpose?: string;
  /** Issue time in seconds since the epoch (set by jsonwebtoken) */
  iat?: number;
  [claim: string]: unknown;
}

const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();
const USER_ROLES: ReadonlySet<unknown> = new Set(Object.values(UserRole));

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private tokenBlacklistService: TokenBlacklistService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: extractBearerToken,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const isAccessToken =
      (payload.type === undefined || payload.type === 'access') &&
      payload.purpose === undefined;
    if (!isAccessToken) {
      throw new UnauthorizedException('An access token is required.');
    }

    // Every access token issued by AuthService carries these claims; anything
    // else is not a token this API issued for a user session.
    const { sub, username, role } = payload;
    if (
      typeof sub !== 'number' ||
      typeof username !== 'string' ||
      !USER_ROLES.has(role)
    ) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const token = extractBearerToken(req);
    if (token && (await this.tokenBlacklistService.isTokenBlacklisted(token))) {
      throw new UnauthorizedException('The token has been revoked.');
    }

    const user = await this.usersService.findById(sub).catch((error) => {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }
    if (issuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
      throw new UnauthorizedException(PASSWORD_CHANGED_MESSAGE);
    }

    // The stored role wins over the token claim, so a role change applies at once
    return { userId: sub, username, role: user.role };
  }
}
