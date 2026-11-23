import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';

const FRESH_MS = 10 * 60_000;
const TIMEOUT_MS = 8_000;

export const KNOWLEDGE_FETCH = Symbol('KNOWLEDGE_FETCH');
export type KnowledgeFetch = (url: string) => Promise<string>;

export async function fetchKnowledge(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`The site replied ${response.status}`);
  return response.text();
}

// What the website says about its products, guides and help topics, read from the site itself so
// the assistant always matches what's published.
@Injectable()
export class SiteKnowledgeService {
  private readonly logger = new Logger(SiteKnowledgeService.name);
  private text = '';
  private loadedAt = 0;

  constructor(
    @Inject(KNOWLEDGE_FETCH) private readonly load: KnowledgeFetch,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async current(): Promise<string> {
    if (Date.now() - this.loadedAt < FRESH_MS) return this.text;
    const url =
      this.config.ASSISTANT_KNOWLEDGE_URL ??
      new URL('/assistant-knowledge.txt', this.config.WEB_URL).toString();
    try {
      this.text = await this.load(url);
    } catch (error) {
      this.logger.warn(
        `Keeping the last site knowledge: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.loadedAt = Date.now();
    return this.text;
  }
}
