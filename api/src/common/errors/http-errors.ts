/**
 * Maps errors caught in services to HTTP exceptions.
 *
 * - HttpException subclasses (400/403/404/409...) pass through unchanged.
 * - SQL Server unique-key violations (2627, 2601) become 409 Conflict; this only
 *   happens when two requests race past the service's own uniqueness check.
 * - Anything else becomes 500 with a generic message; the original error is
 *   logged with its stack so it never reaches the client.
 *
 * isForeignKeyViolation() lets a service turn a REFERENCE constraint conflict
 * (SQL Server 547, e.g. deleting a row that other rows still reference) into
 * a domain-specific 409.
 */

import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const SQL_SERVER_UNIQUE_VIOLATIONS = new Set([2627, 2601]);
const SQL_SERVER_CONSTRAINT_CONFLICT = 547;

type ErrorLogger = Pick<Logger, 'error' | 'warn'>;

function driverErrorNumber(
  error: Pick<QueryFailedError, 'driverError'>,
): number | undefined {
  const driverError = error.driverError as { number?: unknown } | undefined;
  return typeof driverError?.number === 'number'
    ? driverError.number
    : undefined;
}

/** True when a query failed because a foreign-key (REFERENCE) constraint blocked it. */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    driverErrorNumber(error) === SQL_SERVER_CONSTRAINT_CONFLICT
  );
}

export function toHttpException(
  error: unknown,
  logger: ErrorLogger,
  context: string,
): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  if (error instanceof QueryFailedError) {
    const number = driverErrorNumber(error);
    if (number !== undefined && SQL_SERVER_UNIQUE_VIOLATIONS.has(number)) {
      logger.warn(`${context}: unique constraint violation (${error.message})`);
      return new ConflictException(
        'A record with the same unique values already exists.',
      );
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`${context}: ${message}`, stack);
  return new InternalServerErrorException('Unexpected error.');
}
