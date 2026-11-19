/**
 * Files controller
 *
 * Responsibilities:
 * - Securely serve prediction image files
 * - Serve the reference-image gallery (keyed by PredictionClass)
 * - Files are never deleted over HTTP: prediction images are removed only
 *   together with their records (ResultsService)
 * - Protect access with JWT authentication
 *
 * Security:
 * - JWT authentication is required to access images
 * - Only users with the ADMIN or STANDARD role can view images
 * - File names are validated by FilesService (no path traversal)
 * - Image responses are marked Cache-Control: private (never stored by shared caches)
 */

import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { PredictionClass } from '../../entities/results/result.types';
import { FilesService, storedFileLogRef } from './files.service';
import { FILES_ROUTES } from './files.routes';

const PREDICTION_IMAGE_CACHE = 'private, max-age=3600'; // 1 hour
const REFERENCE_IMAGE_CACHE = 'private, max-age=86400'; // 24 hours (reference images rarely change)

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

@Controller(FILES_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STANDARD)
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly filesService: FilesService) {}

  /**
   * Returns a prediction image
   *
   * GET /api/v1/files/predictions/:filename
   *
   * Security:
   * - Requires JWT authentication
   * - ADMIN and STANDARD users only
   *
   * @param filename Name of the file to serve
   * @param res Express response used to send the file
   * @returns Image file (400 for an invalid name, 404 if it does not exist)
   *
   * Example:
   * GET /api/v1/files/predictions/uuid-123456-image.jpg
   */
  @Get(FILES_ROUTES.GET_PREDICTION_IMAGE)
  async servePredictionImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.filesService.getPredictionImagePath(filename);
    this.sendImage(res, filePath, filename, PREDICTION_IMAGE_CACHE);
  }

  /**
   * Returns the pattern classes that have reference images
   *
   * GET /api/v1/files/reference/classes
   *
   * Security:
   * - Requires JWT authentication
   * - ADMIN and STANDARD users only
   *
   * Only folders named exactly like a PredictionClass value are listed;
   * a missing gallery folder yields an empty array.
   *
   * @returns Array of PredictionClass values, in PredictionClass declaration order
   *
   * Example:
   * GET /api/v1/files/reference/classes
   * Returns: ["NUCLEAR_HOMOGENEOUS", "CYTOPLASMIC_RETICULAR_AMA"]
   */
  @Get(FILES_ROUTES.GET_REFERENCE_CLASSES)
  async getReferenceClasses(): Promise<PredictionClass[]> {
    return this.filesService.getReferenceClasses();
  }

  /**
   * Returns the reference images of one pattern class
   *
   * GET /api/v1/files/reference/:className
   *
   * Security:
   * - Requires JWT authentication
   * - ADMIN and STANDARD users only
   *
   * @param className PredictionClass value (e.g. NUCLEAR_HOMOGENEOUS); unknown values → 400
   * @returns Array of objects with filename and url, sorted by file name (empty if
   *          the class has no folder); url is relative to the API base (/api/v1)
   *
   * Example:
   * GET /api/v1/files/reference/NUCLEAR_HOMOGENEOUS
   * Returns: [
   *   { filename: "example-1.jpg", url: "/files/reference/NUCLEAR_HOMOGENEOUS/example-1.jpg" }
   * ]
   */
  @Get(FILES_ROUTES.GET_REFERENCE_IMAGES)
  async getReferenceImagesByClass(
    @Param('className') className: string,
  ): Promise<{ filename: string; url: string }[]> {
    return this.filesService.getReferenceImagesByClass(className);
  }

  /**
   * Serves one reference image
   *
   * GET /api/v1/files/reference/:className/:filename
   *
   * Security:
   * - Requires JWT authentication
   * - ADMIN and STANDARD users only
   *
   * @param className PredictionClass value
   * @param filename File name
   * @param res Express response used to send the file
   * @returns Image file (400 for an unknown class, an invalid name or a disallowed
   *          extension; 404 if the image does not exist)
   *
   * Example:
   * GET /api/v1/files/reference/NUCLEAR_HOMOGENEOUS/example-1.jpg
   */
  @Get(FILES_ROUTES.GET_REFERENCE_IMAGE)
  async serveReferenceImage(
    @Param('className') className: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.filesService.getReferenceImagePath(
      className,
      filename,
    );
    this.sendImage(res, filePath, filename, REFERENCE_IMAGE_CACHE);
  }

  /**
   * Streams an image that FilesService has already resolved and checked.
   * Errors raised before this point propagate to Nest's exception layer;
   * errors while streaming (e.g. the file was deleted meanwhile) are answered
   * here unless the response has already started.
   */
  private sendImage(
    res: Response,
    filePath: string,
    filename: string,
    cacheControl: string,
  ): void {
    const headers = {
      'Content-Type': this.getMimeType(filename),
      'Cache-Control': cacheControl,
    };

    res.sendFile(filePath, { headers }, (error?: Error) => {
      if (!error) {
        return;
      }
      const code = (error as NodeJS.ErrnoException).code;
      this.logger.warn(
        `Could not send ${storedFileLogRef(filename)}: ${code ?? error.message}`,
      );
      if (res.headersSent) {
        return;
      }
      if (code === 'ENOENT') {
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: `File '${filename}' not found.`,
          error: 'Not Found',
        });
        return;
      }
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Could not serve the file.',
        error: 'Internal Server Error',
      });
    });
  }

  /**
   * Determines the MIME type from the file extension
   * @param filename File name
   * @returns MIME type
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    return MIME_TYPES[extension] || 'application/octet-stream';
  }
}
