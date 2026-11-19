/**
 * Predictions controller
 *
 * POST /api/v1/predictions/analyze
 * - Roles: ADMIN, STANDARD (JWT required)
 * - Body: multipart/form-data with one image in the field "file"
 *   (same type and size limits as result uploads)
 * - Returns: the prediction service JSON (prediction, prediction_key,
 *   classification_level, confidence, confidence_percentage,
 *   class_probabilities, patch_statistics, note) plus imageSha256 and
 *   signature (see PredictionSignatureService); classification_level is
 *   "general" when the predictor omits it
 * - Errors: 400 no file / invalid image, 413 file too large, 415 unsupported
 *   type, 502 prediction service misconfigured or invalid response, 503
 *   prediction service unavailable
 *
 * The image is analyzed but not stored; results are saved separately through
 * the results endpoints, which require the signature of each prediction.
 */

import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { MAX_FILE_SIZE } from '../files/files.types';
import { imageFileFilter } from '../files/image-upload.filter';
import { PredictorClient } from './predictor.client';
import {
  PredictionSignatureService,
  SignedAnalysis,
} from './prediction-signature.service';
import { PREDICTION_ROUTES } from './predictions.routes';

@Controller(PREDICTION_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STANDARD)
export class PredictionsController {
  constructor(
    private readonly predictorClient: PredictorClient,
    private readonly predictionSignatures: PredictionSignatureService,
  ) {}

  @Post(PREDICTION_ROUTES.ANALYZE)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
      fileFilter: imageFileFilter,
    }),
  )
  async analyze(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SignedAnalysis> {
    if (!file) {
      throw new BadRequestException('No file was provided.');
    }
    const response = await this.predictorClient.predict(file);
    return this.predictionSignatures.signAnalysis(file.buffer, response);
  }
}
