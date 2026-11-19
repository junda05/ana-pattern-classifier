import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindManyOptions, getMetadataArgsStorage, Repository } from 'typeorm';
import { PasswordService } from '../auth/password.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { UsersService } from './users.service';
import { User } from '../../entities/users/users.entity';
import { UserRole } from '../../entities/users/user.types';
import { EntityType } from '../../entities/traceabilities/traceability.types';

const storedUser = () => ({
  userId: 2,
  username: 'jdoe',
  password: 'hashed-secret',
  fullName: 'Jane Doe',
  email: 'jdoe@example.com',
  professionalCard: 'LIC-12345',
  role: UserRole.STANDARD,
  isActive: true,
  dateJoined: new Date('2026-09-01T00:00:00Z'),
  lastLogin: undefined,
});

function setup() {
  const userRepository = {
    findAndCount: jest.fn<
      Promise<[unknown[], number]>,
      [FindManyOptions<User>]
    >(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: object) => ({ ...data })),
    save: jest.fn((entity: object) =>
      Promise.resolve({
        userId: 2,
        isActive: true,
        dateJoined: new Date(),
        ...entity,
      }),
    ),
  };
  const passwordService = {
    hashPassword: jest.fn(() => Promise.resolve('hashed-secret')),
  };
  const traceability = {
    logCreate: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
    logUpdate: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
  };
  const service = new UsersService(
    userRepository as unknown as Repository<User>,
    passwordService as unknown as PasswordService,
    traceability as unknown as TraceabilityService,
  );
  return { service, userRepository, passwordService, traceability };
}

let loggerError: jest.SpyInstance;

beforeEach(() => {
  loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('User entity', () => {
  it('stores emails up to 100 characters, matching the DTO validation', () => {
    const email = getMetadataArgsStorage().columns.find(
      (column) => column.target === User && column.propertyName === 'email',
    );
    expect(email?.options.length).toBe(100);
  });
});

describe('UsersService', () => {
  describe('setPassword', () => {
    it('stores the new hash and when it changed, without an audit UPDATE record', async () => {
      const { service, userRepository, traceability } = setup();
      userRepository.findOne.mockResolvedValue(storedUser());
      const changedAt = new Date('2026-09-24T12:00:00.123Z');

      await service.setPassword(2, 'new-hash', changedAt);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          password: 'new-hash',
          passwordChangedAt: changedAt,
        }),
      );
      expect(traceability.logUpdate).not.toHaveBeenCalled();
    });

    it('rejects an unknown user with 404', async () => {
      const { service, userRepository } = setup();
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.setPassword(99, 'new-hash', new Date()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  it('lists users with their active status and join date', async () => {
    const { service, userRepository } = setup();
    userRepository.findAndCount.mockResolvedValue([[storedUser()], 1]);

    const page = await service.findAllPaginated(1, 10);

    expect(page.data).toEqual([
      {
        userId: 2,
        username: 'jdoe',
        fullName: 'Jane Doe',
        email: 'jdoe@example.com',
        role: UserRole.STANDARD,
        isActive: true,
        dateJoined: new Date('2026-09-01T00:00:00Z'),
        lastLogin: undefined,
      },
    ]);
    expect(userRepository.findAndCount.mock.calls[0][0].select).toMatchObject({
      isActive: true,
      dateJoined: true,
    });
  });

  it('records a user created by the seed script as a system action', async () => {
    const { service, userRepository, traceability } = setup();
    userRepository.findOne.mockResolvedValue(null);

    const created = await service.create(
      {
        username: 'admin',
        fullName: 'System Administrator',
        email: 'admin@example.com',
        password: 'long-enough-password',
        professionalCard: 'ADMIN-0001',
        role: UserRole.ADMIN,
      },
      null,
    );

    expect(created).not.toHaveProperty('password');
    expect(traceability.logCreate).toHaveBeenCalledWith(
      EntityType.USER,
      2,
      null,
      expect.not.objectContaining({ password: expect.anything() as unknown }),
    );
  });

  it('rejects a duplicate username with 409', async () => {
    const { service, userRepository } = setup();
    userRepository.findOne.mockResolvedValueOnce(storedUser());

    await expect(
      service.create(
        {
          username: 'jdoe',
          fullName: 'X',
          email: 'x@example.com',
          password: 'long-enough',
          professionalCard: 'L',
        },
        1,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('deactivates a user and audits the real previous status', async () => {
    const { service, userRepository, traceability } = setup();
    userRepository.findOne.mockResolvedValue(storedUser());

    const updated = await service.softDelete(2, 1);

    expect(updated.isActive).toBe(false);
    expect(traceability.logUpdate).toHaveBeenCalledWith(
      EntityType.USER,
      2,
      1,
      { isActive: true },
      { isActive: false },
    );
  });

  it('audits no change when deactivating an inactive user', async () => {
    const { service, userRepository, traceability } = setup();
    userRepository.findOne.mockResolvedValue({
      ...storedUser(),
      isActive: false,
    });

    await service.softDelete(2, 1);

    expect(traceability.logUpdate).toHaveBeenCalledWith(
      EntityType.USER,
      2,
      1,
      { isActive: false },
      { isActive: false },
    );
  });

  it('returns 404 for an unknown user without logging an error', async () => {
    const { service, userRepository } = setup();
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.softDelete(9, 1)).rejects.toThrow(
      new NotFoundException('User with ID 9 not found.'),
    );
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('maps database failures to a generic 500 and logs the cause', async () => {
    const { service, userRepository } = setup();
    userRepository.findAndCount.mockRejectedValue(new Error('connection lost'));

    await expect(service.findAllPaginated(1, 10)).rejects.toThrow(
      new InternalServerErrorException('Unexpected error.'),
    );
    expect(loggerError).toHaveBeenCalled();
  });
});
