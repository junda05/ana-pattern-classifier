/**
 * Selects the current ("latest") correction of a prediction.
 *
 * Relations loaded by TypeORM are unordered, so the latest correction is always
 * chosen explicitly: newest correctedDate first, then the highest
 * correctedResultId when two corrections share a timestamp. Used by results,
 * reports and the audit trail so all of them agree on the final pattern.
 */

export interface CorrectionLike {
  correctedResultId?: number;
  correctedDate?: Date | string | null;
}

function timestamp(value: Date | string | null | undefined): number {
  if (value == null) {
    return Number.NEGATIVE_INFINITY;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Positive when `a` is newer than `b`. */
export function compareCorrections(
  a: CorrectionLike,
  b: CorrectionLike,
): number {
  const byDate = timestamp(a.correctedDate) - timestamp(b.correctedDate);
  if (byDate !== 0) {
    return byDate;
  }
  return (a.correctedResultId ?? 0) - (b.correctedResultId ?? 0);
}

export function latestCorrection<T extends CorrectionLike>(
  corrections: readonly T[] | null | undefined,
): T | undefined {
  if (!corrections || corrections.length === 0) {
    return undefined;
  }
  return corrections.reduce((latest, candidate) =>
    compareCorrections(candidate, latest) > 0 ? candidate : latest,
  );
}
