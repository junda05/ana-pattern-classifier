import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TraceabilityQueryDto } from './traceability-query.dto';

/** Validates a query string object the way the global ValidationPipe does. */
async function errors(query: Record<string, string>): Promise<string[]> {
  const dto = plainToInstance(TraceabilityQueryDto, query, {
    enableImplicitConversion: true,
  });
  const result = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  return result.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('TraceabilityQueryDto', () => {
  it('accepts every filter together', async () => {
    await expect(
      errors({
        page: '2',
        limit: '100',
        from: '2026-09-24T05:00:00.000Z',
        to: '2026-09-25T05:00:00.000Z',
        userName: 'doe',
        activityType: 'UPDATE',
      }),
    ).resolves.toEqual([]);
  });

  it('accepts instants with an explicit offset', async () => {
    await expect(
      errors({ from: '2026-09-24T00:00:00-05:00' }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['a date without time', '2026-09-24'],
    ['a local time without zone', '2026-09-24T10:00:00'],
    ['text', 'yesterday'],
  ])('rejects %s as from/to', async (_label, value) => {
    const message =
      'must be an ISO 8601 instant with a time zone (e.g. 2026-09-24T05:00:00.000Z).';

    await expect(errors({ from: value })).resolves.toEqual([`from ${message}`]);
    await expect(errors({ to: value })).resolves.toEqual([`to ${message}`]);
  });

  it('rejects from later than to', async () => {
    await expect(
      errors({
        from: '2026-09-25T00:00:00.000Z',
        to: '2026-09-24T00:00:00.000Z',
      }),
    ).resolves.toEqual(['from cannot be later than to.']);
  });

  it('rejects an unknown activity type, a long user name and a limit over 100', async () => {
    await expect(errors({ activityType: 'LOGIN' })).resolves.toEqual([
      'Invalid activity type. It must be one of: CREATE, UPDATE, DELETE, PASSWORD_RESET_REQUEST, PASSWORD_RESET_COMPLETED, PASSWORD_RESET_EXPIRED.',
    ]);
    await expect(errors({ userName: 'x'.repeat(101) })).resolves.toEqual([
      'User name must be at most 100 characters long.',
    ]);
    await expect(errors({ limit: '101' })).resolves.toEqual([
      'Limit cannot be greater than 100.',
    ]);
  });
});
