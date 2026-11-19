import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, JwtStrategy } from './jwt.strategy';
import { TokenBlacklistService } from '../token-blacklist.service';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../../entities/users/user.types';

const TOKEN = 'header.payload.signature';

function request(token = TOKEN): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
  } as unknown as Request;
}

describe('JwtStrategy', () => {
  let isTokenBlacklisted: jest.Mock;
  let findById: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    isTokenBlacklisted = jest.fn().mockResolvedValue(false);
    findById = jest.fn().mockResolvedValue({
      userId: 1,
      isActive: true,
      role: UserRole.ADMIN,
    });
    const config = {
      get: () => 'unit-test-secret',
    } as unknown as ConfigService;
    strategy = new JwtStrategy(
      config,
      { isTokenBlacklisted } as unknown as TokenBlacklistService,
      { findById } as unknown as UsersService,
    );
  });

  it('accepts an access token and exposes the user', async () => {
    const user = await strategy.validate(request(), {
      sub: 1,
      username: 'jane.doe',
      role: UserRole.ADMIN,
    });

    expect(user).toEqual({
      userId: 1,
      username: 'jane.doe',
      role: UserRole.ADMIN,
    });
    expect(isTokenBlacklisted).toHaveBeenCalledWith(TOKEN);
  });

  it('rejects a token issued before the last password reset', async () => {
    findById.mockResolvedValueOnce({
      userId: 1,
      isActive: true,
      role: UserRole.ADMIN,
      passwordChangedAt: new Date('2026-09-24T12:00:00.000Z'),
    });

    await expect(
      strategy.validate(request(), {
        sub: 1,
        username: 'jane.doe',
        role: UserRole.ADMIN,
        iat: Date.parse('2026-09-24T11:59:00Z') / 1000,
      }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'The session ended because the password was changed.',
      ),
    );
  });

  it('accepts a token issued after the last password reset', async () => {
    findById.mockResolvedValueOnce({
      userId: 1,
      isActive: true,
      role: UserRole.ADMIN,
      passwordChangedAt: new Date('2026-09-24T12:00:00.000Z'),
    });

    await expect(
      strategy.validate(request(), {
        sub: 1,
        username: 'jane.doe',
        role: UserRole.ADMIN,
        iat: Date.parse('2026-09-24T12:05:00Z') / 1000,
      }),
    ).resolves.toMatchObject({ userId: 1 });
  });

  it('rejects a refresh token on protected routes', async () => {
    await expect(
      strategy.validate(request(), {
        sub: 1,
        username: 'jane.doe',
        role: UserRole.ADMIN,
        type: 'refresh',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a password-reset approval token', async () => {
    await expect(
      strategy.validate(request(), {
        sub: 1,
        purpose: 'password-reset-approval',
        resetTokenId: 3,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['no role', { sub: 1, username: 'jane.doe' }],
    ['an unknown role', { sub: 1, username: 'jane.doe', role: 'ROOT' }],
    ['no username', { sub: 1, role: UserRole.ADMIN }],
    [
      'a non-numeric subject',
      { sub: '1', username: 'jane.doe', role: UserRole.ADMIN },
    ],
  ])('rejects an access token with %s', async (_case, payload) => {
    await expect(
      strategy.validate(request(), payload as unknown as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked access token', async () => {
    isTokenBlacklisted.mockResolvedValueOnce(true);

    await expect(
      strategy.validate(request(), {
        sub: 1,
        username: 'jane.doe',
        role: UserRole.STANDARD,
      }),
    ).rejects.toThrow('The token has been revoked.');
  });

  const ACCESS: JwtPayload = {
    sub: 1,
    username: 'jane.doe',
    role: UserRole.STANDARD,
  };

  it('loads the user of the token', async () => {
    await strategy.validate(request(), ACCESS);

    expect(findById).toHaveBeenCalledWith(1);
  });

  it('takes the role from the database, not from the token', async () => {
    findById.mockResolvedValueOnce({
      userId: 1,
      isActive: true,
      role: UserRole.STANDARD,
    });

    const user = await strategy.validate(request(), {
      sub: 1,
      username: 'jane.doe',
      role: UserRole.ADMIN,
    });

    expect(user.role).toBe(UserRole.STANDARD);
  });

  it('rejects the token of a deactivated user', async () => {
    findById.mockResolvedValueOnce({ userId: 1, isActive: false });

    const error: unknown = await strategy
      .validate(request(), ACCESS)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as Error).message).toBe('User not found or inactive.');
  });

  it('rejects the token of a user that no longer exists', async () => {
    findById.mockRejectedValueOnce(
      new NotFoundException('User with ID 1 not found.'),
    );

    await expect(strategy.validate(request(), ACCESS)).rejects.toThrow(
      new UnauthorizedException('User not found or inactive.'),
    );
  });

  it('does not turn a database failure into a 401', async () => {
    findById.mockRejectedValueOnce(new InternalServerErrorException());

    await expect(strategy.validate(request(), ACCESS)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('does not load the user of a revoked token', async () => {
    isTokenBlacklisted.mockResolvedValueOnce(true);

    await expect(strategy.validate(request(), ACCESS)).rejects.toThrow(
      'The token has been revoked.',
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
