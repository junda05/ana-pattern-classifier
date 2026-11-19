/**
 * Full detail of a result
 *
 * Returns every field of the Result entity plus the nested
 * patient, user and predictions.
 *
 * Fields:
 * - resultId: ID of the result
 * - dateAndHour: date and time of the result
 * - observations: general observations about the analysis (optional)
 * - status: result status
 * - patient: full patient data (nested)
 * - user: the user who created the result (nested)
 * - verifiedBy: the user who last moved the result to VERIFIED, or null
 * - verifiedAt: when that happened (UTC), or null
 * - predictions: the individual predictions with their images, by predictionId
 *
 * Note: patientId and userId are left out of the response because they are
 * already part of the nested patient and user objects.
 */

import { Exclude, Expose, Type } from 'class-transformer';
import { ResultStatus } from '../../entities/results/result.types';
import { DocumentType, Gender } from '../../entities/patients/patient.types';
import { PredictionDetailDto } from '../predictions/prediction-detail.dto';

export interface PatientDetailDto {
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

export interface UserBasicDto {
  userId: number;
  fullName: string;
}

@Exclude()
export class ResultDetailDto {
  @Expose()
  resultId: number;

  @Expose()
  dateAndHour: Date;

  @Expose()
  observations?: string | null;

  @Expose()
  status: ResultStatus;

  @Expose()
  patient: PatientDetailDto;

  @Expose()
  user: UserBasicDto;

  @Expose()
  verifiedBy: UserBasicDto | null;

  @Expose()
  verifiedAt: Date | null;

  @Expose()
  @Type(() => PredictionDetailDto)
  predictions: PredictionDetailDto[];
}

/**
 * Response of POST /results/:id/predictions/with-files: the updated result
 * plus the IDs of the predictions created by the request, in upload order.
 */
export class ResultWithAddedPredictionsDto extends ResultDetailDto {
  @Expose()
  addedPredictionIds: number[];
}
