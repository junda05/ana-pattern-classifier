/**
 * DTO (Data Transfer Object) for creating patients
 *
 * Defines the data structure required to create a new patient
 *
 * Required fields:
 * - fullName: Patient's full name
 * - documentType: Document type (NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE)
 * - documentNumber: Document number (5-20 letters or digits, same rule as the lookup)
 * - gender: Gender (M, F, OTHER)
 * - birthDate: Date of birth
 * - phonePrefix: Phone country prefix
 * - phoneNumber: Phone number
 *
 * Optional fields:
 * - email: Email address (optional in the entity)
 *
 * Validations applied:
 * - Uniqueness of documentType + documentNumber (in the service)
 * - Field format and length
 * - Automatic validation with class-validator
 */

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsEmail,
  Length,
  Matches,
} from 'class-validator';
import { DocumentType, Gender } from '../../entities/patients/patient.types';

export class CreatePatientDto {
  @Length(1, 100, {
    message: 'The full name must be between 1 and 100 characters long.',
  })
  @IsString({ message: 'The full name must be a string.' })
  @IsNotEmpty({ message: 'Full name is required.' })
  fullName: string;

  @IsEnum(DocumentType, {
    message:
      'Invalid document type. Must be one of: NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE.',
  })
  @IsNotEmpty({ message: 'Document type is required.' })
  documentType: DocumentType;

  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'The document number may only contain letters and numbers.',
  })
  @Length(5, 20, {
    message: 'The document number must be between 5 and 20 characters long.',
  })
  @IsString({ message: 'The document number must be a string.' })
  @IsNotEmpty({ message: 'Document number is required.' })
  documentNumber: string;

  @IsEnum(Gender, { message: 'Invalid gender. Must be M, F or OTHER.' })
  @IsNotEmpty({ message: 'Gender is required.' })
  gender: Gender;

  @IsDateString(
    {},
    { message: 'The date of birth must be a valid date (YYYY-MM-DD).' },
  )
  @IsNotEmpty({ message: 'Date of birth is required.' })
  birthDate: string;

  @Matches(/^\+\d{1,4}$/, {
    message:
      'The phone prefix must start with + followed by 1-4 digits (e.g. +1).',
  })
  @Length(1, 5, {
    message: 'The phone prefix must be between 1 and 5 characters long.',
  })
  @IsString({ message: 'The phone prefix must be a string.' })
  @IsNotEmpty({ message: 'Phone prefix is required.' })
  phonePrefix: string;

  @Matches(/^\d+$/, { message: 'The phone number may only contain digits.' })
  @Length(1, 15, {
    message: 'The phone number must be between 1 and 15 characters long.',
  })
  @IsString({ message: 'The phone number must be a string.' })
  @IsNotEmpty({ message: 'Phone number is required.' })
  phoneNumber: string;

  @Length(1, 50, { message: 'The email must be at most 50 characters long.' })
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @IsOptional()
  email?: string;
}
