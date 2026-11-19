/**
 * Adds Users.passwordChangedAt (nullable datetime2): set by a password reset;
 * JWTs issued before it are rejected, so a reset ends every existing session.
 * Existing users keep NULL (no reset recorded, every token stays valid).
 * down() drops the column.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordChangedAt1790300000000 implements MigrationInterface {
  name = 'PasswordChangedAt1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Users" ADD "passwordChangedAt" datetime2`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Users" DROP COLUMN "passwordChangedAt"`,
    );
  }
}
