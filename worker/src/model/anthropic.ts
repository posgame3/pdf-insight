import { z } from 'zod';
import { parseJson, textOf, type CompleteStructured, type ModelSettings } from './types';
import { defaultTransport, postJson, refusal, type Transport } from './upstream';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const ResponseSchema = z.object({
  content: z.array(z.looseObject({ type: z.string() })),
  stop_reason: z.string().nullable(),
});

/**
 * Anthropic Messages API with structured outputs. Claude Opus 5.5 rejects forced tool_choice and always thinks,
 * so JSON comes from output_config.format and depth is steered by output_config.effort.
 */
export function createAnthropicClient(
  settings: ModelSettings,
  transport: Transport = defaultTransport,
): CompleteStructured {
  return async (request) => {
    const body = ResponseSchema.parse(
      await postJson(
        transport,
        MESSAGES_URL,
        { 'x-api-key': settings.apiKey, 'anthropic-version': API_VERSION },
        {
          model: settings.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages,
          output_config: { effort: settings.effort, format: { type: 'json_schema', schema: request.schema } },
        },
        request.signal,
      ),
    );
    if (body.stop_reason === 'refusal') throw refusal();
    return {
      json: body.stop_reason === 'max_tokens' ? undefined : parseJson(textOf(body.content)),
      content: body.content,
    };
  };
}
