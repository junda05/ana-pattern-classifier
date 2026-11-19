import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { UpdateResultDto } from './update-result.dto';
import { CreateBatchResultsWithCorrectionsDto } from './create-batch-results-with-corrections.dto';
import { AddPredictionsToResultDto } from './add-predictions-to-result.dto';
import { CreateBatchCorrectionsExistingDto } from './create-batch-corrections-existing.dto';
import { CreateCorrectionDto } from './create-correction.dto';

const TOO_LONG = 'Observations must be at most 1000 characters long.';

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

async function check<T extends object>(
  cls: new () => T,
  body: object,
): Promise<{ dto: T; errors: string[] }> {
  const dto = plainToInstance(cls, body);
  const errors = messages(
    await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
  );
  return { dto, errors };
}

const signedItem = {
  prediction: 'NUCLEAR_HOMOGENEOUS',
  confidencePercentage: 93.12,
  classificationLevel: 'competent',
  signature: 'signature-from-analyze',
  dilution: '80',
};

/** Every body that carries the result observations, as the endpoint receives it. */
const resultBodies: Array<[string, new () => object, object]> = [
  ['PATCH /results/:id', UpdateResultDto, {}],
  [
    'POST /results/batch/with-files',
    CreateBatchResultsWithCorrectionsDto,
    { patientId: 1, predictions: [signedItem] },
  ],
  [
    'POST /results/:id/predictions/with-files',
    AddPredictionsToResultDto,
    { newPredictions: [signedItem] },
  ],
];

describe.each(resultBodies)('%s observations', (_name, cls, base) => {
  it.each([
    ['an empty string', ''],
    ['null', null],
  ])('accepts %s and turns it into null (cleared)', async (_label, value) => {
    const { dto, errors } = await check(cls, { ...base, observations: value });

    expect(errors).toEqual([]);
    expect(dto).toHaveProperty('observations', null);
  });

  it('accepts 1000 characters and rejects 1001', async () => {
    const ok = await check(cls, { ...base, observations: 'x'.repeat(1000) });
    const tooLong = await check(cls, {
      ...base,
      observations: 'x'.repeat(1001),
    });

    expect(ok.errors).toEqual([]);
    expect(tooLong.errors).toEqual([TOO_LONG]);
  });

  it('leaves missing observations undefined (not sent)', async () => {
    const { dto, errors } = await check(cls, base);

    expect(errors).toEqual([]);
    expect((dto as { observations?: unknown }).observations).toBeUndefined();
  });
});

describe('correction observations', () => {
  it.each([
    [
      'POST /results/corrections',
      CreateCorrectionDto,
      (o: unknown) => ({
        predictionId: 1,
        correctedPrediction: 'NUCLEAR_SPECKLED',
        observations: o,
      }),
    ],
    [
      'POST /results/corrections/batch',
      CreateBatchCorrectionsExistingDto,
      (o: unknown) => ({
        corrections: [
          {
            predictionId: 1,
            correctedPrediction: 'NUCLEAR_SPECKLED',
            observations: o,
          },
        ],
      }),
    ],
  ] as Array<[string, new () => object, (o: unknown) => object]>)(
    '%s accepts empty notes and rejects more than 1000 characters',
    async (_name, cls, body) => {
      expect((await check(cls, body(''))).errors).toEqual([]);
      expect((await check(cls, body(null))).errors).toEqual([]);
      expect((await check(cls, body('x'.repeat(1001)))).errors).toEqual([
        TOO_LONG,
      ]);
    },
  );
});

describe('CreateBatchCorrectionsExistingDto size', () => {
  const correction = (predictionId: number) => ({
    predictionId,
    correctedPrediction: 'NUCLEAR_SPECKLED',
  });

  it('accepts 100 corrections and rejects 101', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => correction(i + 1));

    expect(
      (await check(CreateBatchCorrectionsExistingDto, { corrections: hundred }))
        .errors,
    ).toEqual([]);
    expect(
      (
        await check(CreateBatchCorrectionsExistingDto, {
          corrections: [...hundred, correction(101)],
        })
      ).errors,
    ).toEqual(['At most 100 corrections can be sent at once.']);
  });
});
