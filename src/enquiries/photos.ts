// The kinds of photo phones and cameras send, recognised from the file's first bytes rather than
// trusting its name or the browser's word.
export interface PhotoKind {
  extension: string;
  contentType: string;
}

const ascii = (bytes: Buffer, start: number, end: number) =>
  bytes.subarray(start, end).toString('latin1');

export function photoKind(bytes: Buffer): PhotoKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (ascii(bytes, 1, 4) === 'PNG') return { extension: 'png', contentType: 'image/png' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  if (ascii(bytes, 4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(bytes, 8, 12))) {
    return { extension: 'heic', contentType: 'image/heic' };
  }
  return null;
}
