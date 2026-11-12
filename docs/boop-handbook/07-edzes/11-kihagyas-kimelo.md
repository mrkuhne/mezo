---
cim: Kihagyás, kímélő mód és készenlét
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Egy edzést okkal kihagyhatsz, betegség vagy sérülés esetén kímélő időszak indul fokozatos visszatéréssel, és egy rossz reggel után Boop könnyebb napot ajánl.
---

## Mit csinál
- **Kihagyás okkal:** „előbb kihagyom, okot utána mondok” — komoly okok (betegség, gyomorrontás, sérülés, utazás) és enyhébbek
  (fáradt vagyok, nincs időm, nincs kedvem, egyéb).
- **Kímélő időszak:** komoly okkal és becsült hosszal indul; a benne lévő edzések automatikusan felmentettek. „Ma mégis edzek”
  egy napot könnyítve felszabadít; „Jobban vagyok” lezárja.
- **Visszatérő rámpa:** az első 1–2 edzés könnyebb a kihagyás után.
- **Reggeli készenlét:** ha a reggeli check-in szerint kipihenetlen vagy, nagyon izomlázas vagy motiválatlan, Boop könnyebb napot
  ajánl — csak akkor lép életbe, ha rákoppintasz („Könnyítsük”).

## Hogyan működik
1. **Kihagyás megítélése (szabály):** komoly ok mindig felmentett; enyhe okból hetente az első felmentett (heti „szabadjegy”).
   Ez egy központi nyilvántartás, amit a sorozat-számláló, a mezociklus-teljesítés és az étel is olvas.
2. **Visszatérés a kímélő időszak után:** legfeljebb 2 nap → folytatás; 3–9 nap → a mezociklus egész hetekkel eltolódik;
   10 nap vagy több → egy hét vissza, és izomcsoportonként egy lépéssel kevesebb sorozat (de nem a minimum alá).
3. **Rámpa:** sorozatok kb. egyharmaddal kevesebb, tartalék legalább 3, az első edzés kb. 90%-os súllyal.
4. **Készenlét:** a check-in válaszaiból (kipihentség, izomláz, motiváció, fájó testrészek) szabály dönti el, ajánl-e könnyítést;
   a könnyítés csak tartást jelent és kevesebb sorozatot a kímélendő gyakorlatoknál.
5. Mindez a mai edzés lekérésekor, a sablon módosítása nélkül érvényesül, és ugyanazon a napon visszavonható.

## Miért így
A Kihagyás + kímélő mód program bevált modellje: a rendszer nem büntet egy beteg hetet, és fokozatosan hoz vissza. Csak
„könnyebb” irányba igazít — „keményebb” ajánlás nincs.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.train.readiness.rested-max` | Ennyi vagy kevesebb kipihentségnél könnyebb napot ajánl (1–10) | 4 |
| `mezo.train.readiness.soreness-min` | Ennyi vagy több izomláznál könnyebb napot ajánl (1–10) | 7 |
| `mezo.train.readiness.motivation-max` | Ennyi vagy kevesebb motivációnál könnyebb napot ajánl (1–10) | 3 |
| `mezo.train.readiness.morning-slot` | Melyik check-in számít reggelinek | 06:30 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `planned_skip` | Kihagyások fajtával (edzés, sport, futás, étkezés) és okkal |
| `recovery_period` | Kímélő időszakok |
| `recovery_day_release` | „Ma mégis edzek” napok |
| `readiness_choice` | A reggeli készenlét alapján hozott döntés (könnyít / marad) |
| `workout_day_adjustment` | Egy napra szóló sorozat-csökkentés (például egy „holnap könnyebben” javaslatból) |

## Mi jön még
B5: natív kihagyás-lap, kímélő mód és készenlét-ajánlat. B7: a javaslatkártyák bővülnek (rövidebb edzés, más mozgás).

## Mi marad ki
Nincs.
