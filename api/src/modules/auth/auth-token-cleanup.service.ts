/**
 * Periodic cleanup of authentication tokens
 *
 * On module init and then every hour, deletes:
 * - blacklisted tokens whose expiry has passed (they are unusable anyway)
 * - password-reset tokens that are expired or already used
 *
 * Uses a plain setInterval (cleared on module destroy and unref'd so it never
 * keeps the process alive). Failures are logged and retried at the next run.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { TokenBlacklistService } from './token-blacklist.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthTokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthTokenCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runCleanup();
    this.timer = setInterval(() => void this.runCleanup(), CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Runs both cleanups; never throws. */
  async runCleanup(now: Date = new Date()): Promise<void> {
    await this.attempt('expired blacklisted tokens', () =>
      this.tokenBlacklistService.removeExpired(now),
    );
    await this.attempt('stale password-reset tokens', () =>
      this.passwordResetService.removeStaleTokens(now),
    );
  }

  private async attempt(
    label: string,
    cleanup: () => Promise<number>,
  ): Promise<void> {
    try {
      const removed = await cleanup();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} ${label}.`);
      }
    } catch (error) {
      this.logger.error(`Could not remove ${label}`, (error as Error).stack);
    }
  }
}
