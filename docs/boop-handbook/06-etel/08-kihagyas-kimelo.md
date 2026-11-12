---
cim: Étkezés kihagyása és kímélő mód
szint: Kis funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 04-napi-keret
szakasz: [B4]
osszefoglalo: Egy tervezett étkezést egy koppintással kihagyhatsz okkal együtt; betegség vagy utazás alatt Boop nem kéri számon a kalóriát.
---

## Mit csinál
- **Kihagyás:** „Kihagyom / Kihagytam” egy étkezésre, gyors okokkal (például nem vagyok éhes, nincs időm, rosszul vagyok).
  Az elmaradt kalória kikerül a napi keretből.
- **Kímélő mód:** ha betegség, gyomorrontás, sérülés vagy utazás miatt kímélő időszak indul (ezt az Edzés oldal nyitja), az étel
  is igazodik: nincs számonkérés, vagy csak tájékoztató becslés, vagy a hiány elmarad és szinten tartás a cél.

## Hogyan működik
1. A kihagyás ugyanabba a közös „tervezett kihagyás” nyilvántartásba kerül, amit az edzés is használ, „étkezés” fajtával és a
   tervezett kalóriával.
2. A kímélő időszak oka szerint a napi cél módja változik:
   - betegség, gyomorrontás → **iránymutatás** (nincs kalóriacél, a nap nem kap ítéletet);
   - sérülés → **szinten tartás** (a fogyókúrás hiány kiesik);
   - utazás → **becslés** (csak tájékoztató).
3. A pontozás és az AI értékelés is tudja, hogy kímélő nap van.

## Miért így
Ez a Kihagyás + kímélő mód programban épült, és bevált: a rendszer nem büntet egy beteg napot. A Boop változtatás nélkül átveszi.

## Beállítások
Nincs külön kapcsoló; az okok és módok a kódban rögzítettek.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `planned_skip` | Kihagyások (edzés, sport, futás, étkezés), okkal és az elmaradt kalóriával |
| `recovery_period` | A kímélő időszakok (ok, kezdet, becsült hossz) |

## Mi jön még
B4: natív kihagyás-lap az Étel szobában és a napi útvonalon.

## Mi marad ki
Nincs.
