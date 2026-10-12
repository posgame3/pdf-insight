## Co i dlaczego

<!-- Jedno-dwa zdania: jaki problem rozwiązuje zmiana. -->

## Jak sprawdzone

- [ ] `npm run verify` (format, lint, typecheck, testy, build)
- [ ] `npm run e2e` – jeśli zmiana dotyczy UI lub ekstrakcji PDF
- [ ] Nowe zachowanie ma test

## Bezpieczeństwo

- [ ] Żadnych sekretów w kodzie ani w historii (klucz tylko przez `wrangler secret`)
- [ ] Treść dokumentu nie trafia do logów
- [ ] Dane z PDF/AI renderowane jako tekst (bez `dangerouslySetInnerHTML`)
