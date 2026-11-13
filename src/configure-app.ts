import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureApp(app: NestExpressApplication) {
  app.enableShutdownHooks();
  app.disable('x-powered-by');
  app.set('query parser', 'extended');
  app.useBodyParser('json', { limit: '2mb' });
  return app;
}
