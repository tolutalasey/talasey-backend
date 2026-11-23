import type { AppConfig } from '../config/config.schema.js';

export interface ModelTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnswerRequest {
  // Parts of the system prompt in order. Fixed parts come first so they can be cached.
  system: { text: string; cache: boolean }[];
  turns: ModelTurn[];
  maxTokens: number;
}

export interface AnswerModel {
  readonly enabled: boolean;
  answer(request: AnswerRequest): Promise<string>;
}

export const ANSWER_MODEL = Symbol('ANSWER_MODEL');

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 45_000;

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

export class AnthropicAnswerModel implements AnswerModel {
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async answer(request: AnswerRequest): Promise<string> {
    const response = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system.map(({ text, cache }) => ({
          type: 'text',
          text,
          ...(cache ? { cache_control: { type: 'ephemeral' } } : {}),
        })),
        messages: request.turns,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The answer service replied ${response.status}`);
    const body = (await response.json()) as MessagesResponse;
    return (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();
  }
}

export class NoAnswerModel implements AnswerModel {
  readonly enabled = false;

  answer(): Promise<string> {
    return Promise.reject(new Error('The assistant is switched off'));
  }
}

export function answerModelFor(config: AppConfig): AnswerModel {
  return config.ANTHROPIC_API_KEY
    ? new AnthropicAnswerModel(config.ANTHROPIC_API_KEY, config.ASSISTANT_MODEL)
    : new NoAnswerModel();
}
