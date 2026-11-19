/**
 * DTO (Data Transfer Object) for updating patients
 *
 * Defines the data structure used to update existing patients
 *
 * Characteristics:
 * - All fields are optional (partial update)
 * - Allows personal information to be updated
 * - Excludes immutable fields such as patientId
 *
 * Updatable fields:
 * - fullName: full name
 * - documentType: document type
 * - documentNumber: document number (5-20 letters or digits, same rule as the lookup)
 * - gender: gender
 * - birthDate: date of birth
 * - phonePrefix: phone prefix
 * - phoneNumber: phone number
 * - email: email
 *
 * Typical usage:
 * - Updating patient data
 * - Correcting information
 * - Partial updates of specific fields
 *
 * Validation:
 * - All fields are optional
 * - Fields that are sent must pass the same rules as in CreatePatientDto
 */

import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsEmail,
  Length,
  Matches,
} from 'class-validator';
import { DocumentType, Gender } from '../../entities/patients/patient.types';

export class UpdatePatientDto {
  @Length(1, 100, {
    message: 'The full name must be between 1 and 100 characters long.',
  })
  @IsString({ message: 'The full name must be a string.' })
  @IsOptional()
  fullName?: string;

  @IsEnum(DocumentType, {
    message:
      'Invalid document type. Must be one of: NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE.',
  })
  @IsOptional()
  documentType?: DocumentType;

  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'The document number may only contain letters and numbers.',
  })
  @Length(5, 20, {
    message: 'The document number must be between 5 and 20 characters long.',
  })
  @IsString({ message: 'The document number must be a string.' })
  @IsOptional()
  documentNumber?: string;

  @IsEnum(Gender, { message: 'Invalid gender. Must be M, F or OTHER.' })
  @IsOptional()
  gender?: Gender;

  @IsDateString(
    {},
    { message: 'The date of birth must be a valid date (YYYY-MM-DD).' },
  )
  @IsOptional()
  birthDate?: string;

  @Matches(/^\+\d{1,4}$/, {
    message:
      'The phone prefix must start with + followed by 1-4 digits (e.g. +1).',
  })
  @Length(1, 5, {
    message: 'The phone prefix must be between 1 and 5 characters long.',
  })
  @IsString({ message: 'The phone prefix must be a string.' })
  @IsOptional()
  phonePrefix?: string;

  @Matches(/^\d+$/, { message: 'The phone number may only contain digits.' })
  @Length(1, 15, {
    message: 'The phone number must be between 1 and 15 characters long.',
  })
  @IsString({ message: 'The phone number must be a string.' })
  @IsOptional()
  phoneNumber?: string;

  @Length(1, 50, { message: 'The email must be at most 50 characters long.' })
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @IsOptional()
  email?: string;
}
