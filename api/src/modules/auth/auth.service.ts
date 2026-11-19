/**
 * Core authentication service
 *
 * Main features:
 * - Authenticates users with username/password
 * - Issues JWTs (access and refresh)
 * - Renews expired access tokens
 * - Secure logout through a per-token blacklist
 * - Validates credentials and active users
 *
 * Authentication flow:
 * 1. validateUser(): checks credentials and updates last_login
 * 2. signIn(): issues the token pair (access + refresh)
 * 3. refreshAccessToken(): renews the access token using the refresh token
 * 4. logout(): revokes the session's refresh token (and the access token
 *    that made the request) until they expire
 *
 * Security measures:
 * - Revoked tokens are rejected (checked by token hash, not by user, so
 *   logging out one session does not affect the user's other sessions)
 * - Token type is checked (access vs refresh); password-reset approval
 *   tokens are neither
 * - The user must still be active when renewing, and the refresh token must
 *   not predate the user's last password reset (Users.passwordChangedAt)
 * - Expired and invalid tokens are handled separately
 *
 * Token configuration:
 * - JWT_ACCESS_EXPIRATION: access token lifetime (default: 15m)
 * - JWT_REFRESH_EXPIRATION: refresh token lifetime (default: 7d)
 */

import { randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { TokenBlacklistService } from './token-blacklist.service';
import type { AuthenticatedUser } from './authenticated-request';
import { TokenType } from '../../entities/auth/blacklisted-token.types';
import { UserRole } from '../../entities/users/user.types';
import {
  PASSWORD_CHANGED_MESSAGE,
  issuedBeforePasswordChange,
} from './password-change';

type AuthInput = { username: string; password: string };
type SignInData = AuthenticatedUser;
type AuthResult = { refresh: string; access: string };
type TokenPayload = {
  sub: number;
  username?: string;
  role?: UserRole;
  type?: string;
  exp?: number;
  iat?: number;
  jti?: string;
};

const LOGGED_OUT = 'Logged out successfully.';
const ALREADY_REVOKED =
  'The token was already revoked. Logged out successfully.';

function isJwtVerificationError(error: unknown): boolean {
  const name = (error as Error | null)?.name;
  return (
    name === 'TokenExpiredError' ||
    name === 'JsonWebTokenError' ||
    name === 'NotBeforeError'
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private tokenBlacklistService: TokenBlacklistService,
    private configService: ConfigService,
  ) {}

  async validateUser(input: AuthInput): Promise<SignInData | null> {
    const user = await this.usersService.findUserByName(input.username);
    // Always compare (a dummy hash for unknown usernames), so the response
    // time does not reveal whether the account exists
    const passwordMatches = await this.passwordService.validatePassword(
      input.password,
      user?.password,
    );

    if (user && passwordMatches) {
      // Load the full user record to include the role
      const fullUser = await this.usersService.findById(user.userId);

      if (!fullUser.isActive) {
        return null;
      }

      // Update the last login timestamp; never fail authentication because of it
      try {
        await this.usersService.updateLastLogin(user.userId);
      } catch (error) {
        this.logger.warn(
          `Could not update the last login of user ${user.userId}: ${(error as Error).message}`,
        );
      }

      return {
        userId: user.userId,
        username: user.username,
        role: fullUser.role,
      };
    }
    return null;
  }

  async signIn(user: SignInData): Promise<AuthResult> {
    const tokenPayload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
    };

    const accessExpiration =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    // Short-lived access token
    const accessToken = await this.jwtService.signAsync(
      { ...tokenPayload, jti: randomUUID() },
      { expiresIn: accessExpiration },
    );

    // Long-lived refresh token
    const refreshToken = await this.jwtService.signAsync(
      { ...tokenPayload, type: 'refresh', jti: randomUUID() },
      { expiresIn: refreshExpiration },
    );

    return {
      refresh: refreshToken,
      access: accessToken,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access: string }> {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken);
    } catch (error) {
      // Distinguish an expired token from an invalid one
      if ((error as Error).name === 'TokenExpiredError') {
        throw new UnauthorizedException('The refresh token has expired.');
      }
      if (isJwtVerificationError(error)) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      throw error;
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token.');
    }

    if (await this.tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
      throw new UnauthorizedException('The refresh token has been revoked.');
    }

    // The user must still exist and be active
    const user = await this.usersService
      .findById(payload.sub)
      .catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }
    if (issuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
      throw new UnauthorizedException(PASSWORD_CHANGED_MESSAGE);
    }

    const accessExpiration =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: user.userId,
        username: user.username,
        role: user.role,
        jti: randomUUID(),
      },
      { expiresIn: accessExpiration },
    );

    return { access: newAccessToken };
  }

  /**
   * Revokes the session's refresh token until it expires.
   *
   * Only a valid, unexpired refresh token that belongs to the user is
   * blacklisted; an expired or malformed token cannot be used anyway, so
   * logging out with it simply succeeds. When the access token that made
   * the request is given, it is revoked too.
   */
  async logout(
    refreshToken: string,
    userId: number,
    accessToken?: string,
  ): Promise<{ message: string }> {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken);
    } catch (error) {
      if (isJwtVerificationError(error)) {
        await this.revokeAccessToken(accessToken, userId);
        return { message: LOGGED_OUT };
      }
      throw error;
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token.');
    }

    // The token must belong to the requesting user
    if (payload.sub !== userId) {
      throw new UnauthorizedException(
        'The token does not belong to this user.',
      );
    }

    if (await this.tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
      await this.revokeAccessToken(accessToken, userId);
      return { message: ALREADY_REVOKED };
    }

    await this.tokenBlacklistService.blacklistToken(
      refreshToken,
      TokenType.REFRESH,
      userId,
      new Date((payload.exp as number) * 1000),
    );
    await this.revokeAccessToken(accessToken, userId);

    return { message: LOGGED_OUT };
  }

  /** Revokes the (already verified) access token of the current request. */
  private async revokeAccessToken(
    accessToken: string | undefined,
    userId: number,
  ): Promise<void> {
    if (!accessToken) {
      return;
    }
    const payload = this.jwtService.decode<TokenPayload | null>(accessToken);
    if (!payload?.exp || payload.sub !== userId) {
      return;
    }
    if (await this.tokenBlacklistService.isTokenBlacklisted(accessToken)) {
      return;
    }
    await this.tokenBlacklistService.blacklistToken(
      accessToken,
      TokenType.ACCESS,
      userId,
      new Date(payload.exp * 1000),
    );
  }
}
