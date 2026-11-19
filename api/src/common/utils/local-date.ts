/**
 * Local calendar dates (YYYY-MM-DD) to UTC instants.
 *
 * The database stores UTC. A date typed by a user ("results of 2026-09-24")
 * means a day in the laboratory's time zone (APP_TIMEZONE), so its bounds are
 * the UTC instants of that local day's midnights. The offset comes from
 * Intl.DateTimeFormat, so daylight saving time is honoured.
 */

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Time zone that local dates refer to (APP_TIMEZONE, UTC by default). */
export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || 'UTC';
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (local - UTC). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const localAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return localAsUtc - Math.floor(instant / 1000) * 1000;
}

function parseLocalDate(date: string): number {
  const match = LOCAL_DATE.exec(date);
  if (!match) {
    throw new Error(`Invalid local date "${date}"; expected YYYY-MM-DD.`);
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(midnightAsUtc: number, timeZone: string): Date {
  // First guess with the offset at that wall time, then correct once in case
  // the offset differs at the resulting instant (DST change on that day).
  const guess = midnightAsUtc - zoneOffsetMs(midnightAsUtc, timeZone);
  return new Date(midnightAsUtc - zoneOffsetMs(guess, timeZone));
}

/** UTC instant at which the local day `date` (YYYY-MM-DD) starts in `timeZone`. */
export function startOfLocalDayUtc(date: string, timeZone: string): Date {
  return startOfDay(parseLocalDate(date), timeZone);
}

/**
 * UTC bounds of an inclusive range of local dates: `from` is the start of the
 * first day (inclusive), `to` the start of the day after the last one
 * (exclusive). Missing dates give undefined bounds.
 */
export function localDateRangeToUtc(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  timeZone: string,
): { from: Date | undefined; to: Date | undefined } {
  return {
    from: dateFrom ? startOfLocalDayUtc(dateFrom, timeZone) : undefined,
    to: dateTo
      ? startOfDay(parseLocalDate(dateTo) + DAY_MS, timeZone)
      : undefined,
  };
}
