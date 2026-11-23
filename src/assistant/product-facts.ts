import type { StoreProduct } from '../catalogue/catalogue.schemas.js';

type Variant = StoreProduct['variants'][number];

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const pounds = (pence: number) => money.format(pence / 100);
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const COLOUR = 'Colour';

export const productPath = (handle: string) => `/products/${handle}/`;

export function isForSale(variant: Variant): boolean {
  if (variant.pricePence === null) return false;
  return !variant.stock.managed || variant.stock.backorder || (variant.stock.quantity ?? 0) > 0;
}

export function stockLabel(variants: Variant[]): string {
  if (variants.some((v) => v.stock.managed && (v.stock.quantity ?? 0) > 0)) return 'In stock';
  if (variants.some(isForSale)) return 'Available to order';
  return 'Out of stock';
}

function lowestPrice(variants: Variant[]): number | null {
  const prices = variants.flatMap((v) => (v.pricePence === null ? [] : [v.pricePence]));
  return prices.length > 0 ? Math.min(...prices) : null;
}

function lowestPerM2(variants: Variant[]): number | null {
  const rates = variants.flatMap((v) =>
    v.pricePence !== null && v.coverageM2 ? [v.pricePence / v.coverageM2] : [],
  );
  return rates.length > 0 ? Math.round(Math.min(...rates)) : null;
}

// How a product's price reads: per m² when it's sold by area, otherwise from its cheapest option.
export function priceLabel(product: StoreProduct): string | null {
  const perM2 = lowestPerM2(product.variants);
  if (perM2 !== null) return `From ${pounds(perM2)} per m²`;
  const lowest = lowestPrice(product.variants);
  if (lowest === null) return null;
  return product.variants.length > 1 ? `From ${pounds(lowest)}` : pounds(lowest);
}

const optionValues = (product: StoreProduct) =>
  Object.fromEntries(product.options.map((option) => [option.title, option.values]));

// One line per product for a search result: enough to choose, not every variant.
export function summary(product: StoreProduct) {
  return {
    handle: product.handle,
    title: product.title,
    brand: product.brand,
    categories: product.categories.map((category) => category.name),
    price: priceLabel(product),
    stock: stockLabel(product.variants),
    options: optionValues(product),
    url: productPath(product.handle),
  };
}

export function details(product: StoreProduct) {
  return {
    ...summary(product),
    description: product.description,
    soldOnline: product.sellOnline,
    otherwise: product.sellOnline ? null : product.offlineAction,
    madeToMeasure: product.madeToMeasure,
    leadTimeDays: product.leadTime,
    colourMustBeChosen: product.colourChoice?.required ?? false,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.title,
      options: variant.options,
      price: variant.pricePence === null ? null : pounds(variant.pricePence),
      coversM2: variant.coverageM2,
      pricePerM2:
        variant.pricePence !== null && variant.coverageM2
          ? pounds(Math.round(variant.pricePence / variant.coverageM2))
          : null,
      stock: stockLabel([variant]),
    })),
  };
}

function score(product: StoreProduct, query: string[]): number {
  const title = new Set(words(product.title));
  const groups = new Set(product.categories.flatMap((category) => words(category.name)));
  const options = new Set(product.options.flatMap((option) => option.values.flatMap(words)));
  const description = new Set(words(product.description ?? ''));
  return query.reduce((total, word) => {
    const stem = word.replace(/s$/, '');
    const has = (set: Set<string>) => set.has(word) || set.has(stem) || set.has(`${stem}s`);
    return (
      total +
      (has(title) ? 4 : 0) +
      (has(groups) ? 3 : 0) +
      (has(options) ? 2 : 0) +
      (has(description) ? 1 : 0)
    );
  }, 0);
}

const STOP = new Set(['a', 'an', 'and', 'the', 'for', 'with', 'of', 'in', 'to', 'my', 'i', 'me']);

export function search(products: StoreProduct[], query: string, limit: number) {
  const terms = words(query).filter((word) => !STOP.has(word));
  return products
    .map((product) => ({ product, score: score(product, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => summary(entry.product));
}

// Packs needed for an area, per size, worked out here so the sums are never left to the model.
export function quantities(product: StoreProduct, areaM2: number, wastePercent: number) {
  const needed = areaM2 * (1 + wastePercent / 100);
  const seen = new Set<string>();
  return product.variants
    .filter((variant) => variant.coverageM2 && variant.pricePence !== null)
    .filter((variant) => {
      const size = Object.entries(variant.options)
        .filter(([name]) => name !== COLOUR)
        .map(([, value]) => value)
        .join(' ');
      if (seen.has(size)) return false;
      seen.add(size);
      return true;
    })
    .map((variant) => {
      const coverage = variant.coverageM2 ?? 1;
      const packs = Math.ceil(needed / coverage);
      return {
        size:
          Object.entries(variant.options)
            .filter(([name]) => name !== COLOUR)
            .map(([, value]) => value)
            .join(', ') || variant.title,
        coversM2PerPack: coverage,
        packs,
        coversM2: Math.round(packs * coverage * 100) / 100,
        total: pounds(packs * (variant.pricePence ?? 0)),
      };
    });
}
