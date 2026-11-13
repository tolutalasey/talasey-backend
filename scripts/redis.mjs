import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';

// Valkey is the open-source fork of Redis and speaks the same protocol. It has no ready-made
// macOS download, so the first `npm run db` builds it from source into .data/redis (about a minute;
// needs the Xcode command line tools, which git on a Mac already uses). No admin rights needed.
const VERSION = '9.0.7';
const SOURCE_URL = `https://codeload.github.com/valkey-io/valkey/tar.gz/refs/tags/${VERSION}`;
const ROOT = resolve('.data/redis');
const BUILT = join(ROOT, 'bin', `valkey-server-${VERSION}`);

function onPath(name) {
  try {
    return execFileSync('which', [name], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export function findRedisServer() {
  if (existsSync(BUILT)) return BUILT;
  return onPath('valkey-server') ?? onPath('redis-server');
}

export async function buildRedisServer(log = console.log) {
  const work = join(ROOT, 'src');
  const tarball = join(work, `valkey-${VERSION}.tar.gz`);
  const sourceDir = join(work, `valkey-${VERSION}`);
  mkdirSync(work, { recursive: true });

  if (!existsSync(sourceDir)) {
    log(`Downloading Valkey ${VERSION} source…`);
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
    writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
    execFileSync('tar', ['xzf', tarball, '-C', work]);
    rmSync(tarball);
  }

  log('Building Valkey (first run only)…');
  const jobs = String(Math.max(cpus().length, 1));
  execFileSync('make', ['-j', jobs, 'BUILD_TLS=no', 'valkey-server'], {
    cwd: sourceDir,
    stdio: 'ignore',
  });
  mkdirSync(join(ROOT, 'bin'), { recursive: true });
  copyFileSync(join(sourceDir, 'src', 'valkey-server'), BUILT);
  rmSync(work, { recursive: true, force: true });
  return BUILT;
}

export function startRedisServer(binary, port) {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  return spawn(
    binary,
    [
      '--port',
      String(port),
      '--bind',
      '127.0.0.1',
      '--dir',
      join(ROOT, 'data'),
      '--appendonly',
      'yes',
    ],
    { stdio: 'ignore' },
  );
}
