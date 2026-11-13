import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createOpenApiDocument } from './openapi.js';

process.env.DATABASE_URL ??= 'postgres://openapi@localhost:5432/unused';
delete process.env.REDIS_URL;
process.env.NODE_ENV = 'test';

const app = await NestFactory.create(AppModule, { logger: false });
const document = createOpenApiDocument(app);
writeFileSync(
  new URL('../openapi.json', import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
await app.close();
