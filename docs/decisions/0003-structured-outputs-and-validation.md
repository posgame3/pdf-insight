# 0003. Structured outputs + Zod + jedna ponowna próba

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

Brief wymaga wyniku zgodnego ze schematem, walidacji przed wyświetleniem i jednej ponownej próby. Claude Opus 5.5
odrzuca wymuszone `tool_choice` (`any`/`tool`) i nie pozwala wyłączyć myślenia, a tryb structured outputs
(`output_config.format`) nie przyjmuje m.in. `minLength`, `maxItems`, `minimum`, `pattern`.

## Decyzja

- Jeden schemat Zod (`shared/src/schema.ts`) jest źródłem: JSON Schema dla modelu, walidacji i typów.
- `worker/src/structuredOutput.ts` usuwa z JSON Schema słowa kluczowe nieobsługiwane przez API i domyka obiekty
  (`additionalProperties: false`). Ograniczenia, które wypadły (3–5 zdań, 3–7 punktów, prawdziwe daty, kody walut),
  sprawdza Zod.
- Gdy Zod odrzuci odpowiedź, wysyłamy jedną poprawkę: poprzednia odpowiedź modelu (z blokami myślenia, bez zmian)
  - lista błędów. Druga porażka = 502 `ai_invalid_response` z polskim komunikatem.
- Przeglądarka waliduje wynik jeszcze raz (nie ufa serwerowi) i ponownie przed pobraniem pliku.

## Konsekwencje

Poprawny składniowo JSON gwarantuje API; reguły biznesowe gwarantuje Zod. Ponowna próba wydłuża analizę, więc
prompt jawnie podaje limity (3–5 zdań, bez skrótów), żeby była rzadka.
