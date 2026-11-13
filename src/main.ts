import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/config.schema.js';
import { configureApp } from './configure-app.js';
import { createOpenApiDocument } from './openapi.js';

const app = configureApp(
  await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true }),
);

const config = app.get<AppConfig>(APP_CONFIG);
if (config.NODE_ENV !== 'production') {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app));
}

await app.listen(config.PORT);
