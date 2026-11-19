/**
 * User entity for TypeORM
 *
 * Represents the 'Users' table in the database
 *
 * Main fields:
 * - userId: Auto-increment primary key
 * - username: Unique username
 * - password: Hashed password
 * - fullName: User's full name
 * - email: Unique email
 * - professionalCard: Professional license number (required)
 * - role: User role (ADMIN, STANDARD)
 * - isActive: Active/inactive status
 * - dateJoined: Automatic registration date
 * - lastLogin: Last access timestamp (optional)
 * - passwordChangedAt: When the password was last reset (optional); tokens
 *   issued earlier are rejected
 *
 * Relations:
 * - results: Results created by the user
 * - traceabilities: Audit-trail records created by the user
 * - blacklistedTokens: Revoked tokens of the user
 */

import {
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { BlacklistedToken } from '../auth/blacklisted-token.entity';
import type { Result } from '../results/result.entity';
import type { Traceability } from '../traceabilities/traceability.entity';
import { UserRole } from './user.types';
import { UTC_NOW_SQL } from '../utc-timestamp';
import { checkIn } from '../check-in';

@Entity('Users')
@Check('CHK_Users_role', checkIn('role', UserRole))
@Unique('UQ_Users_username', ['username'])
@Unique('UQ_Users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Users' })
  userId: number;

  // Unique constraint (and its index) serve the login lookup by username
  @Column({ length: 50 })
  username: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 100 })
  fullName: string;

  // Unique constraint: one account per email address
  @Column({ length: 100 })
  email: string;

  @Column({ length: 50 })
  professionalCard: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: UserRole.STANDARD,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ default: () => UTC_NOW_SQL })
  dateJoined: Date;

  @Column({ nullable: true, type: 'datetime' })
  lastLogin?: Date;

  // Set by a password reset: tokens issued before it are rejected
  @Column({ nullable: true, type: 'datetime2' })
  passwordChangedAt?: Date | null;

  // Relations
  @OneToMany('Result', 'user')
  results: Relation<Result>[];

  @OneToMany('Traceability', 'user')
  traceabilities: Relation<Traceability>[];

  @OneToMany('BlacklistedToken', 'user')
  blacklistedTokens: Relation<BlacklistedToken>[];
}
