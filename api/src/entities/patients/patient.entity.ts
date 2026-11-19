/**
 * Patient entity for TypeORM
 *
 * Represents the 'Patients' table in the database
 *
 * Main fields:
 * - patientId: Auto-increment primary key
 * - fullName: Patient's full name
 * - documentType: Document type (NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE)
 * - documentNumber: Document number
 * - gender: Patient gender (M, F, OTHER)
 * - birthDate: Date of birth
 * - phonePrefix: Phone country prefix
 * - phoneNumber: Phone number
 * - email: Email address (optional)
 *
 * Relations:
 * - results: The patient's results
 *
 * Constraints: unique (documentType, documentNumber); its index also serves the
 * lookup by document.
 */

import {
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Result } from '../results/result.entity';
import { DocumentType, Gender, DEFAULT_PHONE_PREFIX } from './patient.types';
import { checkIn } from '../check-in';

@Entity('Patients')
@Check('CHK_Patients_documentType', checkIn('documentType', DocumentType))
@Check('CHK_Patients_gender', checkIn('gender', Gender))
@Index('UQ_Patients_document', ['documentType', 'documentNumber'], {
  unique: true,
})
export class Patient {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Patients' })
  patientId: number;

  @Column({ length: 100 })
  fullName: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  documentType: DocumentType;

  @Column({ length: 20 })
  documentNumber: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  gender: Gender;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ length: 5, default: DEFAULT_PHONE_PREFIX })
  phonePrefix: string;

  @Column({ length: 15 })
  phoneNumber: string;

  @Column({ length: 50, nullable: true })
  email?: string;

  // Relations
  @OneToMany('Result', 'patient')
  results: Relation<Result>[];
}
