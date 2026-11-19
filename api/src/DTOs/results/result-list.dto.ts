/**
 * Result item for paginated lists
 *
 * Contains the fields needed to display results in lists,
 * including nested patient and user data and the prediction count.
 *
 * Fields:
 * - resultId: ID of the result
 * - dateAndHour: date and time of the result
 * - status: result status
 * - patient: basic patient data (nested)
 * - user: basic data of the user who performed the exam (nested)
 * - predictionsCount: number of linked predictions/images
 */

import { ResultStatus } from '../../entities/results/result.types';
import { DocumentType } from '../../entities/patients/patient.types';

export interface PatientBasicDto {
  patientId: number;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  email?: string;
  phoneNumber?: string;
  phonePrefix?: string;
}

export interface UserBasicListDto {
  userId: number;
  fullName: string;
  username: string;
}

export interface ResultListDto {
  resultId: number;
  dateAndHour: Date;
  status: ResultStatus;
  patient: PatientBasicDto;
  user: UserBasicListDto;
  predictionsCount?: number;
}
