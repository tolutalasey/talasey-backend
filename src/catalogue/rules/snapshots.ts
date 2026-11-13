import type { StockMode } from './stock-mode.js';
import type { PageType } from './page-types.js';

// The whole state of one audited thing, as stored in the audit log. Writing a snapshot back is
// how a change is undone, whether by a failed workflow or a restore from the log.
export interface ColourSetSnapshot {
  name: string;
  // Colours keep their ids across edits, because product images point at them.
  colours: { id?: string; name: string; hex: string; photo_url: string | null }[];
}

export interface ColourRuleSnapshot {
  colour_set_id: string;
  option: string | null;
  value: string | null;
  required: boolean;
}

export interface ColourImageSnapshot {
  size: string;
  finish: string;
  colour_id: string;
  url: string;
  alt: string;
}

// page_type is null for a product with no Talasey settings yet; its stock mode still counts.
export interface ProductCatalogueSnapshot {
  page_type: PageType | null;
  stock_mode: StockMode | null;
  lead_time_min_days: number | null;
  lead_time_max_days: number | null;
  colour_rule: ColourRuleSnapshot | null;
  images: ColourImageSnapshot[];
}

export type Subject = 'colour_set' | 'product_catalogue';

export interface SnapshotOf {
  colour_set: ColourSetSnapshot;
  product_catalogue: ProductCatalogueSnapshot;
}
