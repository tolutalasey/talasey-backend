import { AwsClient } from 'aws4fetch';
import type { FileStorage } from './file-storage.js';

export interface R2Settings {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Photos kept in a private Cloudflare R2 bucket, through its S3-compatible API. They survive
// redeploys and server moves; the API still serves them at /uploads/<name>.
export class R2FileStorage implements FileStorage {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor({ accountId, bucket, accessKeyId, secretAccessKey }: R2Settings) {
    this.client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
    this.base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/`;
  }

  async save(path: string, bytes: Buffer, contentType: string) {
    const response = await this.client.fetch(this.url(path), {
      method: 'PUT',
      body: new Uint8Array(bytes),
      headers: { 'content-type': contentType },
    });
    if (!response.ok) throw new Error(`R2 refused the upload (${response.status})`);
  }

  async read(path: string) {
    const response = await this.client.fetch(this.url(path));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`R2 could not send the file (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  private url(path: string) {
    if (!/^[\w./-]+$/.test(path) || path.includes('..')) throw new Error('Unexpected file path');
    return new URL(path, this.base).toString();
  }
}
