import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '../store/memory-key-value-store.js';
import { JobQueue } from './job-queue.js';

describe('JobQueue', () => {
  it('runs queued jobs in order', async () => {
    const queue = new JobQueue(new MemoryKeyValueStore());
    const seen: string[] = [];
    queue.handle<{ id: string }>('greet', async ({ id }) => {
      seen.push(id);
    });
    await queue.enqueue('greet', { id: 'a' });
    await queue.enqueue('greet', { id: 'b' });
    expect(await queue.drain()).toBe(2);
    expect(seen).toEqual(['a', 'b']);
  });

  it('tries a failing job three times, then keeps it aside', async () => {
    const queue = new JobQueue(new MemoryKeyValueStore());
    let tries = 0;
    queue.handle('flaky', async () => {
      tries += 1;
      throw new Error('carrier down');
    });
    await queue.enqueue('flaky', {});
    await queue.drain();
    expect(tries).toBe(3);
    expect(await queue.failed()).toMatchObject([{ name: 'flaky', attempt: 3 }]);
  });

  it('succeeds on a retry', async () => {
    const queue = new JobQueue(new MemoryKeyValueStore());
    let tries = 0;
    queue.handle('second-time', async () => {
      tries += 1;
      if (tries === 1) throw new Error('once');
    });
    await queue.enqueue('second-time', {});
    await queue.drain();
    expect(tries).toBe(2);
    expect(await queue.failed()).toEqual([]);
  });
});
