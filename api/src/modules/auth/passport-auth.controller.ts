/**
 * Authentication controller using Passport.js
 *
 * Handles all authentication-related endpoints
 * Base route: /api/v1/auth
 *
 * Available endpoints:
 *
 * POST /api/v1/auth/login
 * - Authentication with username/password
 * - Protected by PassportLocalGuard
 * - Body: { username: string, password: string }
 * - Returns: { access: string, refresh: string }
 *
 * POST /api/v1/auth/refresh-access
 * - Renews the access token using the refresh token
 * - Body: { refresh: string }
 * - Returns: { access: string }
 *
 * POST /api/v1/auth/logout
 * - Secure logout that revokes the refresh token and the access token of the request
 * - Protected by PassportJwtAuthGuard
 * - Body: { refresh: string }
 * - Returns: { success: true, message: string }
 *
 * GET /api/v1/auth/profile
 * - Returns the profile of the authenticated user
 * - Protected by PassportJwtAuthGuard
 * - Returns: { success: true, user: UserProfile }
 *
 * POST /api/v1/auth/request-password-reset
 * - Body: { username }
 * - Always returns 200 { success: true, message: "If the account exists, an
 *   administrator has been notified." } (never reveals whether the account exists)
 *
 * POST /api/v1/auth/validate-reset-token
 * - Body: { token }
 * - Returns 200 { success, valid, message?, user? }
 *
 * POST /api/v1/auth/validate-admin-and-token
 * - Body: { token, adminUsername, adminPassword }
 * - Returns 200 { success: true, valid: true, user, admin, approvalToken }
 *   (approvalToken is valid for 10 minutes) or 200 { success: false, valid: false, message }
 *
 * POST /api/v1/auth/reset-password
 * - Body: { token, newPassword, approvalToken }
 * - Returns 200 { success: true, message }
 *
 * Errors of profile, request-password-reset and reset-password use the HTTP
 * status of the failure (400/401/403/404, 500 for unexpected errors) with the
 * body { success: false, error: string, detail: string }; the validate-*
 * endpoints use { success: false, valid: false, message: string }.
 * Unexpected errors are logged and reported with a generic detail.
 *
 * Rate limits (per client IP, see auth-rate-limit.ts): login, refresh-access,
 * request-password-reset, validate-admin-and-token and reset-password answer
 * 429 "Too many requests. Please try again later." above their limit.
 *
 * Routes are centralized in auth.routes.ts
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import type {
  AuthenticatedRequest,
  LoginRequest,
} from './authenticated-request';
import { PassportLocalGuard } from './guards/passport-local.guard';
import { PassportJwtAuthGuard } from './guards/passport-jwt.guard';
import { LogoutDto } from '../../DTOs/auth/logout.dto';
import { RefreshTokenDto } from '../../DTOs/auth/refresh-token.dto';
import { RequestPasswordResetDto } from '../../DTOs/auth/request-password-reset.dto';
import { ValidateResetTokenDto } from '../../DTOs/auth/validate-reset-token.dto';
import { ResetPasswordDto } from '../../DTOs/auth/reset-password.dto';
import { ValidateAdminAndTokenDto } from '../../DTOs/auth/validate-admin-and-token.dto';
import { UsersService } from '../users/users.service';
import { PasswordResetService } from './password-reset.service';
import { AUTH_ROUTES } from './auth.routes';
import { AuthRateLimit } from './auth-rate-limit';
import { toHttpException } from '../../common/errors/http-errors';

type ErrorEnvelope = { success: false; error: string; detail: string };
type ValidationEnvelope = { success: false; valid: false; message: string };

@Controller(AUTH_ROUTES.BASE)
export class PassportAuthController {
  private readonly logger = new Logger(PassportAuthController.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private passwordResetService: PasswordResetService,
  ) {}

  /**
   * POST /api/v1/auth/login
   * Authentication with username/password
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGIN)
  @UseGuards(PassportLocalGuard)
  @AuthRateLimit('login') // Below the local guard: counted before the credential check
  login(@Request() request: LoginRequest) {
    return this.authService.signIn(request.user);
  }

  /**
   * POST /api/v1/auth/refresh-access
   * Renews the access token
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REFRESH_TOKEN)
  @AuthRateLimit('refresh')
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshAccessToken(body.refresh);
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token and the access token of the request
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGOUT)
  @UseGuards(PassportJwtAuthGuard)
  async logout(
    @Body() body: LogoutDto,
    @Request() request: AuthenticatedRequest,
  ) {
    const accessToken =
      ExtractJwt.fromAuthHeaderAsBearerToken()(request) ?? undefined;
    const result = await this.authService.logout(
      body.refresh,
      request.user.userId,
      accessToken,
    );
    return {
      success: true,
      message: result.message,
    };
  }

  /**
   * GET /api/v1/auth/profile
   * Returns the profile of the authenticated user
   */
  @Get(AUTH_ROUTES.PROFILE)
  @UseGuards(PassportJwtAuthGuard)
  async getUserProfile(
    @Request() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = await this.usersService.getProfile(request.user.userId);
      return { success: true, user };
    } catch (error) {
      return this.failure(res, error, 'Could not retrieve the user data.');
    }
  }

  /**
   * POST /api/v1/auth/request-password-reset
   * Requests a password change (always the same generic answer)
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REQUEST_PASSWORD_RESET)
  @AuthRateLimit('passwordReset')
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.passwordResetService.requestPasswordReset(
        body.username,
      );
      return { success: true, message: result.message };
    } catch (error) {
      return this.failure(res, error, 'Could not process the request.');
    }
  }

  /**
   * POST /api/v1/auth/validate-reset-token
   * Validates a password reset token
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.VALIDATE_RESET_TOKEN)
  async validateResetToken(
    @Body() body: ValidateResetTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.passwordResetService.validateResetToken(
        body.token,
      );
      return { success: result.valid, ...result };
    } catch (error) {
      return this.validationFailure(
        res,
        error,
        'Could not validate the token.',
      );
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   * Resets the password with a valid token and an administrator approval token
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESET_PASSWORD)
  @AuthRateLimit('passwordReset')
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.passwordResetService.resetPassword(
        body.token,
        body.newPassword,
        body.approvalToken,
      );
      return { success: true, message: result.message };
    } catch (error) {
      return this.failure(res, error, 'Could not change the password.');
    }
  }

  /**
   * POST /api/v1/auth/validate-admin-and-token
   * Validates the admin credentials and the reset token together; on success
   * returns the approval token required by reset-password
   */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.VALIDATE_ADMIN_AND_TOKEN)
  @AuthRateLimit('passwordReset')
  async validateAdminAndToken(
    @Body() body: ValidateAdminAndTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.passwordResetService.validateAdminAndToken(
        body.token,
        body.adminUsername,
        body.adminPassword,
      );
      return { success: result.valid, ...result };
    } catch (error) {
      return this.validationFailure(
        res,
        error,
        'Could not validate the credentials.',
      );
    }
  }

  /** { success: false, error, detail } with the failure's HTTP status; unexpected errors get a generic detail. */
  private failure(res: Response, error: unknown, label: string): ErrorEnvelope {
    const httpError = toHttpException(error, this.logger, label);
    res.status(httpError.getStatus());
    return { success: false, error: label, detail: httpError.message };
  }

  /** { success: false, valid: false, message } with the failure's HTTP status. */
  private validationFailure(
    res: Response,
    error: unknown,
    message: string,
  ): ValidationEnvelope {
    const httpError = toHttpException(error, this.logger, message);
    res.status(httpError.getStatus());
    return { success: false, valid: false, message };
  }
}
