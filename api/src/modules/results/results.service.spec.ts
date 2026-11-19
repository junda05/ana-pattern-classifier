import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MssqlParameter, Repository } from 'typeorm';
import { ResultsService } from './results.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { FilesService } from '../files/files.service';
import { PredictionSignatureService } from '../predictions/prediction-signature.service';
import { Patient } from '../../entities/patients/patient.entity';
import { Result } from '../../entities/results/result.entity';
import { Prediction } from '../../entities/predictions/prediction.entity';
import { CorrectedResult } from '../../entities/corrections/corrected-result.entity';
import {
  PredictionClass,
  ResultStatus,
} from '../../entities/results/result.types';
import {
  ClassificationLevel,
  Dilution,
} from '../../entities/predictions/prediction.types';
import { UserRole } from '../../entities/users/user.types';
import { EntityType } from '../../entities/traceabilities/traceability.types';
import { CreateBatchResultsWithCorrectionsDto } from '../../DTOs/results/create-batch-results-with-corrections.dto';
import { AddPredictionsToResultDto } from '../../DTOs/results/add-predictions-to-result.dto';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

type Terminal =
  | 'getManyAndCount'
  | 'getOne'
  | 'getMany'
  | 'getCount'
  | 'getRawMany'
  | 'getRawOne';

/** Chainable query builder double that records every non-terminal call. */
function queryBuilder(results: Partial<Record<Terminal, unknown>>) {
  const calls: Array<[string, unknown[]]> = [];
  const qb: object = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property in results) {
          return jest.fn(() => Promise.resolve(results[property as Terminal]));
        }
        if (property === 'then') {
          return undefined;
        }
        return (...args: unknown[]) => {
          calls.push([property, args]);
          return qb;
        };
      },
    },
  );
  const conditions = () =>
    calls
      .filter(([name]) => name === 'where' || name === 'andWhere')
      .map(([, args]) => args);
  return { qb, calls, conditions };
}

/** A saved row as the repository doubles see it. */
type Row = Record<string, unknown>;

/** Resolves to undefined; typed so recorded calls can be inspected. */
const resolvedVoid = () =>
  jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());

function repository(
  idKey?: string,
  extra: (entity: Row) => object = () => ({}),
) {
  let nextId = 100;
  return {
    create: jest.fn((data: object) => ({ ...data })),
    save: jest.fn((entity: Row) => {
      if (idKey && entity[idKey] === undefined) {
        Object.assign(entity, { [idKey]: nextId++ }, extra(entity));
      }
      return Promise.resolve(entity);
    }),
    findOne: jest.fn(),
    find: jest.fn<Promise<unknown[]>, unknown[]>(() => Promise.resolve([])),
    count: jest.fn<Promise<number>, unknown[]>(() => Promise.resolve(0)),
    update: jest.fn<Promise<{ affected: number }>, unknown[]>(() =>
      Promise.resolve({ affected: 1 }),
    ),
    createQueryBuilder: jest.fn(),
  };
}

const image = (name: string) =>
  ({
    originalname: name,
    mimetype: 'image/png',
    size: 1,
    buffer: Buffer.from([0]),
  }) as Express.Multer.File;

const patient = {
  patientId: 1,
  fullName: 'John Roe',
  documentType: 'NATIONAL_ID',
  documentNumber: '900100200',
  gender: 'M',
  birthDate: new Date('1980-01-01'),
  phonePrefix: '+1',
  phoneNumber: '5550100',
  email: 'john.roe@example.com',
};

const standardUser = { userId: 42, fullName: 'Jane Doe', username: 'jdoe' };
const adminUser = { userId: 1, fullName: 'Alex Admin', username: 'admin' };

function setup(signatureService?: PredictionSignatureService) {
  const resultRepository = repository();
  const patientRepository = repository();
  const correctedResultRepository = repository();
  const predictionRepository = repository();

  const tx = {
    results: repository('resultId', () => ({
      dateAndHour: new Date('2026-09-24T10:00:00Z'),
    })),
    predictions: repository('predictionId'),
    corrections: repository('correctedResultId', () => ({
      correctedDate: new Date('2026-09-24T10:05:00Z'),
    })),
  };
  // The locked read inside a transaction sees the same row as the plain read
  // unless a test simulates a concurrent change
  tx.results.findOne.mockImplementation(
    (options: unknown): Promise<unknown> =>
      resultRepository.findOne(options) as Promise<unknown>,
  );
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Result) return tx.results;
      if (entity === Prediction) return tx.predictions;
      if (entity === CorrectedResult) return tx.corrections;
      throw new Error(`Unexpected repository ${String(entity)}`);
    }),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const traceability = {
    logCreate: resolvedVoid(),
    logUpdate: resolvedVoid(),
    logUpdateConsolidated: resolvedVoid(),
  };
  const files = {
    savePredictionImages: jest.fn((list: Express.Multer.File[]) =>
      Promise.resolve(
        list.map((file, index) => `stored-${index}-${file.originalname}`),
      ),
    ),
    deletePredictionImages: resolvedVoid(),
  };
  const signatures = { assertValid: jest.fn() };

  const service = new ResultsService(
    dataSource as unknown as DataSource,
    resultRepository as unknown as Repository<Result>,
    patientRepository as unknown as Repository<Patient>,
    correctedResultRepository as unknown as Repository<CorrectedResult>,
    predictionRepository as unknown as Repository<Prediction>,
    traceability as unknown as TraceabilityService,
    files as unknown as FilesService,
    signatureService ?? (signatures as unknown as PredictionSignatureService),
  );

  return {
    signatures,
    service,
    resultRepository,
    patientRepository,
    correctedResultRepository,
    predictionRepository,
    tx,
    dataSource,
    traceability,
    files,
  };
}

function detailRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    resultId: 5,
    dateAndHour: new Date('2026-09-24T10:00:00Z'),
    observations: 'Routine screening',
    status: ResultStatus.PENDING,
    patientId: 1,
    userId: standardUser.userId,
    patient,
    user: {
      ...standardUser,
      email: 'jdoe@example.com',
      role: UserRole.STANDARD,
    },
    verifiedBy: null,
    verifiedAt: null,
    verifier: null,
    predictions: [
      {
        predictionId: 10,
        prediction: PredictionClass.NUCLEAR_HOMOGENEOUS,
        confidencePercentage: 87.5,
        imagePath: 'stored-0-a.png',
        dilution: Dilution.DILUTION_80,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Batch creation
// ---------------------------------------------------------------------------

describe('ResultsService.createBatchWithFiles', () => {
  const dto = (overrides: Partial<CreateBatchResultsWithCorrectionsDto> = {}) =>
    ({
      patientId: 1,
      predictions: [
        {
          prediction: PredictionClass.NUCLEAR_HOMOGENEOUS,
          confidencePercentage: 87.5,
          dilution: Dilution.DILUTION_80,
        },
        {
          prediction: PredictionClass.NUCLEOLAR_CLUMPY,
          confidencePercentage: 76.1,
          dilution: Dilution.DILUTION_160,
        },
      ],
      observations: 'Routine screening',
      ...overrides,
    }) as CreateBatchResultsWithCorrectionsDto;

  const images = [image('a.png'), image('b.png')];

  it('rejects a different number of images and predictions before storing anything', async () => {
    const t = setup();

    await expect(
      t.service.createBatchWithFiles(dto(), [image('a.png')], 42),
    ).rejects.toThrow(/Each uploaded image needs exactly one prediction/);
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a correction whose imageIndex is out of range', async () => {
    const t = setup();
    const withBadIndex = dto({
      corrections: [
        {
          imageIndex: 2,
          correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
        },
      ],
    });

    await expect(
      t.service.createBatchWithFiles(withBadIndex, images, 42),
    ).rejects.toThrow(BadRequestException);
    await expect(
      t.service.createBatchWithFiles(withBadIndex, images, 42),
    ).rejects.toThrow(
      'Correction 1 refers to image index 2, but only 2 images were uploaded.',
    );
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
  });

  it('rejects two corrections for the same image', async () => {
    const t = setup();
    const duplicated = dto({
      corrections: [
        {
          imageIndex: 0,
          correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
        },
        {
          imageIndex: 0,
          correctedPrediction: PredictionClass.NUCLEAR_CENTROMERE,
        },
      ],
    });

    await expect(
      t.service.createBatchWithFiles(duplicated, images, 42),
    ).rejects.toThrow('Each image can be corrected at most once per request.');
  });

  it('rejects an unknown patient before storing anything', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(null);

    await expect(
      t.service.createBatchWithFiles(dto({ patientId: 99 }), images, 42),
    ).rejects.toThrow(
      new BadRequestException('Patient with ID 99 does not exist.'),
    );
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
  });

  it('writes the result, predictions and corrections in one transaction owned by the JWT user', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);
    const withCorrection = dto({
      status: ResultStatus.PENDING,
      corrections: [
        {
          imageIndex: 1,
          correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
          observations: 'Rechecked',
        },
      ],
    });

    const created = await t.service.createBatchWithFiles(
      withCorrection,
      images,
      42,
    );

    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    // Nothing is written outside the transaction
    expect(t.resultRepository.save).not.toHaveBeenCalled();
    expect(t.predictionRepository.save).not.toHaveBeenCalled();
    expect(t.correctedResultRepository.save).not.toHaveBeenCalled();

    const savedResult = t.tx.results.save.mock.calls[0][0];
    expect(savedResult).toMatchObject({
      userId: 42,
      patientId: 1,
      status: ResultStatus.CORRECTED,
    });

    const savedPredictions = t.tx.predictions.save.mock.calls.map(([p]) => p);
    expect(
      savedPredictions.map((p) => [p.imagePath, p.prediction, p.resultId]),
    ).toEqual([
      [
        'stored-0-a.png',
        PredictionClass.NUCLEAR_HOMOGENEOUS,
        savedResult.resultId,
      ],
      [
        'stored-1-b.png',
        PredictionClass.NUCLEOLAR_CLUMPY,
        savedResult.resultId,
      ],
    ]);

    const savedCorrection = t.tx.corrections.save.mock.calls[0][0];
    expect(savedCorrection).toMatchObject({
      predictionId: savedPredictions[1].predictionId,
      correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
      correctedBy: 42,
    });

    expect(created).toMatchObject({
      resultId: savedResult.resultId,
      status: ResultStatus.CORRECTED,
    });
    expect(t.traceability.logCreate).toHaveBeenCalledWith(
      EntityType.RESULT,
      savedResult.resultId,
      42,
      expect.objectContaining({ predictionsCount: 2, correctionsCount: 1 }),
    );
    expect(t.files.deletePredictionImages).not.toHaveBeenCalled();
  });

  it('defaults to PENDING without corrections and records no verifier', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);

    await t.service.createBatchWithFiles(dto(), images, 42);

    expect(t.tx.results.save.mock.calls[0][0]).toMatchObject({
      status: ResultStatus.PENDING,
      verifiedBy: null,
      verifiedAt: null,
    });
  });

  it('records the creator as verifier when the result is created VERIFIED', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);

    await t.service.createBatchWithFiles(
      dto({ status: ResultStatus.VERIFIED }),
      images,
      42,
    );

    const saved = t.tx.results.save.mock.calls[0][0];
    expect(saved.status).toBe(ResultStatus.VERIFIED);
    expect(saved.verifiedBy).toBe(42);
    expect(saved.verifiedAt).toBeInstanceOf(Date);
  });

  it('rolls back and removes the stored files when a write fails', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);
    t.tx.predictions.save.mockRejectedValueOnce(
      new Error('CHECK constraint violated'),
    );

    const attempt = t.service.createBatchWithFiles(dto(), images, 42);

    await expect(attempt).rejects.toThrow(InternalServerErrorException);
    await expect(attempt).rejects.toThrow('Unexpected error.');
    expect(t.files.deletePredictionImages).toHaveBeenCalledWith([
      'stored-0-a.png',
      'stored-1-b.png',
    ]);
    expect(t.traceability.logCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Appending predictions
// ---------------------------------------------------------------------------

describe('ResultsService.addPredictionsToResult', () => {
  const existing = () => ({
    resultId: 5,
    status: ResultStatus.PENDING,
    userId: standardUser.userId,
    observations: 'First pass',
    patient,
    predictions: [
      {
        predictionId: 10,
        prediction: PredictionClass.NUCLEAR,
        imagePath: 'old-a.png',
        dilution: Dilution.DILUTION_80,
      },
    ],
  });

  const appendDto = (overrides: Partial<AddPredictionsToResultDto> = {}) =>
    ({
      newPredictions: [
        {
          prediction: PredictionClass.NUCLEAR_SPECKLED,
          confidencePercentage: 66,
          dilution: Dilution.DILUTION_320,
        },
      ],
      ...overrides,
    }) as AddPredictionsToResultDto;

  function withDetail(t: ReturnType<typeof setup>) {
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );
  }

  it('rejects a different number of images and new predictions', async () => {
    const t = setup();

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto(),
        [image('a.png'), image('b.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(/Each uploaded image needs exactly one prediction/);
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown result', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(null);

    await expect(
      t.service.addPredictionsToResult(
        9,
        appendDto(),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("forbids a STANDARD user from changing someone else's non-pending result", async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      ...existing(),
      userId: 7,
      status: ResultStatus.VERIFIED,
    });

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto(),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
  });

  it('rejects dilution updates for predictions of another result', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(existing());

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto({
          updatedDilutions: [
            { predictionId: 77, dilution: Dilution.DILUTION_640 },
          ],
        }),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow('Predictions 77 do not belong to result 5.');
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
  });

  it('returns the result detail plus the ids of the created predictions in upload order', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(existing());
    withDetail(t);
    t.tx.predictions.find.mockResolvedValue([]);

    const response = await t.service.addPredictionsToResult(
      5,
      appendDto({
        newPredictions: [
          {
            prediction: PredictionClass.NUCLEAR_SPECKLED,
            confidencePercentage: 66,
            classificationLevel: ClassificationLevel.COMPETENT,
            signature: 'signature-from-analyze',
            dilution: Dilution.DILUTION_320,
          },
          {
            prediction: PredictionClass.NUCLEOLAR,
            confidencePercentage: 71,
            classificationLevel: ClassificationLevel.COMPETENT,
            signature: 'signature-from-analyze',
            dilution: Dilution.DILUTION_160,
          },
        ],
      }),
      [image('c.png'), image('d.png')],
      42,
      UserRole.STANDARD,
    );

    const saved = t.tx.predictions.save.mock.calls.map(([row]) => row);
    expect(saved.map((row) => row.imagePath)).toEqual([
      'stored-0-c.png',
      'stored-1-d.png',
    ]);
    expect(response.addedPredictionIds).toEqual(
      saved.map((row) => row.predictionId),
    );
    expect(response.addedPredictionIds).toEqual([100, 101]);
    // The rest of the response is the unchanged result detail
    expect(response).toMatchObject({
      resultId: 5,
      status: ResultStatus.PENDING,
    });
    expect(response.predictions).toHaveLength(1);
  });

  it('appends predictions, updates dilutions and status in one transaction and records the verifier', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(existing());
    withDetail(t);
    t.tx.predictions.find.mockResolvedValue([]);

    await t.service.addPredictionsToResult(
      5,
      appendDto({
        updatedDilutions: [
          { predictionId: 10, dilution: Dilution.DILUTION_640 },
        ],
        observations: 'Second pass',
        status: ResultStatus.VERIFIED,
      }),
      [image('c.png')],
      42,
      UserRole.STANDARD,
    );

    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(t.tx.predictions.save.mock.calls[0][0]).toMatchObject({
      resultId: 5,
      imagePath: 'stored-0-c.png',
      prediction: PredictionClass.NUCLEAR_SPECKLED,
    });
    expect(t.tx.predictions.update).toHaveBeenCalledWith(10, {
      dilution: Dilution.DILUTION_640,
    });
    expect(t.tx.results.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        observations: 'Second pass',
        status: ResultStatus.VERIFIED,
        verifiedBy: 42,
        verifiedAt: expect.any(Date) as unknown,
      }),
    );
    expect(t.predictionRepository.save).not.toHaveBeenCalled();
    expect(t.traceability.logUpdateConsolidated).toHaveBeenCalledTimes(1);
  });

  it('stores the latest correction (by date) of each prediction in the audit record', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(existing());
    withDetail(t);
    t.tx.predictions.find.mockResolvedValue([
      {
        predictionId: 10,
        prediction: PredictionClass.NUCLEAR,
        confidencePercentage: 90,
        imagePath: 'old-a.png',
        dilution: Dilution.DILUTION_80,
        corrections: [
          {
            correctedResultId: 2,
            correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
            correctedDate: new Date('2026-09-02'),
          },
          {
            correctedResultId: 1,
            correctedPrediction: PredictionClass.NUCLEAR_CENTROMERE,
            correctedDate: new Date('2026-09-03'),
          },
        ],
      },
    ]);

    await t.service.addPredictionsToResult(
      5,
      appendDto(),
      [image('c.png')],
      42,
      UserRole.STANDARD,
    );

    const newValues = t.traceability.logUpdateConsolidated.mock.calls[0][4] as {
      predictions: Array<{ correction: { correctedPrediction: string } }>;
    };
    expect(newValues.predictions[0].correction.correctedPrediction).toBe(
      PredictionClass.NUCLEAR_CENTROMERE,
    );
  });

  it('removes the stored files when the transaction fails', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue(existing());
    t.tx.predictions.save.mockRejectedValueOnce(new Error('insert failed'));

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto(),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(InternalServerErrorException);
    expect(t.files.deletePredictionImages).toHaveBeenCalledWith([
      'stored-0-c.png',
    ]);
    expect(t.traceability.logUpdateConsolidated).not.toHaveBeenCalled();
  });

  // --- Corrections in the same request and the VERIFIED lock ---------------

  const LOCKED = 'Verified results cannot be modified.';
  const STANDARD_VERIFIED_DENIED =
    'You cannot correct predictions of a verified result. Only an administrator can do this.';

  function withResult(overrides: object = {}) {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      ...existing(),
      ...overrides,
    });
    withDetail(t);
    return t;
  }

  it('rejects a payload without any change before touching anything', async () => {
    const t = setup();

    await expect(
      t.service.addPredictionsToResult(
        5,
        {} as AddPredictionsToResultDto,
        [],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Provide at least one change: newPredictions, updatedDilutions, corrections, existingCorrections, observations or status.',
      ),
    );
    expect(t.resultRepository.findOne).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('stores corrections of new images (by index) and of existing predictions in the same transaction', async () => {
    const t = withResult();

    const response = await t.service.addPredictionsToResult(
      5,
      appendDto({
        corrections: [
          {
            imageIndex: 0,
            correctedPrediction: PredictionClass.NUCLEOLAR,
            observations: 'Nucleolar pattern',
          },
        ],
        existingCorrections: [
          {
            predictionId: 10,
            correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
          },
        ],
        // Ignored: any stored correction makes the result CORRECTED
        status: ResultStatus.VERIFIED,
      }),
      [image('c.png')],
      42,
      UserRole.STANDARD,
    );

    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    const savedCorrections = t.tx.corrections.save.mock.calls.map(([c]) => c);
    expect(savedCorrections).toEqual([
      expect.objectContaining({
        predictionId: 100,
        correctedPrediction: PredictionClass.NUCLEOLAR,
        observations: 'Nucleolar pattern',
        correctedBy: 42,
      }),
      expect.objectContaining({
        predictionId: 10,
        correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
        correctedBy: 42,
      }),
    ]);
    expect(t.tx.results.update).toHaveBeenCalledWith(5, {
      status: ResultStatus.CORRECTED,
      verifiedBy: null,
      verifiedAt: null,
    });
    expect(response.addedPredictionIds).toEqual([100]);
    const newValues = t.traceability.logUpdateConsolidated.mock
      .calls[0][4] as Record<string, unknown>;
    expect(newValues).toMatchObject({
      status: ResultStatus.CORRECTED,
      correctionsCount: 2,
      corrections: [
        expect.objectContaining({
          predictionId: 100,
          originalPrediction: PredictionClass.NUCLEAR_SPECKLED,
          correctedPrediction: PredictionClass.NUCLEOLAR,
        }),
        expect.objectContaining({
          predictionId: 10,
          originalPrediction: PredictionClass.NUCLEAR,
          correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
        }),
      ],
    });
  });

  it('ignores corrections equal to the current effective class', async () => {
    const t = withResult({
      predictions: [
        {
          predictionId: 10,
          prediction: PredictionClass.NUCLEAR,
          imagePath: 'old-a.png',
          dilution: Dilution.DILUTION_80,
          corrections: [
            {
              correctedResultId: 1,
              correctedPrediction: PredictionClass.NUCLEAR_CENTROMERE,
              correctedDate: new Date('2026-09-01'),
            },
          ],
        },
      ],
    });

    await t.service.addPredictionsToResult(
      5,
      appendDto({
        // Same as the model class of the new image
        corrections: [
          {
            imageIndex: 0,
            correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
          },
        ],
        // Same as the latest correction of prediction 10
        existingCorrections: [
          {
            predictionId: 10,
            correctedPrediction: PredictionClass.NUCLEAR_CENTROMERE,
          },
        ],
      }),
      [image('c.png')],
      42,
      UserRole.STANDARD,
    );

    expect(t.tx.corrections.save).not.toHaveBeenCalled();
    expect(t.tx.results.update).not.toHaveBeenCalled();
  });

  it('accepts corrections of existing predictions without new images', async () => {
    const t = withResult();

    const response = await t.service.addPredictionsToResult(
      5,
      {
        existingCorrections: [
          {
            predictionId: 10,
            correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
          },
        ],
      } as AddPredictionsToResultDto,
      [],
      42,
      UserRole.STANDARD,
    );

    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
    expect(t.signatures.assertValid).not.toHaveBeenCalled();
    expect(t.tx.predictions.save).not.toHaveBeenCalled();
    expect(t.tx.corrections.save).toHaveBeenCalledTimes(1);
    expect(response.addedPredictionIds).toEqual([]);
  });

  it('rejects corrections of predictions of another result and duplicates', async () => {
    const t = withResult();
    const call = (existingCorrections: object[]) =>
      t.service.addPredictionsToResult(
        5,
        { existingCorrections } as AddPredictionsToResultDto,
        [],
        42,
        UserRole.STANDARD,
      );
    const correction = (predictionId: number) => ({
      predictionId,
      correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
    });

    await expect(call([correction(77)])).rejects.toThrow(
      new BadRequestException('Predictions 77 do not belong to result 5.'),
    );
    await expect(call([correction(10), correction(10)])).rejects.toThrow(
      new BadRequestException(
        'Each prediction can be corrected at most once per request.',
      ),
    );
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a correction index outside the new images', async () => {
    const t = withResult();

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto({
          corrections: [
            { imageIndex: 1, correctedPrediction: PredictionClass.NUCLEOLAR },
          ],
        }),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(
      'Correction 1 refers to image index 1, but only 1 images were uploaded.',
    );
  });

  describe.each([UserRole.ADMIN, UserRole.STANDARD])(
    'VERIFIED lock (%s)',
    (role) => {
      const changes: Array<
        [string, Partial<AddPredictionsToResultDto>, number]
      > = [
        ['appending images', {}, 1],
        [
          'changing a dilution',
          {
            newPredictions: undefined,
            updatedDilutions: [
              { predictionId: 10, dilution: Dilution.DILUTION_640 },
            ],
          },
          0,
        ],
        [
          'changing the observations',
          { newPredictions: undefined, observations: 'Changed' },
          0,
        ],
        [
          'clearing the observations',
          { newPredictions: undefined, observations: null },
          0,
        ],
      ];

      it.each(changes)('rejects %s with 409', async (_name, overrides, n) => {
        const t = withResult({ status: ResultStatus.VERIFIED });

        await expect(
          t.service.addPredictionsToResult(
            5,
            appendDto(overrides),
            n ? [image('c.png')] : [],
            42,
            role,
          ),
        ).rejects.toThrow(new ConflictException(LOCKED));
        expect(t.files.savePredictionImages).not.toHaveBeenCalled();
        expect(t.dataSource.transaction).not.toHaveBeenCalled();
      });
    },
  );

  it('lets an ADMIN correct a VERIFIED result (unchanged fields are not changes) and clears the verification', async () => {
    const t = withResult({ status: ResultStatus.VERIFIED });

    await t.service.addPredictionsToResult(
      5,
      {
        existingCorrections: [
          { predictionId: 10, correctedPrediction: PredictionClass.NUCLEOLAR },
        ],
        updatedDilutions: [
          { predictionId: 10, dilution: Dilution.DILUTION_80 },
        ],
        observations: 'First pass',
      } as AddPredictionsToResultDto,
      [],
      1,
      UserRole.ADMIN,
    );

    expect(t.tx.corrections.save).toHaveBeenCalledTimes(1);
    expect(t.tx.predictions.update).not.toHaveBeenCalled();
    expect(t.tx.results.update).toHaveBeenCalledWith(5, {
      status: ResultStatus.CORRECTED,
      verifiedBy: null,
      verifiedAt: null,
    });
  });

  it('forbids STANDARD corrections on a VERIFIED result, even their own', async () => {
    const t = withResult({ status: ResultStatus.VERIFIED });

    await expect(
      t.service.addPredictionsToResult(
        5,
        {
          existingCorrections: [
            {
              predictionId: 10,
              correctedPrediction: PredictionClass.NUCLEOLAR,
            },
          ],
        } as AddPredictionsToResultDto,
        [],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(new ForbiddenException(STANDARD_VERIFIED_DENIED));
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('re-checks the lock on the row read with UPDLOCK inside the transaction', async () => {
    const t = withResult();
    // Verified by someone else between the first read and the transaction
    t.tx.results.findOne.mockResolvedValueOnce({
      ...existing(),
      status: ResultStatus.VERIFIED,
    });

    await expect(
      t.service.addPredictionsToResult(
        5,
        appendDto(),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(new ConflictException(LOCKED));
    expect(t.tx.results.findOne).toHaveBeenCalledWith({
      where: { resultId: 5 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(t.tx.predictions.save).not.toHaveBeenCalled();
    expect(t.files.deletePredictionImages).toHaveBeenCalledWith([
      'stored-0-c.png',
    ]);
    expect(t.traceability.logUpdateConsolidated).not.toHaveBeenCalled();
  });

  it('forbids a STANDARD correction when the result was verified meanwhile', async () => {
    const t = withResult();
    t.tx.results.findOne.mockResolvedValueOnce({
      ...existing(),
      status: ResultStatus.VERIFIED,
    });

    await expect(
      t.service.addPredictionsToResult(
        5,
        {
          existingCorrections: [
            {
              predictionId: 10,
              correctedPrediction: PredictionClass.NUCLEOLAR,
            },
          ],
        } as AddPredictionsToResultDto,
        [],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(new ForbiddenException(STANDARD_VERIFIED_DENIED));
    expect(t.tx.corrections.save).not.toHaveBeenCalled();
  });

  // --- Image cap per result and no-op requests -----------------------------

  const TOO_MANY_IMAGES = 'A result can hold at most 20 images.';

  const savedPredictions = (count: number) =>
    Array.from({ length: count }, (_unused, index) => ({
      predictionId: 10 + index,
      prediction: PredictionClass.NUCLEAR,
      imagePath: `old-${index}.png`,
      dilution: Dilution.DILUTION_80,
    }));

  const newImages = (count: number) => ({
    dto: appendDto({
      newPredictions: Array.from({ length: count }, () => ({
        prediction: PredictionClass.NUCLEAR_SPECKLED,
        confidencePercentage: 66,
        dilution: Dilution.DILUTION_320,
      })) as AddPredictionsToResultDto['newPredictions'],
    }),
    files: Array.from({ length: count }, (_unused, index) =>
      image(`new-${index}.png`),
    ),
  });

  it('accepts images up to 20 per result, saved ones included (19 + 1)', async () => {
    const t = withResult({ predictions: savedPredictions(19) });
    t.tx.predictions.count.mockResolvedValue(19);
    const { dto, files } = newImages(1);

    const response = await t.service.addPredictionsToResult(
      5,
      dto,
      files,
      42,
      UserRole.STANDARD,
    );

    expect(response.addedPredictionIds).toEqual([100]);
    expect(t.tx.predictions.save).toHaveBeenCalledTimes(1);
  });

  it('rejects more than 20 images per result before storing any file (19 + 2)', async () => {
    const t = withResult({ predictions: savedPredictions(19) });
    const { dto, files } = newImages(2);

    await expect(
      t.service.addPredictionsToResult(5, dto, files, 42, UserRole.STANDARD),
    ).rejects.toThrow(new BadRequestException(TOO_MANY_IMAGES));
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('counts the images again under the lock, so concurrent appends cannot exceed the cap', async () => {
    // 18 saved when first read; another append committed one more before
    // this request got the lock
    const t = withResult({ predictions: savedPredictions(18) });
    t.tx.predictions.count.mockResolvedValue(19);
    const { dto, files } = newImages(2);

    await expect(
      t.service.addPredictionsToResult(5, dto, files, 42, UserRole.STANDARD),
    ).rejects.toThrow(new BadRequestException(TOO_MANY_IMAGES));
    expect(t.tx.predictions.count).toHaveBeenCalledWith({
      where: { resultId: 5 },
    });
    // Counted after the row was locked
    expect(t.tx.results.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      t.tx.predictions.count.mock.invocationCallOrder[0],
    );
    expect(t.tx.predictions.save).not.toHaveBeenCalled();
    expect(t.files.deletePredictionImages).toHaveBeenCalledWith([
      'stored-0-new-0.png',
      'stored-1-new-1.png',
    ]);
    expect(t.traceability.logUpdateConsolidated).not.toHaveBeenCalled();
  });

  it('does not limit requests without new images on a result that already holds 20', async () => {
    const t = withResult({ predictions: savedPredictions(20) });
    t.tx.predictions.count.mockResolvedValue(20);

    await t.service.addPredictionsToResult(
      5,
      { observations: 'Second pass' } as AddPredictionsToResultDto,
      [],
      42,
      UserRole.STANDARD,
    );

    expect(t.tx.results.update).toHaveBeenCalledWith(5, {
      observations: 'Second pass',
    });
  });

  it('writes no audit record when the request changes nothing', async () => {
    const t = withResult();

    const response = await t.service.addPredictionsToResult(
      5,
      {
        // Every value equals the stored one
        updatedDilutions: [
          { predictionId: 10, dilution: Dilution.DILUTION_80 },
        ],
        existingCorrections: [
          { predictionId: 10, correctedPrediction: PredictionClass.NUCLEAR },
        ],
        observations: 'First pass',
        status: ResultStatus.PENDING,
      } as AddPredictionsToResultDto,
      [],
      42,
      UserRole.STANDARD,
    );

    expect(t.tx.predictions.update).not.toHaveBeenCalled();
    expect(t.tx.corrections.save).not.toHaveBeenCalled();
    expect(t.tx.results.update).not.toHaveBeenCalled();
    expect(t.traceability.logUpdateConsolidated).not.toHaveBeenCalled();
    // The response is the usual one: the result detail, nothing added
    expect(response).toMatchObject({
      resultId: 5,
      status: ResultStatus.PENDING,
      addedPredictionIds: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Listing and visibility
// ---------------------------------------------------------------------------

describe('ResultsService.findAllPaginated', () => {
  const listRow = {
    resultId: 5,
    dateAndHour: new Date('2026-09-24T10:00:00Z'),
    status: ResultStatus.PENDING,
    patient,
    user: standardUser,
    predictionsCount: 3,
  };

  function list(role: UserRole, status?: ResultStatus, search?: string) {
    const t = setup();
    const builder = queryBuilder({ getManyAndCount: [[listRow], 1] });
    t.resultRepository.createQueryBuilder.mockReturnValue(builder.qb);
    return {
      t,
      builder,
      run: () => t.service.findAllPaginated(1, 10, status, 42, role, search),
    };
  }

  const SEARCH_CONDITION =
    '(LOWER(patient.fullName) LIKE :search OR LOWER(patient.documentNumber) LIKE :search)';

  it('searches the patient name or document number (contains, case-insensitive, LIKE-escaped)', async () => {
    const { builder, run } = list(UserRole.ADMIN, undefined, '  DOE_1% ');

    await run();

    expect(builder.conditions()).toEqual([
      [SEARCH_CONDITION, { search: '%doe[_]1[%]%' }],
    ]);
  });

  it('combines the search with the STANDARD visibility rules', async () => {
    const { builder, run } = list(UserRole.STANDARD, undefined, 'roe');

    await run();

    expect(builder.conditions()).toEqual([
      [
        '(result.userId = :userId OR result.status = :pendingStatus)',
        { userId: 42, pendingStatus: ResultStatus.PENDING },
      ],
      [SEARCH_CONDITION, { search: '%roe%' }],
    ]);
  });

  it('combines the search with a status filter and pagination', async () => {
    const { builder, run } = list(
      UserRole.STANDARD,
      ResultStatus.VERIFIED,
      '900100',
    );

    await run();

    expect(builder.conditions()).toEqual([
      ['result.status = :status', { status: ResultStatus.VERIFIED }],
      ['result.userId = :userId', { userId: 42 }],
      [SEARCH_CONDITION, { search: '%900100%' }],
    ]);
    expect(builder.calls).toContainEqual(['take', [10]]);
  });

  it('ignores a blank search', async () => {
    const { builder, run } = list(UserRole.ADMIN, undefined, '   ');

    await run();

    expect(builder.conditions()).toEqual([]);
  });

  it('reports the real number of predictions of each result', async () => {
    const { builder, run } = list(UserRole.ADMIN);

    const page = await run();

    expect(page.data[0].predictionsCount).toBe(3);
    expect(builder.calls).toContainEqual([
      'loadRelationCountAndMap',
      ['result.predictionsCount', 'result.predictions'],
    ]);
  });

  it('shows a STANDARD user their own results plus the shared PENDING queue', async () => {
    const { builder, run } = list(UserRole.STANDARD);

    await run();

    expect(builder.conditions()).toEqual([
      [
        '(result.userId = :userId OR result.status = :pendingStatus)',
        { userId: 42, pendingStatus: ResultStatus.PENDING },
      ],
    ]);
  });

  it('shows every PENDING result to a STANDARD user filtering by PENDING', async () => {
    const { builder, run } = list(UserRole.STANDARD, ResultStatus.PENDING);

    await run();

    expect(builder.conditions()).toEqual([
      ['result.status = :status', { status: ResultStatus.PENDING }],
    ]);
  });

  it('limits other statuses to the STANDARD user own results', async () => {
    const { builder, run } = list(UserRole.STANDARD, ResultStatus.VERIFIED);

    await run();

    expect(builder.conditions()).toEqual([
      ['result.status = :status', { status: ResultStatus.VERIFIED }],
      ['result.userId = :userId', { userId: 42 }],
    ]);
  });

  it('does not restrict an ADMIN', async () => {
    const { builder, run } = list(UserRole.ADMIN, ResultStatus.VERIFIED);

    await run();

    expect(builder.conditions()).toEqual([
      ['result.status = :status', { status: ResultStatus.VERIFIED }],
    ]);
  });
});

describe('ResultsService.findByIdDetailed', () => {
  function detail(row: object) {
    const t = setup();
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: row }).qb,
    );
    return t;
  }

  it("lets a STANDARD user open someone else's PENDING result", async () => {
    const t = detail(detailRow({ userId: 7 }));

    await expect(
      t.service.findByIdDetailed(5, 42, UserRole.STANDARD),
    ).resolves.toMatchObject({ resultId: 5 });
  });

  it("forbids a STANDARD user from opening someone else's VERIFIED result", async () => {
    const t = detail(detailRow({ userId: 7, status: ResultStatus.VERIFIED }));

    await expect(
      t.service.findByIdDetailed(5, 42, UserRole.STANDARD),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the creator without a position field and the verification details', async () => {
    const verifiedAt = new Date('2026-09-24T12:00:00Z');
    const t = detail(
      detailRow({
        status: ResultStatus.VERIFIED,
        verifiedBy: 1,
        verifiedAt,
        verifier: { ...adminUser, email: 'admin@example.com' },
      }),
    );

    const result = await t.service.findByIdDetailed(5, 1, UserRole.ADMIN);

    expect(result.user).toEqual({ userId: 42, fullName: 'Jane Doe' });
    expect(result.verifiedBy).toEqual({ userId: 1, fullName: 'Alex Admin' });
    expect(result.verifiedAt).toEqual(verifiedAt);
    expect(result.predictions[0].imageUrl).toMatch(
      /\/api\/v1\/files\/predictions\/stored-0-a\.png$/,
    );
  });

  it('returns 404 for an unknown result', async () => {
    const t = detail(null as unknown as object);

    await expect(
      t.service.findByIdDetailed(5, 1, UserRole.ADMIN),
    ).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Updates and verification
// ---------------------------------------------------------------------------

describe('ResultsService.update', () => {
  it('records who verified the result and when', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.CORRECTED,
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );

    await t.service.update(
      5,
      { status: ResultStatus.VERIFIED },
      1,
      UserRole.ADMIN,
    );

    expect(t.tx.results.update).toHaveBeenCalledWith(5, {
      status: ResultStatus.VERIFIED,
      verifiedBy: 1,
      verifiedAt: expect.any(Date) as unknown,
    });
    expect(t.traceability.logUpdate).toHaveBeenCalledWith(
      EntityType.RESULT,
      5,
      1,
      { status: ResultStatus.CORRECTED },
      { status: ResultStatus.VERIFIED },
    );
  });

  it('does not touch the verifier when only observations change', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.CORRECTED,
      observations: 'a',
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );

    await t.service.update(5, { observations: 'b' }, 42, UserRole.STANDARD);

    expect(t.tx.results.update).toHaveBeenCalledWith(5, {
      observations: 'b',
    });
  });

  it("forbids a STANDARD user from updating someone else's verified result", async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 7,
      status: ResultStatus.VERIFIED,
    });

    await expect(
      t.service.update(5, { observations: 'b' }, 42, UserRole.STANDARD),
    ).rejects.toThrow(ForbiddenException);
    expect(t.tx.results.update).not.toHaveBeenCalled();
  });
  it('clears the observations with null', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.PENDING,
      observations: 'a',
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );

    await t.service.update(5, { observations: null }, 42, UserRole.STANDARD);

    expect(t.tx.results.update).toHaveBeenCalledWith(5, { observations: null });
    expect(t.traceability.logUpdate).toHaveBeenCalledWith(
      EntityType.RESULT,
      5,
      42,
      { observations: 'a' },
      { observations: null },
    );
  });

  it.each([UserRole.ADMIN, UserRole.STANDARD])(
    'rejects changing the observations of a VERIFIED result with 409 (%s)',
    async (role) => {
      const t = setup();
      t.resultRepository.findOne.mockResolvedValue({
        resultId: 5,
        userId: 42,
        status: ResultStatus.VERIFIED,
        observations: 'a',
      });

      await expect(
        t.service.update(5, { observations: 'b' }, 42, role),
      ).rejects.toThrow(
        new ConflictException('Verified results cannot be modified.'),
      );
      expect(t.tx.results.update).not.toHaveBeenCalled();
      expect(t.traceability.logUpdate).not.toHaveBeenCalled();
    },
  );

  it('accepts unchanged observations on a VERIFIED result (no-op)', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.VERIFIED,
      observations: null,
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );

    await expect(
      t.service.update(5, { observations: null }, 1, UserRole.ADMIN),
    ).resolves.toBeDefined();
    expect(t.tx.results.update).not.toHaveBeenCalled();
  });

  it('reads the result with an update lock inside the transaction (a concurrent verification wins)', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.PENDING,
      observations: 'a',
    });
    t.tx.results.findOne.mockResolvedValueOnce({
      resultId: 5,
      userId: 42,
      status: ResultStatus.VERIFIED,
      observations: 'a',
    });

    await expect(
      t.service.update(5, { observations: 'b' }, 42, UserRole.STANDARD),
    ).rejects.toThrow(
      new ConflictException('Verified results cannot be modified.'),
    );
    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(t.tx.results.findOne).toHaveBeenCalledWith({
      where: { resultId: 5 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(t.tx.results.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

describe('ResultsService corrections', () => {
  const CORRECTED_UNVERIFIED = {
    status: ResultStatus.CORRECTED,
    verifiedBy: null,
    verifiedAt: null,
  };

  const correctionRow = (id: number) => ({
    correctedResultId: id,
    predictionId: 10,
    correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
    observations: undefined,
    correctedDate: new Date('2026-09-24T10:05:00Z'),
    user: { ...adminUser, email: 'admin@example.com', role: UserRole.ADMIN },
  });

  function withPrediction(
    t: ReturnType<typeof setup>,
    resultOverrides: object,
  ) {
    t.predictionRepository.findOne.mockResolvedValue({
      predictionId: 10,
      prediction: PredictionClass.NUCLEAR,
      result: {
        resultId: 5,
        userId: 42,
        status: ResultStatus.PENDING,
        ...resultOverrides,
      },
    });
    t.tx.results.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.PENDING,
      ...resultOverrides,
    });
    t.correctedResultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getMany: [correctionRow(100)] }).qb,
    );
  }

  const single = {
    predictionId: 10,
    correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
  };

  it('moves a PENDING result to CORRECTED', async () => {
    const t = setup();
    withPrediction(t, {});

    const correction = await t.service.createCorrection(
      single,
      42,
      UserRole.STANDARD,
    );

    expect(t.tx.corrections.save).toHaveBeenCalledTimes(1);
    expect(t.tx.results.update).toHaveBeenCalledWith(5, CORRECTED_UNVERIFIED);
    expect(correction.correctedBy).toEqual({
      userId: 1,
      username: 'admin',
      fullName: 'Alex Admin',
    });
  });

  it('moves a VERIFIED result to CORRECTED when an ADMIN corrects it', async () => {
    const t = setup();
    withPrediction(t, { status: ResultStatus.VERIFIED });

    await t.service.createCorrection(single, 1, UserRole.ADMIN);

    expect(t.tx.results.update).toHaveBeenCalledWith(5, CORRECTED_UNVERIFIED);
  });

  it('forbids a STANDARD user from correcting their own VERIFIED result', async () => {
    const t = setup();
    withPrediction(t, { status: ResultStatus.VERIFIED });

    await expect(
      t.service.createCorrection(single, 42, UserRole.STANDARD),
    ).rejects.toThrow(
      new ForbiddenException(
        'You cannot correct predictions of a verified result. Only an administrator can do this.',
      ),
    );
    expect(t.tx.corrections.save).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it("forbids a STANDARD user from correcting someone else's CORRECTED result", async () => {
    const t = setup();
    withPrediction(t, { userId: 7, status: ResultStatus.CORRECTED });

    await expect(
      t.service.createCorrection(single, 42, UserRole.STANDARD),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forbids a STANDARD correction when the result was verified meanwhile (locked re-check)', async () => {
    const t = setup();
    withPrediction(t, {});
    t.tx.results.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.VERIFIED,
    });

    await expect(
      t.service.createCorrection(single, 42, UserRole.STANDARD),
    ).rejects.toThrow(
      new ForbiddenException(
        'You cannot correct predictions of a verified result. Only an administrator can do this.',
      ),
    );
    expect(t.tx.results.findOne).toHaveBeenCalledWith({
      where: { resultId: 5 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(t.tx.results.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown prediction', async () => {
    const t = setup();
    t.predictionRepository.findOne.mockResolvedValue(null);

    await expect(
      t.service.createCorrection(single, 42, UserRole.STANDARD),
    ).rejects.toThrow(NotFoundException);
  });

  describe('createBatchCorrectionsForExisting', () => {
    function withPredictions(
      t: ReturnType<typeof setup>,
      predictions: object[],
    ) {
      t.predictionRepository.createQueryBuilder.mockReturnValue(
        queryBuilder({ getMany: predictions }).qb,
      );
      t.correctedResultRepository.createQueryBuilder.mockReturnValue(
        queryBuilder({
          getMany: [
            correctionRow(100),
            { ...correctionRow(101), predictionId: 11 },
          ],
        }).qb,
      );
      t.resultRepository.findOne.mockResolvedValue({
        ...detailRow({ status: ResultStatus.CORRECTED }),
      });
      t.tx.results.findOne.mockResolvedValue(
        (predictions[0] as { result?: object } | undefined)?.result,
      );
    }

    const prediction = (id: number, result: object) => ({
      predictionId: id,
      prediction: PredictionClass.NUCLEAR,
      imagePath: `p${id}.png`,
      dilution: Dilution.DILUTION_80,
      confidencePercentage: 80,
      result,
    });

    const batch = {
      corrections: [
        {
          predictionId: 10,
          correctedPrediction: PredictionClass.NUCLEAR_SPECKLED,
        },
        {
          predictionId: 11,
          correctedPrediction: PredictionClass.NUCLEAR_CENTROMERE,
        },
      ],
    };

    it('moves a VERIFIED result to CORRECTED when an ADMIN corrects it', async () => {
      const t = setup();
      const result = { resultId: 5, userId: 42, status: ResultStatus.VERIFIED };
      withPredictions(t, [prediction(10, result), prediction(11, result)]);

      const created = await t.service.createBatchCorrectionsForExisting(
        batch,
        1,
        UserRole.ADMIN,
      );

      expect(t.tx.corrections.save).toHaveBeenCalledTimes(2);
      expect(t.tx.results.update).toHaveBeenCalledWith(5, CORRECTED_UNVERIFIED);
      expect(created).toHaveLength(2);
      expect(t.traceability.logCreate).toHaveBeenCalledWith(
        EntityType.CORRECTION,
        5,
        1,
        expect.objectContaining({
          previousResultStatus: ResultStatus.VERIFIED,
          resultStatus: ResultStatus.CORRECTED,
        }),
      );
    });

    it('forbids a STANDARD user from correcting a VERIFIED result', async () => {
      const t = setup();
      const result = { resultId: 5, userId: 42, status: ResultStatus.VERIFIED };
      withPredictions(t, [prediction(10, result), prediction(11, result)]);

      await expect(
        t.service.createBatchCorrectionsForExisting(
          batch,
          42,
          UserRole.STANDARD,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(t.tx.corrections.save).not.toHaveBeenCalled();
    });

    it('rejects corrections that span several results', async () => {
      const t = setup();
      withPredictions(t, [
        prediction(10, {
          resultId: 5,
          userId: 42,
          status: ResultStatus.PENDING,
        }),
        prediction(11, {
          resultId: 6,
          userId: 42,
          status: ResultStatus.PENDING,
        }),
      ]);

      await expect(
        t.service.createBatchCorrectionsForExisting(
          batch,
          42,
          UserRole.STANDARD,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'All corrections must belong to the same result.',
        ),
      );
    });

    it('reports missing predictions with 404', async () => {
      const t = setup();
      withPredictions(t, [
        prediction(10, {
          resultId: 5,
          userId: 42,
          status: ResultStatus.PENDING,
        }),
      ]);

      await expect(
        t.service.createBatchCorrectionsForExisting(
          batch,
          42,
          UserRole.STANDARD,
        ),
      ).rejects.toThrow(
        new NotFoundException('Predictions with IDs 11 not found.'),
      );
    });

    it('rejects two corrections of the same prediction', async () => {
      const t = setup();
      const duplicated = {
        corrections: [batch.corrections[0], { ...batch.corrections[0] }],
      };

      await expect(
        t.service.createBatchCorrectionsForExisting(
          duplicated,
          42,
          UserRole.STANDARD,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Each prediction can be corrected at most once per request.',
        ),
      );
    });
  });

  it('lists corrections newest first without a position field', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.CORRECTED,
      predictions: [{ predictionId: 10 }],
    });
    const builder = queryBuilder({ getMany: [correctionRow(100)] });
    t.correctedResultRepository.createQueryBuilder.mockReturnValue(builder.qb);

    const corrections = await t.service.getCorrections(
      5,
      42,
      UserRole.STANDARD,
    );

    expect(corrections[0].correctedBy).toEqual({
      userId: 1,
      username: 'admin',
      fullName: 'Alex Admin',
    });
    expect(builder.calls).toContainEqual([
      'orderBy',
      ['correction.correctedDate', 'DESC'],
    ]);
    expect(builder.calls).toContainEqual([
      'addOrderBy',
      ['correction.correctedResultId', 'DESC'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe('ResultsService.getStatistics', () => {
  const originalTimeZone = process.env.APP_TIMEZONE;
  afterEach(() => {
    if (originalTimeZone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimeZone;
    }
  });

  function statistics(row: unknown) {
    const t = setup();
    const builder = queryBuilder({ getRawOne: row });
    t.predictionRepository.createQueryBuilder.mockReturnValue(builder.qb);
    return { t, builder };
  }

  it('computes precision and correction rate per prediction from one aggregate row', async () => {
    const { t } = statistics({ totalValidated: 4, totalCorrected: 1 });

    await expect(t.service.getStatistics(1, UserRole.ADMIN)).resolves.toEqual({
      totalValidated: 4,
      precision: 75,
      correctionRate: 25,
      totalVerifiedWithoutCorrections: 3,
      totalCorrected: 1,
    });
  });

  it('aggregates in SQL: no query parameter grows with the data', async () => {
    const { t, builder } = statistics({
      totalValidated: 5000,
      totalCorrected: 7,
    });

    await t.service.getStatistics(1, UserRole.ADMIN);

    // One query over Predictions; results and corrections are joined, never listed
    expect(t.predictionRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(t.resultRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(
      t.correctedResultRepository.createQueryBuilder,
    ).not.toHaveBeenCalled();
    expect(builder.calls).toEqual(
      expect.arrayContaining([
        ['innerJoin', ['prediction.result', 'result']],
        ['leftJoin', ['prediction.corrections', 'correction']],
        [
          'select',
          ['COUNT(DISTINCT prediction.predictionId)', 'totalValidated'],
        ],
        [
          'addSelect',
          ['COUNT(DISTINCT correction.predictionId)', 'totalCorrected'],
        ],
      ]),
    );
    // The only list parameter is the fixed pair of validated statuses
    expect(builder.conditions()).toEqual([
      [
        'result.status IN (:...statuses)',
        { statuses: [ResultStatus.VERIFIED, ResultStatus.CORRECTED] },
      ],
    ]);
  });

  it('returns zeros when nothing was validated', async () => {
    const { t } = statistics({ totalValidated: 0, totalCorrected: 0 });

    await expect(t.service.getStatistics(1, UserRole.ADMIN)).resolves.toEqual({
      totalValidated: 0,
      precision: 0,
      correctionRate: 0,
      totalVerifiedWithoutCorrections: 0,
      totalCorrected: 0,
    });
  });

  it('reads counts returned as strings by the driver', async () => {
    const { t } = statistics({ totalValidated: '3', totalCorrected: '1' });

    await expect(
      t.service.getStatistics(1, UserRole.ADMIN),
    ).resolves.toMatchObject({ totalValidated: 3, totalCorrected: 1 });
  });

  it('only counts the STANDARD user own results', async () => {
    const { t, builder } = statistics({ totalValidated: 0, totalCorrected: 0 });

    await t.service.getStatistics(42, UserRole.STANDARD);

    expect(builder.conditions()).toContainEqual([
      'result.userId = :userId',
      { userId: 42 },
    ]);
  });

  it('turns the local dates of APP_TIMEZONE into UTC bounds (America/Lima)', async () => {
    process.env.APP_TIMEZONE = 'America/Lima';
    const { t, builder } = statistics({ totalValidated: 0, totalCorrected: 0 });

    await t.service.getStatistics(
      1,
      UserRole.ADMIN,
      '2026-09-01',
      '2026-09-30',
    );

    expect(builder.conditions()).toEqual(
      expect.arrayContaining([
        [
          'result.dateAndHour >= :from',
          {
            from: new MssqlParameter(
              new Date('2026-09-01T05:00:00.000Z'),
              'datetime2',
            ),
          },
        ],
        [
          'result.dateAndHour < :to',
          {
            to: new MssqlParameter(
              new Date('2026-10-01T05:00:00.000Z'),
              'datetime2',
            ),
          },
        ],
      ]),
    );
  });

  it('uses UTC midnights when APP_TIMEZONE is UTC', async () => {
    process.env.APP_TIMEZONE = 'UTC';
    const { t, builder } = statistics({ totalValidated: 0, totalCorrected: 0 });

    await t.service.getStatistics(1, UserRole.ADMIN, undefined, '2026-09-30');

    const dateConditions = builder
      .conditions()
      .filter(([sql]) => String(sql).includes('dateAndHour'));
    expect(dateConditions).toEqual([
      [
        'result.dateAndHour < :to',
        {
          to: new MssqlParameter(
            new Date('2026-10-01T00:00:00.000Z'),
            'datetime2',
          ),
        },
      ],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Status transitions (PATCH and append share the same rules)
// ---------------------------------------------------------------------------

describe('ResultsService status transitions', () => {
  const { PENDING, CORRECTED, VERIFIED } = ResultStatus;

  // [from, to, allowed]: same status is a no-op; VERIFIED is reached from
  // PENDING or CORRECTED; CORRECTED only through corrections; nothing goes
  // back to PENDING.
  const pairs: Array<[ResultStatus, ResultStatus, boolean]> = [
    [PENDING, PENDING, true],
    [PENDING, VERIFIED, true],
    [PENDING, CORRECTED, false],
    [CORRECTED, CORRECTED, true],
    [CORRECTED, VERIFIED, true],
    [CORRECTED, PENDING, false],
    [VERIFIED, VERIFIED, true],
    [VERIFIED, PENDING, false],
    [VERIFIED, CORRECTED, false],
  ];

  function withResult(status: ResultStatus) {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status,
      observations: 'First pass',
      patient,
      predictions: [],
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );
    return t;
  }

  describe.each(pairs)('%s -> %s', (from, to, allowed) => {
    const message = `Invalid status transition from ${from} to ${to}.`;

    it(`PATCH ${allowed ? 'accepts' : 'rejects with 409'}`, async () => {
      const t = withResult(from);
      const call = t.service.update(5, { status: to }, 1, UserRole.ADMIN);

      if (allowed) {
        await expect(call).resolves.toBeDefined();
      } else {
        const error: unknown = await call.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toBe(message);
        expect(t.tx.results.update).not.toHaveBeenCalled();
        expect(t.traceability.logUpdate).not.toHaveBeenCalled();
      }
    });

    it(`append ${allowed ? 'accepts' : 'rejects with 409'}`, async () => {
      const t = withResult(from);
      // Status only: a VERIFIED result accepts no other change
      const call = t.service.addPredictionsToResult(
        5,
        { status: to } as AddPredictionsToResultDto,
        [],
        1,
        UserRole.ADMIN,
      );

      if (allowed) {
        await expect(call).resolves.toBeDefined();
      } else {
        const error: unknown = await call.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toBe(message);
        expect(t.files.savePredictionImages).not.toHaveBeenCalled();
        expect(t.dataSource.transaction).not.toHaveBeenCalled();
      }
    });
  });

  it('treats verifying a VERIFIED result again as a no-op (the verifier is kept)', async () => {
    const t = withResult(VERIFIED);

    await t.service.update(5, { status: VERIFIED }, 1, UserRole.ADMIN);

    expect(t.tx.results.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Trusted predictions (signature check before anything is stored)
// ---------------------------------------------------------------------------

describe('ResultsService prediction signatures', () => {
  const INVALID = 'Prediction signature is invalid for image 1.';
  const signed = (item: object) => ({
    classificationLevel: 'competent',
    signature: 'sig',
    ...item,
  });
  const batch = () =>
    ({
      patientId: 1,
      predictions: [
        signed({
          prediction: PredictionClass.NUCLEAR_HOMOGENEOUS,
          confidencePercentage: 87.5,
          dilution: Dilution.DILUTION_80,
        }),
      ],
    }) as CreateBatchResultsWithCorrectionsDto;
  const append = () =>
    ({
      newPredictions: [
        signed({
          prediction: PredictionClass.NUCLEAR_SPECKLED,
          confidencePercentage: 66,
          dilution: Dilution.DILUTION_320,
        }),
      ],
    }) as AddPredictionsToResultDto;

  it('createBatchWithFiles verifies every prediction against its image', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);
    const dto = batch();
    const files = [image('a.png')];

    await t.service.createBatchWithFiles(dto, files, 42);

    expect(t.signatures.assertValid).toHaveBeenCalledWith(
      files,
      dto.predictions,
    );
  });

  it('createBatchWithFiles stores nothing when a signature is invalid', async () => {
    const t = setup();
    t.patientRepository.findOne.mockResolvedValue(patient);
    t.signatures.assertValid.mockImplementation(() => {
      throw new BadRequestException(INVALID);
    });

    await expect(
      t.service.createBatchWithFiles(batch(), [image('a.png')], 42),
    ).rejects.toThrow(new BadRequestException(INVALID));
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('addPredictionsToResult verifies every new prediction against its image', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.PENDING,
      patient,
      predictions: [],
    });
    t.resultRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({ getOne: detailRow() }).qb,
    );
    const dto = append();
    const files = [image('c.png')];

    await t.service.addPredictionsToResult(
      5,
      dto,
      files,
      42,
      UserRole.STANDARD,
    );

    expect(t.signatures.assertValid).toHaveBeenCalledWith(
      files,
      dto.newPredictions,
    );
  });

  it('addPredictionsToResult stores nothing when a signature is invalid', async () => {
    const t = setup();
    t.resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      userId: 42,
      status: ResultStatus.PENDING,
      patient,
      predictions: [],
    });
    t.signatures.assertValid.mockImplementation(() => {
      throw new BadRequestException(INVALID);
    });

    await expect(
      t.service.addPredictionsToResult(
        5,
        append(),
        [image('c.png')],
        42,
        UserRole.STANDARD,
      ),
    ).rejects.toThrow(new BadRequestException(INVALID));
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects swapped images with the real signature check', async () => {
    const signer = new PredictionSignatureService({
      get: () => 'unit-test-signing-secret',
    } as unknown as ConfigService);
    const t = setup(signer);
    t.patientRepository.findOne.mockResolvedValue(patient);
    const first = image('a.png');
    const second = { ...image('b.png'), buffer: Buffer.from([1]) };
    const predictions = [first, second].map((file, index) => {
      const analysis = signer.signAnalysis(file.buffer, {
        prediction_key: index === 0 ? 'NUCLEAR' : 'MITOTIC',
        confidence_percentage: 90 - index,
        classification_level: 'general',
      });
      return {
        prediction: analysis.prediction_key as PredictionClass,
        confidencePercentage: analysis.confidence_percentage as number,
        classificationLevel: 'general',
        signature: analysis.signature,
        dilution: Dilution.DILUTION_80,
      };
    });
    const dto = {
      patientId: 1,
      predictions,
    } as unknown as CreateBatchResultsWithCorrectionsDto;

    await expect(
      t.service.createBatchWithFiles(dto, [second, first], 42),
    ).rejects.toThrow(INVALID);
    expect(t.files.savePredictionImages).not.toHaveBeenCalled();

    await expect(
      t.service.createBatchWithFiles(dto, [first, second], 42),
    ).resolves.toMatchObject({ status: ResultStatus.PENDING });
  });
});
