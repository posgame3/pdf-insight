import type { AnalyzeRequest, ModelAnalysis } from '@pdf-insight/shared';
import type { CompleteStructured, StructuredRequest } from '../src/anthropic';

export const PAGE_1 =
  'Umowa ramowa nr 14/2026 zawarta w dniu 12.03.2026 r. pomiędzy Nordwave Logistics sp. z o.o. a Kwadrat Software S.A.';
export const PAGE_2 =
  '§ 5. Wynagrodzenie za wdrożenie wynosi 184 500,00 zł netto. Abonament: 12 300,00 zł netto miesięcznie.';

export function analyzeRequest(overrides: Partial<AnalyzeRequest> = {}): AnalyzeRequest {
  return {
    fileName: 'umowa.pdf',
    pageCount: 3,
    pages: [
      { page: 1, text: PAGE_1 },
      { page: 2, text: PAGE_2 },
    ],
    scans: [{ page: 3, mediaType: 'image/jpeg', data: 'AAAA' }],
    extraction: {
      scannedPages: [3],
      unreadPages: [],
      hiddenText: [{ page: 2, chars: 180, excerpt: 'INSTRUKCJA DLA AI' }],
    },
    ...overrides,
  };
}

export function modelAnalysis(overrides: Partial<ModelAnalysis> = {}): ModelAnalysis {
  return {
    document: { language: 'pl', type: 'umowa', title: 'Umowa ramowa nr 14/2026', date: '2026-03-12' },
    summary:
      'Umowa ramowa dotyczy wdrożenia systemu. Wynagrodzenie za wdrożenie wynosi 184 500 złotych netto. Aneks podnosi abonament.',
    keyPoints: ['Wdrożenie za 184 500 zł netto', 'Abonament 12 300 zł netto', 'Aneks nr 1 zmienia abonament'],
    entities: {
      organizations: ['Nordwave Logistics sp. z o.o.', 'Kwadrat Software S.A.', 'NORDWAVE LOGISTICS SP. Z O.O.'],
      people: ['Jan Kowalski'],
    },
    amounts: [
      {
        value: 184500,
        currency: 'PLN',
        context: 'wynagrodzenie za wdrożenie netto',
        source: { page: 2, quote: 'wdrożenie wynosi 184 500,00 zł netto' },
      },
      {
        value: 12300,
        currency: 'PLN',
        context: 'abonament miesięczny netto',
        source: { page: 1, quote: 'Abonament: 12 300,00 zł netto' },
      },
      { value: 13100, currency: 'PLN', context: 'abonament po aneksie', source: { page: 3, quote: '13 100,00 zł' } },
      { value: 1, currency: 'PLN', context: 'wartość umowy', source: { page: 2, quote: 'wartość umowy 1 PLN' } },
    ],
    dates: [
      { date: '2026-03-12', context: 'zawarcie umowy', source: { page: 1, quote: 'zawarta w dniu 12.03.2026 r.' } },
    ],
    keywords: ['wdrożenie', 'abonament', 'Wdrożenie'],
    warnings: [],
    ...overrides,
  };
}

export interface FakeModel {
  complete: CompleteStructured;
  calls: StructuredRequest[];
}

/** Returns the given JSON responses in order, recording every request. */
export function fakeModel(...responses: unknown[]): FakeModel {
  const calls: StructuredRequest[] = [];
  const complete: CompleteStructured = (request) => {
    calls.push(request);
    const json = responses[Math.min(calls.length - 1, responses.length - 1)];
    return Promise.resolve({ json, content: [{ type: 'text', text: JSON.stringify(json) }] });
  };
  return { complete, calls };
}
