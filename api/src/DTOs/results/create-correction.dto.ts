/**
 * DTO for correcting a single prediction
 *
 * Required fields:
 * - predictionId: ID of the prediction being corrected
 * - correctedPrediction: new corrected class (PredictionClass enum)
 *
 * Optional fields:
 * - observations: observations about the correction
 *
 * Validation:
 * - predictionId must be a positive number
 * - correctedPrediction must be a PredictionClass value
 * - observations: at most 1000 characters; '' or null means none
 */

import { IsNotEmpty, IsEnum, IsInt, IsPositive } from 'class-validator';
import { PredictionClass } from '../../entities/results/result.types';
import { OptionalObservations } from '../../common/validation/optional-observations';

export class CreateCorrectionDto {
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
