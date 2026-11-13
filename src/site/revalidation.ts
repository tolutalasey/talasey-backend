import { createHmac } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-talasey-signature';
export const TIMESTAMP_HEADER = 'x-talasey-timestamp';

export function signPayload(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export interface RevalidationTarget {
  siteUrl: string;
  secret: string;
}

export async function requestRevalidation(
  tags: string[],
  { siteUrl, secret }: RevalidationTarget,
  now: () => number = Date.now,
): Promise<void> {
  const body = JSON.stringify({ tags });
  const timestamp = String(now());

  const response = await fetch(new URL('/api/revalidate/', siteUrl), {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: `sha256=${signPayload(body, timestamp, secret)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Site refresh failed with HTTP ${response.status}`);
  }
}

export function revalidationTarget(config: {
  WEB_URL: string;
  REVALIDATE_SECRET?: string;
}): RevalidationTarget | null {
  if (!config.REVALIDATE_SECRET) return null;
  return { siteUrl: config.WEB_URL, secret: config.REVALIDATE_SECRET };
}
