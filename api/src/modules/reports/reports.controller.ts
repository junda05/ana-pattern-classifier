/**
 * Reports controller
 *
 * Handles all endpoints for querying finalized reports
 * Base route: /api/v1/reports
 *
 * Security:
 * - All endpoints protected with JWT
 * - All endpoints accessible to the ADMIN and STANDARD roles
 * - All users can see all reports
 *
 * Available endpoints:
 *
 * GET /api/v1/reports/search
 * - Searches reports by patient name or document
 * - Query params: patientName, patientDocument, page, limit
 * - At least one of patientName / patientDocument is required (400 otherwise)
 * - Only returns results with status VERIFIED or CORRECTED
 *
 * GET /api/v1/reports/:id
 * - Returns the full detail of a report by its ID
 * - Includes every prediction with its final pattern and image, the
 *   responsible physician and the verification details
 */

import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportSearchQueryDto } from '../../DTOs/reports/report-search-query.dto';
import { ReportListDto } from '../../DTOs/reports/report-list.dto';
import { ReportDetailDto } from '../../DTOs/reports/report-detail.dto';
import { ReportSearchResponseDto } from '../../DTOs/reports/report-search-response.dto';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { REPORT_ROUTES } from './reports.routes';

@Controller(REPORT_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STANDARD)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/reports/search
   *
   * Searches clinical reports by patient name or document.
   * Only finalized results (VERIFIED or CORRECTED) are returned.
   */
  @Get(REPORT_ROUTES.SEARCH)
  async searchReports(
    @Query() query: ReportSearchQueryDto,
  ): Promise<ReportSearchResponseDto<ReportListDto>> {
    return this.reportsService.searchReports(query);
  }

  /**
   * GET /api/v1/reports/:id
   *
   * Returns the full detail of a clinical report: every prediction with its
   * final pattern and image, the responsible physician and verification data.
   */
  @Get(REPORT_ROUTES.GET_BY_ID)
  async getReportById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReportDetailDto> {
    return this.reportsService.getReportById(id);
  }
}
