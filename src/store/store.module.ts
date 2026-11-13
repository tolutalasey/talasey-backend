import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from './key-value-store.js';
import { LockService } from './lock.service.js';
import { MemoryKeyValueStore } from './memory-key-value-store.js';
import { RedisKeyValueStore } from './redis-key-value-store.js';

function createStore(config: AppConfig, clock: Clock): KeyValueStore {
  // Keys are kept apart per database, so two databases can share one Redis.
  const database = new URL(config.DATABASE_URL).pathname.slice(1);
  if (config.REDIS_URL) return RedisKeyValueStore.connect(config.REDIS_URL, `talasey:${database}:`);
  new Logger('Store').warn('REDIS_URL is not set: sessions, cache and jobs are kept in memory.');
  return new MemoryKeyValueStore(clock);
}

@Global()
@Module({
  providers: [
    { provide: KEY_VALUE_STORE, inject: [APP_CONFIG, CLOCK], useFactory: createStore },
    LockService,
  ],
  exports: [KEY_VALUE_STORE, LockService],
})
export class StoreModule implements OnApplicationShutdown {
  constructor(@Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore) {}

  async onApplicationShutdown() {
    await this.store.close();
  }
}
