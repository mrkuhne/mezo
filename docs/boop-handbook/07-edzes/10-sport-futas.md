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
- **Sportalkalmak naplója:** fajta (például röplabda, cross, TRX, kerékpár, úszás, foci, kosár, tenisz, túra, egyéb), időtartam,
  megterhelés (RPE 1–10), szettek vagy körök, és egy kalóriabecslés.
- **Heti sport-beosztás** (edzés vagy meccs) és **egyszeri események**.
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
