import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto as PatientsPagination } from './patients/pagination-query.dto';
import { PaginationQueryDto as UsersPagination } from './users/pagination-query.dto';
import { PaginationQueryDto as ResultsPagination } from './results/pagination-query.dto';
import { PaginationQueryDto as TraceabilityPagination } from './traceability/pagination-query.dto';
import { ReportSearchQueryDto } from './reports/report-search-query.dto';

const paginationDtos = [
  ['patients', PatientsPagination],
  ['users', UsersPagination],
  ['results', ResultsPagination],
  ['traceability', TraceabilityPagination],
  ['reports', ReportSearchQueryDto],
] as const;

async function messages(
  cls: new () => object,
  query: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, query), {
    stopAtFirstError: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe.each(paginationDtos)('%s pagination messages', (_name, cls) => {
  it('uses one message style for invalid page and limit values', async () => {
    expect(await messages(cls, { page: 1.5, limit: 2.5 })).toEqual([
      'Page must be an integer.',
      'Limit must be an integer.',
    ]);
    expect(await messages(cls, { page: 0, limit: 0 })).toEqual([
      'Page must be greater than or equal to 1.',
      'Limit must be greater than or equal to 1.',
    ]);
  });
});
