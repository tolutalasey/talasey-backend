import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  matchingStep,
  newTotpSecret,
  otpauthUri,
  stepAt,
  totpCode,
} from './totp.js';

// RFC 6238 appendix B, SHA-1, with the shared secret "12345678901234567890".
const rfcSecret = base32Encode(Buffer.from('12345678901234567890'));

describe('one-time codes', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC test vector at %i seconds', (seconds, expected) => {
    expect(totpCode(rfcSecret, stepAt(seconds * 1000), 8)).toBe(expected);
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from('any bytes at all');
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('makes a fresh 32-character secret each time', () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(newTotpSecret()).not.toBe(secret);
  });

  it('accepts the current code and one step either side, and nothing further', () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(matchingStep(rfcSecret, totpCode(rfcSecret, step), now)).toBe(step);
    expect(matchingStep(rfcSecret, totpCode(rfcSecret, step - 1), now)).toBe(step - 1);
    expect(matchingStep(rfcSecret, totpCode(rfcSecret, step + 1), now)).toBe(step + 1);
    expect(matchingStep(rfcSecret, totpCode(rfcSecret, step - 2), now)).toBeNull();
  });

  it('ignores spaces and refuses anything that is not six digits', () => {
    const now = 1_700_000_000_000;
    const code = totpCode(rfcSecret, stepAt(now));
    expect(matchingStep(rfcSecret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).not.toBeNull();
    expect(matchingStep(rfcSecret, '12345', now)).toBeNull();
    expect(matchingStep(rfcSecret, 'abcdef', now)).toBeNull();
  });

  it('builds the link authenticator apps read', () => {
    expect(otpauthUri('ABC', 'ed@talasey.co.uk')).toBe(
      'otpauth://totp/Talasey%3Aed%40talasey.co.uk?secret=ABC&issuer=Talasey&digits=6&period=30',
    );
  });
});
