import { describe, expect, it, vi } from 'vitest';
import { createAnthropicClient } from '../src/model/anthropic';
import { createOpenRouterClient } from '../src/model/openrouter';
import type { CompleteStructured, ModelSettings, StructuredRequest } from '../src/model/types';
import type { Transport } from '../src/model/upstream';

const settings: ModelSettings = { apiKey: 'test-key', model: 'test-model', effort: 'medium' };

const request: StructuredRequest = {
  system: 'system prompt',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'document' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      ],
    },
  ],
  schema: { type: 'object' },
  maxTokens: 1000,
  signal: new AbortController().signal,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function transport(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  const value: Transport = { fetch: fetchMock, sleep: () => Promise.resolve() };
  return { transport: value, fetchMock };
}

function sentBody(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call = 0): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string) as Record<string, unknown>;
}

const anthropicText = (text: string, stopReason = 'end_turn') =>
  json({
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
  });

const openRouterText = (content: string | null, finishReason = 'stop', refusal: string | null = null) =>
  json({ choices: [{ message: { content, refusal }, finish_reason: finishReason }] });

describe('OpenRouter client', () => {
  it('sends an OpenAI-style request with a strict JSON schema, reasoning effort and no data retention', async () => {
    const { transport: t, fetchMock } = transport(openRouterText('{"ok":true}'));
    await createOpenRouterClient(settings, t)(request);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
    expect(sentBody(fetchMock)).toMatchObject({
      model: 'test-model',
      max_tokens: 1000,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: { type: 'object' } } },
      reasoning: { effort: 'medium' },
      provider: { require_parameters: true, data_collection: 'deny' },
      messages: [
        { role: 'system', content: 'system prompt' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'document' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
          ],
        },
      ],
    });
  });

  it('returns the parsed JSON and replays the answer as plain text on a retry', async () => {
    const { transport: t, fetchMock } = transport(openRouterText('{"ok":true}'), openRouterText('{"ok":false}'));
    const complete = createOpenRouterClient(settings, t);
    const first = await complete(request);
    expect(first.json).toEqual({ ok: true });

    await complete({ ...request, messages: [...request.messages, { role: 'assistant', content: first.content }] });
    expect(sentBody(fetchMock, 1).messages).toContainEqual({ role: 'assistant', content: '{"ok":true}' });
  });

  it('returns no JSON when the output was cut off', async () => {
    const { transport: t } = transport(openRouterText('{"ok":', 'length'));
    expect((await createOpenRouterClient(settings, t)(request)).json).toBeUndefined();
  });

  it('treats a refusal as an invalid AI response', async () => {
    const { transport: t } = transport(openRouterText(null, 'stop', 'I cannot help with that.'));
    await expect(createOpenRouterClient(settings, t)(request)).rejects.toMatchObject({ code: 'ai_invalid_response' });
  });

  it('reports exhausted credits (402) as the AI service being unavailable', async () => {
    const { transport: t } = transport(json({ error: { code: 402, message: 'Insufficient credits' } }, 402));
    await expect(createOpenRouterClient(settings, t)(request)).rejects.toMatchObject({ code: 'ai_unavailable' });
  });
});

describe('Anthropic client', () => {
  it('uses structured outputs without forced tool use or sampling parameters', async () => {
    const { transport: t, fetchMock } = transport(anthropicText('{"ok":true}'));
    await createAnthropicClient(settings, t)(request);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const body = sentBody(fetchMock);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(init?.headers).get('x-api-key')).toBe('test-key');
    expect(body).toMatchObject({
      system: 'system prompt',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('temperature');
  });

  it('parses the text block and keeps thinking blocks for a retry', async () => {
    const { transport: t } = transport(anthropicText('{"ok":true}'));
    const response = await createAnthropicClient(settings, t)(request);
    expect(response.json).toEqual({ ok: true });
    expect(response.content.map((block) => block.type)).toEqual(['thinking', 'text']);
  });

  it('returns no JSON when the output hit max_tokens, and rejects refusals', async () => {
    const { transport: t } = transport(
      anthropicText('{"ok":', 'max_tokens'),
      json({ content: [], stop_reason: 'refusal' }),
    );
    const complete = createAnthropicClient(settings, t);
    expect((await complete(request)).json).toBeUndefined();
    await expect(complete(request)).rejects.toMatchObject({ code: 'ai_invalid_response' });
  });
});

describe.each<[string, (t: Transport) => CompleteStructured, () => Response]>([
  ['OpenRouter', (t) => createOpenRouterClient(settings, t), () => openRouterText('{}')],
  ['Anthropic', (t) => createAnthropicClient(settings, t), () => anthropicText('{}')],
])('%s error handling', (_name, create, success) => {
  it('retries once on overload, then succeeds', async () => {
    const { transport: t, fetchMock } = transport(json({ error: { type: 'overloaded_error' } }, 529), success());
    await expect(create(t)(request)).resolves.toMatchObject({ json: {} });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, 'ai_unavailable'],
    [400, 'bad_request'],
    [413, 'payload_too_large'],
    [401, 'internal'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const failure = () => json({ error: { type: 'some_error' } }, status);
    const { transport: t } = transport(failure(), failure());
    await expect(create(t)(request)).rejects.toMatchObject({ code });
  });

  it('reports a network failure as the AI service being unavailable', async () => {
    const t: Transport = {
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('down')),
      sleep: () => Promise.resolve(),
    };
    await expect(create(t)(request)).rejects.toMatchObject({ code: 'ai_unavailable' });
  });
});
