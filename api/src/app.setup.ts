/**
 * HTTP pipeline shared by the application entry point (main.ts) and the e2e tests
 *
 * - Adds security headers (helmet)
 * - Configures CORS so only the frontend (FRONTEND_URL) can call the API
 * - Registers a global ValidationPipe for automatic DTO validation
 * - Sets Express "trust proxy" only when TRUST_PROXY is set, so the client IP
 *   used by the rate limits comes from X-Forwarded-For only behind a trusted
 *   reverse proxy ("true", a hop count such as "1", or addresses/subnets such
 *   as "loopback" or "10.0.0.0/8"; see the Express documentation)
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

type TrustProxy = boolean | number | string;

/** Express "trust proxy" value for TRUST_PROXY; undefined when it is not set. */
export function trustProxySetting(
  value: string | undefined,
): TrustProxy | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

export function configureApp(app: INestApplication): void {
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) {
    const express = app.getHttpAdapter().getInstance() as {
      set: (setting: string, value: TrustProxy) => void;
    };
    express.set('trust proxy', trustProxy);
  }

  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global ValidationPipe for automatic DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that are not declared in the DTO
      forbidNonWhitelisted: true, // Reject requests that contain undeclared properties
      transform: true, // Transform payloads into DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types automatically
      },
      stopAtFirstError: true, // Report only the first validation error per field
    }),
  );
}
