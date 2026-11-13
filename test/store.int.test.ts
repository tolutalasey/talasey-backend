import { describe, it } from 'vitest';
import { describeKeyValueStore } from '../src/store/key-value-store.contract.js';
import { RedisKeyValueStore } from '../src/store/redis-key-value-store.js';

const redisUrl = process.env.REDIS_URL ?? '';

if (redisUrl) describeKeyValueStore('Redis', () => RedisKeyValueStore.connect(redisUrl));
else describe.skip('Redis key-value store (set REDIS_URL to run)', () => it('needs Redis'));
