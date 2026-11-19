import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CHECK constraints for the enum-like varchar columns, so the database
 * rejects values the API would never write. The names match the @Check
 * decorators of the entities (TypeORM compares CHECK constraints by name).
 *
 * The allowed values are frozen here on purpose: a migration must keep
 * producing the same schema even if an enum changes later (that change needs
 * its own migration).
 */
export const CHECK_CONSTRAINTS: ReadonlyArray<{
  table: string;
  name: string;
  expression: string;
}> = [
  {
    table: 'Results',
    name: 'CHK_Results_status',
    expression: `"status" IN ('PENDING', 'CORRECTED', 'VERIFIED')`,
  },
  {
    table: 'Predictions',
    name: 'CHK_Predictions_dilution',
    expression: `"dilution" IN ('80', '160', '320', '640', '1280', '2560')`,
  },
  {
    table: 'Patients',
    name: 'CHK_Patients_documentType',
    expression: `"documentType" IN ('NATIONAL_ID', 'MINOR_ID', 'FOREIGNER_ID', 'PASSPORT', 'BIRTH_CERTIFICATE')`,
  },
  {
    table: 'Patients',
    name: 'CHK_Patients_gender',
    expression: `"gender" IN ('M', 'F', 'OTHER')`,
  },
  {
    table: 'Users',
    name: 'CHK_Users_role',
    expression: `"role" IN ('ADMIN', 'STANDARD')`,
  },
  {
    table: 'BlacklistedTokens',
    name: 'CHK_BlacklistedTokens_tokenType',
    expression: `"tokenType" IN ('ACCESS', 'REFRESH')`,
  },
];

export class CheckConstraints1790300000001 implements MigrationInterface {
  name = 'CheckConstraints1790300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // WITH CHECK (the default for a new constraint): existing rows are
    // validated, so the constraint is trusted by the optimizer
    for (const { table, name, expression } of CHECK_CONSTRAINTS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" WITH CHECK ADD CONSTRAINT "${name}" CHECK (${expression})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, name } of [...CHECK_CONSTRAINTS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`,
      );
    }
  }
}
