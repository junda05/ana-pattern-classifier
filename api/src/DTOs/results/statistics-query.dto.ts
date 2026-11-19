/**
 * Query parameters for the result statistics
 *
 * Optional date filters:
 * - dateFrom: start date in YYYY-MM-DD format
 * - dateTo: end date in YYYY-MM-DD format
 *
 * Validation:
 * - dates must use the YYYY-MM-DD format
 * - dateFrom cannot be later than dateTo
 *
 * Usage: GET /api/v1/results/statistics?dateFrom=2025-01-01&dateTo=2025-12-31
 */

import { IsOptional, IsDateString, Matches } from 'class-validator';
import { IsDateBeforeOrEqual } from '../../common/utils/date-validation.utils';

export class StatisticsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must be in YYYY-MM-DD format.',
  })
  @IsDateBeforeOrEqual('dateTo', {
    message: 'Start date cannot be later than end date.',
  })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must be in YYYY-MM-DD format.',
  })
  dateTo?: string;
}
