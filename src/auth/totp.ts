import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Time-based one-time codes (RFC 6238), as used by Google Authenticator, 1Password and the like.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = 'Talasey';

export function base32Encode(bytes: Buffer): string {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let encoded = '';
  for (let index = 0; index < bits.length; index += 5) {
    encoded += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return encoded;
}

export function base32Decode(text: string): Buffer {
  let bits = '';
  for (const character of text.replace(/[\s=]/g, '').toUpperCase()) {
    const value = ALPHABET.indexOf(character);
    if (value === -1) throw new Error('Not a base32 secret');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export const stepAt = (unixMs: number) => Math.floor(unixMs / 1000 / STEP_SECONDS);

export function totpCode(secret: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hash[hash.length - 1] ?? 0) & 0x0f;
  const value = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 10 ** digits).padStart(digits, '0');
}

// The step the code belongs to, allowing one step either side for a phone clock that is a little
// out, or null if it doesn't match.
export function matchingStep(secret: string, code: string, unixMs: number): number | null {
  const entered = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(entered)) return null;
  const now = stepAt(unixMs);
  for (const step of [now, now - 1, now + 1]) {
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(entered))) return step;
  }
  return null;
}

export const otpauthUri = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${secret}&issuer=${ISSUER}&digits=${DIGITS}&period=${STEP_SECONDS}`;
