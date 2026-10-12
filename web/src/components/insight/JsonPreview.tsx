import type { Insight } from '@pdf-insight/shared';
import { useMemo, useState } from 'react';
import { serializeInsight } from '../../lib/download';

export function JsonPreview({ insight }: { insight: Insight }) {
  const json = useMemo(() => serializeInsight(insight), [insight]);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <details className="card json-preview">
      <summary className="card-title">Podgląd JSON</summary>
      <div className="json-toolbar">
        <button type="button" className="button button-secondary" onClick={() => void copy()}>
          Kopiuj JSON
        </button>
        <span role="status" className="muted">
          {copied === 'done' ? 'Skopiowano do schowka.' : copied === 'failed' ? 'Nie udało się skopiować.' : ''}
        </span>
      </div>
      <pre role="region" tabIndex={0} aria-label="Wynik w formacie JSON">
        <code>{json}</code>
      </pre>
    </details>
  );
}
