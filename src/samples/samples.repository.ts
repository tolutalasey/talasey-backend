import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import {
  productImages,
  products,
  sampleOffers,
  sampleRequests,
  type SampleItemRow,
} from '../database/schema/index.js';
import type { AddressRow } from '../database/schema/orders.js';
import type { SampleOffer } from './samples.schemas.js';

export type SampleRequestRow = typeof sampleRequests.$inferSelect;

const firstImage = sql<{ url: string; alt: string } | null>`(
  select json_build_object('url', ${productImages.url}, 'alt', ${productImages.alt})
  from ${productImages}
  where ${productImages.productId} = ${products.id}
  order by ${productImages.rank}
  limit 1
)`;

const offerColumns = {
  id: sampleOffers.id,
  label: sampleOffers.label,
  active: sampleOffers.active,
  productId: products.id,
  productTitle: products.title,
  productHandle: products.handle,
  image: firstImage,
};

@Injectable()
export class SamplesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // For the shop: active offers on published products. For staff: all of them.
  offers({ forShop }: { forShop: boolean }): Promise<SampleOffer[]> {
    return this.db
      .select(offerColumns)
      .from(sampleOffers)
      .innerJoin(products, eq(products.id, sampleOffers.productId))
      .where(forShop ? and(eq(sampleOffers.active, true), eq(products.published, true)) : undefined)
      .orderBy(asc(products.title), asc(sampleOffers.label));
  }

  offersByIds(ids: string[]): Promise<SampleOffer[]> {
    return this.db
      .select(offerColumns)
      .from(sampleOffers)
      .innerJoin(products, eq(products.id, sampleOffers.productId))
      .where(inArray(sampleOffers.id, ids));
  }

  async productIdByHandle(handle: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.handle, handle));
    return row?.id ?? null;
  }

  async createOffer(productId: string, label: string): Promise<string> {
    const [row] = await this.db
      .insert(sampleOffers)
      .values({ productId, label })
      .returning({ id: sampleOffers.id });
    if (!row) throw new Error('Sample offer was not created');
    return row.id;
  }

  async updateOffer(id: string, changes: { label?: string; active?: boolean }) {
    const rows = await this.db
      .update(sampleOffers)
      .set(changes)
      .where(eq(sampleOffers.id, id))
      .returning({ id: sampleOffers.id });
    return rows.length > 0;
  }

  async deleteOffer(id: string) {
    const rows = await this.db
      .delete(sampleOffers)
      .where(eq(sampleOffers.id, id))
      .returning({ id: sampleOffers.id });
    return rows.length > 0;
  }

  async createRequest(values: {
    email: string;
    address: AddressRow;
    items: SampleItemRow[];
    marketingConsent: boolean;
  }): Promise<SampleRequestRow> {
    const [row] = await this.db.insert(sampleRequests).values(values).returning();
    if (!row) throw new Error('Sample request was not saved');
    return row;
  }

  requests(status?: 'new' | 'dispatched'): Promise<SampleRequestRow[]> {
    return this.db
      .select()
      .from(sampleRequests)
      .where(status ? eq(sampleRequests.status, status) : undefined)
      .orderBy(desc(sampleRequests.createdAt))
      .limit(200);
  }

  async dispatch(id: string, by: string, at: Date): Promise<SampleRequestRow | null> {
    const [row] = await this.db
      .update(sampleRequests)
      .set({ status: 'dispatched', dispatchedAt: at, dispatchedBy: by })
      .where(and(eq(sampleRequests.id, id), eq(sampleRequests.status, 'new')))
      .returning();
    return row ?? null;
  }

  async findRequest(id: string): Promise<SampleRequestRow | null> {
    const [row] = await this.db.select().from(sampleRequests).where(eq(sampleRequests.id, id));
    return row ?? null;
  }
}
