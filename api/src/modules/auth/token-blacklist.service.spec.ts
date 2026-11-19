import { createHash } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { TokenBlacklistService } from './token-blacklist.service';
import { BlacklistedToken } from '../../entities/auth/blacklisted-token.entity';
import { TokenType } from '../../entities/auth/blacklisted-token.types';

type Row = Partial<BlacklistedToken>;

/** In-memory stand-in for the BlacklistedTokens repository. */
function fakeRepository(rows: Row[] = []) {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof Row] === value,
    );
  return {
    rows,
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn((row: Row) => {
      rows.push(row);
      return Promise.resolve(row);
    }),
    count: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(rows.filter((row) => matches(row, where)).length),
    ),
    delete: jest.fn(() => Promise.resolve({ affected: 2, raw: [] })),
  };
}

describe('TokenBlacklistService', () => {
  let repository: ReturnType<typeof fakeRepository>;
  let service: TokenBlacklistService;

  beforeEach(() => {
    repository = fakeRepository();
    service = new TokenBlacklistService(
      repository as unknown as Repository<BlacklistedToken>,
    );
  });

  it('hashes tokens with SHA-256 (hex)', () => {
    const expected = createHash('sha256').update('token-a').digest('hex');
    expect(TokenBlacklistService.hashToken('token-a')).toBe(expected);
    expect(TokenBlacklistService.hashToken('token-a')).toHaveLength(64);
    expect(TokenBlacklistService.hashToken('token-b')).not.toBe(expected);
  });

  it('stores the hash, never the raw token', async () => {
    const expiresAt = new Date('2026-09-25T00:00:00Z');

    await service.blacklistToken('token-a', TokenType.REFRESH, 1, expiresAt);

    expect(repository.rows).toEqual([
      {
        tokenHash: TokenBlacklistService.hashToken('token-a'),
        tokenType: TokenType.REFRESH,
        userId: 1,
        expiresAt,
      },
    ]);
    expect(JSON.stringify(repository.rows)).not.toContain('token-a');
  });

  it('blacklists per token: another token of the same user stays valid', async () => {
    await service.blacklistToken(
      'token-a',
      TokenType.REFRESH,
      1,
      new Date(Date.now() + 60_000),
    );

    await expect(service.isTokenBlacklisted('token-a')).resolves.toBe(true);
    await expect(service.isTokenBlacklisted('token-b')).resolves.toBe(false);
  });

  it('looks tokens up by hash', async () => {
    await service.isTokenBlacklisted('token-a');

    expect(repository.count).toHaveBeenCalledWith({
      where: { tokenHash: TokenBlacklistService.hashToken('token-a') },
    });
  });

  it('removes entries whose expiry is in the past', async () => {
    const now = new Date('2026-09-24T12:00:00Z');

    await expect(service.removeExpired(now)).resolves.toBe(2);

    expect(repository.delete).toHaveBeenCalledWith({
      expiresAt: LessThan(now),
    });
  });
});
