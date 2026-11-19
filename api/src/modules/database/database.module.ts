/**
 * Database module
 *
 * Responsibilities:
 * - Registers and exports the database connection providers
 * - Centralizes the TypeORM configuration for the whole application
 * - Makes the database connection available for dependency injection
 */

import { Module } from '@nestjs/common';
import { databaseProviders } from './database.providers';

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
