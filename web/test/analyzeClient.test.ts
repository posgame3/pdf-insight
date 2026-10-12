import type { AnalyzeRequest } from '@pdf-insight/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisError, requestInsight } from '../src/api/analyzeClient';
import { insightFixture } from './fixtures';

const request: AnalyzeRequest = {
  fileName: 'a.pdf',
  pageCount: 1,
  pages: [{ page: 1, text: 'tekst' }],
  scans: [],
  extraction: { scannedPages: [], unreadPages: [], hiddenText: [] },
};

function respond(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestInsight', () => {
  it('posts the request without credentials and returns the validated insight', async () => {
    respond(insightFixture());
    const insight = await requestInsight(request, new AbortController().signal, 'https://api.test');
    expect(insight.document.fileName).toBe('umowa 14/2026.pdf');

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://api.test/analyze');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
  });

  it('rejects a response that does not match the schema', async () => {
    respond({ ...insightFixture(), amounts: [{ value: 'dużo' }] });
    await expect(requestInsight(request, new AbortController().signal, 'https://api.test')).rejects.toMatchObject({
      message: expect.stringContaining('niezgodny ze schematem'),
      retryable: true,
    });
  });

  it.each([
    ['rate_limited', 429, true],
    ['ai_invalid_response', 502, true],
    ['payload_too_large', 413, false],
  ])('maps the API error %s to a Polish message', async (code, status, retryable) => {
    respond({ error: { code, message: 'ignored', requestId: 'r1' } }, status);
    const error = await requestInsight(request, new AbortController().signal, 'https://api.test').catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AnalysisError);
    expect(error).toMatchObject({ retryable });
    expect((error as Error).message).not.toBe('ignored');
  });

  it('reports a network failure as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(requestInsight(request, new AbortController().signal, 'https://api.test')).rejects.toMatchObject({
      message: expect.stringContaining('Brak połączenia'),
      retryable: true,
    });
  });

  it('propagates cancellation by the user unchanged', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );
    controller.abort();
    await expect(requestInsight(request, controller.signal, 'https://api.test')).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
