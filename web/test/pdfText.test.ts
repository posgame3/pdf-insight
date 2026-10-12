import { describe, expect, it } from 'vitest';
import { removeRepeatedMargins } from '../src/lib/pdf/repeatedLines';
import { buildLines, type PositionedText } from '../src/lib/pdf/textLayout';

const run = (text: string, x: number, y: number, options: Partial<PositionedText> = {}): PositionedText => ({
  text,
  x,
  y,
  width: text.length * 5,
  fontSize: 10,
  hasEOL: false,
  ...options,
});

describe('buildLines', () => {
  it('splits runs into lines by baseline and end-of-line markers', () => {
    const lines = buildLines([
      run('Umowa ramowa', 50, 800),
      run('nr 14/2026', 116, 800, { hasEOL: true }),
      run('§ 1. Definicje', 50, 780),
    ]);
    expect(lines.map((line) => line.text)).toEqual(['Umowa ramowa nr 14/2026', '§ 1. Definicje']);
  });

  it('does not glue words separated only by position', () => {
    expect(buildLines([run('Kwadrat', 50, 700), run('Software', 95, 700)])[0]?.text).toBe('Kwadrat Software');
  });

  it('keeps adjacent runs of one word together', () => {
    expect(buildLines([run('wdroże', 50, 700), run('nie', 80, 700)])[0]?.text).toBe('wdrożenie');
  });

  it('marks a raised small digit as a footnote reference instead of gluing it to the word', () => {
    const line = buildLines([
      run('po 3 miesiącach', 50, 600),
      run('1', 125, 604, { fontSize: 6, width: 3 }),
      run('od Go-live', 131, 600),
    ]);
    expect(line[0]?.text).toBe('po 3 miesiącach [1] od Go-live');
  });

  it('skips empty runs', () => {
    expect(buildLines([run('', 0, 0, { hasEOL: true })])).toEqual([]);
  });
});

describe('removeRepeatedMargins', () => {
  const page = (number: number, body: string) => ({
    page: number,
    lines: [
      { text: 'Umowa ramowa nr 14/2026 — POUFNE', position: 0.03 },
      { text: body, position: 0.5 },
      { text: `Wersja 1.3 · 12.03.2026 Strona ${number} z 4`, position: 0.97 },
    ],
  });

  it('removes running headers and footers but keeps their first occurrence', () => {
    const result = removeRepeatedMargins([page(1, 'A'), page(2, 'B'), page(3, 'C'), page(4, 'D')]);
    expect(result[0]?.lines).toHaveLength(3);
    expect(result.slice(1).map((item) => item.lines)).toEqual([['B'], ['C'], ['D']]);
  });

  it('keeps body lines even when they repeat', () => {
    const repeatedBody = [1, 2, 3, 4].map((number) => ({
      page: number,
      lines: [{ text: 'Załącznik', position: 0.5 }],
    }));
    expect(removeRepeatedMargins(repeatedBody).every((item) => item.lines.length === 1)).toBe(true);
  });

  it('leaves short documents untouched', () => {
    expect(removeRepeatedMargins([page(1, 'A'), page(2, 'B')]).every((item) => item.lines.length === 3)).toBe(true);
  });
});
