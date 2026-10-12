import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InsightSchema, ModelAnalysisSchema, type Insight, type ModelAnalysis } from '../src/schema';

const modelAnalysis: ModelAnalysis = {
  document: { language: 'pl', type: 'umowa', title: 'Umowa serwisowa', date: '2026-09-01' },
  summary:
    'Umowa dotyczy serwisu systemu. Wykonawca zapewnia wsparcie przez 24 miesiące. Wynagrodzenie płatne jest miesięcznie.',
  keyPoints: ['Wsparcie 24/7', 'Kara umowna 2%', 'Wypowiedzenie 3 miesiące'],
  entities: { organizations: ['Nordwave Logistics sp. z o.o.'], people: ['Jan Kowalski'] },
  amounts: [
    {
      value: 12500,
      currency: 'PLN',
      context: 'wynagrodzenie miesięczne netto',
      source: { page: 2, quote: '12 500,00 zł netto miesięcznie' },
    },
  ],
  dates: [{ date: '2026-10-01', context: 'termin płatności', source: { page: 2, quote: 'do dnia 01.10.2026' } }],
  keywords: ['serwis', 'SLA'],
  warnings: [],
};

const insight: Insight = {
  document: { fileName: 'umowa.pdf', pages: 4, ...modelAnalysis.document },
  summary: modelAnalysis.summary,
  keyPoints: modelAnalysis.keyPoints,
  entities: modelAnalysis.entities,
  amounts: modelAnalysis.amounts.map((amount) => ({ ...amount, verification: 'text' })),
  dates: modelAnalysis.dates.map((date) => ({ ...date, verification: 'text' })),
  keywords: modelAnalysis.keywords,
  analysis: {
    model: 'claude-opus-5-5',
    generatedAt: '2026-10-12T10:00:00.000Z',
    pagesAnalyzed: [1, 2, 3, 4],
    scannedPages: [],
    unreadPages: [],
    hiddenText: [],
    warnings: [],
  },
};

function issuePaths(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('ModelAnalysisSchema', () => {
  it('accepts the shape from the brief', () => {
    expect(ModelAnalysisSchema.parse(modelAnalysis)).toEqual(modelAnalysis);
  });

  it.each([
    ['document.date', { document: { ...modelAnalysis.document, date: '2026-02-30' } }],
    ['document.date', { document: { ...modelAnalysis.document, date: '01.09.2026' } }],
    ['document.type', { document: { ...modelAnalysis.document, type: 'list' } }],
    ['document.language', { document: { ...modelAnalysis.document, language: 'polski' } }],
    ['amounts.0.currency', { amounts: [{ ...modelAnalysis.amounts[0], currency: 'zł' }] }],
    ['amounts.0.value', { amounts: [{ ...modelAnalysis.amounts[0], value: '12 500,00' }] }],
    ['summary', { summary: 'Za krótkie podsumowanie.' }],
    ['summary', { summary: 'Raz. Dwa. Trzy. Cztery. Pięć. Sześć.' }],
    ['keyPoints', { keyPoints: ['tylko', 'dwa'] }],
    ['keyPoints', { keyPoints: ['1', '2', '3', '4', '5', '6', '7', '8'] }],
  ])('rejects an invalid %s', (path, override) => {
    const result = ModelAnalysisSchema.safeParse({ ...modelAnalysis, ...override });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(path);
  });

  it('accepts null for missing document metadata and empty lists', () => {
    const sparse = {
      ...modelAnalysis,
      document: { ...modelAnalysis.document, title: null, date: null },
      amounts: [],
      dates: [],
      entities: { organizations: [], people: [] },
    };
    expect(ModelAnalysisSchema.safeParse(sparse).success).toBe(true);
  });
});

describe('InsightSchema', () => {
  it('accepts a complete result', () => {
    expect(InsightSchema.parse(insight)).toEqual(insight);
  });

  it('is a superset of the brief schema: every brief field is required', () => {
    const { amounts: _amounts, ...withoutAmounts } = insight;
    expect(InsightSchema.safeParse(withoutAmounts).success).toBe(false);
    const { fileName: _fileName, ...documentWithoutFileName } = insight.document;
    expect(InsightSchema.safeParse({ ...insight, document: documentWithoutFileName }).success).toBe(false);
  });

  it('publishes an up-to-date JSON Schema for API consumers', async () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(InsightSchema, { io: 'output', unrepresentable: 'any' }), null, 2);
    await expect(`${jsonSchema}\n`).toMatchFileSnapshot('../insight.schema.json');
  });
});
