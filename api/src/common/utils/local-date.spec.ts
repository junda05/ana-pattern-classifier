import { localDateRangeToUtc, startOfLocalDayUtc } from './local-date';

describe('startOfLocalDayUtc', () => {
  it('returns midnight UTC for the UTC time zone', () => {
    expect(startOfLocalDayUtc('2026-09-24', 'UTC').toISOString()).toBe(
      '2026-09-24T00:00:00.000Z',
    );
  });

  it('shifts by the zone offset (America/Lima is UTC-5 all year, no DST)', () => {
    expect(startOfLocalDayUtc('2026-09-24', 'America/Lima').toISOString()).toBe(
      '2026-09-24T05:00:00.000Z',
    );
  });

  it('handles zones ahead of UTC (Asia/Tokyo is UTC+9)', () => {
    expect(startOfLocalDayUtc('2026-01-01', 'Asia/Tokyo').toISOString()).toBe(
      '2025-12-31T15:00:00.000Z',
    );
  });

  it('follows daylight saving time (Europe/Madrid)', () => {
    // CET (UTC+1) in winter, CEST (UTC+2) in summer
    expect(
      startOfLocalDayUtc('2026-01-15', 'Europe/Madrid').toISOString(),
    ).toBe('2026-01-14T23:00:00.000Z');
    expect(
      startOfLocalDayUtc('2026-07-15', 'Europe/Madrid').toISOString(),
    ).toBe('2026-07-14T22:00:00.000Z');
  });

  it('rejects a malformed date', () => {
    expect(() => startOfLocalDayUtc('2026-9-1', 'UTC')).toThrow(
      'Invalid local date "2026-9-1"; expected YYYY-MM-DD.',
    );
  });
});

describe('localDateRangeToUtc', () => {
  it('turns inclusive local dates into [from, to) UTC bounds', () => {
    const { from, to } = localDateRangeToUtc(
      '2026-09-01',
      '2026-09-30',
      'America/Lima',
    );
    expect(from?.toISOString()).toBe('2026-09-01T05:00:00.000Z');
    // The whole last local day is included: the bound is the next local midnight
    expect(to?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
  });

  it('crosses month and year boundaries for the exclusive end', () => {
    const { to } = localDateRangeToUtc(undefined, '2026-12-31', 'UTC');
    expect(to?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('leaves missing bounds undefined', () => {
    expect(localDateRangeToUtc(undefined, undefined, 'UTC')).toEqual({
      from: undefined,
      to: undefined,
    });
  });
});
