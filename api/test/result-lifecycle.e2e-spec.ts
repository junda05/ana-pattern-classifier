import { createHash } from 'crypto';
import { UserRole } from '../src/entities/users/user.types';
import {
  API,
  CANNED_PREDICTION,
  E2eContext,
  TestUser,
  Tokens,
  bearer,
  login,
  seedUser,
  startE2eApp,
  tinyPng,
} from './e2e-helpers';

interface PredictionBody {
  predictionId: number;
  prediction: string;
  imagePath: string;
}

interface ResultBody {
  resultId: number;
  status: string;
  predictions: PredictionBody[];
}

interface ReportBody {
  resultId: number;
  status: string;
  medic: { userId: number; fullName: string };
  verifiedBy: { userId: number; fullName: string } | null;
  predictions: {
    predictionId: number;
    prediction: string;
    finalPattern: string;
    correction?: { correctedPrediction: string };
  }[];
}

interface AuditEntry {
  activityType: string;
  activityTypeLabel: string;
  entityType: string;
  userFullName: string;
}

/** Body of POST /predictions/analyze: the predictor output, signed by the API. */
type SignedAnalysis = typeof CANNED_PREDICTION & {
  imageSha256: string;
  signature: string;
};

/** The prediction item a client sends back for an analyzed image. */
function signedItem(analysis: SignedAnalysis, dilution: string) {
  return {
    prediction: analysis.prediction_key,
    confidencePercentage: analysis.confidence_percentage,
    classificationLevel: analysis.classification_level,
    signature: analysis.signature,
    dilution,
  };
}

