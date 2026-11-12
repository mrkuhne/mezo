---
cim: Natív edzéslejátszó
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Edzés közben a telefon sorozatról sorozatra vezet — előírt súly, ismétlés és tartalék, pihenőidő-számláló, gyakorlatcsere és rövid visszajelzés.
---

## Mit csinál
1. **Eligazítás:** mi vár ma, és miért (az előírás indoklása, például „+1 ismétlés”, „terhelés-csökkentő hét”).
2. **Sorozatonként:** a léptető előre kitöltve az előírt súllyal, ismétléssel és tartalékkal (RIR); súlytalan gyakorlatnál csak ismétlés.
3. **Pihenőidő-számláló** sorozatok között.
4. **Gyakorlatcsere vagy -hozzáadás** edzés közben — csak erre az alkalomra, vagy az egész mezociklusra.
5. **Gyakorlat utáni visszajelzés:** pumpa (1–4), ízületi fájdalom (1–3), munka mennyisége (1–3) — kihagyható.
6. **Gyakorlat-megjegyzés**, amit legközelebb előre betölt.
7. **Befejezés** záró megjegyzéssel, majd összegzés.

## Hogyan működik
1. A telefon lekéri a mai edzést: a háttérrendszer kiszámolja minden gyakorlat előírt sorozatait (bemelegítés + munkasorozatok),
   az indoklást és a múlt heti viszonyítást (lásd [Progresszió-motor](04-progresszio-motor.md)).
2. **Indítás:** ha már van nyitott edzés, azt folytatja (sosem duplikál). Egyszerre csak egy nyitott edzés lehet, és egy
   mezociklus-nap hetente egyszer teljesíthető (a saját edzésre ez nem vonatkozik).
3. **Minden sorozat** mentésekor az előírás is eltárolódik a ténylegessel együtt — így később őszintén látszik, sikerült-e a terv.
   Közben a rendszer megtanulja, melyik gépen milyen súlyok hiányoznak.
4. A visszajelzés gyakorlatonként egyszer mentődik (felülírható). **Ma nem befolyásolja a következő heti terhelést** — csak az
   AI és a mintafelismerők kapják meg.
5. **Befejezés:** az edzés lezárul, a rendszer kiszámolja az aktív időt, és frissíti a megtanult időzítést (mennyi egy sorozat,
   egy pihenő, egy átállás).
6. A webes appban a sorozatállapot és a pihenőidő a böngészőben él; a Boop ezt Swiftben, saját modellel építi újra.

## Miért így
A háttér minden számot kiszámol, ezért a telefonos lejátszó egyszerű maradhat (kutatás 03 §5). A webes lejátszó oldal nem kerül
át egy az egyben, csak a funkciói.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.timing-profile.enabled` | Be/ki kapcsolja a megtanult időzítési profilt | be |
| `mezo.train.timing.gap-cap-seconds` | Két sorozat közti szünet felső határa az aktív idő számításánál | 300 mp |
| `mezo.train.timing.seed-set-cycle-compound/isolation` | Kezdő becslés egy sorozat+pihenő ciklusra | 180 / 125 mp |
| `mezo.feature.closing-block.enabled` | Rögzített záró gyakorlatpár minden edzés végén | ki |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_session` | Az elvégzett edzés: állapot, kezdés, befejezés, aktív idő, záró megjegyzés, eredet (mezociklus / saját) |
| `exercise_set` | Sorozatok: súly, ismétlés, RIR, oldal, bemelegítő/munka, kihagyva, és az előírt súly/ismétlés pillanatképe |
| `exercise_feedback` | Gyakorlat utáni visszajelzés (pumpa, ízület, munka) |
| `exercise_weight_gap` | Gépenként hiányzó súlyok, amit a rögzítésből tanul |
| `workout_timing_profile` | Megtanult időzítés (sorozat, pihenő, átállás) |

## Mi jön még
- B5: a natív lejátszó; Élő tevékenység (lásd [Élő tevékenység](08-elo-tevekenyseg.md)); az óra (lásd [Apple Watch-app](07-apple-watch.md)).
- Nyitott kérdés a tulajdonosnak: a visszajelzés (például erős ízületi fájdalom) befolyásolja-e a terhelést.

## Mi marad ki
Az edzés végi XP-ceremónia és az érmek — lásd [Ami kimarad](12-ami-kimarad.md).
