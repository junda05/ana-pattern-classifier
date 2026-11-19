/**
 * Audit-trail (traceability) module
 *
 * Features:
 * - Provides the service that logs actions
 * - Provides the controller that queries audit records
 * - Imports the database module for data access
 * - Exports TraceabilityService for use by other modules
 *
 * Included:
 * - TraceabilityService: logs and queries actions performed in the system
 * - TraceabilityController: REST endpoints to query audit records
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { traceabilityProviders } from '../../entities/traceabilities/traceability.providers';
import { userProviders } from '../../entities/users/users.providers';
import { patientProviders } from '../../entities/patients/patient.providers';
import { resultProviders } from '../../entities/results/result.providers';
import { predictionProviders } from '../../entities/predictions/prediction.providers';
import { TraceabilityService } from './traceability.service';
import { TraceabilityController } from './traceability.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TraceabilityController],
  providers: [
    ...traceabilityProviders,
    ...userProviders,
    ...patientProviders,
    ...resultProviders,
    ...predictionProviders,
    TraceabilityService,
  ],
  exports: [TraceabilityService],
})
export class TraceabilityModule {}
