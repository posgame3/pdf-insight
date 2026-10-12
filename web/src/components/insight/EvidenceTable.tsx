import type { Verification } from '@pdf-insight/shared';
import { VERIFICATION_LABELS } from '../../lib/format';

export interface EvidenceRow {
  key: string;
  value: string;
  context: string;
  page: number;
  quote: string;
  verification: Verification;
}

interface EvidenceTableProps {
  caption: string;
  valueLabel: string;
  rows: readonly EvidenceRow[];
  emptyText: string;
}

export function VerificationBadge({ verification }: { verification: Verification }) {
  const { label, description } = VERIFICATION_LABELS[verification];
  return (
    <span className={`badge badge-${verification}`} title={description}>
      {label}
      <span className="visually-hidden">: {description}</span>
    </span>
  );
}

/** Amounts and dates share one table: value, meaning, and the evidence it was checked against. */
export function EvidenceTable({ caption, valueLabel, rows, emptyText }: EvidenceTableProps) {
  return (
    <section className="card" aria-label={caption}>
      <h3 className="card-title">
        {caption} <span className="count">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <table className="evidence-table">
          <thead>
            <tr>
              <th scope="col">{valueLabel}</th>
              <th scope="col">Znaczenie i źródło</th>
              <th scope="col">Weryfikacja</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td data-label={valueLabel} className="evidence-value">
                  {row.value}
                </td>
                <td data-label="Znaczenie i źródło">
                  <span className="evidence-context">{row.context}</span>
                  <q className="evidence-quote">{row.quote}</q>
                  <span className="evidence-page">str. {row.page}</span>
                </td>
                <td data-label="Weryfikacja">
                  <VerificationBadge verification={row.verification} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
