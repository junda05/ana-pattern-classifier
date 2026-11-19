/**
 * Normalizes text by removing accents and other diacritics and lowercasing it
 * @param {string} text - Text to normalize
 * @returns {string} Lowercase text without diacritics
 */
const removeAccents = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .normalize('NFD') // Split accented characters into base letter + combining mark
    .replace(/[\u0300-\u036f]/g, '') // Drop the combining marks
    .toLowerCase();
};

/**
 * Checks whether a text contains another, ignoring accents and case
 * @param {string} text - Text to search in
 * @param {string} search - Text to search for
 * @returns {boolean} True if the text contains the search term
 */
export const includesIgnoringAccents = (text, search) => {
  if (!text || !search) return false;
  return removeAccents(text).includes(removeAccents(search));
};

/**
 * Formats a count with the singular or plural form of a noun phrase
 * @param {number|string} count - Count
 * @param {string} singular - Singular form, e.g. "new image"
 * @param {string} [plural] - Plural form (default: singular + "s")
 * @returns {string} e.g. "1 new image", "2 new images"
 */
export const pluralize = (count, singular, plural = `${singular}s`) => {
  const value = Number(count);
  return `${count} ${value === 1 ? singular : plural}`;
};
