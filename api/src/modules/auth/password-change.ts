/**
 * Sessions end on password reset
 *
 * A reset stores Users.passwordChangedAt; every JWT issued before that instant
 * (access or refresh) is rejected by JwtStrategy and by refreshAccessToken.
 *
 * `iat` has one-second resolution, so a token issued in the same second as
 * the reset, but before it, cannot be told apart from one issued just after
 * it: both are rejected (fail safe; logging in again a second later works).
 */

export const PASSWORD_CHANGED_MESSAGE =
  'The session ended because the password was changed.';

/**
 * Whether a token issued at `iat` (seconds since the epoch) predates the last
 * password change. A token without `iat` counts as older once the password
 * has been changed.
 */
export function issuedBeforePasswordChange(
  iat: number | undefined,
  passwordChangedAt: Date | null | undefined,
): boolean {
  if (!passwordChangedAt) {
    return false;
  }
  if (typeof iat !== 'number') {
    return true;
  }
  return iat * 1000 < passwordChangedAt.getTime();
}
