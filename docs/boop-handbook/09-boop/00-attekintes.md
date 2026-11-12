---
cim: Boop — a beszélgetés
szint: Fő szekció
terulet: Boop
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [S3, B2, B3, B8]
osszefoglalo: Boop az app egyetlen hangja — a gömb az arca, a Boop fülön pedig úgy lehet vele beszélgetni, hogy már tudja, mi történt ma.
---

## Mit csinál
Boop az a társ, aki az egész appban beszél hozzád. Reggel ő foglalja össze az éjszakát és a napot, napközben ő hozza a
javaslatokat, este ő mondja az egy záró mondatot, és a **Boop** fülön kérdezni is lehet tőle. Nincs „csapat”, nincsenek
külön szakértő-szereplők: a háttérben dolgozó szakterületek (Alvás, Mozgás, Étkezés, Közérzet, Szkeptikus) csak egy
javaslat „miért?” nézetében tűnnek fel rövid, címkézett sorokként.

A szekció részei:
- **Egy hang: Boop** — a szabály, hogy mindig csak Boop szól.
- **A gömb mint Boop arca** — a felkelő gömb, ami Boop jelenléte minden oldalon.
- (A reggeli összefoglaló felolvasása — „Boop elmondja” — a **Ma** szekcióban van leírva.)
- **A Boop fül: beszélgetés a mai napról** — az alap chat (B3, ellenőrzés alatt).
- **Mit tud a beszélgetés** — honnan ismeri Boop a napodat, a céljaidat, a múltadat.
- **„Boop látja” sáv** és **„Ma kérdezheted”** — mit lát most Boop, és három kész kérdés.
- **Hangbevitel** — kérdezés és naplózás beszéddel.
- **Kérdés net nélkül** — a kérdés megvárja a netet.
- **Boop mindent lát (B8)** — a tervezett mély változat.

## Hogyan működik
A telefon csak megjelenít; minden, ami „gondolkodás”, a háttérrendszerben fut. A beszélgetés a webes app régóta működő
beszélgetőmotorját használja, de Boopnak saját csatornát kapott (B3), amely minden körben automatikusan hozzáadja a mai
nap tömör összefoglalóját. A reggeli szöveget, az esti mondatot és a chat válaszait ugyanaz a mesterséges intelligencia
írja, Boop hangján, magyarul. Részletek az **AI és memória** szekcióban.

## Miért így
- **Egy hang** (Döntések naplója #5, 2026-11-11): a tulajdonos nem akar látható csapatot; a webes csapatfal túl sok
  szereplőt és felületet hozott. Boop az egyetlen beszélő, a szakértők a „miért?” mögött maradnak.
- **A chat már tudja a napot** (B3 tervezés, tulajdonosi igény): „ne kelljen mindig kontextust adni magamról, célról,
  edzésről, sportról, kajáról”.

## Beállítások
Nincs saját beállítása a szekciónak; a részoldalak sorolják a sajátjukat.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `ai_conversation` | A beszélgetések (B3-tól jelölve, hogy webes vagy Boop-beszélgetés) |
| `ai_message` | A beszélgetések üzenetei, kérdés és válasz |

## Mi jön még
- **B3 (ellenőrzés alatt):** a Boop fül valódi chatként, a mai nappal a fejében, hanggal és net nélküli sorral.
- **B7:** javaslatkártyák élő újratervezésből, értesítéssel.
- **B8:** Boop mindent lát — a Tervet, a teljes emlékezetet, a rövid/közép/hosszú távú következtetéseket.

## Mi marad ki
A webes csapatfal, a szereplők nevei és saját oldalai, a csapat-chat — Boopban nem jelennek meg (Döntések naplója #5).
Nincs emoji, nincs gamifikáció.
