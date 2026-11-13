import { sql } from 'drizzle-orm';
import { createDatabase } from '../../src/database/client.js';
import { runMigrations } from '../../src/database/migrate.js';

// Wipes the catalogue so a test starts from nothing. Only on a database whose name ends in _test,
// so it can never empty the one used for local development or the demo.
export async function resetCatalogue(databaseUrl: string) {
  if (!new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error('Refusing to empty a database whose name does not end in _test');
  }
  await runMigrations(databaseUrl);
  const { db, close } = createDatabase(databaseUrl);
  try {
    await db.execute(
      sql`truncate product, variant, product_image, colour_image, colour, colour_set, category, basket, basket_line, "order", order_line cascade`,
    );
    await db.execute(sql`delete from audit_entry where subject in ('product', 'colour_set')`);
  } finally {
    await close();
  }
}
