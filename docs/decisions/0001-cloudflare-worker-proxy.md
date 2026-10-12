# 0001. Klucz API za Cloudflare Workerem

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

GitHub Pages serwuje tylko pliki statyczne, a klucz API nie może trafić do frontendu ani do historii git (to
dyskwalifikuje). Potrzebny jest serwer pośredniczący, który przetrwa co najmniej 14 dni bez opieki i w darmowym planie.

## Decyzja

Cloudflare Worker `pdf-insight-api`: klucz jako `wrangler secret`, CORS ograniczony do `https://posgame3.github.io`,
wbudowany Rate Limiting (5 zapytań/min na IP), strumieniowy limit body, walidacja Zod, logi bez treści dokumentów.

## Konsekwencje

- Brak zimnego startu i darmowy plan wystarczają; wdrożenie jedną komendą (`npm run deploy:worker`).
- Plan darmowy ma limit 10 ms czasu CPU na żądanie. Czekanie na API Claude się nie wlicza, ale parsowanie dużych
  żądań tak – dlatego ekstrakcja jest w przeglądarce, a obrazy skanów są limitowane (ADR 0002).
- Alternatywy: Vercel/Netlify Functions (dłuższy zimny start, mniej precyzyjny rate limiting), własny serwer (utrzymanie).
