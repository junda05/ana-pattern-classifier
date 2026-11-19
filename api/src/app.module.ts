/**
 * Root module of the NestJS application
 *
 * Responsibilities:
 * - Loads environment variables globally
 * - Imports and wires together all feature modules
 * - Defines the modular architecture of the application
 *
 * Included modules:
 * - DatabaseModule: database connection
 * - TraceabilityModule: audit trail of user actions
 * - FilesModule: file and image management
 * - UsersModule: user management
 * - PatientsModule: patient management
 * - ResultsModule: results and corrections
 * - ReportsModule: finalized clinical reports
 * - AuthModule: authentication and authorization
 * - PredictionsModule: proxy to the prediction service (image analysis)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { FilesModule } from './modules/files/files.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ResultsModule } from './modules/results/results.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { PredictionsModule } from './modules/predictions/predictions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    TraceabilityModule,
    FilesModule,
    UsersModule,
    PatientsModule,
    ResultsModule,
    ReportsModule,
    AuthModule,
    PredictionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
