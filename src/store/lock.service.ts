import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { KEY_VALUE_STORE, type KeyValueStore } from './key-value-store.js';

export class LockTimeoutError extends Error {
  constructor(name: string) {
    super(`Timed out waiting for ${name}`);
    this.name = 'LockTimeoutError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class LockService {
  constructor(@Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore) {}

  // Runs work while holding the named lock, so only one instance of the API does it at a time.
  async withLock<T>(
    name: string,
    work: () => Promise<T>,
    { ttlMs = 10_000, waitMs = 5_000, retryMs = 25 } = {},
  ): Promise<T> {
    const key = `lock:${name}`;
    const token = randomUUID();
    const deadline = Date.now() + waitMs;
    while (!(await this.store.setIfAbsent(key, token, ttlMs))) {
      if (Date.now() >= deadline) throw new LockTimeoutError(name);
      await sleep(retryMs);
    }
    try {
      return await work();
    } finally {
      await this.store.deleteIfEquals(key, token);
    }
  }
}
