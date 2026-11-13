import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { ReleaseService } from './release.service.js';

const EVERY_MS = 30_000;
const LOCK = 'content-releases:lock';

// Checks every 30 seconds for releases whose time has come. The lock stops two copies of the API
// publishing the same release.
@Injectable()
export class ReleaseScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReleaseScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly releases: ReleaseService,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (this.config.NODE_ENV !== 'test') this.timer = setInterval(() => void this.tick(), EVERY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    const owner = String(process.pid) + Math.random();
    if (!(await this.store.setIfAbsent(LOCK, owner, EVERY_MS))) return 0;
    try {
      const published = await this.releases.publishDue(this.clock());
      if (published) this.logger.log(`Published ${published} scheduled release(s)`);
      return published;
    } catch (error) {
      this.logger.error('Scheduled releases could not be checked', error as Error);
      return 0;
    } finally {
      await this.store.deleteIfEquals(LOCK, owner);
    }
  }
}
