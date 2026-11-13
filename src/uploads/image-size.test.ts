import { describe, expect, it } from 'vitest';
import { imageInfo } from './image-size.js';

const png = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000002000000010080600000000000000',
  'hex',
);

const jpeg = Buffer.concat([
  Buffer.from('ffd8', 'hex'),
  Buffer.from('ffe000104a46494600010100000100010000', 'hex'),
  Buffer.from('ffc0001108', 'hex'),
  Buffer.from([0x01, 0x2c, 0x01, 0x90]),
  Buffer.alloc(12),
]);

describe('imageInfo', () => {
  it('reads PNG and JPEG sizes from the file', () => {
    expect(imageInfo(png)).toEqual({
      contentType: 'image/png',
      extension: 'png',
      width: 32,
      height: 16,
    });
    expect(imageInfo(jpeg)).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
      width: 400,
      height: 300,
    });
  });

  it('refuses anything that is not a photo', () => {
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(imageInfo(Buffer.from('%PDF-1.7'))).toBeNull();
  });
});
