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

describe('Authentication (e2e)', () => {
  let context: E2eContext;
  let user: TestUser;

  beforeAll(async () => {
    context = await startE2eApp();
    user = await seedUser(context, UserRole.STANDARD, 'jane_doe', 'Jane Doe');
  });

  afterAll(async () => {
    await context.close();
  });

  it('rejects a login without credentials or with a wrong password', async () => {
    await context.http().post(`${API}/auth/login`).send({}).expect(401);
    await context
      .http()
      .post(`${API}/auth/login`)
      .send({ username: user.username, password: 'not-the-password' })
      .expect(401);
  });

  it('logs in and reads the profile with the access token', async () => {
    const tokens = await login(context, user);
    expect(tokens.access).toEqual(expect.any(String));
    expect(tokens.refresh).toEqual(expect.any(String));

    const profile = await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(tokens.access))
      .expect(200);
    expect(profile.body).toMatchObject({
      success: true,
      user: { username: user.username, role: UserRole.STANDARD },
    });
  });

  it('rejects protected routes without a token', async () => {
    await context.http().get(`${API}/auth/profile`).expect(401);
  });

  it('rejects a refresh token (type "refresh") on a protected route', async () => {
    const tokens = await login(context, user);
    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(tokens.refresh))
      .expect(401);
  });

  it('issues a working access token from a refresh token', async () => {
    const tokens = await login(context, user);
    const refreshed = await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: tokens.refresh })
      .expect(200);
    const access = (refreshed.body as { access: string }).access;

    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(access))
      .expect(200);
  });

  it('refuses an access token where a refresh token is expected', async () => {
    const tokens = await login(context, user);
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: tokens.access })
      .expect(401);
  });

  it('logout revokes that session only; a newer refresh token keeps working', async () => {
    const session = await login(context, user);
    const otherSession = await login(context, user);
    expect(otherSession.refresh).not.toBe(session.refresh);

    await context
      .http()
      .post(`${API}/auth/logout`)
      .set('Authorization', bearer(session.access))
      .send({ refresh: session.refresh })
      .expect(200);

    // The revoked session can neither refresh nor call protected routes
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: session.refresh })
      .expect(401);
    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(session.access))
      .expect(401);

    // Another session of the same user is unaffected
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: otherSession.refresh })
      .expect(200);

    // So is a session opened after the logout
    const newSession = await login(context, user);
    await context
      .http()
      .post(`${API}/auth/refresh-access`)
      .send({ refresh: newSession.refresh })
      .expect(200);
  });
});
