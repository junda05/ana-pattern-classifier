/**
 * Reads the previousValue/newValue columns of an audit record.
 *
 * Consolidated and CREATE/DELETE records store a JSON object, while per-field
 * UPDATE and password-reset records store plain text (e.g. "VERIFIED"). Only
 * values that look like a JSON object are parsed; plain values return null
 * without an error. Malformed JSON objects are reported through `onError`.
 */

export function parseAuditJson(
  value: string | null | undefined,
  onError?: (error: unknown) => void,
): Record<string, unknown> | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch (error) {
    onError?.(error);
    return null;
  }
}
