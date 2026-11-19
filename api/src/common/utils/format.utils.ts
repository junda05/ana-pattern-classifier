/**
 * Formatting utilities
 *
 * Centralizes reusable formatting functions so output
 * is consistent across the application.
 *
 * Principles:
 * - DRY: a single source of truth for formats
 * - SRP: each function has a single responsibility
 * - Maintainability: easy to update and test
 */

import * as path from 'path';

/**
 * Extracts the short file name from a full path
 * Removes the UUID and timestamp of the uuid-timestamp-filename.ext format
 *
 * @param filePath - Full file path
 * @returns Short file name
 *
 * @example
 * extractShortFilename('abc123-1234567890-image.jpg') // 'image.jpg'
 * extractShortFilename('/uploads/abc123-1234567890-photo.png') // 'photo.png'
 */
export function extractShortFilename(filePath: string): string {
  if (!filePath) return '';

  // Keep only the file name (no directory)
  const filename = path.basename(filePath);

  // Pattern for files named uuid-timestamp-originalname.ext;
  // captures everything after the UUID and timestamp
  const match = filename.match(/^[a-f0-9-]+-\d+-(.+)$/i);

  if (match && match[1]) {
    return match[1]; // Only the original name
  }

  // Not in the expected format: return the full name
  return filename;
}

/**
 * Formats a dilution value for display (e.g. "80" -> "1:80")
 *
 * @param dilution - Dilution value ('80', '160', ... '2560')
 * @returns Formatted dilution (e.g. '1:80')
 *
 * @example
 * formatDilution('80')  // '1:80'
 * formatDilution('160') // '1:160'
 */
export function formatDilution(dilution: string | number): string {
  return `1:${dilution}`;
}
