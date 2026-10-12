import { AnalyzeRequestSchema, InsightSchema, type AnalyzeRequest, type Insight } from '@pdf-insight/shared';
import type { Page, Route } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { MOCK_API_URL } from '../../playwright.config';

export const FIXTURE_PDF = fileURLToPath(new URL('../fixtures/trap-contract.pdf', import.meta.url));
const ANALYZE_URL = `${MOCK_API_URL}/analyze`;

export function insightFor(request: AnalyzeRequest): Insight {
  return InsightSchema.parse({
    document: {
      fileName: request.fileName,
      pages: request.pageCount,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa nr 7/2026',
      date: '2026-02-02',
    },
    summary:
      'Umowa serwisowa łączy Brzozowski Transport z Lumen Analytics. Opłata wdrożeniowa wynosi 48 000 złotych netto. Aneks numer 1 podnosi opłatę serwisową do 9 400 złotych netto.',
    keyPoints: [
      'Opłata wdrożeniowa 48 000 zł netto',
      'Opłata serwisowa 9 400 zł netto od 1 lipca 2026',
      'Umowa do 31 grudnia 2027',
    ],
    entities: {
      organizations: ['Brzozowski Transport sp. z o.o.', 'Lumen Analytics S.A.'],
      people: ['Anna Brzozowska'],
    },
    amounts: [
      {
        value: 48000,
        currency: 'PLN',
        context: 'opłata wdrożeniowa netto',
        source: { page: 1, quote: '48 000,00 zł' },
        verification: 'text',
      },
      {
        value: 9400,
        currency: 'PLN',
        context: 'opłata serwisowa netto od 01.07.2026 (aneks nr 1)',
        source: { page: 3, quote: '9 400,00 zł netto' },
        verification: 'scan',
      },
    ],
    dates: [
      {
        date: '2026-02-02',
        context: 'zawarcie umowy',
        source: { page: 1, quote: '02.02.2026 r.' },
        verification: 'text',
      },
    ],
    keywords: ['serwis', 'kary umowne'],
    analysis: {
      model: 'claude-opus-5-5',
      generatedAt: '2026-10-12T10:00:00.000Z',
      pagesAnalyzed: [1, 2, 3, 4],
      scannedPages: request.extraction.scannedPages,
      unreadPages: request.extraction.unreadPages,
      hiddenText: request.extraction.hiddenText,
      warnings: [{ code: 'hidden_text', message: 'Na stronie 2 wykryto ukryty tekst.', pages: [2] }],
    },
  });
}

/** Captures the request the browser sends and answers like the real API would. */
export async function mockApi(page: Page, failuresBeforeSuccess = 0): Promise<{ requests: AnalyzeRequest[] }> {
  const captured = { requests: [] as AnalyzeRequest[] };
  let failures = failuresBeforeSuccess;
  await page.route(ANALYZE_URL, async (route: Route) => {
    const request = AnalyzeRequestSchema.parse(route.request().postDataJSON());
    captured.requests.push(request);
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (failures > 0) {
      failures -= 1;
      await route.fulfill({
        status: 503,
        headers,
        json: { error: { code: 'ai_unavailable', message: 'x', requestId: 'r' } },
      });
      return;
    }
    await route.fulfill({ status: 200, headers, json: insightFor(request) });
  });
  return captured;
}
