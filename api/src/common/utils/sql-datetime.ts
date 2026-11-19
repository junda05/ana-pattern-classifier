/**
 * Exact instant parameters for SQL Server.
 *
 * The mssql driver sends a plain Date as `datetime`, which SQL Server rounds
 * to 1/300 s; comparing a `datetime2` column with it can move a bound by a few
 * milliseconds. Sending the instant as `datetime2` keeps it exact (UTC, since
 * the connection uses useUTC).
 */

import { MssqlParameter } from 'typeorm';

export function datetime2(instant: Date): MssqlParameter {
  return new MssqlParameter(instant, 'datetime2');
}
