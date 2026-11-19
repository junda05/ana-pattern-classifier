/**
 * Expression of a CHECK constraint that limits a varchar column to the
 * values of an enum, for the @Check decorators of the entities. The
 * constraints themselves are created by the CheckConstraints migration with
 * the same names.
 */
export function checkIn(
  column: string,
  values: Record<string, string>,
): string {
  const list = Object.values(values)
    .map((value) => `'${value}'`)
    .join(', ');
  return `"${column}" IN (${list})`;
}
