export interface PageLines {
  page: number;
  lines: readonly { text: string; /** 0 = top edge, 1 = bottom edge */ position: number }[];
}

const MARGIN = 0.1;
const MIN_REPEATS = 3;

function lineKey(text: string): string {
  return text.toLocaleLowerCase('pl').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

const inMargin = (position: number) => position < MARGIN || position > 1 - MARGIN;

/**
 * Removes running headers and footers: lines in the top or bottom margin that repeat (ignoring digits, so
 * "Strona 3 z 12" matches "Strona 4 z 12") on at least half of the pages. The first occurrence is kept,
 * because it can carry information such as the document title.
 */
export function removeRepeatedMargins(pages: readonly PageLines[]): { page: number; lines: string[] }[] {
  const pagesWithText = pages.filter((page) => page.lines.length > 0).length;
  const threshold = Math.max(MIN_REPEATS, Math.ceil(pagesWithText / 2));
  const pagesByKey = new Map<string, number[]>();
  for (const page of pages) {
    const keys = new Set(page.lines.filter((line) => inMargin(line.position)).map((line) => lineKey(line.text)));
    for (const key of keys) pagesByKey.set(key, [...(pagesByKey.get(key) ?? []), page.page]);
  }

  return pages.map((page) => ({
    page: page.page,
    lines: page.lines
      .filter((line) => {
        if (!inMargin(line.position)) return true;
        const seenOn = pagesByKey.get(lineKey(line.text)) ?? [];
        return seenOn.length < threshold || seenOn[0] === page.page;
      })
      .map((line) => line.text),
  }));
}
