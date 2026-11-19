/**
 * Email delivery service backed by SendGrid
 *
 * Email is a best-effort notification channel: the API boots without it.
 * When SENDGRID_API_KEY is missing (or still a "change-me" placeholder) a
 * warning is logged at boot and no email is sent:
 * - outside production (NODE_ENV !== 'production') the administrator
 *   notification, including the reset link, is logged at WARN level so a
 *   local installation can complete the password-reset flow
 * - in production only the fact that the email was skipped is logged (the
 *   reset link never reaches the logs)
 * Delivery failures are logged and never thrown.
 *
 * Environment variables:
 * - SENDGRID_API_KEY: SendGrid API key (optional)
 * - SENDGRID_FROM_EMAIL: verified sender email (required to send)
 * - SENDGRID_FROM_NAME: sender name
 * - NODE_ENV: 'production' keeps reset links out of the logs
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { EmailTemplates } from './email-templates';

/** Data of the password-reset notification sent to the administrator */
export interface AdminNotification {
  adminEmail: string;
  /** Full name of the user requesting the reset */
  userName: string;
  username: string;
  userEmail: string;
  professionalCard: string;
  userRole: string;
  resetLink: string;
  /** Lifetime of the reset link, from PASSWORD_RESET_TOKEN_EXPIRATION */
  expiresInMinutes: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailTemplates = new EmailTemplates();
  private readonly enabled: boolean;
  private readonly production: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY')?.trim();
    this.enabled = !!apiKey && !apiKey.toLowerCase().startsWith('change-me');
    this.production =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (this.enabled) {
      sgMail.setApiKey(apiKey as string);
    } else {
      this.logger.warn(
        this.production
          ? 'SENDGRID_API_KEY is not set; password-reset notifications will not be emailed.'
          : 'SENDGRID_API_KEY is not set; password-reset notifications (with the reset link) will be logged instead of emailed.',
      );
    }
  }

  /**
   * Notifies the administrator about a password reset request.
   * Never throws: problems are logged.
   */
  async sendAdminNotificationEmail(
    notification: AdminNotification,
  ): Promise<void> {
    if (!this.enabled) {
      this.logSkippedNotification(notification);
      return;
    }

    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!fromEmail) {
      this.logger.error(
        'SENDGRID_FROM_EMAIL is not set; administrator notification skipped.',
      );
      return;
    }
    const fromName = this.configService.get<string>('SENDGRID_FROM_NAME');

    try {
      await sgMail.send({
        to: notification.adminEmail,
        from: { email: fromEmail, name: fromName || 'ANA Pattern Classifier' },
        subject: 'Password Reset Request - ANA Pattern Classifier',
        html: this.emailTemplates.getAdminNotificationTemplate(notification),
      });
      this.logger.log('Password-reset notification sent to the administrator.');
    } catch (error) {
      this.logger.error(
        'Could not send the password-reset notification',
        (error as Error).stack,
      );
    }
  }

  /** Without SendGrid: the link is logged outside production only. */
  private logSkippedNotification(notification: AdminNotification): void {
    if (this.production) {
      this.logger.warn(
        'Email disabled; the password-reset notification to the administrator was skipped.',
      );
      return;
    }
    this.logger.warn(
      `Email disabled (development only): password-reset request for user "${notification.username}". ` +
        `Reset link, valid for ${notification.expiresInMinutes} minutes: ${notification.resetLink}`,
    );
  }
}
