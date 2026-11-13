import { and, eq } from 'drizzle-orm';
import type { Database } from '../database/client.js';
import { contentDocuments } from '../database/schema/index.js';

// Demo product extras, so a local run shows "complete the job" on the paving page. Real ones
// are written in /content.
const extras = {
  product: 'silver-grey-porcelain-paving',
  completeTheJob: [
    { handle: 'pavetuf-jointing-compound', reason: 'Fills the joints between the slabs' },
    { handle: 'porcelain-tile-spacers', reason: 'Keeps the joints even while you lay' },
  ],
  documents: [],
  features: [],
};

export async function seedSampleContent(db: Database) {
  const [existing] = await db
    .select({ id: contentDocuments.id })
    .from(contentDocuments)
    .where(
      and(eq(contentDocuments.type, 'product-extras'), eq(contentDocuments.key, extras.product)),
    );
  if (existing) return;
  await db.insert(contentDocuments).values({
    type: 'product-extras',
    key: extras.product,
    draft: extras,
    published: extras,
    status: 'published',
    updatedBy: 'Demo',
    publishedBy: 'Demo',
    publishedAt: new Date(),
  });
}
