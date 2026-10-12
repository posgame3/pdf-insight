import { LIMITS } from '@pdf-insight/shared';
import { describe, expect, it } from 'vitest';
import { buildAnalyzeRequest, cleanFileName } from '../src/lib/buildRequest';
import { checkPdfFile, hasPdfSignature } from '../src/lib/fileValidation';
import { insightFileName } from '../src/lib/download';
import type { ExtractedDocument } from '../src/lib/pdf/extract';

const encoder = new TextEncoder();

describe('checkPdfFile', () => {
  it('accepts a file with the PDF signature, also after leading bytes', async () => {
    expect(await checkPdfFile(new File(['%PDF-1.7\n...'], 'a.pdf'))).toEqual({ ok: true });
    expect(hasPdfSignature(encoder.encode('\n\n  %PDF-1.4'))).toBe(true);
  });

  it('rejects a renamed non-PDF file by its content', async () => {
    const result = await checkPdfFile(new File(['<html>not a pdf</html>'], 'invoice.pdf', { type: 'application/pdf' }));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('nie jest plik PDF') });
  });

  it('rejects empty and oversized files', async () => {
    expect(await checkPdfFile(new File([], 'empty.pdf'))).toMatchObject({ ok: false });
    const big = new File([new Uint8Array(LIMITS.maxFileBytes + 1)], 'big.pdf');
    expect(await checkPdfFile(big)).toMatchObject({ ok: false, message: expect.stringContaining('limit') });
  });
});

function extracted(overrides: Partial<ExtractedDocument> = {}): ExtractedDocument {
  return {
    pageCount: 3,
    pages: [
      { page: 1, text: 'Strona pierwsza' },
      { page: 2, text: '' },
      { page: 3, text: 'Strona trzecia' },
    ],
    scans: [],
    report: { scannedPages: [], unreadPages: [], hiddenText: [] },
    ...overrides,
  };
}

describe('buildAnalyzeRequest', () => {
  it('sends only pages with text and keeps the extraction report', () => {
    const request = buildAnalyzeRequest('umowa.pdf', extracted());
    expect(request?.pages.map((page) => page.page)).toEqual([1, 3]);
    expect(request?.extraction).toEqual({ scannedPages: [], unreadPages: [], hiddenText: [] });
  });

  it('stops at the text budget and reports the remaining pages as unread', () => {
    const half = 'x'.repeat(LIMITS.maxTotalChars / 2);
    const request = buildAnalyzeRequest(
      'long.pdf',
      extracted({
        pageCount: 4,
        pages: [1, 2, 3, 4].map((page) => ({ page, text: half })),
      }),
    );
    expect(request?.pages.map((page) => page.page)).toEqual([1, 2]);
    expect(request?.extraction.unreadPages).toEqual([3, 4]);
  });

  it('returns null when there is neither text nor a scan', () => {
    expect(buildAnalyzeRequest('blank.pdf', extracted({ pages: [{ page: 1, text: ' ' }] }))).toBeNull();
  });

  it('analyses a scan-only document', () => {
    const scans = [{ page: 1, mediaType: 'image/jpeg' as const, data: 'AAAA' }];
    expect(buildAnalyzeRequest('scan.pdf', extracted({ pages: [], scans }))?.scans).toEqual(scans);
  });
});

describe('file names', () => {
  it('cleans the uploaded name before it is sent', () => {
    expect(cleanFileName('C:\\fakepath\\umowa\u202E.pdf')).toBe('umowa.pdf');
    expect(cleanFileName('   ')).toBe('dokument.pdf');
  });

  it('derives a safe download name', () => {
    expect(insightFileName('umowa 14/2026 (final).pdf')).toBe('umowa_14_2026_final_.insight.json');
  });
});
