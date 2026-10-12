import { z } from 'zod';
import { AppError } from './errors';
import { logEvent } from './log';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_RETRY_DELAY_MS = 4_000;

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

export type InputBlock =
  { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/** Blocks returned by the API (text, thinking, ...) are passed back verbatim on a retry, as the API requires. */
export type OutputBlock = { type: string } & Record<string, unknown>;

export type ModelMessage = { role: 'user'; content: InputBlock[] } | { role: 'assistant'; content: OutputBlock[] };

export interface StructuredRequest {
  system: string;
  messages: ModelMessage[];
  schema: Record<string, unknown>;
  maxTokens: number;
  signal: AbortSignal;
}

export interface StructuredResponse {
  /** Parsed JSON, or undefined when the output was cut off or is not JSON. */
  json: unknown;
  content: OutputBlock[];
}

export type CompleteStructured = (request: StructuredRequest) => Promise<StructuredResponse>;

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  effort: Effort;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const ResponseSchema = z.object({
  content: z.array(z.looseObject({ type: z.string() })),
  stop_reason: z.string().nullable(),
});

const ErrorBodySchema = z.object({ error: z.object({ type: z.string() }) });

export function createAnthropicClient(config: AnthropicConfig): CompleteStructured {
  const fetchImpl = config.fetch ?? fetch;
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function send(request: StructuredRequest): Promise<Response> {
    try {
      return await fetchImpl(MESSAGES_URL, {
        method: 'POST',
        signal: request.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages,
          output_config: { effort: config.effort, format: { type: 'json_schema', schema: request.schema } },
        }),
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
      throw new AppError('ai_unavailable', { cause: error });
    }
  }

  return async (request) => {
    let response = await send(request);
    if (RETRYABLE_STATUSES.has(response.status)) {
      await sleep(retryDelayMs(response));
      response = await send(request);
    }
    if (!response.ok) throw await toUpstreamError(response);

    const body = ResponseSchema.parse(await response.json());
    if (body.stop_reason === 'refusal') {
      logEvent('model_refusal', {});
      throw new AppError('ai_invalid_response');
    }
    const text = body.content
      .filter((block) => block.type === 'text')
      .map((block) => (typeof block.text === 'string' ? block.text : ''))
      .join('');
    return { json: body.stop_reason === 'max_tokens' ? undefined : parseJson(text), content: body.content };
  };
}

function retryDelayMs(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_DELAY_MS) : 1_000;
}

async function toUpstreamError(response: Response): Promise<AppError> {
  const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));
  logEvent('upstream_error', { status: response.status, type: parsed.success ? parsed.data.error.type : 'unknown' });
  if (response.status === 413) return new AppError('payload_too_large');
  if (response.status === 400) return new AppError('bad_request');
  if (RETRYABLE_STATUSES.has(response.status)) return new AppError('ai_unavailable');
  return new AppError('internal');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
