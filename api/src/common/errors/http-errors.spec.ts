import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { isForeignKeyViolation, toHttpException } from './http-errors';

function sqlServerError(number: number): QueryFailedError {
  const driverError = Object.assign(new Error(`SQL Server error ${number}`), {
    number,
  });
  return new QueryFailedError('DELETE ...', [], driverError);
}

describe('isForeignKeyViolation', () => {
  it('detects a SQL Server REFERENCE constraint conflict (547)', () => {
    expect(isForeignKeyViolation(sqlServerError(547))).toBe(true);
  });

  it.each([
    ['another SQL Server error', sqlServerError(2627)],
    ['a plain error', new Error('547')],
    ['a non-error value', 547],
  ])('ignores %s', (_case, error) => {
    expect(isForeignKeyViolation(error)).toBe(false);
  });
});

describe('toHttpException', () => {
  let logger: jest.Mocked<Pick<Logger, 'error' | 'warn'>>;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() };
  });

  it('returns HTTP exceptions unchanged and does not log them', () => {
    const notFound = new NotFoundException('Result with ID 4 not found.');
    const forbidden = new ForbiddenException('No.');

    expect(toHttpException(notFound, logger, 'Could not load the result')).toBe(
      notFound,
    );
    expect(
      toHttpException(forbidden, logger, 'Could not load the result'),
    ).toBe(forbidden);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps unknown errors to a generic 500 and logs the original with its stack', () => {
    const original = new Error('connection reset');

    const mapped = toHttpException(
      original,
      logger,
      'Could not create the result',
    );

    expect(mapped).toBeInstanceOf(InternalServerErrorException);
    expect(mapped.getStatus()).toBe(500);
    expect(mapped.message).toBe('Unexpected error.');
    expect(logger.error).toHaveBeenCalledWith(
      'Could not create the result: connection reset',
      original.stack,
    );
  });

  it('maps non-Error values to a generic 500', () => {
    const mapped = toHttpException('boom', logger, 'Could not list results');

    expect(mapped).toBeInstanceOf(InternalServerErrorException);
    expect(logger.error).toHaveBeenCalledWith(
      'Could not list results: boom',
      undefined,
    );
  });

  it.each([2627, 2601])(
    'maps SQL Server unique violations (%i) to 409',
    (number) => {
      const driverError = Object.assign(
        new Error('Violation of UNIQUE KEY constraint'),
        { number },
      );
      const error = new QueryFailedError('INSERT ...', [], driverError);

      const mapped = toHttpException(
        error,
        logger,
        'Could not create the patient',
      );

      expect(mapped).toBeInstanceOf(ConflictException);
      expect(mapped.message).toBe(
        'A record with the same unique values already exists.',
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it('treats other database errors as unexpected', () => {
    const driverError = Object.assign(new Error('Deadlock'), { number: 1205 });
    const error = new QueryFailedError('UPDATE ...', [], driverError);

    expect(toHttpException(error, logger, 'Could not update')).toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
