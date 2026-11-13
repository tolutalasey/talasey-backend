import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { parseConfig } from '../config/config.schema.js';
import { createDatabase } from './client.js';
import { isEntryPoint } from './run-as-script.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(databaseUrl: string) {
  const { db, close } = createDatabase(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

if (isEntryPoint(import.meta.url)) {
  await runMigrations(parseConfig(process.env).DATABASE_URL);
}
