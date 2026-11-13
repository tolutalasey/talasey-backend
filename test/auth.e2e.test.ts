import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService, MAX_FAILED_SIGN_INS } from '../src/auth/auth.service.js';
import { MemoryStaffUserRepository } from '../src/auth/memory-staff-user.repository.js';
import { hashPassword } from '../src/auth/password.js';
import { SessionService } from '../src/auth/session.service.js';
import { StaffGuard } from '../src/auth/staff.guard.js';
import { STAFF_USER_REPOSITORY } from '../src/auth/staff-user.repository.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { parseConfig } from '../src/config/config.schema.js';
import { KEY_VALUE_STORE } from '../src/store/key-value-store.js';
import { MemoryKeyValueStore } from '../src/store/memory-key-value-store.js';

const PASSWORD = 'a long enough password';

describe('staff sign-in', () => {
  let app: INestApplication;
  const users = new MemoryStaffUserRepository();

  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    await users.create({ email: 'ed@talasey.co.uk', name: 'Ed', role: 'editor', passwordHash });
    const gone = await users.create({
      email: 'gone@talasey.co.uk',
      name: 'Gone',
      role: 'owner',
      passwordHash,
    });
    await users.update(gone.id, { active: false });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: STAFF_USER_REPOSITORY, useValue: users },
        { provide: KEY_VALUE_STORE, useValue: new MemoryKeyValueStore() },
        { provide: APP_CONFIG, useValue: parseConfig({ DATABASE_URL: 'postgres://x@y/z' }) },
        SessionService,
        AuthService,
        StaffGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const signIn = (email: string, password: string) =>
    request(app.getHttpServer()).post('/auth/sign-in').send({ email, password });

  it('signs in with the right details and says what the role allows', async () => {
    const response = await signIn('Ed@Talasey.co.uk', PASSWORD).expect(200);
    expect(response.body.user).toMatchObject({ name: 'Ed', role: 'editor' });
    expect(response.body.user.permissions).toContain('content.publish');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('authorization', `Bearer ${response.body.token}`)
      .expect(200)
      .expect((res) => expect(res.body.email).toBe('ed@talasey.co.uk'));
  });

  it('turns away a wrong password and a closed account', async () => {
    await signIn('ed@talasey.co.uk', 'not the password').expect(401);
    await signIn('gone@talasey.co.uk', PASSWORD).expect(401);
  });

  it('needs a session for /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('authorization', 'Bearer made-up')
      .expect(401);
  });

  it('ends the session on sign-out', async () => {
    const { body } = await signIn('ed@talasey.co.uk', PASSWORD).expect(200);
    const auth = `Bearer ${body.token}`;
    await request(app.getHttpServer())
      .post('/auth/sign-out')
      .set('authorization', auth)
      .expect(204);
    await request(app.getHttpServer()).get('/auth/me').set('authorization', auth).expect(401);
  });

  it('locks an email for a while after too many wrong passwords', async () => {
    const email = 'locked@talasey.co.uk';
    await users.create({
      email,
      name: 'Locked',
      role: 'contributor',
      passwordHash: await hashPassword(PASSWORD),
    });
    for (let attempt = 0; attempt < MAX_FAILED_SIGN_INS; attempt++) {
      await signIn(email, 'wrong password').expect(401);
    }
    await signIn(email, PASSWORD).expect(429);
  });
});
