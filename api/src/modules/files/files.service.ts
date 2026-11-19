/**
 * File management service
 *
 * Responsibilities:
 * - Saves prediction images to disk under unique names
 * - Validates the allowed file types
 * - Resolves files so they can be served (never outside the upload folders)
 * - Deletes files when their records are deleted (no HTTP route deletes files)
 * - Never logs original upload names: logs identify a stored file by its
 *   opaque uuid-timestamp prefix (storedFileLogRef)
 * - Lists the reference-image gallery (one folder per PredictionClass)
 *
 * Upload folders: {UPLOADS_DIR}/predictions and {UPLOADS_DIR}/reference
 * (UPLOADS_DIR defaults to ./uploads, relative to the working directory).
 *
 * Does NOT handle:
 * - Results/Predictions business logic (ResultsService)
 * - Permission checks (guards)
 * - Audit trail records (TraceabilityService)
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  AllowedFileExtension,
  AllowedMimeType,
  DEFAULT_UPLOADS_DIR,
  PREDICTIONS_SUBDIR,
  REFERENCE_SUBDIR,
} from './files.types';
import { safeUploadPath } from './safe-upload-path';
import { PredictionClass } from '../../entities/results/result.types';

/** PredictionClass values in declaration order (general → competent → expert). */
const ORDERED_CLASSES: readonly PredictionClass[] =
  Object.values(PredictionClass);
const KNOWN_CLASSES: ReadonlySet<string> = new Set(ORDERED_CLASSES);

/** Narrows a route parameter to a PredictionClass. */
export function assertKnownClass(
  className: string,
): asserts className is PredictionClass {
  if (!KNOWN_CLASSES.has(className)) {
    throw new BadRequestException(`Unknown pattern class '${className}'.`);
  }
}

function hasAllowedExtension(filename: string): boolean {
  return ALLOWED_FILE_EXTENSIONS.includes(
    path.extname(filename).toLowerCase() as AllowedFileExtension,
  );
}

