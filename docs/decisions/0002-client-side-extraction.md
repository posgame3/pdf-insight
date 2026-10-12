# 0002. Ekstrakcja PDF w przeglądarce i wykrywanie ukrytego tekstu przez render

- Status: przyjęta
- Data: 2026-10-12

## Kontekst

Dokument testowy zawiera ukrytą instrukcję dla AI (biały tekst 5 pt), skan aneksu bez warstwy tekstowej i białe
nagłówki tabel na granatowym tle. Sama warstwa tekstowa PDF tego nie rozróżnia: ukryty tekst wygląda w niej jak
każdy inny, a skanu w niej nie ma.

## Decyzja

pdf.js działa w przeglądarce. Każda strona jest renderowana na canvas, a dla każdego fragmentu tekstu liczymy
rozpiętość jasności pikseli w jego obszarze. Brak kontrastu (biały na białym, przykrycie kształtem, przycięcie,
pozycja poza stroną) albo czcionka < 2,5 pt = tekst ukryty: usuwamy go przed wysłaniem i pokazujemy użytkownikowi.
Strona z prawie zerowym tekstem w obszarze treści, ale z widoczną treścią graficzną, jest skanem – wysyłamy ją jako JPEG.

## Konsekwencje

- Wykrywamy _każdy_ sposób ukrycia, nie tylko biały kolor, i nie mamy fałszywych alarmów na kolorowych tłach.
- Plik nie opuszcza urządzenia; do Workera trafia mały JSON (tekst + kilka obrazów).
- Render kosztuje ok. 50–150 ms na stronę; dla dokumentów > 40 stron renderujemy w skali 1.0 zamiast 1.5.
- Ograniczenie: niewidoczny tekst (tryb renderowania 3) nałożony na _inny_ widoczny tekst nie zostanie wykryty.
