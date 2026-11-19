/**
 * Audit-trail detail DTO
 *
 * Full structure returned when a record's details are opened
 *
 * Sections:
 * 1. General information
 * 2. User who performed the activity
 * 3. Affected patient/user/result information
 * 4. Activity details (changed fields)
 */

import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';

/**
 * General information of the audit record
 */
export class GeneralInfoDto {
  dateAndHour: Date;
  activityType: ActivityType; // ActivityType code, e.g. "CREATE", "UPDATE", "DELETE"
  activityTypeLabel: string; // Display label, e.g. "Create", "Update", "Delete"
}

/**
 * User who performed the activity. For system actions every field is null
 * except fullName, which is "System".
 */
export class UserInfoDto {
  userId: number | null;
  username: string | null;
  fullName: string;
  role: string | null; // User role code
  email: string | null;
}

/**
 * Affected patient
 */
export class PatientInfoDto {
  patientId: number;
  fullName: string;
  documentType: string;
  documentNumber: string;
  gender?: string;
  birthDate?: Date;
  email?: string;
  phonePrefix?: string;
  phoneNumber?: string;
}

/**
 * Affected user
 */
export class AffectedUserInfoDto {
  userId: number;
  username: string;
  fullName: string;
  role: string; // User role code
  email: string;
}

/**
 * Correction of a prediction (the corrected class is the FINAL result)
 */
export class CorrectionDetailDto {
  correctedPrediction: string;
  observations?: string | null;
  correctedDate?: Date;
}

/**
 * A single prediction
 */
export class PredictionInfoDto {
  predictionId: number;
  prediction: string;
  confidencePercentage: number;
  imagePath: string;
  imageUrl?: string; // Absolute URL built by the service
  dilution: string; // Dilution code, e.g. "80"
  correction?: CorrectionDetailDto; // Correction, if any
}

/**
 * Affected result
 */
export class ResultInfoDto {
  resultId?: number;
  status?: string;
  dateAndHour?: Date;
  observations?: string | null;
  predictionsCount: number;
  predictions?: PredictionInfoDto[];
  newPredictionsAdded?: number; // Number of predictions added (when an analysis is continued)
  addedPredictions?: PredictionInfoDto[]; // Only the newly added predictions
  originalResultDateTime?: Date; // Original creation date of the result
}

/**
 * A single field change
 */
export class FieldChangeDto {
  fieldName: string;
  fieldLabel: string; // Display label of the field
  previousValue: string;
  newValue: string;
}

/**
 * Full audit-record detail DTO
 */
export class TraceabilityDetailDto {
  traceabilityId: number;

  // 1. General information
  generalInfo: GeneralInfoDto;

  // 2. User who performed the activity
  userInfo: UserInfoDto;

  // 3. Affected entity
  entityType: EntityType;
  entityTypeLabel: string; // Display label, e.g. "Patient"
  patientInfo?: PatientInfoDto;
  affectedUserInfo?: AffectedUserInfoDto;
  resultInfo?: ResultInfoDto;

  // 4. Activity details
  fieldChanges: FieldChangeDto[];
}
