import { LIMITS, normalizeText, type AnalyzeRequest, type PageText } from '@pdf-insight/shared';
import type { ExtractedDocument } from './pdf/extract';

const FALLBACK_FILE_NAME = 'dokument.pdf';

export function cleanFileName(name: string): string {
  const baseName = normalizeText(name.split(/[\\/]/).at(-1) ?? '').replace(/\n/g, ' ');
  return baseName.slice(0, 255) || FALLBACK_FILE_NAME;
}

/**
 * Builds the API request within the size budget. Pages are taken in order until the text budget runs out;
 * the rest is reported as unread, so the result never silently pretends to cover the whole document.
 * Returns null when there is nothing to analyse.
 */
export function buildAnalyzeRequest(fileName: string, document: ExtractedDocument): AnalyzeRequest | null {
  const pages: PageText[] = [];
  const unreadPages = new Set(document.report.unreadPages);
  let budget: number = LIMITS.maxTotalChars;
  for (const page of document.pages) {
    if (page.text.trim() === '') continue;
    if (page.text.length > budget) {
      budget = 0;
      unreadPages.add(page.page);
      continue;
    }
    pages.push(page);
    budget -= page.text.length;
  }
  if (pages.length === 0 && document.scans.length === 0) return null;

  return {
    fileName: cleanFileName(fileName),
    pageCount: document.pageCount,
    pages,
    scans: document.scans,
    extraction: { ...document.report, unreadPages: [...unreadPages].sort((a, b) => a - b) },
  };
}
