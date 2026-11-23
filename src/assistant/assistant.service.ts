import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StoreCatalogueService } from '../catalogue/store-catalogue.service.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';
import {
  ANSWER_MODEL,
  type AnswerModel,
  type ContentBlock,
  type ModelTurn,
  type Usage,
} from './answer-model.js';
import { AssistantLog } from './assistant-log.js';
import { AssistantPhotos, type SaveResult, type StoredPhoto } from './assistant-photos.js';
import { buildPrompt } from './assistant-prompt.js';
import { EnquiriesService } from '../enquiries/enquiries.service.js';
import { AssistantTools, TOOL_DEFINITIONS, type TeamRequest } from './assistant-tools.js';
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
const HAND_OFFS_PER_DAY = 3;
const OFF_KEY = 'assistant:off';
const NO_USAGE: Usage = { input: 0, cached: 0, output: 0 };

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
    private readonly enquiries: EnquiriesService,
    private readonly log: AssistantLog,
  ) {}

  // On when the API key is set and staff haven't switched it off in the admin.
  async isOn(): Promise<boolean> {
    return this.model.enabled && (await this.store.get(OFF_KEY)) !== '1';
  }

  async switchTo(on: boolean): Promise<void> {
    if (on) await this.store.delete(OFF_KEY);
    else await this.store.set(OFF_KEY, '1');
  }

  async adminStatus() {
    return {
      configured: this.model.enabled,
      on: await this.isOn(),
      model: this.config.ASSISTANT_MODEL,
    };
  }

  async reply(request: AssistantRequest, visitor: string): Promise<ChatResult> {
    if (!(await this.isOn())) return { ok: false, reason: 'off' };
    if (!(await this.withinLimits(visitor))) return { ok: false, reason: 'busy' };
    const asked = request.turns.at(-1);
    const usage = { ...NO_USAGE };
    let tools: AssistantTools | null = null;
    let reply = '';
    try {
      const [knowledge, products, photos] = await Promise.all([
        this.knowledge.current(),
        this.catalogue.published(),
        this.photosIn(request),
      ]);
      const prompt = buildPrompt(request, knowledge, photos);
      tools = new AssistantTools(products, (details) =>
        this.passToTeam(details, request, photos, visitor),
      );
      reply = await this.converse(prompt.system, prompt.turns, tools, usage);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
    await this.log
      .record({
        conversationId: request.conversationId ?? randomUUID(),
        page: request.page ?? null,
        question: asked?.text ?? '',
        hadPhoto: Boolean(asked?.photoId),
        reply: reply || null,
        products: tools?.cards.map((card) => card.handle) ?? [],
        gap: tools?.gap ?? null,
        handedOff: tools?.handedOff ?? false,
        failed: !reply,
        inputTokens: usage.input,
        cachedTokens: usage.cached,
        outputTokens: usage.output,
      })
      .catch((error: unknown) => this.logger.warn(`Chat not logged: ${String(error)}`));
    return reply
      ? { ok: true, reply, products: tools?.cards ?? [] }
      : { ok: false, reason: 'failed' };
  }

  async savePhoto(bytes: Buffer, visitor: string): Promise<SaveResult | { ok: false; busy: true }> {
    const sent = await this.store.increment(`assistant:photos:${visitor}`, HOUR);
    if (sent > PHOTOS_PER_HOUR) return { ok: false, busy: true };
    return this.photos.save(bytes);
  }

  // A conversation handed to the team becomes a normal website enquiry, emailed like the others.
  private async passToTeam(
    details: TeamRequest,
    request: AssistantRequest,
    photos: Map<string, StoredPhoto>,
    visitor: string,
  ): Promise<{ ok: boolean; problems?: string[] }> {
    const sent = await this.store.increment(`assistant:handoffs:${visitor}`, DAY);
    if (sent > HAND_OFFS_PER_DAY) {
      return {
        ok: false,
        problems: ['Already sent today. Ask them to call 0330 333 8030 instead.'],
      };
    }
    const result = await this.enquiries.submit(
      {
        kind: 'contact',
        name: details.name,
        email: details.email,
        phone: details.phone,
        postcode: details.postcode,
        topic: 'Website chat',
        message: `${details.message}\n\n(Sent from the website chat${request.page ? ` on ${request.page}` : ''}.)`,
        answers: {},
        consent: false,
      },
      [...photos.values()].map((photo) => photo.bytes),
    );
    return result.ok ? { ok: true } : { ok: false, problems: result.problems };
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
    usage: Usage,
  ): Promise<string> {
    const turns = [...opening];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.model.respond({
        system,
        turns,
        tools: TOOL_DEFINITIONS,
        maxTokens: MAX_REPLY_TOKENS,
      });
      usage.input += response.usage.input;
      usage.cached += response.usage.cached;
      usage.output += response.usage.output;
      if (!response.wantsTools) return textOf(response.content);
      turns.push({ role: 'assistant', content: response.content });
      const results = await Promise.all(response.content.map((block) => this.use(block, tools)));
      turns.push({ role: 'user', content: results.flat() });
    }
    return '';
  }

  private async use(block: ContentBlock, tools: AssistantTools): Promise<ContentBlock[]> {
    if (block.type !== 'tool_use') return [];
    try {
      const result = await tools.run(block.name, block.input);
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
