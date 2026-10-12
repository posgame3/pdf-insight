import { useEffect, useState } from 'react';
import type { Step } from '../hooks/useAnalysis';
import type { ExtractionProgress } from '../lib/pdf/extract';

interface ProgressPanelProps {
  fileName: string;
  step: Step;
  progress: ExtractionProgress | null;
  startedAt: number;
  onCancel: () => void;
}

const STEPS: readonly { id: Step; label: string }[] = [
  { id: 'reading', label: 'Odczyt stron, kontrola ukrytego tekstu i skanów' },
  { id: 'analyzing', label: 'Analiza AI i weryfikacja wartości z tekstem dokumentu' },
];

function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(performance.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return Math.max(0, Math.round((now - startedAt) / 1000));
}

export function ProgressPanel({ fileName, step, progress, startedAt, onCancel }: ProgressPanelProps) {
  const elapsed = useElapsedSeconds(startedAt);
  const activeIndex = STEPS.findIndex((item) => item.id === step);
  const status =
    step === 'reading' && progress ? `Strona ${progress.page} z ${progress.total}` : 'Model AI czyta dokument…';

  return (
    <section className="panel progress" aria-labelledby="progress-title" aria-busy="true">
      <h2 id="progress-title" className="panel-title">
        Analizuję <span className="file-name">{fileName}</span>
      </h2>
      <ol className="steps">
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className={index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : undefined}
            aria-current={index === activeIndex ? 'step' : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>
      <p className="progress-status" role="status" aria-live="polite">
        {status}
      </p>
      <p className="progress-time">
        <span aria-hidden="true">⏱ </span>
        {elapsed} s – zwykle do 30 sekund
      </p>
      <button type="button" className="button button-secondary" onClick={onCancel}>
        Anuluj
      </button>
    </section>
  );
}
