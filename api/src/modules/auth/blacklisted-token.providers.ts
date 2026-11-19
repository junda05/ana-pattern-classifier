/**
 * Repository provider for blacklisted tokens
 *
 * Responsibilities:
 * - Registers the BlacklistedToken repository for dependency injection
 * - Binds the BlacklistedToken entity to the TypeORM DataSource
 * - Enables the Repository pattern in TokenBlacklistService
 *
 * Token: 'BLACKLISTED_TOKEN_REPOSITORY'
 * Usage: injected into TokenBlacklistService for blacklist operations
 */

import { DataSource } from 'typeorm';
import { BlacklistedToken } from '../../entities/auth/blacklisted-token.entity';

export const blacklistedTokenProviders = [
  {
    provide: 'BLACKLISTED_TOKEN_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(BlacklistedToken),
    inject: ['DATA_SOURCE'],
  },
];
