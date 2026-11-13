// Where uploaded photos and files are kept. Local disk for now; an S3 or R2 adapter replaces it
// in production by implementing this and nothing else changes.
export interface FileStorage {
  save(path: string, bytes: Buffer, contentType: string): Promise<void>;
  read(path: string): Promise<Buffer | null>;
}

export const FILE_STORAGE = Symbol('FileStorage');
