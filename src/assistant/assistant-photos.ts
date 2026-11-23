import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { photoKind } from '../enquiries/photos.js';
import { FILE_STORAGE, type FileStorage } from '../uploads/file-storage.js';
import { MAX_PHOTO_BYTES } from './assistant.schemas.js';

// The kinds the answer model can look at. The chat turns every photo into a JPEG before sending.
const LOOKABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StoredPhoto {
  bytes: Buffer;
  contentType: string;
}

export type SaveResult = { ok: true; photoId: string } | { ok: false; problem: string };

// Garden photos sent in the chat. Kept privately, never served on the site, and only read back to
// show the model again later in the same conversation.
@Injectable()
export class AssistantPhotos {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async save(bytes: Buffer): Promise<SaveResult> {
    if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, problem: 'Send a photo under 5 MB.' };
    const kind = photoKind(bytes);
    if (!kind || !LOOKABLE.has(kind.contentType)) {
      return { ok: false, problem: 'Send the photo as a JPEG, PNG or WebP.' };
    }
    const photoId = randomUUID();
    await this.storage.save(this.path(photoId), bytes, kind.contentType);
    return { ok: true, photoId };
  }

  async read(photoId: string): Promise<StoredPhoto | null> {
    const bytes = await this.storage.read(this.path(photoId));
    const kind = bytes && photoKind(bytes);
    return bytes && kind && LOOKABLE.has(kind.contentType)
      ? { bytes, contentType: kind.contentType }
      : null;
  }

  // One name whatever the format: the format is read from the bytes.
  private path(photoId: string): string {
    return `assistant/${photoId}`;
  }
}
