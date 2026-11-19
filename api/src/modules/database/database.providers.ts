/**
 * Database connection providers
 *
 * Responsibilities:
 * - Connects to SQL Server through TypeORM
 * - Reuses the shared DataSource configuration for consistency
 * - Used by NestJS at runtime
 */

import { AppDataSource } from './data-source';

export const databaseProviders = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      return AppDataSource.initialize();
    },
  },
];
