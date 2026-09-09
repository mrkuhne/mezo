# Edzés — erő, amire építhetsz

2026-09-09 · `mezo-6wbr` · önálló Boop / Clay mobilprototípus.

**[Mobilkeretes előnézet](http://127.0.0.1:5197/phone.html)** ·
**[Közvetlen alkalmazás](http://127.0.0.1:5197/index.html#home)**

A munka helye: `/Users/mrkuhne/.codex/worktrees/aa61/mezo`.
A Fuel mintájára készült külön tanulmány; a Fuel könyvtára és az 5196-os szervere
változatlan. Production frontend/backend/API nem módosult. A felhasználó kérésére
nem készült Superpowers spec vagy implementation plan.
[Döntés: ADR 0041](../../decisions/0041-train-clay-prototype.md).

## Indítás és iteráció

A projekt gyökeréből:

```bash
python3 -m http.server 5197 --bind 127.0.0.1 --directory docs/design_3.0/train-prototype
```

Natív HTML/CSS és ES modulok, telepítés és build nélkül. A forrásmódosítás után
frissítsd a böngészőt. `file://` helyett a helyi szervert használd.

| Fájl | Feladat |
| --- | --- |
| `index.html` | Az alkalmazás és a desktop tanulmánykörnyezet |
| `phone.html` | Sötét telefonház, státuszsáv, Dynamic Island, gesztuscsík; 384 × 805 px belső alkalmazásviewport |
| `style.css` | Paletta, mobilhierarchia, Clay-avatar, reszponzív felület |
| `app.mjs` | Nézetek, hash-navigáció, űrlapok, modális panelek |
| `model.mjs` | Mintaadat, szettműveletek, explicit lezárás, mozgásnapló, heti elhatárolás |
| `model.test.mjs` | A napló és az állapotváltozások hét célzott tesztje |
| `assets/` | A Fuelben is használt Design 2.0 Clay sprite-ok és helyi Geist/Fraunces betűk önálló másolata |

## Főoldalak és aloldalak

Az állandó dock: **színes kétszemű területváltó + Edzés · Heti · Tervek · Napló · Tár**.
A fejléc minden oldalon `boop.` + felirat nélküli zöld beszélgetési avatar.

| Fő belépő | Aloldalak és utak | Kipróbálható működés |
| --- | --- | --- |
| Edzés (`home`) | `day`, `prep`, `warmup`, `session`, `closing`, `review`, `custom` | Napválasztó; felkészülés; edzésindítás; kg/ismétlés/RIR; munkaszett/bemelegítés; szettjavítás és -törlés; 150/90 mp pihenőóra és kihagyás; félretétel, folytatás; részleges edzés explicit lezárása; saját edzés összeállítása. |
| Futás az Edzésből | `run`, `run-plan`, `run-log`, `activity` | Futószakasz/pihenő/körszám és tervnév mentése; dátum, perc, távolság, RPE, teljesített kör, pulzus-megnyugvás és jegyzet rögzítése; mentett adatlap. |
| Sport az Edzésből | `sport`, `sport-log`, `activity` | Röplabda, Cross, TRX; időtartam, RPE, set/körszám, jegyzet és dátum; közös napló. |
| Heti (`week`) | `day`, `schedule`, `load`, `muscle` | Hétfő–vasárnap napirend; program és időpont szerkesztése; múlt/ma/jövő elkülönítés; naplózott közvetlen munkaszettek és volumen izomcsoportonként. |
| Tervek (`plans`) | `plan`, `plan-edit`, `plan-day`, `templates`, `template`, `plan-new`, `report` | Aktív ciklus, név/hossz/fókuszcímke; edzésnapok; sablon létrehozása és törlése; új aktív ciklus megerősítéssel; cikluslezárás; mintaeredmények. |
| Napló (`log`) | `review`, `activity`, `progress`, `record` | Erősítés/futás/sport szűrők; megnyitható szettbontás; mentett zárójegyzet; munkavolumen-grafikon; gyakorlatonként legnagyobb naplózott munkasúly. |
| Tár (`library`) | `exercises`, `exercise`, `medals`, `medal`, `templates` | Keresés; alsótest/felsőtest/kedvenc szűrés; technikai adatlap és RIR-magyarázat; tartós saját jegyzet; kedvenc; két szemléltető medáladatlap. |
| Közös panelek | területváltó, chat, szettjavítás, megerősítések | Natív dialog, Escape és bezárás; helyi chatvázlat/üzenetek; külső terek külön lapon. |

34 útvonalnév, paraméterezett részletekkel. Példák: `#day?i=2`,
`#exercise?id=squat`, `#review?id=monday`, `#muscle?name=Combfeszítő`.
Az oldalon belüli visszagomb a tényleges belépési helyet követi; közvetlen
megnyitáskor értelmes szülőoldalt választ. A listakeresés és görgetési hely
navigáció közben megmarad.

## Rövid kipróbálási út

1. Edzés → Felkészülök → Kezdjük el. Rögzíts egy szettet; megjelenik a pihenőóra.
2. Koppints a mentett szettre, javítsd a súlyt; tedd félre az edzést, majd folytasd.
3. Összegzés → saját jegyzet → Edzés lezárása. A napló és a heti számok frissülnek.
4. Edzés → Futás vagy Sport → rögzítés. A mentett alkalom a közös naplóba kerül.
5. Heti → Szerkesztem; Tervek → tervbeállítások; Tár → gyakorlat → kedvenc/jegyzet.
6. Tár → Mintanap újraindítása visszaállítja a tanulmány saját állapotát.

## Adatok, valódi számítások és határok

A `localStorage` kulcs **`boop-train-clay-v1`**, a mintanap **2026-09-09**.
Nincs felhasználói adatolvasás, hálózati API, valódi AI vagy produkciós mentés.
Az 5193-as és 5196-os prototípusoktól elkülönített állapot. A telefonkeret és a
közvetlen alkalmazás azonos eredetű, így ugyanazt a helyi mentést látja; egy másik
már nyitott lapon frissítés szükséges. A telefonkeret frissítéskor a főoldalra lép,
ahol a megkezdett edzés folytatható; a szettek és a pihenő határideje megmaradnak.

**Ténylegesen számolt:** munkavolumen = munkaszettek Σ(kg × ismétlés),
ismétlés- és szettszám, lezárt edzés időtartama, heti alkalmak és percek,
gyakorlatonként legnagyobb rögzített munkasúly. A bemelegítés külön összeg.
Szettjavítás/-törlés újraszámol; a lezárás egyszeri és kifejezett; részleges
edzés is zárható, a hiányzó szettek nem teljesülnek automatikusan. A heti
számlálók csak szeptember 7–13. adatait veszik figyelembe, régebbi sportlogot nem.

**Tudatos egyszerűsítések:**

- Hét mintagyakorlat, egy mintahét; nincs teljes katalógus vagy gyakorlatvideó.
  Az előző edzés szettadata és az 52 perces tervbecslés előre megadott minta.
- Az izombontás a gyakorlat **elsődleges** izomcsoportját mutatja, nem a production
  súlyozott effektív szettjeit. Nincs MEV/MAV/MRV-ajánlás vagy automatikus volumenramp.
- A heti naptár napi egy fő programot kezel; nem másolja a production napi több
  sportidőpontját és egyszeri eseményeit. A megkezdett edzés a terv módosítása után
  is megmarad. A lezárt gymnapló ebben a próbában nem szerkeszthető vissza.
- A sablon és ciklus alapadatai menthetők, de a gyakorlatreceptek és periodizált
  heti program nem teljesen szerkeszthetők. A fókusz címke, nem számítási bemenet;
  az új ciklus ugyanazt a mintagyakorlat-készletet használja. A ciklusívgrafikon
  **illusztratív**, a riport a rövid mintanapló élő összegzése, nem fagyasztott
  production ciklusriport. Nincs ciklus-összehasonlítás vagy AI-tervgenerálás.
- Futásnál egy intervallumos mintaterv szerkeszthető; nincs GPS, időzített
  futóedzés-vezérlés vagy teljes sprint/piramis tervező. Sport/futás mentésnél
  nincs automatikus kcal-, readiness-, terhelési score vagy keresztterhelési motor.
- A két medáladatlap szemléltető. A valódi medálmotor/e1RM/progressziós algoritmus
  nincs átmásolva; a rekordnézet egyszerű, tényleges munkasúly-maximum.
- A chat előre megírt, jelzett minta, nem edzői ajánlás. Nem módosít terveket.
- A Fuel területváltó-link átjárás; nincs közös kalóriakeret vagy adatszinkron.
  A többi külső helyi átjáráshoz az 5193-as / 5196-os szervernek futnia kell.

## Vizuális elvek

Meleg papír, zsálya összegzések, korall erősítés, arany eredmények, levendula sport,
kék futás. Geist a számokhoz és kezelőelemekhez, Fraunces a rövid címsorokhoz.
A telefonháztól külön app, valódi mobilviewport, a dock önálló elrendezési sor.
Legalább 44 px-es alsó érintési célok. A kis zöld avatar pislog és röviden
fel-balra, fel-jobbra, oldalra vagy lefelé pillant; nincs köröző szemmozgás.
`prefers-reduced-motion` esetén az animáció leáll.

## Ellenőrzés

```bash
node --test docs/design_3.0/train-prototype/model.test.mjs
node --check docs/design_3.0/train-prototype/app.mjs
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
```

7 célzott állapotteszt. Böngészőben 38 paraméterezett út megnyitása **360 és
390 px-en**, vízszintes túlcsordulás nélkül, konzolhiba nélkül. A telefonkeret
384 px-es belső nézetének vizuális ellenőrzése. Kipróbálva: edzésindítás → szett
→ javítás → frissítés → folytatás → explicit lezárás → 560 kg-os összegzés és
zárójegyzet; futás 32 perc / 4,5 km mentése; heti időpont és tervnév módosítása;
gyakorlatkeresés, kedvenc és frissítés után is megmaradó jegyzet;
felkészülésből gyakorlatra, majd a valódi belépési helyre visszalépés.

## Források

- [Train: működés és §10 fájltérkép](../../features/train.md)
- [Codebase map](../../CODEMAP.md)
- [Fuel referencia](../fuel-prototype/README.md)
- [Design 2.0 assetek](../../design_2.0/assets/README.md)
- [Boop navigáció / PR #610](https://github.com/mrkuhne/mezo/pull/610)

Új külső kutatás nem történt. A prototípus helyi design-iteráció,
production bevezetési döntés nélkül.
