import { eq } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { products, sampleOffers } from '../database/schema/index.js';

// Demo samples for local runs, so the samples journey works before staff set real ones up.
const demo = [
  { handle: 'silver-grey-porcelain-paving', label: 'Silver grey' },
  { handle: 'pavetuf-jointing-compound', label: 'Grey' },
  { handle: 'pavetuf-jointing-compound', label: 'Buff' },
];

export async function seedSampleOffers(db: Database) {
  const existing = await db.select({ id: sampleOffers.id }).from(sampleOffers).limit(1);
  if (existing.length > 0) return;
  for (const { handle, label } of demo) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.handle, handle));
    if (product) await db.insert(sampleOffers).values({ productId: product.id, label });
  }
}
