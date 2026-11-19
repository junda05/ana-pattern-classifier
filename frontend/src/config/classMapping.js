/**
 * Hierarchical ICAP class mapping for ANA pattern classification
 * Mirrors api-predictor/app/core/class_mapping.py
 *
 * Structure: General → Competent → Expert
 *
 * Class keys are the English ICAP names shared by the predictor (raw class keys),
 * the API PredictionClass enum and this module.
 */

/**
 * Hierarchical classification levels
 */
export const ClassificationLevel = {
  GENERAL: 'general',
  COMPETENT: 'competent',
  EXPERT: 'expert'
};

/**
 * Maps class keys to AC codes and display names
 */
export const ACMapping = {
  // General level
  GENERAL: {
    'NEGATIVE': {
      acCode: 'AC-0',
      name: 'Negative',
      hasCompetent: false,
      hasExpert: false
    },
    'NUCLEAR': {
      acCode: 'AC-1 to AC-14, AC-29',
      name: 'Nuclear',
      hasCompetent: true,
      hasExpert: false
    },
    'CYTOPLASMIC': {
      acCode: 'AC-15 to AC-23',
      name: 'Cytoplasmic',
      hasCompetent: true,
      hasExpert: false
    },
    'MITOTIC': {
      acCode: 'AC-24 to AC-28',
      name: 'Mitotic',
      hasCompetent: false,
      hasExpert: true
    }
  },

  // Competent level - nuclear
  NUCLEAR_COMPETENT: {
    'NUCLEAR_HOMOGENEOUS': {
      acCode: 'AC-1',
      name: 'Nuclear Homogeneous',
      hasExpert: false
    },
    'NUCLEAR_DENSE_FINE_SPECKLED': {
      acCode: 'AC-2',
      name: 'Nuclear Dense Fine Speckled',
      hasExpert: false
    },
    'NUCLEAR_CENTROMERE': {
      acCode: 'AC-3',
      name: 'Nuclear Centromere',
      hasExpert: false
    },
    'NUCLEAR_SPECKLED': {
      acCode: 'AC-4/AC-5',
      name: 'Nuclear Speckled',
      hasExpert: false,
      note: 'No expert model is available for this class'
    },
    'NUCLEOLAR': {
      acCode: 'AC-8 to AC-10',
      name: 'Nucleolar',
      hasExpert: true
    }
  },

  // Competent level - cytoplasmic
  CYTOPLASMIC_COMPETENT: {
    'CYTOPLASMIC_FIBRILLAR': {
      acCode: 'AC-15/AC-16/AC-17',
      name: 'Cytoplasmic Fibrillar',
      hasExpert: false,
      note: 'No expert model is available for this class'
    },
    'CYTOPLASMIC_DISCRETE_DOTS': {
      acCode: 'AC-18',
      name: 'Cytoplasmic Discrete Dots',
      hasExpert: false,
      isExpertLevel: true,
      note: 'AC-18 is an expert-level pattern detected by the competent model'
    },
    'CYTOPLASMIC_SPECKLED': {
      acCode: 'AC-19/AC-20',
      name: 'Cytoplasmic Speckled',
      hasExpert: true
    },
    'CYTOPLASMIC_RETICULAR_AMA': {
      acCode: 'AC-21',
      name: 'Cytoplasmic Reticular/AMA',
      hasExpert: false
    },
    'CYTOPLASMIC_POLAR_GOLGI': {
      acCode: 'AC-22',
      name: 'Cytoplasmic Polar/Golgi-like',
      hasExpert: false
    }
  },

  // Expert level - nucleolar
  NUCLEOLAR_EXPERT: {
    'NUCLEOLAR_HOMOGENEOUS': {
      acCode: 'AC-8',
      name: 'Nucleolar Homogeneous'
    },
    'NUCLEOLAR_CLUMPY': {
      acCode: 'AC-9',
      name: 'Nucleolar Clumpy'
    },
    'NUCLEOLAR_PUNCTATE': {
      acCode: 'AC-10',
      name: 'Nucleolar Punctate'
    }
  },

  // Expert level - cytoplasmic speckled
  CYTOPLASMIC_SPECKLED_EXPERT: {
    'CYTOPLASMIC_DENSE_FINE_SPECKLED': {
      acCode: 'AC-19',
      name: 'Cytoplasmic Dense Fine Speckled'
    },
    'CYTOPLASMIC_FINE_SPECKLED': {
      acCode: 'AC-20',
      name: 'Cytoplasmic Fine Speckled'
    }
  },

  // Expert level - mitotic
  MITOTIC_EXPERT: {
    'MITOTIC_CENTROSOME': {
      acCode: 'AC-24',
      name: 'Mitotic Centrosome'
    },
    'MITOTIC_SPINDLE_FIBERS': {
      acCode: 'AC-25',
      name: 'Mitotic Spindle Fibers'
    },
    'MITOTIC_NUMA': {
      acCode: 'AC-26',
      name: 'Mitotic NuMA-like'
    },
    'MITOTIC_INTERCELLULAR_BRIDGE': {
      acCode: 'AC-27',
      name: 'Mitotic Intercellular Bridge'
    },
    'MITOTIC_CHROMOSOMAL_ENVELOPE': {
      acCode: 'AC-28',
      name: 'Mitotic Chromosomal Envelope'
    }
  }
};

/**
 * Reduces any class label to lookup form: upper case, with every run of
 * characters other than A-Z / 0-9 collapsed into a single underscore.
 * "Nuclear Homogeneous", "nuclear  homogeneous" and "NUCLEAR_HOMOGENEOUS"
 * all become "NUCLEAR_HOMOGENEOUS".
 *
 * @param {string} value - Class key, display name or variant
 * @returns {string} Lookup form
 */
