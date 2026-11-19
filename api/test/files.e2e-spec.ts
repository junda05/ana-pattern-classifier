import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
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

describe('Files (e2e)', () => {
  let context: E2eContext;
  let standard: Tokens;

  beforeAll(async () => {
    context = await startE2eApp();
    const user = await seedUser(
      context,
      UserRole.STANDARD,
      'jane_doe',
      'Jane Doe',
    );
    standard = await login(context, user);
  });

  afterAll(async () => {
    await context.close();
  });

  it('lists no reference classes while the gallery is empty', async () => {
    const response = await context
      .http()
      .get(`${API}/files/reference/classes`)
      .set('Authorization', bearer(standard.access))
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('rejects a path traversal in a prediction image name', async () => {
    await context
      .http()
      .get(`${API}/files/predictions/..%2F.env`)
      .set('Authorization', bearer(standard.access))
      .expect(400);
  });

  it('answers 404 for a missing prediction image', async () => {
    await context
      .http()
      .get(`${API}/files/predictions/missing.png`)
      .set('Authorization', bearer(standard.access))
      .expect(404);
  });

  it('has no route that deletes prediction images (not even for administrators)', async () => {
    const admin = await login(
      context,
      await seedUser(context, UserRole.ADMIN, 'files_admin', 'Files Admin'),
    );
    const predictionsDir = join(
      process.env.UPLOADS_DIR as string,
      'predictions',
    );
    const stored = join(predictionsDir, 'kept-1-slide.png');
    await mkdir(predictionsDir, { recursive: true });
    await writeFile(stored, 'not really an image');

    const response = await context
      .http()
      .delete(`${API}/files/predictions/kept-1-slide.png`)
      .set('Authorization', bearer(admin.access))
      .expect(404);

    expect(response.body).toMatchObject({
      message: 'Cannot DELETE /api/v1/files/predictions/kept-1-slide.png',
    });
    expect(existsSync(stored)).toBe(true);
  });

  it('requires authentication for images', async () => {
    await context.http().get(`${API}/files/reference/classes`).expect(401);
  });
});
