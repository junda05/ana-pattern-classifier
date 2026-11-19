/**
 * BlacklistedToken TypeORM entity
 *
 * Maps the 'BlacklistedTokens' table of revoked tokens
 *
 * Purpose:
 * - Stores revoked JWTs (by hash) for secure logout
 * - Prevents revoked tokens from being reused
 * - Keeps the expiry date so expired entries can be cleaned up
 *
 * Fields:
 * - tokenId: auto-increment primary key
 * - tokenHash: SHA-256 (hex) of the revoked token; the token itself is never stored
 * - tokenType: token type (ACCESS or REFRESH)
 * - expiresAt: expiration date of the original token
 * - blacklistedAt: timestamp when the entry was added
 * - userId: ID of the user who owns the token (kept for auditing)
 *
 * Relations:
 * - user: user who owns the token (ON DELETE CASCADE)
 */

import {
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { User } from '../users/users.entity';
import { TokenType } from './blacklisted-token.types';
import { UTC_NOW_SQL } from '../utc-timestamp';
import { checkIn } from '../check-in';

@Entity('BlacklistedTokens')
@Check('CHK_BlacklistedTokens_tokenType', checkIn('tokenType', TokenType))
export class BlacklistedToken {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_BlacklistedTokens' })
  tokenId: number;

  // Every authenticated request checks the blacklist by token hash
  @Index('IDX_BlacklistedTokens_tokenHash')
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  tokenType: TokenType;

  @Column()
  expiresAt: Date;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  blacklistedAt: Date;

  @Column()
  userId: number;

  // Relations
  @ManyToOne('User', 'blacklistedTokens', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_BlacklistedTokens_userId',
  })
  user: Relation<User>;
}
