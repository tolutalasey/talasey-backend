import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('passwords', () => {
  it('checks a password against its hash', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong horse battery', stored)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('refuses a malformed hash', async () => {
    expect(await verifyPassword('anything', 'plain-text')).toBe(false);
  });
});
