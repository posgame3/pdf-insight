import { sortedUnique, uniqueBy } from './collections';
import { toMatchKey, type ExtractionReport, type PageText, type Verification, type Warning } from '@pdf-insight/shared';

/** Phrases typical of text that tries to steer an AI system instead of informing a human reader. */
const INJECTION_PATTERNS = [
  /instrukcj\p{L}*\s+dla\s+(?:system\p{L}*\s+)?(?:ai|sztucznej\s+inteligencji|modelu|asystenta)/iu,
  /(?:zignoruj|pomiń)\s+(?:wszystkie\s+|wcześniejsze\s+|poprzednie\s+)*(?:instrukcj|poleceń|polecenia)/iu,
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions/iu,
  /(?:system|developer)\s+prompt/iu,
  /(?:note|message|instruction)s?\s+(?:to|for)\s+(?:the\s+)?(?:ai|llm|assistant|language\s+model)/iu,
];

export function formatPages(pages: readonly number[]): string {
  const ranges: [number, number][] = [];
  for (const page of sortedUnique(pages)) {
    const last = ranges.at(-1);
    if (last && page === last[1] + 1) last[1] = page;
    else ranges.push([page, page]);
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}\u2013${end}`)).join(', ');
}

export function extractionWarnings(report: ExtractionReport): Warning[] {
  const warnings: Warning[] = [];
  if (report.hiddenText.length > 0) {
    const pages = report.hiddenText.map((item) => item.page);
    warnings.push({
      code: 'hidden_text',
      message: `Na stronach ${formatPages(pages)} wykryto tekst niewidoczny dla czytelnika (np. biały na białym lub mikroskopijny). Pominięto go w analizie.`,
      pages,
    });
  }
  if (report.scannedPages.length > 0) {
    warnings.push({
      code: 'scanned_pages',
      message: `Strony ${formatPages(report.scannedPages)} są skanami bez warstwy tekstowej i zostały odczytane z obrazu. Wartości z nich sprawdź w oryginale.`,
      pages: report.scannedPages,
    });
  }
  if (report.unreadPages.length > 0) {
    warnings.push({
      code: 'unread_pages',
      message: `Nie przeanalizowano stron ${formatPages(report.unreadPages)} (przekroczony limit wielkości lub nieczytelny skan). Wynik może być niepełny.`,
      pages: report.unreadPages,
    });
  }
  return warnings;
}

export function injectionWarning(pages: readonly PageText[]): Warning | null {
  const flagged = pages.filter((page) => INJECTION_PATTERNS.some((pattern) => pattern.test(page.text)));
  if (flagged.length === 0) return null;
  const pageNumbers = flagged.map((page) => page.page);
  return {
    code: 'prompt_injection',
    message: `Widoczny tekst na stronach ${formatPages(pageNumbers)} zawiera polecenia skierowane do systemu AI. Potraktowano je jako treść dokumentu, nie jako instrukcje.`,
    pages: pageNumbers,
  };
}

export function unconfirmedWarning(
  items: readonly { verification: Verification; source: { page: number } }[],
): Warning | null {
  const unconfirmed = items.filter((item) => item.verification === 'unconfirmed');
  if (unconfirmed.length === 0) return null;
  return {
    code: 'unconfirmed_values',
    message: `Nie udało się potwierdzić w tekście dokumentu ${unconfirmed.length} z ${items.length} kwot i dat. Są oznaczone i wymagają ręcznego sprawdzenia.`,
    pages: sortedUnique(unconfirmed.map((item) => item.source.page)),
  };
}

export function uniqueWarnings(warnings: readonly Warning[]): Warning[] {
  return uniqueBy(warnings, (warning) => `${warning.code}|${toMatchKey(warning.message)}`);
}
