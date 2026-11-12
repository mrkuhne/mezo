---
cim: Súlycél és célmotor
szint: Funkció
terulet: Terv
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B6]
osszefoglalo: Megadod, hová szeretnél eljutni és milyen tempóban, a motor kiszámolja, reális-e, és hétre bontva megmondja, mennyit egyél.
---

## Mit csinál
- **Súlycél:** fogyás, tömegnövelés vagy szinten tartás; kezdő- és célsúly, tempó (kg/hét), időablak. Egyszerre egy aktív cél.
- **Megvalósíthatóság:** a motor megmondja, reális-e a tempó („Reális” / „figyelmeztetésekkel” / „Agresszív”), és ha túl gyors,
  javasol egy reális céldátumot.
- **Recept:** hetekre bontott napi kalória-, fehérje-, szénhidrát- és zsírcél — ebből lesz az Étel szoba napi kerete.
- **Védőkorlátok:** figyelmeztet, ha az erő vagy a heti izommunka veszélybe kerül, vagy túl gyors a fogyás (csak figyelmeztet,
  nem tilt).

A motor ma a webes appnak dolgozik; a Boop B6-ban kap hozzá felületet (addig a webes appban állítod be).

## Hogyan működik
1. **Nyugalmi anyagcsere (BMR):** ha ismert a testzsír-százalék, a Katch-McArdle képlet (a sovány testtömegből), egyébként a
   Mifflin-St Jeor képlet (nem, kor, magasság, súly).
2. **Napi alap:** BMR × életmód-szorzó (ülőmunka 1,20 / vegyes 1,35 / fizikai 1,50). Az edzés **nem** ebben van, hanem külön
   adódik hozzá: a heti tervezett edzőterem, sport és futás nettó energiája, egy napra vetítve.
3. **Megtanult alap:** ha elég adat van (étkezés + mérlegelés), a motor a valódi energiaigényt tanulja meg, és azt használja a képlet
   helyett (lásd [Megtanult energiaigény](05-megtanult-energiaigeny.md)).
4. **Heti szakaszok:** a motor végigmegy a cél hetein; új szakasz kezdődik, ha például a mezociklus fázisa változik. Napi kalória =
   energiaigény ± a tempóból adódó napi különbség (1 kg ≈ 7700 kcal alapon), de soha nem a BMR alá.
5. **Fehérje:** testsúly-kilogrammonként (alapból 2,0 g), a zsír a választott makróarányból (legalább 0,5 g/kg), a szénhidrát a maradék.
6. **Tempó-sávok:** hetente a testsúly 0,7%-a a cél; 1,0% fölött túl gyors.
7. **Újraszámolás** azonnal: cél aktiválásakor, mérlegeléskor, testadat-változáskor, étrendi beállítás mentésekor, terv csatolásakor.
8. **Heti felülvizsgálat:** hétfő reggel kis lépésű korrekciós javaslat, ha a valóság eltér a tervtől (alvás-adósság esetén óvatosabban).
   Ezeket a Boop egy elfogad/elvet kártyaként mutatja.

## Miért így
Minden számítás a szerveren van, ezért a Boopnak semmilyen matekot nem kell átvennie (kutatás 10 §1). A céldátumot és a
megvalósíthatóságot is a szerver adja, így a telefon és a web nem mondhat mást.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.goal.neat.desk/mixed/physical` | Életmód-szorzó (edzés nélküli mozgás) | 1,20 / 1,35 / 1,50 |
| `mezo.goal.kcal-per-kg` | Egy kg testtömeg-változás energiája | 7700 kcal |
| `mezo.goal.protein.g-per-kg-bw-default` | Alap fehérjecél testsúly-kg-onként | 2,0 g |
| `mezo.goal.rate.target-pct-per-week` | Javasolt heti tempó a testsúly százalékában | 0,7% |
| `mezo.goal.rate.cap-pct-per-week` | Efölött a tempó túl gyors | 1,0% |
| `mezo.goal.volume.maintenance-sets` / `warn-below` | Heti izommunka, ami alatt a védőkorlát figyelmeztet | 8 / 6 sorozat |
| `mezo.goal.strength.e1rm-breach-pct` | Ekkora erőcsökkenésnél figyelmeztet | −5% |
| `mezo.goal.diet.fat-floor-g-per-kg` | Zsír alsó határa | 0,5 g/kg |
| `mezo.goal.bootstrap-uncertainty-kcal` | A képlet bizonytalansága, a tanulás kiindulópontja | 300 kcal |
| `mezo.goal.adaptive.max-step-kcal` | Heti korrekciós javaslat legnagyobb lépése | 120 kcal |
| `mezo.goal.adaptive.dead-band-kcal` | Ennél kisebb eltérésre nincs javaslat | 50 kcal |
| `mezo.goal.adaptive.cron` | A heti felülvizsgálat időpontja | hétfő 6:40 |
| `mezo.goal.overview.rate-tolerance-percent` | Ennyi eltérés a céltempótól még „terv szerint” | 20% |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `goal` | A cél: irány, kezdő/cél súly és dátum, tempó, védőkorlátok, a motor kimenete (energiaigény, heti szakaszok) |
| `goal_plan_link` | Csatolt mezociklus vagy futóblokk a cél heteihez |
| `goal_suggestion` | A motor javaslatai (például korrekció, terhelés-csökkentő hét szinten tartással) |
| `biometric_profile` | Testadatok a BMR-hez |

## Mi jön még
- Testösszetétel: a Health-ből jövő friss testzsír a BMR-be (lásd [Test kártya](04-test-kartya.md)).
- B6: célbeállító a Boopban (profil + cél + tempó → előnézet → létrehozás egy lépésben) és a súlycél a Terv-csomag része.
- Nyitott (spec §7): ha a B5 átalakítja az edzés-oldalt, a motor edzés-energiáját meg kell tartani, vagy a Health aktív energiájára váltani.

## Mi marad ki
A webes szakasz-sín, tervsáv- és védőkorlát-oldalak külön oldalként.
