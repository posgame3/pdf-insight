# 0005. Model: Claude Sonnet 5.5 przez OpenRouter, effort medium

- Status: przyjęta (zmieniona 2026-10-13 po pomiarach na publicznym demo)
- Data: 2026-10-12

## Kontekst

Dokument testowy wymaga rozumowania: aneks na skanie zmienia warunki, kwoty mają różne role, są sprzeczności i
ukryte polecenia. Definition of Done: wynik w mniej niż 30 s. Klucz API jest w OpenRouter.

## Pomiary (dokument testowy, 12 stron + 1 skan, publiczne demo, 2026-10-13)

| Model (OpenRouter)            | Effort     | Czas                          | Eval (`evals/`)                                 |
| ----------------------------- | ---------- | ----------------------------- | ----------------------------------------------- |
| claude-opus-5.5, 1 wywołanie  | medium     | > 85 s (timeout)              | –                                               |
| claude-opus-5.5, 3 równoległe | low        | 44 s                          | 0 błędów                                        |
| claude-haiku-5.5              | low        | 25,5 s                        | 0 błędów, bez wykrycia sprzeczności 75% / −77%  |
| claude-sonnet-5.5             | low        | 13–21 s                       | niestabilny: 2 z 4 prób > 5 zdań w podsumowaniu |
| **claude-sonnet-5.5**         | **medium** | **15,5–27 s (5 z 6 prób OK)** | **0 błędów, wykrywa sprzeczność i aneks**       |

Ostatnia nieudana próba Sonneta wynikała z nadgorliwego licznika zdań (granica zdania przed cyfrą), poprawionego
w `shared/src/text.ts`; po poprawce 3 z 3 kolejnych prób zakończyły się sukcesem w 20–27 s.

## Decyzja

- `anthropic/claude-sonnet-5.5`, `reasoning.effort: medium`, przez OpenRouter (`response_format` z `strict: true`,
  `provider.require_parameters`, `provider.data_collection: deny`).
- Każda część dokumentu analizowana trzema równoległymi wywołaniami (opis, kwoty, daty) – czas odpowiedzi
  zależy od długości wyjścia, nie wejścia.
- Opus 5.5 zostaje opcją: `AI_MODEL=anthropic/claude-opus-5.5`, `AI_EFFORT=low` (wolniej, ok. 45 s).
  Klient bezpośredniego API Anthropic: `AI_PROVIDER=anthropic`.

## Konsekwencje

- Mieścimy się w DoD z zapasem na dokumenty dłuższe od testowego.
- Koszt Sonneta: 2 / 10 USD za mln tokenów – jedna analiza dokumentu testowego to kilka centów.
