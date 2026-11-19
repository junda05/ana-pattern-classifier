/**
 * Password recovery service (administrator-approved)
 *
 * Flow:
 * 1. requestPasswordReset(): a user asks for a reset. If the account exists,
 *    is active and has an email, a single-use reset token is stored and the
 *    administrator is emailed a reset link. The response is always the same
 *    generic message, so it never reveals whether an account exists; the
 *    real outcome is logged server-side. While a request made in the last
 *    10 minutes is still pending (unused, unexpired), a new request neither
 *    creates a token nor voids the pending one (same generic response).
 * 2. validateResetToken(): the reset page checks the link (unused, unexpired).
 * 3. validateAdminAndToken(): an administrator confirms with their own
 *    credentials and receives a short-lived signed approval token
 *    (JWT, purpose 'password-reset-approval', sub = admin id, resetTokenId,
 *    valid for 10 minutes).
 * 4. resetPassword(): requires the approval token; checks its purpose, that
 *    it was issued for this reset token and that the approver is still an
 *    active administrator. The reset token is claimed atomically, the
 *    password is changed and the change is attributed to the administrator.
 *    The change time is stored (Users.passwordChangedAt), so every session
 *    of the user issued before the reset ends.
 * Every step is recorded in the audit trail (REQUEST, COMPLETED or EXPIRED).
 *
 * Stale tokens (expired or used) are deleted periodically by
 * AuthTokenCleanupService through removeStaleTokens().
 */

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { PasswordResetToken } from '../../entities/auth/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { EmailService } from './email.service';
import { TraceabilityService } from '../traceability/traceability.service';
import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';
import { UserRole } from '../../entities/users/user.types';
import { parseDurationMinutes } from './duration';

/** JWT "purpose" claim of password-reset approval tokens. */
export const PASSWORD_RESET_APPROVAL_PURPOSE = 'password-reset-approval';

/** The only response of requestPasswordReset, whatever the outcome. */
export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If the account exists, an administrator has been notified.';

const APPROVAL_TOKEN_TTL_SECONDS = 10 * 60;
/** A pending reset request younger than this blocks new requests of the same user. */
const RESET_REQUEST_COOLDOWN_MS = 10 * 60_000;
const DEFAULT_RESET_TOKEN_MINUTES = 30;
const INVALID_ADMIN_CREDENTIALS = 'Invalid administrator credentials.';
const INVALID_APPROVAL =
  'The administrator approval is invalid or has expired.';

interface ApprovalClaims {
  sub: number;
  purpose: string;
  resetTokenId: number;
}

export interface ResetUserSummary {
  fullName: string;
  username: string;
  email: string;
  professionalCard: string;
  role: string;
}

export interface ValidateAdminAndTokenResult {
  valid: boolean;
  message?: string;
  user?: ResetUserSummary;
  admin?: { userId: number; fullName: string; username: string };
  approvalToken?: string;
}

