import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PUBLISHED_PRODUCTS_KEY } from '../../src/catalogue/catalogue-changes.service.js';
import { configureApp } from '../../src/configure-app.js';
import { runMigrations } from '../../src/database/migrate.js';
import { DEMO_PASSWORD, seed } from '../../src/database/seed.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../../src/store/key-value-store.js';

export const databaseUrl = process.env.DATABASE_URL ?? '';

// The whole API against the real Postgres (and Redis when REDIS_URL is set), as the site uses it.
export async function startApi() {
  process.env.NODE_ENV = 'test';
  await runMigrations(databaseUrl);
  await seed(databaseUrl, { demo: true });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }),
  );
  await app.init();
  await app.get<KeyValueStore>(KEY_VALUE_STORE).delete(PUBLISHED_PRODUCTS_KEY);
  return app;
}

export async function signIn(app: NestExpressApplication, role: string) {
  const { body } = await request(app.getHttpServer())
    .post('/auth/sign-in')
    .send({ email: `${role}@talasey.local`, password: DEMO_PASSWORD })
    .expect(200);
  return `Bearer ${body.token as string}`;
}
