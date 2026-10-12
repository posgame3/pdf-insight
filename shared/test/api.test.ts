import { describe, expect, it } from 'vitest';
import { AnalyzeRequestSchema, type AnalyzeRequest } from '../src/api';
import { LIMITS } from '../src/limits';

const request: AnalyzeRequest = {
  fileName: 'umowa.pdf',
  pageCount: 3,
  pages: [
    { page: 1, text: 'Umowa nr 1/2026' },
    { page: 2, text: '§ 1. Przedmiot umowy' },
  ],
  scans: [{ page: 3, mediaType: 'image/jpeg', data: 'AAAA' }],
  extraction: { scannedPages: [3], unreadPages: [], hiddenText: [] },
};

describe('AnalyzeRequestSchema', () => {
  it('accepts a well-formed request', () => {
    expect(AnalyzeRequestSchema.safeParse(request).success).toBe(true);
  });

  it.each([
    ['a page beyond the page count', { pages: [{ page: 4, text: 'x' }] }],
    ['duplicated pages', { pages: [request.pages[0], request.pages[0]] }],
    ['no content at all', { pages: [{ page: 1, text: '  ' }], scans: [] }],
    ['an unsupported image type', { scans: [{ page: 3, mediaType: 'image/svg+xml', data: 'AAAA' }] }],
    ['malformed base64', { scans: [{ page: 3, mediaType: 'image/jpeg', data: 'AAA' }] }],
    ['too many scans', { scans: Array.from({ length: LIMITS.maxScanImages + 1 }, () => request.scans[0]) }],
    ['a page above the text limit', { pages: [{ page: 1, text: 'x'.repeat(LIMITS.maxPageChars + 1) }] }],
    ['an empty file name', { fileName: '  ' }],
  ])('rejects %s', (_label, override) => {
    expect(AnalyzeRequestSchema.safeParse({ ...request, ...override }).success).toBe(false);
  });

  it('rejects a document whose pages together exceed the total text limit', () => {
    const pageCount = Math.ceil(LIMITS.maxTotalChars / LIMITS.maxPageChars) + 1;
    const pages = Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      text: 'x'.repeat(LIMITS.maxPageChars),
    }));
    expect(AnalyzeRequestSchema.safeParse({ ...request, pageCount, pages, scans: [] }).success).toBe(false);
  });
});
