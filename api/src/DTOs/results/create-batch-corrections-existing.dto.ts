/**
 * DTO for creating several corrections of existing predictions in one batch
 *
 * All corrections are created at once and share a single consolidated audit record.
 *
 * Required fields:
 * - corrections: array of corrections to create
 *
 * Each correction includes:
 * - predictionId: ID of the prediction to correct
 * - correctedPrediction: new corrected class (PredictionClass enum)
 * - observations: optional observations about the correction
 *
 * Validation:
 * - corrections must be an array with 1 to 100 corrections
 * - every correction must have a valid predictionId
 * - correctedPrediction must be a PredictionClass value
 */

import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  IsEnum,
  IsInt,
  IsPositive,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PredictionClass } from '../../entities/results/result.types';
import { OptionalObservations } from '../../common/validation/optional-observations';

/** Largest batch accepted in one request. */
export const MAX_CORRECTIONS_PER_REQUEST = 100;

/**
 * A single correction within the batch
 */
export class BatchCorrectionItemDto {
  @IsInt({ message: 'Prediction ID must be an integer.' })
  @IsPositive({ message: 'Prediction ID must be positive.' })
  @IsNotEmpty({ message: 'Prediction ID is required.' })
  predictionId: number;

  @IsEnum(PredictionClass, {
    message:
      'Invalid corrected prediction. It must be one of the valid ICAP classes.',
  })
  @IsNotEmpty({ message: 'Corrected prediction is required.' })
  correctedPrediction: PredictionClass;

  @OptionalObservations()
  observations?: string | null;
}

/**
 * Request body for the correction batch
 */
export class CreateBatchCorrectionsExistingDto {
  @IsArray({ message: 'Corrections must be an array.' })
  @ArrayMinSize(1, { message: 'At least one correction is required.' })
  @ArrayMaxSize(MAX_CORRECTIONS_PER_REQUEST, {
    message: `At most ${MAX_CORRECTIONS_PER_REQUEST} corrections can be sent at once.`,
  })
  @ValidateNested({ each: true })
  @Type(() => BatchCorrectionItemDto)
  corrections: BatchCorrectionItemDto[];
}
