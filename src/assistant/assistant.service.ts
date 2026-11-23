import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import { ANSWER_MODEL, type AnswerModel } from './answer-model.js';
import { buildPrompt } from './assistant-prompt.js';
import type { AssistantRequest } from './assistant.schemas.js';
import { SiteKnowledgeService } from './site-knowledge.service.js';

const MAX_REPLY_TOKENS = 700;
const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export type ChatResult =
  { ok: true; reply: string } | { ok: false; reason: 'off' | 'busy' | 'failed' };

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(ANSWER_MODEL) private readonly model: AnswerModel,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly knowledge: SiteKnowledgeService,
  ) {}

  get enabled(): boolean {
    return this.model.enabled;
  }

  async reply(request: AssistantRequest, visitor: string): Promise<ChatResult> {
    if (!this.model.enabled) return { ok: false, reason: 'off' };
    if (!(await this.withinLimits(visitor))) return { ok: false, reason: 'busy' };
    const prompt = buildPrompt(request, await this.knowledge.current());
    try {
      const reply = await this.model.answer({ ...prompt, maxTokens: MAX_REPLY_TOKENS });
      return reply ? { ok: true, reply } : { ok: false, reason: 'failed' };
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return { ok: false, reason: 'failed' };
    }
  }

  // A cap per visitor per hour, and one for the whole site per day so the bill can't run away.
  private async withinLimits(visitor: string): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    const [mine, everyone] = await Promise.all([
      this.store.increment(`assistant:visitor:${visitor}`, HOUR),
      this.store.increment(`assistant:day:${day}`, DAY),
    ]);
    return (
      mine <= this.config.ASSISTANT_MESSAGES_PER_HOUR &&
      everyone <= this.config.ASSISTANT_MESSAGES_PER_DAY
    );
  }
}
