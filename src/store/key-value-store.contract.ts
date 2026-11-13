import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { KeyValueStore } from './key-value-store.js';
import { LockService } from './lock.service.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The behaviour every store must have. Run against the in-memory store in unit tests and against
// a real Redis in the integration tests.
export function describeKeyValueStore(name: string, create: () => KeyValueStore) {
  describe(`${name} key-value store`, () => {
    const store = create();
    let run = 0;
    let key: (name: string) => string;

    beforeEach(() => {
      run += 1;
      const prefix = `test:${Date.now()}:${run}:`;
      key = (name) => `${prefix}${name}`;
    });

    afterAll(() => store.close());

    it('stores, reads and deletes values', async () => {
      await store.set(key('a'), '1');
      expect(await store.get(key('a'))).toBe('1');
      await store.delete(key('a'));
      expect(await store.get(key('a'))).toBeNull();
    });

    it('forgets values when their time is up, and expire extends it', async () => {
      await store.set(key('short'), 'x', 1);
      await store.set(key('kept'), 'y', 1);
      await store.expire(key('kept'), 5);
      await wait(1_100);
      expect(await store.get(key('short'))).toBeNull();
      expect(await store.get(key('kept'))).toBe('y');
    });

    it('counts up and keeps the first expiry', async () => {
      expect(await store.increment(key('count'), 60)).toBe(1);
      expect(await store.increment(key('count'), 60)).toBe(2);
    });

    it('lets only one caller take a lock key, and only its owner release it', async () => {
      expect(await store.setIfAbsent(key('lock'), 'me', 1_000)).toBe(true);
      expect(await store.setIfAbsent(key('lock'), 'you', 1_000)).toBe(false);
      expect(await store.deleteIfEquals(key('lock'), 'you')).toBe(false);
      expect(await store.deleteIfEquals(key('lock'), 'me')).toBe(true);
      expect(await store.setIfAbsent(key('lock'), 'you', 1_000)).toBe(true);
    });

    it('frees a lock key that was never released', async () => {
      await store.setIfAbsent(key('stale'), 'gone', 50);
      await wait(120);
      expect(await store.setIfAbsent(key('stale'), 'next', 1_000)).toBe(true);
    });

    it('queues values first in, first out', async () => {
      await store.push(key('queue'), 'one');
      await store.push(key('queue'), 'two');
      expect(await store.pop(key('queue'))).toBe('one');
      expect(await store.pop(key('queue'))).toBe('two');
      expect(await store.pop(key('queue'))).toBeNull();
    });

    it('runs locked work one at a time', async () => {
      const locks = new LockService(store);
      let running = 0;
      let most = 0;
      await Promise.all(
        Array.from({ length: 5 }, () =>
          locks.withLock(key('work'), async () => {
            running += 1;
            most = Math.max(most, running);
            await wait(20);
            running -= 1;
          }),
        ),
      );
      expect(most).toBe(1);
    });

    it('answers a ping', async () => {
      expect(await store.ping()).toBe(true);
    });
  });
}
