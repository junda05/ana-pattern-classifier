/**
 * Resolves a client-supplied file name inside an upload folder.
 *
 * Route parameters are URL-decoded by the framework, so "..%2F.env" arrives
 * as "../.env". Only a bare file name is accepted: empty names, "." and "..",
 * names containing a path separator (forward or back slash) or a NUL byte are
 * rejected, and the resolved path must stay inside the root.
 */

import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

const INVALID_NAME_MESSAGE = 'Invalid file name.';

/**
 * @param root - Upload folder (absolute or relative to the working directory)
 * @param filename - File name received from the client
 * @returns Absolute path of the file inside root
 * @throws BadRequestException if the name is not a bare file name inside root
 */
export function safeUploadPath(root: string, filename: string): string {
  if (
    typeof filename !== 'string' ||
    filename.length === 0 ||
    filename === '.' ||
    filename === '..' ||
    /[/\\\0]/.test(filename) ||
    path.basename(filename) !== filename
  ) {
    throw new BadRequestException(INVALID_NAME_MESSAGE);
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, filename);
  if (!resolved.startsWith(resolvedRoot + path.sep)) {
    throw new BadRequestException(INVALID_NAME_MESSAGE);
  }
  return resolved;
}
