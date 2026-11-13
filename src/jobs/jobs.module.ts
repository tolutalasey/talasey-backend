import { Global, Inject, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { JobQueue } from './job-queue.js';

@Global()
@Module({ providers: [JobQueue], exports: [JobQueue] })
export class JobsModule implements OnApplicationBootstrap {
  constructor(
    private readonly jobs: JobQueue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (this.config.NODE_ENV !== 'test') this.jobs.start();
  }
}
