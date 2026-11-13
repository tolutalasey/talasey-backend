import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it } from 'vitest';
import { DATABASE } from '../src/database/database.module.js';
import { HealthController } from '../src/health/health.controller.js';
import { KEY_VALUE_STORE } from '../src/store/key-value-store.js';
import { MemoryKeyValueStore } from '../src/store/memory-key-value-store.js';

async function createApp(execute: () => Promise<unknown>, ping = async () => true) {
  const store = Object.assign(new MemoryKeyValueStore(), { ping });
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: DATABASE, useValue: { execute } },
      { provide: KEY_VALUE_STORE, useValue: store },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('GET /health', () => {
  let app: INestApplication;

  afterEach(() => app.close());

  it('is ok when the database and store answer', async () => {
    app = await createApp(async () => [{ '?column?': 1 }]);
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', store: 'memory' });
  });

  it('is 503 when the database does not', async () => {
    app = await createApp(async () => {
      throw new Error('connection refused');
    });
    await request(app.getHttpServer()).get('/health').expect(503);
  });

  it('is 503 when Redis does not', async () => {
    app = await createApp(
      async () => [],
      async () => false,
    );
    await request(app.getHttpServer()).get('/health').expect(503);
  });
});
