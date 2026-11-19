import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LessThan, MoreThan, Repository } from 'typeorm';
import {
  PASSWORD_RESET_APPROVAL_PURPOSE,
  PASSWORD_RESET_REQUEST_MESSAGE,
  PasswordResetService,
} from './password-reset.service';
import { EmailService } from './email.service';
import { PasswordService } from './password.service';
import { UsersService } from '../users/users.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { PasswordResetToken } from '../../entities/auth/password-reset-token.entity';
import { ActivityType } from '../../entities/traceabilities/traceability.types';
import { UserRole } from '../../entities/users/user.types';

const SECRET = 'unit-test-secret';

const TARGET = {
  userId: 7,
  username: 'jane.doe',
  fullName: 'Jane Doe',
  email: 'jane.doe@example.com',
  professionalCard: 'CARD-1',
  role: UserRole.STANDARD,
  isActive: true,
  password: 'hash-of-old-password',
};

const ADMIN = {
  userId: 1,
  username: 'admin',
  fullName: 'System Administrator',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  isActive: true,
  password: 'hash-of-admin-password',
};

function resetToken(
  overrides: Partial<PasswordResetToken> = {},
): PasswordResetToken {
  return {
    tokenId: 42,
    userId: TARGET.userId,
    token: 'reset-token',
    expiresAt: new Date(Date.now() + 30 * 60_000),
    isUsed: false,
    createdAt: new Date(),
    user: TARGET,
    ...overrides,
  } as PasswordResetToken;
}

