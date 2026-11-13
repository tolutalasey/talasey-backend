import { Inject, Injectable } from '@nestjs/common';
import { SiteRefresh } from '../site/site-refresh.service.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

export const PUBLISHED_PRODUCTS_KEY = 'catalogue:published';

// After any catalogue change: drop the cached product list and ask the site to refresh the
// product pages, listings, search and sitemaps.
@Injectable()
export class CatalogueChanges {
  constructor(
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    private readonly site: SiteRefresh,
  ) {}

  async changed(handles: string[] = []) {
    await this.store.delete(PUBLISHED_PRODUCTS_KEY);
    await this.site.refresh(['products', ...handles.map((handle) => `product:${handle}`)]);
  }
}
