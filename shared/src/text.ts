const INVISIBLE_CHARS = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\u034F/g;

/**
 * Canonical form of extracted PDF text: compatibility characters folded (ligatures, NBSP, full-width digits),
 * zero-width and bidi-control characters removed, whitespace collapsed. Removing those characters also
 * defeats prompt-injection tricks that hide words from a human reader.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\p{Cc}/gu, (char) => (char === '\n' ? char : ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Whitespace-, case- and typography-insensitive key used to check that a quote really occurs in a page. */
export function toMatchKey(text: string): string {
  return normalizeText(text)
    .toLocaleLowerCase('pl')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u201C-\u201F\u00AB\u00BB\u2033]/g, '"')
    .replace(/[\u2018-\u201B\u2032]/g, "'")
    .replace(/\s+/g, '');
}

/** Abbreviations that never end a sentence, so a dot after them is not a sentence boundary. */
const NON_TERMINAL_ABBREVIATIONS = new Set([
  'np',
  'tzw',
  'ul',
  'al',
  'nr',
  'ust',
  'pkt',
  'art',
  'par',
  'poz',
  'tj',
  'm.in',
  'godz',
  'dr',
  'prof',
  'inż',
  'mgr',
  'ds',
  'sp',
  'wg',
  'zob',
  'por',
  'tel',
  'św',
  'e.g',
  'i.e',
  'mr',
  'mrs',
  'ms',
  'vs',
]);

const SENTENCE_END = /[.!?\u2026]+["'\u201D\u00BB)]*(?=\s|$)/gu;

/**
 * Counts sentences in Polish or English prose. Dots after abbreviations ("np.", "ust.") and initials ("J.")
 * are not boundaries, and a boundary inside the text needs an upper-case letter or a digit after it.
 */
export function countSentences(text: string): number {
  const prose = normalizeText(text);
  if (prose === '') return 0;
  let count = 0;
  let lastEnd = 0;
  for (const match of prose.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (isSentenceBoundary(prose, match.index, end)) {
      count += 1;
      lastEnd = end;
    }
  }
  return prose.slice(lastEnd).trim() === '' ? count : count + 1;
}

function isSentenceBoundary(text: string, start: number, end: number): boolean {
  const rest = text.slice(end).trimStart();
  if (rest !== '' && !/^["'\u201E\u201C\u00AB(]?[\p{Lu}\d]/u.test(rest)) return false;
  if (text[start] !== '.') return true;
  const word = /([\p{L}.]+)$/u.exec(text.slice(0, start))?.[1] ?? '';
  if (/^\p{Lu}$/u.test(word)) return false;
  return !NON_TERMINAL_ABBREVIATIONS.has(word.toLocaleLowerCase('pl'));
}