describe('PasswordResetService', () => {
  let jwtService: JwtService;
  let tokenRepository: {
    findOne: jest.Mock;
    create: jest.Mock<PasswordResetToken, [Partial<PasswordResetToken>]>;
    save: jest.Mock<Promise<PasswordResetToken>, [PasswordResetToken]>;
    update: jest.Mock;
    delete: jest.Mock;
    existsBy: jest.Mock;
  };
  let usersService: {
    findByUsername: jest.Mock;
    findById: jest.Mock;
    setPassword: jest.Mock;
    findUsersByRole: jest.Mock;
  };
  let passwordService: { validatePassword: jest.Mock; hashPassword: jest.Mock };
  let emailService: { sendAdminNotificationEmail: jest.Mock };
  let traceabilityService: { logAction: jest.Mock };
  let configValues: Record<string, string | undefined>;
  let service: PasswordResetService;
  let loggerWarn: jest.SpyInstance;

  beforeEach(() => {
    jwtService = new JwtService({ secret: SECRET });
    tokenRepository = {
      findOne: jest.fn().mockResolvedValue(resetToken()),
      create: jest.fn(
        (data: Partial<PasswordResetToken>) =>
          ({ tokenId: 42, ...data }) as PasswordResetToken,
      ),
      save: jest.fn((entity: PasswordResetToken) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
      existsBy: jest.fn().mockResolvedValue(false),
    };
    usersService = {
      findByUsername: jest.fn((username: string) =>
        Promise.resolve(
          username === TARGET.username
            ? TARGET
            : username === ADMIN.username
              ? ADMIN
              : null,
        ),
      ),
      findById: jest.fn((id: number) => {
        if (id === ADMIN.userId) return Promise.resolve(ADMIN);
        if (id === TARGET.userId) return Promise.resolve(TARGET);
        return Promise.reject(
          new NotFoundException(`User with ID ${id} not found.`),
        );
      }),
      setPassword: jest.fn().mockResolvedValue(undefined),
      findUsersByRole: jest.fn().mockResolvedValue([ADMIN]),
    };
    passwordService = {
      validatePassword: jest.fn((plain: string, hash?: string) =>
        Promise.resolve(!!hash && plain === 'correct-password'),
      ),
      hashPassword: jest.fn((plain: string) =>
        Promise.resolve(`hashed:${plain}`),
      ),
    };
    emailService = {
      sendAdminNotificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    traceabilityService = { logAction: jest.fn().mockResolvedValue(undefined) };
    configValues = {
      FRONTEND_URL: 'http://localhost:3000',
      ADMIN_EMAIL: 'admin@example.com',
      PASSWORD_RESET_TOKEN_EXPIRATION: '45m',
    };
    const config = {
      get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
    } as unknown as ConfigService;

    service = new PasswordResetService(
      tokenRepository as unknown as Repository<PasswordResetToken>,
      usersService as unknown as UsersService,
      passwordService as unknown as PasswordService,
      emailService as unknown as EmailService,
      traceabilityService as unknown as TraceabilityService,
      config,
      jwtService,
    );
    loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function approvalFor(claims: Record<string, unknown> = {}): string {
    const payload = {
      sub: ADMIN.userId,
      purpose: PASSWORD_RESET_APPROVAL_PURPOSE,
      resetTokenId: 42,
      ...claims,
    };
    // A payload with its own "exp" must not also get expiresIn.
    return 'exp' in claims
      ? jwtService.sign(payload)
      : jwtService.sign(payload, { expiresIn: 600 });
  }

  describe('requestPasswordReset', () => {
    const GENERIC = { message: PASSWORD_RESET_REQUEST_MESSAGE };

    it('uses the generic message', () => {
      expect(PASSWORD_RESET_REQUEST_MESSAGE).toBe(
        'If the account exists, an administrator has been notified.',
      );
    });

    it('notifies the administrator for a valid user and returns the generic message', async () => {
      await expect(
        service.requestPasswordReset(TARGET.username),
      ).resolves.toEqual(GENERIC);

      expect(tokenRepository.save).toHaveBeenCalledTimes(1);
      const saved = tokenRepository.save.mock.calls[0][0];
      expect(saved.userId).toBe(TARGET.userId);
      expect(saved.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        44 * 60_000,
      );
      expect(saved.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
        45 * 60_000,
      );

      expect(emailService.sendAdminNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          adminEmail: 'admin@example.com',
          username: TARGET.username,
          resetLink: `http://localhost:3000/reset-password?token=${saved.token}`,
          expiresInMinutes: 45,
        }),
      );
      expect(traceabilityService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: ActivityType.PASSWORD_RESET_REQUEST,
          entityId: TARGET.userId,
        }),
      );
    });

    it.each([
      ['an unknown user', 'nobody', undefined],
      ['an inactive user', TARGET.username, { ...TARGET, isActive: false }],
      ['a user without email', TARGET.username, { ...TARGET, email: '' }],
    ])(
      'returns the identical generic message for %s and sends nothing',
      async (_label, username, user) => {
        if (user) usersService.findByUsername.mockResolvedValueOnce(user);

        await expect(service.requestPasswordReset(username)).resolves.toEqual(
          GENERIC,
        );

        expect(tokenRepository.save).not.toHaveBeenCalled();
        expect(emailService.sendAdminNotificationEmail).not.toHaveBeenCalled();
        expect(loggerWarn).toHaveBeenCalled();
      },
    );

    it('returns the generic message when no administrator email is configured', async () => {
      configValues.ADMIN_EMAIL = undefined;
      usersService.findUsersByRole.mockResolvedValueOnce([]);

      await expect(
        service.requestPasswordReset(TARGET.username),
      ).resolves.toEqual(GENERIC);
      expect(emailService.sendAdminNotificationEmail).not.toHaveBeenCalled();
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    it('looks for a pending request (unused, unexpired, created in the last 10 minutes)', async () => {
      const now = new Date('2026-09-24T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await service.requestPasswordReset(TARGET.username);

      expect(tokenRepository.existsBy).toHaveBeenCalledWith({
        userId: TARGET.userId,
        isUsed: false,
        expiresAt: MoreThan(new Date(now)),
        createdAt: MoreThan(new Date(now - 10 * 60_000)),
      });
    });

    it('keeps the pending request (no new token, previous one not voided) during the 10-minute cooldown', async () => {
      tokenRepository.existsBy.mockResolvedValueOnce(true);

      await expect(
        service.requestPasswordReset(TARGET.username),
      ).resolves.toEqual(GENERIC);

      expect(tokenRepository.update).not.toHaveBeenCalled();
      expect(tokenRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendAdminNotificationEmail).not.toHaveBeenCalled();
      expect(traceabilityService.logAction).not.toHaveBeenCalled();
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('already pending'),
      );
    });

    it('invalidates the previous tokens of the user', async () => {
      await service.requestPasswordReset(TARGET.username);

      expect(tokenRepository.update).toHaveBeenCalledWith(
        { userId: TARGET.userId, isUsed: false },
        { isUsed: true },
      );
    });
  });

  describe('validateAdminAndToken', () => {
    it('returns a 10-minute approval token bound to the admin and the reset token', async () => {
      const result = await service.validateAdminAndToken(
        'reset-token',
        ADMIN.username,
        'correct-password',
      );

      expect(result).toMatchObject({
        valid: true,
        user: { username: TARGET.username, fullName: TARGET.fullName },
        admin: { userId: ADMIN.userId, username: ADMIN.username },
      });
      const claims = jwtService.verify<{ exp: number; iat: number }>(
        result.approvalToken as string,
      );
      expect(claims).toMatchObject({
        sub: ADMIN.userId,
        purpose: PASSWORD_RESET_APPROVAL_PURPOSE,
        resetTokenId: 42,
      });
      expect(claims.exp - claims.iat).toBe(600);
    });

    it.each([
      ['an unknown administrator', 'nobody', 'correct-password'],
      ['a wrong password', ADMIN.username, 'wrong-password'],
    ])(
      'rejects %s with the same message and no approval token',
      async (_label, username, password) => {
        const result = await service.validateAdminAndToken(
          'reset-token',
          username,
          password,
        );

        expect(result).toEqual({
          valid: false,
          message: 'Invalid administrator credentials.',
        });
      },
    );

    it('still compares the password for an unknown administrator (same timing as a wrong password)', async () => {
      await service.validateAdminAndToken(
        'reset-token',
        'nobody',
        'correct-password',
      );

      expect(passwordService.validatePassword).toHaveBeenCalledTimes(1);
      expect(passwordService.validatePassword).toHaveBeenCalledWith(
        'correct-password',
        undefined,
      );
    });

    it('does not reveal the role of an account before its password is verified', async () => {
      const result = await service.validateAdminAndToken(
        'reset-token',
        TARGET.username,
        'wrong-password',
      );

      expect(result).toEqual({
        valid: false,
        message: 'Invalid administrator credentials.',
      });
    });

    it('rejects a non-admin with correct credentials', async () => {
      const result = await service.validateAdminAndToken(
        'reset-token',
        TARGET.username,
        'correct-password',
      );

      expect(result.valid).toBe(false);
      expect(result.approvalToken).toBeUndefined();
    });

    it('rejects an inactive administrator', async () => {
      usersService.findByUsername.mockResolvedValueOnce({
        ...ADMIN,
        isActive: false,
      });

      const result = await service.validateAdminAndToken(
        'reset-token',
        ADMIN.username,
        'correct-password',
      );

      expect(result.valid).toBe(false);
      expect(result.approvalToken).toBeUndefined();
    });

    it('rejects an invalid reset token before checking credentials', async () => {
      tokenRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.validateAdminAndToken(
        'bad-token',
        ADMIN.username,
        'correct-password',
      );

      expect(result).toEqual({ valid: false, message: 'Invalid token.' });
      expect(passwordService.validatePassword).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('changes the password with a valid approval and marks the reset token used', async () => {
      await expect(
        service.resetPassword('reset-token', 'N3w-password!', approvalFor()),
      ).resolves.toEqual({
        message: 'Password updated successfully.',
      });

      expect(tokenRepository.update).toHaveBeenCalledWith(
        { tokenId: 42, isUsed: false },
        { isUsed: true },
      );
      expect(usersService.setPassword).toHaveBeenCalledTimes(1);
      const [userId, hash, changedAt] = usersService.setPassword.mock
        .calls[0] as [number, string, Date];
      expect({ userId, hash }).toEqual({
        userId: TARGET.userId,
        hash: 'hashed:N3w-password!',
      });
      // Records when the password changed, so older sessions are rejected
      expect(changedAt).toBeInstanceOf(Date);
      expect(Math.abs(changedAt.getTime() - Date.now())).toBeLessThan(5_000);
      expect(traceabilityService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: ActivityType.PASSWORD_RESET_COMPLETED,
          entityId: TARGET.userId,
          userId: ADMIN.userId,
        }),
      );
    });

    it.each([
      ['a missing approval token', ''],
      [
        'an approval token signed with another secret',
        new JwtService({ secret: 'other' }).sign({
          sub: 1,
          purpose: PASSWORD_RESET_APPROVAL_PURPOSE,
          resetTokenId: 42,
        }),
      ],
      ['a token with the wrong purpose', 'WRONG_PURPOSE'],
      ['an access token', 'ACCESS_TOKEN'],
      ['an expired approval', 'EXPIRED'],
    ])('rejects %s with 401 and changes nothing', async (_label, value) => {
      const approval =
        value === 'WRONG_PURPOSE'
          ? approvalFor({ purpose: 'something-else' })
          : value === 'ACCESS_TOKEN'
            ? jwtService.sign({
                sub: ADMIN.userId,
                username: ADMIN.username,
                role: ADMIN.role,
              })
            : value === 'EXPIRED'
              ? approvalFor({ exp: Math.floor(Date.now() / 1000) - 5 })
              : value;

      await expect(
        service.resetPassword('reset-token', 'N3w-password!', approval),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('rejects an approval issued for a different reset token with 403', async () => {
      await expect(
        service.resetPassword(
          'reset-token',
          'N3w-password!',
          approvalFor({ resetTokenId: 99 }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it.each([
      ['is no longer an administrator', { ...ADMIN, role: UserRole.STANDARD }],
      ['has been deactivated', { ...ADMIN, isActive: false }],
    ])(
      'rejects the approval when the approver %s',
      async (_label, approver) => {
        usersService.findById.mockResolvedValueOnce(approver);

        await expect(
          service.resetPassword('reset-token', 'N3w-password!', approvalFor()),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(usersService.setPassword).not.toHaveBeenCalled();
      },
    );

    it('rejects the approval when the approver no longer exists', async () => {
      await expect(
        service.resetPassword(
          'reset-token',
          'N3w-password!',
          approvalFor({ sub: 999 }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a used reset token with 400', async () => {
      tokenRepository.findOne.mockResolvedValueOnce(
        resetToken({ isUsed: true }),
      );

      await expect(
        service.resetPassword('reset-token', 'N3w-password!', approvalFor()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('rejects an expired reset token with 400', async () => {
      tokenRepository.findOne.mockResolvedValueOnce(
        resetToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.resetPassword('reset-token', 'N3w-password!', approvalFor()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects the second of two concurrent resets (token already claimed)', async () => {
      tokenRepository.update.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.resetPassword('reset-token', 'N3w-password!', approvalFor()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('removeStaleTokens', () => {
    it('deletes expired and used reset tokens', async () => {
      const now = new Date('2026-09-24T12:00:00Z');

      await expect(service.removeStaleTokens(now)).resolves.toBe(3);

      expect(tokenRepository.delete).toHaveBeenCalledWith([
        { expiresAt: LessThan(now) },
        { isUsed: true },
      ]);
    });
  });
});
