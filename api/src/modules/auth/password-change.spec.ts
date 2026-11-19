import { issuedBeforePasswordChange } from './password-change';

describe('issuedBeforePasswordChange', () => {
  const changedAt = new Date('2026-09-24T12:00:00.500Z');
  const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

  it.each([undefined, null])(
    'accepts any token while the password was never reset (%p)',
    (never) => {
      expect(
        issuedBeforePasswordChange(seconds('2020-01-01T00:00:00Z'), never),
      ).toBe(false);
    },
  );

  it('rejects a token issued before the reset', () => {
    expect(
      issuedBeforePasswordChange(seconds('2026-09-24T11:59:59Z'), changedAt),
    ).toBe(true);
  });

  it('rejects a token issued earlier in the same second as the reset (iat has no milliseconds)', () => {
    expect(
      issuedBeforePasswordChange(seconds('2026-09-24T12:00:00Z'), changedAt),
    ).toBe(true);
  });

  it('accepts a token issued after the reset', () => {
    expect(
      issuedBeforePasswordChange(seconds('2026-09-24T12:00:01Z'), changedAt),
    ).toBe(false);
  });

  it('rejects a token without iat once the password has been reset', () => {
    expect(issuedBeforePasswordChange(undefined, changedAt)).toBe(true);
  });
});
