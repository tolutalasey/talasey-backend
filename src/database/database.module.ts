import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { createDatabase } from './client.js';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
export const DATABASE = Symbol('DATABASE');

type Connection = ReturnType<typeof createDatabase>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDatabase(config.DATABASE_URL),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: Connection) => connection.db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CONNECTION) private readonly connection: Connection) {}

  async onApplicationShutdown() {
    await this.connection.close();
  }
}
