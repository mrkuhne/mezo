---
cim: Kérdezd Boopot a napodról
szint: Kis funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: A Boop helyen kérdezhetsz a mai napodról anélkül, hogy bármit el kellene magyaráznod — Boop már tudja, mi történt.
---

## Mit csinál
A Boop hely tetején: „Kérdezz bármit a mai napodról — tudom, mi történt.” Alatta:
- **„BOOP LÁTJA · MOST”** — tény-csipek (például alvás a tegnapihoz képest, HRV a szokásoshoz, a mai edzés és ideje,
  kitöltések és az utolsó energia, evett kalória a célhoz, a nap célja, hátralévő naptár);
- **„MA KÉRDEZHETED”** — legfeljebb 3 kész kérdés, például „Miért vagyok fáradtabb, mint tegnap?”, „Mennyit egyek
  az edzés előtt?”;
- a beszélgetés, alul írás vagy hang.

Net nélkül a kérdés vár: „Nincs net · a kérdésed elküldöm, amint lesz”. A részletes leírás a Boop szekcióban van (09-boop).

## Hogyan működik
- Naponta egy beszélgetés; Boop minden kérdéshez megkapja a **mai nap tömör összefoglalóját** (alvás, pulzus, HRV,
  lépés, kitöltések a pillanatképekkel, a cél, edzés, étkezés, naptár csak időpontokkal, lefekvési cél, súlycél).
- A csipek pontosan azt mutatják, amit a modell lát.
- A kész kérdéseket szabályok választják, nem AI. A válasznak meg kell neveznie, melyik adatra támaszkodik.

## Miért így
A tulajdonos kérése (B3 spec, D8): „ne kelljen mindig kontextet adni magamról, célról, edzés, sport, kaja”.

## Beállítások
Nincs saját — a meglévő beszélgetőmotor beállításait használja.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `ai_conversation` | A beszélgetések; az új `channel` oszlop jelzi, hogy a Boopból (`boop`) vagy a webről indult |
| `ai_message` | Az üzenetek |

## Mi jön még
Boop a Tervet és a teljes emlékezetet is látja — B6, B8.

## Mi marad ki
Régebbi napok beszélgetései a Boop helyen a B3-ban (csak a mai látszik); naptárcímek az AI-nak.
