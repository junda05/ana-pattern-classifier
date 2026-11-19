/**
 * Minute-based durations for configuration values such as
 * PASSWORD_RESET_TOKEN_EXPIRATION ("30m", "2h", "1d"; a bare number means minutes).
 */

const UNIT_MINUTES: Record<string, number> = { m: 1, h: 60, d: 1440 };

/** @returns The duration in whole minutes, or null if the value is missing or invalid */
export function parseDurationMinutes(value: string | undefined): number | null {
  const match = /^\s*(\d+)\s*([mhd])?\s*$/i.exec(value ?? '');
  if (!match) {
    return null;
  }
  const minutes =
    Number(match[1]) * UNIT_MINUTES[(match[2] ?? 'm').toLowerCase()];
  return minutes > 0 ? minutes : null;
}

/** Human-readable duration: "1 minute", "30 minutes", "1 hour", "2 hours", "90 minutes" */
export function formatMinutes(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
