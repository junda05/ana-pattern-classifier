/**
 * Results controller
 *
 * Handles all CRUD endpoints for managing results
 * Base route: /api/v1/results
 *
 * Security:
 * - All endpoints protected with JWT (PassportJwtAuthGuard)
 * - All endpoints accessible to the ADMIN and STANDARD roles (RolesGuard + @Roles)
 * - STANDARD: can view/modify their own results plus the shared PENDING queue,
 *   and cannot correct VERIFIED results
 * - ADMIN: can view/modify all results
 *
 * Available endpoints:
 *
 * GET /api/v1/results
 * - Lists results with pagination and filters
 * - Query params: page (default: 1), limit (default: 10), status (optional),
 *   search (optional: patient full name or document number contains)
 * - Returns: PaginatedResponseDto<ResultListDto>
 * - Includes nested patient data and the number of predictions
 *
 * GET /api/v1/results/:id
 * - Returns a specific result by ID
 * - Returns: ResultDetailDto (all fields + relations)
 * - Includes nested patient and user data
 *
 * POST /api/v1/results/batch/with-files
 * - Creates a result with multiple predictions AND image files
 * - Body: multipart/form-data (images + data JSON)
 * - Returns: ResultCreatedDto of the created result
 * - The owner is the authenticated user; the data JSON is validated (400 on errors)
 * - Saves image files to disk and writes the result in one transaction
 *
 * POST /api/v1/results/:id/predictions/with-files
 * - Changes an existing result in ONE transaction: new images (optional),
 *   dilutions, corrections of new images (by index) and of existing
 *   predictions, observations and status; at least one change (400)
 * - Body: multipart/form-data (images + data JSON)
 * - Returns: updated ResultWithAddedPredictionsDto (ResultDetailDto + addedPredictionIds)
 * - A result holds at most 20 images, saved ones included (400)
 * - A VERIFIED result is locked (409); only an ADMIN may correct it
 *
 * PATCH /api/v1/results/:id
 * - Partially updates a result
 * - Body: UpdateResultDto (only status and/or observations)
 * - Returns: ResultDetailDto of the updated result
 * - Only status and observations can be updated
 *
 * POST /api/v1/results/corrections
 * - Creates a single correction for a prediction
 * - Body: CreateCorrectionDto
 * - Returns: CorrectionDetailDto of the created correction
 * - Always sets the result status to CORRECTED (also for a VERIFIED result corrected by an ADMIN)
 * - Creates an individual audit-trail record
 *
 * POST /api/v1/results/corrections/batch
 * - Creates multiple corrections in batch with ONE SINGLE audit-trail record
 * - Body: CreateBatchCorrectionsExistingDto
 * - Returns: Array of CorrectionDetailDto
 * - All corrections must belong to the same result
 * - Creates a single consolidated audit-trail record
 *
 * GET /api/v1/results/:id/corrections
 * - Returns all corrections of a result
 * - Returns: Array of CorrectionDetailDto
 * - Sorted by date descending (most recent first)
 *
 * GET /api/v1/results/:id/corrections/latest
 * - Returns the latest (current) correction of a result
 * - Returns: CorrectionDetailDto
 * - Useful to get only the current correction
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ResultsService } from './results.service';
import { UpdateResultDto } from '../../DTOs/results/update-result.dto';
import { CreateCorrectionDto } from '../../DTOs/results/create-correction.dto';
import { CreateBatchCorrectionsExistingDto } from '../../DTOs/results/create-batch-corrections-existing.dto';
import { CreateBatchResultsWithCorrectionsDto } from '../../DTOs/results/create-batch-results-with-corrections.dto';
import { AddPredictionsToResultDto } from '../../DTOs/results/add-predictions-to-result.dto';
import { ResultListDto } from '../../DTOs/results/result-list.dto';
import {
  ResultDetailDto,
  ResultWithAddedPredictionsDto,
} from '../../DTOs/results/result-detail.dto';
import { ResultCreatedDto } from '../../DTOs/results/result-created.dto';
import { CorrectionDetailDto } from '../../DTOs/results/correction-detail.dto';
import { ResultStatisticsDto } from '../../DTOs/results/result-statistics.dto';
import { StatisticsQueryDto } from '../../DTOs/results/statistics-query.dto';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../DTOs/results/pagination-query.dto';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { imageFileFilter } from '../files/image-upload.filter';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { RESULT_ROUTES } from './results.routes';
import { parseJsonDto } from '../../common/validation/parse-json-dto';
import { MAX_FILES_PER_REQUEST, MAX_FILE_SIZE } from '../files/files.types';

@Controller(RESULT_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STANDARD)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  /**
   * GET /api/v1/results
   * Lists results, paginated and filtered
   */
  @Get(RESULT_ROUTES.GET_ALL)
  async findAll(
    @Query() query: PaginationQueryDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<ResultListDto>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const status = query.status;
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.findAllPaginated(
      page,
      limit,
      status,
      currentUserId,
      currentUserRole,
      query.search,
    );
  }

  /**
   * GET /api/v1/results/statistics
   * Returns the result statistics for the Analytics dashboard
   *
   * IMPORTANT: this endpoint must be declared BEFORE GET /:id so that NestJS
   * does not treat "statistics" as an ID
   *
   * Optional query params:
   * - dateFrom: start date in YYYY-MM-DD format
   * - dateTo: end date in YYYY-MM-DD format
   *
   * Automatic validation:
   * - dates must use the YYYY-MM-DD format
   * - dateFrom cannot be later than dateTo
   *
   * Statistics are computed PER PREDICTION (IMAGE):
   * - totalValidated: total validated predictions (from VERIFIED or CORRECTED results)
   * - precision: % of predictions without corrections
   * - correctionRate: % of predictions with corrections
   * - totalVerifiedWithoutCorrections: number of correctly classified predictions
   * - totalCorrected: number of corrected predictions
   */
  @Get(RESULT_ROUTES.GET_STATISTICS)
  async getStatistics(
    @Request() request: AuthenticatedRequest,
    @Query() query: StatisticsQueryDto,
  ): Promise<ResultStatisticsDto> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.getStatistics(
      currentUserId,
      currentUserRole,
      query.dateFrom,
      query.dateTo,
    );
  }

  /**
   * GET /api/v1/results/:id
   * Returns a single result
   */
  @Get(RESULT_ROUTES.GET_BY_ID)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ): Promise<ResultDetailDto> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.findByIdDetailed(
      id,
      currentUserId,
      currentUserRole,
    );
  }

  /**
   * POST /api/v1/results/batch/with-files
   * Creates a result with several predictions AND their image files
   *
   * The request carries:
   * - Image files (multipart/form-data, field "images")
   * - The result data as JSON (multipart/form-data, field "data")
   *
   * Request format:
   * Content-Type: multipart/form-data
   *
   * FormData:
   * - images: the image files
   * - data: JSON string with a CreateBatchResultsWithCorrectionsDto (no userId)
   *
   * Example from React:
   * ```javascript
   * const formData = new FormData();
   * images.forEach(img => formData.append('images', img.file));
   * formData.append('data', JSON.stringify({
   *   patientId: 1,
   *   predictions: [
   *     { prediction: 'NUCLEAR_HOMOGENEOUS', confidencePercentage: 87.5, dilution: '80' },
   *     { prediction: 'NUCLEAR_SPECKLED', confidencePercentage: 92.3, dilution: '160' }
   *   ],
   *   observations: 'Analysis complete',
   *   status: 'VERIFIED'
   * }));
   *
   * const response = await fetch('/api/v1/results/batch/with-files', {
   *   method: 'POST',
   *   headers: { 'Authorization': `Bearer ${token}` },
   *   body: formData
   * });
   * ```
   *
   * Validation (400 with a list of messages):
   * - At most 20 files per request
   * - Maximum size per file: 10MB
   * - Allowed images: MIME type and extension from files.types.ts
   *   (JPEG, PNG, BMP, TIFF), checked by the shared imageFileFilter
   * - "data" must be valid JSON matching the DTO; undeclared properties
   *   (including userId) are rejected
   * - The number of files must match the number of predictions
   * - Every corrections[].imageIndex must point to an uploaded image
   *
   * @returns The created result with its ID and date
   */
  @Post(RESULT_ROUTES.CREATE_BATCH_WITH_FILES)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES_PER_REQUEST, {
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async createBatchWithFiles(
    @UploadedFiles() images: Express.Multer.File[],
    @Body('data') data: unknown,
    @Request() request: AuthenticatedRequest,
  ): Promise<ResultCreatedDto> {
    if (!images || images.length === 0) {
      throw new BadRequestException('Provide at least one image.');
    }

    // The result data arrives as a JSON string in the 'data' field; it is
    // validated here because the global ValidationPipe cannot see inside it.
    const createBatchDto = await parseJsonDto(
      CreateBatchResultsWithCorrectionsDto,
      data,
    );

    // The owner is always the authenticated user
    return await this.resultsService.createBatchWithFiles(
      createBatchDto,
      images,
      request.user.userId,
    );
  }

  /**
   * POST /api/v1/results/:id/predictions/with-files
   * Changes an existing result in one transaction
   *
   * Lets the user continue an analysis by adding more images (optional) and,
   * in the same request, correct new or existing predictions, update
   * dilutions, observations and status (see AddPredictionsToResultDto).
   *
   * @param id - ID of the existing result
   * @param images - New image files (images[i] <-> newPredictions[i]); may be empty
   * @param data - JSON with newPredictions, updatedDilutions, corrections,
   *               existingCorrections, observations, status
   * @returns The updated result plus addedPredictionIds: the IDs of the
   *          predictions created by this request, in upload order
   */
  @Post(RESULT_ROUTES.ADD_PREDICTIONS_TO_RESULT)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES_PER_REQUEST, {
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async addPredictionsToResult(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() images: Express.Multer.File[],
    @Body('data') data: unknown,
    @Request() request: AuthenticatedRequest,
  ): Promise<ResultWithAddedPredictionsDto> {
    const addPredictionsDto = await parseJsonDto(
      AddPredictionsToResultDto,
      data,
    );

    return await this.resultsService.addPredictionsToResult(
      id,
      addPredictionsDto,
      images ?? [],
      request.user.userId,
      request.user.role,
    );
  }

  /**
   * PATCH /api/v1/results/:id
   * Partially updates a result
   */
  @Patch(RESULT_ROUTES.UPDATE)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResultDto: UpdateResultDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<ResultDetailDto> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.update(
      id,
      updateResultDto,
      currentUserId,
      currentUserRole,
    );
  }

  /**
   * POST /api/v1/results/corrections
   * Creates a correction for a single prediction
   *
   * The predictionId comes in the request body
   */
  @Post(RESULT_ROUTES.CREATE_CORRECTION)
  @HttpCode(HttpStatus.CREATED)
  async createCorrection(
    @Body() createCorrectionDto: CreateCorrectionDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CorrectionDetailDto> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.createCorrection(
      createCorrectionDto,
      currentUserId,
      currentUserRole,
    );
  }

  /**
   * POST /api/v1/results/corrections/batch
   * Creates several corrections in one batch with A SINGLE audit record
   *
   * IMPORTANT: this route must be declared BEFORE GET /:id/corrections so that
   * NestJS does not treat "batch" as a result ID
   *
   * Body: CreateBatchCorrectionsExistingDto with the corrections
   *
   * All corrections must belong to the same result.
   * A single consolidated audit record is created.
   */
  @Post(RESULT_ROUTES.CREATE_BATCH_CORRECTIONS)
  @HttpCode(HttpStatus.CREATED)
  async createBatchCorrections(
    @Body() createBatchCorrectionsDto: CreateBatchCorrectionsExistingDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CorrectionDetailDto[]> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.createBatchCorrectionsForExisting(
      createBatchCorrectionsDto,
      currentUserId,
      currentUserRole,
    );
  }

  /**
   * GET /api/v1/results/:id/corrections
   * Returns every correction of a result
   */
  @Get(RESULT_ROUTES.GET_CORRECTIONS)
  async getCorrections(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ): Promise<CorrectionDetailDto[]> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.getCorrections(
      id,
      currentUserId,
      currentUserRole,
    );
  }

  /**
   * GET /api/v1/results/:id/corrections/latest
   * Returns the latest (current) correction of a result
   */
  @Get(RESULT_ROUTES.GET_LATEST_CORRECTION)
  async getLatestCorrection(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ): Promise<CorrectionDetailDto> {
    const currentUserId = request.user.userId;
    const currentUserRole = request.user.role;

    return await this.resultsService.getLatestCorrection(
      id,
      currentUserId,
      currentUserRole,
    );
  }
}
