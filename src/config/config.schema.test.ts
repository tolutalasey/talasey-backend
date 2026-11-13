import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.schema.js';

const DATABASE_URL = 'postgres://u:p@localhost:5432/api';

describe('parseConfig', () => {
  it('applies defaults', () => {
    expect(parseConfig({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL,
      WEB_URL: 'http://localhost:3000',
      SESSION_DAYS: 7,
      SLOT_HOLD_MINUTES: 15,
      SLOT_DAYS_AHEAD: 10,
      UPLOAD_DIR: '.data/uploads',
    });
  });

  it('treats empty optional values as not set', () => {
    const config = parseConfig({ DATABASE_URL, REDIS_URL: '', STRIPE_SECRET_KEY: '' });
    expect(config.REDIS_URL).toBeUndefined();
    expect(config.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it('coerces PORT', () => {
    expect(parseConfig({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a hold time that is not a positive whole number of minutes', () => {
    expect(() => parseConfig({ DATABASE_URL, SLOT_HOLD_MINUTES: '0' })).toThrow(
      /SLOT_HOLD_MINUTES/,
    );
  });

  it('names the missing variable', () => {
    expect(() => parseConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres database and a non-Redis cache', () => {
    expect(() => parseConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
    expect(() => parseConfig({ DATABASE_URL, REDIS_URL: 'http://localhost' })).toThrow(/REDIS_URL/);
  });

  it('needs Redis in production', () => {
    expect(() => parseConfig({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/REDIS_URL/);
  });

  it('only takes Stripe secret keys that look like one', () => {
    expect(() => parseConfig({ DATABASE_URL, STRIPE_SECRET_KEY: 'pk_test_x' })).toThrow(
      /STRIPE_SECRET_KEY/,
    );
  });
});
