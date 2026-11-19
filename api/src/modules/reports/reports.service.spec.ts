import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { Result } from '../../entities/results/result.entity';
import { User } from '../../entities/users/users.entity';
import { Traceability } from '../../entities/traceabilities/traceability.entity';
import {
  PredictionClass,
  ResultStatus,
} from '../../entities/results/result.types';
import { Dilution } from '../../entities/predictions/prediction.types';
import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';

// ---------------------------------------------------------------------------
// Test doubles and fixtures
// ---------------------------------------------------------------------------

type Terminal = 'getMany' | 'getCount';

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
  return { qb, calls };
}

const users: Record<number, object> = {
  1: {
    userId: 1,
    fullName: 'Alex Admin',
    professionalCard: 'LIC-0001',
    email: 'admin@example.com',
    username: 'admin',
  },
  2: {
    userId: 2,
    fullName: 'Jane Doe',
    professionalCard: 'LIC-12345',
    email: 'jdoe@example.com',
    username: 'jdoe',
  },
  3: {
    userId: 3,
    fullName: 'Sam Roe',
    professionalCard: 'LIC-777',
    email: 'sroe@example.com',
    username: 'sroe',
  },
};

const at = (iso: string) => new Date(iso);
const CREATED = at('2026-09-20T08:00:00Z');

function prediction(
  id: number,
  predicted: PredictionClass,
  corrections: object[] = [],
) {
  return {
    predictionId: id,
    prediction: predicted,
    confidencePercentage: 80 + id,
    imagePath: `img-${id}.png`,
    dilution: Dilution.DILUTION_160,
    corrections,
  };
}

function correction(
  id: number,
  corrected: PredictionClass,
  correctedBy: number,
  iso: string,
) {
  return {
    correctedResultId: id,
    correctedPrediction: corrected,
    correctedBy,
    correctedDate: at(iso),
    observations: undefined,
  };
}

function resultRow(overrides: Record<string, unknown>) {
  return {
    resultId: 5,
    dateAndHour: CREATED,
    observations: 'Routine screening',
    status: ResultStatus.CORRECTED,
    userId: 2,
    verifiedBy: null,
    verifiedAt: null,
    patient: {
      patientId: 1,
      fullName: 'John Roe',
      documentType: 'NATIONAL_ID',
      documentNumber: '900100200',
      gender: 'M',
      birthDate: at('1980-01-01'),
      phonePrefix: '+1',
      phoneNumber: '5550100',
      email: 'john.roe@example.com',
    },
    user: users[2],
    verifier: null,
    predictions: [],
    ...overrides,
  };
}

function setup(row: object | null, latestUpdateAudit: object | null = null) {
  const resultRepository = {
    findOne: jest.fn(() => Promise.resolve(row)),
    createQueryBuilder: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(({ where }: { where: { userId: number } }) =>
      Promise.resolve(users[where.userId] ?? null),
    ),
  };
  const traceabilityRepository = {
    findOne: jest.fn<Promise<object | null>, unknown[]>(() =>
      Promise.resolve(latestUpdateAudit),
    ),
  };
  const service = new ReportsService(
    resultRepository as unknown as Repository<Result>,
    userRepository as unknown as Repository<User>,
    traceabilityRepository as unknown as Repository<Traceability>,
  );
  return { service, resultRepository, userRepository, traceabilityRepository };
}

const finalPatterns = (report: {
  predictions: Array<{ predictionId: number; finalPattern: string }>;
}) => report.predictions.map((p) => [p.predictionId, p.finalPattern]);

// ---------------------------------------------------------------------------
// Report detail
// ---------------------------------------------------------------------------

