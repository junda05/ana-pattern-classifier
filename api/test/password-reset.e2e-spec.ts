import { UserRole } from '../src/entities/users/user.types';
import {
  API,
  E2eContext,
  TestUser,
  bearer,
  login,
  seedUser,
  startE2eApp,
} from './e2e-helpers';

const GENERIC_RESET_RESPONSE = {
  success: true,
  message: 'If the account exists, an administrator has been notified.',
};

interface ResetTokenRow {
  tokenId: number;
  token: string;
  isUsed: boolean;
}

/** Waits until the wall clock enters the next second (JWT iat has one-second resolution). */
async function nextSecond(): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, 1000 - (Date.now() % 1000) + 20),
  );
}

describe('Password reset (e2e)', () => {
  let context: E2eContext;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    context = await startE2eApp();
    admin = await seedUser(
      context,
      UserRole.ADMIN,
      'reset_admin',
      'Reset Admin',
    );
    user = await seedUser(
      context,
      UserRole.STANDARD,
      'reset_user',
      'Reset User',
    );
  });

  afterAll(async () => {
    await context.close();
  });

  function resetTokensOf(userId: number): Promise<ResetTokenRow[]> {
    return context.dataSource.query<ResetTokenRow[]>(
      'SELECT "tokenId", "token", "isUsed" FROM "PasswordResetTokens" WHERE "userId" = @0 ORDER BY "tokenId"',
      [userId],
    );
  }

  function requestReset(username: string) {
    return context
      .http()
      .post(`${API}/auth/request-password-reset`)
      .send({ username })
      .expect(200);
  }

  it('keeps the pending request during the cooldown and answers the same way', async () => {
    const first = await requestReset(user.username);
    const second = await requestReset(user.username);

    expect(first.body).toEqual(GENERIC_RESET_RESPONSE);
    expect(second.body).toEqual(GENERIC_RESET_RESPONSE);
    const tokens = await resetTokensOf(user.userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].isUsed).toBe(false);
  });

  it('ends every session issued before the reset; a new login works', async () => {
    const before = await login(context, user);
    const [{ token }] = await resetTokensOf(user.userId);
    await nextSecond();

    const approval = await context
      .http()
      .post(`${API}/auth/validate-admin-and-token`)
      .send({
        token,
        adminUsername: admin.username,
        adminPassword: admin.password,
      })
      .expect(200);
    expect(approval.body).toMatchObject({ success: true, valid: true });

    const newPassword = 'Brand-new-Passw0rd!';
    await context
      .http()
      .post(`${API}/auth/reset-password`)
      .send({
        token,
        newPassword,
        approvalToken: (approval.body as { approvalToken: string })
          .approvalToken,
      })
      .expect(200);

    const profile = await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(before.access))
      .expect(401);
    expect(profile.body).toMatchObject({
      message: 'The session ended because the password was changed.',
    });
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: before.refresh })
      .expect(401);

    await nextSecond();
    const after = await login(context, { ...user, password: newPassword });
    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(after.access))
      .expect(200);
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: after.refresh })
      .expect(200);
  });
});
