import { LIMITS, type AnalyzeRequest, type PageText, type Scan } from '@pdf-insight/shared';

export interface Chunk {
  pages: PageText[];
  scans: Scan[];
  firstPage: number;
  lastPage: number;
}

/** A scanned page costs roughly as much model context as a dense page of text. */
const SCAN_WEIGHT_CHARS = 4_000;

interface Budget {
  singleCallChars: number;
  chunkChars: number;
}

/**
 * Splits a long document into consecutive page ranges for map-reduce analysis. Pages are never split,
 * so every quote stays attributable to one page; a short document stays one chunk.
 */
export function planChunks(
  request: Pick<AnalyzeRequest, 'pages' | 'scans'>,
  budget: Budget = { singleCallChars: LIMITS.singleCallChars, chunkChars: LIMITS.chunkChars },
): Chunk[] {
  const items = [
    ...request.pages.map((page) => ({ page: page.page, weight: page.text.length, text: page, scan: undefined })),
    ...request.scans.map((scan) => ({ page: scan.page, weight: SCAN_WEIGHT_CHARS, text: undefined, scan })),
  ].sort((a, b) => a.page - b.page);
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const limit = total <= budget.singleCallChars ? Number.POSITIVE_INFINITY : budget.chunkChars;

  const chunks: Chunk[] = [];
  let current: Chunk | undefined;
  let currentWeight = 0;
  for (const item of items) {
    if (!current || (currentWeight + item.weight > limit && currentWeight > 0)) {
      current = { pages: [], scans: [], firstPage: item.page, lastPage: item.page };
      chunks.push(current);
      currentWeight = 0;
    }
    if (item.text) current.pages.push(item.text);
    if (item.scan) current.scans.push(item.scan);
    current.lastPage = item.page;
    currentWeight += item.weight;
  }
  return chunks;
}
