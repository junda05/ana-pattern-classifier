import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delay` milliseconds.
 *
 * @param {*} value - Value that changes (e.g. what the user types)
 * @param {number} [delay=300] - Wait after the last change, in milliseconds
 * @returns {*} The settled value
 */
const useDebouncedValue = (value, delay = 300) => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
};

export default useDebouncedValue;
