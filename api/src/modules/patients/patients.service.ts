/**
 * Core patient management service
 *
 * Main features:
 * - Patient CRUD (create, read, update, delete)
 * - Lookup by document
 * - Uniqueness checks on documentType + documentNumber
 * - Paginated listings
 *
 * Lookup methods:
 * - findAll(): lists all patients
 * - findAllPaginated(): paginated list of patients
 * - findById(): finds by ID, throwing if it does not exist
 * - findByDocument(): finds by document type and number
 *
 * CRUD methods:
 * - create(): creates a new patient
 * - update(): partially updates a patient
 * - remove(): permanently deletes a patient
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  isForeignKeyViolation,
  toHttpException,
} from '../../common/errors/http-errors';
import { Patient } from '../../entities/patients/patient.entity';
import { DocumentType } from '../../entities/patients/patient.types';
import { TraceabilityService } from '../traceability/traceability.service';
import { EntityType } from '../../entities/traceabilities/traceability.types';
import { CreatePatientDto } from '../../DTOs/patients/create-patient.dto';
import { UpdatePatientDto } from '../../DTOs/patients/update-patient.dto';
import { PatientListDto } from '../../DTOs/patients/patient-list.dto';
import { PatientDetailDto } from '../../DTOs/patients/patient-detail.dto';
import { PaginatedResponseDto } from '../../DTOs/patients/pagination-query.dto';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @Inject('PATIENT_REPOSITORY')
    private patientRepository: Repository<Patient>,
    private traceabilityService: TraceabilityService,
  ) {}

  /**
   * Lists all patients without pagination
   */
  async findAll(): Promise<Patient[]> {
    try {
      return await this.patientRepository.find({
        order: {
          patientId: 'DESC',
        },
      });
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error fetching all patients');
    }
  }

  /**
   * Lists patients with pagination
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<PatientListDto>> {
    try {
      // Clamp the pagination values
      const currentPage = Math.max(1, page);
      const itemsPerPage = Math.min(Math.max(1, limit), 100); // At most 100 items per page
      const skip = (currentPage - 1) * itemsPerPage;

      // Fetch the page of patients and the total count
      const [patients, total] = await this.patientRepository.findAndCount({
        skip,
        take: itemsPerPage,
        order: {
          patientId: 'DESC', // Newest first (by ID)
        },
      });

      const data: PatientListDto[] = patients.map((patient) => ({
        patientId: patient.patientId,
        fullName: patient.fullName,
        documentType: patient.documentType,
        documentNumber: patient.documentNumber,
        gender: patient.gender,
        birthDate: patient.birthDate,
        phonePrefix: patient.phonePrefix,
        phoneNumber: patient.phoneNumber,
        email: patient.email,
      }));

      return {
        data,
        total,
        page: currentPage,
        limit: itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
      };
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error fetching paginated patients',
      );
    }
  }

  /**
   * Finds a patient by ID
   */
  async findById(id: number): Promise<Patient> {
    try {
      const patient = await this.patientRepository.findOne({
        where: { patientId: id },
      });

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${id} not found.`);
      }

      return patient;
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding patient by ID');
    }
  }

  /**
   * Finds a patient by ID and returns the detailed DTO
   */
  async findByIdDetailed(id: number): Promise<PatientDetailDto> {
    try {
      const patient = await this.findById(id);

      return {
        patientId: patient.patientId,
        fullName: patient.fullName,
        documentType: patient.documentType,
        documentNumber: patient.documentNumber,
        gender: patient.gender,
        birthDate: patient.birthDate,
        phonePrefix: patient.phonePrefix,
        phoneNumber: patient.phoneNumber,
        email: patient.email,
      };
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error loading patient details',
      );
    }
  }

  /**
   * Finds a patient by document type and number
   */
  async findByDocument(
    documentType: DocumentType,
    documentNumber: string,
  ): Promise<Patient | null> {
    try {
      const patient = await this.patientRepository.findOne({
        where: { documentType, documentNumber },
      });

      return patient;
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error finding patient by document',
      );
    }
  }

  /**
   * Finds a patient by document type and number and returns the detailed DTO.
   * Throws NotFoundException if it does not exist.
   */
  async findByDocumentDetailed(
    documentType: DocumentType,
    documentNumber: string,
  ): Promise<PatientDetailDto> {
    try {
      const patient = await this.findByDocument(documentType, documentNumber);

      if (!patient) {
        throw new NotFoundException(
          `Patient with document ${documentType} ${documentNumber} not found.`,
        );
      }

      return {
        patientId: patient.patientId,
        fullName: patient.fullName,
        documentType: patient.documentType,
        documentNumber: patient.documentNumber,
        gender: patient.gender,
        birthDate: patient.birthDate,
        phonePrefix: patient.phonePrefix,
        phoneNumber: patient.phoneNumber,
        email: patient.email,
      };
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error finding patient by document',
      );
    }
  }

  /**
   * Creates a new patient
   */
  async create(
    createPatientDto: CreatePatientDto,
    createdByUserId: number,
  ): Promise<PatientDetailDto> {
    try {
      // The document must be unique
      const existingPatient = await this.findByDocument(
        createPatientDto.documentType,
        createPatientDto.documentNumber,
      );

      if (existingPatient) {
        throw new ConflictException(
          `A patient with document ${createPatientDto.documentType} ${createPatientDto.documentNumber} already exists.`,
        );
      }

      const newPatient = this.patientRepository.create(createPatientDto);
      const savedPatient = await this.patientRepository.save(newPatient);

      // Record the full patient data in the audit trail
      await this.traceabilityService.logCreate(
        EntityType.PATIENT,
        savedPatient.patientId,
        createdByUserId,
        {
          fullName: savedPatient.fullName,
          documentType: savedPatient.documentType,
          documentNumber: savedPatient.documentNumber,
          gender: savedPatient.gender,
          birthDate: savedPatient.birthDate,
          email: savedPatient.email,
          phonePrefix: savedPatient.phonePrefix,
          phoneNumber: savedPatient.phoneNumber,
        },
      );

      return {
        patientId: savedPatient.patientId,
        fullName: savedPatient.fullName,
        documentType: savedPatient.documentType,
        documentNumber: savedPatient.documentNumber,
        gender: savedPatient.gender,
        birthDate: savedPatient.birthDate,
        phonePrefix: savedPatient.phonePrefix,
        phoneNumber: savedPatient.phoneNumber,
        email: savedPatient.email,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error creating patient');
    }
  }

  /**
   * Partially updates a patient
   */
  async update(
    id: number,
    updatePatientDto: UpdatePatientDto,
    updatedByUserId: number,
  ): Promise<PatientDetailDto> {
    try {
      // Throws if the patient does not exist
      const patient = await this.findById(id);

      // Keep the previous values of only the fields being updated
      const previousData: Record<string, unknown> = {};
      const updatedKeys = Object.keys(updatePatientDto) as Array<
        keyof UpdatePatientDto
      >;
      for (const key of updatedKeys) {
        // Only include fields that have a defined value in updatePatientDto
        if (updatePatientDto[key] !== undefined && key in patient) {
          previousData[key] = patient[key];
        }
      }

      // If the document is being updated, it must remain unique
      if (updatePatientDto.documentType || updatePatientDto.documentNumber) {
        const documentType =
          updatePatientDto.documentType || patient.documentType;
        const documentNumber =
          updatePatientDto.documentNumber || patient.documentNumber;

        // Only check when the document actually changed
        if (
          documentType !== patient.documentType ||
          documentNumber !== patient.documentNumber
        ) {
          const existingPatient = await this.findByDocument(
            documentType,
            documentNumber,
          );

          if (existingPatient && existingPatient.patientId !== id) {
            throw new ConflictException(
              `Another patient with document ${documentType} ${documentNumber} already exists.`,
            );
          }
        }
      }

      await this.patientRepository.update(id, updatePatientDto);

      // Record in the audit trail (only fields that actually changed are logged)
      await this.traceabilityService.logUpdate(
        EntityType.PATIENT,
        id,
        updatedByUserId,
        previousData,
        updatePatientDto,
      );

      // Return the updated patient
      return await this.findByIdDetailed(id);
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error updating patient');
    }
  }

  /**
   * Permanently deletes a patient
   * @throws ConflictException if the patient has analysis results
   */
  async remove(id: number, deletedByUserId: number): Promise<void> {
    try {
      // Throws if the patient does not exist
      const patient = await this.findById(id);

      // Snapshot the data for the audit trail before deleting
      const patientData = {
        fullName: patient.fullName,
        documentType: patient.documentType,
        documentNumber: patient.documentNumber,
        email: patient.email,
      };

      await this.patientRepository.delete(id);

      // Record in the audit trail
      await this.traceabilityService.logDelete(
        EntityType.PATIENT,
        id,
        deletedByUserId,
        patientData,
      );
    } catch (error) {
      // Results reference their patient with ON DELETE NO ACTION: a patient
      // with analysis results is kept.
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'The patient has analysis results and cannot be deleted.',
        );
      }
      throw toHttpException(error, this.logger, 'Error deleting patient');
    }
  }
}
