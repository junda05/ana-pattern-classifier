import { latestCorrection } from './latest-correction';

describe('latestCorrection', () => {
  const at = (iso: string) => new Date(iso);

  it('returns undefined when there are no corrections', () => {
    expect(latestCorrection(undefined)).toBeUndefined();
    expect(latestCorrection(null)).toBeUndefined();
    expect(latestCorrection([])).toBeUndefined();
  });

  it('picks the newest correctedDate regardless of the array order', () => {
    const corrections = [
      {
        correctedResultId: 1,
        correctedDate: at('2026-01-01T10:00:00Z'),
        correctedPrediction: 'A',
      },
      {
        correctedResultId: 3,
        correctedDate: at('2026-01-03T10:00:00Z'),
        correctedPrediction: 'C',
      },
      {
        correctedResultId: 2,
        correctedDate: at('2026-01-02T10:00:00Z'),
        correctedPrediction: 'B',
      },
    ];

    expect(latestCorrection(corrections)?.correctedPrediction).toBe('C');
  });

  it('does not depend on ids when dates differ', () => {
    const corrections = [
      { correctedResultId: 9, correctedDate: at('2026-01-01T10:00:00Z') },
      { correctedResultId: 4, correctedDate: at('2026-02-01T10:00:00Z') },
    ];

    expect(latestCorrection(corrections)?.correctedResultId).toBe(4);
  });

  it('breaks ties on the same timestamp with the highest id', () => {
    const corrections = [
      { correctedResultId: 5, correctedDate: at('2026-01-01T10:00:00Z') },
      { correctedResultId: 6, correctedDate: at('2026-01-01T10:00:00Z') },
    ];

    expect(latestCorrection(corrections)?.correctedResultId).toBe(6);
  });

  it('accepts ISO strings (values stored in audit JSON)', () => {
    const corrections = [
      { correctedResultId: 1, correctedDate: '2026-03-01T10:00:00.000Z' },
      { correctedResultId: 2, correctedDate: '2026-02-01T10:00:00.000Z' },
    ];

    expect(latestCorrection(corrections)?.correctedResultId).toBe(1);
  });

  it('does not reorder the input array', () => {
    const corrections = [
      { correctedResultId: 1, correctedDate: at('2026-01-01T10:00:00Z') },
      { correctedResultId: 2, correctedDate: at('2026-01-02T10:00:00Z') },
    ];

    latestCorrection(corrections);

    expect(corrections.map((c) => c.correctedResultId)).toEqual([1, 2]);
  });
});
