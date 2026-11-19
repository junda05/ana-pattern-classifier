import { pluralize, includesIgnoringAccents } from './stringUtils';

describe('pluralize', () => {
  it.each([
    [0, 'new image', undefined, '0 new images'],
    [1, 'new image', undefined, '1 new image'],
    [2, 'new image', undefined, '2 new images'],
    [1, 'correction', undefined, '1 correction'],
    [3, 'pattern identified', 'patterns identified', '3 patterns identified'],
    [1, 'pattern identified', 'patterns identified', '1 pattern identified'],
  ])('pluralize(%p, %p) → %p', (count, singular, plural, expected) => {
    expect(pluralize(count, singular, plural)).toBe(expected);
  });

  it('parses numeric strings', () => {
    expect(pluralize('1', 'image')).toBe('1 image');
  });
});

describe('includesIgnoringAccents', () => {
  it('matches regardless of accents and case', () => {
    // 'Rene' + combining acute accent + 'e Doe'
    expect(includesIgnoringAccents('Renée Doe', 'renee')).toBe(true);
  });
});
