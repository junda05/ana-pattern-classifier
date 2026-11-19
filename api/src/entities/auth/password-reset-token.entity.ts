/**
 * PasswordResetToken TypeORM entity
 *
 * Maps the 'PasswordResetTokens' table
 *
 * Main fields:
 * - tokenId: auto-increment primary key
 * - userId: ID of the user requesting the reset
 * - token: unique random token (base64url) used for validation
 * - expiresAt: expiration date and time of the token
 * - isUsed: whether the token has already been used
 * - createdAt: creation date (set automatically)
 *
 * Relations:
 * - user: user the token belongs to (ON DELETE CASCADE)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { User } from '../users/users.entity';
import { UTC_NOW_SQL } from '../utc-timestamp';

@Entity('PasswordResetTokens')
@Unique('UQ_PasswordResetTokens_token', ['token'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_PasswordResetTokens',
  })
  tokenId: number;

  // Previous unused tokens of a user are invalidated by userId
  @Column()
  @Index('IDX_PasswordResetTokens_userId')
  userId: number;

  // The unique constraint (and its index) serve the lookup by token
  @Column({ length: 255 })
  token: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  createdAt: Date;

  // Relation to User
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_PasswordResetTokens_userId',
  })
  user: Relation<User>;
}
