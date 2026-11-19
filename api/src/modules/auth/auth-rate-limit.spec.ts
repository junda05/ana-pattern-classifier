import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_RATE_LIMIT_MESSAGE,
  authThrottlerOptions,
} from './auth-rate-limit';
import { PassportAuthController } from './passport-auth.controller';
import { PassportLocalGuard } from './guards/passport-local.guard';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const SKIP_PREFIX = 'THROTTLER:SKIP';

function guardsOf(handler: keyof PassportAuthController): unknown[] {
  return (Reflect.getMetadata(
    GUARDS_METADATA,
    PassportAuthController.prototype[handler],
  ) ?? []) as unknown[];
}

function activeThrottlers(handler: keyof PassportAuthController): string[] {
  const names = authThrottlerOptions(configWith({})).throttlers.map(
    (throttler) => throttler.name as string,
  );
  return names.filter(
    (name) =>
      Reflect.getMetadata(
        `${SKIP_PREFIX}${name}`,
        PassportAuthController.prototype[handler],
      ) !== true,
  );
}

describe('authThrottlerOptions', () => {
  it('limits per minute by default: login 10, refresh 30, password reset 5', () => {
    const options = authThrottlerOptions(configWith({}));

    expect(options.errorMessage).toBe(
      'Too many requests. Please try again later.',
    );
    expect(AUTH_RATE_LIMIT_MESSAGE).toBe(options.errorMessage);
    expect(options.throttlers).toEqual([
      { name: 'auth-login', ttl: 60_000, limit: 10 },
      { name: 'auth-refresh', ttl: 60_000, limit: 30 },
      { name: 'auth-password-reset', ttl: 60_000, limit: 5 },
    ]);
  });

  it('reads the limits and the window from AUTH_RATE_LIMIT_*', () => {
    const options = authThrottlerOptions(
      configWith({
        AUTH_RATE_LIMIT_WINDOW_SECONDS: '120',
        AUTH_RATE_LIMIT_LOGIN: '3',
        AUTH_RATE_LIMIT_REFRESH: '7',
        AUTH_RATE_LIMIT_PASSWORD_RESET: '2',
      }),
    );

    expect(options.throttlers).toEqual([
      { name: 'auth-login', ttl: 120_000, limit: 3 },
      { name: 'auth-refresh', ttl: 120_000, limit: 7 },
      { name: 'auth-password-reset', ttl: 120_000, limit: 2 },
    ]);
  });

  it.each(['', '0', '-4', '2.5', 'ten'])(
    'falls back to the default for an invalid value (%p)',
    (value) => {
      const options = authThrottlerOptions(
        configWith({
          AUTH_RATE_LIMIT_WINDOW_SECONDS: value,
          AUTH_RATE_LIMIT_LOGIN: value,
        }),
      );

      expect(options.throttlers[0]).toEqual({
        name: 'auth-login',
        ttl: 60_000,
        limit: 10,
      });
    },
  );
});

describe('rate-limited authentication routes', () => {
  it('counts a login attempt before the credentials are checked', () => {
    expect(guardsOf('login')).toEqual([ThrottlerGuard, PassportLocalGuard]);
    expect(activeThrottlers('login')).toEqual(['auth-login']);
  });

  it('limits refresh-access with the refresh limit', () => {
    expect(guardsOf('refreshToken')).toEqual([ThrottlerGuard]);
    expect(activeThrottlers('refreshToken')).toEqual(['auth-refresh']);
  });

  it.each([
    'requestPasswordReset',
    'validateAdminAndToken',
    'resetPassword',
  ] as const)('limits %s with the password-reset limit', (handler) => {
    expect(guardsOf(handler)).toEqual([ThrottlerGuard]);
    expect(activeThrottlers(handler)).toEqual(['auth-password-reset']);
  });

  it.each(['logout', 'getUserProfile', 'validateResetToken'] as const)(
    'does not rate-limit %s',
    (handler) => {
      expect(guardsOf(handler)).not.toContain(ThrottlerGuard);
    },
  );
});