type TokenLookup =
  | { token: PasswordResetToken; message?: undefined }
  | { token?: undefined; message: string };

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject('PASSWORD_RESET_TOKEN_REPOSITORY')
    private tokenRepository: Repository<PasswordResetToken>,
    private usersService: UsersService,
    private passwordService: PasswordService,
    private emailService: EmailService,
    private traceabilityService: TraceabilityService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  /**
   * Requests a password reset for a user and notifies the administrator.
   * Always resolves to the same generic message.
   */
  async requestPasswordReset(username: string): Promise<{ message: string }> {
    const generic = { message: PASSWORD_RESET_REQUEST_MESSAGE };

    const user = await this.usersService.findByUsername(username);
    if (!user) {
      this.logger.warn(
        'Password reset requested for an unknown username; nothing sent.',
      );
      return generic;
    }
    if (!user.isActive) {
      this.logger.warn(
        `Password reset requested for inactive user ${user.userId}; nothing sent.`,
      );
      return generic;
    }
    if (!user.email) {
      this.logger.warn(
        `Password reset requested for user ${user.userId}, who has no email; nothing sent.`,
      );
      return generic;
    }

    const adminEmail = await this.getAdminEmail();
    if (!adminEmail) {
      this.logger.error(
        `Password reset requested for user ${user.userId}, but no administrator email is configured (ADMIN_EMAIL); nothing sent.`,
      );
      return generic;
    }

    const now = Date.now();
    if (await this.hasRecentPendingRequest(user.userId, now)) {
      this.logger.warn(
        `Password reset requested for user ${user.userId}, but a recent request is already pending; nothing sent.`,
      );
      return generic;
    }

    // Only the newest link of a user stays valid
    await this.invalidatePreviousTokens(user.userId);

    const expirationMinutes = this.getTokenExpirationMinutes();
    const token = randomBytes(32).toString('base64url');
    const resetToken = this.tokenRepository.create({
      userId: user.userId,
      token,
      expiresAt: new Date(now + expirationMinutes * 60_000),
      isUsed: false,
    });
    await this.tokenRepository.save(resetToken);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    await this.emailService.sendAdminNotificationEmail({
      adminEmail,
      userName: user.fullName,
      username: user.username,
      userEmail: user.email,
      professionalCard: user.professionalCard || 'Not recorded',
      userRole: this.getRoleDisplayName(user.role),
      resetLink: `${frontendUrl}/reset-password?token=${token}`,
      expiresInMinutes: expirationMinutes,
    });

    await this.traceabilityService.logAction({
      activityType: ActivityType.PASSWORD_RESET_REQUEST,
      entityType: EntityType.USER,
      entityId: user.userId,
      userId: user.userId,
      fieldChanged: 'password_reset_request',
      newValue: 'Password reset requested',
    });

    this.logger.log(
      `Password reset requested for user ${user.userId}; administrator notified.`,
    );
    return generic;
  }

  /**
   * Validates a recovery token: it must exist, be unused and unexpired.
   * @returns Whether the token is valid, plus the user's details
   */
  async validateResetToken(token: string): Promise<{
    valid: boolean;
    message?: string;
    user?: ResetUserSummary;
  }> {
    const lookup = await this.findUsableToken(token);
    if (!lookup.token) {
      return { valid: false, message: lookup.message };
    }
    return { valid: true, user: this.summarize(lookup.token) };
  }

  /**
   * Validates an administrator's credentials together with the reset token.
   * On success returns a short-lived approval token that resetPassword requires.
   *
   * The account's role and status are only disclosed after its password has
   * been verified.
   */
  async validateAdminAndToken(
    token: string,
    adminUsername: string,
    adminPassword: string,
  ): Promise<ValidateAdminAndTokenResult> {
    const lookup = await this.findUsableToken(token);
    if (!lookup.token) {
      return { valid: false, message: lookup.message };
    }

    const admin = await this.usersService.findByUsername(adminUsername);
    // An unknown username still costs one (dummy) bcrypt comparison
    const passwordMatches = await this.passwordService.validatePassword(
      adminPassword,
      admin?.password,
    );
    if (!admin || !passwordMatches) {
      return { valid: false, message: INVALID_ADMIN_CREDENTIALS };
    }

    if (admin.role !== UserRole.ADMIN) {
      return {
        valid: false,
        message: 'The user does not have administrator privileges.',
      };
    }

    if (!admin.isActive) {
      return { valid: false, message: 'The administrator user is inactive.' };
    }

    const claims: ApprovalClaims = {
      sub: admin.userId,
      purpose: PASSWORD_RESET_APPROVAL_PURPOSE,
      resetTokenId: lookup.token.tokenId,
    };
    const approvalToken = await this.jwtService.signAsync(claims, {
      expiresIn: APPROVAL_TOKEN_TTL_SECONDS,
    });

    return {
      valid: true,
      user: this.summarize(lookup.token),
      admin: {
        userId: admin.userId,
        fullName: admin.fullName,
        username: admin.username,
      },
      approvalToken,
    };
  }

  /**
   * Resets a user's password with a valid reset token and administrator approval.
   *
   * @throws UnauthorizedException if the approval token is missing, invalid,
   *         expired or not a password-reset approval
   * @throws ForbiddenException if the approval was issued for another reset
   *         token or the approver is no longer an active administrator
   * @throws BadRequestException if the reset token is invalid, used or expired
   */
  async resetPassword(
    token: string,
    newPassword: string,
    approvalToken: string,
  ): Promise<{ message: string }> {
    const approval = await this.verifyApproval(approvalToken);

    const lookup = await this.findUsableToken(token);
    if (!lookup.token) {
      throw new BadRequestException(lookup.message);
    }
    const resetToken = lookup.token;

    if (approval.resetTokenId !== resetToken.tokenId) {
      throw new ForbiddenException(
        'The administrator approval does not match this reset request.',
      );
    }

    const approver = await this.usersService
      .findById(approval.sub)
      .catch(() => null);
    if (!approver || approver.role !== UserRole.ADMIN || !approver.isActive) {
      throw new ForbiddenException(
        'The approving administrator is no longer authorized.',
      );
    }

    // Claim the token atomically so two concurrent requests cannot both use it
    const claim = await this.tokenRepository.update(
      { tokenId: resetToken.tokenId, isUsed: false },
      { isUsed: true },
    );
    if (!claim.affected) {
      throw new BadRequestException('The token has already been used.');
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword);
    // Every session issued before this instant ends (JwtStrategy, refresh)
    await this.usersService.setPassword(
      resetToken.userId,
      hashedPassword,
      new Date(),
    );

    await this.traceabilityService.logAction({
      activityType: ActivityType.PASSWORD_RESET_COMPLETED,
      entityType: EntityType.USER,
      entityId: resetToken.userId,
      userId: approver.userId,
      fieldChanged: 'password',
      previousValue: '********',
      newValue: 'Password changed successfully',
    });

    this.logger.log(
      `Password reset for user ${resetToken.userId}, approved by administrator ${approver.userId}.`,
    );
    return { message: 'Password updated successfully.' };
  }

  /**
   * Deletes reset tokens that are expired or already used.
   * @returns Number of deleted tokens
   */
  async removeStaleTokens(now: Date = new Date()): Promise<number> {
    const result = await this.tokenRepository.delete([
      { expiresAt: LessThan(now) },
      { isUsed: true },
    ]);
    return result.affected ?? 0;
  }

  private async verifyApproval(approvalToken: string): Promise<ApprovalClaims> {
    if (!approvalToken) {
      throw new UnauthorizedException('Administrator approval is required.');
    }

    let claims: Partial<ApprovalClaims>;
    try {
      claims = await this.jwtService.verifyAsync<
        Partial<ApprovalClaims> & object
      >(approvalToken);
    } catch {
      throw new UnauthorizedException(INVALID_APPROVAL);
    }

    if (
      claims.purpose !== PASSWORD_RESET_APPROVAL_PURPOSE ||
      typeof claims.sub !== 'number' ||
      typeof claims.resetTokenId !== 'number'
    ) {
      throw new UnauthorizedException(INVALID_APPROVAL);
    }
    return claims as ApprovalClaims;
  }

  /** Loads a reset token that is unused and unexpired (logs expiry to the audit trail). */
  private async findUsableToken(token: string): Promise<TokenLookup> {
    const resetToken = await this.tokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      return { message: 'Invalid token.' };
    }

    if (resetToken.isUsed) {
      return { message: 'The token has already been used.' };
    }

    if (new Date() > resetToken.expiresAt) {
      await this.traceabilityService.logAction({
        activityType: ActivityType.PASSWORD_RESET_EXPIRED,
        entityType: EntityType.USER,
        entityId: resetToken.userId,
        userId: resetToken.userId,
        fieldChanged: 'password_reset_expired',
        newValue: 'Password reset link expired',
      });
      return { message: 'The token has expired.' };
    }

    return { token: resetToken };
  }

  private summarize(resetToken: PasswordResetToken): ResetUserSummary {
    return {
      fullName: resetToken.user.fullName,
      username: resetToken.user.username,
      email: resetToken.user.email,
      professionalCard: resetToken.user.professionalCard || 'Not recorded',
      role: this.getRoleDisplayName(resetToken.user.role),
    };
  }

  /** Whether the user has an unused, unexpired token created within the cooldown */
  private hasRecentPendingRequest(
    userId: number,
    now: number,
  ): Promise<boolean> {
    return this.tokenRepository.existsBy({
      userId,
      isUsed: false,
      expiresAt: MoreThan(new Date(now)),
      createdAt: MoreThan(new Date(now - RESET_REQUEST_COOLDOWN_MS)),
    });
  }

  /** Marks every unused token of the user as used */
  private async invalidatePreviousTokens(userId: number): Promise<void> {
    await this.tokenRepository.update(
      { userId, isUsed: false },
      { isUsed: true },
    );
  }

  /** Reset-link lifetime from PASSWORD_RESET_TOKEN_EXPIRATION (e.g. "30m", "2h"; default 30 minutes) */
  private getTokenExpirationMinutes(): number {
    const configured = this.configService.get<string>(
      'PASSWORD_RESET_TOKEN_EXPIRATION',
    );
    const minutes = parseDurationMinutes(configured);
    if (minutes === null) {
      if (configured) {
        this.logger.warn(
          `Invalid PASSWORD_RESET_TOKEN_EXPIRATION "${configured}"; using ${DEFAULT_RESET_TOKEN_MINUTES} minutes.`,
        );
      }
      return DEFAULT_RESET_TOKEN_MINUTES;
    }
    return minutes;
  }

  /**
   * Administrator email that receives reset requests: ADMIN_EMAIL, otherwise
   * the first active ADMIN user; null if there is none.
   */
  private async getAdminEmail(): Promise<string | null> {
    const configAdminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (configAdminEmail) {
      return configAdminEmail;
    }

    try {
      const adminUsers = await this.usersService.findUsersByRole(
        UserRole.ADMIN,
      );
      return (
        adminUsers.find((admin) => admin.isActive && admin.email)?.email ?? null
      );
    } catch (error) {
      this.logger.error(
        'Could not look up an administrator email',
        (error as Error).stack,
      );
      return null;
    }
  }

  /** Human-readable role name */
  private getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'Administrator',
      [UserRole.STANDARD]: 'Standard',
    };
    return roleNames[role] || role;
  }
}
