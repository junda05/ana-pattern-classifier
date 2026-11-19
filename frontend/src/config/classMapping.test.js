import {
  ACMapping,
  ClassificationLevel,
  getFormattedClassName,
  normalizePredictionToEnum,
  resolveClassKey,
} from './classMapping';

const everyClass = Object.values(ACMapping).flatMap((table) => Object.entries(table));

describe('class key and display name mapping', () => {
  it.each(everyClass)('%s round-trips through its display name', (key, info) => {
    expect(resolveClassKey(key)).toBe(key);
    expect(resolveClassKey(info.name)).toBe(key);
  });

  it.each(everyClass)('%s is formatted with its AC code and display name', (key, info) => {
    expect(getFormattedClassName(key)).toBe(`${info.acCode} ${info.name}`);
  });

  it('keeps the class keys unique across levels', () => {
    const keys = everyClass.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('formats a key at an explicit level', () => {
    expect(getFormattedClassName('NUCLEAR_HOMOGENEOUS', ClassificationLevel.COMPETENT)).toBe('AC-1 Nuclear Homogeneous');
    expect(getFormattedClassName('NUCLEAR', ClassificationLevel.GENERAL)).toBe('AC-1 to AC-14, AC-29 Nuclear');
  });

  it.each([
    ['Cytoplasmic Reticular/AMA', 'CYTOPLASMIC_RETICULAR_AMA'],
    ['cytoplasmic reticular / ama', 'CYTOPLASMIC_RETICULAR_AMA'],
    ['CYTOPLASMIC_RETICULAR_AMA', 'CYTOPLASMIC_RETICULAR_AMA'],
    ['Mitotic NuMA-like', 'MITOTIC_NUMA'],
    ['mitotic numa', 'MITOTIC_NUMA'],
    ['MITOTIC_NUMA', 'MITOTIC_NUMA'],
  ])('resolves the AC-21/AC-26 variant "%s"', (label, key) => {
    expect(resolveClassKey(label)).toBe(key);
  });
});

describe('normalizePredictionToEnum', () => {
  it.each([
    ['AC-4/AC-5 Nuclear Speckled', 'NUCLEAR_SPECKLED'],
    ['AC-15/AC-16/AC-17 Cytoplasmic Fibrillar', 'CYTOPLASMIC_FIBRILLAR'],
    ['AC-1 to AC-14, AC-29 Nuclear', 'NUCLEAR'],
    ['AC-21 Cytoplasmic Reticular/AMA', 'CYTOPLASMIC_RETICULAR_AMA'],
    ['AC-26 Mitotic NuMA-like', 'MITOTIC_NUMA'],
    ['NUCLEOLAR_CLUMPY', 'NUCLEOLAR_CLUMPY'],
  ])('resolves "%s" exactly to %s', (label, key) => {
    expect(normalizePredictionToEnum(label)).toBe(key);
  });

  it.each([[''], ['   '], [null], [undefined]])('returns null for empty input %p instead of NEGATIVE', (value) => {
    expect(normalizePredictionToEnum(value)).toBeNull();
  });

  it.each([['Garbage'], ['Nuclear Homogeneous extra words'], ['AC-99 Unknown pattern']])(
    'returns null for an unknown label "%s" instead of guessing a class',
    (value) => {
      expect(normalizePredictionToEnum(value)).toBeNull();
    }
  );
});
