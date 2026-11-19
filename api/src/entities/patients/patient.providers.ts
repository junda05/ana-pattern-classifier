/**
 * Patient entity providers
 *
 * Registers the patient repository for dependency injection
 */

import { DataSource } from 'typeorm';
import { Patient } from './patient.entity';

export const patientProviders = [
  {
    provide: 'PATIENT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Patient),
    inject: ['DATA_SOURCE'],
  },
];
