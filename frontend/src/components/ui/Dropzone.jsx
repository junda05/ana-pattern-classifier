import React, { useState, useRef } from 'react';
import { colors } from '../../config/colors';
import { Icon } from '../Icons/icons';
import { pluralize } from '../../services/utils/stringUtils';

/**
 * Whether a file matches an `accept` list ("image/*", "image/png", ".tif", comma-separated).
 * The browser only applies `accept` to its file picker, never to dropped files.
 *
 * @param {File} file - Candidate file
 * @param {string} accept - Accept list; empty accepts everything
 * @returns {boolean}
 */
export const matchesAccept = (file, accept) => {
  const rules = (accept || '').split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0) return true;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
};

const rejectionMessage = (files) => {
  const names = files.map((file) => file.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1 ? `${list} is not a supported file type.` : `${list} are not supported file types.`;
};

/**
 * Reusable file dropzone supporting drag and drop and manual file selection.
 * Files that do not match `acceptedFiles` are skipped (dropped or picked) with a message;
 * while `disabled` the dropzone ignores drops and the picker cannot be opened.
 *
 * Keyboard: the file input stays in the tab order (visually hidden with `sr-only`, not
 * `display: none`); its "Select Files" label shows the focus ring and Enter/Space open
 * the picker. The number of selected files is announced through a status region.
 */
const Dropzone = ({
  onFilesSelect,
  acceptedFiles = "image/*",
  multiple = true,
  disabled = false,
  className = ""
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [rejectedMessage, setRejectedMessage] = useState('');
  const fileInputRef = useRef(null);

  const selectFiles = (files) => {
    if (disabled || files.length === 0) return;
    const accepted = files.filter((file) => matchesAccept(file, acceptedFiles));
    const rejected = files.filter((file) => !matchesAccept(file, acceptedFiles));
    setRejectedMessage(rejected.length > 0 ? rejectionMessage(rejected) : '');
    if (accepted.length === 0) return;
    setSelectedCount(accepted.length);
    onFilesSelect(accepted);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    selectFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e) => {
    selectFiles(Array.from(e.target.files));
    // Allow picking the same file again after it was removed from the list
    e.target.value = '';
  };

  return (
    <div
        data-testid="dropzone"
        aria-disabled={disabled || undefined}
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-all duration-300 ease-in-out ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        style={{
          borderColor: isDragOver ? colors.dropzone.borderHover : colors.dropzone.borderDefault,
          backgroundColor: isDragOver ? colors.dropzone.backgroundHover : 'transparent',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={(e) => {
          if (!isDragOver && !disabled) {
            e.currentTarget.style.borderColor = colors.dropzone.borderHover;
            e.currentTarget.style.backgroundColor = colors.dropzone.backgroundHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragOver) {
            e.currentTarget.style.borderColor = colors.dropzone.borderDefault;
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
    >
      <Icon 
        name="upload" 
        size="xxl" 
        className="mx-auto text-gray-400 mb-4"
        aria-hidden="true"
      />
      
      <p className="text-gray-600 mb-2">Drag and drop images here</p>
      <p className="text-gray-500 text-sm mb-4">or</p>
      
      <label
        className={`inline-block py-2 px-6 rounded-md text-white ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} transition-colors focus-within:ring-2 focus-within:ring-brand-red focus-within:ring-offset-2`}
        style={{
          backgroundColor: colors.primary.red,
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = colors.primary.redHover;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = colors.primary.red;
        }}
      >
        Select Files
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={acceptedFiles}
          disabled={disabled}
          onChange={handleFileSelect}
          onKeyDown={handleInputKeyDown}
        />
      </label>

      {rejectedMessage && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {rejectedMessage}
        </p>
      )}

      <p className="sr-only" role="status">
        {selectedCount > 0 ? `${pluralize(selectedCount, 'image', 'images')} selected.` : ''}
      </p>
    </div>
  );
};

export default Dropzone;
