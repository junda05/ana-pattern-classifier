/**
 * Prediction TypeORM entity
 *
 * Maps the 'Predictions' table
 *
 * Main fields:
 * - predictionId: auto-increment primary key
 * - prediction: prediction for this specific image (PredictionClass enum)
 * - confidencePercentage: confidence percentage (0-100)
 * - imagePath: path of the analyzed image file
 * - dilution: sample dilution (1:80, 1:160, 1:320, 1:640, 1:1280, 1:2560)
 * - resultId: ID of the associated result
 *
 * Relations:
 * - result: result the prediction belongs to (many-to-one)
 * - corrections: corrections of this specific prediction (one-to-many)
 *
 * Constraints: resultId -> Results ON DELETE CASCADE (predictions belong to
 * their result).
 */

import {
  Check,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { CorrectedResult } from '../corrections/corrected-result.entity';
import type { Result } from '../results/result.entity';
import { Dilution } from './prediction.types';
import { PredictionClass } from '../results/result.types';
import { checkIn } from '../check-in';

@Entity('Predictions')
@Check('CHK_Predictions_dilution', checkIn('dilution', Dilution))
export class Prediction {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Predictions' })
  predictionId: number;

  @Column({
    type: 'varchar',
    length: 50,
    enum: PredictionClass,
  })
  prediction: PredictionClass;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidencePercentage: number;

  @Column({ length: 500 })
  imagePath: string;

  @Column({
    type: 'varchar',
    length: 4,
  })
  dilution: Dilution;

  // Predictions are always loaded by their result (detail, report, audit)
  @Index('IDX_Predictions_resultId')
  @Column()
  resultId: number;

  // Relations
  @ManyToOne('Result', 'predictions', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'resultId',
    foreignKeyConstraintName: 'FK_Predictions_resultId',
  })
  result: Relation<Result>;

  @OneToMany('CorrectedResult', 'prediction')
  corrections: Relation<CorrectedResult>[];
}
