import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UsersService } from '../users/users.service';
import { BlacklistedToken } from '../../entities/auth/blacklisted-token.entity';
import { TokenType } from '../../entities/auth/blacklisted-token.types';
import { UserRole } from '../../entities/users/user.types';

const SECRET = 'unit-test-secret';
const USER = {
  userId: 1,
  username: 'jane.doe',
  role: UserRole.STANDARD,
  isActive: true,
};

function blacklistRepository() {
  const rows: Partial<BlacklistedToken>[] = [];
  return {
    rows,
    create: (data: Partial<BlacklistedToken>) => ({ ...data }),
    save: jest.fn((row: Partial<BlacklistedToken>) => {
      rows.push(row);
      return Promise.resolve(row);
    }),
    count: ({ where }: { where: { tokenHash: string } }) =>
      Promise.resolve(
        rows.filter((row) => row.tokenHash === where.tokenHash).length,
      ),
  };
}

describe('AuthService', () => {
  let jwtService: JwtService;
  let repository: ReturnType<typeof blacklistRepository>;
  let blacklist: TokenBlacklistService;
  let usersService: {
    findById: jest.Mock;
    findUserByName: jest.Mock;
    updateLastLogin: jest.Mock;
  };
  let service: AuthService;

  const config = {
    get: (key: string) =>
      ({ JWT_ACCESS_EXPIRATION: '15m', JWT_REFRESH_EXPIRATION: '2h' })[key],
  } as unknown as ConfigService;

  beforeEach(() => {
    jwtService = new JwtService({ secret: SECRET });
    repository = blacklistRepository();
    blacklist = new TokenBlacklistService(
      repository as unknown as Repository<BlacklistedToken>,
    );
    usersService = {
      findById: jest.fn().mockResolvedValue(USER),
      findUserByName: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      {} as PasswordService,
      blacklist,
      config,
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  async function signIn() {
    return service.signIn({
      userId: USER.userId,
      username: USER.username,
      role: USER.role,
    });
  }

  describe('validateUser', () => {
    it('still compares the password for an unknown username (same timing as a wrong password)', async () => {
      const passwordService = {
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      usersService.findUserByName.mockResolvedValue(undefined);
      service = new AuthService(
        usersService as unknown as UsersService,
        jwtService,
        passwordService as unknown as PasswordService,
        blacklist,
        config,
      );

      await expect(
        service.validateUser({ username: 'nobody', password: 'guess' }),
      ).resolves.toBeNull();

      expect(passwordService.validatePassword).toHaveBeenCalledTimes(1);
      expect(passwordService.validatePassword).toHaveBeenCalledWith(
        'guess',
        undefined,
      );
      expect(usersService.updateLastLogin).not.toHaveBeenCalled();
    });
  });

  describe('jti (unique token identifier)', () => {
    let dateNowSpy: jest.SpyInstance;

    beforeEach(() => {
      // Freeze the clock (without faking timers, which would also stall the
      // async, stream-based JWT signing) so two logins in the same second
      // would otherwise produce byte-identical tokens.
      dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-01-01T00:00:00.000Z').getTime());
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
    });

    it('issues different access and refresh tokens with distinct jti claims for two logins in the same second', async () => {
      const sessionA = await signIn();
      const sessionB = await signIn();

      expect(sessionA.access).not.toEqual(sessionB.access);
      expect(sessionA.refresh).not.toEqual(sessionB.refresh);

      const accessA = jwtService.decode<{ jti?: string }>(sessionA.access);
      const accessB = jwtService.decode<{ jti?: string }>(sessionB.access);
      const refreshA = jwtService.decode<{ jti?: string }>(sessionA.refresh);
      const refreshB = jwtService.decode<{ jti?: string }>(sessionB.refresh);

      expect(typeof accessA.jti).toBe('string');
      expect(typeof refreshA.jti).toBe('string');
      expect(accessA.jti).not.toEqual(accessB.jti);
      expect(refreshA.jti).not.toEqual(refreshB.jti);
    });

    it('gives the refreshed access token a fresh jti', async () => {
      const { refresh } = await signIn();

      const first = await service.refreshAccessToken(refresh);
      const second = await service.refreshAccessToken(refresh);

      expect(first.access).not.toEqual(second.access);
      const firstPayload = jwtService.decode<{ jti?: string }>(first.access);
      const secondPayload = jwtService.decode<{ jti?: string }>(second.access);
      expect(typeof firstPayload.jti).toBe('string');
      expect(firstPayload.jti).not.toEqual(secondPayload.jti);
    });
  });

  describe('refreshAccessToken', () => {
    it('issues a new access token for a valid refresh token', async () => {
      const { refresh } = await signIn();

      const { access } = await service.refreshAccessToken(refresh);

      expect(jwtService.verify(access)).toMatchObject({
        sub: USER.userId,
        role: USER.role,
      });
    });

    it('still works for another session after one session logged out', async () => {
      const sessionA = await signIn();
      // Make the second token differ from the first (iat has one-second resolution).
      const sessionB = {
        refresh: await jwtService.signAsync(
          {
            sub: USER.userId,
            username: USER.username,
            role: USER.role,
            type: 'refresh',
            sid: 'b',
          },
          { expiresIn: '2h' },
        ),
      };

      await service.logout(sessionA.refresh, USER.userId);

      await expect(
        service.refreshAccessToken(sessionA.refresh),
      ).rejects.toThrow('revoked');
      await expect(
        service.refreshAccessToken(sessionB.refresh),
      ).resolves.toHaveProperty('access');
    });

    it('rejects an access token used as a refresh token', async () => {
      const { access } = await signIn();

      await expect(service.refreshAccessToken(access)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a password-reset approval token', async () => {
      const approval = jwtService.sign({
        sub: 9,
        purpose: 'password-reset-approval',
        resetTokenId: 3,
      });

      await expect(service.refreshAccessToken(approval)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token issued before the last password reset', async () => {
      const { refresh } = await signIn();
      const { iat } = jwtService.decode<{ iat: number }>(refresh);
      usersService.findById.mockResolvedValueOnce({
        ...USER,
        passwordChangedAt: new Date(iat * 1000 + 1),
      });

      await expect(service.refreshAccessToken(refresh)).rejects.toThrow(
        new UnauthorizedException(
          'The session ended because the password was changed.',
        ),
      );
    });

    it('accepts a refresh token issued after the last password reset', async () => {
      const { refresh } = await signIn();
      const { iat } = jwtService.decode<{ iat: number }>(refresh);
      usersService.findById.mockResolvedValueOnce({
        ...USER,
        passwordChangedAt: new Date(iat * 1000),
      });

      await expect(service.refreshAccessToken(refresh)).resolves.toHaveProperty(
        'access',
      );
    });

    it('rejects a refresh token of an inactive user', async () => {
      const { refresh } = await signIn();
      usersService.findById.mockResolvedValueOnce({ ...USER, isActive: false });

      await expect(service.refreshAccessToken(refresh)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes exactly the presented refresh token until its expiry', async () => {
      const { refresh } = await signIn();
      const { exp } = jwtService.decode<{ exp: number }>(refresh);

      await expect(service.logout(refresh, USER.userId)).resolves.toEqual({
        message: 'Logged out successfully.',
      });

      expect(repository.rows).toEqual([
        {
          tokenHash: TokenBlacklistService.hashToken(refresh),
          tokenType: TokenType.REFRESH,
          userId: USER.userId,
          expiresAt: new Date(exp * 1000),
        },
      ]);
    });

    it('also revokes the access token that made the request', async () => {
      const { refresh, access } = await signIn();

      await service.logout(refresh, USER.userId, access);

      await expect(blacklist.isTokenBlacklisted(access)).resolves.toBe(true);
      expect(repository.rows.map((row) => row.tokenType)).toEqual([
        TokenType.REFRESH,
        TokenType.ACCESS,
      ]);
    });

    it('is idempotent for an already revoked token', async () => {
      const { refresh } = await signIn();
      await service.logout(refresh, USER.userId);

      await expect(service.logout(refresh, USER.userId)).resolves.toEqual({
        message: 'The token was already revoked. Logged out successfully.',
      });
      expect(repository.rows).toHaveLength(1);
    });

    it('does not blacklist an expired refresh token', async () => {
      const expired = jwtService.sign({
        sub: USER.userId,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      await expect(service.logout(expired, USER.userId)).resolves.toEqual({
        message: 'Logged out successfully.',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not blacklist a malformed token', async () => {
      await expect(service.logout('not-a-jwt', USER.userId)).resolves.toEqual({
        message: 'Logged out successfully.',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not blacklist a token signed with another secret', async () => {
      const forged = new JwtService({ secret: 'other-secret' }).sign({
        sub: USER.userId,
        type: 'refresh',
      });

      await service.logout(forged, USER.userId);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an access token sent as the refresh token', async () => {
      const { access } = await signIn();

      await expect(service.logout(access, USER.userId)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("rejects another user's refresh token", async () => {
      const { refresh } = await signIn();

      await expect(service.logout(refresh, 2)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
