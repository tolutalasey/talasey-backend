import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import type { Database, Executor } from '../../database/client.js';
import { DATABASE } from '../../database/database.module.js';
import { categories, products } from '../../database/schema/index.js';
import type { Actor } from '../../audit/audit-log.js';
import { AuditService } from '../../audit/audit.service.js';
import { CatalogueChanges } from '../catalogue-changes.service.js';
import { ColourSetRepository } from '../colour-sets/colour-set.repository.js';
import { PRODUCT_SUBJECT } from '../product-admin.service.js';
import type { ProductState, VariantState } from '../product.js';
import { ProductRepository } from '../product.repository.js';
import { colourSetName, planColourSets, planProfiles } from './colour-sets.js';
import {
  planImport,
  type ExistingProduct,
  type ImportPlan,
  type SkippedSku,
} from './import-plan.js';
import { handleFor } from './master-sheet.js';
import {
  hasVariants,
  type CatalogueSnapshot,
  type PimProduct,
  type PimVariant,
} from './pim-source.js';

export interface ImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  categoriesCreated: number;
  colourSetsCreated: number;
  coloursAdded: number;
  profilesCreated: number;
  skipped: SkippedSku[];
}

export const IMPORT_ACTOR: Actor = { id: null, name: 'Product sheet import' };

const categoryHandle = (path: string[]) => handleFor(path.join(' '));
const pence = (pounds: number | null) => (pounds === null ? null : Math.round(pounds * 100));
const pounds = (amount: number | null) => (amount === null ? null : amount / 100);

function categoryPaths(items: PimProduct[]): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const { categoryPath } of items) {
    categoryPath.forEach((_, depth) => {
      const path = categoryPath.slice(0, depth + 1);
      paths.set(categoryHandle(path), path);
    });
  }
  return paths;
}

function newVariant(variant: PimVariant, product: PimProduct): VariantState {
  return {
    id: randomUUID(),
    sku: variant.sku,
    title: variant.title,
    options: hasVariants(product) ? variant.options : {},
    pricePence: pence(variant.priceIncVat),
    weightKg: variant.weightKg,
    coverageM2: null,
    stockQuantity: 0,
    barcode: null,
  };
}

// New products from the sheet are made to order and have no page type until someone sets them
// up (or the sheet names a colour set, which makes them 1B).
function newProduct(product: PimProduct, categoryId: string | null): ProductState {
  return {
    handle: product.handle,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    brand: null,
    published: product.published,
    pageType: null,
    stockMode: 'made_to_order',
    leadTimeMinDays: null,
    leadTimeMaxDays: null,
    categoryId,
    options: product.options,
    colourSetId: null,
    colourOption: null,
    colourOptionValue: null,
    colourRequired: true,
    colourLabel: product.attributes.colour_label ?? null,
    bespoke: null,
    attributes: product.attributes,
    pimSku: product.sku,
    variants: product.variants.map((variant) => newVariant(variant, product)),
    images: [],
    colourImages: [],
  };
}

