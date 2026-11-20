---
cim: Edzésstílus
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Egy edzésblokkhoz választhatsz stílust — a gyakorlatok ismétlés-tartományát, tartalékát és pihenőjét a stílus állítja be, a motor pedig hétről hétre fokozza az erőfeszítést.
---

## Mit csinál
Egy edzésblokkra (mezociklusra) rá lehet tenni egy **stílust**, és az minden gyakorlat előírását összehangolja: hány ismétlés,
mennyi tartalék, mennyi pihenő. Négy stílus van:

| Stílus | Összetett gyakorlat | Izolációs gyakorlat | Tartalék | Pihenő (összetett / izolációs) |
|---|---|---|---|---|
| **Kiegyensúlyozott** | 6–10 ismétlés | 10–15 ismétlés | szabad súlyos összetett 2 (lábgyakorlatoknál 3), gépes összetett 1, izolációs 1 | 2,5 perc / 1,5 perc |
| **Sok ismétlés** | 10–15 | 15–25 | 2 | 2 perc / 1 perc 15 mp |
| **Nagyobb súly** | 5–8 | 8–12 | összetett 2, izolációs 1 | 3 perc / 2 perc |
| **Két sorozat bukásig** | 6–10 | 8–12 | 0 — mindent kiadsz | 3 perc / 2 perc |

A **Két sorozat bukásig** stílus gyakorlatonként csak két sorozatot ír elő; a többi stílus megtartja a tervben szereplő sorozatszámot.
A „tartalék” azt jelenti, hány ismétlést tudtál volna még csinálni a sorozat végén.

**A nehéz alapgyakorlat messzebb marad a bukástól, mint az izoláció.** A szabad súlyos összetett gyakorlatok (például guggolás, fekvenyomás) jobban fárasztanak és technikásabbak, ezért több tartalékot kapnak; a gépes összetett és az izolációs gyakorlatok közelebb mehetnek a határhoz, mert ott kicsi a kockázat és a fáradtság (Jeff Nippard, *The Muscle Ladder* tanácsa alapján). A lábgyakorlatok a gépen is 3-at kapnak.

**Új blokk alapból Kiegyensúlyozott.** Ha a rendszer tervez neked blokkot, az már ebben a stílusban indul, így a hétről hétre fokozódó erőfeszítés és a könnyebb lazító hét magától működik. A már futó blokkok gyakorlatai megtartják az induláskor kapott tartalékot.

**Hétről hétre fokozódik.** A blokk elején a stílus tartaléka az irányadó, a közepén eggyel kevesebb (nehezebb), az utolsó terhelő héten
kettővel kevesebb, a terhelés-csökkentő héten kettővel több. Például egy hat hetes blokkban (az utolsó hét lazító) 2-es
alap-tartalékkal: 2, 2, 1, 1, 0, majd a lazító héten 4.

**Amit te írsz be, az erősebb.** Ha egy gyakorlatnál kézzel átírod az ismétlés-tartományt, a sorozatszámot, a tartalékot vagy a pihenőt,
az ott marad; a stílus csak azokat a mezőket tölti ki, amelyekhez nem nyúltál. Egy gyakorlatnak saját stílusa is lehet — de csak olyan
blokkban számít, aminek van stílusa.

## Hogyan működik
1. A blokk mentésekor, indításakor, ismétlésekor, egy nap módosításakor és egy gyakorlat edzés közbeni cseréjekor a háttérrendszer ráírja a
   stílus értékeit a gyakorlatokra (a te felülírásaid kivételével).
2. Ha mentéskor nem küldesz stílust, a blokk megtartja a meglévőt.
3. Minden gyakorlatról tudjuk, hogy **stabil** vagy **szabad**:
   - **Stabil**: gépen, kábelen, támasztott háttal, ülve végzett mozgás — kevésbé függ az egyensúlytól és a technikától, ezért biztonságosan
     lehet bukásig menni.
   - **Szabad**: állva, szabad súllyal végzett mozgás (például állva oldalemelés, álló bicepsz-hajlítás). Itt a fáradt technika sérülésveszélyes.
   A 166 törzs-gyakorlatból 57 stabil, 23 pedig „nyújtott helyzetben is biztonságos”. Saját gyakorlatod alapból „szabad”, és átállítható.
4. Ha egy szabad gyakorlatra **Két sorozat bukásig** stílus kerülne, a rendszer inkább **Nagyobb súly** stílust ír elő 1-es tartalékkal,
   hogy szabad súllyal ne menj bukásig. A válasz külön jelzi, melyik stílus él valójában.
5. A progresszió-motor a stílus szerint számol (lásd [Progresszió-motor](04-progresszio-motor.md)): erőfeszítés-fokozás, pihenő, a súlyemelés
   előtti ismétlés-többlet, és izomcsoportonkénti elakadás-figyelés.

## Miért így
- Az intenzitás-technikák **csak stabil gyakorlatokon** engedettek (lásd [Technikák](15-technikak.md)): ezért kell a stabil/szabad besorolás.
- A saját beírásod mindig erősebb a stílusnál: a stílus segít, nem kényszerít.
- Tulajdonosi döntés alapján a szigorú stabil-lista a biztonság felé téved: inkább legyen egy gyakorlat „szabad”, mint hogy fáradtan, szabad súllyal
  menjen bukásig.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.train.style.styles` | A négy stílus ismétlés-tartománya, tartaléka (gyakorlattípusonként is), pihenője, túlcsordulása | a fenti táblázat |
| `mezo.meso-plan.default-training-style` | Milyen stílusban indul a rendszer által tervezett új blokk | Kiegyensúlyozott |
| `mezo.train.style.allout-free-reserve` | Szabad gyakorlatnál a „bukásig” helyett használt tartalék | 1 |
| `mezo.train.style.ramp` | Az erőfeszítés-fokozás lépései | közép −1, utolsó hét −2, lazító hét +2, szabad alsó határ 1 |
| `mezo.train.style.stall-weeks` | Hány hét javulás nélkül számít elakadásnak | 2 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meso_template`, `mesocycle` | A blokk stílusa |
| `exercise` | A gyakorlat saját stílusa, pihenője és a kézzel felülírt mezők listája |
| `exercise_catalog` | Felszerelés, stabil/szabad, nyújtott helyzetben biztonságos |
| `exercise_set` | Az edzett ismétlés-tartomány pillanatképe sorozatonként |

## Mi jön még
A stílust a telefonon, a blokképítő Blokk fülén választod ki — a futó blokkon is (2026-11-19; a váltás a blokk gyakorlatait
azonnal átállítja, a te kézi beállításaid maradnak). Hátra van: a pihenő és a tartalék megjelenítése edzés közben, az elakadás
utáni javaslatok, és egy mód a stílus levételére (most csak cserélni lehet).

## Mi marad ki
A webes app nem kapja meg (befagyasztott). Az elakadási javaslatok egyelőre nincsenek; az elakadás csak a heti javaslat naplójában jelenik meg.

A technikákról (pihenős drop, drop set, myo set, félismétlések, napi kihívás) lásd [Technikák](15-technikak.md).
