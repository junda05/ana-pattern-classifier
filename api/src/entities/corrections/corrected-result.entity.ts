/**
 * CorrectedResult TypeORM entity
 *
 * Maps the 'CorrectedResults' table
 *
 * IMPORTANT: a correction belongs to ONE specific prediction (not to the
 * whole Result), so individual images within a result can be corrected.
 *
 * Main fields:
 * - correctedResultId: auto-increment primary key
 * - correctedPrediction: corrected prediction (PredictionClass enum)
 * - observations: correction observations
 * - correctedDate: date and time of the correction
 * - predictionId: ID of the corrected prediction
 * - correctedBy: ID of the user who made the correction
 *
 * Relations:
 * - prediction: the corrected prediction
 * - user: the user who made the correction
 *
 * Constraints (SQL Server):
 * - predictionId -> Predictions ON DELETE CASCADE: corrections go with their
 *   prediction (Results -> Predictions -> CorrectedResults is one cascade chain).
 * - correctedBy -> Users ON DELETE NO ACTION: a cascading action here would add
 *   a second cascade path from Users (Users -> Results.verifiedBy -> Predictions
 *   -> CorrectedResults), which SQL Server rejects; users are deactivated, not deleted.
 */

import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Prediction } from '../predictions/prediction.entity';
import type { User } from '../users/users.entity';
import { PredictionClass } from '../results/result.types';
import { UTC_NOW_SQL } from '../utc-timestamp';

@Entity('CorrectedResults')
export class CorrectedResult {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_CorrectedResults' })
  correctedResultId: number;

  @Column({
    type: 'varchar',
    length: 50,
    enum: PredictionClass,
  })
  correctedPrediction: PredictionClass;

  // Unicode, bounded like the DTOs (max 1000 characters)
  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  observations?: string | null;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  correctedDate: Date;

  // Corrections are always loaded by their prediction
  @Index('IDX_CorrectedResults_predictionId')
  @Column()
  predictionId: number;

  @Column()
  correctedBy: number;

  // Relations
  @ManyToOne('Prediction', 'corrections', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'predictionId',
    foreignKeyConstraintName: 'FK_CorrectedResults_predictionId',
  })
  prediction: Relation<Prediction>;

  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({
    name: 'correctedBy',
    foreignKeyConstraintName: 'FK_CorrectedResults_correctedBy',
  })
  user: Relation<User>;
}
