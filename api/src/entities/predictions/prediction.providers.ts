/**
 * Prediction entity provider
 *
 * Registers the Prediction repository for dependency injection
 */

import { DataSource } from 'typeorm';
import { Prediction } from './prediction.entity';

export const predictionProviders = [
  {
    provide: 'PREDICTION_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(Prediction),
    inject: ['DATA_SOURCE'],
  },
];
