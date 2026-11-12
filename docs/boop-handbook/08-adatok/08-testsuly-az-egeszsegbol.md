---
cim: Testsúly az Egészségből
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B1]
osszefoglalo: A mérleg által az Egészségbe írt testsúly magától bekerül a súlynaplódba, kézi beírás nélkül.
---

## Mit csinál
Ha a mérleged (például a Feelfit) beírja a súlyodat az Apple Egészségbe, a Boop felveszi a súlynaplóba, és a
súlycélod trendje ebből frissül. A kézi mérések megmaradnak mellette.

## Hogyan működik
1. A telefon a testsúly-méréseket egyedi mintaként küldi.
2. A szerver ezeket a súlynaplóba is beírja „Apple Egészség” forrással és az Apple-féle azonosítóval (újraküldve nem duplázódik).
3. Egy csomagra legfeljebb **egy** célújraszámolás és **egy** Boop-jelzés történik, és csak akkor, ha a mérés mai vagy tegnapi.
4. Ha egy napon kézi és Egészség-mérés is van, mindkettő megmarad; a kijelzők a napi átlagot veszik.

## Miért így
- Egy 60 napos visszatöltés különben 60 célújraszámolást és 60 üzenetet indítana (B1 döntés).

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `weight_log` | Súlymérés; `source` (kézi vagy Apple Egészség), `external_id` (Apple-azonosító) |
| `health_sample` | Ugyanaz a mérés mintaként (`body_mass`) a forrással |

## Mi jön még
- **Test szakasz:** a testzsír és a sovány testtömeg megjelenítése, a testzsír a cél-motorba.

## Mi marad ki
- Egészségből törölt mérés után a cél nem számolódik újra; a túl nagy / kicsi értékeket a szerver nem szűri szépen.
