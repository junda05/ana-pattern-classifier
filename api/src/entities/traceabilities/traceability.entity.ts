/**
 * Traceability TypeORM entity (audit trail record)
 *
 * Maps the 'Traceabilities' table
 *
 * Main fields:
 * - traceabilityId: auto-increment primary key
 * - dateAndHour: date and time of the activity
 * - activityType: activity performed (CREATE, UPDATE, DELETE, PASSWORD_RESET_*)
 * - entityType: affected entity type (USER, PATIENT, RESULT, CORRECTION)
 * - entityId: ID of the affected entity
 * - userId: ID of the user who performed the activity; null for system actions
 *   (seed script, bootstrap), shown as "System"
 * - fieldChanged: field that was changed (optional)
 * - previousValue: previous value of the field (optional)
 * - newValue: new value of the field (optional)
 *
 * Relations:
 * - user: user who performed the activity (null for system actions)
 *
 * Constraints (SQL Server):
 * - userId -> Users ON DELETE SET NULL: the record survives as a system/unknown
 *   action if its user row is ever deleted (users are normally deactivated).
 * - Index (dateAndHour): the audit trail is listed newest first, paginated.
 * - Index (entityType, entityId): the records of one entity are looked up by
 *   type and id (e.g. the latest UPDATE of a result for its report).
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
import type { User } from '../users/users.entity';
import { ActivityType, EntityType } from './traceability.types';
import { UTC_NOW_SQL } from '../utc-timestamp';

@Entity('Traceabilities')
@Index('IDX_Traceabilities_dateAndHour', ['dateAndHour'])
@Index('IDX_Traceabilities_entity', ['entityType', 'entityId'])
export class Traceability {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Traceabilities' })
  traceabilityId: number;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  dateAndHour: Date;

  @Column({
    type: 'varchar',
    length: 50,
  })
  activityType: ActivityType;

  @Column({
    type: 'varchar',
    length: 20,
  })
  entityType: EntityType;

  @Column()
  entityId: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ length: 50, nullable: true })
  fieldChanged?: string;

  // Plain values or JSON snapshots of any size (Unicode)
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  previousValue?: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  newValue?: string;

  // Relations
  @ManyToOne('User', 'traceabilities', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_Traceabilities_userId',
  })
  user: Relation<User> | null;
}
