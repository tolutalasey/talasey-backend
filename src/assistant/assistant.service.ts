import { Inject, Injectable, Logger } from '@nestjs/common';
import { StoreCatalogueService } from '../catalogue/store-catalogue.service.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import {
  ANSWER_MODEL,
  type AnswerModel,
  type ContentBlock,
  type ModelTurn,
} from './answer-model.js';
import { AssistantPhotos, type SaveResult, type StoredPhoto } from './assistant-photos.js';
import { buildPrompt } from './assistant-prompt.js';
import { AssistantTools, TOOL_DEFINITIONS } from './assistant-tools.js';
import {
  MAX_PHOTOS_SENT,
  type AssistantReply,
  type AssistantRequest,
} from './assistant.schemas.js';
import { SiteKnowledgeService } from './site-knowledge.service.js';

const MAX_REPLY_TOKENS = 1000;
const MAX_TOOL_ROUNDS = 6;
const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const PHOTOS_PER_HOUR = 10;

export type ChatResult =
  ({ ok: true } & AssistantReply) | { ok: false; reason: 'off' | 'busy' | 'failed' };

const textOf = (content: ContentBlock[]) =>
  content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(ANSWER_MODEL) private readonly model: AnswerModel,
    @Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly knowledge: SiteKnowledgeService,
    private readonly catalogue: StoreCatalogueService,
    private readonly photos: AssistantPhotos,
  ) {}

  get enabled(): boolean {
    return this.model.enabled;
  }

  async reply(request: AssistantRequest, visitor: string): Promise<ChatResult> {
    if (!this.model.enabled) return { ok: false, reason: 'off' };
    if (!(await this.withinLimits(visitor))) return { ok: false, reason: 'busy' };
    try {
      const [knowledge, products, photos] = await Promise.all([
        this.knowledge.current(),
        this.catalogue.published(),
        this.photosIn(request),
      ]);
      const prompt = buildPrompt(request, knowledge, photos);
      const tools = new AssistantTools(products);
      const reply = await this.converse(prompt.system, prompt.turns, tools);
      return reply ? { ok: true, reply, products: tools.cards } : { ok: false, reason: 'failed' };
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return { ok: false, reason: 'failed' };
    }
  }

  async savePhoto(bytes: Buffer, visitor: string): Promise<SaveResult | { ok: false; busy: true }> {
    const sent = await this.store.increment(`assistant:photos:${visitor}`, HOUR);
    if (sent > PHOTOS_PER_HOUR) return { ok: false, busy: true };
    return this.photos.save(bytes);
  }

  private async photosIn(request: AssistantRequest): Promise<Map<string, StoredPhoto>> {
    const ids = request.turns
      .flatMap((turn) => (turn.photoId ? [turn.photoId] : []))
      .slice(-MAX_PHOTOS_SENT);
    const found = await Promise.all(
      ids.map(async (id) => [id, await this.photos.read(id)] as const),
    );
    return new Map(found.flatMap(([id, photo]) => (photo ? [[id, photo] as const] : [])));
  }

  // Lets the model look things up as many times as it needs, then returns its final words.
  private async converse(
    system: { text: string; cache: boolean }[],
    opening: ModelTurn[],
    tools: AssistantTools,
  ): Promise<string> {
    const turns = [...opening];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.model.respond({
        system,
        turns,
        tools: TOOL_DEFINITIONS,
        maxTokens: MAX_REPLY_TOKENS,
      });
      if (!response.wantsTools) return textOf(response.content);
      turns.push({ role: 'assistant', content: response.content });
      turns.push({
        role: 'user',
        content: response.content.flatMap((block) => this.use(block, tools)),
      });
    }
    return '';
  }

  private use(block: ContentBlock, tools: AssistantTools): ContentBlock[] {
    if (block.type !== 'tool_use') return [];
    try {
      const result = tools.run(block.name, block.input);
      return [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) }];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That did not work';
      return [{ type: 'tool_result', tool_use_id: block.id, content: message, is_error: true }];
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
