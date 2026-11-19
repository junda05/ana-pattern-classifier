import { UserRole } from '../src/entities/users/user.types';
import {
  API,
  E2eContext,
  Tokens,
  bearer,
  login,
  seedUser,
  startE2eApp,
} from './e2e-helpers';

const PATIENT = {
  fullName: 'John Doe',
  documentType: 'NATIONAL_ID',
  documentNumber: '1000000001',
  gender: 'M',
  birthDate: '1980-01-15',
  phonePrefix: '+1',
  phoneNumber: '5550100',
  email: 'john.doe@example.com',
};

describe('Role guard and patients (e2e)', () => {
  let context: E2eContext;
  let admin: Tokens;
  let standard: Tokens;

  beforeAll(async () => {
    context = await startE2eApp();
    const adminUser = await seedUser(
      context,
      UserRole.ADMIN,
      'admin_e2e',
      'Admin Example',
    );
    const standardUser = await seedUser(
      context,
      UserRole.STANDARD,
      'jane_doe',
      'Jane Doe',
    );
    admin = await login(context, adminUser);
    standard = await login(context, standardUser);
  });

  afterAll(async () => {
    await context.close();
  });

  it('forbids user management to a STANDARD user', async () => {
    await context
      .http()
      .get(`${API}/users`)
      .set('Authorization', bearer(standard.access))
      .expect(403);
  });

  it('allows user management to an ADMIN user', async () => {
    const response = await context
      .http()
      .get(`${API}/users`)
      .set('Authorization', bearer(admin.access))
      .expect(200);
    const usernames = (response.body as { data: { username: string }[] }).data
      .map((user) => user.username)
      .sort();
    expect(usernames).toEqual(['admin_e2e', 'jane_doe']);
  });

  it('forbids the audit trail to a STANDARD user', async () => {
    await context
      .http()
      .get(`${API}/traceability`)
      .set('Authorization', bearer(standard.access))
      .expect(403);
  });

  it('creates a patient and rejects a duplicate document with 409', async () => {
    const created = await context
      .http()
      .post(`${API}/patients`)
      .set('Authorization', bearer(standard.access))
      .send(PATIENT)
      .expect(201);
    expect(created.body).toMatchObject({
      patientId: expect.any(Number) as number,
      documentNumber: PATIENT.documentNumber,
    });

    await context
      .http()
      .post(`${API}/patients`)
      .set('Authorization', bearer(admin.access))
      .send({ ...PATIENT, fullName: 'Another Name', email: undefined })
      .expect(409);
  });

  it('rejects a patient with an undeclared property', async () => {
    await context
      .http()
      .post(`${API}/patients`)
      .set('Authorization', bearer(admin.access))
      .send({ ...PATIENT, documentNumber: '1000000002', isAdmin: true })
      .expect(400);
  });

  it('revokes the access of a deactivated user immediately', async () => {
    const user = await seedUser(
      context,
      UserRole.STANDARD,
      'sam_roe',
      'Sam Roe',
    );
    const tokens = await login(context, user);
    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(tokens.access))
      .expect(200);

    await context
      .http()
      .patch(`${API}/users/${user.userId}`)
      .set('Authorization', bearer(admin.access))
      .send({ isActive: false })
      .expect(200);

    // The access token has not expired, but its user is no longer active
    await context
      .http()
      .get(`${API}/auth/profile`)
      .set('Authorization', bearer(tokens.access))
      .expect(401);
    await context
      .http()
      .get(`${API}/patients`)
      .set('Authorization', bearer(tokens.access))
      .expect(401);
  });

  it('applies a demotion to the existing access token immediately', async () => {
    const user = await seedUser(context, UserRole.ADMIN, 'lee_roe', 'Lee Roe');
    const tokens = await login(context, user);
    await context
      .http()
      .get(`${API}/users`)
      .set('Authorization', bearer(tokens.access))
      .expect(200);

    await context
      .http()
      .patch(`${API}/users/${user.userId}`)
      .set('Authorization', bearer(admin.access))
      .send({ role: UserRole.STANDARD })
      .expect(200);

    // The token still claims ADMIN, but the stored role is STANDARD
    await context
      .http()
      .get(`${API}/users`)
      .set('Authorization', bearer(tokens.access))
      .expect(403);
  });
});
