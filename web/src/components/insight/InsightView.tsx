import type { Insight } from '@pdf-insight/shared';
import { useEffect, useRef } from 'react';
import { downloadInsight } from '../../lib/download';
import { DOCUMENT_TYPE_LABELS, formatAmount, formatDate, languageName } from '../../lib/format';
import { EvidenceTable, type EvidenceRow } from './EvidenceTable';
import { JsonPreview } from './JsonPreview';
import { WarningList } from './WarningList';

interface InsightViewProps {
  insight: Insight;
  durationMs: number | null;
  onReset: () => void;
}

function TagList({ title, items, emptyText }: { title: string; items: readonly string[]; emptyText: string }) {
  return (
    <div className="tag-group">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="tags">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InsightView({ insight, durationMs, onReset }: InsightViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [insight]);
  const { document } = insight;

  const amountRows: EvidenceRow[] = insight.amounts.map((amount, index) => ({
    key: `${index}-${amount.value}`,
    value: formatAmount(amount.value, amount.currency),
    context: amount.context,
    page: amount.source.page,
    quote: amount.source.quote,
    verification: amount.verification,
  }));
  const dateRows: EvidenceRow[] = insight.dates.map((date, index) => ({
    key: `${index}-${date.date}`,
    value: formatDate(date.date),
    context: date.context,
    page: date.source.page,
    quote: date.source.quote,
    verification: date.verification,
  }));

  return (
    <article className="insight" aria-labelledby="insight-title">
      <header className="panel insight-header">
        <p className="eyebrow">
          {DOCUMENT_TYPE_LABELS[document.type]} · {languageName(document.language)}
        </p>
        <h2 id="insight-title" ref={heading} tabIndex={-1}>
          {document.title ?? document.fileName}
        </h2>
        <dl className="meta">
          <div>
            <dt>Plik</dt>
            <dd className="file-name">{document.fileName}</dd>
          </div>
          <div>
            <dt>Stron</dt>
            <dd>{document.pages}</dd>
          </div>
          <div>
            <dt>Data dokumentu</dt>
            <dd>{document.date ? formatDate(document.date) : 'brak'}</dd>
          </div>
          {durationMs !== null && (
            <div>
              <dt>Czas analizy</dt>
              <dd>{(durationMs / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s</dd>
            </div>
          )}
        </dl>
        <div className="actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              downloadInsight(insight);
            }}
          >
            Pobierz JSON
          </button>
          <button type="button" className="button button-secondary" onClick={onReset}>
            Analizuj inny plik
          </button>
        </div>
      </header>

      <WarningList analysis={insight.analysis} />

      <section className="card summary" aria-labelledby="summary-title">
        <h3 id="summary-title" className="card-title">
          Podsumowanie
        </h3>
        <p className="summary-text">{insight.summary}</p>
        <h4>Najważniejsze punkty</h4>
        <ul className="key-points">
          {insight.keyPoints.map((point, index) => (
            <li key={`${index}-${point}`}>{point}</li>
          ))}
        </ul>
      </section>

      <EvidenceTable caption="Kwoty" valueLabel="Kwota" rows={amountRows} emptyText="Dokument nie zawiera kwot." />
      <EvidenceTable caption="Daty" valueLabel="Data" rows={dateRows} emptyText="Dokument nie zawiera dat." />

      <section className="card" aria-labelledby="entities-title">
        <h3 id="entities-title" className="card-title">
          Podmioty i słowa kluczowe
        </h3>
        <div className="tag-groups">
          <TagList title="Organizacje" items={insight.entities.organizations} emptyText="Brak organizacji." />
          <TagList title="Osoby" items={insight.entities.people} emptyText="Brak osób." />
          <TagList title="Słowa kluczowe" items={insight.keywords} emptyText="Brak słów kluczowych." />
        </div>
      </section>

      <JsonPreview insight={insight} />
      <p className="muted model-note">
        Wygenerowano modelem {insight.analysis.model}. AI może się mylić – wartości oznaczone jako niepotwierdzone lub
        odczytane ze skanu sprawdź w dokumencie.
      </p>
    </article>
  );
}
