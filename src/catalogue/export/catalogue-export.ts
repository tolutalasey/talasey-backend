import type { CatalogueProduct } from '../product.js';
import type { Cell } from './xlsx-writer.js';

export const EXPORT_HEADINGS = [
  'Product',
  'Web address',
  'Page type',
  'Published',
  'Category',
  'SKU',
  'Option',
  'Price inc VAT (£)',
  'Stock',
  'Stock mode',
  'Lead time (days)',
  'Weight (kg)',
  'Coverage (m²)',
  'Barcode',
] as const;

const leadTime = ({ leadTimeMinDays: min, leadTimeMaxDays: max }: CatalogueProduct) =>
  min === null && max === null
    ? null
    : min === max || max === null
      ? `${min}`
      : `${min ?? 0}-${max}`;

// One row per sellable option, so the sheet can be filtered, totted up and checked by anyone.
export function catalogueRows(products: CatalogueProduct[]): Cell[][] {
  const rows = [...products]
    .sort((a, b) => a.title.localeCompare(b.title))
    .flatMap((product) =>
      product.variants.map((variant): Cell[] => [
        product.title,
        `/products/${product.handle}/`,
        product.pageType,
        product.published,
        product.category?.name ?? null,
        variant.sku,
        Object.values(variant.options).join(', ') || variant.title,
        variant.pricePence === null ? null : variant.pricePence / 100,
        variant.stockQuantity,
        product.stockMode.replace(/_/g, ' '),
        leadTime(product),
        variant.weightKg,
        variant.coverageM2,
        variant.barcode,
      ]),
    );
  return [[...EXPORT_HEADINGS], ...rows];
}
