import { LIMITS } from '@pdf-insight/shared';

const megabytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;

/** User-facing texts produced in the browser. Errors returned by the API are in @pdf-insight/shared. */
export const MESSAGES = {
  emptyFile: 'Plik jest pusty.',
  fileTooLarge: (size: number) => `Plik ma ${megabytes(size)}, a limit to ${megabytes(LIMITS.maxFileBytes)}.`,
  notPdf: 'To nie jest plik PDF. Wybierz dokument w formacie PDF.',
  multipleFiles: 'Wybierz jeden plik naraz.',
  passwordProtected: 'Plik jest zabezpieczony hasłem. Usuń zabezpieczenie i spróbuj ponownie.',
  unreadablePdf: 'Nie udało się odczytać pliku. Może być uszkodzony.',
  network: 'Brak połączenia z usługą analizy. Sprawdź internet i spróbuj ponownie.',
  timeout: 'Analiza trwała zbyt długo. Spróbuj ponownie lub wybierz krótszy dokument.',
  invalidResult: 'Serwer zwrócił wynik niezgodny ze schematem. Spróbuj ponownie.',
  unexpected: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
} as const;
