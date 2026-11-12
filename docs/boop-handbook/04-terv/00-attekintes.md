---
cim: Terv
szint: Fő szekció
terulet: Terv
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, Apple Health, AI]
szulo:
szakasz: [B2, Test, B6]
osszefoglalo: A Terv az, amihez Boop a napjaidat igazítja — súlycél, étrend és edzésterv egy helyen, és a testsúlyod a mérlegről.
---

## Mit csinál
A Terv az alsó sáv második helye (Ma · **Terv** · Napló · Boop). Az aktív terveidet mutatja háttérként: a súlycélt, az étrendet
és az edzéstervet (mezociklus vagy futóblokk), a szabályaikat és azt, hogyan tartod őket.

- **Ma (B2 óta élesben):** egy egyszerű keret — a mai mért súlyod és a trend, a mai edzés, és egy kártya, ami a webes appba
  visz, ahol a tervek beállíthatók.
- **Hamarosan (Testösszetétel szakasz):** egy „Test” kártya a Feelfit mérleg adataival az Apple Health-ből — súlytrend a cél
  vízvonalával, testzsír-százalék, sovány testtömeg.
- **B6-ban (A Terv):** a Terv szerkesztővé válik: több hetes terv súlycéllal, engedélyezett receptekkel és alapanyagokkal,
  csatolt edzésblokkal, szabályokkal; több terv, egy aktív; tervhűség; bevásárlólista; hatáskövetés.

## Hogyan működik
A számok a webes appnak ma is működő **súlycél-motorból** jönnek: a súlycélból (fogyás / tömegnövelés / szinten tartás) és a
testadataidból kiszámolja a napi energiaigényt, heti szakaszokra bontja a tervet, ebből lesz a napi kalória- és makrócél, amihez
az étkezések pontozása mér. A motor minden mérlegelésre újraszámol. A Boop eddig csak olvassa (a reggeli összefoglalóból); a
szerkesztés a B6-ig a webes appban marad.

## Miért így
- A Terv a B2–B5 alatt szándékosan csak olvasható; a tervek felállítása a B6-ban költözik át a webes appból (spec §3, §6).
- A tulajdonos a mérlegét az Apple Health-en át akarja bekötni, külön importálás vagy Bluetooth nélkül (döntés #7).

## Beállítások
Az egyes funkcióoldalak tartalmazzák (`mezo.goal.*`).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `goal` | A súlycél és a motor kimenete (energiaigény, heti szakaszok, megvalósíthatóság) |
| `weight_log` | Mérlegelések (kézi vagy Apple Health) |
| `biometric_profile` | Testadatok: nem, magasság, születési dátum, testzsír, életmód |
| `health_sample` | Health-minták, köztük testzsír és sovány testtömeg |
| `goal_plan_link` | A súlycélhoz csatolt mezociklus vagy futóblokk |

## Mi jön még
- **Testösszetétel** (B3 után): a Test kártya és a Health-testzsír a motorban.
- **B6 A Terv**: a terv-csomag, szerkesztő, bevásárlólista, hatáskövetés.

## Mi marad ki
A webes app szakasz-, tervsáv- és védőkorlát-oldalai nem kerülnek át külön oldalként; a javaslatok egy elfogad/elvet kártyává
egyszerűsödnek (kutatás 10). Életcélok (PERMAH-pillérek) termékként kimaradnak.
