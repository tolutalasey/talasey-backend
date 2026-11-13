import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

interface StoredSession {
  userId: string;
}

// Only a hash of the token is stored, so reading the store does not let anyone sign in.
const keyFor = (token: string) => `session:${createHash('sha256').update(token).digest('hex')}`;

@Injectable()
export class SessionService {
  constructor(
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get ttlSeconds() {
    return this.config.SESSION_DAYS * 24 * 60 * 60;
  }

  async start(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.set(
      keyFor(token),
      JSON.stringify({ userId } satisfies StoredSession),
      this.ttlSeconds,
    );
    return token;
  }

  // Each use pushes the expiry back, so staff stay signed in while they work.
  async userIdFor(token: string): Promise<string | null> {
    const key = keyFor(token);
    const stored = await this.store.get(key);
    if (!stored) return null;
    await this.store.expire(key, this.ttlSeconds);
    return (JSON.parse(stored) as StoredSession).userId;
  }

  async end(token: string): Promise<void> {
    await this.store.delete(keyFor(token));
  }
}
