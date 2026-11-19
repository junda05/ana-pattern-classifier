/**
 * DTO of POST /results/:id/predictions/with-files: changes to an existing
 * result, applied in ONE database transaction
 *
 * Sent as the JSON "data" field of a multipart/form-data request whose
 * "images" field carries one file per new prediction, in the same order
 * (images[i] <-> newPredictions[i]). Every field is optional, but at least one
 * must be present (400 otherwise):
 * - newPredictions: signed model outputs for the new images
 * - updatedDilutions: dilution changes of predictions of this result
 * - corrections: corrections of NEW images, by index into newPredictions
 * - existingCorrections: corrections of predictions of this result
 * - observations: '' or null clears them
 * - status: PENDING or VERIFIED (follows the status transition table)
 * The acting user comes from the JWT.
 *
 * Any stored correction moves the result to CORRECTED and clears its
 * verification; a correction equal to the current effective class is ignored.
 * A VERIFIED result accepts no new images, dilution or observation changes
 * (409); only an ADMIN may correct it.
 *
 * Every prediction is the model output for its image: prediction
 * (= prediction_key), confidencePercentage and classificationLevel exactly as
 * POST /predictions/analyze returned them, plus its signature. The service
 * verifies each signature against the image at the same index (400
 * "Prediction signature is invalid for image N.").
 */

import {
  IsInt,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  IsEnum,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PredictionClass,
  ResultStatus,
} from '../../entities/results/result.types';
import {
  ClassificationLevel,
  Dilution,
} from '../../entities/predictions/prediction.types';
import { OptionalObservations } from '../../common/validation/optional-observations';
import { IndexedCorrectionDto } from './create-batch-results-with-corrections.dto';
import {
  BatchCorrectionItemDto,
  MAX_CORRECTIONS_PER_REQUEST,
} from './create-batch-corrections-existing.dto';
import { CREATABLE_RESULT_STATUSES } from './create-batch-results-with-files.dto';

/**
 * A new prediction (without imagePath)
 */
export class NewPredictionDto {
  @IsEnum(PredictionClass, {
    message: 'Invalid prediction. It must be one of the valid ICAP classes.',
  })
  @IsNotEmpty({ message: 'Prediction is required.' })
  prediction: PredictionClass;

  @Max(100, { message: 'Confidence percentage cannot be greater than 100.' })
  @Min(0, { message: 'Confidence percentage cannot be less than 0.' })
  @IsNumber({}, { message: 'Confidence percentage must be a number.' })
  @IsNotEmpty({ message: 'Confidence percentage is required.' })
  confidencePercentage: number;

  /** classification_level returned by POST /predictions/analyze (signed). */
  @IsEnum(ClassificationLevel, {
    message: 'Classification level must be one of: general, competent, expert.',
  })
  @IsNotEmpty({ message: 'Classification level is required.' })
  classificationLevel: ClassificationLevel;

  /**
   * signature returned by POST /predictions/analyze for the image uploaded at
   * the same index; verified against that image, prediction,
   * confidencePercentage and classificationLevel.
   */
  @MaxLength(128, { message: 'Signature must be at most 128 characters long.' })
  @IsString({ message: 'Signature must be a string.' })
  @IsNotEmpty({ message: 'Signature is required.' })
  signature: string;

  @IsEnum(Dilution, {
    message:
      'Invalid dilution. It must be one of: 80, 160, 320, 640, 1280 or 2560.',
  })
  @IsNotEmpty({ message: 'Dilution is required.' })
  dilution: Dilution;
}

/**
 * Dilution update for a prediction that already belongs to the result
 */
export class UpdateExistingPredictionDilutionDto {
  @IsInt({ message: 'Prediction ID must be an integer.' })
  @IsNotEmpty({ message: 'Prediction ID is required.' })
  predictionId: number;

  @IsEnum(Dilution, {
    message:
      'Invalid dilution. It must be one of: 80, 160, 320, 640, 1280 or 2560.',
  })
  @IsNotEmpty({ message: 'Dilution is required.' })
  dilution: Dilution;
}

/**
 * Request body for changing a result (see the file header)
 */
export class AddPredictionsToResultDto {
  @IsOptional()
  @IsArray({ message: 'New predictions must be an array.' })
  @ValidateNested({ each: true })
  @Type(() => NewPredictionDto)
  newPredictions?: NewPredictionDto[];

  @IsOptional()
  @IsArray({ message: 'Dilution updates must be an array.' })
  @ArrayMaxSize(MAX_CORRECTIONS_PER_REQUEST, {
    message: `At most ${MAX_CORRECTIONS_PER_REQUEST} dilution updates can be sent at once.`,
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateExistingPredictionDilutionDto)
  updatedDilutions?: UpdateExistingPredictionDilutionDto[];

  /** Corrections of the new images; imageIndex indexes newPredictions. */
  @IsOptional()
  @IsArray({ message: 'Corrections must be an array.' })
  @ArrayMaxSize(MAX_CORRECTIONS_PER_REQUEST, {
    message: `At most ${MAX_CORRECTIONS_PER_REQUEST} corrections can be sent at once.`,
  })
  @ValidateNested({ each: true })
  @Type(() => IndexedCorrectionDto)
  corrections?: IndexedCorrectionDto[];

  /** Corrections of predictions that already belong to the result. */
  @IsOptional()
  @IsArray({ message: 'Existing corrections must be an array.' })
  @ArrayMaxSize(MAX_CORRECTIONS_PER_REQUEST, {
    message: `At most ${MAX_CORRECTIONS_PER_REQUEST} existing corrections can be sent at once.`,
  })
  @ValidateNested({ each: true })
  @Type(() => BatchCorrectionItemDto)
  existingCorrections?: BatchCorrectionItemDto[];

  /** '' or null clears the observations (stored as null). */
  @OptionalObservations()
  observations?: string | null;

  /**
   * PENDING or VERIFIED. CORRECTED is never requested: it is set when a
   * correction is stored.
   */
  @IsOptional()
  @IsIn(CREATABLE_RESULT_STATUSES, {
    message:
      'Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.',
  })
  status?: ResultStatus;
}
