/**
 * Patients controller
 *
 * Handles all CRUD endpoints for managing patients
 * Base route: /api/v1/patients
 *
 * Security:
 * - All endpoints protected with JWT (PassportJwtAuthGuard)
 * - All endpoints accessible to the ADMIN and STANDARD roles (RolesGuard + @Roles)
 *
 * Available endpoints:
 *
 * GET /api/v1/patients
 * - Lists patients with pagination
 * - Query params: page (default: 1), limit (default: 10)
 * - Returns: PaginatedResponseDto<PatientListDto>
 *
 * GET /api/v1/patients/document?documentType=NATIONAL_ID&documentNumber=1234567890
 * - Finds a patient by document type and number
 * - Query params: documentType (NATIONAL_ID|MINOR_ID|FOREIGNER_ID|PASSPORT|BIRTH_CERTIFICATE), documentNumber (5-20 chars)
 * - Returns: PatientDetailDto if found, 404 if not found
 * - Returns: 400 if the parameters are invalid
 *
 * GET /api/v1/patients/:id
 * - Returns a specific patient by ID
 * - Returns: PatientDetailDto (all fields)
 *
 * POST /api/v1/patients
 * - Creates a new patient
 * - Body: CreatePatientDto
 * - Returns: PatientDetailDto of the created patient
 * - Validates uniqueness of documentType + documentNumber
 *
 * PATCH /api/v1/patients/:id
 * - Partially updates a patient
 * - Body: UpdatePatientDto (optional fields)
 * - Returns: PatientDetailDto of the updated patient
 * - Validates document uniqueness if it is updated
 *
 * DELETE /api/v1/patients/:id
 * - Permanently deletes a patient that has no analysis results
 * - Returns: confirmation message; 409 if the patient has results
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from '../../DTOs/patients/create-patient.dto';
import { UpdatePatientDto } from '../../DTOs/patients/update-patient.dto';
import { PatientListDto } from '../../DTOs/patients/patient-list.dto';
import { PatientDetailDto } from '../../DTOs/patients/patient-detail.dto';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../DTOs/patients/pagination-query.dto';
import { SearchByDocumentDto } from '../../DTOs/patients/search-by-document.dto';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { PATIENT_ROUTES } from './patients.routes';

@Controller(PATIENT_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STANDARD)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * GET /api/v1/patients
   * Lists patients with pagination
   */
  @Get(PATIENT_ROUTES.GET_ALL)
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<PatientListDto>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;

    return await this.patientsService.findAllPaginated(page, limit);
  }

  /**
   * GET /api/v1/patients/document?documentType=NATIONAL_ID&documentNumber=1234567890
   * Finds a patient by document type and number
   *
   * IMPORTANT: this endpoint must be declared BEFORE GET_BY_ID
   * so that "document" is not interpreted as an ID
   */
  @Get(PATIENT_ROUTES.GET_BY_DOCUMENT)
  async findByDocument(
    @Query() searchDto: SearchByDocumentDto,
  ): Promise<PatientDetailDto> {
    return await this.patientsService.findByDocumentDetailed(
      searchDto.documentType,
      searchDto.documentNumber,
    );
  }

  /**
   * GET /api/v1/patients/:id
   * Gets a specific patient
   */
  @Get(PATIENT_ROUTES.GET_BY_ID)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PatientDetailDto> {
    return await this.patientsService.findByIdDetailed(id);
  }

  /**
   * POST /api/v1/patients
   * Creates a new patient
   */
  @Post(PATIENT_ROUTES.CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PatientDetailDto> {
    const currentUserId = req.user.userId;
    return await this.patientsService.create(createPatientDto, currentUserId);
  }

  /**
   * PATCH /api/v1/patients/:id
   * Partially updates a patient
   */
  @Patch(PATIENT_ROUTES.UPDATE)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PatientDetailDto> {
    const currentUserId = req.user.userId;
    return await this.patientsService.update(
      id,
      updatePatientDto,
      currentUserId,
    );
  }

  /**
   * DELETE /api/v1/patients/:id
   * Permanently deletes a patient (409 if the patient has analysis results)
   */
  @Delete(PATIENT_ROUTES.DELETE)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const currentUserId = req.user.userId;
    await this.patientsService.remove(id, currentUserId);
    return {
      message: 'Patient deleted successfully.',
    };
  }
}
