import { isDeepStrictEqual } from 'node:util';
import { hasVariants, type PimProduct, type PimVariant } from './pim-source.js';

export interface ExistingVariant {
  id: string;
  sku: string | null;
  title: string;
  weightKg: number | null;
  priceIncVat: number | null;
  options: Record<string, string>;
}

export interface ExistingProduct {
  id: string;
  handle: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  categoryIds: string[];
  options: { title: string; values: string[] }[];
  variants: ExistingVariant[];
}

export interface ProductFields {
  title: string;
  subtitle: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  category_ids: string[];
}

export interface VariantChange {
  id: string;
  sku: string;
  title: string;
  weight: number | null;
  // Left out when the sheet has no price, so a price set in the admin is kept.
  priceIncVat?: number;
}

export interface ProductChange {
  id: string;
  handle: string;
  source: PimProduct;
  fields: ProductFields | null;
  variants: VariantChange[];
  newVariants: PimVariant[];
}

export interface SkippedSku {
  sku: string;
  handle: string;
  reason: string;
}

export interface ImportPlan {
  create: PimProduct[];
  update: ProductChange[];
  unchanged: string[];
  skipped: SkippedSku[];
}

export const NEW_OPTION_VALUE =
  'New option value on a product already in the catalogue. Add the value in the admin, then import again.';

function productFields(
  product: PimProduct,
  existing: ExistingProduct,
  categoryId: string | undefined,
): ProductFields {
  return {
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    metadata: { ...existing.metadata, pim_sku: product.sku, pim: product.attributes },
    category_ids: categoryId ? [categoryId] : [],
  };
}

function fieldsChanged(fields: ProductFields, existing: ExistingProduct): boolean {
  return (
    fields.title !== existing.title ||
    fields.subtitle !== existing.subtitle ||
    fields.description !== existing.description ||
    !isDeepStrictEqual(fields.metadata, existing.metadata) ||
    !isDeepStrictEqual([...fields.category_ids].sort(), [...existing.categoryIds].sort())
  );
}

function variantChange(variant: PimVariant, existing: ExistingVariant): VariantChange | null {
  const priceChanged = variant.priceIncVat !== null && variant.priceIncVat !== existing.priceIncVat;
  const changed =
    variant.title !== existing.title || variant.weightKg !== existing.weightKg || priceChanged;
  if (!changed) return null;
  return {
    id: existing.id,
    sku: variant.sku,
    title: variant.title,
    weight: variant.weightKg,
    ...(priceChanged && { priceIncVat: variant.priceIncVat as number }),
  };
}

function hasOptionValues(product: PimProduct, variant: PimVariant, existing: ExistingProduct) {
  if (!hasVariants(product)) return false;
  return Object.entries(variant.options).every(([title, value]) =>
    existing.options.some((option) => option.title === title && option.values.includes(value)),
  );
}

function findExisting(
  product: PimProduct,
  byHandle: Map<string, ExistingProduct>,
  bySku: Map<string, ExistingProduct>,
): ExistingProduct | undefined {
  return (
    byHandle.get(product.handle) ??
    product.variants.map((variant) => bySku.get(variant.sku)).find(Boolean)
  );
}

// Works out what an import would change. Products are matched by handle, then by any of their
// SKUs, so renaming a product in the sheet updates it instead of adding a second one. A matched
// product keeps its handle, so its URL doesn't change.
export function planImport(
  products: PimProduct[],
  existing: ExistingProduct[],
  categoryIdFor: (product: PimProduct) => string | undefined,
): ImportPlan {
  const byHandle = new Map(existing.map((product) => [product.handle, product]));
  const bySku = new Map(
    existing.flatMap((product) =>
      product.variants.flatMap((variant) => (variant.sku ? [[variant.sku, product] as const] : [])),
    ),
  );
  const plan: ImportPlan = { create: [], update: [], unchanged: [], skipped: [] };

  for (const product of products) {
    const match = findExisting(product, byHandle, bySku);
    if (!match) {
      plan.create.push(product);
      continue;
    }

    const fields = productFields(product, match, categoryIdFor(product));
    const variantsBySku = new Map(match.variants.map((variant) => [variant.sku, variant]));
    const variants: VariantChange[] = [];
    const newVariants: PimVariant[] = [];

    for (const variant of product.variants) {
      const current = variantsBySku.get(variant.sku);
      if (current) {
        const change = variantChange(variant, current);
        if (change) variants.push(change);
      } else if (hasOptionValues(product, variant, match)) {
        newVariants.push(variant);
      } else {
        plan.skipped.push({ sku: variant.sku, handle: match.handle, reason: NEW_OPTION_VALUE });
      }
    }

    const change: ProductChange = {
      id: match.id,
      handle: match.handle,
      source: product,
      fields: fieldsChanged(fields, match) ? fields : null,
      variants,
      newVariants,
    };
    if (change.fields || variants.length > 0 || newVariants.length > 0) plan.update.push(change);
    else plan.unchanged.push(match.handle);
  }

  return plan;
}
