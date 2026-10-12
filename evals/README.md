# Evals

Sprawdzanie jakości wyniku na prawdziwym dokumencie. Zod pilnuje _struktury_; te testy pilnują _treści_:
czy pułapki z dokumentu testowego zostały obsłużone.

```bash
# 1. W demo (lub lokalnie) wgraj Test_PDF_Insight_umowa_14-2026.pdf i pobierz JSON.
# 2. Sprawdź wynik:
python3 evals/check_insight.py ~/Downloads/Test_PDF_Insight_umowa_14-2026.insight.json \
  --expect evals/expectations/umowa-14-2026.json
```

- **FAIL** (twarde): wymagania briefu i pułapki, które muszą być obsłużone (np. brak „1 PLN” z ukrytej instrukcji,
  13 100 PLN z aneksu na skanie, NIP nie jest kwotą). Kod wyjścia 1.
- **SOFT**: sygnały jakości (np. ostrzeżenie o sprzeczności 75% vs −77%), raportowane bez przerywania.

Co przeglądarka faktycznie wysyła do API (bez wywoływania modelu):
`INSPECT_PDF=ścieżka.pdf npx playwright test inspect --project=desktop` → `test-results/inspect/`.
