import type { DocumentType, Verification } from '@pdf-insight/shared';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
};

export const VERIFICATION_LABELS: Record<Verification, { label: string; description: string }> = {
  text: { label: 'Potwierdzone', description: 'Cytat i wartość znalezione w tekście PDF' },
  scan: { label: 'Ze skanu', description: 'Odczytane z obrazu skanu – sprawdź w oryginale' },
  unconfirmed: { label: 'Niepotwierdzone', description: 'Nie znaleziono w tekście dokumentu – sprawdź ręcznie' },
};

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency, useGrouping: 'always' }).format(value);
  } catch {
    return `${value.toLocaleString('pl-PL', { useGrouping: 'always' })} ${currency}`;
  }
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatDateTime(isoDateTime: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoDateTime));
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['pl'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatPageList(pages: readonly number[]): string {
  return pages.length === 1 ? `str. ${pages[0]}` : `str. ${pages.join(', ')}`;
}
