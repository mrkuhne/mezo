---
cim: A nap kérdése
szint: Kis funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: check-in
szakasz: [B3]
osszefoglalo: Minden kitöltésben egy hatodik, változó kérdés — arról, amiről Boop a legkevesebbet tud rólad, egy rövid magyarázattal.
---

## Mit csinál
Az öt alapkérdés után jön **„A NAP KÉRDÉSE”** (például éhség, izomláz, motiváció, emésztés), alatta Boop egy sora,
hogy miért ezt kérdezi, például: „Most azt figyeljük, hogyan alakul az éhséged — erről van a legkevesebb válaszod.”
Ha a kérdés fájdalomról szól, előbb igen/nem, aztán a testtáj és az erősség; sóvárgásnál a skála után a fajtája.

## Hogyan működik
- A meglévő kérdésterv-motor választja: az esetek 20%-ában véletlenszerűen, máskor azt, amiből az elmúlt 14 napban
  a legkevesebb válasz van.
- A telefon előre lekéri a nap mindhárom napszakának kérdését, így net nélkül is megvan. Ha nincs előre letöltött
  kérdés, a nap kérdése kimarad.

## Miért így
Így a ritkább kérdésekről is gyűlik adat, anélkül, hogy minden kitöltés hosszú lenne. A véletlen rész miatt nem
torzul, amit Boop rólad tanul.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.checkin.plan.adaptive.random-share` | Az esetek hányadában véletlen a nap kérdése | 0,2 |
| `mezo.checkin.plan.adaptive.need-window-days` | Hány nap visszamenőleg számolja, miből van kevés válasz | 14 |
| `mezo.checkin.plan.adaptive.why-need` / `why-random` | A „miért ezt kérdezem” sor szövege | magyar mondat |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `check_in` | A nap kérdése a kitöltés része (melyik kérdés volt, és miért) |

## Mi jön még
Nincs külön tervezve.

## Mi marad ki
Nincs.
