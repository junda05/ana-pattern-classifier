/**
 * PasswordResetToken providers
 *
 * Registers the TypeORM repository for dependency injection
 * using the DataSource configured in DatabaseModule
 *
 * Usage in modules:
 * @Inject('PASSWORD_RESET_TOKEN_REPOSITORY')
 * private passwordResetTokenRepository: Repository<PasswordResetToken>
 */

import { DataSource } from 'typeorm';
import { PasswordResetToken } from './password-reset-token.entity';

export const passwordResetTokenProviders = [
  {
    provide: 'PASSWORD_RESET_TOKEN_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(PasswordResetToken),
    inject: ['DATA_SOURCE'],
  },
];
