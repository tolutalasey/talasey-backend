// Short-lived shared state: cache entries, staff sessions, locks and the job queue. Redis in
// staging and production; an in-memory store for local runs without Redis and for unit tests.
export interface KeyValueStore {
  readonly kind: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  // Adds one and returns the new count. The TTL is set when the key is created.
  increment(key: string, ttlSeconds: number): Promise<number>;
  // Sets the key only if it is free: the basis of a lock.
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  // Deletes the key only while it still holds this value, so a lock is released by its owner.
  deleteIfEquals(key: string, value: string): Promise<boolean>;
  push(list: string, value: string): Promise<void>;
  pop(list: string): Promise<string | null>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export const KEY_VALUE_STORE = Symbol('KeyValueStore');
