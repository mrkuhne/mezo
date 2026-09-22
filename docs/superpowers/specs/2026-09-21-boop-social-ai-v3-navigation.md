# Boop V3 — közvetlen menü és teljes oldalas navigáció

Dátum: 2026-09-21. Driver: **mezo-7fduk**. Állapot: **vizuális egyeztetés alatt**.
Előzmény: [V2 leltár](2026-09-21-boop-social-ai-v2-coverage.md).
Bemutató: [V3 prototípus](assets/boop-social-world-v3.html).

## A felhasználói korrekció

A funkciók átnevezése és a gyűjtőnézetek alá rejtése megnehezítette a tájékozódást.
A felhasználó megtartandónak jelölte a Minták, Előrejelzések, Diagnózis, Kísérletek
és Heti neveket. Kérte az egymásból nyíló drawerek felszámolását, részletesebb
aloldalakat és saját ikonos, animált, játékos menüt. Ez felülírja a V1–V2 azon
navigációs javaslatát, amely e funkciókat a Folyamatban gyűjtő alá és új nevekre helyezte.

## Navigációs döntési javaslat

Az alsó dokk négy helye: **Üzenőfal / Menü / Rólad / Emlékek**. A bal oldali
Boop-területváltó és a meglévő app-shell megmarad. A prototípus most a Menü oldallal
indul, hogy a változás közvetlenül megítélhető legyen; a termék napi belépője továbbra
is az Üzenőfal lehet.

A Menü közvetlen bejáratai: Minták, Előrejelzések, Diagnózis, Kísérletek, Heti,
Karakter, Tudástár, Emlékek, Konzílium, Coaching, Beszélgetés, Gépterem.
A Heti innen közvetlenül megnyitható; a meglévő Én/heti adatainak kanonikus helye
nem változik. A javaslat egy új navigációs bejárat, nem második heti adatmodell.

Minden tartalmi részlet teljes oldalként jelenik meg, visszalépéssel és „Összes
funkció” gombbal. Az öt korábban elvesző funkció között közvetlen átjárók vannak.
A V2 meglévő részletei — forráskörök, futások, memóriarétegek, karaktertörténet,
konzílium, memoár és egyebek — ugyanezt a teljes oldalas navigációt használják.
A prototípus megőrzi a visszalépés előtti szűrőt és a részlethez vezető oldal állapotát.

Üveglap csak rövid művelethez marad: válaszírás, pontosítás, tudásmentés,
gyorsrögzítés és a „Miből látszik?” magyarázat. Egyszerre egy lap látszik;
rövid műveletből nyíló következő rövid művelet lecseréli az előzőt.

## Kidolgozott fő útvonalak

| Funkció | Kezdőoldal | Részletes útvonalak |
|---|---|---|
| Minták | Hat életciklusállapot, példarekordok, lefedettség | Minta, bizonyíték, történet, döntés, kapcsolódó beszélgetés |
| Előrejelzések | Mind / Folyamatban / Lezárt, értékelhetőségi magyarázat | Folyamatban, nem vált be, nem értékelhető, saját visszajelzés |
| Diagnózis | Új vizsgálat és korábbi vizsgálatok | Három kérdés, indítási előnézet, két magyarázatot bemutató jelentés, bizonyíték és kísérlet |
| Kísérletek | Aktív hét napjai, javaslatok, lezárt eredmények | Aktív kísérlet, tapasztalat, javaslat elfogadása/elvetése, eredmény |
| Heti | Hétválasztás, hét nap jelzése, értékelési bejáratok | Hét külön napi részlet, heti értékelés, felfedezések, tanulságpostaláda, memoár, előző/aktuális hét |
| Karakter | Hét dimenzió és változásnapló | Mindegyik dimenzió saját példaszöveggel, állítás-visszajelzés és történet |
| Tudástár | Tények, postaláda, kapcsolatok, kommunikáció | A kanonikus szerkeszthető ténylistához vezet; a ténylista nem lett lemásolva |
| Emlékek | Napi emlék, memoár, archívum, keresés | Meglévő V2 részletek teljes oldalként |
| Konzílium / Coaching / Gépterem | Saját nevükön nyíló főoldalak | A V2 művelet- és forrásrészletei teljes oldalként |

A régi helyeken meglévő Rólad/Emlékek bejáratok ugyanazokat a részleteket nyitják.
A menü nem teremt újabb tartalmi példányokat. A bemutató a fő útvonalakat és állapotokat
tervezi meg, nem az éles adatmennyiség minden rekordját. A chat, más területek és
valós mentések továbbra is integrációs határok. A V2 leltár részleges/átjáró jelölései
érvényesek ott, ahol e dokumentum nem rögzít bővebb kidolgozást.

## Vizuális nyelv és játékosság

A saját agyagikonok a menü belépőin nagyobb szerepet kapnak; a meglévő Boop-figurák,
krém felületek, színes átmenetek és puha árnyékok megmaradnak. A csempék hoverre és
lenyomásra reagálnak, ikonjuk finoman billen. Oldalváltáskor rövid térbeli átmenet,
a heti oszlopoknál növekedő animáció segíti a követést. Reduced-motion esetén a
mozgás kikapcsol. A válasz és tudáspontosítás meglévő jutalom-visszajelzése megmarad.
Nem jutalmazzuk a „helyes” egészségügyi választ vagy az AI-val való egyetértést.

A kísérlet napjai és a döntésre váró jelölések tényleges funkcionális állapotot
szemléltetnek. A prototípus minden adata példa; a heti oszlopok naplózási jeleket
mutatnak, nem egészség- vagy teljesítménypontszámot.

## Ellenőrzési bizonyíték

- `node --check /tmp/boop-v3-check.js`: sikeres szintaxisellenőrzés.
- Böngészőben mind a 12 menübejárat megnyitva; megfelelő oldalnév jelent meg.
- Heti → szeptember 20. napi részlet → Vissza: a Heti oldalra tért vissza.
- Minták → Figyeljük → részlet → Vissza: a Figyeljük kijelölése megmaradt.
- 320 px-es keretben az öt főoldal mért `scrollWidth` és `clientWidth` értéke azonos,
  318 px; a teljes oldalas tartalom nem lógott ki vízszintesen.
- A vizsgált böngészőnaplóban nem jelent meg JavaScript-hiba.
- A statikusan megadott `data-modal` hivatkozásoknak van céljuk.

Termékkódot, API-t, adatot vagy ütemezést ez a változás nem módosít. A terv továbbra
is felhasználói vizuális visszajelzésre vár; merge/deploy nem része ennek a körnek.

Dokumentáció-lint: 73 dokumentum — 62 tiszta, 2 figyelmeztetés, 9 elavult, 0 hiba.
A FAIL eredmény kimenete byte-azonos a változás előtti baseline-nal (`diff -q`: 0).
A meglévő elavultsági figyelmeztetések ezen tervezési munkán kívül esnek.
A feed → beszélgetés → válaszlap → vissza útvonal szintén sikeresen ellenőrizve.
