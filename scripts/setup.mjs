import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';

const MIN_NODE_MAJOR = 22;

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function reachable(port) {
  return new Promise((resolve) => {
    const socket = connect(port, 'localhost');
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < MIN_NODE_MAJOR)
  fail(`Node ${MIN_NODE_MAJOR}+ is required (24 recommended); you have ${process.version}.`);
if (!(await reachable(5432)))
  fail(
    'Postgres is not running. Start it in another terminal with `pnpm db`, then run `pnpm setup` again.',
  );

const redisRunning = await reachable(6379);
if (!redisRunning)
  console.warn('\nRedis is not running, so sessions, cache and jobs are kept in memory.');

if (!existsSync('.env')) {
  let contents = readFileSync('.env.example', 'utf8').replace(
    /^REVALIDATE_SECRET=$/m,
    `REVALIDATE_SECRET=${randomBytes(24).toString('hex')}`,
  );
  if (!redisRunning) contents = contents.replace(/^REDIS_URL=.*$/m, 'REDIS_URL=');
  writeFileSync('.env', contents);
  console.log('Created .env');
}

run('pnpm build');
run('pnpm db:migrate');
run('pnpm db:seed');

console.log(
  [
    '',
    'Done. Keep `pnpm db` running and start the API with `pnpm dev`:',
    '  API       http://localhost:4000',
    '  API docs  http://localhost:4000/docs',
    'To load the full catalogue: pnpm catalogue:import',
  ].join('\n'),
);
