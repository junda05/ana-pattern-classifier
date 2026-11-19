/**
 * DTO for patient pagination parameters
 *
 * Defines the query parameters used for pagination
 *
 * Parameters:
 * - page: page number (default: 1)
 * - limit: number of items per page (default: 10)
 *
 * Usage: GET /api/v1/patients?page=1&limit=10
 */

import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
}

/**
 * DTO for a paginated response
 *
 * Standard structure for returning paginated data
 *
 * Fields:
 * - data: array of items of type T
 * - total: total number of items in the database
 * - page: current page
 * - limit: items per page
 * - totalPages: total number of pages
 */

export interface PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
