# Bezpieczeństwo

## Zgłaszanie problemów

Podatność zgłoś prywatnie przez [GitHub Security Advisories](https://github.com/posgame3/pdf-insight/security/advisories/new),
nie w publicznym issue. Odpowiadam w ciągu 72 godzin.

## Jak chroniony jest klucz API

- Klucz API (OpenRouter) istnieje wyłącznie jako sekret Cloudflare Workera (`npx wrangler secret put OPENROUTER_API_KEY`).
  Nie ma go we frontendzie, w zmiennych `VITE_*`, w repozytorium ani w jego historii.
- Lokalnie klucz jest w `worker/.dev.vars`, który jest w `.gitignore`.
- CI skanuje całą historię git narzędziem gitleaks; hook Claude Code (`.claude/hooks/guard-secrets.mjs`) blokuje
  zapisanie klucza w pliku podczas pracy z AI.
- Wydatki ogranicza rate limit Workera (5 analiz/min na IP) oraz limit kredytów na koncie OpenRouter.

## Co dzieje się z dokumentami

- Plik PDF jest czytany w przeglądarce i nie jest nigdzie wysyłany ani zapisywany.
- Do API trafia tekst stron i obrazy stron zeskanowanych. Worker przekazuje je przez OpenRouter do Claude (Anthropic), wymagając dostawców bez przechowywania promptów (`data_collection: deny`), i niczego
  nie zapisuje; logi zawierają wyłącznie metadane (kody błędów, liczby stron, czasy).
- Historia wyników jest tylko w `localStorage` przeglądarki użytkownika i można ją wyczyścić jednym kliknięciem.

## Zabezpieczenia aplikacji

Szczegóły i ograniczenia: [docs/threat-model.md](docs/threat-model.md). W skrócie: CORS tylko dla domeny demo,
limity rozmiaru i liczby zapytań, walidacja Zod na wejściu i wyjściu, treść PDF traktowana jako dane (ukryty tekst
usuwany przed wysłaniem, losowe ograniczniki w promptcie), weryfikacja kwot i dat cytatami, renderowanie wyłącznie
jako tekst, Content Security Policy, pdf.js bez `eval` i bez wykonywania skryptów PDF.
