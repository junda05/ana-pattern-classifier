/**
 * Shared harness of the e2e tests
 *
 * startE2eApp() boots the real AppModule against the test SQL Server (see setup-env.ts):
 * - applies the TypeORM migrations (DataSource.runMigrations)
 * - deletes every row, so each suite starts from an empty database
 * - replaces PredictorClient with a fake that returns a canned predictor response
 * - applies the same HTTP pipeline as main.ts (configureApp)
 *
 * Suites run one at a time (maxWorkers 1 in jest-e2e.json) because they share the database.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { rm } from 'fs/promises';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { deflateSync } from 'zlib';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { UserRole } from '../src/entities/users/user.types';
import {
  PredictorClient,
  PredictorResponse,
  PredictorUpload,
} from '../src/modules/predictions/predictor.client';
import { UsersService } from '../src/modules/users/users.service';
import type { CreateUserDto } from '../src/DTOs/users/create-user.dto';

export const API = '/api/v1';

/** Tables in an order that respects the foreign keys (children first). */
const TABLES_IN_DELETE_ORDER = [
  'CorrectedResults',
  'Predictions',
  'Results',
  'Patients',
  'BlacklistedTokens',
  'PasswordResetTokens',
  'Traceabilities',
  'Users',
] as const;

/** A hierarchical predictor response, shaped like the real api-predictor output. */
export const CANNED_PREDICTION = {
  filename: 'sample.png',
  prediction: 'Nuclear Homogeneous',
  prediction_key: 'NUCLEAR_HOMOGENEOUS',
  confidence: 0.9312,
  confidence_percentage: 93.12,
  class_probabilities: {
    NUCLEAR_HOMOGENEOUS: 0.9312,
    NUCLEAR_SPECKLED: 0.0688,
  },
  patch_statistics: { total_patches: 4, patches_used: 4 },
  classification_level: 'competent',
  note: null,
  voting_method: 'hybrid_voting',
  status: 'success',
} as const;

/** Records the uploads it receives and answers with CANNED_PREDICTION. */
export class FakePredictorClient {
  readonly uploads: PredictorUpload[] = [];

  predict(file: PredictorUpload): Promise<PredictorResponse> {
    this.uploads.push(file);
    return Promise.resolve({
      ...CANNED_PREDICTION,
      filename: file.originalname,
    });
  }
}

export interface TestUser {
  userId: number;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface Tokens {
  access: string;
  refresh: string;
}

export interface E2eContext {
  app: INestApplication<App>;
  dataSource: DataSource;
  predictor: FakePredictorClient;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await dataSource.query(`DELETE FROM "${table}"`);
  }
}

export async function startE2eApp(): Promise<E2eContext> {
  const predictor = new FakePredictorClient();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PredictorClient)
    .useValue(predictor)
    .compile();

  // The DATA_SOURCE provider has connected during compile(); lifecycle hooks
  // (which query the database) only run in app.init(), after the schema exists.
  const dataSource = moduleRef.get<DataSource>('DATA_SOURCE');
  await dataSource.runMigrations({ transaction: 'each' });
  await resetDatabase(dataSource);

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return {
    app,
    dataSource,
    predictor,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await rm(process.env.UPLOADS_DIR as string, {
        recursive: true,
        force: true,
      });
    },
  };
}

/** Creates a user directly through UsersService (as the seed script does). */
export async function seedUser(
  context: E2eContext,
  role: UserRole,
  username: string,
  fullName: string,
): Promise<TestUser> {
  const password = `${username}-Passw0rd!`;
  const dto: CreateUserDto = {
    username,
    password,
    fullName,
    email: `${username}@example.com`,
    professionalCard: `CARD-${username.toUpperCase()}`,
    role,
  };
  const created = await context.app.get(UsersService).create(dto, null);
  return { userId: created.userId, username, password, fullName, role };
}

export async function login(
  context: E2eContext,
  user: Pick<TestUser, 'username' | 'password'>,
): Promise<Tokens> {
  const response = await context
    .http()
    .post(`${API}/auth/login`)
    .send({ username: user.username, password: user.password })
    .expect(200);
  return response.body as Tokens;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** A valid 1x1 grey PNG, generated in memory (no image files in the repository). */
export function tinyPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); // width
  header.writeUInt32BE(1, 4); // height
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(0, 9); // colour type: greyscale
  const scanline = Buffer.from([0, 0x80]); // filter byte + one grey pixel
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanline)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
