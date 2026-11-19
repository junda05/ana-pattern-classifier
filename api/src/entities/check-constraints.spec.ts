import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Result } from './results/result.entity';
import { Prediction } from './predictions/prediction.entity';
import { Patient } from './patients/patient.entity';
import { User } from './users/users.entity';
import { BlacklistedToken } from './auth/blacklisted-token.entity';
import { ResultStatus } from './results/result.types';
import { Dilution } from './predictions/prediction.types';
import { DocumentType, Gender } from './patients/patient.types';
import { UserRole } from './users/user.types';
import { TokenType } from './auth/blacklisted-token.types';
import { CHECK_CONSTRAINTS } from '../modules/database/migrations/1790300000001-CheckConstraints';

/** The quoted literals of an IN (...) expression, in order. */
function literals(expression: string): string[] {
  return [...expression.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

const expected: Array<[string, string, object, Record<string, string>]> = [
  ['Results', 'CHK_Results_status', Result, ResultStatus],
  ['Predictions', 'CHK_Predictions_dilution', Prediction, Dilution],
  ['Patients', 'CHK_Patients_documentType', Patient, DocumentType],
  ['Patients', 'CHK_Patients_gender', Patient, Gender],
  ['Users', 'CHK_Users_role', User, UserRole],
  [
    'BlacklistedTokens',
    'CHK_BlacklistedTokens_tokenType',
    BlacklistedToken,
    TokenType,
  ],
];

describe('CHECK constraints of the enum-like columns', () => {
  const decorated = getMetadataArgsStorage().checks;

  it.each(expected)(
    '%s has %s in the entity and in the migration, listing exactly the enum values',
    (table, name, entity, values) => {
      const onEntity = decorated.find(
        (check) => check.target === entity && check.name === name,
      );
      const inMigration = CHECK_CONSTRAINTS.find(
        (check) => check.name === name,
      );

      expect(onEntity).toBeDefined();
      expect(inMigration).toMatchObject({ table, name });
      expect(literals(onEntity!.expression)).toEqual(Object.values(values));
      expect(literals(inMigration!.expression)).toEqual(Object.values(values));
    },
  );

  it('the migration creates no other constraint', () => {
    expect(CHECK_CONSTRAINTS.map((check) => check.name).sort()).toEqual(
      expected.map(([, name]) => name).sort(),
    );
  });
});
