# 0005. Model: Claude Opus 5.5, effort medium

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

Dokument testowy wymaga rozumowania: aneks na skanie zmienia warunki, kwoty mają różne role, są sprzeczności i
ukryte polecenia. Darmowego Gemini odrzuciłem jako zbyt słabego do rozumowania nad aneksami i pułapkami. Ograniczenie: DoD < 30 s.

## Decyzja

`claude-opus-5-5` z `output_config.effort: medium` (domyślne dla tego modelu), bez `temperature` (Opus 5.5 ma
zawsze włączone myślenie adaptacyjne). Model i effort są zmiennymi Workera (`ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`),
więc zmiana na `claude-sonnet-5-5` (szybszy, tańszy) albo effort `low` nie wymaga zmian w kodzie.

## Konsekwencje

Koszt ok. 4 USD / 20 USD za mln tokenów wejścia / wyjścia; dokument testowy (ok. 7 tys. tokenów tekstu + 1 skan)
kosztuje kilka centów. Jeśli pomiar na demo przekroczy 30 s, pierwszym krokiem jest `ANTHROPIC_EFFORT=low`.
