import { formatMinutes, parseDurationMinutes } from './duration';

describe('parseDurationMinutes', () => {
  it.each([
    ['30m', 30],
    ['45', 45],
    [' 15m ', 15],
    ['2h', 120],
    ['1d', 1440],
  ])('parses %p as %i minutes', (value, minutes) => {
    expect(parseDurationMinutes(value)).toBe(minutes);
  });

  it.each([undefined, '', 'abc', '0m', '-5m', '1.5h', '10x'])(
    'returns null for %p',
    (value) => {
      expect(parseDurationMinutes(value)).toBeNull();
    },
  );
});

describe('formatMinutes', () => {
  it.each([
    [1, '1 minute'],
    [30, '30 minutes'],
    [60, '1 hour'],
    [90, '90 minutes'],
    [120, '2 hours'],
  ])('formats %i as %p', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});
