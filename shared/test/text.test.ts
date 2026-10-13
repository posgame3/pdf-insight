import { describe, expect, it } from 'vitest';
import { countSentences, normalizeText, toMatchKey } from '../src/text';

describe('normalizeText', () => {
  it('folds ligatures and non-breaking spaces and collapses whitespace', () => {
    expect(normalizeText('  ﬁrma\u00A0\u00A0Nordwave \t sp. z o.o.  ')).toBe('firma Nordwave sp. z o.o.');
  });

  it('removes zero-width and bidi-control characters used to hide words', () => {
    expect(normalizeText('zig\u200Bno\u202Eruj\u2066 polecenia')).toBe('zignoruj polecenia');
  });

  it('keeps single line breaks and limits empty lines to one', () => {
    expect(normalizeText('a \n b\n\n\n\nc')).toBe('a\nb\n\nc');
  });
});

describe('toMatchKey', () => {
  it('ignores whitespace, case, dash and quote variants', () => {
    expect(toMatchKey('Kwota „12 300,00 zł” – NETTO')).toBe(toMatchKey('kwota "12300,00 zł" - netto'));
  });
});

describe('countSentences', () => {
  it.each([
    ['', 0],
    ['Jedno zdanie bez kropki', 1],
    ['Pierwsze zdanie. Drugie zdanie! Trzecie?', 3],
    ['Umowę zawarto 12.03.2026 r. Strony to Nordwave sp. z o.o. i Kwadrat S.A.', 2],
    ['Kara wynosi np. 2% wynagrodzenia, zgodnie z § 5 ust. 7 umowy. Termin to 30 dni.', 2],
    ['Umowę podpisał J. Kowalski. Obowiązuje do końca 2027 r.', 2],
    ['The fee is EUR 2,150 per year, i.e. EUR 8,600 in total. It is paid annually.', 2],
    ['Wartość wynosi 4,2 mln zł. Zysk 1.3 mln.', 2],
    ['Firma obsługuje ok. 3 400 klientów. Abonament do 31 marca 2027 r. 13 100 zł netto jest stały.', 2],
    ['Zmiany, tzn. aneks, obowiązują od kwietnia. Pozostałe warunki bez zmian.', 2],
  ])('%j has %i sentences', (text, expected) => {
    expect(countSentences(text)).toBe(expected);
  });
});
