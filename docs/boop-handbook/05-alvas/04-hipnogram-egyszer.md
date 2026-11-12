---
cim: Hipnogram egyszer
szint: Kis funkció
terulet: Alvás
allapot: Élesben
hol: [iPhone app]
szulo: 03-alvas-szoba
szakasz: [S3, B2]
osszefoglalo: Az éjszaka alvási szakaszait mutató ábra az alvás-szobában csak egyszer, a tetején jelenik meg.
---

## Mit csinál
A hipnogram egy sávos ábra: végigmutatja az éjszakát, és színnel jelöli, mikor voltál mély-, REM- vagy könnyű
alvásban, és mikor ébren. Az alvás-szobában ez **egyszer**, az első részben látszik. Az alatta lévő útvonalon az
éjszaka-kártya csak akkor jelenik meg, ha az éjszakához nincsenek szakaszok — akkor azért, hogy ezt elmondja.

## Hogyan működik
1. A telefon az éjszakát 5 perces szeletekre bontva küldi el (legfeljebb 200 szelet).
2. A reggeli összefoglaló ezt adja vissza szakaszokként (ébren, REM, könnyű, mély).
3. A szoba eldönti: ha vannak szakaszok, az első részben rajzol; ha nincsenek, az útvonalon egy kártya mondja, hogy ehhez az éjszakához nincs szakaszadat.

## Miért így
- Tulajdonosi döntés (2026-11-12): ugyanaz az ábra kétszer egy oldalon zavaró volt.
- A hipnogram csak megjelenítésre való, nem számolunk belőle pontszámot (korábbi döntés).

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log` | A `hypnogram` mező: szeletméret és a szakaszok betűsora |

## Mi jön még
Nincs.

## Mi marad ki
- A hipnogramból nem számolunk alvásminőséget.
