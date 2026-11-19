/**
 * Audit-trail (traceability) controller
 *
 * Handles the endpoints for querying the system audit trail
 * Base route: /api/v1/traceability
 *
 * Security:
 * - Every endpoint requires a JWT (PassportJwtAuthGuard)
 * - ADMIN role only (RolesGuard + @Roles)
 *
 * Endpoints:
 *
 * GET /api/v1/traceability
 * - Lists all audit records, paginated
 * - Query params: page (default: 1), limit (default: 10, max 100), from
 *   (ISO instant, inclusive), to (ISO instant, exclusive), userName (full name
 *   contains), activityType
 * - Returns: PaginatedResponseDto<TraceabilityListDto>
 *
 * GET /api/v1/traceability/:id
 * - Returns the full detail of one audit record
 * - Returns: TraceabilityDetailDto with all the structured information
 */

import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TraceabilityService } from './traceability.service';
import { TraceabilityListDto } from '../../DTOs/traceability/traceability-list.dto';
import { TraceabilityDetailDto } from '../../DTOs/traceability/traceability-detail.dto';
import { PaginatedResponseDto } from '../../DTOs/traceability/pagination-query.dto';
import { TraceabilityQueryDto } from '../../DTOs/traceability/traceability-query.dto';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { TRACEABILITY_ROUTES } from './traceability.routes';

@Controller(TRACEABILITY_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  /**
   * GET /api/v1/traceability
   * Lists the audit records, paginated (limit <= 100) and filtered by
   * from (inclusive) / to (exclusive) ISO instants, userName (contains) and
   * activityType
   */
  @Get(TRACEABILITY_ROUTES.GET_ALL)
  async findAll(
    @Query() query: TraceabilityQueryDto,
  ): Promise<PaginatedResponseDto<TraceabilityListDto>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;

    return await this.traceabilityService.findAllPaginated(page, limit, {
      from: query.from,
      to: query.to,
      userName: query.userName,
      activityType: query.activityType,
    });
  }

  /**
   * GET /api/v1/traceability/:id
   * Returns the full detail of an audit record
   */
  @Get(TRACEABILITY_ROUTES.GET_BY_ID)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TraceabilityDetailDto> {
    return await this.traceabilityService.findById(id);
  }
}
