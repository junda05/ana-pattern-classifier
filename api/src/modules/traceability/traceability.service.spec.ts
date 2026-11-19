import { Logger, NotFoundException } from '@nestjs/common';
import { MssqlParameter, Repository } from 'typeorm';
import { TraceabilityService } from './traceability.service';
import { Traceability } from '../../entities/traceabilities/traceability.entity';
import { User } from '../../entities/users/users.entity';
import { Patient } from '../../entities/patients/patient.entity';
import { Result } from '../../entities/results/result.entity';
import { Prediction } from '../../entities/predictions/prediction.entity';
import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';
import {
  PredictionClass,
  ResultStatus,
} from '../../entities/results/result.types';
import { UserRole } from '../../entities/users/user.types';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function queryBuilder(rows: unknown[]): object {
  const qb: object = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property === 'getMany') return jest.fn(() => Promise.resolve(rows));
        if (property === 'then') return undefined;
        return () => qb;
      },
    },
  );
  return qb;
}

/** Query builder double for the paginated list: records every call. */
function listQueryBuilder(rows: unknown[], total: number) {
  const calls: Array<[string, unknown[]]> = [];
  const qb: object = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property === 'getManyAndCount') {
          return jest.fn(() => Promise.resolve([rows, total]));
        }
        if (property === 'then') return undefined;
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

const admin = {
  userId: 1,
  username: 'admin',
  fullName: 'Alex Admin',
  role: UserRole.ADMIN,
  email: 'admin@example.com',
};
const patient = {
  patientId: 3,
  fullName: 'John Roe',
  documentType: 'NATIONAL_ID',
  documentNumber: '900100200',
  gender: 'M',
  birthDate: new Date('1980-01-01'),
  email: 'john.roe@example.com',
  phonePrefix: '+1',
  phoneNumber: '5550100',
};

function setup() {
  const traceabilityRepository = {
    create: jest.fn((data: object) => ({ ...data })),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const userRepository = { findOne: jest.fn() };
  const patientRepository = { findOne: jest.fn() };
  const resultRepository = { findOne: jest.fn() };
  const predictionRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder([])),
  };

  const service = new TraceabilityService(
    traceabilityRepository as unknown as Repository<Traceability>,
    userRepository as unknown as Repository<User>,
    patientRepository as unknown as Repository<Patient>,
    resultRepository as unknown as Repository<Result>,
    predictionRepository as unknown as Repository<Prediction>,
  );
  return {
    service,
    traceabilityRepository,
    userRepository,
    patientRepository,
    resultRepository,
    predictionRepository,
  };
}

