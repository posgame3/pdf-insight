import { DOCUMENT_TYPE_LABELS, formatDateTime } from '../lib/format';
import type { HistoryEntry } from '../lib/history';

interface HistoryPanelProps {
  entries: readonly HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function HistoryPanel({ entries, onOpen, onClear }: HistoryPanelProps) {
  if (entries.length === 0) return null;
  return (
    <section className="panel history" aria-labelledby="history-title">
      <div className="history-header">
        <h2 id="history-title" className="panel-title">
          Ostatnie analizy
        </h2>
        <button type="button" className="button button-link" onClick={onClear}>
          Wyczyść historię
        </button>
      </div>
      <p className="muted">Zapisane tylko w tej przeglądarce. Sam plik PDF nie jest przechowywany.</p>
      <ul className="history-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="history-item"
              onClick={() => {
                onOpen(entry);
              }}
            >
              <span className="history-name">{entry.insight.document.fileName}</span>
              <span className="history-meta">
                {DOCUMENT_TYPE_LABELS[entry.insight.document.type]} · {formatDateTime(entry.savedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
