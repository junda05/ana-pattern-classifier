import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { safeUploadPath } from './safe-upload-path';

describe('safeUploadPath', () => {
  const root = path.resolve('uploads-root', 'predictions');

  it('returns the absolute path of a plain file name inside the root', () => {
    expect(safeUploadPath(root, 'abc-123-cells.png')).toBe(
      path.join(root, 'abc-123-cells.png'),
    );
  });

  it('accepts a relative root and resolves it', () => {
    expect(safeUploadPath('./uploads/predictions', 'x.png')).toBe(
      path.resolve('./uploads/predictions', 'x.png'),
    );
  });

  it.each([
    ['empty', ''],
    ['dot', '.'],
    ['dot-dot', '..'],
    ['parent traversal', '../.env'],
    ['decoded %2F traversal', '..%2F.env'.replace('%2F', '/')],
    ['forward-slash sub-path', 'a/b.png'],
    ['backslash sub-path', 'a\\b.png'],
    ['backslash traversal', '..\\.env'],
    ['absolute path', path.resolve('/etc/passwd')],
    ['NUL byte', 'x\0.png'],
  ])('rejects %s with 400', (_label, name) => {
    expect(() => safeUploadPath(root, name)).toThrow(BadRequestException);
  });

  it('rejects a non-string name', () => {
    expect(() => safeUploadPath(root, undefined as unknown as string)).toThrow(
      BadRequestException,
    );
  });
});
