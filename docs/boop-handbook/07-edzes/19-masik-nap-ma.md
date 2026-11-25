---
cim: Másik napot csinálok ma — a kimaradt edzés élőben pótolva
szint: Funkció
terulet: Edzés
allapot: Ellenőrzés
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Ha kimaradt egy edzésnap, a Mai edzés fülön a hét egy másik napját is elindíthatod ma — a szokásos eligazítással és edzéslejátszóval, a hét többi napja pedig nem csúszik.
---

## Mit csinál
A Mai edzés kártyája alatt ott a **„Másik napot csinálok ma”** sor (2026-11-25). Rákoppintva feljön a **„Melyik napot
csinálod ma?”** lap a hét még meg nem csinált edzésnapjaival:

- elöl a **kimaradtak**, a legutóbbi az első („KEDD · KIMARADT”, például „Láb · comb · far”),
- utánuk a hét **későbbi napjai** („CSÜTÖRTÖK · KÉSŐBB”).

Egy napot kiválasztva a kártya átvált rá: **PÓTLÁS** felirat, a nap neve, alatta „keddi nap, ma pótolod · 60 perc ·
5 gyakorlat”. Az **Indítás** a megszokott eligazítással és edzéslejátszóval indítja, a választott nap tervével. Indulás
előtt a **„Mégis a mai napot csinálom”** sorral visszaválthatsz.

## Hogyan működik
- A sor akkor látszik, ha nem fut edzés, a mai edzés még nincs meg, és a héten van még nyitott edzésnap — pihenőnapon is.
- A pihenőnapok (gyakorlat nélküli napok) és a héten már megcsinált napok nem kerülnek a listára. Egy nap akkor számít
  megcsináltnak, ha azon a héten bármelyik nap kész lett, vagy a Naplóban „Megvolt”-ként pótoltad.
- **A heted** csempéin a pipa a ténylegesen megcsinált napon jelenik meg: a szerdán megcsinált keddi edzés a keddet
  pipálja, nem a szerdát.
- Edzés után a kártya „megvolt” állapotban azt az edzést nevezi meg, amit ma csináltál.
- A szerdai nap a héten nyitva marad: holnap ugyanebben a listában ott lesz „SZERDA · KIMARADT”-ként.
- A másik nap tervét a telefon a szervertől kéri. Net nélkül ezt írja: „Most nem érem el a szervert, a másik nap tervét
  nem tudom letölteni.”

## Miért így
A tulajdonos kérése (2026-11-25): a kimaradt keddi edzést szerdán élőben pótolja, és a hete ne csússzon. Három út
volt: egy másik napot elindítani (ezt választotta), az egész hetet egy nappal eltolni, vagy csak kimaradtnak jelölni.
Ez volt a leggyorsabb, mert a szerver már tudta, és pontosan a pótlást adja. A hét eltolása később ráépíthető.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_session` | A pótolt edzés a mai dátummal, a választott tervnaphoz kötve |
| `exercise_set` | A sorozatai, ahogy élőben rögzíted őket |

## Mi jön még
- A hét eltolása egy nappal, ha a pótlás mellett is hiányzik.
