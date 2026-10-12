# Brief i mapowanie wymagań

Streszczenie briefu „PDF Insight” (Greywolf Group, zadanie rekrutacyjne Vibe Coder) i miejsce, w którym każde
wymaganie jest spełnione oraz sprawdzone. Pełny brief jest u rekrutera; tu tylko to, co potrzebne do pracy.

## Wymagania funkcjonalne

| ID   | Priorytet | Wymaganie                                         | Realizacja                                                                       | Dowód                                                               |
| ---- | --------- | ------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F-01 | MUST      | Drag & drop i wybór pliku, tylko PDF, maks. 10 MB | `UploadPanel.tsx`, `lib/fileValidation.ts` (sygnatura `%PDF-`, nie rozszerzenie) | `requestPipeline.test.ts`, e2e „rejects a file that only pretends…” |
| F-02 | MUST      | Ekstrakcja tekstu                                 | `lib/pdf/extract.ts` (pdf.js, w przeglądarce)                                    | e2e „extracts only visible text…”                                   |
| F-03 | MUST      | Podsumowanie przez AI                             | `worker/src/analyze.ts`, `worker/src/prompt.ts`                                  | `analyze.test.ts`                                                   |
| F-04 | MUST      | Walidacja wyniku schematem przed wyświetleniem    | Zod w Workerze (+1 retry) i ponownie w przeglądarce (`api/analyzeClient.ts`)     | `analyze.test.ts`, `analyzeClient.test.ts`                          |
| F-05 | MUST      | Widok wyniku, podgląd JSON, pobranie `.json`      | `InsightView.tsx`, `JsonPreview.tsx`, `lib/download.ts`                          | e2e „downloads schema-valid JSON”                                   |
| F-06 | MUST      | Stany: ładowanie, błąd z ponowieniem, pusty       | `useAnalysis.ts`, `ProgressPanel.tsx`, `StatusPanel.tsx`                         | e2e „recovers from an API error…”, `App.test.tsx`                   |
| F-07 | MUST      | Publiczny adres na GitHub Pages                   | job `deploy` w `.github/workflows/ci.yml`                                        | https://posgame3.github.io/pdf-insight/                             |
| F-08 | SHOULD    | Dzielenie długich dokumentów i scalanie           | `worker/src/chunking.ts` + wywołanie „overview”                                  | `chunking.test.ts`, `analyze.test.ts`                               |
| F-09 | SHOULD    | Lokalna historia                                  | `lib/history.ts`, `HistoryPanel.tsx` (localStorage, walidowane przy odczycie)    | `history.test.ts`, `App.test.tsx`                                   |
| F-10 | COULD     | OCR                                               | Strony-skany renderowane do JPEG i czytane przez model (vision)                  | e2e: strona 3 fixture wysyłana jako obraz                           |

## Schemat wyniku

Brief definiuje pola `document`, `summary`, `keyPoints`, `entities`, `amounts`, `dates`, `keywords` i pozwala
dodawać pola. Dodane (żadne nie zostało usunięte ani zmienione):

- `amounts[].source`, `dates[].source` – strona i dosłowny cytat, z którego pochodzi wartość;
- `amounts[].verification`, `dates[].verification` – `text` / `scan` / `unconfirmed` (wynik sprawdzenia cytatu);
- `analysis` – model, czas, przeanalizowane strony, skany, strony nieprzeczytane, usunięty ukryty tekst, ostrzeżenia.

Reguły z briefu egzekwowane w `shared/src/schema.ts`: `type` z listy, `language` ISO 639-1, daty ISO 8601
(prawdziwe daty kalendarzowe), waluty ISO 4217, podsumowanie 3–5 zdań, 3–7 punktów, brak danych = `null`/`[]`,
klucze po angielsku, wartości w języku dokumentu, jedna ponowna próba przy złej odpowiedzi AI, potem błąd.
Publiczny JSON Schema wyniku: `shared/insight.schema.json` (generowany z Zod, test pilnuje aktualności).

## Wymagania niefunkcjonalne

| Obszar         | Wymaganie                                                       | Realizacja                                                             |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Stack          | React 18+, Vite, TypeScript strict                              | React 19, Vite 8, TS 6 strict + `noUncheckedIndexedAccess`             |
| Klucz API      | Nigdy we frontendzie ani w historii git                         | Cloudflare Worker + `wrangler secret`, hook Claude Code, gitleaks w CI |
| Walidacja      | Zod, testy schematu                                             | `shared/test/schema.test.ts` i testy kontraktu API                     |
| Jakość         | ESLint + Prettier, bez `any`, bez `console.log`                 | `eslint.config.js` (strictTypeChecked), CI                             |
| Struktura      | `components/ lib/ api/`                                         | `web/src/{components,lib,api,hooks}`                                   |
| CI/CD          | GitHub Actions: lint › build › deploy                           | `ci.yml`: quality → e2e → deploy                                       |
| Bezpieczeństwo | CORS tylko dla domeny demo, limity, PDF to dane, info o wysyłce | `worker/src/index.ts`, `http.ts`, `prompt.ts`, `UploadPanel.tsx`       |
| UX             | Od 360 px, klawiatura, kontrast, komunikaty po polsku           | e2e na 360 px i nawigacja klawiaturą, `styles.css` (tryb ciemny)       |
| Dokumentacja   | README, AI_LOG.md                                               | `README.md`, `AI_LOG.md`, `docs/`                                      |

## Definition of Done

Osoba z zewnątrz wgrywa własny PDF, w mniej niż 30 s widzi wynik i pobiera poprawny JSON. Pomiar czasu: pole
„Czas analizy” w widoku wyniku oraz eval na dokumencie testowym (`evals/`).
