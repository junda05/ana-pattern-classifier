import {
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { PassportAuthController } from './passport-auth.controller';
import { AuthService } from './auth.service';
import {
  PasswordResetService,
  PASSWORD_RESET_REQUEST_MESSAGE,
} from './password-reset.service';
import { UsersService } from '../users/users.service';

function mockResponse() {
  const res = { status: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('PassportAuthController', () => {
  let passwordReset: {
    requestPasswordReset: jest.Mock;
    validateResetToken: jest.Mock;
    validateAdminAndToken: jest.Mock;
    resetPassword: jest.Mock;
  };
  let controller: PassportAuthController;
  let res: ReturnType<typeof mockResponse>;

  beforeEach(() => {
    passwordReset = {
      requestPasswordReset: jest.fn(),
      validateResetToken: jest.fn(),
      validateAdminAndToken: jest.fn(),
      resetPassword: jest.fn(),
    };
    controller = new PassportAuthController(
      {} as AuthService,
      {} as UsersService,
      passwordReset as unknown as PasswordResetService,
    );
    res = mockResponse();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('request-password-reset always answers with the generic success', async () => {
    passwordReset.requestPasswordReset.mockResolvedValueOnce({
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    });

    await expect(
      controller.requestPasswordReset(
        { username: 'nobody' },
        res as unknown as Response,
      ),
    ).resolves.toEqual({
      success: true,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    });
  });

  it('validate-admin-and-token returns the approval token', async () => {
    passwordReset.validateAdminAndToken.mockResolvedValueOnce({
      valid: true,
      approvalToken: 'signed',
    });

    await expect(
      controller.validateAdminAndToken(
        {
          token: 't',
          adminUsername: 'admin',
          adminPassword: 'secret-password',
        },
        res as unknown as Response,
      ),
    ).resolves.toEqual({ success: true, valid: true, approvalToken: 'signed' });
  });

  it('validate-admin-and-token hides unexpected errors behind a generic message', async () => {
    passwordReset.validateAdminAndToken.mockRejectedValueOnce(
      new Error('database down'),
    );

    const body = await controller.validateAdminAndToken(
      { token: 't', adminUsername: 'admin', adminPassword: 'secret-password' },
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body).toEqual({
      success: false,
      valid: false,
      message: 'Could not validate the credentials.',
    });
  });

  it('validate-reset-token uses the style-guide error message', async () => {
    passwordReset.validateResetToken.mockRejectedValueOnce(
      new Error('database down'),
    );

    const body = await controller.validateResetToken(
      { token: 't' },
      res as unknown as Response,
    );

    expect(body).toEqual({
      success: false,
      valid: false,
      message: 'Could not validate the token.',
    });
  });

  it('reset-password forwards the approval token (no adminUserId)', async () => {
    passwordReset.resetPassword.mockResolvedValueOnce({
      message: 'Password updated successfully.',
    });

    await expect(
      controller.resetPassword(
        { token: 't', newPassword: 'N3w-password!', approvalToken: 'signed' },
        res as unknown as Response,
      ),
    ).resolves.toEqual({
      success: true,
      message: 'Password updated successfully.',
    });
    expect(passwordReset.resetPassword).toHaveBeenCalledWith(
      't',
      'N3w-password!',
      'signed',
    );
  });

  it.each([
    [
      new ForbiddenException(
        'The administrator approval does not match this reset request.',
      ),
      403,
    ],
    [new BadRequestException('The token has already been used.'), 400],
  ])(
    'reset-password answers %s with its status and the detail envelope',
    async (error, status) => {
      passwordReset.resetPassword.mockRejectedValueOnce(error);

      const body = await controller.resetPassword(
        { token: 't', newPassword: 'N3w-password!', approvalToken: 'signed' },
        res as unknown as Response,
      );

      expect(res.status).toHaveBeenCalledWith(status);
      expect(body).toEqual({
        success: false,
        error: 'Could not change the password.',
        detail: error.message,
      });
    },
  );

  it('reset-password does not leak unexpected error details', async () => {
    passwordReset.resetPassword.mockRejectedValueOnce(
      new Error('SQL timeout on Users'),
    );

    const body = await controller.resetPassword(
      { token: 't', newPassword: 'N3w-password!', approvalToken: 'signed' },
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(body)).not.toContain('SQL');
  });
});
