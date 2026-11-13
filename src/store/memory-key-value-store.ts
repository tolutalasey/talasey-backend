import type { Clock } from '../common/clock.js';
import type { KeyValueStore } from './key-value-store.js';

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class MemoryKeyValueStore implements KeyValueStore {
  readonly kind = 'memory';
  private readonly entries = new Map<string, Entry>();
  private readonly lists = new Map<string, string[]>();

  constructor(private readonly clock: Clock = () => new Date()) {}

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.entries.set(key, { value, expiresAt: ttlSeconds ? this.after(ttlSeconds * 1000) : null });
  }

  async delete(...keys: string[]) {
    for (const key of keys) this.entries.delete(key);
  }

  async expire(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    if (entry) entry.expiresAt = this.after(ttlSeconds * 1000);
  }

  async increment(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    const count = Number(entry?.value ?? 0) + 1;
    this.entries.set(key, {
      value: String(count),
      expiresAt: entry?.expiresAt ?? this.after(ttlSeconds * 1000),
    });
    return count;
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    if (this.live(key)) return false;
    this.entries.set(key, { value, expiresAt: this.after(ttlMs) });
    return true;
  }

  async deleteIfEquals(key: string, value: string) {
    if (this.live(key)?.value !== value) return false;
    this.entries.delete(key);
    return true;
  }

  async push(list: string, value: string) {
    this.lists.set(list, [...(this.lists.get(list) ?? []), value]);
  }

  async pop(list: string) {
    return this.lists.get(list)?.shift() ?? null;
  }

  async ping() {
    return true;
  }

  async close() {
    this.entries.clear();
    this.lists.clear();
  }

  private after(ms: number) {
    return this.clock().getTime() + ms;
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt !== null) {
      if (entry.expiresAt <= this.clock().getTime()) {
        this.entries.delete(key);
        return undefined;
      }
    }
    return entry;
  }
}
