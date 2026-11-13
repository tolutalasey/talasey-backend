import { Redis } from 'ioredis';
import type { KeyValueStore } from './key-value-store.js';

const DELETE_IF_EQUALS = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

const INCREMENT_WITH_TTL = `local count = redis.call('incr', KEYS[1])
if count == 1 then redis.call('expire', KEYS[1], ARGV[1]) end
return count`;

export class RedisKeyValueStore implements KeyValueStore {
  readonly kind = 'redis';

  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'talasey:',
  ) {}

  static connect(url: string, prefix?: string) {
    return new RedisKeyValueStore(new Redis(url, { maxRetriesPerRequest: 2 }), prefix);
  }

  async get(key: string) {
    return this.redis.get(this.key(key));
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(this.key(key), value, 'EX', ttlSeconds);
    else await this.redis.set(this.key(key), value);
  }

  async delete(...keys: string[]) {
    if (keys.length > 0) await this.redis.del(...keys.map((key) => this.key(key)));
  }

  async expire(key: string, ttlSeconds: number) {
    await this.redis.expire(this.key(key), ttlSeconds);
  }

  async increment(key: string, ttlSeconds: number) {
    return Number(await this.redis.eval(INCREMENT_WITH_TTL, 1, this.key(key), ttlSeconds));
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    return (await this.redis.set(this.key(key), value, 'PX', ttlMs, 'NX')) === 'OK';
  }

  async deleteIfEquals(key: string, value: string) {
    return Number(await this.redis.eval(DELETE_IF_EQUALS, 1, this.key(key), value)) === 1;
  }

  async push(list: string, value: string) {
    await this.redis.rpush(this.key(list), value);
  }

  async pop(list: string) {
    return this.redis.lpop(this.key(list));
  }

  async ping() {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close() {
    await this.redis.quit();
  }

  private key(key: string) {
    return `${this.prefix}${key}`;
  }
}