function trace(overrides: Record<string, unknown>) {
  return {
    traceabilityId: 9,
    dateAndHour: new Date('2026-09-24T10:00:00Z'),
    activityType: ActivityType.CREATE,
    entityType: EntityType.USER,
    entityId: 1,
    userId: 1,
    user: admin,
    fieldChanged: undefined,
    previousValue: undefined,
    newValue: undefined,
    ...overrides,
  };
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let consoleSpy: jest.SpyInstance;

beforeEach(() => {
  errorSpy = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  warnSpy = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

describe('TraceabilityService logging', () => {
  it('records system actions with a null user', async () => {
    const { service, traceabilityRepository } = setup();

    await service.logCreate(EntityType.USER, 1, null, { username: 'admin' });

    expect(traceabilityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: ActivityType.CREATE,
        entityId: 1,
        userId: null,
      }),
    );
  });

  it('strips sensitive fields from stored snapshots', async () => {
    const { service, traceabilityRepository } = setup();

    await service.logCreate(EntityType.USER, 2, 1, {
      username: 'jdoe',
      password: 'secret-hash',
      token: 'abc',
      refreshToken: 'def',
    });

    const [entry] = traceabilityRepository.save.mock.calls[0] as [
      { newValue: string },
    ];
    const stored: unknown = JSON.parse(entry.newValue);
    expect(stored).toEqual({ username: 'jdoe' });
  });

  it('logs one UPDATE entry per changed field and ignores unchanged and sensitive fields', async () => {
    const { service, traceabilityRepository } = setup();

    await service.logUpdate(
      EntityType.USER,
      2,
      1,
      {
        fullName: 'Jane Doe',
        email: 'jdoe@example.com',
        isActive: true,
        password: 'old',
      },
      {
        fullName: 'Jane Q. Doe',
        email: 'jdoe@example.com',
        isActive: false,
        password: 'new',
      },
    );

    const [entries] = traceabilityRepository.save.mock.calls[0];
    expect(entries).toEqual([
      expect.objectContaining({
        fieldChanged: 'fullName',
        previousValue: 'Jane Doe',
        newValue: 'Jane Q. Doe',
        userId: 1,
      }),
      expect.objectContaining({
        fieldChanged: 'isActive',
        previousValue: 'true',
        newValue: 'false',
      }),
    ]);
  });

  it('records a field cleared to null and skips fields that were not sent', async () => {
    const { service, traceabilityRepository } = setup();

    await service.logUpdate(
      EntityType.RESULT,
      5,
      1,
      { observations: 'First pass', status: 'PENDING' },
      { observations: null, status: undefined },
    );

    const [entries] = traceabilityRepository.save.mock.calls[0];
    expect(entries).toEqual([
      expect.objectContaining({
        fieldChanged: 'observations',
        previousValue: 'First pass',
        newValue: '',
      }),
    ]);
  });

  it('writes nothing when no field changed', async () => {
    const { service, traceabilityRepository } = setup();

    await service.logUpdate(
      EntityType.PATIENT,
      3,
      1,
      { fullName: 'John Roe' },
      { fullName: 'John Roe' },
    );

    expect(traceabilityRepository.save).not.toHaveBeenCalled();
  });

  it('never breaks the main operation and reports failures through the Nest logger', async () => {
    const { service, traceabilityRepository } = setup();
    traceabilityRepository.save.mockRejectedValueOnce(
      new Error('FK violation'),
    );

    await expect(
      service.logCreate(EntityType.RESULT, 5, 1, {}),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

describe('TraceabilityService.findAllPaginated', () => {
  it('labels system actions as "System" and keeps role codes for users', async () => {
    const { service, traceabilityRepository } = setup();
    traceabilityRepository.createQueryBuilder.mockReturnValue(
      listQueryBuilder(
        [
          trace({ traceabilityId: 1, userId: null, user: null }),
          trace({ traceabilityId: 2 }),
        ],
        2,
      ).qb,
    );

    const page = await service.findAllPaginated(1, 10);

    expect(page.data).toEqual([
      expect.objectContaining({
        traceabilityId: 1,
        userFullName: 'System',
        userRole: null,
        activityType: 'CREATE',
      }),
      expect.objectContaining({
        traceabilityId: 2,
        userFullName: 'Alex Admin',
        userRole: UserRole.ADMIN,
      }),
    ]);
    expect(page).toMatchObject({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  it('exposes the raw entity type code of each record', async () => {
    const { service, traceabilityRepository } = setup();
    traceabilityRepository.createQueryBuilder.mockReturnValue(
      listQueryBuilder(
        [
          trace({ traceabilityId: 1, entityType: EntityType.PATIENT }),
          trace({ traceabilityId: 2, entityType: EntityType.CORRECTION }),
        ],
        2,
      ).qb,
    );

    const page = await service.findAllPaginated(1, 10);

    expect(
      page.data.map(({ traceabilityId, activityType, entityType }) => ({
        traceabilityId,
        activityType,
        entityType,
      })),
    ).toEqual([
      {
        traceabilityId: 1,
        activityType: ActivityType.CREATE,
        entityType: EntityType.PATIENT,
      },
      {
        traceabilityId: 2,
        activityType: ActivityType.CREATE,
        entityType: EntityType.CORRECTION,
      },
    ]);
  });
});

describe('TraceabilityService.findAllPaginated filters', () => {
  function list(
    filters: Parameters<TraceabilityService['findAllPaginated']>[2],
  ) {
    const t = setup();
    const builder = listQueryBuilder([], 0);
    t.traceabilityRepository.createQueryBuilder.mockReturnValue(builder.qb);
    return { run: () => t.service.findAllPaginated(3, 25, filters), builder };
  }

  it('filters by [from, to), actor name (contains, LIKE-escaped) and activity type', async () => {
    const { run, builder } = list({
      from: '2026-09-24T05:00:00.000Z',
      to: '2026-09-25T05:00:00.000Z',
      userName: '  Doe_J ',
      activityType: ActivityType.UPDATE,
    });

    const page = await run();

    expect(builder.conditions()).toEqual([
      [
        'trace.dateAndHour >= :from',
        {
          from: new MssqlParameter(
            new Date('2026-09-24T05:00:00.000Z'),
            'datetime2',
          ),
        },
      ],
      [
        'trace.dateAndHour < :to',
        {
          to: new MssqlParameter(
            new Date('2026-09-25T05:00:00.000Z'),
            'datetime2',
          ),
        },
      ],
      ['LOWER(user.fullName) LIKE :userName', { userName: '%doe[_]j%' }],
      ['trace.activityType = :activityType', { activityType: 'UPDATE' }],
    ]);
    expect(builder.calls).toEqual(
      expect.arrayContaining([
        ['leftJoinAndSelect', ['trace.user', 'user']],
        ['orderBy', ['trace.dateAndHour', 'DESC']],
        ['addOrderBy', ['trace.traceabilityId', 'DESC']],
        ['skip', [50]],
        ['take', [25]],
      ]),
    );
    expect(page).toMatchObject({ total: 0, page: 3, limit: 25, totalPages: 0 });
  });

  it('applies no condition without filters (and ignores a blank user name)', async () => {
    const { run, builder } = list({ userName: '   ' });

    await run();

    expect(builder.conditions()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

describe('TraceabilityService.findById', () => {
  it('returns 404 with a complete sentence for an unknown record', async () => {
    const { service, traceabilityRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(null);

    await expect(service.findById(77)).rejects.toThrow(
      new NotFoundException('Audit record with ID 77 not found.'),
    );
  });

  it('labels the actor of a system action as "System"', async () => {
    const { service, traceabilityRepository, userRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        userId: null,
        user: null,
        newValue: JSON.stringify({ username: 'admin', role: 'ADMIN' }),
      }),
    );
    userRepository.findOne.mockResolvedValue(admin);

    const detail = await service.findById(9);

    expect(detail.userInfo).toEqual({
      userId: null,
      username: null,
      fullName: 'System',
      role: null,
      email: null,
    });
    expect(detail.affectedUserInfo).toMatchObject({
      userId: 1,
      username: 'admin',
    });
  });

  it('reads plain per-field values such as "VERIFIED" without logging errors', async () => {
    const { service, traceabilityRepository, resultRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        activityType: ActivityType.UPDATE,
        entityType: EntityType.RESULT,
        entityId: 5,
        fieldChanged: 'status',
        previousValue: 'CORRECTED',
        newValue: 'VERIFIED',
      }),
    );
    resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      status: ResultStatus.VERIFIED,
      dateAndHour: new Date('2026-09-20T08:00:00Z'),
      patient,
      predictions: [
        {
          predictionId: 10,
          prediction: PredictionClass.NUCLEAR,
          confidencePercentage: 90,
          imagePath: 'a.png',
          dilution: '80',
          corrections: [],
        },
      ],
    });

    const detail = await service.findById(9);

    expect(detail.fieldChanges).toEqual([
      {
        fieldName: 'status',
        fieldLabel: 'Status',
        previousValue: 'CORRECTED',
        newValue: 'VERIFIED',
      },
    ]);
    expect(detail.resultInfo).toMatchObject({
      resultId: 5,
      predictionsCount: 1,
      newPredictionsAdded: 0,
    });
    expect(detail.patientInfo).toMatchObject({
      patientId: 3,
      fullName: 'John Roe',
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('shows the details of password-reset records', async () => {
    const { service, traceabilityRepository, userRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        activityType: ActivityType.PASSWORD_RESET_REQUEST,
        fieldChanged: 'password_reset_request',
        newValue: 'Password reset requested',
      }),
    );
    userRepository.findOne.mockResolvedValue(admin);

    const detail = await service.findById(9);

    expect(detail.fieldChanges).toEqual([
      {
        fieldName: 'password_reset_request',
        fieldLabel: 'Password reset request',
        previousValue: '',
        newValue: 'Password reset requested',
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('attaches the latest correction by date to the predictions of a result CREATE record', async () => {
    const {
      service,
      traceabilityRepository,
      resultRepository,
      predictionRepository,
    } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        entityType: EntityType.RESULT,
        entityId: 5,
        newValue: JSON.stringify({
          status: 'PENDING',
          predictionsCount: 1,
          predictions: [
            {
              predictionId: 10,
              prediction: 'NUCLEAR',
              confidencePercentage: 90,
              imagePath: 'a b.png',
              imageUrl: 'http://old:3000/x',
              dilution: '80',
            },
          ],
          patientId: 3,
        }),
      }),
    );
    resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      status: ResultStatus.CORRECTED,
      patient,
    });
    predictionRepository.createQueryBuilder.mockReturnValue(
      queryBuilder([
        {
          predictionId: 10,
          corrections: [
            {
              correctedResultId: 2,
              correctedPrediction: 'NUCLEAR_SPECKLED',
              correctedDate: new Date('2026-09-21'),
            },
            {
              correctedResultId: 1,
              correctedPrediction: 'NUCLEAR_CENTROMERE',
              correctedDate: new Date('2026-09-22'),
            },
          ],
        },
      ]),
    );

    const detail = await service.findById(9);

    const [prediction] = detail.resultInfo!.predictions!;
    expect(prediction.correction?.correctedPrediction).toBe(
      'NUCLEAR_CENTROMERE',
    );
    // Image URLs are rebuilt with the current base URL
    expect(prediction.imageUrl).toMatch(
      /\/api\/v1\/files\/predictions\/a%20b\.png$/,
    );
    expect(detail.fieldChanges.map((change) => change.fieldName)).toEqual([
      'status',
      'predictionsCount',
    ]);
  });

  it('shows the corrections of an append record in the predictions, not as a field change', async () => {
    const { service, traceabilityRepository, resultRepository } = setup();
    resultRepository.findOne.mockResolvedValue({
      resultId: 5,
      status: 'CORRECTED',
      dateAndHour: new Date('2026-09-24T09:00:00Z'),
      patient,
    });
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        activityType: ActivityType.UPDATE,
        entityType: EntityType.RESULT,
        entityId: 5,
        previousValue: JSON.stringify({
          status: 'PENDING',
          predictionsCount: 1,
        }),
        newValue: JSON.stringify({
          status: 'CORRECTED',
          predictionsCount: 1,
          correctionsCount: 1,
          corrections: [
            {
              predictionId: 10,
              originalPrediction: 'NUCLEAR',
              correctedPrediction: 'NUCLEOLAR',
            },
          ],
          predictions: [],
        }),
      }),
    );

    const detail = await service.findById(9);

    expect(detail.fieldChanges.map((change) => change.fieldName)).toEqual([
      'status',
      'correctionsCount',
    ]);
  });

  it('lists the result status change of a correction batch once', async () => {
    const { service, traceabilityRepository, predictionRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({
        entityType: EntityType.CORRECTION,
        entityId: 5,
        newValue: JSON.stringify({
          resultId: 5,
          resultStatus: 'CORRECTED',
          previousResultStatus: 'PENDING',
          correctionsCount: 1,
          patientId: 3,
          patientFullName: 'John Roe',
          corrections: [
            {
              predictionId: 10,
              originalPrediction: 'NUCLEAR',
              correctedPrediction: 'NUCLEAR_SPECKLED',
              imagePath: 'a.png',
            },
          ],
        }),
      }),
    );
    predictionRepository.createQueryBuilder.mockReturnValue(
      queryBuilder([
        {
          predictionId: 10,
          prediction: 'NUCLEAR',
          confidencePercentage: 90,
          imagePath: 'a.png',
          dilution: '80',
        },
      ]),
    );

    const detail = await service.findById(9);

    expect(
      detail.fieldChanges.filter(
        (change) => change.fieldName === 'resultStatus',
      ),
    ).toEqual([
      {
        fieldName: 'resultStatus',
        fieldLabel: 'Result status',
        previousValue: 'PENDING',
        newValue: 'CORRECTED',
      },
    ]);
    expect(detail.resultInfo).toMatchObject({
      resultId: 5,
      predictionsCount: 1,
    });
    expect(detail.resultInfo!.predictions![0].correction).toEqual({
      correctedPrediction: 'NUCLEAR_SPECKLED',
      observations: undefined,
    });
    expect(detail.patientInfo).toMatchObject({
      patientId: 3,
      fullName: 'John Roe',
    });
  });

  it('warns (without failing) when a stored JSON object is malformed', async () => {
    const { service, traceabilityRepository, userRepository } = setup();
    traceabilityRepository.findOne.mockResolvedValue(
      trace({ newValue: '{"username":' }),
    );
    userRepository.findOne.mockResolvedValue(admin);

    const detail = await service.findById(9);

    expect(detail.fieldChanges).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});
