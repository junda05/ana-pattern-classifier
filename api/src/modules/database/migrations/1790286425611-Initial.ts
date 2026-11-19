/**
 * Initial schema of the ANA Pattern Classifier database, generated from the
 * entities (npm run migration:generate). It expects an empty database; the
 * rationale for each foreign-key action and index is documented on the
 * entities. down() drops everything in reverse order.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1790286425611 implements MigrationInterface {
  name = 'Initial1790286425611';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "Users" ("userId" int NOT NULL IDENTITY(1,1), "username" nvarchar(50) NOT NULL, "password" nvarchar(255) NOT NULL, "fullName" nvarchar(100) NOT NULL, "email" nvarchar(100) NOT NULL, "professionalCard" nvarchar(50) NOT NULL, "role" varchar(10) NOT NULL CONSTRAINT "DF_a8fa87b58ffe43f6dd82ee6ef24" DEFAULT 'STANDARD', "isActive" bit NOT NULL CONSTRAINT "DF_b803cce4748496c380d73466cbf" DEFAULT 1, "dateJoined" datetime2 NOT NULL CONSTRAINT "DF_51ee111f26cfb32728b33ccafe8" DEFAULT SYSUTCDATETIME(), "lastLogin" datetime, CONSTRAINT "UQ_Users_email" UNIQUE ("email"), CONSTRAINT "UQ_Users_username" UNIQUE ("username"), CONSTRAINT "PK_Users" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Traceabilities" ("traceabilityId" int NOT NULL IDENTITY(1,1), "dateAndHour" datetime2 NOT NULL CONSTRAINT "DF_02084201e1938821c5122edf39c" DEFAULT SYSUTCDATETIME(), "activityType" varchar(50) NOT NULL, "entityType" varchar(20) NOT NULL, "entityId" int NOT NULL, "userId" int, "fieldChanged" nvarchar(50), "previousValue" nvarchar(MAX), "newValue" nvarchar(MAX), CONSTRAINT "PK_Traceabilities" PRIMARY KEY ("traceabilityId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_Traceabilities_entity" ON "Traceabilities" ("entityType", "entityId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_Traceabilities_dateAndHour" ON "Traceabilities" ("dateAndHour") `,
    );
    await queryRunner.query(
      `CREATE TABLE "Predictions" ("predictionId" int NOT NULL IDENTITY(1,1), "prediction" varchar(50) CONSTRAINT CHK_0f4230af2be09027d84c3c8202_ENUM CHECK(prediction IN ('NEGATIVE','NUCLEAR','CYTOPLASMIC','MITOTIC','NUCLEAR_HOMOGENEOUS','NUCLEAR_DENSE_FINE_SPECKLED','NUCLEAR_CENTROMERE','NUCLEAR_SPECKLED','NUCLEOLAR','CYTOPLASMIC_FIBRILLAR','CYTOPLASMIC_DISCRETE_DOTS','CYTOPLASMIC_SPECKLED','CYTOPLASMIC_RETICULAR_AMA','CYTOPLASMIC_POLAR_GOLGI','NUCLEOLAR_HOMOGENEOUS','NUCLEOLAR_CLUMPY','NUCLEOLAR_PUNCTATE','CYTOPLASMIC_DENSE_FINE_SPECKLED','CYTOPLASMIC_FINE_SPECKLED','MITOTIC_CENTROSOME','MITOTIC_SPINDLE_FIBERS','MITOTIC_NUMA','MITOTIC_INTERCELLULAR_BRIDGE','MITOTIC_CHROMOSOMAL_ENVELOPE')) NOT NULL, "confidencePercentage" decimal(5,2) NOT NULL, "imagePath" nvarchar(500) NOT NULL, "dilution" varchar(4) NOT NULL, "resultId" int NOT NULL, CONSTRAINT "PK_Predictions" PRIMARY KEY ("predictionId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_Predictions_resultId" ON "Predictions" ("resultId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "Patients" ("patientId" int NOT NULL IDENTITY(1,1), "fullName" nvarchar(100) NOT NULL, "documentType" varchar(20) NOT NULL, "documentNumber" nvarchar(20) NOT NULL, "gender" varchar(10) NOT NULL, "birthDate" date NOT NULL, "phonePrefix" nvarchar(5) NOT NULL CONSTRAINT "DF_0869c2077984fbf858b6d480ae7" DEFAULT '+1', "phoneNumber" nvarchar(15) NOT NULL, "email" nvarchar(50), CONSTRAINT "PK_Patients" PRIMARY KEY ("patientId"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_Patients_document" ON "Patients" ("documentType", "documentNumber") `,
    );
    await queryRunner.query(
      `CREATE TABLE "PasswordResetTokens" ("tokenId" int NOT NULL IDENTITY(1,1), "userId" int NOT NULL, "token" nvarchar(255) NOT NULL, "expiresAt" datetime NOT NULL, "isUsed" bit NOT NULL CONSTRAINT "DF_6799634cb4312a3a02f48dba0e8" DEFAULT 0, "createdAt" datetime2 NOT NULL CONSTRAINT "DF_2c85c99e87eac01f4d34ecc8204" DEFAULT SYSUTCDATETIME(), CONSTRAINT "UQ_PasswordResetTokens_token" UNIQUE ("token"), CONSTRAINT "PK_PasswordResetTokens" PRIMARY KEY ("tokenId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PasswordResetTokens_userId" ON "PasswordResetTokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "Results" ("resultId" int NOT NULL IDENTITY(1,1), "dateAndHour" datetime2 NOT NULL CONSTRAINT "DF_9ffb8d2efb90e55d867c17c4496" DEFAULT SYSUTCDATETIME(), "observations" nvarchar(1000), "status" varchar(20) NOT NULL CONSTRAINT "DF_dbea1f836dc19161d357a3f90fe" DEFAULT 'PENDING', "patientId" int NOT NULL, "userId" int NOT NULL, "verifiedBy" int, "verifiedAt" datetime2, CONSTRAINT "PK_Results" PRIMARY KEY ("resultId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_Results_status_dateAndHour" ON "Results" ("status", "dateAndHour") `,
    );
    await queryRunner.query(
      `CREATE TABLE "CorrectedResults" ("correctedResultId" int NOT NULL IDENTITY(1,1), "correctedPrediction" varchar(50) CONSTRAINT CHK_883b6b93b0d6541e89b39efc2c_ENUM CHECK(correctedPrediction IN ('NEGATIVE','NUCLEAR','CYTOPLASMIC','MITOTIC','NUCLEAR_HOMOGENEOUS','NUCLEAR_DENSE_FINE_SPECKLED','NUCLEAR_CENTROMERE','NUCLEAR_SPECKLED','NUCLEOLAR','CYTOPLASMIC_FIBRILLAR','CYTOPLASMIC_DISCRETE_DOTS','CYTOPLASMIC_SPECKLED','CYTOPLASMIC_RETICULAR_AMA','CYTOPLASMIC_POLAR_GOLGI','NUCLEOLAR_HOMOGENEOUS','NUCLEOLAR_CLUMPY','NUCLEOLAR_PUNCTATE','CYTOPLASMIC_DENSE_FINE_SPECKLED','CYTOPLASMIC_FINE_SPECKLED','MITOTIC_CENTROSOME','MITOTIC_SPINDLE_FIBERS','MITOTIC_NUMA','MITOTIC_INTERCELLULAR_BRIDGE','MITOTIC_CHROMOSOMAL_ENVELOPE')) NOT NULL, "observations" nvarchar(1000), "correctedDate" datetime2 NOT NULL CONSTRAINT "DF_f451305dcf921326f6c21479b4e" DEFAULT SYSUTCDATETIME(), "predictionId" int NOT NULL, "correctedBy" int NOT NULL, CONSTRAINT "PK_CorrectedResults" PRIMARY KEY ("correctedResultId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CorrectedResults_predictionId" ON "CorrectedResults" ("predictionId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "BlacklistedTokens" ("tokenId" int NOT NULL IDENTITY(1,1), "tokenHash" char(64) NOT NULL, "tokenType" varchar(10) NOT NULL, "expiresAt" datetime NOT NULL, "blacklistedAt" datetime2 NOT NULL CONSTRAINT "DF_cdf03fefd135dfecd49ca1d3b9d" DEFAULT SYSUTCDATETIME(), "userId" int NOT NULL, CONSTRAINT "PK_BlacklistedTokens" PRIMARY KEY ("tokenId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_BlacklistedTokens_tokenHash" ON "BlacklistedTokens" ("tokenHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "Traceabilities" ADD CONSTRAINT "FK_Traceabilities_userId" FOREIGN KEY ("userId") REFERENCES "Users"("userId") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Predictions" ADD CONSTRAINT "FK_Predictions_resultId" FOREIGN KEY ("resultId") REFERENCES "Results"("resultId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT "FK_PasswordResetTokens_userId" FOREIGN KEY ("userId") REFERENCES "Users"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" ADD CONSTRAINT "FK_Results_patientId" FOREIGN KEY ("patientId") REFERENCES "Patients"("patientId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" ADD CONSTRAINT "FK_Results_userId" FOREIGN KEY ("userId") REFERENCES "Users"("userId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" ADD CONSTRAINT "FK_Results_verifiedBy" FOREIGN KEY ("verifiedBy") REFERENCES "Users"("userId") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "CorrectedResults" ADD CONSTRAINT "FK_CorrectedResults_predictionId" FOREIGN KEY ("predictionId") REFERENCES "Predictions"("predictionId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "CorrectedResults" ADD CONSTRAINT "FK_CorrectedResults_correctedBy" FOREIGN KEY ("correctedBy") REFERENCES "Users"("userId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BlacklistedTokens" ADD CONSTRAINT "FK_BlacklistedTokens_userId" FOREIGN KEY ("userId") REFERENCES "Users"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "BlacklistedTokens" DROP CONSTRAINT "FK_BlacklistedTokens_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "CorrectedResults" DROP CONSTRAINT "FK_CorrectedResults_correctedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "CorrectedResults" DROP CONSTRAINT "FK_CorrectedResults_predictionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" DROP CONSTRAINT "FK_Results_verifiedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" DROP CONSTRAINT "FK_Results_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Results" DROP CONSTRAINT "FK_Results_patientId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PasswordResetTokens" DROP CONSTRAINT "FK_PasswordResetTokens_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Predictions" DROP CONSTRAINT "FK_Predictions_resultId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Traceabilities" DROP CONSTRAINT "FK_Traceabilities_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_BlacklistedTokens_tokenHash" ON "BlacklistedTokens"`,
    );
    await queryRunner.query(`DROP TABLE "BlacklistedTokens"`);
    await queryRunner.query(
      `DROP INDEX "IDX_CorrectedResults_predictionId" ON "CorrectedResults"`,
    );
    await queryRunner.query(`DROP TABLE "CorrectedResults"`);
    await queryRunner.query(
      `DROP INDEX "IDX_Results_status_dateAndHour" ON "Results"`,
    );
    await queryRunner.query(`DROP TABLE "Results"`);
    await queryRunner.query(
      `DROP INDEX "IDX_PasswordResetTokens_userId" ON "PasswordResetTokens"`,
    );
    await queryRunner.query(`DROP TABLE "PasswordResetTokens"`);
    await queryRunner.query(`DROP INDEX "UQ_Patients_document" ON "Patients"`);
    await queryRunner.query(`DROP TABLE "Patients"`);
    await queryRunner.query(
      `DROP INDEX "IDX_Predictions_resultId" ON "Predictions"`,
    );
    await queryRunner.query(`DROP TABLE "Predictions"`);
    await queryRunner.query(
      `DROP INDEX "IDX_Traceabilities_dateAndHour" ON "Traceabilities"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_Traceabilities_entity" ON "Traceabilities"`,
    );
    await queryRunner.query(`DROP TABLE "Traceabilities"`);
    await queryRunner.query(`DROP TABLE "Users"`);
  }
}
