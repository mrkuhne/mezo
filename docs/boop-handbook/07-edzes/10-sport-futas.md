---
cim: Sport és futás
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Apple Watch, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Röplabda, kerékpár, úszás és más sportok naplója heti beosztással, valamint intervallumos futóblokkok — B5-től távolsággal és tempóval az óráról.
---

## Mit csinál
- **Sportalkalmak naplója:** 11 fajta (röplabda, cross, TRX, kerékpár, úszás, foci, kosár, tenisz, túra, futás, egyéb),
  időtartam, megterhelés (RPE 1–10), szettek vagy körök, és egy kalóriabecslés.
- **Heti sport-beosztás** (edzés vagy meccs) és **egyszeri események** — 2026-11-27-től ugyanaz a 11 fajta kerülhet bele,
  korábban csak röpi, cross és TRX.
- **A kondi és a sport két külön réteg** (2026-11-27): egy beírt röpi vagy az órán rögzített röpi csak a sportot pipálja ki,
  egy befejezett kondi vagy erősítő edzés az órán csak a kondit. Korábban egy beírt röpi a kondit is „megvolt”-nak mutatta.
  Az Edzés napja azt is tudja, ha aznap sport van, így egy sportnap nem „pihenőnap” (az app ezt a Sport területtel kapja meg).
- **Futóblokkok:** hetekre bontott terv, alkalmanként bemelegítés / munka / pihenő / levezetés szakaszokkal (sprint, piramis,
  egyenletes), cél-megterheléssel; és futásnapló.

## Hogyan működik
1. **Kalória egyetlen modellből:** minden mozgás „nettó” energiája = (MET − 1) × nyugalmi anyagcsere / 24 × órák, ahol a MET
   egy nemzetközi táblázatból jön sportáganként, a megterhelés szerint könnyű / közepes / kemény sávval. A „nettó” azt jelenti,
   hogy a nyugalmi égetést nem számolja kétszer.
2. A rögzített alkalmak energiája bekerül a napi kalóriacélba (több mozgás → több étel), és megnyitja az edzés előtti/utáni
   étkezési ablakot.
3. A heti tervezett mozgás a súlycél-motor energiaigény-számításába is bemegy.
4. **A futás ma csak időszakaszokból áll** — nincs távolság vagy tempó, és a futás-rész eddig használatlan volt.
5. **Sport hete a szerveren (2026-11-28):** a szerver hétfőtől vasárnapig (a te idődben) két sávban adja a kondit és a
   sportot (tervezett / kész / kihagyott / elmaradt), a mai sportalkalmat — ha az óra már rögzítette, de még nem írtad be,
   az óra adataival előtöltve —, a heti sportszámot (nincs, ha a hétnek nincs sportja).
6. **Egy terhelési mérce:** megerőltetés (1–10) × perc, kondira és sportra ugyanúgy. A kondinál a megerőltetés a sorozatok
   „mennyi maradt a tankban” értékéből jön. Ahol a megerőltetés vagy az idő hiányzik, azt az alkalmat külön megszámolja, nem találgat.
7. **Testtérkép:** a sportnál fajtánként rögzített, mely izmok mennyit dolgoznak (például röpinél a váll és a comb a legtöbbet);
   a kondinál az elvégzett sorozatok izmai. Külön, és egy közös skálán együtt.
8. **Pihenő a kettő között:** 3 óránál kevesebb egy napon → figyelmeztetés, 3–6 óra → jelzés; sport után másnap délelőtti
   lábnap → jelzés; ha a kemény sport után kétszer is visszaesett másnap az ismétlésszám az utolsó két hétben → jelzés.

9. **Az app Sport területe — Hét fül (2026-11-28):** felül a heti mozgás, a kondi és a sport összideje, alatta a hét
   napjai két sávban (felül kondi, alul sport; kitöltve = megvolt, körvonal = tervben, a mai nap korallszínű). Utána a
   **Terhelés · 6 hét**: hetenként egy oszlop, a sport a kondi fölé rakva, ugyanazon a mércén; ha egy alkalomnál nincs
   megterhelés, az kimarad, és ezt egy sor ki is mondja. Végül **A heti rend**: a rendszeres alkalmak (koppintásra
   szerkeszthetők: sport, nap, kezdés, hossz, edzés vagy meccs, hely; „Ez változik” doboz megmondja, hány óra lesz aznap a
   kondi és a sport között, és ha azon a napon már van egy másik alkalom), **Új rendszeres alkalom**, törlés
   visszavonással; az **egyszeri események** (például egy torna) felvétele és törlése; és a 11 beírható sport. Mentéskor a
   teljes heti rend megy el, a többi alkalom változatlanul. Ha a mentés nem sikerül (például nincs net), a lap nyitva marad
   a beírt adatokkal és egy „Újra próbálom” gombbal.

## Miért így
A spec szerint a sport és a futás megmarad; a futás az órával kap értelmet (távolság, tempó, pulzus), ezért a B5 ott építi újra.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.train.energy.met.*` | MET-értékek sportáganként, könnyű/közepes/kemény sávval (például röplabda 3,0 / 4,0 / 6,0) | lásd konfiguráció |
| `mezo.train.run-default-minutes` | Intervallumos futás feltételezett hossza | 45 perc |
| `mezo.train.sport-session-max-span-days` | Legfeljebb ekkora időszakot kérhetsz le egyszerre a sportnaplóból | 400 nap |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sport_session` | Sportalkalmak: fajta, időtartam, RPE, szettek/körök, kalória |
| `sport_schedule_slot` | Heti sport-beosztás (hétköznaponként több is lehet, edzés vagy meccs) |
| `sport_event` | Egyszeri sportesemények |
| `sport_slot_skip` | Egy beosztott sportalkalom kihagyása egy adott napon |
| `running_block` | Futóblokk: hetek → alkalmak → szakaszok |
| `run_session_log` | Futásnapló (tényleges megterhelés) |

## Mi jön még
B5: futás az óráról távolsággal, tempóval, pulzussal; natív sportnapló. Sport 5. lépés: a Napló (alkalmak javítása,
törlése) és a Test fül (testtérkép, váll, pihenő). Sport 6. lépés: telepítés a telefonra. Egy egyszeri esemény ma még nem
változtat a kondin (például nem teszi könnyebbé az előtte lévő lábnapot) — ez egy későbbi döntés.

## Mi marad ki
Nincs.