describe('ReportsService.getReportById', () => {
  describe('predictions and final pattern', () => {
    it('lists every prediction of a corrected result (3 images, 1 correction)', async () => {
      const { service } = setup(
        resultRow({
          predictions: [
            prediction(12, PredictionClass.NUCLEAR_SPECKLED),
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_HOMOGENEOUS,
                2,
                '2026-09-20T09:00:00Z',
              ),
            ]),
            prediction(11, PredictionClass.CYTOPLASMIC),
          ],
        }),
      );

      const report = await service.getReportById(5);

      expect(finalPatterns(report)).toEqual([
        [10, PredictionClass.NUCLEAR_HOMOGENEOUS],
        [11, PredictionClass.CYTOPLASMIC],
        [12, PredictionClass.NUCLEAR_SPECKLED],
      ]);
      expect(report.predictions[0].correction).toMatchObject({
        correctedPrediction: PredictionClass.NUCLEAR_HOMOGENEOUS,
        correctedBy: 2,
      });
      expect(report.predictions[1].correction).toBeUndefined();
    });

    it('keeps the corrected original image after images were appended (append then correct)', async () => {
      const appendAudit = {
        activityType: ActivityType.UPDATE,
        dateAndHour: at('2026-09-20T10:00:00Z'),
        newValue: JSON.stringify({ newPredictionsAdded: 2 }),
      };
      const { service } = setup(
        resultRow({
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_CENTROMERE,
                2,
                '2026-09-20T11:00:00Z',
              ),
            ]),
            prediction(20, PredictionClass.NUCLEAR_SPECKLED),
            prediction(21, PredictionClass.NUCLEOLAR),
          ],
        }),
        appendAudit,
      );

      const report = await service.getReportById(5);

      expect(finalPatterns(report)).toEqual([
        [10, PredictionClass.NUCLEAR_CENTROMERE],
        [20, PredictionClass.NUCLEAR_SPECKLED],
        [21, PredictionClass.NUCLEOLAR],
      ]);
    });

    it('uses the model prediction when there are no corrections', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          verifiedBy: 2,
          verifiedAt: at('2026-09-20T09:00:00Z'),
          verifier: users[2],
          predictions: [
            prediction(10, PredictionClass.NUCLEAR),
            prediction(11, PredictionClass.MITOTIC),
          ],
        }),
      );

      const report = await service.getReportById(5);

      expect(finalPatterns(report)).toEqual([
        [10, PredictionClass.NUCLEAR],
        [11, PredictionClass.MITOTIC],
      ]);
      expect(report.predictions[0].imageUrl).toMatch(
        /\/api\/v1\/files\/predictions\/img-10\.png$/,
      );
    });

    it('takes the newest correction by date, whatever the relation order', async () => {
      const { service } = setup(
        resultRow({
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                7,
                PredictionClass.NUCLEAR_SPECKLED,
                2,
                '2026-09-20T09:00:00Z',
              ),
              correction(
                6,
                PredictionClass.NUCLEAR_CENTROMERE,
                3,
                '2026-09-21T09:00:00Z',
              ),
              correction(
                8,
                PredictionClass.NUCLEAR_HOMOGENEOUS,
                2,
                '2026-09-20T12:00:00Z',
              ),
            ]),
          ],
        }),
      );

      const report = await service.getReportById(5);

      expect(report.predictions[0].finalPattern).toBe(
        PredictionClass.NUCLEAR_CENTROMERE,
      );
      expect(report.predictions[0].correction?.correctedResultId).toBe(6);
    });
  });

  describe('responsible physician (medic)', () => {
    it('is the verifier of a result that was only verified', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          userId: 2,
          verifiedBy: 1,
          verifiedAt: at('2026-09-20T09:00:00Z'),
          verifier: users[1],
          predictions: [prediction(10, PredictionClass.NUCLEAR)],
        }),
      );

      const report = await service.getReportById(5);

      expect(report.medic).toEqual(users[1]);
      expect(report.verifiedBy).toEqual({ userId: 1, fullName: 'Alex Admin' });
      expect(report.verifiedAt).toEqual(at('2026-09-20T09:00:00Z'));
    });

    it('is the later verifier when a corrected result is verified by another user', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          verifiedBy: 1,
          verifiedAt: at('2026-09-20T12:00:00Z'),
          verifier: users[1],
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_SPECKLED,
                3,
                '2026-09-20T10:00:00Z',
              ),
            ]),
          ],
        }),
      );

      expect((await service.getReportById(5)).medic.userId).toBe(1);
    });

    it('is the corrector when an administrator corrects after the verification', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.CORRECTED,
          verifiedBy: 2,
          verifiedAt: at('2026-09-20T10:00:00Z'),
          verifier: users[2],
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_SPECKLED,
                1,
                '2026-09-20T12:00:00Z',
              ),
            ]),
          ],
        }),
      );

      expect((await service.getReportById(5)).medic.userId).toBe(1);
    });

    it('falls back to the creator without corrections or a recorded verification', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          userId: 2,
          predictions: [prediction(10, PredictionClass.NUCLEAR)],
        }),
      );

      const report = await service.getReportById(5);

      expect(report.medic.userId).toBe(2);
      expect(report.verifiedBy).toBeNull();
      expect(report.verifiedAt).toBeNull();
    });
  });

  describe('lastModifiedAt', () => {
    it('is the creation date when nothing happened afterwards', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          predictions: [prediction(10, PredictionClass.NUCLEAR)],
        }),
      );

      const report = await service.getReportById(5);

      expect(report.createdAt).toEqual(CREATED);
      expect(report.lastModifiedAt).toEqual(CREATED);
    });

    it('includes the corrections of a result that was verified afterwards', async () => {
      const { service } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_SPECKLED,
                2,
                '2026-09-21T10:00:00Z',
              ),
            ]),
          ],
        }),
      );

      expect((await service.getReportById(5)).lastModifiedAt).toEqual(
        at('2026-09-21T10:00:00Z'),
      );
    });

    it('is the latest audited update of the result (e.g. the status change to VERIFIED)', async () => {
      const statusChange = {
        activityType: ActivityType.UPDATE,
        fieldChanged: 'status',
        previousValue: 'CORRECTED',
        newValue: 'VERIFIED',
        dateAndHour: at('2026-09-22T15:00:00Z'),
      };
      const { service, traceabilityRepository } = setup(
        resultRow({
          status: ResultStatus.VERIFIED,
          verifiedBy: 1,
          verifiedAt: at('2026-09-22T14:59:59Z'),
          verifier: users[1],
          predictions: [
            prediction(10, PredictionClass.NUCLEAR, [
              correction(
                1,
                PredictionClass.NUCLEAR_SPECKLED,
                2,
                '2026-09-21T10:00:00Z',
              ),
            ]),
          ],
        }),
        statusChange,
      );

      const report = await service.getReportById(5);

      expect(report.lastModifiedAt).toEqual(at('2026-09-22T15:00:00Z'));
      expect(traceabilityRepository.findOne).toHaveBeenCalledWith({
        where: {
          entityType: EntityType.RESULT,
          entityId: 5,
          activityType: ActivityType.UPDATE,
        },
        order: { dateAndHour: 'DESC', traceabilityId: 'DESC' },
      });
    });
  });

  it('returns 404 for an unknown result', async () => {
    const { service } = setup(null);

    await expect(service.getReportById(5)).rejects.toThrow(
      new NotFoundException('Report with ID 5 not found.'),
    );
  });

  it('returns 404 for a result that is still PENDING', async () => {
    const { service } = setup(resultRow({ status: ResultStatus.PENDING }));

    await expect(service.getReportById(5)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('ReportsService.searchReports', () => {
  it.each([
    {},
    { patientName: '   ' },
    { patientName: '', patientDocument: ' ' },
  ])('rejects a search without criteria (%p) with 400', async (query) => {
    const { service, resultRepository } = setup(null);

    await expect(service.searchReports(query)).rejects.toThrow(
      new BadRequestException(
        'Provide at least one search criterion (patient name or document number).',
      ),
    );
    expect(resultRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('searches finalized results by document number and paginates', async () => {
    const { service, resultRepository } = setup(null);
    const builder = queryBuilder({
      getCount: 1,
      getMany: [resultRow({ status: ResultStatus.VERIFIED })],
    });
    resultRepository.createQueryBuilder.mockReturnValue(builder.qb);

    const page = await service.searchReports({
      patientDocument: ' 900100200 ',
      page: 1,
      limit: 10,
    });

    expect(page).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(page.data[0]).toMatchObject({
      resultId: 5,
      patientName: 'John Roe',
      patientDocument: '900100200',
    });
    expect(builder.calls).toContainEqual([
      'where',
      [
        'result.status IN (:...statuses)',
        { statuses: [ResultStatus.VERIFIED, ResultStatus.CORRECTED] },
      ],
    ]);
    expect(builder.calls).toContainEqual([
      'andWhere',
      [
        'patient.documentNumber = :patientDocument',
        { patientDocument: '900100200' },
      ],
    ]);
  });

  it('matches names partially and escapes LIKE wildcards', async () => {
    const { service, resultRepository } = setup(null);
    const builder = queryBuilder({ getCount: 0, getMany: [] });
    resultRepository.createQueryBuilder.mockReturnValue(builder.qb);

    await service.searchReports({ patientName: '50%_off' });

    expect(builder.calls).toContainEqual([
      'andWhere',
      ['patient.fullName LIKE :patientName', { patientName: '%50[%][_]off%' }],
    ]);
  });
});
