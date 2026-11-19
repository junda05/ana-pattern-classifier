import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { SqlServerConnectionOptions } from 'typeorm/driver/sqlserver/SqlServerConnectionOptions';
import { AppDataSource } from './data-source';
import { Result } from '../../entities/results/result.entity';
import { Traceability } from '../../entities/traceabilities/traceability.entity';
import { CorrectedResult } from '../../entities/corrections/corrected-result.entity';
import { User } from '../../entities/users/users.entity';
import { BlacklistedToken } from '../../entities/auth/blacklisted-token.entity';
import { PasswordResetToken } from '../../entities/auth/password-reset-token.entity';

type DataSourceModule = typeof import('./data-source');

/** Evaluates data-source.ts afresh with the given NODE_ENV. */
function loadWithNodeEnv(nodeEnv: string): DataSourceModule {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    let loaded: DataSourceModule | undefined;
    jest.isolateModules(() => {
      loaded = jest.requireActual<DataSourceModule>('./data-source');
    });
    return loaded as DataSourceModule;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

/** Evaluates data-source.ts afresh with the given environment variables. */
function loadWithEnv(
  values: Record<string, string | undefined>,
): SqlServerConnectionOptions {
  const previous: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(values)) {
    previous[name] = process.env[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  try {
    let loaded: DataSourceModule | undefined;
    jest.isolateModules(() => {
      loaded = jest.requireActual<DataSourceModule>('./data-source');
    });
    return (loaded as DataSourceModule).AppDataSource
      .options as SqlServerConnectionOptions;
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

describe('AppDataSource encryption settings', () => {
  it('defaults to no encryption and a trusted server certificate (Compose network)', () => {
    // Empty rather than unset, so a developer's api/.env (read by dotenv) cannot interfere
    const options = loadWithEnv({
      DB_ENCRYPT: '',
      DB_TRUST_SERVER_CERTIFICATE: '',
    });

    expect(options.options?.encrypt).toBe(false);
    expect(options.options?.trustServerCertificate).toBe(true);
  });

  it('reads DB_ENCRYPT and DB_TRUST_SERVER_CERTIFICATE', () => {
    const options = loadWithEnv({
      DB_ENCRYPT: 'true',
      DB_TRUST_SERVER_CERTIFICATE: 'false',
    });

    expect(options.options?.encrypt).toBe(true);
    expect(options.options?.trustServerCertificate).toBe(false);
  });

  it.each([
    ['1', '0', true, false],
    ['TRUE', 'FALSE', true, false],
    ['yes', 'no', true, false],
  ])(
    'parses DB_ENCRYPT=%p and DB_TRUST_SERVER_CERTIFICATE=%p',
    (encrypt, trust, expectedEncrypt, expectedTrust) => {
      const options = loadWithEnv({
        DB_ENCRYPT: encrypt,
        DB_TRUST_SERVER_CERTIFICATE: trust,
      });

      expect(options.options?.encrypt).toBe(expectedEncrypt);
      expect(options.options?.trustServerCertificate).toBe(expectedTrust);
    },
  );

  it('refuses a value that is not a boolean', () => {
    expect(() => loadWithEnv({ DB_ENCRYPT: 'maybe' })).toThrow(
      'DB_ENCRYPT must be true or false (got "maybe").',
    );
  });
});

describe('AppDataSource', () => {
  it.each(['development', 'production', 'test'])(
    'never synchronizes the schema and never runs migrations on connect (NODE_ENV=%s)',
    (nodeEnv) => {
      const { AppDataSource: dataSource } = loadWithNodeEnv(nodeEnv);

      expect(dataSource.options.synchronize).toBe(false);
      expect(dataSource.options.migrationsRun).toBe(false);
    },
  );

  it('loads the migrations stored next to the data source (src or dist)', () => {
    expect(AppDataSource.options.migrations).toEqual([
      join(__dirname, 'migrations', '*{.ts,.js}'),
    ]);
  });

  it('reads and writes DATETIME values as UTC', () => {
    const options = AppDataSource.options as SqlServerConnectionOptions;
    expect(options.options?.useUTC).toBe(true);
  });

  it('generates every creation timestamp with the UTC database clock', () => {
    const domainEntities: unknown[] = [
      Result,
      Traceability,
      CorrectedResult,
      User,
      BlacklistedToken,
      PasswordResetToken,
    ];
    const createDateColumns = getMetadataArgsStorage().columns.filter(
      (column) =>
        column.mode === 'createDate' && domainEntities.includes(column.target),
    );

    expect(createDateColumns).toHaveLength(domainEntities.length);
    for (const column of createDateColumns) {
      const defaultValue: unknown = column.options.default;
      const sql: unknown =
        typeof defaultValue === 'function'
          ? (defaultValue as () => unknown)()
          : defaultValue;
      expect({ column: column.propertyName, sql }).toEqual({
        column: column.propertyName,
        sql: 'SYSUTCDATETIME()',
      });
    }
  });
});
