/**
 * CorrectedResult entity providers
 *
 * Registers the corrections repository for dependency injection
 */

import { DataSource } from 'typeorm';
import { CorrectedResult } from './corrected-result.entity';

export const correctedResultProviders = [
  {
    provide: 'CORRECTED_RESULT_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(CorrectedResult),
    inject: ['DATA_SOURCE'],
  },
];
