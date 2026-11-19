/**
 * Result changes after creation (e2e): the single-transaction append with
 * corrections, the 20-image cap per result, the VERIFIED lock, clearable
 * observations, the server-side
 * search, the audit-trail filters and the statistics aggregate.
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { UserRole } from '../src/entities/users/user.types';
import { PREDICTIONS_SUBDIR } from '../src/modules/files/files.types';
import {
  API,
  CANNED_PREDICTION,
  E2eContext,
  Tokens,
  bearer,
  login,
  seedUser,
  startE2eApp,
  tinyPng,
} from './e2e-helpers';

type SignedAnalysis = typeof CANNED_PREDICTION & { signature: string };

interface ResultBody {
  resultId: number;
  status: string;
  observations: string | null;
  verifiedBy: { userId: number } | null;
  verifiedAt: string | null;
  predictions: { predictionId: number; prediction: string; dilution: string }[];
  addedPredictionIds?: number[];
}

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LOCKED = 'Verified results cannot be modified.';

describe('Result changes (e2e)', () => {
  let context: E2eContext;
  let admin: Tokens;
  let standard: Tokens;
  let patientId: number;

  beforeAll(async () => {
    context = await startE2eApp();
    const adminUser = await seedUser(
      context,
      UserRole.ADMIN,
      'admin_changes',
      'Alex Admin',
    );
    const standardUser = await seedUser(
      context,
      UserRole.STANDARD,
      'jane_changes',
      'Jane Doe',
    );
    admin = await login(context, adminUser);
    standard = await login(context, standardUser);

    const patient = await context
      .http()
      .post(`${API}/patients`)
      .set('Authorization', bearer(standard.access))
      .send({
        fullName: 'John Roe_%',
        documentType: 'NATIONAL_ID',
        documentNumber: '9001002003',
        gender: 'M',
        birthDate: '1975-06-30',
        phonePrefix: '+1',
        phoneNumber: '5550101',
      })
      .expect(201);
    patientId = (patient.body as { patientId: number }).patientId;
  });

  afterAll(async () => {
    await context.close();
  });

  async function analyze(): Promise<SignedAnalysis> {
    const response = await context
      .http()
      .post(`${API}/predictions/analyze`)
      .set('Authorization', bearer(standard.access))
      .attach('file', tinyPng(), 'sample.png')
      .expect(200);
    return response.body as SignedAnalysis;
  }

  async function signedItem(dilution = '80') {
    const analysis = await analyze();
    return {
      prediction: analysis.prediction_key,
      confidencePercentage: analysis.confidence_percentage,
      classificationLevel: analysis.classification_level,
      signature: analysis.signature,
      dilution,
    };
  }

  async function createResult(
    token = standard.access,
    extra: object = {},
  ): Promise<ResultBody> {
    const created = await context
      .http()
      .post(`${API}/results/batch/with-files`)
      .set('Authorization', bearer(token))
      .field(
        'data',
        JSON.stringify({
          patientId,
          predictions: [await signedItem()],
          observations: 'First pass',
          ...extra,
        }),
      )
      .attach('images', tinyPng(), 'sample.png')
      .expect(201);
    return detail((created.body as { resultId: number }).resultId);
  }

  async function detail(resultId: number): Promise<ResultBody> {
    const response = await context
      .http()
      .get(`${API}/results/${resultId}`)
      .set('Authorization', bearer(admin.access))
      .expect(200);
    return response.body as ResultBody;
  }

  function append(resultId: number, token: string, data: object, images = 0) {
    const call = context
      .http()
      .post(`${API}/results/${resultId}/predictions/with-files`)
      .set('Authorization', bearer(token))
      .field('data', JSON.stringify(data));
    for (let index = 0; index < images; index += 1) {
      void call.attach('images', tinyPng(), `extra-${index}.png`);
    }
    return call;
  }

  async function corrections(resultId: number): Promise<unknown[]> {
    const response = await context
      .http()
      .get(`${API}/results/${resultId}/corrections`)
      .set('Authorization', bearer(admin.access))
      .expect(200);
    return response.body as unknown[];
  }

  async function verify(resultId: number): Promise<void> {
    await context
      .http()
      .patch(`${API}/results/${resultId}`)
      .set('Authorization', bearer(admin.access))
      .send({ status: 'VERIFIED' })
      .expect(200);
  }

  describe('append with corrections (one transaction)', () => {
    it('adds an image, corrects it by index and corrects an existing prediction', async () => {
      const result = await createResult();
      const [existing] = result.predictions;

      const response = await append(
        result.resultId,
        standard.access,
        {
          newPredictions: [await signedItem('320')],
          corrections: [
            {
              imageIndex: 0,
              correctedPrediction: 'NUCLEOLAR',
              observations: 'Nucleolar on review.',
            },
          ],
          existingCorrections: [
            {
              predictionId: existing.predictionId,
              correctedPrediction: 'NUCLEAR_SPECKLED',
            },
          ],
          // Ignored: a stored correction always makes the result CORRECTED
          status: 'VERIFIED',
        },
        1,
      ).expect(201);

      const body = response.body as ResultBody;
      expect(body.status).toBe('CORRECTED');
      expect(body.verifiedBy).toBeNull();
      expect(body.predictions).toHaveLength(2);
      expect(body.addedPredictionIds).toHaveLength(1);
      expect(body.addedPredictionIds![0]).toBe(
        body.predictions[1].predictionId,
      );
      expect(await corrections(result.resultId)).toHaveLength(2);
    });

    it('ignores a correction equal to the current class', async () => {
      const result = await createResult();
      const [existing] = result.predictions;

      await append(result.resultId, standard.access, {
        existingCorrections: [
          {
            predictionId: existing.predictionId,
            correctedPrediction: existing.prediction,
          },
        ],
      }).expect(201);

      expect(await corrections(result.resultId)).toHaveLength(0);
      expect((await detail(result.resultId)).status).toBe('PENDING');
    });

    it('rejects a request without any change', async () => {
      const result = await createResult();

      const response = await append(result.resultId, standard.access, {
        newPredictions: [],
      }).expect(400);

      expect((response.body as { message: string }).message).toBe(
        'Provide at least one change: newPredictions, updatedDilutions, corrections, existingCorrections, observations or status.',
      );
    });

    it('validates the whole request before writing any part of it', async () => {
      const result = await createResult();

      await append(result.resultId, standard.access, {
        existingCorrections: [
          { predictionId: 999999, correctedPrediction: 'NUCLEOLAR' },
        ],
        observations: 'Should not be saved',
      }).expect(400);

      expect((await detail(result.resultId)).observations).toBe('First pass');
    });

    it('caps a result at 20 images, saved ones included, before storing any file', async () => {
      const result = await createResult();
      // tinyPng() is always the same image, so one signed answer fits every copy
      const item = await signedItem();
      const withImages = (count: number) => ({
        newPredictions: Array.from({ length: count }, () => item),
      });
      const storedFiles = async () =>
        (
          await readdir(
            join(process.env.UPLOADS_DIR as string, PREDICTIONS_SUBDIR),
          )
        ).length;

      await append(result.resultId, standard.access, withImages(18), 18).expect(
        201,
      );
      const filesBefore = await storedFiles();

      const refused = await append(
        result.resultId,
        standard.access,
        withImages(2),
        2,
      ).expect(400);
      expect((refused.body as { message: string }).message).toBe(
        'A result can hold at most 20 images.',
      );
      expect(await storedFiles()).toBe(filesBefore);
      expect((await detail(result.resultId)).predictions).toHaveLength(19);

      await append(result.resultId, standard.access, withImages(1), 1).expect(
        201,
      );
      expect((await detail(result.resultId)).predictions).toHaveLength(20);
    });
  });

  describe('VERIFIED lock', () => {
    let resultId: number;
    let predictionId: number;

    beforeEach(async () => {
      const result = await createResult();
      resultId = result.resultId;
      predictionId = result.predictions[0].predictionId;
      await verify(resultId);
    });

    it.each([
      [
        'a new image',
        async () => ({ newPredictions: [await signedItem()] }),
        1,
      ],
      [
        'a dilution change',
        () =>
          Promise.resolve({
            updatedDilutions: [{ predictionId: -1, dilution: '640' }],
          }),
        0,
      ],
      [
        'an observation change',
        () => Promise.resolve({ observations: 'Changed' }),
        0,
      ],
    ])('answers 409 to %s for every role', async (_label, body, images) => {
      for (const token of [admin.access, standard.access]) {
        const data = (await body()) as {
          updatedDilutions?: { predictionId: number }[];
        };
        data.updatedDilutions?.forEach((update) => {
          update.predictionId = predictionId;
        });
        const response = await append(resultId, token, data, images).expect(
          409,
        );
        expect((response.body as { message: string }).message).toBe(LOCKED);
      }
      expect((await detail(resultId)).predictions).toHaveLength(1);
    });

    it('answers 409 to PATCH observations but accepts unchanged values', async () => {
      const patch = (token: string, body: object) =>
        context
          .http()
          .patch(`${API}/results/${resultId}`)
          .set('Authorization', bearer(token))
          .send(body);

      const changed = await patch(admin.access, {
        observations: null,
      }).expect(409);
      expect((changed.body as { message: string }).message).toBe(LOCKED);
      await patch(admin.access, {
        observations: 'First pass',
        status: 'VERIFIED',
      }).expect(200);
    });

    it('forbids STANDARD corrections (403) and lets an ADMIN correct, clearing the verification', async () => {
      const correction = {
        existingCorrections: [
          { predictionId, correctedPrediction: 'CYTOPLASMIC_SPECKLED' },
        ],
      };

      await append(resultId, standard.access, correction).expect(403);
      await context
        .http()
        .post(`${API}/results/corrections/batch`)
        .set('Authorization', bearer(standard.access))
        .send({ corrections: correction.existingCorrections })
        .expect(403);

      const response = await append(resultId, admin.access, {
        ...correction,
        observations: 'First pass',
      }).expect(201);
      expect(response.body).toMatchObject({
        status: 'CORRECTED',
        verifiedBy: null,
        verifiedAt: null,
      });
    });

    it('clears the verification when an ADMIN uses POST /results/corrections', async () => {
      await context
        .http()
        .post(`${API}/results/corrections`)
        .set('Authorization', bearer(admin.access))
        .send({
          predictionId,
          correctedPrediction: 'NUCLEOLAR',
          observations: '',
        })
        .expect(201);

      expect(await detail(resultId)).toMatchObject({
        status: 'CORRECTED',
        verifiedBy: null,
        verifiedAt: null,
      });
    });
  });

  it('clears the observations with an empty string or null', async () => {
    const result = await createResult(standard.access, { observations: '' });
    expect(result.observations).toBeNull();

    await context
      .http()
      .patch(`${API}/results/${result.resultId}`)
      .set('Authorization', bearer(standard.access))
      .send({ observations: 'Temporary note' })
      .expect(200);
    const cleared = await context
      .http()
      .patch(`${API}/results/${result.resultId}`)
      .set('Authorization', bearer(standard.access))
      .send({ observations: null })
      .expect(200);
    expect((cleared.body as ResultBody).observations).toBeNull();
  });

  describe('GET /results?search=', () => {
    async function search(query: string, token = admin.access) {
      const response = await context
        .http()
        .get(`${API}/results?${query}`)
        .set('Authorization', bearer(token))
        .expect(200);
      return response.body as Page<{ resultId: number; status: string }>;
    }

    it('finds by name or document number, case-insensitive, with literal wildcards', async () => {
      const all = await search('limit=100');
      expect(all.total).toBeGreaterThan(0);

      expect((await search('search=john%20ROE&limit=100')).total).toBe(
        all.total,
      );
      expect((await search('search=10020&limit=100')).total).toBe(all.total);
      // % and _ are literal characters of the name, not wildcards
      expect((await search('search=roe_%25&limit=100')).total).toBe(all.total);
      // Unescaped, _ would match the space of "john roe"
      expect((await search('search=n_r&limit=100')).total).toBe(0);
      expect((await search('search=nobody')).total).toBe(0);
    });

    it('combines the search with status, pagination and STANDARD visibility', async () => {
      const pending = await search('search=roe&status=PENDING&limit=1&page=1');
      expect(pending.limit).toBe(1);
      expect(pending.data.every((row) => row.status === 'PENDING')).toBe(true);

      // A result created by the ADMIN and verified is not visible to STANDARD
      const adminResult = await createResult(admin.access);
      await verify(adminResult.resultId);
      const visible = await search(
        'search=roe&status=VERIFIED&limit=100',
        standard.access,
      );
      expect(visible.data.map((row) => row.resultId)).not.toContain(
        adminResult.resultId,
      );
    });

    it('rejects a search longer than 100 characters', async () => {
      await context
        .http()
        .get(`${API}/results?search=${'x'.repeat(101)}`)
        .set('Authorization', bearer(admin.access))
        .expect(400);
    });
  });

  describe('GET /traceability filters', () => {
    async function audit(query: string) {
      const response = await context
        .http()
        .get(`${API}/traceability?${query}`)
        .set('Authorization', bearer(admin.access))
        .expect(200);
      return response.body as Page<{
        activityType: string;
        userFullName: string;
        dateAndHour: string;
      }>;
    }

    it('filters by activity type, actor name and [from, to)', async () => {
      const updates = await audit('activityType=UPDATE&limit=100');
      expect(updates.total).toBeGreaterThan(0);
      expect(updates.data.every((row) => row.activityType === 'UPDATE')).toBe(
        true,
      );

      const byJane = await audit('userName=jane%20D&limit=100');
      expect(byJane.total).toBeGreaterThan(0);
      expect(byJane.data.every((row) => row.userFullName === 'Jane Doe')).toBe(
        true,
      );

      const all = await audit('limit=100');
      const newest = all.data[0].dateAndHour;
      const onlyNewest = await audit(
        `from=${encodeURIComponent(newest)}&to=${encodeURIComponent(
          new Date(new Date(newest).getTime() + 1).toISOString(),
        )}&limit=100`,
      );
      expect(onlyNewest.total).toBeGreaterThan(0);
      expect(onlyNewest.data.every((row) => row.dateAndHour === newest)).toBe(
        true,
      );
      // `to` is exclusive
      expect(
        (
          await audit(
            `to=${encodeURIComponent(all.data[all.data.length - 1].dateAndHour)}`,
          )
        ).data,
      ).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            dateAndHour: all.data[all.data.length - 1].dateAndHour,
          }),
        ]),
      );
      expect((await audit('from=2999-01-01T00:00:00.000Z')).total).toBe(0);
    });

    it.each([
      'from=2026-09-24',
      'to=yesterday',
      'activityType=LOGIN',
      'limit=101',
      'from=2026-09-25T00:00:00Z&to=2026-09-24T00:00:00Z',
    ])('rejects %s with 400', async (query) => {
      await context
        .http()
        .get(`${API}/traceability?${query}`)
        .set('Authorization', bearer(admin.access))
        .expect(400);
    });
  });

  describe('GET /results/statistics', () => {
    it('counts validated and corrected predictions of a fixture exactly', async () => {
      const before = (
        await context
          .http()
          .get(`${API}/results/statistics`)
          .set('Authorization', bearer(admin.access))
          .expect(200)
      ).body as { totalValidated: number; totalCorrected: number };

      // Fixture: one VERIFIED result with 2 predictions (no corrections) and
      // one CORRECTED result with 2 predictions, one of them corrected twice
      const verified = await createResult(standard.access);
      await append(
        verified.resultId,
        standard.access,
        { newPredictions: [await signedItem()] },
        1,
      ).expect(201);
      await verify(verified.resultId);

      const corrected = await createResult(standard.access);
      const extra = await append(
        corrected.resultId,
        standard.access,
        {
          newPredictions: [await signedItem()],
          corrections: [{ imageIndex: 0, correctedPrediction: 'NUCLEOLAR' }],
        },
        1,
      ).expect(201);
      await context
        .http()
        .post(`${API}/results/corrections`)
        .set('Authorization', bearer(standard.access))
        .send({
          predictionId: (extra.body as ResultBody).addedPredictionIds![0],
          correctedPrediction: 'NUCLEAR_SPECKLED',
        })
        .expect(201);

      const after = (
        await context
          .http()
          .get(`${API}/results/statistics`)
          .set('Authorization', bearer(admin.access))
          .expect(200)
      ).body as { totalValidated: number; totalCorrected: number };
      expect(after.totalValidated - before.totalValidated).toBe(4);
      expect(after.totalCorrected - before.totalCorrected).toBe(1);

      const future = (
        await context
          .http()
          .get(`${API}/results/statistics?dateFrom=2999-01-01`)
          .set('Authorization', bearer(admin.access))
          .expect(200)
      ).body as { totalValidated: number };
      expect(future.totalValidated).toBe(0);

      const today = new Date().toISOString().slice(0, 10);
      const sameDay = (
        await context
          .http()
          .get(`${API}/results/statistics?dateFrom=${today}&dateTo=${today}`)
          .set('Authorization', bearer(admin.access))
          .expect(200)
      ).body as { totalValidated: number };
      expect(sameDay.totalValidated).toBe(after.totalValidated);
    });
  });
});
