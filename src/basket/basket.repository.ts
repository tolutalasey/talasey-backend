import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import {
  basketLines,
  baskets,
  colours,
  products,
  variants,
  type BespokeRow,
  type BuildPartRow,
} from '../database/schema/index.js';
import type { PageType } from '../catalogue/rules/page-types.js';
import type { Basket, BasketLine } from './basket.js';

export interface NewLine {
  variantId: string;
  quantity: number;
  unitPricePence?: number | null;
  colourId?: string | null;
  buildId?: string | null;
  buildParts?: BuildPartRow[] | null;
  bespoke?: BespokeRow | null;
}

type BasketFields = Partial<
  Pick<
    Basket,
    'email' | 'address' | 'shipment' | 'slot' | 'access' | 'paymentReference' | 'orderId'
  >
>;

@Injectable()
export class BasketRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(): Promise<string> {
    const [row] = await this.db.insert(baskets).values({}).returning({ id: baskets.id });
    if (!row) throw new Error('Basket was not created');
    return row.id;
  }

  async find(id: string, executor: Executor = this.db, lock = false): Promise<Basket | null> {
    const query = executor.select().from(baskets).where(eq(baskets.id, id));
    const [row] = lock ? await query.for('update') : await query;
    if (!row) return null;

    const lines = await executor
      .select({
        id: basketLines.id,
        variantId: basketLines.variantId,
        quantity: basketLines.quantity,
        linePrice: basketLines.unitPricePence,
        colourId: basketLines.colourId,
        colour: colours.name,
        buildId: basketLines.buildId,
        buildParts: basketLines.buildParts,
        bespoke: basketLines.bespoke,
        productId: products.id,
        handle: products.handle,
        productTitle: products.title,
        published: products.published,
        pageType: products.pageType,
        stockMode: products.stockMode,
        variantTitle: variants.title,
        sku: variants.sku,
        options: variants.options,
        price: variants.pricePence,
        stockQuantity: variants.stockQuantity,
        weightKg: variants.weightKg,
      })
      .from(basketLines)
      .innerJoin(variants, eq(variants.id, basketLines.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .leftJoin(colours, eq(colours.id, basketLines.colourId))
      .where(eq(basketLines.basketId, id))
      .orderBy(asc(basketLines.createdAt), asc(basketLines.id));

    return {
      id: row.id,
      email: row.email,
      address: row.address,
      shipment: row.shipment,
      slot: row.slot,
      access: row.access,
      paymentReference: row.paymentReference,
      orderId: row.orderId,
      lines: lines.map(({ linePrice, price, pageType, ...line }): BasketLine => ({
        ...line,
        pageType: pageType as PageType | null,
        unitPricePence: line.bespoke ? linePrice : price,
      })),
    };
  }

  async update(id: string, fields: BasketFields, executor: Executor = this.db) {
    await executor
      .update(baskets)
      .set({ ...fields, updatedAt: sql`now()` })
      .where(eq(baskets.id, id));
  }

  // The same option in the same colour adds to the existing line; anything else is a new line.
  async addLine(basketId: string, line: NewLine, executor: Executor = this.db) {
    const mergeable = !line.buildId && !line.bespoke;
    if (mergeable) {
      const [existing] = await executor
        .select({ id: basketLines.id })
        .from(basketLines)
        .where(
          and(
            eq(basketLines.basketId, basketId),
            eq(basketLines.variantId, line.variantId),
            line.colourId
              ? eq(basketLines.colourId, line.colourId)
              : sql`${basketLines.colourId} is null`,
            sql`${basketLines.buildId} is null`,
            sql`${basketLines.bespoke} is null`,
          ),
        );
      if (existing) {
        await executor
          .update(basketLines)
          .set({ quantity: sql`${basketLines.quantity} + ${line.quantity}` })
          .where(eq(basketLines.id, existing.id));
        return;
      }
    }
    await executor.insert(basketLines).values({ ...line, basketId });
  }

  async setQuantity(basketId: string, lineId: string, quantity: number): Promise<boolean> {
    const where = and(eq(basketLines.basketId, basketId), eq(basketLines.id, lineId));
    const rows =
      quantity === 0
        ? await this.db.delete(basketLines).where(where).returning({ id: basketLines.id })
        : await this.db
            .update(basketLines)
            .set({ quantity })
            .where(where)
            .returning({ id: basketLines.id });
    return rows.length > 0;
  }
}
