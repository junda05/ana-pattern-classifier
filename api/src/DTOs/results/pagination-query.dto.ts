/**
 * Query parameters for paginating and filtering results
 *
 * Parameters:
 * - page: page number (default: 1)
 * - limit: items per page (default: 10)
 * - status: filter by result status (optional)
 * - search: patient full name or document number contains (optional,
 *   case-insensitive)
 *
 * Usage: GET /api/v1/results?page=1&limit=10&status=PENDING&search=doe
 */

import {
  IsOptional,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResultStatus } from '../../entities/results/result.types';

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer.' })
  @Min(1, { message: 'Page must be greater than or equal to 1.' })
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be greater than or equal to 1.' })
  @IsOptional()
  limit?: number;

  @IsEnum(ResultStatus, {
    message:
      'Invalid status. It must be one of: PENDING, CORRECTED or VERIFIED.',
  })
  @IsOptional()
  status?: ResultStatus;

  @MaxLength(100, { message: 'Search must be at most 100 characters long.' })
  @IsString({ message: 'Search must be a string.' })
  @IsOptional()
  search?: string;
}

/**
 * Paginated response
 *
 * Fields:
 * - data: items of type T
 * - total: total number of items in the database
 * - page: current page
 * - limit: items per page
 * - totalPages: computed number of pages
 */

export interface PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
