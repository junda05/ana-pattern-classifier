/**
 * Date formatting helpers shared across the app
 * Output uses the en-US style: "Sep 24, 2026" and "Sep 24, 2026, 10:15 AM"
 */

const DATE_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric' };
const DATE_TIME_OPTIONS = { ...DATE_OPTIONS, hour: 'numeric', minute: '2-digit' };

/**
 * Formats a backend date and time for display
 * @param {string|Date} value - Date to format
 * @returns {string} Date and time such as "Sep 24, 2026, 10:15 AM", or "N/A"
 */
export const formatDate = (value) => {
  if (!value) return 'N/A';

  try {
    const date = new Date(value);

    if (isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-US', DATE_TIME_OPTIONS);
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Formats a date-only value (e.g. a date of birth) without the time
 * Date-only values are stored as UTC midnight, so they are formatted with the
 * UTC calendar: the day never shifts with the browser's time zone.
 * @param {string|Date} value - Date to format ("1990-05-15" or an ISO date-time)
 * @returns {string} Date such as "Sep 24, 2026", or "N/A"
 */
export const formatDateOnly = (value) => {
  if (!value) return 'N/A';

  try {
    const date = new Date(value);

    if (isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString('en-US', { ...DATE_OPTIONS, timeZone: 'UTC' });
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Returns the current date and time for display
 * @returns {string} Current date and time, such as "Sep 24, 2026, 10:15 AM"
 */
export const getCurrentDateTime = () => {
  return new Date().toLocaleString('en-US', DATE_TIME_OPTIONS);
};

