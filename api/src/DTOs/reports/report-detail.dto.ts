/**
 * Full detail of a report
 *
 * Report-specific view of a finalized (VERIFIED or CORRECTED) result:
 * - The responsible physician ("medic"): the user behind the most recent of
 *   the result's latest correction and its verification; the creator of the
 *   result when neither exists
 * - Verification details (verifiedBy / verifiedAt), null when not recorded
 * - EVERY prediction of the result with its image, its latest correction (if
 *   any) and its final pattern (latest correction, else the model prediction)
 * - Full patient data for the report header
 * - createdAt and lastModifiedAt (latest of: result date, latest correction,
 *   verification, latest audited update of the result)
 *
 * Used by the "View Report" modal.
 */

import { Exclude, Expose, Type } from 'class-transformer';
import { ResultStatus } from '../../entities/results/result.types';
import { DocumentType, Gender } from '../../entities/patients/patient.types';
import { Dilution } from '../../entities/predictions/prediction.types';

/**
 * Responsible physician: the user who acted last between the latest correction
 * and the verification (or the creator of the result when neither exists)
 */
export interface MedicDetailDto {
  userId: number;
  fullName: string;
  professionalCard: string; // Professional license number
  email: string;
  username: string;
}

/**
 * Full patient data for the report
 */
export interface PatientReportDto {
  patientId: number;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  gender: Gender;
  birthDate: Date;
  phonePrefix: string;
  phoneNumber: string;
  email?: string;
}

/**
 * Latest correction of a prediction (newest correctedDate), if any
 */
export interface CorrectionInfoDto {
  correctedResultId: number;
  correctedPrediction: string;
  observations?: string | null;
  correctedDate: Date;
  correctedBy: number; // ID of the user who made the correction
}

/**
 * Prediction with the full information needed by the report
 */
export interface PredictionReportDto {
  predictionId: number;
  prediction: string; // Original prediction
  confidencePercentage: number;
  imagePath: string;
  imageUrl: string; // Absolute URL of the image
  dilution: Dilution;
  correction?: CorrectionInfoDto;
  finalPattern: string; // Latest correction if any, otherwise the model prediction
}

/**
 * User who verified the result
 */
export interface VerifierDto {
  userId: number;
  fullName: string;
}

/**
 * Full report detail
 */
@Exclude()
export class ReportDetailDto {
  @Expose()
  resultId: number;

  @Expose()
  dateAndHour: Date;

  @Expose()
  observations?: string | null;

  @Expose()
  status: ResultStatus;

  @Expose()
  patient: PatientReportDto;

  @Expose()
  medic: MedicDetailDto; // Responsible physician: most recent of latest corrector / verifier, else the creator

  @Expose()
  verifiedBy: VerifierDto | null; // User who last moved the result to VERIFIED, if recorded

  @Expose()
  verifiedAt: Date | null; // When the result was last moved to VERIFIED (UTC), if recorded

  @Expose()
  @Type(() => Object)
  predictions: PredictionReportDto[];

  @Expose()
  createdAt: Date; // Creation date of the result

  @Expose()
  lastModifiedAt: Date; // Latest of: result date, latest correction, verification, latest audited update
}
