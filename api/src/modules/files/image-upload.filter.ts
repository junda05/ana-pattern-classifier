/**
 * Multer file filter shared by every image upload endpoint.
 *
 * Accepts a file only when both its MIME type and its extension are in the
 * allow-lists of files.types.ts; anything else is rejected with 400 before
 * the file is buffered.
 */

import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  AllowedFileExtension,
  AllowedMimeType,
} from './files.types';

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

export function imageFileFilter(
  _request: unknown,
  file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>,
  callback: FileFilterCallback,
): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
    callback(
      new BadRequestException(
        `File type not allowed: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      ),
      false,
    );
    return;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension as AllowedFileExtension)) {
    callback(
      new BadRequestException(
        `File extension not allowed: ${extension || '(none)'}. Allowed extensions: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`,
      ),
      false,
    );
    return;
  }

  callback(null, true);
}
