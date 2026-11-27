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
- **A Sport terület adatai a szerveren** (2026-11-28, a telefon a következő lépésben kezdi mutatni): egy hétre a terem és a
  sport sávja napról napra, a mai sport állapota (még előtte · az óra már rögzítette, ilyenkor előtöltve · kész · kihagyva az
  indokkal), hat hét terhelése, melyik izmot dolgoztatta a terem és a sport, a váll heti átlaga, a pihenő a kettő között, és
  Boop jelzései. Amiről nincs adat (nehézség, hossz, ismeretlen sportfajta), arra nem talál ki számot.
- **Futóblokkok:** hetekre bontott terv, alkalmanként bemelegítés / munka / pihenő / levezetés szakaszokkal (sprint, piramis,
  egyenletes), cél-megterheléssel; és futásnapló.

## Hogyan működik
1. **Kalória egyetlen modellből:** minden mozgás „nettó” energiája = (MET − 1) × nyugalmi anyagcsere / 24 × órák, ahol a MET
   egy nemzetközi táblázatból jön sportáganként, a megterhelés szerint könnyű / közepes / kemény sávval. A „nettó” azt jelenti,
   hogy a nyugalmi égetést nem számolja kétszer.
2. A rögzített alkalmak energiája bekerül a napi kalóriacélba (több mozgás → több étel), és megnyitja az edzés előtti/utáni
   étkezési ablakot.
3. A heti tervezett mozgás a súlycél-motor energiaigény-számításába is bemegy.
4. **Egy mérce a teremre és a sportra:** egy alkalom terhelése = mennyire volt nehéz (1–10) × hány perc. A sportnál a beírt
   nehézség számít; a teremnél a sorozatokból becsüljük: minden kész munkasorozatnál 10 mínusz a „még ennyi ment volna”
   ismétlés, ezek átlaga. Így a kettő összeadható és összevethető.
5. **Izomhő:** a sportfajtákhoz egy táblázat rendeli, mely izmokat mennyire dolgoztatják (például röplabda: váll, comb, vádli);
   a teremnél a sorozatok izmai kapják a terhelést. A két réteg és az együttes érték egy közös skálán látszik.
6. **Pihenő a kettő között:** ha egy napon terem és sport is van, és 3 óránál kevesebb köztük a pihenő, Boop figyelmeztet;
   3–6 óránál csak jelez. Ennek alapja két kutatás (Robineau és mtsai, 2016; Sports Medicine áttekintés, 2021): 6 óránál
   rövidebb pihenőnél a két edzés zavarja egymást. Akkor is szól, ha egy sportnap után másnap délelőtt lábnap jön, vagy ha
   az utolsó két hétben legalább kétszer esett vissza az ismétlésszám egy kemény sportnap után.
7. **A futás ma csak időszakaszokból áll** — nincs távolság vagy tempó, és a futás-rész eddig használatlan volt.

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
B5: futás az óráról távolsággal, tempóval, pulzussal; natív sportnapló.

## Mi marad ki
Nincs.
