# 0006. Jedna strona bez routera na GitHub Pages

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

GitHub Pages zwraca 404 dla ścieżek obsługiwanych przez router SPA i nie pozwala ustawiać nagłówków HTTP.

## Decyzja

Aplikacja ma jeden widok sterowany stanem (`useAnalysis`), bez routera – nie ma ścieżek, które mogłyby dać 404.
`base: '/pdf-insight/'` w Vite; worker pdf.js importowany przez `?url`, assety pdf.js (CMapy, fonty, WASM) kopiowane
do `public/pdfjs`, więc działają pod podścieżką. CSP jako `<meta>` dodawany tylko do buildu produkcyjnego,
z `connect-src` wyliczonym z `VITE_API_URL`. pdf.js ładowany dynamicznie dopiero po wybraniu pliku.

## Konsekwencje

Brak problemów z odświeżaniem strony. CSP w `<meta>` nie obsługuje `frame-ancestors` – akceptowalne dla demo.
