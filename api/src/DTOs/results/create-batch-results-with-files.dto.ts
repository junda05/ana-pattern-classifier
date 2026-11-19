/**
 * DTO for creating results with image files
 *
 * Sent as the JSON "data" field of a multipart/form-data request whose
 * "images" field carries the files. The predictions do NOT include imagePath:
 * the image arrives as a file, in the same order as the predictions.
 *
 * The owner of the result is always the authenticated user (from the JWT);
 * a userId in the payload is rejected as an undeclared property.
 *
 * Flow:
 * 1. The frontend sends: JSON data + image files
 * 2. The backend validates the data, stores the files and gets unique names
 * 3. The backend creates the Result + Predictions (imagePath = stored name)
 *    in one database transaction
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
  ArrayMinSize,
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

/**
 * A single prediction WITHOUT imagePath.
 * imagePath is generated when the file is stored.
 */
export class SinglePredictionWithoutImageDto {
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

/** Statuses a client may request when creating a result. */
export const CREATABLE_RESULT_STATUSES = [
  ResultStatus.PENDING,
  ResultStatus.VERIFIED,
] as const;

/**
 * Request body for creating results with files
 */
export class CreateBatchResultsWithFilesDto {
  @IsInt({ message: 'Patient ID must be an integer.' })
  @IsNotEmpty({ message: 'Patient ID is required.' })
  patientId: number;

  @ArrayMinSize(1, { message: 'At least one prediction must be provided.' })
  @IsArray({ message: 'Predictions must be an array.' })
  @ValidateNested({ each: true })
  @Type(() => SinglePredictionWithoutImageDto)
  predictions: SinglePredictionWithoutImageDto[];

  /** '' or null means no observations (stored as null). */
  @OptionalObservations()
  observations?: string | null;

  /**
   * PENDING (default) or VERIFIED. CORRECTED is never requested: it is set
   * automatically when the payload carries corrections.
   */
  @IsOptional()
  @IsIn(CREATABLE_RESULT_STATUSES, {
    message:
      'Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.',
  })
  status?: ResultStatus;
}
