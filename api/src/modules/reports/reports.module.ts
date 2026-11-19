/**
 * Clinical reports module
 *
 * Provides the endpoints for querying finalized clinical reports.
 *
 * Imports:
 * - DatabaseModule: repository access
 *
 * Providers:
 * - resultProviders: results repository (with patient, predictions, corrections)
 * - userProviders: users repository (responsible physician)
 * - traceabilityProviders: audit-trail repository (last modification date)
 * - ReportsService: report business logic
 *
 * Controllers:
 * - ReportsController: HTTP endpoints for reports
 *
 * Exports:
 * - ReportsService: for use by other modules if needed
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { resultProviders } from '../../entities/results/result.providers';
import { userProviders } from '../../entities/users/users.providers';
import { traceabilityProviders } from '../../entities/traceabilities/traceability.providers';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [
    ...resultProviders,
    ...userProviders,
    ...traceabilityProviders,
    ReportsService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
