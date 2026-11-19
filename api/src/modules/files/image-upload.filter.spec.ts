import { BadRequestException } from '@nestjs/common';
import { imageFileFilter } from './image-upload.filter';

function check(
  originalname: string,
  mimetype: string,
): { error: Error | null; accepted: boolean } {
  let result: { error: Error | null; accepted: boolean } = {
    error: null,
    accepted: false,
  };
  imageFileFilter(
    {},
    { originalname, mimetype } as Express.Multer.File,
    (error, accepted) => {
      result = { error, accepted };
    },
  );
  return result;
}

describe('imageFileFilter', () => {
  it.each([
    ['cells.png', 'image/png'],
    ['cells.JPG', 'image/jpeg'],
    ['cells.jpeg', 'image/jpeg'],
    ['cells.bmp', 'image/bmp'],
    ['cells.tiff', 'image/tiff'],
  ])('accepts %s (%s)', (name, mime) => {
    expect(check(name, mime)).toEqual({ error: null, accepted: true });
  });

  it('rejects a disallowed MIME type with 400', () => {
    const { error, accepted } = check('notes.txt', 'text/plain');
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error?.message).toContain('text/plain');
  });

  it('rejects an image MIME type with a disallowed extension', () => {
    const { error, accepted } = check('payload.exe', 'image/png');
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error?.message).toContain('.exe');
  });

  it('rejects a file without an extension', () => {
    const { error, accepted } = check('cells', 'image/png');
    expect(accepted).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
  });
});
