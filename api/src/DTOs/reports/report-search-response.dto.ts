/**
 * Paginated response of the report search
 * (same shape as the generic PaginatedResponseDto)
 */

export interface ReportSearchResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
