import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FilesService, assertKnownClass } from './files.service';
import { PredictionClass } from '../../entities/results/result.types';

// Eight-byte PNG signature: stands in for an image without using a real one.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function configFor(uploadsDir: string): ConfigService {
  return {
    get: (key: string, fallback?: unknown) =>
      key === 'UPLOADS_DIR' ? uploadsDir : fallback,
  } as unknown as ConfigService;
}

function fsError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: simulated`), { code });
}

describe('FilesService', () => {
  let uploadsDir: string;
  let predictionsDir: string;
  let referenceDir: string;
  let service: FilesService;
  let loggerError: jest.SpyInstance;

  beforeEach(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-spec-'));
    predictionsDir = path.join(uploadsDir, 'predictions');
    referenceDir = path.join(uploadsDir, 'reference');
    service = new FilesService(configFor(uploadsDir));
    await service.onModuleInit();
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  describe('onModuleInit', () => {
    it('creates the predictions and reference directories', () => {
      expect(fs.statSync(predictionsDir).isDirectory()).toBe(true);
      expect(fs.statSync(referenceDir).isDirectory()).toBe(true);
    });
  });

  describe('getPredictionImagePath', () => {
    it('returns the absolute path of an existing image', async () => {
      fs.writeFileSync(path.join(predictionsDir, 'abc-1-cells.png'), PNG_BYTES);

      await expect(
        service.getPredictionImagePath('abc-1-cells.png'),
      ).resolves.toBe(path.join(predictionsDir, 'abc-1-cells.png'));
    });

    it('does not serve a file outside the predictions folder (../.env)', async () => {
      fs.writeFileSync(path.join(uploadsDir, '.env'), 'JWT_SECRET=secret');

      await expect(
        service.getPredictionImagePath('../.env'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['a/b.png', 'a\\b.png', '.', '..', ''])(
      'rejects %p with 400',
      async (name) => {
        await expect(
          service.getPredictionImagePath(name),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('returns 404 for a plain name that does not exist', async () => {
      await expect(
        service.getPredictionImagePath('missing.png'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 for a directory name', async () => {
      fs.mkdirSync(path.join(predictionsDir, 'folder.png'));

      await expect(
        service.getPredictionImagePath('folder.png'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePredictionImages', () => {
    it('deletes existing images', async () => {
      const first = path.join(predictionsDir, 'abc-1-cells.png');
      const second = path.join(predictionsDir, 'def-2-cells.png');
      fs.writeFileSync(first, PNG_BYTES);
      fs.writeFileSync(second, PNG_BYTES);

      await service.deletePredictionImages([
        'abc-1-cells.png',
        'def-2-cells.png',
      ]);

      expect(fs.existsSync(first)).toBe(false);
      expect(fs.existsSync(second)).toBe(false);
    });

    it('never deletes a file outside the predictions folder', async () => {
      const secret = path.join(uploadsDir, '.env');
      fs.writeFileSync(secret, 'JWT_SECRET=secret');

      await service.deletePredictionImages(['../.env', 'a/b.png', '..', '']);

      expect(fs.existsSync(secret)).toBe(true);
    });

    it('keeps deleting the other images when one is missing', async () => {
      const existing = path.join(predictionsDir, 'abc-1-cells.png');
      fs.writeFileSync(existing, PNG_BYTES);

      await service.deletePredictionImages(['missing.png', 'abc-1-cells.png']);

      expect(fs.existsSync(existing)).toBe(false);
    });

    it('logs an unexpected file-system error without throwing', async () => {
      fs.writeFileSync(path.join(predictionsDir, 'locked.png'), PNG_BYTES);
      jest.spyOn(fs.promises, 'unlink').mockRejectedValueOnce(fsError('EPERM'));

      await expect(
        service.deletePredictionImages(['locked.png']),
      ).resolves.toBeUndefined();
      expect(loggerError).toHaveBeenCalled();
    });

    it('does nothing for an empty list', async () => {
      await expect(service.deletePredictionImages([])).resolves.toBeUndefined();
    });
  });

  describe('logging', () => {
    it('never logs the original upload name (only an opaque reference to the stored file)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const upload = {
        originalname: 'jane-doe-serum.png',
        mimetype: 'image/png',
        buffer: PNG_BYTES,
      } as Express.Multer.File;

      const storedName = await service.savePredictionImage(upload);
      await service.deletePredictionImages([storedName]);

      const logged = [logSpy, warnSpy, loggerError]
        .flatMap((spy) => spy.mock.calls as unknown[][])
        .flat()
        .map(String)
        .join('\n');
      expect(logged).not.toMatch(/jane|serum/i);
      expect(logged).toContain(storedName.split('-jane')[0]);
    });

    it('does not leak the name through file-system error messages (which embed the path)', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const pathError = (syscall: string, code: string) =>
        jest.fn((target: unknown) =>
          Promise.reject(
            Object.assign(
              new Error(`${code}: failed, ${syscall} '${String(target)}'`),
              { code, syscall },
            ),
          ),
        );
      jest
        .spyOn(fs.promises, 'writeFile')
        .mockImplementationOnce(pathError('open', 'EACCES'));
      jest
        .spyOn(fs.promises, 'unlink')
        .mockImplementationOnce(pathError('unlink', 'EPERM'));
      jest
        .spyOn(fs.promises, 'stat')
        .mockImplementationOnce(pathError('stat', 'EACCES'));
      const upload = {
        originalname: 'jane-doe-serum.png',
        mimetype: 'image/png',
        buffer: PNG_BYTES,
      } as Express.Multer.File;
      const storedName = service.generateUniqueFilename('jane-doe-serum.png');

      await expect(service.savePredictionImage(upload)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      await service.deletePredictionImages([storedName]);
      await expect(
        service.getPredictionImagePath(storedName),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      const logged = [warnSpy, loggerError]
        .flatMap((spy) => spy.mock.calls as unknown[][])
        .flat()
        .map(String)
        .join('\n');
      expect(loggerError).toHaveBeenCalledTimes(3);
      expect(logged).not.toMatch(/jane|serum/i);
      expect(logged).toMatch(/EACCES/);
      expect(logged).toMatch(/EPERM/);
    });
  });

  describe('assertKnownClass', () => {
    it('accepts a PredictionClass value', () => {
      expect(() => assertKnownClass('NUCLEAR_HOMOGENEOUS')).not.toThrow();
    });

    it.each(['nuclear_homogeneous', 'UNKNOWN', '', '..'])(
      'rejects %p with 400',
      (value) => {
        expect(() => assertKnownClass(value)).toThrow(BadRequestException);
      },
    );
  });

  describe('getReferenceClasses', () => {
    it('returns [] when the reference folder is missing', async () => {
      fs.rmSync(referenceDir, { recursive: true });

      await expect(service.getReferenceClasses()).resolves.toEqual([]);
    });

    it('returns [] when the reference path is a file (ENOTDIR)', async () => {
      fs.rmSync(referenceDir, { recursive: true });
      fs.writeFileSync(referenceDir, 'not a folder');

      await expect(service.getReferenceClasses()).resolves.toEqual([]);
    });

    it('lists only known class folders, in PredictionClass order', async () => {
      for (const name of [
        'CYTOPLASMIC_FIBRILLAR',
        'NUCLEOLAR',
        'UNKNOWN_CLASS',
        'NEGATIVE',
      ]) {
        fs.mkdirSync(path.join(referenceDir, name));
      }
      fs.writeFileSync(
        path.join(referenceDir, 'NUCLEAR'),
        'a file, not a folder',
      );

      await expect(service.getReferenceClasses()).resolves.toEqual([
        PredictionClass.NEGATIVE,
        PredictionClass.NUCLEOLAR,
        PredictionClass.CYTOPLASMIC_FIBRILLAR,
      ]);
    });

    it('logs and returns 500 on an unexpected file-system error', async () => {
      jest
        .spyOn(fs.promises, 'readdir')
        .mockRejectedValueOnce(fsError('EACCES'));

      await expect(service.getReferenceClasses()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(loggerError).toHaveBeenCalled();
    });
  });

  describe('getReferenceImagesByClass', () => {
    it('rejects an unknown class with 400', async () => {
      await expect(
        service.getReferenceImagesByClass('../predictions'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns [] when the class has no folder', async () => {
      await expect(
        service.getReferenceImagesByClass('NUCLEAR_HOMOGENEOUS'),
      ).resolves.toEqual([]);
    });

    it('returns [] when the class path is a file (ENOTDIR)', async () => {
      fs.writeFileSync(
        path.join(referenceDir, 'NUCLEAR_HOMOGENEOUS'),
        'not a folder',
      );

      await expect(
        service.getReferenceImagesByClass('NUCLEAR_HOMOGENEOUS'),
      ).resolves.toEqual([]);
    });

    it('lists allowed image files sorted by name, skipping other files and folders', async () => {
      const classDir = path.join(referenceDir, 'NUCLEAR_HOMOGENEOUS');
      fs.mkdirSync(classDir);
      for (const name of ['img10.png', 'img2.png', 'b.JPG', 'notes.txt']) {
        fs.writeFileSync(path.join(classDir, name), PNG_BYTES);
      }
      fs.mkdirSync(path.join(classDir, 'folder.png'));

      const images = await service.getReferenceImagesByClass(
        'NUCLEAR_HOMOGENEOUS',
      );

      expect(images.map((image) => image.filename)).toEqual([
        'b.JPG',
        'img2.png',
        'img10.png',
      ]);
      expect(images[0].url).toBe('/files/reference/NUCLEAR_HOMOGENEOUS/b.JPG');
    });

    it('logs and returns 500 on an unexpected file-system error', async () => {
      fs.mkdirSync(path.join(referenceDir, 'NUCLEAR_HOMOGENEOUS'));
      jest
        .spyOn(fs.promises, 'readdir')
        .mockRejectedValueOnce(fsError('EACCES'));

      await expect(
        service.getReferenceImagesByClass('NUCLEAR_HOMOGENEOUS'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(loggerError).toHaveBeenCalled();
    });
  });

  describe('getReferenceImagePath', () => {
    beforeEach(() => {
      const classDir = path.join(referenceDir, 'NUCLEAR_HOMOGENEOUS');
      fs.mkdirSync(classDir);
      fs.writeFileSync(path.join(classDir, 'example.png'), PNG_BYTES);
      fs.writeFileSync(path.join(classDir, 'notes.txt'), 'text');
    });

    it('returns the absolute path of an existing reference image', async () => {
      await expect(
        service.getReferenceImagePath('NUCLEAR_HOMOGENEOUS', 'example.png'),
      ).resolves.toBe(
        path.join(referenceDir, 'NUCLEAR_HOMOGENEOUS', 'example.png'),
      );
    });

    it('rejects an unknown class with 400', async () => {
      await expect(
        service.getReferenceImagePath('UNKNOWN', 'example.png'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['', '.', '..', '../../.env', 'a/b.png', 'a\\b.png'])(
      'rejects file name %p with 400',
      async (name) => {
        await expect(
          service.getReferenceImagePath('NUCLEAR_HOMOGENEOUS', name),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('rejects a disallowed extension with 400 even if the file exists', async () => {
      await expect(
        service.getReferenceImagePath('NUCLEAR_HOMOGENEOUS', 'notes.txt'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 404 for a missing image', async () => {
      await expect(
        service.getReferenceImagePath('NUCLEAR_HOMOGENEOUS', 'missing.png'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('savePredictionImage', () => {
    it('stores the file under a unique sanitized name inside the predictions folder', async () => {
      const file = {
        originalname: '../evil name.png',
        mimetype: 'image/png',
        buffer: PNG_BYTES,
      } as Express.Multer.File;

      const name = await service.savePredictionImage(file);

      expect(name).toMatch(/^[0-9a-f-]+-\d+-evil_name\.png$/);
      expect(fs.readFileSync(path.join(predictionsDir, name))).toEqual(
        PNG_BYTES,
      );
    });
  });

  describe('savePredictionImages', () => {
    function pngFile(originalname: string): Express.Multer.File {
      return {
        originalname,
        mimetype: 'image/png',
        buffer: PNG_BYTES,
      } as Express.Multer.File;
    }

    it('saves every file and returns the names in upload order', async () => {
      const names = await service.savePredictionImages([
        pngFile('first.png'),
        pngFile('second.png'),
      ]);

      expect(names).toHaveLength(2);
      expect(names[0]).toMatch(/-first\.png$/);
      expect(names[1]).toMatch(/-second\.png$/);
      expect(fs.readdirSync(predictionsDir).sort()).toEqual([...names].sort());
    });

    it('rejects an empty list with 400', async () => {
      await expect(service.savePredictionImages([])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('writes nothing when any file is not an allowed image', async () => {
      const invalid = {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        buffer: PNG_BYTES,
      } as Express.Multer.File;

      await expect(
        service.savePredictionImages([pngFile('first.png'), invalid]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fs.readdirSync(predictionsDir)).toEqual([]);
    });

    it('deletes the files already written when a later write fails, then rethrows', async () => {
      const realWriteFile = fs.promises.writeFile;
      let calls = 0;
      jest
        .spyOn(fs.promises, 'writeFile')
        .mockImplementation(
          (...args: Parameters<typeof fs.promises.writeFile>) => {
            calls += 1;
            return calls === 3
              ? Promise.reject(fsError('ENOSPC'))
              : realWriteFile(...args);
          },
        );

      await expect(
        service.savePredictionImages([
          pngFile('first.png'),
          pngFile('second.png'),
          pngFile('third.png'),
        ]),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fs.readdirSync(predictionsDir)).toEqual([]);
    });
  });
});
