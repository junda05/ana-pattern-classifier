/**
 * SQL Server expression for the current UTC time (datetime2 precision).
 *
 * Used as the default of every creation timestamp so the database stores UTC,
 * which matches `useUTC: true` in data-source.ts (TypeORM's own default for
 * SQL Server is getdate(), the server's local time).
 */
export const UTC_NOW_SQL = 'SYSUTCDATETIME()';
