import { describe, expect, it } from 'vitest';
import { can, permissionsOf } from './roles.js';

describe('roles', () => {
  it('lets the owner do everything', () => {
    expect(permissionsOf('owner')).toContain('users');
    expect(can('owner', 'content.publish')).toBe(true);
  });

  it('lets editors publish but not contributors', () => {
    expect(can('editor', 'content.publish')).toBe(true);
    expect(can('contributor', 'content.edit')).toBe(true);
    expect(can('contributor', 'content.publish')).toBe(false);
  });

  it('keeps content staff out of the catalogue and catalogue staff out of content', () => {
    expect(can('editor', 'catalogue')).toBe(false);
    expect(can('catalogue', 'content.edit')).toBe(false);
    expect(can('catalogue', 'orders')).toBe(true);
  });

  it('keeps staff accounts with the owner', () => {
    expect(can('catalogue', 'users')).toBe(false);
    expect(can('editor', 'users')).toBe(false);
  });
});
