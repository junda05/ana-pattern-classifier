/**
 * DTO of POST /results/batch/with-files: result data, predictions and
 * optional corrections
 *
 * Extends CreateBatchResultsWithFilesDto with corrections made BEFORE the
 * result is saved. A correction references its image by position
 * (imageIndex, 0-based) because the predictions do not exist yet.
 *
 * Backend:
 * - Stores the original predictions in Predictions
 * - Creates CorrectedResults for the corrected ones
 * - Marks the result as CORRECTED when there is at least one correction
 *
 * The service also checks that every imageIndex is within the uploaded images
 * and that no image is corrected twice in the same request.
 *
 * Example:
 * {
 *   "patientId": 1,
 *   "predictions": [
 *     { "prediction": "NUCLEAR", "confidencePercentage": 95,
 *       "classificationLevel": "general", "signature": "<from analyze>", "dilution": "80" },
 *     { "prediction": "MITOTIC", "confidencePercentage": 80,
 *       "classificationLevel": "general", "signature": "<from analyze>", "dilution": "160" }
 *   ],
 *   "corrections": [
 *     { "imageIndex": 1, "correctedPrediction": "CYTOPLASMIC", "observations": "Reviewed" }
 *   ],
 *   "observations": "ANA analysis"
 * }
 */

import {
  IsArray,
  ValidateNested,
  IsOptional,
  IsInt,
  IsNotEmpty,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBatchResultsWithFilesDto } from './create-batch-results-with-files.dto';
import { PredictionClass } from '../../entities/results/result.types';
import { OptionalObservations } from '../../common/validation/optional-observations';

/**
 * A correction referenced by image index (the prediction is not saved yet)
 */
export class IndexedCorrectionDto {
  @Min(0, { message: 'Image index must be greater than or equal to 0.' })
  @IsInt({ message: 'Image index must be an integer.' })
  @IsNotEmpty({ message: 'Image index is required.' })
  imageIndex: number;

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
 * Request body: the base DTO plus optional corrections
 */
export class CreateBatchResultsWithCorrectionsDto extends CreateBatchResultsWithFilesDto {
  @IsArray({ message: 'Corrections must be an array.' })
  @ValidateNested({ each: true })
  @Type(() => IndexedCorrectionDto)
  @IsOptional()
  corrections?: IndexedCorrectionDto[];
}
