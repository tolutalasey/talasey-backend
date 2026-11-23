import type { AppConfig } from '../config/config.schema.js';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ModelTurn {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnswerRequest {
  // Parts of the system prompt in order. Fixed parts come first so they can be cached.
  system: { text: string; cache: boolean }[];
  turns: ModelTurn[];
  tools: ToolDefinition[];
  maxTokens: number;
}

export interface Usage {
  input: number;
  cached: number;
  output: number;
}

export interface ModelResponse {
  content: ContentBlock[];
  wantsTools: boolean;
  usage: Usage;
}

export interface AnswerModel {
  readonly enabled: boolean;
  respond(request: AnswerRequest): Promise<ModelResponse>;
}

export const ANSWER_MODEL = Symbol('ANSWER_MODEL');

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 45_000;

interface MessagesResponse {
  content?: ContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export class AnthropicAnswerModel implements AnswerModel {
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async respond(request: AnswerRequest): Promise<ModelResponse> {
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
        tools: request.tools,
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
    return {
      content: body.content ?? [],
      wantsTools: body.stop_reason === 'tool_use',
      usage: {
        input: (body.usage?.input_tokens ?? 0) + (body.usage?.cache_creation_input_tokens ?? 0),
        cached: body.usage?.cache_read_input_tokens ?? 0,
        output: body.usage?.output_tokens ?? 0,
      },
    };
  }
}

export class NoAnswerModel implements AnswerModel {
  readonly enabled = false;

  respond(): Promise<ModelResponse> {
    return Promise.reject(new Error('The assistant is switched off'));
  }
}

export function answerModelFor(config: AppConfig): AnswerModel {
  return config.ANTHROPIC_API_KEY
    ? new AnthropicAnswerModel(config.ANTHROPIC_API_KEY, config.ASSISTANT_MODEL)
    : new NoAnswerModel();
}
