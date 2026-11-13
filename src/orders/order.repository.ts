import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { Database, Executor } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { orderLines, orders, variants, type SlotChoiceRow } from '../database/schema/index.js';

export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type NewOrder = Omit<typeof orders.$inferInsert, 'id' | 'number' | 'createdAt'>;
export type NewOrderLine = Omit<typeof orderLines.$inferInsert, 'id' | 'orderId'>;

export interface Order extends OrderRow {
  lines: OrderLineRow[];
}

@Injectable()
export class OrderRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(
    executor: Executor,
    order: NewOrder,
    lines: (NewOrderLine & { shipNow: number })[],
  ): Promise<string> {
    const [created] = await executor.insert(orders).values(order).returning({ id: orders.id });
    if (!created) throw new Error('Order was not created');
    await executor
      .insert(orderLines)
      .values(lines.map(({ shipNow: _now, ...line }) => ({ ...line, orderId: created.id })));
    // What ships from the yard comes off the stock count now; made-to-order quantities don't.
    for (const line of lines) {
      if (line.shipNow > 0 && line.variantId) {
        await executor
          .update(variants)
          .set({ stockQuantity: sql`greatest(${variants.stockQuantity} - ${line.shipNow}, 0)` })
          .where(eq(variants.id, line.variantId));
      }
    }
    return created.id;
  }

  async find(id: string, executor: Executor = this.db): Promise<Order | null> {
    const [order] = await executor.select().from(orders).where(eq(orders.id, id));
    if (!order) return null;
    const lines = await executor
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, id))
      .orderBy(asc(orderLines.id));
    return { ...order, lines };
  }

  list(limit: number): Promise<OrderRow[]> {
    return this.db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  }

  async setSlot(id: string, slot: SlotChoiceRow) {
    await this.db.update(orders).set({ slot }).where(eq(orders.id, id));
  }

  async recordRefund(id: string, refundedPence: number, totalPence: number) {
    await this.db
      .update(orders)
      .set({
        refundedPence,
        paymentStatus: refundedPence >= totalPence ? 'refunded' : 'partly_refunded',
      })
      .where(eq(orders.id, id));
  }
}
