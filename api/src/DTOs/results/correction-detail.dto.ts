/**
 * DTO for the detail of a correction
 *
 * Includes all correction data plus information about the user who made it.
 *
 * Fields:
 * - correctedResultId: ID of the correction
 * - predictionId: ID of the corrected prediction
 * - correctedPrediction: corrected class (PredictionClass enum)
 * - observations: observations about the correction
 * - correctedDate: date and time of the correction
 * - correctedBy: basic information about the user who made the correction
 */

import { PredictionClass } from '../../entities/results/result.types';

export interface CorrectedByDto {
  userId: number;
  username: string;
  fullName: string;
}

export interface CorrectionDetailDto {
  correctedResultId: number;
  predictionId: number;
  correctedPrediction: PredictionClass;
  observations?: string | null;
  correctedDate: Date;
  correctedBy: CorrectedByDto;
}
