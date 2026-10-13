import { toMatchKey, type PageText, type Verification } from '@pdf-insight/shared';

export interface Source {
  page: number;
  quote: string;
}

export interface VerifiedSource {
  source: Source;
  verification: Verification;
}

/**
 * Checks model-provided evidence against the extracted text layer. A value is confirmed only when the quote
 * really contains the value and occurs on a page of the document (the page number is corrected if the model
 * cited the wrong one). A quote occurs either as a contiguous fragment or, for table rows whose cells the text
 * layer orders differently, as a set of tokens that all appear on the same page. Values from scanned pages
 * cannot be checked automatically and say so.
 */
export function createEvidenceVerifier(pages: readonly PageText[], scannedPages: readonly number[]) {
  const pageKeys = new Map(pages.map((page) => [page.page, toMatchKey(page.text)]));
  const scanned = new Set(scannedPages);

  return (source: Source, quoteMentionsValue: (quote: string) => boolean): VerifiedSource => {
    if (scanned.has(source.page)) return { source, verification: 'scan' };
    const fragments = toMatchKey(source.quote)
      .split('...')
      .filter((fragment) => fragment.length >= 3);
    if (fragments.length === 0 || !quoteMentionsValue(source.quote)) return { source, verification: 'unconfirmed' };

    const tokens = source.quote
      .split(/\s+/)
      .map(toMatchKey)
      .filter((token) => token.length >= 2 && token !== '...');
    const occursIn = (pageKey: string) =>
      fragments.every((fragment) => pageKey.includes(fragment)) ||
      (tokens.length > 0 && tokens.every((token) => pageKey.includes(token)));
    if (occursIn(pageKeys.get(source.page) ?? '')) return { source, verification: 'text' };
    for (const [page, pageKey] of pageKeys) {
      if (occursIn(pageKey)) return { source: { ...source, page }, verification: 'text' };
    }
    return { source, verification: 'unconfirmed' };
  };
}

export type EvidenceVerifier = ReturnType<typeof createEvidenceVerifier>;
