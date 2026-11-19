/**
 * Public base URL of this API.
 *
 * Single source for every absolute URL the API returns (image URLs in results,
 * reports, the audit trail and the prediction DTO). Read on every call so tests
 * and tooling can change API_BASE_URL at runtime.
 */

export const DEFAULT_API_BASE_URL = 'http://localhost:8001';

/** Base URL from API_BASE_URL (default http://localhost:8001), without a trailing slash. */
export function apiBaseUrl(): string {
  const configured = process.env.API_BASE_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

/**
 * Absolute URL of a stored prediction image, served by the JWT-protected files
 * controller. Returns undefined when there is no stored image.
 */
export function predictionImageUrl(
  imagePath: string | null | undefined,
): string | undefined {
  if (!imagePath) {
    return undefined;
  }
  return `${apiBaseUrl()}/api/v1/files/predictions/${encodeURIComponent(imagePath)}`;
}
