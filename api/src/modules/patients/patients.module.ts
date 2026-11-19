/**
 * Patient management module
 *
 * Responsibilities:
 * - Registers all patient-related services
 * - Imports the database module for data access
 * - Imports the traceability module to record actions in the audit trail
 * - Exports PatientsService for other modules (notably Results)
 *
 * Services:
 * - PatientsService: patient CRUD and business logic
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { patientProviders } from '../../entities/patients/patient.providers';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [DatabaseModule, TraceabilityModule],
  controllers: [PatientsController],
  providers: [...patientProviders, PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
