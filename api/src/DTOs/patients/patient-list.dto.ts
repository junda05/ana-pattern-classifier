/**
 * DTO for paginated patient lists
 *
 * Contains only the fields needed to display patients in a list
 *
 * Fields:
 * - patientId: patient ID
 * - fullName: patient's full name
 * - documentType: document type
 * - documentNumber: document number
 * - gender: patient's gender
 * - birthDate: date of birth
 * - phonePrefix: phone prefix
 * - phoneNumber: phone number
 * - email: email (optional)
 */

import { DocumentType, Gender } from '../../entities/patients/patient.types';

export interface PatientListDto {
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
