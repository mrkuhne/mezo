---
cim: Edzések az Egészségből
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: Az órád által rögzített edzések bekerülnek, és ha ugyanazt az edzést a Mezóban is naplóztad, csak egyszer számít.
---

## Mit csinál
Az Egészségbe írt edzések (például a Huawei órád erősítő edzései) megjelennek a Boopnál, és beleszámítanak a
tegnapi terhelésbe, ami a Forma pontszám része. Ha ugyanazt az edzést a Mezo edzésnaplójában is rögzítetted,
nem számoljuk kétszer.

## Hogyan működik
1. A telefon edzésenként elküldi: típus, kezdés, vége, kalória, átlag- és maxpulzus, táv, forrás.
2. Az edzés napja a kezdés helyi napja.
3. Olvasáskor egy „párosító” megnézi: ha egy Egészség-edzés legalább 50%-ban átfed egy naplózott edzőtermi vagy sport alkalommal (vagy 20 percen belül kezdődik), és a típus illik, akkor egynek veszi. A naplózott alkalom nyer, az Egészség-edzés csak kalóriát / pulzust ad hozzá.
4. A terhelésbe a naplózott alkalmak akkor is beszámítanak, ha nincs Egészség-adat.

## Miért így
- Élesben a Huawei-edzések nagy része percre egybeesett egy naplózott edzéssel — dupla számolás nélkül a Forma hamisan alacsony lenne.
- Olvasáskor párosítunk, nem mentéskor, mert az edzést lehet, hogy csak később naplózod.
- Az Egészség-edzések csak megjelenítésre és AI-háttérnek valók, a kalóriacélt nem módosítják.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.reconcile-min-overlap-ratio` | Mekkora átfedés kell, hogy két edzés egynek számítson | 0,5 (50%) |
| `mezo.wearable.reconcile-max-start-gap-minutes` | Hány perc kezdési eltérés még ugyanaz az edzés | 20 |
| `mezo.wearable.max-workouts` | Edzések egy küldésben | 300 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `wearable_workout` | Egészség-edzés: típus, kezdés, vége, kalória, átlag/max pulzus, táv, forrás |

## Mi jön még
- **B5:** saját Apple Watch edzés élő pulzussal és szettenkénti pulzussal; futásnál táv és tempó az órából.

## Mi marad ki
- Éjfélen átnyúló edzésnél ritkán előfordulhat dupla számolás (ismert korlát).
- Pulzuszónák és útvonal nincs. Ha az író app (például a Huawei) nem csatolja a pulzust az edzéshez, az edzés pulzusa üres marad.
