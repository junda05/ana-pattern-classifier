/**
 * Query parameters for the report search
 *
 * Reports can be searched by:
 * - Patient name (partial, case-insensitive match)
 * - Patient document number (exact match)
 * - Pagination (page and limit)
 *
 * Behaviour:
 * - At least one search field (patientName or patientDocument) must be present
 * - Only results with status VERIFIED or CORRECTED are returned
 * - Results are sorted by date, newest first
 */

import { IsString, IsOptional, IsInt, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportSearchQueryDto {
  /**
   * Patient name (partial match).
   * Optional, but at least one of patientName or patientDocument must be present.
   */
  @IsString({ message: 'Patient name must be a string.' })
  @IsOptional()
  @ValidateIf(
    (o: ReportSearchQueryDto) => !o.patientDocument || !!o.patientName,
  )
  patientName?: string;

  /**
   * Patient document number (exact match).
   * Optional, but at least one of patientName or patientDocument must be present.
   */
  @IsString({ message: 'Patient document must be a string.' })
  @IsOptional()
  @ValidateIf(
    (o: ReportSearchQueryDto) => !o.patientName || !!o.patientDocument,
  )
  patientDocument?: string;

  /**
   * Page number (default: 1)
   */
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer.' })
  @Min(1, { message: 'Page must be greater than or equal to 1.' })
  @IsOptional()
  page?: number = 1;

  /**
   * Results per page (default: 10; the service caps it at 50)
   */
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be greater than or equal to 1.' })
  @IsOptional()
  limit?: number = 10;
}
