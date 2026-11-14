import { Inject, Injectable } from '@nestjs/common';
import { JobQueue } from '../jobs/job-queue.js';
import { SiteRefresh } from '../site/site-refresh.service.js';
import { CATALOGUE_CHANGED } from '../stock-alerts/stock-alerts.service.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

export const PUBLISHED_PRODUCTS_KEY = 'catalogue:published';

// After any catalogue change: drop the cached product list, ask the site to refresh the product
// pages, listings, search and sitemaps, and tell anyone waiting for something back in stock.
@Injectable()
export class CatalogueChanges {
  constructor(
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    private readonly site: SiteRefresh,
    private readonly jobs: JobQueue,
  ) {}

  async changed(handles: string[] = []) {
    await this.store.delete(PUBLISHED_PRODUCTS_KEY);
    await this.site.refresh(['products', ...handles.map((handle) => `product:${handle}`)]);
    if (handles.length > 0) await this.jobs.enqueue(CATALOGUE_CHANGED, { handles });
  }
}
