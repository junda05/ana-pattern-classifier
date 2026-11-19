import React, { useId } from 'react';
import { colors } from '../../config/colors';
import { ACMapping, normalizePredictionToEnum } from '../../config/classMapping';

/**
 * Simple selector listing every class grouped by category
 * Alternative to the hierarchical selector for the correction modal
 *
 * @param {string} [excludedValue] - Class that cannot be chosen (the model's own prediction:
 *   a "correction" to it would change nothing); its option is shown disabled
 */
const SimpleClassSelector = ({
  value = '',
  onChange,
  disabled = false,
  label = 'Corrected Classification',
  ariaLabel,
  placeholder = 'Keep original prediction',
  excludedValue = null
}) => {
  const selectId = useId();
  const excludedKey = normalizePredictionToEnum(excludedValue);

  // Group every class by category
  const classGroups = [
    {
      label: 'General',
      classes: ACMapping.GENERAL
    },
    {
      label: 'Nuclear (competent)',
      classes: ACMapping.NUCLEAR_COMPETENT
    },
    {
      label: 'Cytoplasmic (competent)',
      classes: ACMapping.CYTOPLASMIC_COMPETENT
    },
    {
      label: 'Nucleolar (expert)',
      classes: ACMapping.NUCLEOLAR_EXPERT
    },
    {
      label: 'Cytoplasmic Speckled (expert)',
      classes: ACMapping.CYTOPLASMIC_SPECKLED_EXPERT
    },
    {
      label: 'Mitotic (expert)',
      classes: ACMapping.MITOTIC_EXPERT
    }
  ];

  /**
   * Formats the class name with its AC code
   * Format: "AC-X Classification Name"
   */
  const formatOption = (className, classInfo) => {
    // Use the display name from classInfo, or format the class key
    const formattedName = classInfo.name || className
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Get the AC code
    const acCode = classInfo.acCode;
    
    // Return with the AC code first
    if (acCode) {
      return `${acCode} ${formattedName}`;
    }
    
    return formattedName;
  };

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      
      <select
        id={selectId}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        style={{
          '--tw-ring-color': colors.primary.red
        }}
      >
        <option value="">{placeholder}</option>
        
        {classGroups.map((group, groupIndex) => (
          <optgroup key={groupIndex} label={group.label}>
            {Object.entries(group.classes).map(([className, classInfo]) => (
              <option key={className} value={className} disabled={className === excludedKey}>
                {formatOption(className, classInfo)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export default SimpleClassSelector;
