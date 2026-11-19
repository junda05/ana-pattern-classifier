/**
 * Traceability entity providers
 *
 * Registers the audit trail repository for dependency injection
 */

import { DataSource } from 'typeorm';
import { Traceability } from './traceability.entity';

export const traceabilityProviders = [
  {
    provide: 'TRACEABILITY_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(Traceability),
    inject: ['DATA_SOURCE'],
  },
];
