/**
 * Pagination query for the audit trail
 *
 * Optional fields:
 * - page: page number (default: 1)
 * - limit: records per page (default: 10)
 *
 * Validation:
 * - page: positive integer >= 1
 * - limit: integer between 1 and 100
 */

import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer.' })
  @Min(1, { message: 'Page must be greater than or equal to 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be greater than or equal to 1.' })
  @Max(100, { message: 'Limit cannot be greater than 100.' })
  limit?: number = 10;
}

/**
 * Generic paginated response
 */
export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
