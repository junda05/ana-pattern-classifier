/**
 * Creates the initial administrator account.
 *
 * Account data comes from environment variables so that no credentials live in the
 * source tree. The data is validated with the same rules as the create-user endpoint
 * before any database connection is opened. Safe to run repeatedly: it exits without
 * changes if the username exists.
 *
 * Usage: npm run seed:admin (ts-node) or npm run seed:admin:prod (node, from dist).
 * The schema must exist first (npm run migration:run / migration:run:prod).
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CreateUserDto } from '../DTOs/users/create-user.dto';
import { UserRole } from '../entities/users/user.types';

const PLACEHOLDER_PREFIX = 'change-me';

async function readAdminFromEnv(): Promise<CreateUserDto> {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!password || password.startsWith(PLACEHOLDER_PREFIX)) {
    throw new Error(
      'Set ADMIN_PASSWORD to a real password (the env.example placeholder is rejected).',
    );
  }

  const dto = plainToInstance(CreateUserDto, {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password,
    fullName: process.env.ADMIN_FULL_NAME || 'System Administrator',
    professionalCard: process.env.ADMIN_PROFESSIONAL_CARD || 'ADMIN-0001',
    role: UserRole.ADMIN,
  });

  const errors = await validate(dto);
  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(`Invalid administrator settings: ${details.join('; ')}`);
  }
  return dto;
}

async function createAdminUser() {
  // Validate before connecting so a bad configuration never touches the database.
  const adminUserData = await readAdminFromEnv();
  process.env.TZ = process.env.APP_TIMEZONE || 'UTC';

  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    const existingUser = await usersService.findByUsername(
      adminUserData.username,
    );
    if (existingUser) {
      console.log(
        `Administrator "${existingUser.username}" already exists; nothing to do.`,
      );
      return;
    }

    // The bootstrap administrator has no creator: the audit trail records a
    // system action (null user, shown as "System").
    const newUser = await usersService.create(adminUserData, null);
    console.log(
      `Administrator created: id=${newUser.userId} username=${newUser.username} email=${newUser.email}`,
    );
  } catch (error) {
    console.error(
      'Could not create the administrator:',
      (error as Error).message,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

createAdminUser().catch((error) => {
  console.error('Fatal error:', (error as Error).message);
  process.exit(1);
});
