/**
 * NestJS application entry point
 *
 * Responsibilities:
 * - Refuses to start in production while placeholder secrets are configured
 * - Creates the NestJS application
 * - Applies the shared HTTP pipeline (app.setup.ts): security headers (helmet),
 *   CORS restricted to the frontend (FRONTEND_URL), the global ValidationPipe
 *   and Express "trust proxy" (only when TRUST_PROXY is set)
 * - Listens on PORT (default 8001)
 *
 * Uploaded images are NOT served statically: they are only available through
 * the JWT-protected files controller.
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { checkPlaceholderSecrets } from './modules/auth/placeholder-secrets';

// Pin the process timezone so stored timestamps and report dates are consistent across hosts.
process.env.TZ = process.env.APP_TIMEZONE || 'UTC';

const DEFAULT_PORT = 8001;

const logger = new Logger('Bootstrap');

async function bootstrap() {
  checkPlaceholderSecrets(process.env, logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
  logger.log(`Timezone: ${process.env.TZ}`);
}

bootstrap().catch((error: unknown) => {
  logger.error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
