import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PatientsService } from './patients.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { Patient } from '../../entities/patients/patient.entity';
import { DocumentType, Gender } from '../../entities/patients/patient.types';
import { EntityType } from '../../entities/traceabilities/traceability.types';

const storedPatient = () => ({
  patientId: 3,
  fullName: 'John Roe',
  documentType: DocumentType.NATIONAL_ID,
  documentNumber: '900100200',
  gender: Gender.M,
  birthDate: new Date('1980-01-01'),
  phonePrefix: '+1',
  phoneNumber: '5550100',
  email: 'john.roe@example.com',
});

function setup() {
  const patientRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: object) => ({ ...data })),
    save: jest.fn((entity: object) =>
      Promise.resolve({ patientId: 3, ...entity }),
    ),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
  };
  const traceability = {
    logCreate: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
    logUpdate: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
    logDelete: jest.fn<Promise<void>, unknown[]>(() => Promise.resolve()),
  };
  const service = new PatientsService(
    patientRepository as unknown as Repository<Patient>,
    traceability as unknown as TraceabilityService,
  );
  return { service, patientRepository, traceability };
}

const createDto = {
  fullName: 'John Roe',
  documentType: DocumentType.NATIONAL_ID,
  documentNumber: '900100200',
  gender: Gender.M,
  birthDate: '1980-01-01',
  phonePrefix: '+1',
  phoneNumber: '5550100',
};

let loggerError: jest.SpyInstance;

beforeEach(() => {
  loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('PatientsService', () => {
  it('creates a patient and audits it', async () => {
    const { service, patientRepository, traceability } = setup();
    patientRepository.findOne.mockResolvedValue(null);

    const created = await service.create(createDto, 42);

    expect(created).toMatchObject({
      patientId: 3,
      documentNumber: '900100200',
    });
    expect(traceability.logCreate).toHaveBeenCalledWith(
      EntityType.PATIENT,
      3,
      42,
      expect.objectContaining({ fullName: 'John Roe' }),
    );
  });

  it('rejects a duplicate document with 409', async () => {
    const { service, patientRepository } = setup();
    patientRepository.findOne.mockResolvedValue(storedPatient());

    await expect(service.create(createDto, 42)).rejects.toThrow(
      new ConflictException(
        'A patient with document NATIONAL_ID 900100200 already exists.',
      ),
    );
    expect(patientRepository.save).not.toHaveBeenCalled();
  });

  it('rejects moving a patient onto another patient document with 409', async () => {
    const { service, patientRepository } = setup();
    patientRepository.findOne
      .mockResolvedValueOnce(storedPatient())
      .mockResolvedValueOnce({
        ...storedPatient(),
        patientId: 8,
        documentNumber: '111',
      });

    await expect(
      service.update(3, { documentNumber: '111' }, 42),
    ).rejects.toThrow(ConflictException);
    expect(patientRepository.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a patient that still has results (409, nothing logged)', async () => {
    const { service, patientRepository, traceability } = setup();
    patientRepository.findOne.mockResolvedValue(storedPatient());
    const driverError = Object.assign(new Error('REFERENCE constraint'), {
      number: 547,
    });
    patientRepository.delete.mockRejectedValue(
      new QueryFailedError('DELETE ...', [], driverError),
    );

    await expect(service.remove(3, 42)).rejects.toThrow(
      new ConflictException(
        'The patient has analysis results and cannot be deleted.',
      ),
    );
    expect(traceability.logDelete).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown patient without logging an error', async () => {
    const { service, patientRepository } = setup();
    patientRepository.findOne.mockResolvedValue(null);

    await expect(service.remove(9, 42)).rejects.toThrow(
      new NotFoundException('Patient with ID 9 not found.'),
    );
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('maps database failures to a generic 500 and logs the cause', async () => {
    const { service, patientRepository } = setup();
    patientRepository.findAndCount.mockRejectedValue(new Error('timeout'));

    await expect(service.findAllPaginated(1, 10)).rejects.toThrow(
      new InternalServerErrorException('Unexpected error.'),
    );
    expect(loggerError).toHaveBeenCalled();
  });
});
