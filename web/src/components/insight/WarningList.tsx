import type { Insight, WarningCode } from '@pdf-insight/shared';
import { formatPageList } from '../../lib/format';

const WARNING_TITLES: Record<WarningCode, string> = {
  hidden_text: 'Ukryty tekst',
  prompt_injection: 'Polecenia dla AI w dokumencie',
  scanned_pages: 'Strony zeskanowane',
  unread_pages: 'Nie wszystko przeanalizowano',
  unconfirmed_values: 'Wartości do sprawdzenia',
  amendment: 'Zmiana warunków (aneks)',
  contradiction: 'Sprzeczność w dokumencie',
  illegible: 'Nieczytelny fragment',
  other: 'Uwaga',
};

const SECURITY_CODES: ReadonlySet<WarningCode> = new Set(['hidden_text', 'prompt_injection']);

export function WarningList({ analysis }: { analysis: Insight['analysis'] }) {
  if (analysis.warnings.length === 0) return null;
  return (
    <section className="warnings" aria-labelledby="warnings-title">
      <h3 id="warnings-title" className="card-title">
        Na co zwrócić uwagę <span className="count">{analysis.warnings.length}</span>
      </h3>
      <ul className="warning-list">
        {analysis.warnings.map((warning) => (
          <li
            key={`${warning.code}-${warning.message}`}
            className={`warning${SECURITY_CODES.has(warning.code) ? ' warning-security' : ''}`}
          >
            <strong className="warning-title">{WARNING_TITLES[warning.code]}</strong>
            <span>{warning.message}</span>
            {warning.pages.length > 0 && <span className="warning-pages">{formatPageList(warning.pages)}</span>}
          </li>
        ))}
      </ul>
      {analysis.hiddenText.length > 0 && (
        <details className="hidden-text">
          <summary>Pokaż usunięty ukryty tekst</summary>
          <ul>
            {analysis.hiddenText.map((item) => (
              <li key={item.page}>
                <span className="evidence-page">str. {item.page}</span> <q>{item.excerpt}</q>
                {item.chars > item.excerpt.length && <span className="muted"> (…{item.chars} znaków)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
