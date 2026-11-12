---
cim: Részletes lapok — éjszaka, pulzus, nap
szint: Kis funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Apple Health, Naptár]
szulo: 00-attekintes
szakasz: [S3]
osszefoglalo: Három felcsúszó lap mutatja részletesen az éjszakádat, a pulzusodat és a napod energiagörbéjét.
---

## Mit csinál
- **Az éjszakád** — csempék, az alvás fázisai színes sávban (ébren, REM, könnyű, mély), a mélyalvás a héten.
- **A pulzusod** — a heti nyugalmi pulzus oszlopai, a mai legkisebb · átlag · legnagyobb érték.
- **A napod** — az energiagörbe egy **nagyítóval**: ujjal végighúzva látod az órát, az energiát százalékban
  (például „14:00 · 41%”) és hogy mi van akkor; óránként egy finom rezgés. Alatta a naptár sávja az edzéssel, és ha
  van, az ütközés kártyája „Áttolom / Marad így” gombokkal.

## Hogyan működik
Az energiagörbe egy **modell, nem mérés**: egy tipikus napi ívet (délelőtt csúcs, kora délután mélypont, késő
délután második csúcs) a Forma alapján feljebb vagy lejjebb tol, és figyelembe veszi a késői ebédet és az edzést.
A lapok a Ma oldalról és bármelyik szobából nyithatók.

## Miért így
A görbe azt segít látni, mikor érdemes a nehéz dolgokat tenni. A B3-ban a saját check-in pöttyeid kerülnek mellé,
hogy lásd, mennyire talál.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A görbe 19 órás pontja (06–24), az alvás fázisai, a heti sorok |

## Mi jön még
A görbe a napi terhelést (naptár, edzés) is figyelembe veszi — B7.

## Mi marad ki
Éjszakánkénti pulzusvonal és HRV ezen a lapon — nincs.
