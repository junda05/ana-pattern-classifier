import {
  checkPlaceholderSecrets,
  findPlaceholderSecrets,
} from './placeholder-secrets';

const REAL = {
  JWT_SECRET: 'b5f1c0e2a9d84f7e',
  SENDGRID_API_KEY: 'configured-sendgrid-key',
  PREDICTOR_API_KEY: '7c1d9a4e2f',
  PREDICTION_SIGNING_SECRET: '3e8a61f0c2b94d57',
};

describe('placeholder secrets', () => {
  let warn: jest.Mock<void, [string]>;

  beforeEach(() => {
    warn = jest.fn<void, [string]>();
  });

  it('finds secrets that still start with "change-me"', () => {
    const env = {
      ...REAL,
      JWT_SECRET: 'change-me-to-a-long-random-string',
      PREDICTOR_API_KEY: 'CHANGE-ME',
    };
    expect(findPlaceholderSecrets(env)).toEqual([
      'JWT_SECRET',
      'PREDICTOR_API_KEY',
    ]);
  });

  it('ignores other variables and unset secrets', () => {
    const env = { DB_PASSWORD: 'change-me', JWT_SECRET: REAL.JWT_SECRET };
    expect(findPlaceholderSecrets(env)).toEqual([]);
  });

  it('does nothing when every secret is real', () => {
    checkPlaceholderSecrets({ ...REAL, NODE_ENV: 'production' }, { warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns but starts outside production', () => {
    const env = {
      ...REAL,
      SENDGRID_API_KEY: 'change-me',
      NODE_ENV: 'development',
    };
    expect(() => checkPlaceholderSecrets(env, { warn })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('SENDGRID_API_KEY');
  });

  it('refuses to start in production', () => {
    const env = { ...REAL, JWT_SECRET: 'change-me', NODE_ENV: 'production' };
    expect(() => checkPlaceholderSecrets(env, { warn })).toThrow(/JWT_SECRET/);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('refuses to start in production with the placeholder prediction signing secret', () => {
    const env = {
      ...REAL,
      PREDICTION_SIGNING_SECRET: 'change-me-to-another-long-random-string',
      NODE_ENV: 'production',
    };
    expect(findPlaceholderSecrets(env)).toEqual(['PREDICTION_SIGNING_SECRET']);
    expect(() => checkPlaceholderSecrets(env, { warn })).toThrow(
      /PREDICTION_SIGNING_SECRET/,
    );
  });
});