function compareFileNames(a: string, b: string): number {
  return (
    a.localeCompare(b, 'en', { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0)
  );
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

function errorStack(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

/**
 * Loggable summary of a failed file operation on a stored upload: the error
 * code and system call only, because Node's messages and stacks embed the full
 * path (and so the part of the stored name derived from the upload name).
 */
function fileErrorSummary(error: unknown): string {
  const { code, syscall } = (error ?? {}) as NodeJS.ErrnoException;
  return [code ?? 'unknown error', syscall].filter(Boolean).join(' ');
}

/** Stored names look like uuid-timestamp-sanitizedOriginalName.ext */
const STORED_NAME_PATTERN =
  /^([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-\d+)-.*?(\.[a-z0-9]+)?$/i;

/**
 * Name of a stored prediction image as written to the logs: only its opaque
 * uuid-timestamp prefix and extension, because the rest of the stored name is
 * derived from the original upload name, which is never logged. Names in any
 * other format (never produced for uploads) are returned unchanged.
 */
export function storedFileLogRef(filename: string): string {
  const match = STORED_NAME_PATTERN.exec(filename);
  return match ? `${match[1]}${match[2] ?? ''}` : filename;
}

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly predictionsDir: string;
  private readonly referenceDir: string;

  constructor(private readonly configService: ConfigService) {
    const uploadsDir = path.resolve(
      this.configService.get<string>('UPLOADS_DIR') || DEFAULT_UPLOADS_DIR,
    );
    this.predictionsDir = path.join(uploadsDir, PREDICTIONS_SUBDIR);
    this.referenceDir = path.join(uploadsDir, REFERENCE_SUBDIR);
  }

  /** Creates the upload folders if they do not exist. */
  async onModuleInit(): Promise<void> {
    try {
      await fs.promises.mkdir(this.predictionsDir, { recursive: true });
      await fs.promises.mkdir(this.referenceDir, { recursive: true });
      this.logger.log(
        `Upload directories ready: ${this.predictionsDir}, ${this.referenceDir}`,
      );
    } catch (error) {
      this.logger.error(
        'Could not create the upload directories',
        errorStack(error),
      );
    }
  }

  /**
   * Checks that a file is of an allowed type
   * @throws BadRequestException if the file is missing or not an allowed image
   */
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file was provided.');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
      throw new BadRequestException(
        `File type not allowed. Accepted types: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }

    if (!hasAllowedExtension(file.originalname)) {
      throw new BadRequestException(
        `File extension not allowed. Accepted extensions: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`,
      );
    }
  }

  /**
   * Generates a unique file name: uuid-timestamp-sanitizedName.ext
   * Example: a3d4e5f6-...-1234567890-sample_image.jpg
   */
  generateUniqueFilename(originalName: string): string {
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);

    const sanitizedBaseName = baseName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Strip accents
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special characters with _
      .substring(0, 50); // Limit the length

    return `${randomUUID()}-${Date.now()}-${sanitizedBaseName}${extension}`;
  }

  /**
   * Saves a prediction image to disk
   * @returns Name of the saved file (to store in the database)
   * @throws BadRequestException if the file is not valid
   * @throws InternalServerErrorException if saving fails
   */
  async savePredictionImage(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    const filename = this.generateUniqueFilename(file.originalname);
    try {
      await fs.promises.writeFile(
        path.join(this.predictionsDir, filename),
        file.buffer,
      );
    } catch (error) {
      this.logger.error(
        `Could not save prediction image ${storedFileLogRef(filename)}: ${fileErrorSummary(error)}`,
      );
      throw new InternalServerErrorException(
        'Could not save the file on the server.',
      );
    }

    this.logger.log(`Prediction image saved: ${storedFileLogRef(filename)}`);
    return filename;
  }

  /**
   * Saves several prediction images, all or nothing: every file is validated
   * before anything is written, files are written one at a time, and if a write
   * fails the files already written are deleted before the error is rethrown.
   * @returns Names of the saved files, in the same order
   */
  async savePredictionImages(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files were provided.');
    }
    files.forEach((file) => this.validateFile(file));

    const saved: string[] = [];
    try {
      for (const file of files) {
        saved.push(await this.savePredictionImage(file));
      }
    } catch (error) {
      await this.deletePredictionImages(saved);
      throw error;
    }
    return saved;
  }

  /**
   * Returns the absolute path of a prediction image
   * @throws BadRequestException if the name is not a bare file name
   * @throws NotFoundException if the file does not exist
   */
  async getPredictionImagePath(filename: string): Promise<string> {
    const filePath = safeUploadPath(this.predictionsDir, filename);
    await this.assertFileExists(
      filePath,
      `Prediction image '${filename}' not found.`,
    );
    return filePath;
  }

  /**
   * Deletes several prediction images; one failure does not stop the others
   * and never throws (a missing file or an invalid name is only logged).
   */
  async deletePredictionImages(filenames: string[]): Promise<void> {
    if (!filenames || filenames.length === 0) {
      return;
    }

    await Promise.allSettled(
      filenames.map((filename) =>
        this.removePredictionImage(filename).catch((error: unknown) => {
          this.logger.warn(
            `Could not delete ${storedFileLogRef(filename)}: ${(error as Error).message}`,
          );
        }),
      ),
    );
  }

  /**
   * Lists the pattern classes that have a reference-image folder, in
   * PredictionClass order. A missing gallery folder yields [].
   */
  async getReferenceClasses(): Promise<PredictionClass[]> {
    const entries = await this.readDirectory(
      this.referenceDir,
      'Could not read the reference image classes.',
    );
    const present = new Set(
      entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    );
    return ORDERED_CLASSES.filter((className) => present.has(className));
  }

  /**
   * Lists the reference images of one class, sorted by file name.
   * A missing class folder yields [].
   * @throws BadRequestException if the class is unknown
   */
  async getReferenceImagesByClass(
    className: string,
  ): Promise<{ filename: string; url: string }[]> {
    assertKnownClass(className);
    const entries = await this.readDirectory(
      path.join(this.referenceDir, className),
      'Could not read the reference images.',
    );

    return entries
      .filter((entry) => entry.isFile() && hasAllowedExtension(entry.name))
      .map((entry) => entry.name)
      .sort(compareFileNames)
      .map((filename) => ({
        filename,
        url: `/files/reference/${encodeURIComponent(className)}/${encodeURIComponent(filename)}`,
      }));
  }

  /**
   * Returns the absolute path of a reference image (res.sendFile needs an absolute path).
   * @throws BadRequestException if the class is unknown, the name is not a bare
   *         file name or the extension is not an allowed image extension
   * @throws NotFoundException if the image does not exist
   */
  async getReferenceImagePath(
    className: string,
    filename: string,
  ): Promise<string> {
    assertKnownClass(className);
    const filePath = safeUploadPath(
      path.join(this.referenceDir, className),
      filename,
    );
    if (!hasAllowedExtension(filename)) {
      throw new BadRequestException('File extension not allowed.');
    }
    await this.assertFileExists(
      filePath,
      `Reference image '${filename}' not found.`,
    );
    return filePath;
  }

  /**
   * Deletes one prediction image from disk
   * @throws BadRequestException if the name is not a bare file name
   * @throws NotFoundException if the file does not exist
   */
  private async removePredictionImage(filename: string): Promise<void> {
    const filePath = safeUploadPath(this.predictionsDir, filename);
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        throw new NotFoundException('Prediction image not found.');
      }
      this.logger.error(
        `Could not delete prediction image ${storedFileLogRef(filename)}: ${fileErrorSummary(error)}`,
      );
      throw new InternalServerErrorException(
        'Could not delete the file from the server.',
      );
    }
    this.logger.log(`Prediction image deleted: ${storedFileLogRef(filename)}`);
  }

  /** Reads a folder; a missing folder (or a file in its place) yields []. */
  private async readDirectory(
    directory: string,
    failureMessage: string,
  ): Promise<fs.Dirent[]> {
    try {
      return await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return [];
      }
      this.logger.error(
        `Could not read directory ${directory}`,
        errorStack(error),
      );
      throw new InternalServerErrorException(failureMessage);
    }
  }

  /** @throws NotFoundException unless filePath is an existing regular file */
  private async assertFileExists(
    filePath: string,
    notFoundMessage: string,
  ): Promise<void> {
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        throw new NotFoundException(notFoundMessage);
      }
      this.logger.error(
        `Could not access ${storedFileLogRef(path.basename(filePath))}: ${fileErrorSummary(error)}`,
      );
      throw new InternalServerErrorException('Could not access the file.');
    }
    if (!stats.isFile()) {
      throw new NotFoundException(notFoundMessage);
    }
  }
}
