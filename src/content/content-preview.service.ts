import { Inject, Injectable } from '@nestjs/common';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

const TWO_HOURS = 2 * 60 * 60;

// What someone is typing into the editor, kept for the live preview only. It is never the draft,
// never logged and never reaches the site; it simply runs out.
@Injectable()
export class ContentPreviewService {
  constructor(@Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore) {}

  async stage(staffId: string, documentId: string, data: Record<string, unknown>) {
    await this.store.set(this.key(staffId, documentId), JSON.stringify(data), TWO_HOURS);
  }

  async staged(staffId: string, documentId: string): Promise<Record<string, unknown> | null> {
    const value = await this.store.get(this.key(staffId, documentId));
    return value ? (JSON.parse(value) as Record<string, unknown>) : null;
  }

  private key(staffId: string, documentId: string) {
    return `content-preview:${staffId}:${documentId}`;
  }
}
