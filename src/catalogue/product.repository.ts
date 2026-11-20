import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import {
  categories,
  colourImages,
  productImages,
  products,
  variants,
} from '../database/schema/index.js';
import {
  OFFLINE_ACTIONS,
  type CatalogueProduct,
  type OfflineAction,
  type ProductState,
  type ProductSummary,
  type VariantState,
} from './product.js';
import type { PageType } from './rules/page-types.js';

const offlineActionOf = (value: string): OfflineAction =>
  OFFLINE_ACTIONS.includes(value as OfflineAction) ? (value as OfflineAction) : 'stockist';

type ProductRow = typeof products.$inferSelect;

const variantColumns = {
  id: variants.id,
  productId: variants.productId,
  sku: variants.sku,
  title: variants.title,
  options: variants.options,
  pricePence: variants.pricePence,
  weightKg: variants.weightKg,
  coverageM2: variants.coverageM2,
  stockQuantity: variants.stockQuantity,
  barcode: variants.barcode,
};

function productFields(state: ProductState) {
  return {
    handle: state.handle,
    title: state.title,
    subtitle: state.subtitle,
    description: state.description,
    brand: state.brand,
    published: state.published,
    pageType: state.pageType,
    stockMode: state.stockMode,
    leadTimeMinDays: state.leadTimeMinDays,
    leadTimeMaxDays: state.leadTimeMaxDays,
    categoryId: state.categoryId,
    options: state.options,
    colourSetId: state.colourSetId,
    colourOption: state.colourOption,
    colourOptionValue: state.colourOptionValue,
    colourRequired: state.colourRequired,
    colourLabel: state.colourLabel,
    sellOnline: state.sellOnline,
    offlineAction: state.offlineAction,
    bespoke: state.bespoke ?? null,
    attributes: state.attributes,
    pimSku: state.pimSku,
  };
}