describe('Result lifecycle (e2e)', () => {
  let context: E2eContext;
  let adminUser: TestUser;
  let admin: Tokens;
  let standard: Tokens;
  let patientId: number;

  beforeAll(async () => {
    context = await startE2eApp();
    adminUser = await seedUser(
      context,
      UserRole.ADMIN,
      'admin_e2e',
      'Admin Example',
    );
    const standardUser = await seedUser(
      context,
      UserRole.STANDARD,
      'jane_doe',
      'Jane Doe',
    );
    admin = await login(context, adminUser);
    standard = await login(context, standardUser);

    const patient = await context
      .http()
      .post(`${API}/patients`)
      .set('Authorization', bearer(standard.access))
      .send({
        fullName: 'John Doe',
        documentType: 'NATIONAL_ID',
        documentNumber: '2000000001',
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

  async function analyze(image: Buffer): Promise<SignedAnalysis> {
    const response = await context
      .http()
      .post(`${API}/predictions/analyze`)
      .set('Authorization', bearer(standard.access))
      .attach('file', image, 'sample.png')
      .expect(200);
    return response.body as SignedAnalysis;
  }

  it('analyzes, saves, corrects, verifies and reports a result', async () => {
    const image = tinyPng();

    // 1. Analyze: the API forwards the image to the (fake) predictor
    const analysis = await context
      .http()
      .post(`${API}/predictions/analyze`)
      .set('Authorization', bearer(standard.access))
      .attach('file', image, 'sample.png')
      .expect(200);
    const predicted = analysis.body as SignedAnalysis;
    expect(predicted.prediction_key).toBe('NUCLEAR_HOMOGENEOUS');
    expect(predicted.imageSha256).toBe(
      createHash('sha256').update(image).digest('hex'),
    );
    expect(predicted.signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(context.predictor.uploads).toHaveLength(1);
    expect(context.predictor.uploads[0].mimetype).toBe('image/png');
    expect(context.predictor.uploads[0].buffer.equals(image)).toBe(true);

    // 2. Save the result with its image
    const created = await context
      .http()
      .post(`${API}/results/batch/with-files`)
      .set('Authorization', bearer(standard.access))
      .field(
        'data',
        JSON.stringify({
          patientId,
          predictions: [signedItem(predicted, '160')],
          observations: 'Synthetic e2e sample.',
        }),
      )
      .attach('images', image, 'sample.png')
      .expect(201);
    const resultId = (created.body as { resultId: number }).resultId;
    expect(created.body).toMatchObject({ status: 'PENDING' });

    const detail = await context
      .http()
      .get(`${API}/results/${resultId}`)
      .set('Authorization', bearer(standard.access))
      .expect(200);
    const saved = detail.body as ResultBody;
    expect(saved.predictions).toHaveLength(1);
    const [prediction] = saved.predictions;
    expect(prediction.prediction).toBe('NUCLEAR_HOMOGENEOUS');

    // The stored image is served back to authenticated users
    const served = await context
      .http()
      .get(
        `${API}/files/predictions/${encodeURIComponent(prediction.imagePath)}`,
      )
      .set('Authorization', bearer(standard.access))
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');

    // 3. Correct the prediction: the result becomes CORRECTED
    await context
      .http()
      .post(`${API}/results/corrections`)
      .set('Authorization', bearer(standard.access))
      .send({
        predictionId: prediction.predictionId,
        correctedPrediction: 'NUCLEAR_SPECKLED',
        observations: 'Speckled on review.',
      })
      .expect(201);
    const corrected = await context
      .http()
      .get(`${API}/results/${resultId}`)
      .set('Authorization', bearer(standard.access))
      .expect(200);
    expect((corrected.body as ResultBody).status).toBe('CORRECTED');

    // 4. Verify
    const verified = await context
      .http()
      .patch(`${API}/results/${resultId}`)
      .set('Authorization', bearer(admin.access))
      .send({ status: 'VERIFIED' })
      .expect(200);
    expect((verified.body as ResultBody).status).toBe('VERIFIED');

    // A VERIFIED result never returns to PENDING
    const reopened = await context
      .http()
      .patch(`${API}/results/${resultId}`)
      .set('Authorization', bearer(admin.access))
      .send({ status: 'PENDING' })
      .expect(409);
    expect((reopened.body as { message: string }).message).toBe(
      'Invalid status transition from VERIFIED to PENDING.',
    );

    // A STANDARD user can no longer correct a VERIFIED result
    await context
      .http()
      .post(`${API}/results/corrections`)
      .set('Authorization', bearer(standard.access))
      .send({
        predictionId: prediction.predictionId,
        correctedPrediction: 'NUCLEAR_CENTROMERE',
      })
      .expect(403);

    // 5. Report: the latest correction is the final pattern; the verifier signs it
    const report = await context
      .http()
      .get(`${API}/reports/${resultId}`)
      .set('Authorization', bearer(standard.access))
      .expect(200);
    const body = report.body as ReportBody;
    expect(body.status).toBe('VERIFIED');
    expect(body.predictions).toHaveLength(1);
    expect(body.predictions[0]).toMatchObject({
      prediction: 'NUCLEAR_HOMOGENEOUS',
      finalPattern: 'NUCLEAR_SPECKLED',
      correction: { correctedPrediction: 'NUCLEAR_SPECKLED' },
    });
    expect(body.medic).toMatchObject({
      userId: adminUser.userId,
      fullName: adminUser.fullName,
    });
    expect(body.verifiedBy).toMatchObject({ userId: adminUser.userId });

    // 6. Audit trail: creation and updates, with English labels
    const audit = await context
      .http()
      .get(`${API}/traceability?limit=100`)
      .set('Authorization', bearer(admin.access))
      .expect(200);
    const entries = (audit.body as { data: AuditEntry[] }).data;
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityType: 'CREATE',
          activityTypeLabel: 'Create',
          entityType: 'RESULT',
          userFullName: 'Jane Doe',
        }),
        expect.objectContaining({
          activityType: 'CREATE',
          activityTypeLabel: 'Create',
          entityType: 'PATIENT',
        }),
        expect.objectContaining({
          activityType: 'UPDATE',
          activityTypeLabel: 'Update',
          userFullName: 'Admin Example',
        }),
      ]),
    );
  });

  it('rejects a batch whose data carries a userId', async () => {
    await context
      .http()
      .post(`${API}/results/batch/with-files`)
      .set('Authorization', bearer(standard.access))
      .field(
        'data',
        JSON.stringify({
          patientId,
          userId: 1,
          predictions: [signedItem(await analyze(tinyPng()), '80')],
        }),
      )
      .attach('images', tinyPng(), 'sample.png')
      .expect(400);
  });

  it('refuses predictions whose signature does not match the image and values', async () => {
    const image = tinyPng();
    const predicted = await analyze(image);
    const save = (item: object) =>
      context
        .http()
        .post(`${API}/results/batch/with-files`)
        .set('Authorization', bearer(standard.access))
        .field('data', JSON.stringify({ patientId, predictions: [item] }))
        .attach('images', image, 'sample.png')
        .expect(400);
    const invalid = { message: 'Prediction signature is invalid for image 1.' };

    const tamperedSignature = `${predicted.signature.slice(0, -1)}${
      predicted.signature.endsWith('A') ? 'B' : 'A'
    }`;
    expect(
      (
        await save({
          ...signedItem(predicted, '80'),
          signature: tamperedSignature,
        })
      ).body,
    ).toMatchObject(invalid);
    expect(
      (
        await save({
          ...signedItem(predicted, '80'),
          prediction: 'NUCLEAR_SPECKLED',
        })
      ).body,
    ).toMatchObject(invalid);
    expect(
      (
        await save({
          ...signedItem(predicted, '80'),
          confidencePercentage: 99,
        })
      ).body,
    ).toMatchObject(invalid);

    // Nothing was saved
    const list = await context
      .http()
      .get(`${API}/results?limit=100`)
      .set('Authorization', bearer(standard.access))
      .expect(200);
    const results = (list.body as { data: { resultId: number }[] }).data;
    expect(results).toHaveLength(1);
  });

  it('rejects an analysis without a file', async () => {
    await context
      .http()
      .post(`${API}/predictions/analyze`)
      .set('Authorization', bearer(standard.access))
      .expect(400);
  });
});
