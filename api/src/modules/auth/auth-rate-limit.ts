/**
 * Per-IP rate limits of the authentication routes (@nestjs/throttler)
 *
 * Three named throttlers, each counted per client IP and per route over a
 * fixed window (AUTH_RATE_LIMIT_WINDOW_SECONDS, default 60 s):
 * - auth-login (AUTH_RATE_LIMIT_LOGIN, default 10): POST /auth/login
 * - auth-refresh (AUTH_RATE_LIMIT_REFRESH, default 30): POST /auth/refresh-access
 * - auth-password-reset (AUTH_RATE_LIMIT_PASSWORD_RESET, default 5):
 *   request-password-reset, validate-admin-and-token and reset-password
 * Invalid or empty values fall back to the defaults.
 *
 * Above the limit the API answers 429 with the message "Too many requests.
 * Please try again later." and a Retry-After-<throttler name> header (seconds).
 *
 * The client IP is req.ip: behind a reverse proxy set TRUST_PROXY
 * (see app.setup.ts), otherwise every client shares the proxy's address.
 */

import { applyDecorators, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SkipThrottle,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerOptions,
} from '@nestjs/throttler';

export const AUTH_RATE_LIMIT_MESSAGE =
  'Too many requests. Please try again later.';

const DEFAULT_WINDOW_SECONDS = 60;

const AUTH_THROTTLERS = {
  login: { name: 'auth-login', env: 'AUTH_RATE_LIMIT_LOGIN', limit: 10 },
  refresh: { name: 'auth-refresh', env: 'AUTH_RATE_LIMIT_REFRESH', limit: 30 },
  passwordReset: {
    name: 'auth-password-reset',
    env: 'AUTH_RATE_LIMIT_PASSWORD_RESET',
    limit: 5,
  },
} as const;

export type AuthRateLimitGroup = keyof typeof AUTH_THROTTLERS;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Throttler configuration of the authentication routes, read from the environment. */
export function authThrottlerOptions(
  config: ConfigService,
): ThrottlerModuleOptions & { throttlers: ThrottlerOptions[] } {
  const ttl =
    positiveInteger(
      config.get<string>('AUTH_RATE_LIMIT_WINDOW_SECONDS'),
      DEFAULT_WINDOW_SECONDS,
    ) * 1000;
  return {
    errorMessage: AUTH_RATE_LIMIT_MESSAGE,
    throttlers: Object.values(AUTH_THROTTLERS).map(({ name, env, limit }) => ({
      name,
      ttl,
      limit: positiveInteger(config.get<string>(env), limit),
    })),
  };
}

/**
 * Applies one throttler to a route (the other named throttlers are skipped).
 * Place it below any other @UseGuards of the route, so the attempt is counted
 * before the other guards (e.g. the credential check of login) run.
 */
export function AuthRateLimit(group: AuthRateLimitGroup) {
  const skipOthers = Object.fromEntries(
    Object.entries(AUTH_THROTTLERS)
      .filter(([key]) => key !== group)
      .map(([, { name }]) => [name, true]),
  );
  return applyDecorators(SkipThrottle(skipOthers), UseGuards(ThrottlerGuard));
}
