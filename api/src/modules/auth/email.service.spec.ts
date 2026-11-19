import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { AdminNotification, EmailService } from './email.service';
import { EmailTemplates } from './email-templates';

jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), send: jest.fn() },
}));

const mockedMail = sgMail as unknown as {
  setApiKey: jest.Mock<void, [string]>;
  send: jest.Mock<Promise<unknown>, [MailDataRequired]>;
};

const NOTIFICATION: AdminNotification = {
  adminEmail: 'admin@example.com',
  userName: 'Jane Doe',
  username: 'jane.doe',
  userEmail: 'jane.doe@example.com',
  professionalCard: 'CARD-1',
  userRole: 'Standard',
  resetLink: 'http://localhost:3000/reset-password?token=abc',
  expiresInMinutes: 45,
};

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('EmailService', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  let debug: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    debug = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Every message passed to the logger, at any level. */
  function loggedMessages(): string[] {
    return [warn, error, log, debug].flatMap((spy) =>
      spy.mock.calls.map((call: unknown[]) => String(call[0])),
    );
  }

  it.each([undefined, '', 'change-me'])(
    'boots without a usable SENDGRID_API_KEY (%p) and never sends',
    async (key) => {
      const service = new EmailService(
        config({
          SENDGRID_API_KEY: key,
          SENDGRID_FROM_EMAIL: 'no-reply@example.com',
          NODE_ENV: 'production',
        }),
      );

      await service.sendAdminNotificationEmail(NOTIFICATION);

      expect(mockedMail.setApiKey).not.toHaveBeenCalled();
      expect(mockedMail.send).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 'development', 'test'])(
    'without SendGrid outside production (NODE_ENV=%p) logs the notification with the reset link at WARN',
    async (nodeEnv) => {
      const service = new EmailService(
        config({ SENDGRID_API_KEY: '', NODE_ENV: nodeEnv }),
      );
      warn.mockClear();

      await service.sendAdminNotificationEmail(NOTIFICATION);

      expect(mockedMail.send).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String((warn.mock.calls as unknown[][])[0][0]);
      expect(message).toContain(NOTIFICATION.resetLink);
      expect(message).toContain(NOTIFICATION.username);
      expect(message).toContain('45 minutes');
    },
  );

  it('without SendGrid in production only logs that the email was skipped', async () => {
    const service = new EmailService(
      config({ SENDGRID_API_KEY: 'change-me', NODE_ENV: 'production' }),
    );
    warn.mockClear();

    await service.sendAdminNotificationEmail(NOTIFICATION);

    expect(mockedMail.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String((warn.mock.calls as unknown[][])[0][0])).toMatch(/skipped/);
    for (const message of loggedMessages()) {
      expect(message).not.toContain(NOTIFICATION.resetLink);
      expect(message).not.toContain('token=');
    }
  });

  it('warns once at boot when SendGrid is not configured', () => {
    new EmailService(config({ SENDGRID_API_KEY: '' }));

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('sends the administrator notification when configured', async () => {
    mockedMail.send.mockResolvedValueOnce([{}]);
    const service = new EmailService(
      config({
        SENDGRID_API_KEY: 'SG.key',
        SENDGRID_FROM_EMAIL: 'no-reply@example.com',
        SENDGRID_FROM_NAME: 'Lab',
      }),
    );

    await service.sendAdminNotificationEmail(NOTIFICATION);

    expect(mockedMail.setApiKey).toHaveBeenCalledWith('SG.key');
    const message = mockedMail.send.mock.calls[0][0];
    expect(message.to).toBe('admin@example.com');
    expect(message.from).toEqual({
      email: 'no-reply@example.com',
      name: 'Lab',
    });
    expect(message.html).toContain('expires in 45 minutes');
  });

  it('logs and skips when SENDGRID_FROM_EMAIL is missing (never throws)', async () => {
    const service = new EmailService(config({ SENDGRID_API_KEY: 'SG.key' }));

    await expect(
      service.sendAdminNotificationEmail(NOTIFICATION),
    ).resolves.toBeUndefined();
    expect(mockedMail.send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('logs a delivery failure without throwing', async () => {
    mockedMail.send.mockRejectedValueOnce(new Error('SendGrid down'));
    const service = new EmailService(
      config({
        SENDGRID_API_KEY: 'SG.key',
        SENDGRID_FROM_EMAIL: 'no-reply@example.com',
      }),
    );

    await expect(
      service.sendAdminNotificationEmail(NOTIFICATION),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe('EmailTemplates.getAdminNotificationTemplate', () => {
  const templates = new EmailTemplates();

  it('derives the expiry text from the configured lifetime', () => {
    expect(
      templates.getAdminNotificationTemplate({
        ...NOTIFICATION,
        expiresInMinutes: 120,
      }),
    ).toContain('This link expires in 2 hours.');
    expect(templates.getAdminNotificationTemplate(NOTIFICATION)).not.toContain(
      '30 minutes',
    );
  });

  it('does not claim that an email was sent to the user', () => {
    const html = templates
      .getAdminNotificationTemplate(NOTIFICATION)
      .toLowerCase();
    expect(html).not.toContain('sent to the user');
    expect(html).not.toContain('email has been sent');
  });

  it('escapes user-supplied values', () => {
    const html = templates.getAdminNotificationTemplate({
      ...NOTIFICATION,
      userName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('declares English', () => {
    expect(templates.getAdminNotificationTemplate(NOTIFICATION)).toContain(
      '<html lang="en">',
    );
  });
});
