---
cim: Edzések az Apple Health-ből
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [Apple Health, iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1, B5]
osszefoglalo: Az órád vagy más app által rögzített edzések bekerülnek a Boopba, és ha egy edzést a Boopban is vezettél, csak egyszer számít.
---

## Mit csinál
- Az Apple Health-ben lévő edzések (Apple Watch, Huawei vagy más app) automatikusan bekerülnek: fajta, kezdés, vége, kalória,
  átlagpulzus, és B1 óta távolság, maximális pulzus és forrás-app.
- Ha ugyanazt az edzést a Boopban/webes appban is rögzítetted, **egynek** számít.
- A reggeli **„forma”** szám a tegnapi terhelést ebből és a rögzített edzésekből veszi.

## Hogyan működik
1. A telefon a Health-ből olvas, és csomagokban elküldi a háttérrendszernek; az azonosító alapján frissít, nem duplikál.
   A Health-ben törölt edzés a Boopban is törlődik.
2. **Összefésülés (B1, élesben):** olvasáskor, ha egy Health-edzés legalább 50%-ban átfed egy rögzített edzőtermi vagy
   sportalkalommal (a rövidebbik hosszához mérve), csak egyszer számít; a rögzített alkalom kapja a kalóriát és a perceket.
3. **Ma még:** a Health-edzések csak megjelenítésre és az AI hátteréhez kellenek — **nem emelik** a napi kalóriacélt.

## Miért így
Korábban egy edzés, amit kézzel is rögzítettél és az óra is felvett, kétszer szerepelt (kutatás 03 §4). Az összefésülés ezt
javítja anélkül, hogy bármit átírna a rögzített adatokban.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.max-workouts` | Legfeljebb ennyi edzés egy csomagban | 300 |
| `mezo.wearable.reconcile-min-overlap-ratio` | Ekkora átfedéstől számít egy Health-edzés és egy rögzített edzés ugyanannak | 0,5 (50%) |
| `mezo.wearable.zone` | Melyik időzóna szerint dől el, melyik napra esik egy edzés | Europe/Budapest |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `wearable_workout` | A Health-ből érkező edzések (külső azonosító, fajta, idő, kalória, pulzus, távolság, forrás) |
| `workout_session`, `sport_session` | A rögzített edzések, amelyekkel az összefésülés párosít |

## Mi jön még
- B5: az óra által indított edzés és a Boop-lejátszó egy edzés lesz; sorozatonkénti pulzus; futás távolsággal és tempóval.
- Nyitott: a Health aktív energiája helyettesítse-e az edzés-energiát a súlycél-motorban (spec §7).

## Mi marad ki
Nincs.