// Adds new products and brings existing ones in line with the sheet, in one transaction. Running
// it twice changes nothing the second time. With dryRun it only reports what it would do.
@Injectable()
export class CatalogueImporter {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly products: ProductRepository,
    private readonly colourSets: ColourSetRepository,
    private readonly audit: AuditService,
    private readonly changes: CatalogueChanges,
  ) {}

  async run(snapshot: CatalogueSnapshot, { dryRun = false } = {}): Promise<ImportResult> {
    if (dryRun) return this.plan(this.db, snapshot);
    let changedHandles: string[] = [];
    const result = await this.db.transaction(async (tx) => {
      const outcome = await this.apply(tx, snapshot);
      changedHandles = outcome.handles;
      return outcome.result;
    });
    if (changedHandles.length > 0 || result.colourSetsCreated > 0) {
      await this.changes.changed(changedHandles);
    }
    return result;
  }

  private async plan(executor: Executor, snapshot: CatalogueSnapshot): Promise<ImportResult> {
    const paths = categoryPaths(snapshot.products);
    const ids = await this.categoryIds(executor, [...paths.keys()]);
    const plan = planImport(
      snapshot.products,
      await this.existing(executor, snapshot.products),
      (product) => ids.get(categoryHandle(product.categoryPath)),
    );
    const existingSets = await this.colourSets.list(executor);
    const setPlan = planColourSets(snapshot.colourSets, existingSets);
    const setIds = new Map([
      ...setPlan.create.map((set) => [set.key, `new:${set.key}`] as const),
      ...this.knownSetIds(snapshot, existingSets),
    ]);
    const profiles = await this.profiles(executor, snapshot.products, setIds);
    return this.result(
      plan,
      [...paths.keys()].filter((h) => !ids.has(h)).length,
      {
        colourSetsCreated: setPlan.create.length,
        coloursAdded: setPlan.addColours.reduce((sum, add) => sum + add.colours.length, 0),
        profilesCreated: profiles.length,
      },
      true,
    );
  }

  private async apply(tx: Executor, snapshot: CatalogueSnapshot) {
    const paths = categoryPaths(snapshot.products);
    const ids = await this.categoryIds(tx, [...paths.keys()]);
    let categoriesCreated = 0;
    // Parents come before their children because paths are sorted shortest first.
    for (const [handle, path] of [...paths].sort(([, a], [, b]) => a.length - b.length)) {
      if (ids.has(handle)) continue;
      const parentId = path.length > 1 ? ids.get(categoryHandle(path.slice(0, -1))) : undefined;
      const [created] = await tx
        .insert(categories)
        .values({ handle, name: path[path.length - 1] ?? handle, parentId })
        .returning({ id: categories.id });
      if (created) ids.set(handle, created.id);
      categoriesCreated += 1;
    }
    const categoryIdFor = (product: PimProduct) => ids.get(categoryHandle(product.categoryPath));

    const plan = planImport(
      snapshot.products,
      await this.existing(tx, snapshot.products),
      categoryIdFor,
    );
    const handles: string[] = [];

    for (const product of plan.create) {
      const state = newProduct(product, categoryIdFor(product) ?? null);
      await this.save(tx, randomUUID(), null, state);
      handles.push(state.handle);
    }

    for (const change of plan.update) {
      const before = await this.products.load(change.id, tx);
      if (!before) continue;
      const priced = new Map(change.variants.map((variant) => [variant.id, variant]));
      const after: ProductState = {
        ...before,
        ...(change.fields && {
          title: change.fields.title,
          subtitle: change.fields.subtitle,
          description: change.fields.description,
          categoryId: change.fields.category_ids[0] ?? null,
          pimSku: change.source.sku,
          attributes: change.source.attributes,
        }),
        variants: [
          ...before.variants.map((variant) => {
            const update = priced.get(variant.id);
            if (!update) return variant;
            return {
              ...variant,
              title: update.title,
              weightKg: update.weight,
              ...(update.priceIncVat !== undefined && { pricePence: pence(update.priceIncVat) }),
            };
          }),
          ...change.newVariants.map((variant) => newVariant(variant, change.source)),
        ],
      };
      await this.save(tx, change.id, before, after);
      handles.push(after.handle);
    }

    const colours = await this.importColourSets(tx, snapshot, handles);
    return { result: this.result(plan, categoriesCreated, colours, false), handles };
  }

  // Colour sets from the sheet, and page type 1B with that set for each product that names one.
  private async importColourSets(tx: Executor, snapshot: CatalogueSnapshot, handles: string[]) {
    const existingSets = await this.colourSets.list(tx);
    const setPlan = planColourSets(snapshot.colourSets, existingSets);
    const setIds = this.knownSetIds(snapshot, existingSets);

    for (const set of setPlan.create) {
      const id = randomUUID();
      await this.colourSets.save(tx, id, {
        name: set.name,
        colours: set.colours.map(({ name, hex }) => ({ name, hex, photoUrl: null })),
      });
      setIds.set(set.key, id);
    }
    for (const add of setPlan.addColours) {
      const current = await this.colourSets.state(add.setId, tx);
      if (!current) continue;
      await this.colourSets.save(tx, add.setId, {
        name: current.name,
        colours: [
          ...current.colours,
          ...add.colours.map(({ name, hex }) => ({ name, hex, photoUrl: null })),
        ],
      });
    }

    const profiles = await this.profiles(tx, snapshot.products, setIds);
    for (const profile of profiles) {
      const before = await this.products.load(profile.product_id, tx);
      if (!before) continue;
      await this.save(tx, profile.product_id, before, {
        ...before,
        pageType: profile.page_type,
        colourSetId: profile.colour_set_id,
        colourOption: profile.colour_option,
        colourOptionValue: profile.colour_option_value,
        colourRequired: profile.colour_required,
      });
      handles.push(before.handle);
    }
    return {
      colourSetsCreated: setPlan.create.length,
      coloursAdded: setPlan.addColours.reduce((sum, add) => sum + add.colours.length, 0),
      profilesCreated: profiles.length,
    };
  }

  private knownSetIds(snapshot: CatalogueSnapshot, existing: { id: string; name: string }[]) {
    return new Map(
      snapshot.colourSets.flatMap((set) => {
        const found = existing.find((known) => known.name === colourSetName(set.key));
        return found ? [[set.key, found.id] as const] : [];
      }),
    );
  }

  // Products that name a colour set and have no page type yet. Products created in a dry run don't
  // exist, so a dry run only counts profiles for products already there.
  private async profiles(executor: Executor, items: PimProduct[], setIds: Map<string, string>) {
    const named = items.filter((product) => product.attributes.colour_set);
    if (named.length === 0) return [];
    const rows = await executor
      .select({ id: products.id, handle: products.handle, pageType: products.pageType })
      .from(products)
      .where(
        inArray(
          products.handle,
          named.map((product) => product.handle),
        ),
      );
    return planProfiles(
      named,
      new Map(rows.map((row) => [row.handle, row.id])),
      setIds,
      new Set(rows.filter((row) => row.pageType !== null).map((row) => row.id)),
    );
  }

  private async categoryIds(executor: Executor, handles: string[]) {
    if (handles.length === 0) return new Map<string, string>();
    const rows = await executor
      .select({ id: categories.id, handle: categories.handle })
      .from(categories)
      .where(inArray(categories.handle, handles));
    return new Map(rows.map((row) => [row.handle, row.id]));
  }

  private async existing(executor: Executor, items: PimProduct[]): Promise<ExistingProduct[]> {
    const ids = await this.products.idsByHandleOrSku(
      items.map((product) => product.handle),
      items.flatMap((product) => product.variants.map((variant) => variant.sku)),
      executor,
    );
    const found = await this.products.byIds(ids, executor);
    return found.map((product) => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      subtitle: product.subtitle,
      description: product.description,
      metadata: { pim_sku: product.pimSku, pim: product.attributes },
      categoryIds: product.categoryId ? [product.categoryId] : [],
      options: product.options,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        weightKg: variant.weightKg,
        priceIncVat: pounds(variant.pricePence),
        options: variant.options,
      })),
    }));
  }

  private async save(tx: Executor, id: string, before: ProductState | null, after: ProductState) {
    await this.products.save(tx, id, after);
    await this.audit.record(tx, IMPORT_ACTOR, {
      subject: PRODUCT_SUBJECT,
      subjectId: id,
      label: after.title,
      before,
      after,
    });
  }

  private result(
    plan: ImportPlan,
    categoriesCreated: number,
    colours: { colourSetsCreated: number; coloursAdded: number; profilesCreated: number },
    dryRun: boolean,
  ): ImportResult {
    return {
      dryRun,
      created: plan.create.length,
      updated: plan.update.length,
      unchanged: plan.unchanged.length,
      categoriesCreated,
      ...colours,
      skipped: plan.skipped,
    };
  }
}
