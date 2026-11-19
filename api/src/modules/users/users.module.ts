/**
 * User management module
 *
 * Responsibilities:
 * - Registers all user-related services
 * - Imports the database module for data access
 * - Imports the traceability module to record actions in the audit trail
 * - Exports UsersService for other modules (notably Auth)
 * - Provides PasswordService for password handling
 *
 * Services:
 * - UsersService: user CRUD and business logic
 * - PasswordService: password hashing and validation
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { userProviders } from '../../entities/users/users.providers';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PasswordService } from '../auth/password.service';

@Module({
  imports: [DatabaseModule, TraceabilityModule],
  controllers: [UsersController],
  providers: [...userProviders, UsersService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}
