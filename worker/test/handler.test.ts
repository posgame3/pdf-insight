import { ApiErrorSchema, InsightSchema, LIMITS } from '@pdf-insight/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/config';
import { handleRequest } from '../src/index';
import { analyzeRequest, fakeModel, modelAnalysis } from './fixtures';

const ORIGIN = 'https://posgame3.github.io';

function env(overrides: Partial<Env> = {}): Env {
  return {
    ANTHROPIC_API_KEY: 'test-key',
    ANTHROPIC_MODEL: 'claude-test',
    ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:5173`,
    ANALYZE_RATE_LIMITER: { limit: () => Promise.resolve({ success: true }) },
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/analyze', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function send(request: Request, environment = env(), model = fakeModel(modelAnalysis())) {
  const response = await handleRequest(request, environment, { createClient: () => model.complete });
  return { response, model };
}

async function errorCode(response: Response): Promise<string> {
  return ApiErrorSchema.parse(await response.json()).error.code;
}

describe('handleRequest', () => {
  it('analyses a valid document for an allowed origin', async () => {
    const { response } = await send(post(analyzeRequest()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(InsightSchema.safeParse(await response.json()).success).toBe(true);
  });

  it('answers CORS preflight only for allowed origins', async () => {
    const preflight = (origin: string) =>
      new Request('https://api.example.com/analyze', { method: 'OPTIONS', headers: { Origin: origin } });
    const allowed = await send(preflight(ORIGIN));
    expect(allowed.response.status).toBe(204);
    expect(allowed.response.headers.get('Access-Control-Allow-Methods')).toContain('POST');

    const denied = await send(preflight('https://evil.example'));
    expect(denied.response.status).toBe(403);
    expect(denied.response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.each([
    ['a foreign origin', post(analyzeRequest(), { Origin: 'https://evil.example' }), 403, 'forbidden_origin'],
    ['a missing origin', new Request('https://api.example.com/analyze', { method: 'POST' }), 403, 'forbidden_origin'],
    ['a wrong content type', post('x', { 'Content-Type': 'text/plain' }), 415, 'unsupported_media_type'],
    ['malformed JSON', post('{"fileName":'), 400, 'bad_request'],
    ['a body failing the schema', post({ ...analyzeRequest(), pageCount: 0 }), 400, 'bad_request'],
    [
      'an oversized declared body',
      post('{}', { 'Content-Length': String(LIMITS.maxRequestBytes + 1) }),
      413,
      'payload_too_large',
    ],
    [
      'an unknown path',
      new Request('https://api.example.com/admin', { headers: { Origin: ORIGIN } }),
      404,
      'not_found',
    ],
    [
      'a GET on /analyze',
      new Request('https://api.example.com/analyze', { headers: { Origin: ORIGIN } }),
      405,
      'method_not_allowed',
    ],
  ])('rejects %s', async (_label, request, status, code) => {
    const { response, model } = await send(request);
    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
    expect(model.calls).toHaveLength(0);
  });

  it('rejects an oversized streamed body even without Content-Length', async () => {
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(LIMITS.maxRequestBytes + 1));
        controller.close();
      },
    });
    const request = new Request('https://api.example.com/analyze', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: oversized,
      duplex: 'half',
    } as RequestInit);
    const { response } = await send(request);
    expect(response.status).toBe(413);
  });

  it('rate-limits per client IP before reading the body', async () => {
    const limit = vi.fn(() => Promise.resolve({ success: false }));
    const { response, model } = await send(
      post(analyzeRequest(), { 'CF-Connecting-IP': '203.0.113.7' }),
      env({ ANALYZE_RATE_LIMITER: { limit } }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(model.calls).toHaveLength(0);
  });

  it('returns a generic 500 without details when the API key is not configured', async () => {
    const { response } = await send(post(analyzeRequest()), env({ ANTHROPIC_API_KEY: '' }));
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain('ANTHROPIC');
  });

  it('maps a timeout to 504', async () => {
    const timeout = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    const response = await handleRequest(post(analyzeRequest()), env(), { createClient: () => timeout });
    expect(response.status).toBe(504);
    expect(await errorCode(response)).toBe('timeout');
  });

  it('never echoes document content in error responses', async () => {
    const secret = 'POUFNE-DANE-KLIENTA';
    const failing = () => Promise.reject(new Error(secret));
    const response = await handleRequest(post(analyzeRequest({ pages: [{ page: 1, text: secret }] })), env(), {
      createClient: () => failing,
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(secret);
  });
});
