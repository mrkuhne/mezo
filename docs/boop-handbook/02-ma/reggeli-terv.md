---
cim: A nap terve (Reggel)
szint: Funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2, B3]
osszefoglalo: Reggel Boop összerakja a nap tervét, te egy koppintással elfogadod — a B3 óta a nap célját is itt adod meg.
---

## Mit csinál
A Reggel részben a **„A MAI TERVED”** kártya sorolja a nap pontjait (például: alvás, edzés 17:30, fehérjecél,
lefekvés 22:45). Alul **„Elfogadom a napot”**. Elfogadás után a kártya egy sorra csukódik össze, például: „A nap
terve elfogadva · 07:42 · a nap célja: …”.

A kártya alatt a **„Boop mondja”** kártya: koppintható kifejezések, amelyek a részletes lapokat nyitják (például a
megbeszélések kifejezés a nap lapját).

A B3 óta a kártyán egy új blokk is van: **„MI MA A LEGFONTOSABB?”** — lásd *A nap célja* oldalt a Napló
szekcióban. *(B3: ellenőrzés alatt)*

## Hogyan működik
- A terv sorai a reggeli összefoglalóból jönnek, nem kell hozzá külön kérés.
- Az elfogadás a telefonon, naponként van megjegyezve.
- A tervben „Boop céljai” is vannak (például fehérje, edzés, lefekvés) — ezeket este a zárásnál az adatokból
  ítéli meg, magától.

## Miért így
A spec szerint a Reggel feladata: ítélet + a nap terve, amit elfogadhatsz vagy módosíthatsz. Az elfogadás egy
koppintás, hogy ne legyen teher.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A terv sorai az összefoglaló részeként |

## Mi jön még
A terv módosítása (nem csak elfogadása) és a terv szabályai az AI-ban — B6 (A Terv).

## Mi marad ki
Automatikus változtatás a terven — semmi sem változik a tulajdonos koppintása nélkül.
