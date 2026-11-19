/**
 * JWT blacklist service
 *
 * Revoked tokens are stored by their SHA-256 hash, so revoking one token
 * (for example the refresh token of one session on logout) never affects the
 * user's other tokens, and the raw token is never persisted.
 *
 * Main methods:
 * - blacklistToken(): revokes one token until its own expiry
 * - isTokenBlacklisted(): checks one token (used by JwtStrategy and AuthService)
 * - removeExpired(): deletes entries whose token has expired anyway
 *   (run periodically by AuthTokenCleanupService)
 */

import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { BlacklistedToken } from '../../entities/auth/blacklisted-token.entity';
import { TokenType } from '../../entities/auth/blacklisted-token.types';

@Injectable()
export class TokenBlacklistService {
  constructor(
    @Inject('BLACKLISTED_TOKEN_REPOSITORY')
    private blacklistedTokenRepository: Repository<BlacklistedToken>,
  ) {}

  /** SHA-256 (hex) of a token: the only form in which tokens are stored. */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revokes one token until its expiry date
   */
  async blacklistToken(
    token: string,
    tokenType: TokenType,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    const blacklistedToken = this.blacklistedTokenRepository.create({
      tokenHash: TokenBlacklistService.hashToken(token),
      tokenType,
      userId,
      expiresAt,
    });

    await this.blacklistedTokenRepository.save(blacklistedToken);
  }

  /**
   * Checks whether this exact token has been revoked
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const count = await this.blacklistedTokenRepository.count({
      where: { tokenHash: TokenBlacklistService.hashToken(token) },
    });
    return count > 0;
  }

  /**
   * Deletes entries whose token has already expired
   * @returns Number of deleted entries
   */
  async removeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.blacklistedTokenRepository.delete({
      expiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }
}
