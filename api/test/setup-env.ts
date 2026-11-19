/**
 * Environment of the e2e tests (Jest `setupFiles`: runs before any test module is imported)
 *
 * The database comes from DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD and DB_NAME; by default
 * a local SQL Server container published on port 14332:
 *   docker run -d --name ana-e2e-db -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='E2e-Passw0rd!' \
 *     -p 14332:1433 mcr.microsoft.com/mssql/server:2022-latest
 * and an empty database named ana_classifier_test (the tests apply the migrations).
 *
 * Every other variable the application reads is set here explicitly, so a developer's
 * api/.env (which dotenv and ConfigModule read but never let override variables that are
 * already set) cannot leak into the tests.
 */

import { tmpdir } from 'os';
import { join } from 'path';

const DATABASE_DEFAULTS: Record<string, string> = {
  DB_HOST: 'localhost',
  DB_PORT: '14332',
  DB_USERNAME: 'sa',
  DB_PASSWORD: 'E2e-Passw0rd!',
  DB_NAME: 'ana_classifier_test',
};

for (const [name, value] of Object.entries(DATABASE_DEFAULTS)) {
  process.env[name] = process.env[name] || value;
}

// The suites delete every row between runs: refuse anything but a dedicated test database.
if (!/_test$/i.test(process.env.DB_NAME ?? '')) {
  throw new Error(
    `The e2e tests delete all data; DB_NAME must end with "_test" (got "${process.env.DB_NAME}").`,
  );
}

const TEST_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: 'test',
  APP_TIMEZONE: 'UTC',
  TZ: 'UTC',
  FRONTEND_URL: 'http://localhost:3000',
  API_BASE_URL: 'http://localhost:8001',
  JWT_SECRET: 'e2e-only-jwt-secret-0123456789abcdef',
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '1h',
  PASSWORD_RESET_TOKEN_EXPIRATION: '30m',
  UPLOADS_DIR: join(tmpdir(), `ana-e2e-uploads-${process.pid}`),
  MAX_FILE_SIZE: String(10 * 1024 * 1024),
  // The predictor is replaced by a fake in every suite; this address is never called.
  PREDICTOR_URL: 'http://127.0.0.1:9',
  PREDICTOR_API_KEY: 'e2e-only-predictor-key',
  PREDICTOR_TIMEOUT_MS: '1000',
  PREDICTION_SIGNING_SECRET: 'e2e-only-prediction-signing-secret',
  // Empty: password-reset notifications are logged, never emailed.
  SENDGRID_API_KEY: '',
  SENDGRID_FROM_EMAIL: 'no-reply@example.com',
  SENDGRID_FROM_NAME: 'ANA Pattern Classifier',
  ADMIN_USERNAME: 'admin',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: '',
  ADMIN_FULL_NAME: 'System Administrator',
  ADMIN_PROFESSIONAL_CARD: 'ADMIN-0001',
  // High enough that no suite trips the per-IP auth rate limits (every request
  // comes from 127.0.0.1); rate-limit.e2e-spec.ts lowers them for its own app.
  AUTH_RATE_LIMIT_WINDOW_SECONDS: '60',
  AUTH_RATE_LIMIT_LOGIN: '1000',
  AUTH_RATE_LIMIT_REFRESH: '1000',
  AUTH_RATE_LIMIT_PASSWORD_RESET: '1000',
  TRUST_PROXY: '',
};

Object.assign(process.env, TEST_ENVIRONMENT);
