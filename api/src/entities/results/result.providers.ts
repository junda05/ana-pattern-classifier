/**
 * Result entity providers
 *
 * Registers the results repository for dependency injection
 */

import { DataSource } from 'typeorm';
import { Result } from './result.entity';

export const resultProviders = [
  {
    provide: 'RESULT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Result),
    inject: ['DATA_SOURCE'],
  },
];
