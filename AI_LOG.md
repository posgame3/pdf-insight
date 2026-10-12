# AI_LOG

Jak AI było użyte do zbudowania PDF Insight: narzędzia, najważniejsze prompty, błędy AI i ich poprawki.

## Narzędzia

| Narzędzie                                            | Do czego                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Claude Code** (aplikacja desktop, Claude Opus 5.5) | Analiza briefu i PDF testowego, plan, cały kod, testy, dokumentacja, CI, przegląd zmian             |
| **Claude Opus 5.5 przez API**                        | Model w aplikacji (structured outputs, vision dla skanów)                                           |
| **Playwright** sterowany przez Claude Code           | Render stron PDF do analizy pułapek, testy e2e, narzędzie `inspect` (co przeglądarka wysyła do API) |
| Drugi agent AI (niezależna analiza)                  | Porównanie listy pułapek w dokumencie testowym z moją, żeby niczego nie przeoczyć                   |

Kontekst dla AI jest częścią repozytorium:

- [CLAUDE.md](CLAUDE.md): komendy, mapa kodu, zasady, reguły bezpieczeństwa;
- [docs/](docs/): mapowanie briefu, architektura, ADR, model zagrożeń, lista pułapek;
- [.claude/](.claude/): hook blokujący zapis kluczy, autoformatowanie, komendy `/verify`, `/check-traps`,
  `/security-review`.

## Proces

1. **Analiza zanim powstał kod.** Brief i PDF testowy zostały rozebrane na części: render każdej strony, porównanie
   warstwy tekstowej z obrazem, szukanie tekstu niewidocznego dla człowieka, sprawdzenie struktury PDF
   (JavaScript, warstwy, załączniki, aktualizacje przyrostowe).
2. **Lista pułapek → wymagania → testy.** Każda pułapka dostała mechanizm obsługi i test
   ([docs/test-documents.md](docs/test-documents.md)).
3. **Weryfikacja API przed kodem.** Przed napisaniem klienta Claude Code sprawdził w aktualnej dokumentacji
   Anthropic, co Opus 5.5 obsługuje. To zmieniło projekt (patrz błąd 1).
4. **Implementacja z testami.** Kolejność: `shared` (schemat) → `worker` → ekstrakcja → UI → e2e → dokumentacja.
   Po każdym kroku pełne `npm run verify`.
5. **Sprawdzenie na prawdziwym dokumencie.** Narzędzie `inspect` pokazało, co przeglądarka wyśle do API dla PDF
   rekrutera. Na tym etapie wyszły dwa błędy (3 i 4).

## Kluczowe prompty

1. **Plan:** „Zaplanuj mi to tak 10/10”, razem z treścią zaproszenia i briefem. Wynikiem był plan z mapowaniem
   wymagań i kryteriów oceny na konkretne pliki i testy.
2. **Pułapki:**
   - „Zobacz, czy nie ma instrukcji podanych białą czcionką”;
   - potem „jakie inne ukryte rzeczy mogą tam być, żeby oszukać?”.

   Prowadziło to do pełnej analizy PDF: ukryta instrukcja na stronie 4, skan aneksu na stronie 11, sprzeczność
   75% / −77%, identyfikatory przypominające daty, kwoty o różnych rolach i fałszywy alarm dla białych nagłówków
   tabel.

3. **Weryfikacja krzyżowa:** wklejona analiza drugiego agenta z poleceniem „zobacz, czy się pokrywają i czy
   odkryliśmy coś nowego”. Doszły z niej:
   - test wstrzyknięcia ograniczony do `summary`/`keyPoints`/`amounts`;
   - sprawdzanie tekstu per strona;
   - oznaczanie nieprzeczytanych stron;
   - pomiar czasu na publicznym demo.
4. **Implementacja:** „Przygotuj ten projekt pragmatycznie, ale 10/10, ze wszystkimi pułapkami. Kod ma być czysty,
   bez duplikatów, jakby pisał go najlepszy programista. Uwzględnij bezpieczeństwo i poinformuj na końcu
   o potencjalnych problemach”.
