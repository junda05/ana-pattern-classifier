import React from 'react';
import { colors } from '../../config/colors';
import { DILUTION_OPTIONS } from '../../services/utils/constants';

/**
 * Dilution picker (1:80 … 1:2560) for one image.
 *
 * @param {string} fileName - Image name, used in the accessible group label
 * @param {string} value - Selected dilution value
 * @param {Function} onChange - Called with the new dilution value
 * @param {boolean} disabled - Read-only
 */
export const DilutionPicker = ({ fileName, value, onChange, disabled = false }) => (
  <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Sample dilution for ${fileName}`}>
    {DILUTION_OPTIONS.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={selected}
          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all disabled:cursor-not-allowed ${
            selected ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100 disabled:opacity-60'
          }`}
          style={{ backgroundColor: selected ? colors.primary.red : undefined }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/**
 * Preview of the selected images, with a dilution picker for each one.
 * Images carry a stable id, a preview URL owned by the parent (created once
 * per image and revoked by the parent) and their own dilution.
 *
 * @param {Array<{id, file, previewUrl, dilution}>} images - Selected images
 * @param {Function} onRemove - Called with the id of the image to remove
 * @param {Function} onDilutionChange - Called with (id, dilution)
 * @param {boolean} disabled - Blocks changes (e.g. while analyzing or saving)
 */
const ImagePreview = ({ images, onRemove, onDilutionChange, disabled = false, className = '' }) => {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className={`mt-6 ${className}`}>
      <h3
        className="text-lg font-semibold mb-4"
        style={{ color: colors.primary.red }}
      >
        Selected Images
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map(({ id, file, previewUrl, dilution }) => (
          <div key={id} className="relative border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <div className="aspect-square bg-gray-100 rounded-md mb-2 overflow-hidden">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="text-center mb-3">
              <p className="text-sm text-gray-700 truncate font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div className="border-t pt-3">
              <p className="block text-xs font-medium text-gray-700 mb-2">
                Sample Dilution
              </p>
              <DilutionPicker
                fileName={file.name}
                value={dilution}
                onChange={(value) => onDilutionChange(id, value)}
                disabled={disabled}
              />
            </div>

            <button
              type="button"
              onClick={() => onRemove(id)}
              disabled={disabled}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow-md disabled:opacity-50"
              title="Remove image"
              aria-label={`Remove ${file.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImagePreview;
