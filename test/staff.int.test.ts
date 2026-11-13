import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseUrl, signIn, startApi } from './support/app.js';

describe.skipIf(!databaseUrl)('staff accounts and the audit log', () => {
  let app: NestExpressApplication;
  let owner: string;

  beforeAll(async () => {
    app = await startApi();
    owner = await signIn(app, 'owner');
  });

  afterAll(() => app?.close());

  const http = () => request(app.getHttpServer());

  it('reports which store backs sessions', async () => {
    const { body } = await http().get('/health').expect(200);
    expect(body.store).toBe(process.env.REDIS_URL ? 'redis' : 'memory');
  });

  it('lets only the owner manage staff', async () => {
    await http().get('/admin/users').set('authorization', owner).expect(200);
    const editor = await signIn(app, 'editor');
    await http().get('/admin/users').set('authorization', editor).expect(403);
  });

  it('logs a role change and restores the old role from the log', async () => {
    const email = `temp-${Date.now()}@talasey.local`;
    const { body: created } = await http()
      .post('/admin/users')
      .set('authorization', owner)
      .send({ email, name: 'Temp', role: 'contributor', password: 'temporary-pass' })
      .expect(201);

    await http()
      .patch(`/admin/users/${created.id}`)
      .set('authorization', owner)
      .send({ role: 'editor' })
      .expect(200);

    const { body: log } = await http()
      .get(`/admin/audit?subject=staff_user&subjectId=${created.id}`)
      .set('authorization', owner)
      .expect(200);
    expect(log.map((entry: { action: string }) => entry.action)).toEqual(['update', 'create']);

    await http().post(`/admin/audit/${log[0].id}/restore`).set('authorization', owner).expect(200);
    const { body: users } = await http().get('/admin/users').set('authorization', owner);
    expect(users.find((user: { id: string }) => user.id === created.id).role).toBe('contributor');
  });

  it('will not remove the last owner', async () => {
    const { body: me } = await http().get('/auth/me').set('authorization', owner);
    await http()
      .patch(`/admin/users/${me.id}`)
      .set('authorization', owner)
      .send({ role: 'editor' })
      .expect(422);
  });

  it('refuses a duplicate email', async () => {
    await http()
      .post('/admin/users')
      .set('authorization', owner)
      .send({
        email: 'editor@talasey.local',
        name: 'Copy',
        role: 'editor',
        password: 'long-password',
      })
      .expect(409);
  });
});
