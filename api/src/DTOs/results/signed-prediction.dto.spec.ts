import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateBatchResultsWithCorrectionsDto } from './create-batch-results-with-corrections.dto';
import { AddPredictionsToResultDto } from './add-predictions-to-result.dto';

const SIGNED_ITEM = {
  prediction: 'NUCLEAR_HOMOGENEOUS',
  confidencePercentage: 93.12,
  classificationLevel: 'competent',
  signature: 'ayI_iQ5DPmuPtFrgoFdmRSFzllKvrWaPmDjs09fgHPc',
  dilution: '80',
};

const bodies = [
  [
    'POST /results/batch/with-files',
    CreateBatchResultsWithCorrectionsDto,
    (item: object) => ({ patientId: 1, predictions: [item] }),
  ],
  [
    'POST /results/:id/predictions/with-files',
    AddPredictionsToResultDto,
    (item: object) => ({ newPredictions: [item] }),
  ],
] as const;

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

async function validationMessages(
  cls: new () => object,
  body: object,
): Promise<string[]> {
  return messages(
    await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}

describe.each(bodies)('signed prediction items (%s)', (_name, cls, wrap) => {
  it('accepts a signed prediction with its classification level', async () => {
    expect(await validationMessages(cls, wrap(SIGNED_ITEM))).toEqual([]);
  });

  it('requires a signature', async () => {
    const unsigned: Partial<typeof SIGNED_ITEM> = { ...SIGNED_ITEM };
    delete unsigned.signature;
    expect(await validationMessages(cls, wrap(unsigned))).toContain(
      'Signature is required.',
    );
  });

  it('requires the classification level returned by the analysis', async () => {
    const withoutLevel: Partial<typeof SIGNED_ITEM> = { ...SIGNED_ITEM };
    delete withoutLevel.classificationLevel;
    expect(await validationMessages(cls, wrap(withoutLevel))).toContain(
      'Classification level is required.',
    );
    expect(
      await validationMessages(
        cls,
        wrap({ ...SIGNED_ITEM, classificationLevel: 'master' }),
      ),
    ).toContain(
      'Classification level must be one of: general, competent, expert.',
    );
  });
});
