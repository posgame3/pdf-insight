import { LIMITS } from '@pdf-insight/shared';
import { useId, useState, type DragEvent } from 'react';

interface UploadPanelProps {
  notice: string | null;
  onFiles: (files: FileList | null) => void;
}

export function UploadPanel({ notice, onFiles }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const noticeId = useId();

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    onFiles(event.dataTransfer.files);
  };

  return (
    <section className="panel upload" aria-labelledby="upload-title">
      <h2 id="upload-title" className="panel-title">
        Przeanalizuj dokument
      </h2>
      <label
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          aria-describedby={notice ? `${hintId} ${noticeId}` : hintId}
          onChange={(event) => {
            onFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
        <svg className="dropzone-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M14 6h14l10 10v26H14z" />
          <path d="M28 6v10h10M24 34V22m-5 5 5-5 5 5" />
        </svg>
        <span className="dropzone-title">Przeciągnij plik PDF tutaj</span>
        <span className="dropzone-action">albo wybierz z dysku</span>
        <span id={hintId} className="dropzone-hint">
          Jeden plik PDF, maksymalnie {LIMITS.maxFileBytes / 1024 / 1024} MB
        </span>
      </label>
      {notice && (
        <p id={noticeId} className="notice notice-error" role="alert">
          {notice}
        </p>
      )}
      <aside className="privacy" aria-label="Przetwarzanie danych">
        <h3>Co dzieje się z plikiem?</h3>
        <ul>
          <li>Plik jest czytany w Twojej przeglądarce i nigdzie nie jest zapisywany.</li>
          <li>
            Do analizy wysyłamy jego tekst oraz obrazy zeskanowanych stron: przez nasz serwer pośredniczący i bramkę
            OpenRouter do modelu Claude firmy Anthropic (USA), z wyłączonym przechowywaniem danych przez dostawców.
          </li>
          <li>Nie wgrywaj dokumentów z danymi osobowymi lub poufnymi, jeśli nie możesz ich przekazać dostawcy AI.</li>
        </ul>
      </aside>
    </section>
  );
}
