/**
 * DTO for finding a patient by document
 *
 * Query params for the GET /api/v1/patients/document endpoint
 *
 * Example:
 * GET /api/v1/patients/document?documentType=NATIONAL_ID&documentNumber=1234567890
 */

import { IsEnum, IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { DocumentType } from '../../entities/patients/patient.types';

export class SearchByDocumentDto {
  /**
   * Document type
   * Allowed values: NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE
   */
  @IsEnum(DocumentType, {
    message:
      'Invalid document type. Must be one of: NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE.',
  })
  @IsNotEmpty({ message: 'Document type is required.' })
  documentType: DocumentType;

  /**
   * Document number
   * Must be alphanumeric, between 5 and 20 characters long
   */
  @IsString({ message: 'The document number must be a string.' })
  @IsNotEmpty({ message: 'Document number is required.' })
  @Length(5, 20, {
    message: 'The document number must be between 5 and 20 characters long.',
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'The document number may only contain letters and numbers.',
  })
  documentNumber: string;
}
