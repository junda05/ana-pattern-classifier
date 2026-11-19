/**
 * Email templates for the password recovery flow
 *
 * Produces styled HTML emails using the ANA Pattern Classifier colors.
 * Every interpolated value is HTML-escaped.
 */

import type { AdminNotification } from './email.service';
import { formatMinutes } from './duration';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EmailTemplates {
  /**
   * Template for the administrator notification
   */
  getAdminNotificationTemplate(notification: AdminNotification): string {
    const userName = escapeHtml(notification.userName);
    const username = escapeHtml(notification.username);
    const userEmail = escapeHtml(notification.userEmail);
    const professionalCard = escapeHtml(notification.professionalCard);
    const userRole = escapeHtml(notification.userRole);
    const resetLink = escapeHtml(notification.resetLink);
    const expiresIn = formatMinutes(notification.expiresInMinutes);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Request</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F5F5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              
              <tr>
                <td style="background-color: #9A262B; padding: 30px; text-align: left;">
                  <p style="color: #FFFFFF; margin: 0 0 12px 0; font-size: 14px; font-weight: 600; opacity: 0.9;">
                    ANA Pattern Classifier
                  </p>
                  <h1 style="color: #FFFFFF; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">
                    New password reset request
                  </h1>
                  <p style="color: #FFFFFF; margin: 0; font-size: 14px; opacity: 0.9;">
                    Administrator notification
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #686868; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    A password reset request has been processed in the system.
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FA; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <tr>
                      <td>
                        <p style="color: #333333; font-size: 15px; font-weight: 600; margin: 0 0 15px 0; border-bottom: 2px solid #9A262B; padding-bottom: 10px;">
                          User Information
                        </p>
                        <p style="color: #686868; font-size: 14px; margin: 0 0 10px 0;">
                          <strong style="color: #333333;">Full Name:</strong> ${userName}
                        </p>
                        <p style="color: #686868; font-size: 14px; margin: 0 0 10px 0;">
                          <strong style="color: #333333;">Username:</strong> ${username}
                        </p>
                        <p style="color: #686868; font-size: 14px; margin: 0 0 10px 0;">
                          <strong style="color: #333333;">Email:</strong> ${userEmail}
                        </p>
                        <p style="color: #686868; font-size: 14px; margin: 0 0 10px 0;">
                          <strong style="color: #333333;">Professional License No.:</strong> ${professionalCard}
                        </p>
                        <p style="color: #686868; font-size: 14px; margin: 0;">
                          <strong style="color: #333333;">Role:</strong> ${userRole}
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #686868; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                    If the request is legitimate, open the link below to set a new password for this user.
                    You will be asked to confirm with your administrator credentials.
                  </p>

                  <p style="color: #686868; font-size: 14px; line-height: 1.6; margin: 20px 0 15px 0;">
                    Password reset link:
                  </p>
                  
                  <p style="color: #9A262B; font-size: 12px; word-break: break-all; background-color: #F8F9FA; padding: 12px; border-radius: 6px; border-left: 4px solid #9A262B;">
                    ${resetLink}
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #E8F4FD; border-radius: 8px; padding: 15px;">
                    <tr>
                      <td>
                        <p style="color: #004085; font-size: 13px; line-height: 1.6; margin: 0;">
                          <strong>Note:</strong> This is an automated system notification. This link expires in ${expiresIn}.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="background-color: #F8F9FA; padding: 30px; text-align: center; border-top: 1px solid #E5E5E5;">
                  <p style="color: #A6A6A6; font-size: 13px; margin: 0 0 10px 0;">
                    This is an automated email. Please do not reply.
                  </p>
                  <p style="color: #BBBBBB; font-size: 12px; margin: 0;">
                    ${new Date().getFullYear()} ANA Pattern Classifier. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
  }
}
