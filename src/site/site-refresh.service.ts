import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { JobQueue } from '../jobs/job-queue.js';
import { requestRevalidation, revalidationTarget } from './revalidation.js';

const JOB = 'site-refresh';

// Asks the site to rebuild cached pages after a change, through the job queue so a slow or
// sleeping site never holds up the admin.
@Injectable()
export class SiteRefresh implements OnModuleInit {
  private readonly logger = new Logger(SiteRefresh.name);

  constructor(
    private readonly jobs: JobQueue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    this.jobs.handle<{ tags: string[] }>(JOB, async ({ tags }) => {
      const target = revalidationTarget(this.config);
      if (!target) {
        this.logger.warn(
          `REVALIDATE_SECRET is not set, so the site was not told about: ${tags.join(', ')}`,
        );
        return;
      }
      try {
        await requestRevalidation(tags, target);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        this.logger.warn(`The site at ${target.siteUrl} is not running, so it was not refreshed`);
      }
    });
  }

  refresh(tags: string[]) {
    return this.jobs.enqueue(JOB, { tags: [...new Set(tags)] });
  }
}
