# 0005. Model: Claude Opus 5.5 przez OpenRouter, effort medium

- Status: przyjęta (zmieniona 2026-10-13: dostawca OpenRouter zamiast bezpośredniego API Anthropic)
- Data: 2026-10-12

## Kontekst

Dokument testowy wymaga rozumowania: aneks na skanie zmienia warunki, kwoty mają różne role, są sprzeczności i
ukryte polecenia. Darmowego Gemini odrzuciłem jako zbyt słabego do takich zadań. Ograniczenie: DoD < 30 s.
Klucz API mam w OpenRouter, nie bezpośrednio w Anthropic.

## Decyzja

- Model `anthropic/claude-opus-5.5` przez OpenRouter (ta sama cena co bezpośrednio: 4 / 20 USD za mln tokenów),
  `response_format` z `strict: true`, `reasoning.effort: medium`, bez `temperature`.
- `provider.require_parameters: true` – żądanie trafia tylko do dostawcy, który obsługuje schemat i effort.
- `provider.data_collection: deny` – wykluczeni dostawcy, którzy mogą przechowywać prompty lub na nich trenować
  (prompt zawiera dokument użytkownika).
- Klient bezpośredniego API Anthropic zostaje (`AI_PROVIDER=anthropic`). Wspólna logika – ponowienie przy
  przeciążeniu, mapowanie błędów, parsowanie – jest w `worker/src/model/upstream.ts` i `types.ts`, więc dostawca
  różni się tylko formatem żądania.

## Konsekwencje

- Dodatkowy pośrednik (OpenRouter) w drodze danych – opisane w informacji dla użytkownika i w modelu zagrożeń.
- Zmiana na `anthropic/claude-sonnet-5.5` (szybszy, tańszy) albo `AI_EFFORT=low` nie wymaga zmian w kodzie.
  Jeśli pomiar na demo przekroczy 30 s, to pierwszy krok.
