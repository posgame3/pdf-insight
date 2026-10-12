import { describe, expect, it } from 'vitest';
import { planChunks } from '../src/chunking';

const page = (number: number, length: number) => ({ page: number, text: 'x'.repeat(length) });

describe('planChunks', () => {
  it('keeps a short document in one chunk, scans included', () => {
    const chunks = planChunks(
      { pages: [page(1, 100), page(2, 100)], scans: [{ page: 3, mediaType: 'image/jpeg', data: 'AAAA' }] },
      { singleCallChars: 10_000, chunkChars: 1_000 },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ firstPage: 1, lastPage: 3 });
    expect(chunks[0]?.scans).toHaveLength(1);
  });

  it('splits a long document into consecutive page ranges without splitting pages', () => {
    const pages = Array.from({ length: 10 }, (_, index) => page(index + 1, 400));
    const chunks = planChunks({ pages, scans: [] }, { singleCallChars: 1_000, chunkChars: 1_000 });
    expect(chunks.map((chunk) => [chunk.firstPage, chunk.lastPage])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, 10],
    ]);
    expect(chunks.flatMap((chunk) => chunk.pages.map((item) => item.page))).toEqual(pages.map((item) => item.page));
  });

  it('gives an oversized single page a chunk of its own', () => {
    const chunks = planChunks(
      { pages: [page(1, 5_000), page(2, 10)], scans: [] },
      { singleCallChars: 1_000, chunkChars: 1_000 },
    );
    expect(chunks.map((chunk) => chunk.pages.length)).toEqual([1, 1]);
  });
});
