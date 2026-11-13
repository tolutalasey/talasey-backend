import { hashPassword } from '../auth/password.js';
import type { StaffRole } from '../auth/roles.js';
import { parseConfig } from '../config/config.schema.js';
import { seedSampleProducts } from '../catalogue/sample-products.js';
import { seedSampleContent } from '../content/sample-content.js';
import { seedSampleDelivery } from '../delivery/sample-delivery.js';
import { createDatabase, type Database } from './client.js';
import { isEntryPoint } from './run-as-script.js';
import { staffUsers } from './schema/index.js';

// Demo accounts, one per role, for local runs and the demo. Never created in production.
export const DEMO_PASSWORD = 'talasey-demo';

export const demoStaff: { email: string; name: string; role: StaffRole }[] = [
  { email: 'owner@talasey.local', name: 'Olu Owner', role: 'owner' },
  { email: 'catalogue@talasey.local', name: 'Cat Catalogue', role: 'catalogue' },
  { email: 'editor@talasey.local', name: 'Ed Editor', role: 'editor' },
  { email: 'contributor@talasey.local', name: 'Connie Contributor', role: 'contributor' },
];

async function seedStaff(db: Database) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db
    .insert(staffUsers)
    .values(demoStaff.map((user) => ({ ...user, passwordHash })))
    .onConflictDoNothing({ target: staffUsers.email });
}

export async function seed(databaseUrl: string, { demo = false }: { demo?: boolean } = {}) {
  const { db, close } = createDatabase(databaseUrl);
  try {
    await seedSampleDelivery(db);
    if (demo) {
      await seedStaff(db);
      await seedSampleProducts(db);
      await seedSampleContent(db);
    }
  } finally {
    await close();
  }
}

if (isEntryPoint(import.meta.url)) {
  const config = parseConfig(process.env);
  await seed(config.DATABASE_URL, { demo: config.NODE_ENV !== 'production' });
}
