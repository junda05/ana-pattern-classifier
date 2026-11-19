/**
 * Result TypeORM entity
 *
 * Maps the 'Results' table
 *
 * Main fields:
 * - resultId: auto-increment primary key
 * - dateAndHour: date and time of the result
 * - observations: general observations for the whole analysis
 * - status: result status (PENDING, CORRECTED, VERIFIED)
 * - patientId: patient ID
 * - userId: ID of the user who recorded the result
 * - verifiedBy: ID of the user who last moved the result to VERIFIED (nullable)
 * - verifiedAt: when the result was last moved to VERIFIED (nullable, UTC)
 *
 * Relations:
 * - patient: patient the result belongs to
 * - user: user who created the result
 * - verifier: user who last verified the result (SET NULL if that user is deleted)
 * - predictions: individual predictions, one per analyzed image
 *
 * NOTE: corrections are attached to Prediction, not to Result.
 *
 * Constraints (SQL Server):
 * - patientId -> Patients ON DELETE NO ACTION: a patient with results cannot be
 *   deleted (results are clinical records); PatientsService maps the conflict to 409.
 * - userId -> Users ON DELETE NO ACTION: users are deactivated, never deleted,
 *   and a second cascading path from Users is not allowed next to verifiedBy.
 * - verifiedBy -> Users ON DELETE SET NULL: the only cascading path from Users
 *   to Results (SQL Server rejects multiple cascade paths between two tables).
 * - Index (status, dateAndHour): the results list filters by status and sorts
 *   by date; statistics and the report search filter by status and date range.
 */

import {
  Check,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Patient } from '../patients/patient.entity';
import type { Prediction } from '../predictions/prediction.entity';
import type { User } from '../users/users.entity';
import { ResultStatus } from './result.types';
import { UTC_NOW_SQL } from '../utc-timestamp';
import { checkIn } from '../check-in';

@Entity('Results')
@Check('CHK_Results_status', checkIn('status', ResultStatus))
@Index('IDX_Results_status_dateAndHour', ['status', 'dateAndHour'])
export class Result {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Results' })
  resultId: number;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  dateAndHour: Date;

  // Unicode, bounded like the DTOs (max 1000 characters)
  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  observations?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ResultStatus.PENDING,
  })
  status: ResultStatus;

  @Column()
  patientId: number;

  @Column()
  userId: number;

  @Column({ type: 'int', nullable: true })
  verifiedBy?: number | null;

  @Column({ type: 'datetime2', nullable: true })
  verifiedAt?: Date | null;

  /** Number of predictions; filled by list queries only (not a column). */
  predictionsCount?: number;

  // Relations
  @ManyToOne('Patient', 'results', { onDelete: 'NO ACTION' })
  @JoinColumn({
    name: 'patientId',
    foreignKeyConstraintName: 'FK_Results_patientId',
  })
  patient: Relation<Patient>;

  @ManyToOne('User', 'results', { onDelete: 'NO ACTION' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_Results_userId',
  })
  user: Relation<User>;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'verifiedBy',
    foreignKeyConstraintName: 'FK_Results_verifiedBy',
  })
  verifier?: Relation<User> | null;

  @OneToMany('Prediction', 'result')
  predictions: Relation<Prediction>[];
}
