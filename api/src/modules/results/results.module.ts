/**
 * Results and corrections module
 *
 * Features:
 * - Wires up every service related to results and corrections
 * - Exports ResultsService for use by other modules
 *
 * Services:
 * - ResultsService: CRUD for results and corrections, plus the business rules
 *
 * Dependencies:
 * - DatabaseModule: database connection
 * - TraceabilityModule: audit-trail logging
 * - FilesModule: image file storage
 * - Patient, User, CorrectedResult and Prediction repositories: validation and relations
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { FilesModule } from '../files/files.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { resultProviders } from '../../entities/results/result.providers';
import { patientProviders } from '../../entities/patients/patient.providers';
import { userProviders } from '../../entities/users/users.providers';
import { correctedResultProviders } from '../../entities/corrections/corrected-result.providers';
import { predictionProviders } from '../../entities/predictions/prediction.providers';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [DatabaseModule, TraceabilityModule, FilesModule, PredictionsModule],
  controllers: [ResultsController],
  providers: [
    ...resultProviders,
    ...patientProviders,
    ...userProviders,
    ...correctedResultProviders,
    ...predictionProviders,
    ResultsService,
  ],
  exports: [ResultsService],
})
export class ResultsModule {}
