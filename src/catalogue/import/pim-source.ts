export interface PimVariant {
  sku: string;
  title: string;
  options: Record<string, string>;
  priceIncVat: number | null;
  weightKg: number | null;
}

export interface PimProduct {
  sku: string;
  handle: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  published: boolean;
  categoryPath: string[];
  options: { title: string; values: string[] }[];
  variants: PimVariant[];
  attributes: Record<string, string>;
}

export interface HeldBackItem {
  name: string;
  sku: string | null;
  range: string | null;
  reason: string;
}

// A named list of colours offered on products that point at it, such as the powder-coat colours.
export interface PimColourSet {
  key: string;
  colours: { name: string; code: string | null }[];
}

export interface CatalogueSnapshot {
  products: PimProduct[];
  heldBack: HeldBackItem[];
  colourSets: PimColourSet[];
}

// Where the catalogue comes from. Today it is the product master sheet; a PIM (Akeneo, Pimcore,
// Plytix or Salsify) can replace it by implementing this and nothing else changes.
export interface PimSource {
  readonly name: string;
  snapshot(): Promise<CatalogueSnapshot>;
}

export interface CatalogueSummary {
  rows: number;
  products: number;
  withVariants: number;
  single: number;
  skus: number;
  heldBack: number;
  unpriced: number;
  heldBackReasons: Record<string, number>;
}

export const hasVariants = (product: PimProduct) => product.options.length > 0;

export function summarise({ products, heldBack }: CatalogueSnapshot): CatalogueSummary {
  const variants = products.flatMap((product) => product.variants);
  const heldBackReasons: Record<string, number> = {};
  for (const item of heldBack)
    heldBackReasons[item.reason] = (heldBackReasons[item.reason] ?? 0) + 1;

  return {
    rows: variants.length + heldBack.length,
    products: products.length,
    withVariants: products.filter(hasVariants).length,
    single: products.filter((product) => !hasVariants(product)).length,
    skus: variants.length,
    heldBack: heldBack.length,
    unpriced: variants.filter((variant) => variant.priceIncVat === null).length,
    heldBackReasons,
  };
}
