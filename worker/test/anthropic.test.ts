import { describe, expect, it, vi } from 'vitest';
import { createAnthropicClient, type StructuredRequest } from '../src/anthropic';

const request: StructuredRequest = {
  system: 'system prompt',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'document' }] }],
  schema: { type: 'object' },
  maxTokens: 1000,
  signal: new AbortController().signal,
};

function apiResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const success = (text: string, stopReason = 'end_turn') =>
  apiResponse({
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
  });

function client(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  const complete = createAnthropicClient({
    apiKey: 'test-key',
    model: 'claude-opus-5-5',
    effort: 'medium',
    fetch: fetchMock,
    sleep: () => Promise.resolve(),
  });
  return { complete, fetchMock };
}

describe('createAnthropicClient', () => {
  it('sends a structured-output request without forced tool use or sampling parameters', async () => {
    const { complete, fetchMock } = client(success('{"ok":true}'));
    await complete(request);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(init?.headers).get('x-api-key')).toBe('test-key');
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('temperature');
  });

  it('parses the text block and keeps all blocks for a possible retry', async () => {
    const { complete } = client(success('{"ok":true}'));
    const response = await complete(request);
    expect(response.json).toEqual({ ok: true });
    expect(response.content.map((block) => block.type)).toEqual(['thinking', 'text']);
  });

  it('returns no JSON when the output was cut off by max_tokens', async () => {
    const { complete } = client(success('{"ok":', 'max_tokens'));
    expect((await complete(request)).json).toBeUndefined();
  });

  it('retries once on overload, then succeeds', async () => {
    const { complete, fetchMock } = client(apiResponse({ error: { type: 'overloaded_error' } }, 529), success('{}'));
    await expect(complete(request)).resolves.toMatchObject({ json: {} });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, 'ai_unavailable'],
    [400, 'bad_request'],
    [413, 'payload_too_large'],
    [401, 'internal'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const error = apiResponse({ error: { type: 'some_error' } }, status);
    const { complete } = client(error, apiResponse({ error: { type: 'some_error' } }, status));
    await expect(complete(request)).rejects.toMatchObject({ code });
  });

  it('treats a safety refusal as an invalid AI response', async () => {
    const { complete } = client(apiResponse({ content: [], stop_reason: 'refusal' }));
    await expect(complete(request)).rejects.toMatchObject({ code: 'ai_invalid_response' });
  });

  it('reports a network failure as the AI service being unavailable', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network down'));
    const complete = createAnthropicClient({ apiKey: 'k', model: 'm', effort: 'low', fetch: fetchMock });
    await expect(complete(request)).rejects.toMatchObject({ code: 'ai_unavailable' });
  });
});
