import { UserRole } from '../src/entities/users/user.types';
import {
  API,
  E2eContext,
  TestUser,
  seedUser,
  startE2eApp,
} from './e2e-helpers';

const TOO_MANY = {
  statusCode: 429,
  message: 'Too many requests. Please try again later.',
};

// Low limits for this suite only (setup-env.ts raises them for the others)
const LIMITS = {
  AUTH_RATE_LIMIT_LOGIN: '3',
  AUTH_RATE_LIMIT_REFRESH: '2',
  AUTH_RATE_LIMIT_PASSWORD_RESET: '2',
};

describe('Authentication rate limits (e2e)', () => {
  let context: E2eContext;
  let user: TestUser;
  const previous: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const [name, value] of Object.entries(LIMITS)) {
      previous[name] = process.env[name];
      process.env[name] = value;
    }
    context = await startE2eApp();
    user = await seedUser(context, UserRole.STANDARD, 'rate_user', 'Rate User');
  });

  afterAll(async () => {
    await context.close();
    Object.assign(process.env, previous);
  });

  it('counts failed logins and answers 429 above the login limit, even with spoofed X-Forwarded-For', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await context
        .http()
        .post(`${API}/auth/login`)
        .set('X-Forwarded-For', `203.0.113.${attempt}`)
        .send({ username: user.username, password: 'wrong-password' })
        .expect(401);
    }

    const blocked = await context
      .http()
      .post(`${API}/auth/login`)
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ username: user.username, password: user.password })
      .expect(429);

    expect(blocked.body).toEqual(TOO_MANY);
    expect(Number(blocked.headers['retry-after-auth-login'])).toBeGreaterThan(
      0,
    );
  });

  it('limits refresh-access separately from login', async () => {
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: 'not-a-token' })
      .expect(401);
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: 'not-a-token' })
      .expect(401);

    const blocked = await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: 'not-a-token' })
      .expect(429);
    expect(blocked.body).toEqual(TOO_MANY);
  });

  it.each([
    ['request-password-reset', { username: 'nobody' }],
    [
      'validate-admin-and-token',
      { token: 'unknown', adminUsername: 'nobody', adminPassword: 'x' },
    ],
    [
      'reset-password',
      { token: 'unknown', newPassword: 'N3w-Passw0rd!', approvalToken: 'x' },
    ],
  ])(
    'answers 429 above the password-reset limit on %s',
    async (route, body) => {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const response = await context
          .http()
          .post(`${API}/auth/${route}`)
          .send(body);
        expect(response.status).not.toBe(429);
      }

      const blocked = await context
        .http()
        .post(`${API}/auth/${route}`)
        .send(body)
        .expect(429);
      expect(blocked.body).toEqual(TOO_MANY);
    },
  );

  it('does not rate-limit routes outside the list (validate-reset-token)', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await context
        .http()
        .post(`${API}/auth/validate-reset-token`)
        .send({ token: 'unknown' })
        .expect(200);
    }
  });
});