5. **Wymagania oferty:** wklejony zakres stanowiska z poleceniem „zobacz, na co zwracają uwagę”. Efekt to praktyki
   pracy z Claude Code widoczne w repo: CLAUDE.md, `docs/`, hooki, komendy, ADR, evals, PR-y z CI.

## Błędy AI i jak zostały poprawione

| #   | Co AI zrobiło źle                                                                                                                                                  | Jak wyszło                                                  | Poprawka                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Plan zakładał wymuszone `tool_choice` do uzyskania JSON (wzorzec z wcześniejszych modeli). W Claude Opus 5.5 zwraca to błąd 400, a myślenia nie da się wyłączyć.   | Sprawdzenie aktualnej dokumentacji przed napisaniem klienta | Structured outputs (`output_config.format`). Sanityzacja JSON Schema, bo API odrzuca `minLength`/`maxItems`/`pattern`. Reguły, które wypadły, przeniesione do Zod + retry ([ADR 0003](docs/decisions/0003-structured-outputs-and-validation.md)) |
| 2   | Edytor narzędzia AI zamieniał sekwencje `​` w wyrażeniach regularnych na **dosłowne niewidoczne znaki**. Kod wykrywający ukryte znaki sam zawierałby ukryte znaki. | Skrypt listujący znaki spoza ASCII w plikach                | Escape'owanie w osobnym kroku. Każdy plik z wyrażeniami regularnymi sprawdzany po zapisie                                                                                                                                                        |
| 3   | Wykrywanie skanów liczyło znaki całej strony. Zeskanowany aneks z powtarzaną stopką (113 znaków) nie był rozpoznany jako skan.                                     | Test e2e na wygenerowanym PDF z pułapkami                   | Liczone są tylko znaki z obszaru treści (bez marginesów 8%)                                                                                                                                                                                      |
| 4   | Fragment usuniętego ukrytego tekstu był sklejany spacjami po kawałkach („wcze ś niejsze”).                                                                         | Narzędzie `inspect` na PDF rekrutera                        | Ten sam algorytm składania linii co dla tekstu widocznego                                                                                                                                                                                        |
| 5   | Zgodność wersji:                                                                                                                                                   | `typecheck` i `lint`                                        | Przypięty TypeScript 6.0. `loadingTask.destroy()` zamiast `PDFDocumentProxy.destroy()`, z obsługą anulowania                                                                                                                                     |
|     | • najnowszy TypeScript 7 nie współpracuje z `typescript-eslint`;                                                                                                   |                                                             |                                                                                                                                                                                                                                                  |
|     | • pdf.js 6 usunął `PDFDocumentProxy.destroy()`.                                                                                                                    |                                                             |                                                                                                                                                                                                                                                  |
| 6   | Testy komponentów szukały tekstu w całym widoku i trafiały też w podgląd JSON. Asercje były niejednoznaczne.                                                       | Vitest (błąd „multiple elements”)                           | Zapytania zawężone do konkretnego regionu (`within`) albo selektora                                                                                                                                                                              |
| 7   | Pierwsza wersja kodu nie przechodziła ESLint `strictTypeChecked` (43 problemy: `ReadonlyArray`, `any` z `expect.*`, asercje `!`).                                  | `eslint --max-warnings 0`                                   | Poprawki w kodzie. Wyłączenie `no-unsafe-assignment` tylko w testach, z uzasadnieniem w konfiguracji                                                                                                                                             |

## Co zostało zweryfikowane ręcznie, a co automatycznie

- **Automatycznie:**
  - 145 testów jednostkowych i 10 e2e (desktop + 360 px);
  - lint, typecheck i build w CI;
  - gitleaks na całej historii;
  - eval wyniku na dokumencie testowym.
- **Ręcznie (Claude Code + człowiek):**
  - payload wysyłany dla PDF rekrutera: ukryty tekst ze strony 4 usunięty, strona 11 wysłana jako skan, nagłówki
    tabel zachowane, układ dwukolumnowy poprawny, przypis jako `[1]`;
  - przegląd kodu pod kątem duplikatów i bezpieczeństwa (`/security-review`).
