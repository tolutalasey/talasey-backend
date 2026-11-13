import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export function createDatabase(url: string) {
  const sql = postgres(url, { max: 10, onnotice: () => undefined });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;
