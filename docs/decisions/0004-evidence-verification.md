# 0004. Weryfikacja kwot i dat cytatami z dokumentu

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

Zod sprawdza strukturę, nie prawdę. Model może podać kwotę, której w dokumencie nie ma (halucynacja, wyliczenie,
skutek prompt injection), a użytkownik na tej podstawie podejmuje decyzje.

## Decyzja

Każda kwota i data ma `source: { page, quote }`. Worker sprawdza, czy cytat występuje w tekście PDF (bez względu na
spacje, wielkość liter i typografię; wielokropek dzieli cytat na fragmenty), czy cytat zawiera tę wartość
(rozpoznawanie formatów „12 300,00 zł”, „12.300,00”, „4,2 mln”, dat „12.03.2026”, „12 marca 2026”, „March 12, 2026”)
i poprawia numer strony, jeśli model się pomylił. Wynik: `verification` = `text` / `scan` / `unconfirmed`,
plus ostrzeżenie z liczbą niepotwierdzonych wartości.

## Konsekwencje

Użytkownik widzi, którym liczbom może ufać. Wartości ze skanów nie da się sprawdzić automatycznie – są oznaczone
jako `scan`. Dodatkowe pola są dozwolone przez brief (dodawać można, usuwać nie).
