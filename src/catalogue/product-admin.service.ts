import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { isUniqueViolation } from '../database/errors.js';
import type { Actor } from '../audit/audit-log.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogueChanges } from './catalogue-changes.service.js';
import type { NewProduct, ProductInput } from './catalogue.schemas.js';
import { ColourSetRepository } from './colour-sets/colour-set.repository.js';
import { handleFor } from './import/master-sheet.js';
import type { CatalogueProduct, ProductState } from './product.js';
import { ProductRepository } from './product.repository.js';
import { productProblems } from './rules/product-problems.js';
import { checkSkus, type SkuProblem } from './rules/sku-checks.js';

export const PRODUCT_SUBJECT = 'product';

export type ProductResult =
  | { status: 'saved'; product: CatalogueProduct }
  | { status: 'not-found' }
  | { status: 'invalid'; problems: string[] };

@Injectable()
export class ProductAdminService implements OnModuleInit {
  constructor(
    private readonly products: ProductRepository,
    private readonly colourSets: ColourSetRepository,
    private readonly audit: AuditService,
    private readonly changes: CatalogueChanges,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  onModuleInit() {
    this.audit.register<ProductState>({
      subject: PRODUCT_SUBJECT,
      permission: 'catalogue',
      current: (executor, id) => this.products.load(id, executor),
      restore: async (executor, id, state) => {
        if (state) {
          const problems = productProblems(state, await this.colourIds(state, executor));
          if (problems.length > 0) return problems;
        }
        const current = await this.products.load(id, executor);
        await this.products.save(executor, id, state);
        await this.changes.changed(
          [state?.handle, current?.handle].filter((h): h is string => !!h),
        );
        return [];
      },
    });
  }

  list(search?: string) {
    return this.products.summaries(search);
  }

  async find(id: string) {
    const product = await this.products.find({ id });
    if (!product) return null;
    return { product, problems: (await this.skuProblems()).filter((p) => p.productId === id) };
  }

  async create(input: NewProduct, actor: Actor): Promise<ProductResult> {
    const state: ProductState = {
      handle: input.handle ?? handleFor(input.title),
      title: input.title,
      subtitle: null,
      description: null,
      brand: null,
      published: false,
      pageType: '1A',
      stockMode: 'stocked',
      leadTimeMinDays: null,
      leadTimeMaxDays: null,
      categoryId: null,
      options: [],
      colourSetId: null,
      colourOption: null,
      colourOptionValue: null,
      colourRequired: true,
      colourLabel: null,
      sellOnline: true,
      offlineAction: 'stockist',
      bespoke: null,
      attributes: {},
      pimSku: null,
      variants: [
        {
          id: randomUUID(),
          sku: null,
          title: input.title,
          options: {},
          pricePence: null,
          weightKg: null,
          coverageM2: null,
          stockQuantity: 0,
          barcode: null,
        },
      ],
      images: [],
      colourImages: [],
    };
    return this.write(randomUUID(), () => state, actor, { isNew: true });
  }

  update(id: string, input: ProductInput, actor: Actor): Promise<ProductResult> {
    return this.write(
      id,
      (current) => ({
        ...input,
        attributes: current?.attributes ?? {},
        pimSku: current?.pimSku ?? null,
        bespoke: input.bespoke ?? null,
        // Only ids this product already has are kept; anything else is a new option.
        variants: input.variants.map((variant) => ({
          ...variant,
          id:
            current?.variants.some((own) => own.id === variant.id) && variant.id
              ? variant.id
              : randomUUID(),
        })),
      }),
      actor,
      { isNew: false },
    );
  }

  async remove(id: string, actor: Actor): Promise<boolean> {
    const removed = await this.db.transaction(async (tx) => {
      const before = await this.products.load(id, tx);
      if (!before) return null;
      await this.products.save(tx, id, null);
      await this.log(tx, actor, id, before, null);
      return before;
    });
    if (removed) await this.changes.changed([removed.handle]);
    return removed !== null;
  }

  async skuProblems(): Promise<(SkuProblem & { productTitle: string })[]> {
    const all = await this.products.all();
    const titles = new Map(all.map((product) => [product.id, product.title]));
    return checkSkus(
      all.map((product) => ({
        id: product.id,
        title: product.title,
        pageType: product.pageType,
        options: product.options.map((option) => option.title),
        variants: product.variants.map(({ id, sku, title }) => ({ id, sku, title })),
      })),
    ).map((problem) => ({ ...problem, productTitle: titles.get(problem.productId) ?? '' }));
  }

  private async write(
    id: string,
    build: (current: ProductState | null) => ProductState,
    actor: Actor,
    { isNew }: { isNew: boolean },
  ): Promise<ProductResult> {
    try {
      const result = await this.db.transaction(async (tx): Promise<ProductResult> => {
        const before = isNew ? null : await this.products.load(id, tx);
        if (!isNew && !before) return { status: 'not-found' };
        const state = build(before);
        const problems = productProblems(state, await this.colourIds(state, tx));
        if (problems.length > 0) return { status: 'invalid', problems };

        await this.products.save(tx, id, state);
        await this.log(tx, actor, id, before, state);
        const product = await this.products.find({ id }, tx);
        return product ? { status: 'saved', product } : { status: 'not-found' };
      });
      if (result.status === 'saved') await this.changes.changed([result.product.handle]);
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { status: 'invalid', problems: ['Another product already uses that web address'] };
      }
      throw error;
    }
  }

  private async colourIds(state: ProductState, executor: Executor) {
    if (!state.colourSetId) return new Set<string>();
    const set = await this.colourSets.find(state.colourSetId, executor);
    return new Set(set?.colours.map((colour) => colour.id) ?? []);
  }

  private log(
    executor: Executor,
    actor: Actor,
    id: string,
    before: ProductState | null,
    after: ProductState | null,
  ) {
    return this.audit.record(executor, actor, {
      subject: PRODUCT_SUBJECT,
      subjectId: id,
      label: (after ?? before)?.title ?? id,
      before,
      after,
    });
  }
}