const toLookupKey = (value) =>
  String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Lookup form of every class key and display name → class key.
 */
const CLASS_KEY_LOOKUP = Object.values(ACMapping).reduce((lookup, table) => {
  Object.entries(table).forEach(([key, info]) => {
    lookup[toLookupKey(key)] = key;
    lookup[toLookupKey(info.name)] = key;
  });
  return lookup;
}, {});

/**
 * Resolves a class key, display name (e.g. "Mitotic NuMA-like") or a
 * case/space/underscore variant to its class key
 *
 * @param {string} value - Class label
 * @returns {string|null} Class key, or null if unknown
 */
export const resolveClassKey = (value) => {
  if (!value) return null;
  return CLASS_KEY_LOOKUP[toLookupKey(value)] || null;
};

/**
 * Gets the full information of a class for a level
 *
 * @param {string} level - Classification level (general, competent, expert)
 * @param {string} className - Predicted class key or display name
 * @returns {Object|null} Class information, or null if it does not exist
 */
const getClassInfo = (level, className) => {
  if (!className) return null;

  const classKey = resolveClassKey(className);
  if (!classKey) return null;

  switch (level) {
    case ClassificationLevel.GENERAL:
      return ACMapping.GENERAL[classKey] || null;

    case ClassificationLevel.COMPETENT:
      // Search both competent-level maps
      return ACMapping.NUCLEAR_COMPETENT[classKey] ||
             ACMapping.CYTOPLASMIC_COMPETENT[classKey] ||
             null;

    case ClassificationLevel.EXPERT:
      // Search every expert-level map
      return ACMapping.NUCLEOLAR_EXPERT[classKey] ||
             ACMapping.CYTOPLASMIC_SPECKLED_EXPERT[classKey] ||
             ACMapping.MITOTIC_EXPERT[classKey] ||
             null;

    default:
      return null;
  }
};

/**
 * Formats the final prediction WITH its AC code
 *
 * FORMATTING RULES:
 * - Format: "AC-X Classification Name"
 * - General levels with ranges: "AC-1 to AC-14, AC-29 Nuclear"
 *
 * @param {string} level - Classification level reached
 * @param {string} className - Predicted class
 * @returns {string} Formatted string with AC code
 */
const formatPredictionWithAC = (level, className) => {
  if (!className) return className || 'Unknown';

  const classInfo = getClassInfo(level, className);

  if (!classInfo) {
    return className;
  }

  const name = classInfo.name || className;
  const acCode = classInfo.acCode;

  // Return with the AC code first
  if (acCode) {
    return `${acCode} ${name}`;
  }

  return name;
};

/**
 * Gets the full formatted name of a class
 * If no level is given, every level is searched
 *
 * @param {string} className - Class key or display name
 * @param {string} level - Classification level (optional)
 * @returns {string} Full formatted name
 */
export const getFormattedClassName = (className, level = null) => {
  if (!className) return 'Unknown';

  if (level) {
    return formatPredictionWithAC(level, className);
  }

  // No level given: search every level
  const levels = [
    ClassificationLevel.EXPERT,
    ClassificationLevel.COMPETENT,
    ClassificationLevel.GENERAL
  ];

  for (const lvl of levels) {
    const classInfo = getClassInfo(lvl, className);
    if (classInfo) {
      return formatPredictionWithAC(lvl, className);
    }
  }

  return className;
};

/**
 * Gets the general class of a prediction
 * Used to pick colors per category
 *
 * @param {string} className - Predicted class
 * @returns {string|null} General class (NUCLEAR, CYTOPLASMIC, MITOTIC, NEGATIVE)
 */
export const getGeneralClass = (className) => {
  if (!className) return null;

  // Already a general class
  const classKey = resolveClassKey(className);
  if (classKey && ACMapping.GENERAL[classKey]) {
    return classKey;
  }

  const classNameUpper = className.toUpperCase();

  // Contains NUCLEAR (other than NUCLEOLAR, a competent-level class)
  if (classNameUpper.includes('NUCLEAR') && !classNameUpper.includes('NUCLEOLAR')) {
    return 'NUCLEAR';
  }

  // Contains NUCLEOLAR
  if (classNameUpper.includes('NUCLEOLAR')) {
    return 'NUCLEAR';
  }

  // Contains CYTOPLASMIC
  if (classNameUpper.includes('CYTOPLASM')) {
    return 'CYTOPLASMIC';
  }

  // Contains MITOTIC
  if (classNameUpper.includes('MITOTIC')) {
    return 'MITOTIC';
  }

  // Negative
  if (classNameUpper.includes('NEGATIVE')) {
    return 'NEGATIVE';
  }

  return null;
};

/**
 * Leading AC-code group of a formatted class label, e.g. "AC-26 ",
 * "AC-4/AC-5 ", "AC-15/AC-16/AC-17 " or "AC-1 to AC-14, AC-29 ".
 */
const LEADING_AC_CODES = /^AC-\d+(?:\s*(?:\/|,|to)\s*AC-\d+)*\s*/i;

/**
 * Resolves a class label to the backend PredictionClass enum value, exactly
 *
 * Accepts class keys (e.g. "MITOTIC_NUMA"), display names (e.g.
 * "Mitotic NuMA-like") and their case/space/punctuation variants, with or
 * without a leading AC-code group ("AC-4/AC-5 Nuclear Speckled").
 * Never guesses: anything that is not exactly a known class resolves to null,
 * and callers must refuse to save it.
 *
 * @param {string} label - Class key or formatted class label
 * @returns {string|null} PredictionClass value, or null if empty or unknown
 */
export const normalizePredictionToEnum = (label) => {
  if (typeof label !== 'string') return null;

  const withoutCodes = label.trim().replace(LEADING_AC_CODES, '');
  return resolveClassKey(withoutCodes);
};
