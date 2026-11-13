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
import { stepAt, totpCode } from '../src/auth/totp.js';
import { TwoFactorService } from '../src/auth/two-factor.service.js';
import { CLOCK } from '../src/common/clock.js';
import { STAFF_USER_REPOSITORY } from '../src/auth/staff-user.repository.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { parseConfig } from '../src/config/config.schema.js';
import { KEY_VALUE_STORE } from '../src/store/key-value-store.js';
import { MemoryKeyValueStore } from '../src/store/memory-key-value-store.js';

const PASSWORD = 'a long enough password';

describe('staff sign-in', () => {
  let app: INestApplication;
  const users = new MemoryStaffUserRepository();
  let now = new Date('2026-11-13T10:00:00Z');

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
        { provide: CLOCK, useValue: () => now },
        SessionService,
        AuthService,
        TwoFactorService,
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

  it('changes your own password only with the current one', async () => {
    const email = 'mover@talasey.co.uk';
    await users.create({
      email,
      name: 'Mover',
      role: 'contributor',
      passwordHash: await hashPassword(PASSWORD),
    });
    const { body } = await signIn(email, PASSWORD).expect(200);
    const change = (currentPassword: string) =>
      request(app.getHttpServer())
        .post('/auth/password')
        .set('authorization', `Bearer ${body.token}`)
        .send({ currentPassword, newPassword: 'another long password' });

    await change('not it').expect(422);
    await change(PASSWORD).expect(204);
    await signIn(email, PASSWORD).expect(401);
    await signIn(email, 'another long password').expect(200);
  });

  describe('two-factor', () => {
    const email = 'two@talasey.co.uk';
    const codeAt = (secret: string, minutes = 0) =>
      totpCode(secret, stepAt(now.getTime() + minutes * 60_000));
    const post = (path: string, auth: string, body: object = {}) =>
      request(app.getHttpServer()).post(path).set('authorization', auth).send(body);
    let secret = '';

    beforeAll(async () => {
      await users.create({
        email,
        name: 'Two',
        role: 'owner',
        passwordHash: await hashPassword(PASSWORD),
      });
      const { body } = await signIn(email, PASSWORD).expect(200);
      const auth = `Bearer ${body.token}`;
      const setup = await post('/auth/two-factor/setup', auth).expect(200);
      secret = setup.body.secret;
      expect(setup.body.uri).toContain(`secret=${secret}`);

      await post('/auth/two-factor/on', auth, { code: '000000' }).expect(422);
      const on = await post('/auth/two-factor/on', auth, { code: codeAt(secret) }).expect(200);
      expect(on.body.twoFactor).toBe(true);
    });

    it('asks for a code after the password, and signs in with it', async () => {
      now = new Date(now.getTime() + 60_000);
      const first = await signIn(email, PASSWORD).expect(200);
      expect(first.body).toEqual({ status: 'code-needed', challenge: expect.any(String) });

      const { body } = await request(app.getHttpServer())
        .post('/auth/sign-in/code')
        .send({ challenge: first.body.challenge, code: codeAt(secret) })
        .expect(200);
      expect(body.user).toMatchObject({ email, twoFactor: true });
    });

    it('turns away a wrong code, a used code and a made-up challenge', async () => {
      now = new Date(now.getTime() + 60_000);
      const { body } = await signIn(email, PASSWORD).expect(200);
      const send = (challenge: string, code: string) =>
        request(app.getHttpServer()).post('/auth/sign-in/code').send({ challenge, code });

      await send(body.challenge, '123456').expect(401);
      await send('made-up', codeAt(secret)).expect(401);
      await send(body.challenge, codeAt(secret)).expect(200);

      const again = await signIn(email, PASSWORD).expect(200);
      await send(again.body.challenge, codeAt(secret)).expect(401);
    });

    it('turns off only with a current code', async () => {
      now = new Date(now.getTime() + 60_000);
      const first = await signIn(email, PASSWORD).expect(200);
      const { body } = await request(app.getHttpServer())
        .post('/auth/sign-in/code')
        .send({ challenge: first.body.challenge, code: codeAt(secret) })
        .expect(200);
      const auth = `Bearer ${body.token}`;

      await post('/auth/two-factor/off', auth, { code: '000000' }).expect(422);
      const off = await post('/auth/two-factor/off', auth, { code: codeAt(secret, 0.5) }).expect(
        200,
      );
      expect(off.body.twoFactor).toBe(false);
      await signIn(email, PASSWORD)
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('signed-in'));
    });
  });
});
