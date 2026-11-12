---
cim: Források és eszközök
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 02-szeles-adatkor
szakasz: [B1]
osszefoglalo: Minden mérésnél eltesszük, melyik app és eszköz írta, és ha több forrás ütközik, szabály dönt.
---

## Mit csinál
Minden méréshez megjegyezzük a forrást (például „Sleep Cycle”, „Huawei Health”, „Feelfit”), az eszközt és azt,
hogy kézzel írtad-e be. Ha ugyanarra az éjszakára több app is írt, előre rögzített sorrend dönt.

## Hogyan működik
1. Összeadható adatoknál (lépés, kalória, táv) az Apple saját forrás-sorrendje dönt — ezt az Egészség appban te állítod.
2. Éjszakánál a Boop sorrendje: Apple Watch → okosgyűrű appok (Oura, Ultrahuman, RingConn) → Sleep Cycle → bármi más; döntetlennél a több szakaszolt perc nyer.
3. Egyedi mérésnél minden minta a saját forrásával kerül el.
4. Ma tipikusan: alvás a Sleep Cycle-ből; lépés, pulzus, nyugalmi pulzus, aktív kalória, edzések a Huawei Health-ből; testsúly, testzsír, sovány tömeg a Feelfitből.

## Miért így
- Egy okosgyűrű később ugyanígy, az Egészségen át érkezik — a forrás miatt azonnal tudjuk kezelni (tervezési döntés: mintánként tárolás forrással).
- A Huawei Health nem ír HRV-t és alvást, ezért a teljes képhez óra vagy gyűrű kell; a forrás látszik, így ez követhető.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `health_sample` | `source_name` (app neve), `source_bundle` (app azonosító), `device` (eszköz), `user_entered` (kézi-e) |
| `sleep_log` | `source_app`: melyik app éjszakája nyert |
| `wearable_workout` | Az edzés forrásának neve és azonosítója |

## Mi jön még
Nincs.

## Mi marad ki
- A forrásonkénti bontás az összeadható adatoknál elveszik (nem tudjuk szétválasztani a telefon és az óra lépéseit) — szándékosan, mert az Apple ezzel szűri a duplázást.
