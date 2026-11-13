import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRevalidation, revalidationTarget, signPayload } from './revalidation.js';

const secret = 'a-test-secret-that-is-long-enough-123';

describe('signPayload', () => {
  it('matches the test vector shared with the site', () => {
    expect(signPayload('{"tags":["product:pavetuf"]}', '1700000000000', secret)).toBe(
      '2d0a34700befed43cb772576505cf2994b2ad80496d1303aa43a5554c9c18473',
    );
  });
});

describe('requestRevalidation', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('posts the tags signed with the shared secret', async () => {
    await requestRevalidation(
      ['product:pavetuf'],
      { siteUrl: 'https://shop.test', secret },
      () => 1_700_000_000_000,
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string>;
    expect(String(url)).toBe('https://shop.test/api/revalidate/');
    expect(init?.body).toBe('{"tags":["product:pavetuf"]}');
    expect(headers['x-talasey-timestamp']).toBe('1700000000000');
    expect(headers['x-talasey-signature']).toBe(
      'sha256=2d0a34700befed43cb772576505cf2994b2ad80496d1303aa43a5554c9c18473',
    );
  });

  it('throws when the site rejects it', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(
      requestRevalidation(['products'], { siteUrl: 'https://shop.test', secret }),
    ).rejects.toThrow('HTTP 401');
  });
});

describe('revalidationTarget', () => {
  it('needs the shared secret', () => {
    expect(revalidationTarget({ WEB_URL: 'https://shop.test' })).toBeNull();
    expect(revalidationTarget({ WEB_URL: 'https://shop.test', REVALIDATE_SECRET: secret })).toEqual(
      { siteUrl: 'https://shop.test', secret },
    );
  });
});
