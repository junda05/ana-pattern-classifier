import { containsPattern, escapeLike } from './sql-like';

describe('escapeLike', () => {
  it('wraps the SQL Server LIKE wildcards in brackets', () => {
    expect(escapeLike('50%_[a]')).toBe('50[%][_][[]a]');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLike("O'Neil 123")).toBe("O'Neil 123");
  });
});

describe('containsPattern', () => {
  it('builds a lower-case, escaped "contains" pattern', () => {
    expect(containsPattern('  Doe_J  ')).toBe('%doe[_]j%');
  });
});
