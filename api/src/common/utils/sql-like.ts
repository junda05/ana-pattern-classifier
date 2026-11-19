/**
 * Helpers for SQL Server LIKE searches on user input.
 *
 * SQL Server treats %, _ and [ as wildcards; wrapping each in brackets makes
 * it a literal without an ESCAPE clause.
 */

/** Escapes the SQL Server LIKE wildcards in user input. */
export function escapeLike(value: string): string {
  return value.replace(/[%_[]/g, (character) => `[${character}]`);
}

/**
 * "Contains" pattern for a case-insensitive search: trimmed, lower-cased and
 * escaped. Compare it with LOWER(column).
 */
export function containsPattern(value: string): string {
  return `%${escapeLike(value.trim().toLowerCase())}%`;
}