@Injectable()
export class ProductRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async load(id: string, executor: Executor = this.db): Promise<ProductState | null> {
    const [product] = await this.withChildren(executor, [eq(products.id, id)]);
    if (!product) return null;
    const { id: _id, updatedAt: _updated, category: _category, ...state } = product;
    return state;
  }

  async find(where: { id?: string; handle?: string }, executor: Executor = this.db) {
    const condition = where.id
      ? eq(products.id, where.id)
      : eq(products.handle, where.handle ?? '');
    const [product] = await this.withChildren(executor, [condition]);
    return product ?? null;
  }

  published(executor: Executor = this.db): Promise<CatalogueProduct[]> {
    return this.withChildren(executor, [eq(products.published, true)]);
  }

  all(executor: Executor = this.db): Promise<CatalogueProduct[]> {
    return this.withChildren(executor, []);
  }

  async idsByHandleOrSku(handles: string[], skus: string[], executor: Executor = this.db) {
    if (handles.length === 0 && skus.length === 0) return [];
    const byHandle = handles.length
      ? await executor
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.handle, handles))
      : [];
    const bySku = skus.length
      ? await executor
          .select({ id: variants.productId })
          .from(variants)
          .where(inArray(variants.sku, skus))
      : [];
    return [...new Set([...byHandle, ...bySku].map((row) => row.id))];
  }

  async idsForVariants(variantIds: string[], executor: Executor = this.db): Promise<string[]> {
    if (variantIds.length === 0) return [];
    const rows = await executor
      .select({ productId: variants.productId })
      .from(variants)
      .where(inArray(variants.id, variantIds));
    return [...new Set(rows.map((row) => row.productId))];
  }

  async byIds(ids: string[], executor: Executor = this.db): Promise<CatalogueProduct[]> {
    if (ids.length === 0) return [];
    return this.withChildren(executor, [inArray(products.id, ids)]);
  }

  async summaries(search: string | undefined): Promise<ProductSummary[]> {
    const term = search?.trim();
    const rows = await this.db
      .select({
        id: products.id,
        handle: products.handle,
        title: products.title,
        published: products.published,
        pageType: products.pageType,
        updatedAt: products.updatedAt,
        variantCount: sql<number>`count(${variants.id})::int`,
        priceFromPence: sql<number | null>`min(${variants.pricePence})`,
        unpriced: sql<number>`count(${variants.id}) filter (where ${variants.pricePence} is null)::int`,
        thumbnail: sql<
          string | null
        >`(select url from product_image i where i.product_id = ${products.id} order by i.rank limit 1)`,
      })
      .from(products)
      .leftJoin(variants, eq(variants.productId, products.id))
      .where(
        term
          ? or(
              ilike(products.title, `%${term}%`),
              ilike(products.handle, `%${term}%`),
              ilike(variants.sku, `%${term}%`),
            )
          : undefined,
      )
      .groupBy(products.id)
      .orderBy(desc(products.updatedAt));
    return rows.map((row) => ({ ...row, pageType: row.pageType as PageType | null }));
  }

  // Writes a product's whole state. Variants keep their ids, so basket lines and orders still
  // point at them; variants missing from the state are removed. Null deletes the product.
  async save(executor: Executor, id: string, state: ProductState | null): Promise<void> {
    if (!state) {
      await executor.delete(products).where(eq(products.id, id));
      return;
    }
    await executor
      .insert(products)
      .values({ id, ...productFields(state) })
      .onConflictDoUpdate({
        target: products.id,
        set: { ...productFields(state), updatedAt: sql`now()` },
      });

    const keep = state.variants.map((variant) => variant.id);
    const existing = await executor
      .select({ id: variants.id })
      .from(variants)
      .where(eq(variants.productId, id));
    const removed = existing.map((row) => row.id).filter((variantId) => !keep.includes(variantId));
    if (removed.length > 0) await executor.delete(variants).where(inArray(variants.id, removed));
    for (const [rank, variant] of state.variants.entries()) {
      const values = { ...variant, productId: id, rank };
      await executor
        .insert(variants)
        .values(values)
        .onConflictDoUpdate({ target: variants.id, set: values });
    }

    await executor.delete(productImages).where(eq(productImages.productId, id));
    if (state.images.length > 0) {
      await executor.insert(productImages).values(
        state.images.map(({ shows, ...image }, rank) => ({
          ...image,
          showsOption: shows?.option ?? null,
          showsValue: shows?.value ?? null,
          productId: id,
          rank,
        })),
      );
    }
    await executor.delete(colourImages).where(eq(colourImages.productId, id));
    if (state.colourImages.length > 0) {
      await executor
        .insert(colourImages)
        .values(state.colourImages.map((image) => ({ ...image, productId: id })));
    }
  }

  private async withChildren(executor: Executor, where: SQL[]): Promise<CatalogueProduct[]> {
    const rows = await executor
      .select({ product: products, category: { handle: categories.handle, name: categories.name } })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(where[0])
      .orderBy(asc(products.title));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.product.id);

    const [variantRows, imageRows, colourImageRows] = await Promise.all([
      executor
        .select(variantColumns)
        .from(variants)
        .where(inArray(variants.productId, ids))
        .orderBy(asc(variants.rank)),
      executor
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, ids))
        .orderBy(asc(productImages.rank)),
      executor.select().from(colourImages).where(inArray(colourImages.productId, ids)),
    ]);

    return rows.map(({ product, category }) =>
      toProduct(product, category?.handle ? category : null, {
        variants: variantRows.filter((row) => row.productId === product.id),
        images: imageRows.filter((row) => row.productId === product.id),
        colourImages: colourImageRows.filter((row) => row.productId === product.id),
      }),
    );
  }
}

function toProduct(
  row: ProductRow,
  category: { handle: string; name: string } | null,
  children: {
    variants: (VariantState & { productId: string })[];
    images: {
      url: string;
      alt: string;
      width: number | null;
      height: number | null;
      showsOption: string | null;
      showsValue: string | null;
    }[];
    colourImages: { colourId: string; size: string; finish: string; url: string; alt: string }[];
  },
): CatalogueProduct {
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    category,
    handle: row.handle,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    brand: row.brand,
    published: row.published,
    pageType: row.pageType as PageType | null,
    stockMode: row.stockMode,
    leadTimeMinDays: row.leadTimeMinDays,
    leadTimeMaxDays: row.leadTimeMaxDays,
    categoryId: row.categoryId,
    options: row.options,
    colourSetId: row.colourSetId,
    colourOption: row.colourOption,
    colourOptionValue: row.colourOptionValue,
    colourRequired: row.colourRequired,
    colourLabel: row.colourLabel,
    sellOnline: row.sellOnline,
    offlineAction: offlineActionOf(row.offlineAction),
    bespoke: row.bespoke,
    attributes: row.attributes,
    pimSku: row.pimSku,
    variants: children.variants.map(({ productId: _product, ...variant }) => variant),
    images: children.images.map(({ url, alt, width, height, showsOption, showsValue }) => ({
      url,
      alt,
      width,
      height,
      shows: showsOption && showsValue ? { option: showsOption, value: showsValue } : null,
    })),
    colourImages: children.colourImages.map(({ colourId, size, finish, url, alt }) => ({
      colourId,
      size,
      finish,
      url,
      alt,
    })),
  };
}
