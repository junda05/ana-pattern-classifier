/**
 * Repository provider for the User entity
 *
 * Responsibilities:
 * - Registers the User repository for dependency injection
 * - Binds the User entity to the TypeORM DataSource
 * - Enables the Repository pattern in UsersService
 *
 * Token: 'USER_REPOSITORY'
 * Usage: injected into UsersService for database operations
 */

import { DataSource } from 'typeorm';
import { User } from './users.entity';

export const userProviders = [
  {
    provide: 'USER_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(User),
    inject: ['DATA_SOURCE'],
  },
];
