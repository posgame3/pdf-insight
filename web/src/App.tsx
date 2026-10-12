import { HistoryPanel } from './components/HistoryPanel';
import { InsightView } from './components/insight/InsightView';
import { ProgressPanel } from './components/ProgressPanel';
import { StatusPanel } from './components/StatusPanel';
import { UploadPanel } from './components/UploadPanel';
import { useAnalysis } from './hooks/useAnalysis';

const REPOSITORY_URL = 'https://github.com/posgame3/pdf-insight';

export function App() {
  const { state, history, selectFiles, retry, reset, openHistoryEntry, removeHistory } = useAnalysis();

  const newFileButton = (
    <button type="button" className="button button-secondary" onClick={reset}>
      Wybierz inny plik
    </button>
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <header className="app-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" />
            <path d="M10 7h9l5 5v13H10z" />
            <path d="M13 16h8M13 19h8M13 22h5" />
          </svg>
          <h1>PDF Insight</h1>
        </div>
        <p className="tagline">Podsumowanie, kwoty, daty i podmioty z dokumentu PDF – sprawdzone z jego tekstem.</p>
      </header>

      <main id="main" className="app-main">
        {state.status === 'idle' && (
          <>
            <UploadPanel notice={state.notice} onFiles={selectFiles} />
            <HistoryPanel entries={history} onOpen={openHistoryEntry} onClear={removeHistory} />
          </>
        )}
        {state.status === 'working' && (
          <ProgressPanel
            fileName={state.fileName}
            step={state.step}
            progress={state.progress}
            startedAt={state.startedAt}
            onCancel={reset}
          />
        )}
        {state.status === 'error' && (
          <StatusPanel
            tone="error"
            title="Nie udało się przeanalizować dokumentu"
            actions={
              <>
                {state.retryable && (
                  <button type="button" className="button button-primary" onClick={retry}>
                    Spróbuj ponownie
                  </button>
                )}
                {newFileButton}
              </>
            }
          >
            <p>{state.message}</p>
            <p className="muted file-name">{state.fileName}</p>
          </StatusPanel>
        )}
        {state.status === 'empty' && (
          <StatusPanel tone="empty" title="Brak treści do analizy" actions={newFileButton}>
            <p>
              W pliku <span className="file-name">{state.fileName}</span> nie znaleziono widocznego tekstu ani
              zeskanowanych stron. Dokument może być pusty albo zawierać wyłącznie ukryty tekst.
            </p>
          </StatusPanel>
        )}
        {state.status === 'done' && (
          <InsightView insight={state.insight} durationMs={state.durationMs} onReset={reset} />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Zadanie rekrutacyjne Greywolf Group ·{' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            kod źródłowy na GitHubie
          </a>
        </p>
      </footer>
    </div>
  );
}
