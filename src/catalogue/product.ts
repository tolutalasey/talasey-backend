import type { PageType } from './rules/page-types.js';
import type { StockMode } from './rules/stock-mode.js';

export interface VariantState {
  id: string;
  sku: string | null;
  title: string;
  options: Record<string, string>;
  pricePence: number | null;
  weightKg: number | null;
  coverageM2: number | null;
  stockQuantity: number;
  barcode: string | null;
}

export interface ImageState {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

export interface ColourImageState {
  url: string;
  alt: string;
  colourId: string;
  size: string;
  finish: string;
}

// Everything about one product, as edited in the admin, written to the audit log and restored.
export interface ProductState {
  handle: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
  published: boolean;
  pageType: PageType | null;
  stockMode: StockMode;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  categoryId: string | null;
  options: { title: string; values: string[] }[];
  colourSetId: string | null;
  colourOption: string | null;
  colourOptionValue: string | null;
  colourRequired: boolean;
  colourLabel: string | null;
  bespoke: unknown;
  attributes: Record<string, string>;
  pimSku: string | null;
  variants: VariantState[];
  images: ImageState[];
  colourImages: ColourImageState[];
}

export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  published: boolean;
  pageType: PageType | null;
  variantCount: number;
  priceFromPence: number | null;
  unpriced: number;
  thumbnail: string | null;
  updatedAt: Date;
}

export interface CatalogueProduct extends ProductState {
  id: string;
  updatedAt: Date;
  category: { handle: string; name: string } | null;
}
