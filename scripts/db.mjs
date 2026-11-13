import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { buildRedisServer, findRedisServer, startRedisServer } from './redis.mjs';

const DATA_DIR = '.data/postgres';
const DATABASES = ['api', 'api_test'];
const REDIS_PORT = 6379;

function inUse(port) {
  return new Promise((resolve) => {
    const socket = connect(port, 'localhost');
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

if (await inUse(5432)) {
  console.error(
    'Something is already using port 5432, usually an old Postgres. Stop it with `pkill -f postgres` and run `pnpm db` again.',
  );
  process.exit(1);
}

const isNew = !existsSync(DATA_DIR);
const postgres = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'talasey',
  password: 'talasey',
  port: 5432,
  persistent: true,
  onLog: () => {},
});

try {
  if (isNew) await postgres.initialise();
  await postgres.start();
} catch {
  console.error(
    'Postgres could not start. If .data/postgres is left from an older setup, move it aside with `mv .data/postgres .data/postgres-old` and run `pnpm db` again.',
  );
  process.exit(1);
}

const client = postgres.getPgClient();
await client.connect();
const { rows } = await client.query('select datname from pg_database');
await client.end();
const existing = new Set(rows.map((row) => row.datname));
for (const name of DATABASES) {
  if (!existing.has(name)) await postgres.createDatabase(name);
}

console.log('Postgres is running on localhost:5432 (data in .data/postgres).');

let redis = null;
try {
  const binary = findRedisServer() ?? (await buildRedisServer());
  redis = startRedisServer(binary, REDIS_PORT);
  redis.once('exit', (code) => {
    if (code) console.error(`Redis stopped (exit code ${code}). Is port ${REDIS_PORT} in use?`);
  });
  console.log(`Redis is running on localhost:${REDIS_PORT} (data in .data/redis).`);
} catch (error) {
  console.warn(
    `Redis could not start (${error.message}). The API falls back to its in-memory store;` +
      ' remove REDIS_URL from .env until Redis runs.',
  );
}

console.log('Press Ctrl+C to stop.');

const stop = async () => {
  redis?.kill();
  await postgres.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
