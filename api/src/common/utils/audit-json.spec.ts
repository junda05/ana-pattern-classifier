import { parseAuditJson } from './audit-json';

describe('parseAuditJson', () => {
  it('parses a stored JSON object', () => {
    expect(
      parseAuditJson('{"status":"VERIFIED","predictionsCount":2}'),
    ).toEqual({
      status: 'VERIFIED',
      predictionsCount: 2,
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseAuditJson('  {"a":1}\n')).toEqual({ a: 1 });
  });

  it.each([
    'VERIFIED',
    'Password changed successfully',
    '********',
    '42',
    'true',
    '',
  ])(
    'returns null for the plain value %p without reporting an error',
    (value) => {
      const onError = jest.fn();
      expect(parseAuditJson(value, onError)).toBeNull();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('returns null for missing values', () => {
    expect(parseAuditJson(undefined)).toBeNull();
    expect(parseAuditJson(null)).toBeNull();
  });

  it('returns null for JSON arrays (audit payloads are objects)', () => {
    expect(parseAuditJson('[1,2,3]')).toBeNull();
  });

  it('reports malformed JSON that looks like an object', () => {
    const onError = jest.fn<void, [unknown]>();

    expect(parseAuditJson('{"status":', onError)).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });
});
