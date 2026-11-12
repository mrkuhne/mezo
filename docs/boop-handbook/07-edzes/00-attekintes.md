---
cim: Edzés + Apple Watch
szint: Fő szekció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Apple Watch, Háttérrendszer, Apple Health, AI]
szulo:
szakasz: [S3, B1, B2, B5]
osszefoglalo: Egy teljes edzés-app a Boopon belül — mezociklus-terv, sorozatról sorozatra vezetett edzés a telefonon és az órán, élő pulzussal.
---

## Mit csinál
Az Edzés szoba a Boop „teljes edzőterme” — nem lecsupaszított oldal, hanem egy egész edzés-app a Boopon belül
(tulajdonosi döntés, 2026-11-11). Négy belső füle lesz:

- **Ma** — a mai edzés: eligazítás, indítás, sorozatról sorozatra vezetés előírt súllyal, ismétléssel és tartalékkal (RIR).
- **Terv** — a mezociklus (több hetes edzésblokk), a tervgenerátor varázsló, sablonok, saját edzések, heti beosztás, sport és futás.
- **Gyakorlatok** — a gyakorlat-katalógus videóval és képekkel, rekordok.
- **Előzmények** — lezárt edzések, mezociklus-zárójelentés AI-értékeléssel, két futam összehasonlítása, izomterhelés-térkép.

Új a webes apphoz képest: **Apple Watch-app** élő pulzussal és sorozat-rögzítéssel a csuklóról, **pulzus sorozatonként**,
**Élő tevékenység** a zárolt képernyőn, a Watch/Health edzések **összefésülése** a rögzítettekkel, és a futás távolságot és tempót
kap az órától.

## Hogyan működik
Az edzés a Mezo legkiforrottabb területe. A terhelést **szabályalapú motorok** döntik el, nem AI: a következő súly és ismétlés a
legutóbbi azonos gyakorlatból jön, a heti sorozatszám izomcsoportonként emelkedik, a mezociklus végén terhelés-csökkentő hét jön.
Ezek ma is élesben futnak a webes appnak. A Boop natív felületet és órát épít rájuk; a háttérrendszer adja az előírást, az
indoklást és a rekordokat.

**Ma a Boopban:** a Ma oldalon a Mozgás gömbről nyíló szoba mutatja a mai tervezett edzést (cím, időpont, gyakorlatok,
sorozatszám), és ha egy megbeszélés túl közel van hozzá, Boop javasolja az edzés áthelyezését (Elfogadom / Most nem / miért?).
A „+” lapon ott az „Edzés indítása” csempe, de még „hamarosan” választ ad. A Health-ből érkező edzések (B1) már bekerülnek, és a
reggeli „forma” számba beleszámítanak.

## Miért így
- A szerver az „agy”: a Swift-app főleg léptető-felület és pihenőidő-számláló, a nehéz logika a háttérben van (kutatás 03 §5).
- Az óra adja azt, ami a webes appnak sosem volt: élő pulzus és csuklóról rögzítés.
- Az edzés energiája a súlycél-motor egyik bemenete — a B5-nek ezt meg kell tartania (spec §7).

## Beállítások
Az egyes funkcióoldalak tartalmazzák (progresszió, heti volumen, tervgenerátor, készenlét, energia).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `mesocycle`, `meso_template` | Futó edzésblokkok és a tervsablonok |
| `workout_session`, `exercise`, `exercise_set`, `exercise_feedback` | Edzésnapok, gyakorlatok, sorozatok, gyakorlat utáni visszajelzés |
| `exercise_catalog` | A gyakorlat-katalógus |
| `muscle_group_volume_log` | Heti sorozatszám izomcsoportonként |
| `sport_session`, `running_block`, `run_session_log` | Sport és futás |
| `wearable_workout` | Az Apple Health-ből érkező edzések |

## Mi jön még
**B5 Edzés + Watch** — valószínűleg két részben: B5a a szoba és a lejátszó, B5b az óra.

## Mi marad ki
XP- és szintlépés-ceremónia, érmek, az „életkészség” napló — lásd [Ami kimarad az Edzés szobából](12-ami-kimarad.md).
