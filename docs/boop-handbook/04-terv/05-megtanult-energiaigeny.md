---
cim: Megtanult energiaigény
szint: Kis funkció
terulet: Terv
allapot: Tervezve
hol: [Háttérrendszer]
szulo: 02-sulycel-celmotor
szakasz: [B6]
osszefoglalo: A rendszer az étkezéseidből és a mérlegből megtanulja, valójában mennyit égetsz, és hetente óvatosan igazít a terven.
---

## Mit csinál
A képlet csak becslés. Ha elég étkezést és mérlegelést rögzítesz, a rendszer megtanulja a **valódi** napi alap-energiaigényedet,
és azt használja a képlet helyett. Hetente egy kis lépéssel igazít, és megmondja, mennyire biztos benne („Biztos” / „Közepesen
biztos” / „Még tanulok”). A Boop ebből legfeljebb egy heti mondatot mutat.

## Hogyan működik
1. Hétfő reggel fut. Az elmúlt kb. 120 nap adataiból egy statisztikai szűrő három dolgot követ: a valódi testtömeget, a
   víz-ingadozást (például a szénhidráttól) és az alap-energiaigényt.
2. A gyanús napokat (nagyon kevés rögzített étel) kihagyja, és a mozgást ismert bemenetként kezeli, nem tanulja.
3. **Óvatos lépés:** 30 kcal alatti eltérésre nem lép; új irányba csak a felével; legfeljebb 150 kcal egy héten; és sosem megy a
   képlet ±35%-án kívülre, sem a nyugalmi anyagcsere 1,1-szerese alá.
4. Ha a héten kevés a használható nap (4 alatt) vagy a mérlegelés (2 alatt), „vár”.

## Miért így
A motor élesben fut és jól működik; a webes „Hogy tanultam?” részletes oldal viszont kimarad a Boopból (spec §3.1) — a motor
marad, a felület egy mondatra zsugorodik.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.goal.expenditure.enabled` | Be/ki kapcsolja a tanulást | be |
| `mezo.goal.expenditure.window-days` | Ennyi nap adatából tanul | 120 |
| `mezo.goal.expenditure.max-step-kcal` | Legnagyobb heti lépés | 150 kcal |
| `mezo.goal.expenditure.dead-band-kcal` | Ennél kisebb eltérésre nem lép | 30 kcal |
| `mezo.goal.expenditure.max-deviation` | Legfeljebb ennyivel térhet el a képlettől | 35% |
| `mezo.goal.expenditure.min-usable-days-per-week` / `min-weigh-in-days-per-week` | Ennyi használható nap / mérlegelés kell hetente | 4 / 2 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `expenditure_estimate` | Heti tanult alap-energiaigény és magyarázata |
| `intake_day_mark` | A tanulásból kézzel kizárt napok |

## Mi jön még
B6: egy heti mondat a Tervben („Ezen a héten 50 kcal-lal feljebb vettem az alapodat — biztosabb lettem”), mindig „miért?”-tel.

## Mi marad ki
A „Hogy tanultam?” oldal, a heti tanulás-kártyák és a napok kézi kizárása a Boopban.
