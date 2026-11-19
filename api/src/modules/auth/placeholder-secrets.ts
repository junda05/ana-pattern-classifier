/**
 * Startup guard against placeholder secrets.
 *
 * The env.example files ship secrets whose value starts with "change-me".
 * If any of them is still in use the API logs a warning; in production
 * (NODE_ENV=production) it refuses to start.
 */

export const GUARDED_SECRETS = [
  'JWT_SECRET',
  'SENDGRID_API_KEY',
  'PREDICTOR_API_KEY',
  'PREDICTION_SIGNING_SECRET',
] as const;

const PLACEHOLDER_PREFIX = 'change-me';

type Env = Record<string, string | undefined>;

/** Names of the guarded secrets whose value still starts with "change-me". */
export function findPlaceholderSecrets(env: Env): string[] {
  return GUARDED_SECRETS.filter((name) =>
    (env[name] ?? '').trim().toLowerCase().startsWith(PLACEHOLDER_PREFIX),
  );
}

/**
 * Warns about placeholder secrets and throws in production.
 * @throws Error when NODE_ENV is "production" and a placeholder secret is set
 */
export function checkPlaceholderSecrets(
  env: Env,
  logger: { warn(message: string): void },
): void {
  const placeholders = findPlaceholderSecrets(env);
  if (placeholders.length === 0) {
    return;
  }

  const names = placeholders.join(', ');
  logger.warn(
    `Placeholder secrets in use: ${names}. Replace them before deploying.`,
  );

  if (env.NODE_ENV === 'production') {
    throw new Error(
      `Refusing to start in production with placeholder secrets: ${names}.`,
    );
  }
}
