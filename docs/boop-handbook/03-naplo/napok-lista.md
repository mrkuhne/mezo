---
cim: A napok (Napló lista)
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2, B3]
osszefoglalo: A Napló hely az elmúlt 14 napodat mutatja — értékelés, cél, energiavonal, a napló első sora — koppintásra a nap összegzésével.
---

## Mit csinál
A Napló helyen **„A NAPOK”**: az elmúlt 14 nap üvegsorokban, a legújabb felül. Egy sor: a dátum (például „Tegnap ·
szerda · nov. 11.”), az értékelés szava, a cél és eredménye, egy mini energiavonal a pöttyökkel, és a napló első
sora idézőjelben. Koppintásra a nap **„A MAI NAPOD”** összegzése és energiagörbéje nyílik.

Ami üres nap, az egyszerűen nincs a listában. Alatta **„MINTÁK”**: „Amint elég napod összegyűlik, itt látod, mi hat
mire.” (még keret).

## Hogyan működik
A lista a szerver zárási rekordjaiból és a kitöltésekből épül, kiegészítve azzal, amit a telefon még nem küldött el
(ezeknél egy kis felhő jelzi). A webes appban lezárt nap is megjelenik.

## Miért így
A B2 csak egy keretet tett a Napló helyre. A B3 egy minimális listát ad, hogy legyen hova visszanézni; a teljes
böngésző és a minták később jönnek.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.dayclose.max-range-days` | A lista legfeljebb ennyi napot kérhet le egyszerre | 92 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `day_close` | A zárások |
| `check_in` | A kitöltések (a mini energiavonalhoz) |
| `journal_entry` | A napló szövege |

## Mi jön még
- Napló · Minták: rövid, közép és hosszú távú következtetések, hatáskövetés — B8.
- 14 napnál régebbi napok lapozása — később.

## Mi marad ki
Nincs.
