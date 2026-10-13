import { z } from 'zod';
import {
  parseJson,
  textOf,
  type CompleteStructured,
  type InputBlock,
  type ModelMessage,
  type ModelSettings,
} from './types';
import { defaultTransport, postJson, refusal, type Transport } from './upstream';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const APP_URL = 'https://posgame3.github.io/pdf-insight/';

const ResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable(), refusal: z.string().nullable().optional() }),
        finish_reason: z.string().nullable(),
      }),
    )
    .min(1),
});

function toContentPart(block: InputBlock) {
  return block.type === 'text'
    ? { type: 'text', text: block.text }
    : { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } };
}

function toChatMessages(system: string, messages: readonly ModelMessage[]) {
  return [
    { role: 'system', content: system },
    ...messages.map((message) =>
      message.role === 'user'
        ? { role: 'user', content: message.content.map(toContentPart) }
        : { role: 'assistant', content: textOf(message.content) },
    ),
  ];
}

/**
 * OpenRouter (OpenAI-compatible chat API) with strict JSON-schema output. require_parameters routes only to
 * providers that honour the schema and reasoning effort; data_collection: deny excludes providers that may
 * store or train on prompts, since prompts contain the user's document.
 */
export function createOpenRouterClient(
  settings: ModelSettings,
  transport: Transport = defaultTransport,
): CompleteStructured {
  return async (request) => {
    const body = ResponseSchema.parse(
      await postJson(
        transport,
        CHAT_URL,
        { authorization: `Bearer ${settings.apiKey}`, 'HTTP-Referer': APP_URL, 'X-Title': 'PDF Insight' },
        {
          model: settings.model,
          max_tokens: request.maxTokens,
          messages: toChatMessages(request.system, request.messages),
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'pdf_insight', strict: true, schema: request.schema },
          },
          reasoning: { effort: settings.effort },
          provider: { require_parameters: true, data_collection: 'deny' },
        },
        request.signal,
      ),
    );
    const [choice] = body.choices;
    if (!choice || choice.finish_reason === 'refusal' || choice.message.refusal) throw refusal();
    const text = choice.message.content ?? '';
    return {
      json: choice.finish_reason === 'length' ? undefined : parseJson(text),
      content: [{ type: 'text', text }],
    };
  };
}
