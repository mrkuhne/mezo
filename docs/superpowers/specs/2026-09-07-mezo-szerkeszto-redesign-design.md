# Mezociklus-szerkesztő redesign — egységes szerkesztő + vékony wizard (design 2.0)

**Dátum:** 2026-09-07 · **Státusz:** véglegesített design — prototípuson jóváhagyva, implementációra kész
**Előzmény:** `docs/features/train.md` §9 F7.2/F7.4 ("design first, dev issue after")
**Prototípus:** `docs/design_2.0/prototypes/mezo-szerkeszto.html` (a vizuális igazság; forrás:
`prototypes/src/mezo-szerkeszto-{head,body}.html`) · **Iterációs napló:**
`docs/design_2.0/2026-09-07-mezo-szerkeszto-design-iterations.md` · **Issue:** mezo-yty6

## Probléma

A mezociklus-készítő wizard 3. lépése és a mezo sablon-szerkesztő két különböző UI
ugyanarra a feladatra, és egyik sem design 2.0. Fő fájdalmak: átláthatatlan heti/napi
terhelés-kártyák, sok görgetés; clunky accordionos gyakorlat-lista (nyitogatás, nehéz
törlés, nem látszik a set/rep); rejtett "Finomhangolás"; magyarázat nélküli
zöld/sárga/piros jelzések; nem átnevezhető edzésnapok; nincs jelzés egymást követő
napok izomcsoport-ütközésére; a heti összesítőben nem látszik az emphasize/maintain/grow
besorolás és a rendezés esetleges.

## Döntések (a brainstorm elágazásai)

1. **Egy közös szerkesztő** (A): a wizard vékony interjúvá válik, a generálás eredménye
   ugyanabban az egységes szerkesztőben nyílik meg, amit a sablon-szerkesztés is használ.
2. **Kompakt terhelés-csempe + teljes oldal** (A, prototípuson pontosítva): a **Heti
   terhelés** csempe a szerkesztőn, a **Napi terhelés** csempe a nap-oldalon él;
   koppintásra mindkettő **teljes Mozaik-oldalt** nyit (a drawer-verzió elvetve —
   szűk volt a bontásnak).
3. **Inline inputos gyakorlat-kártyák** (A): accordion és stepper-gombok helyett mindig
   nyitott kártya közvetlen számbeviteli mezőkkel; a Finomhangolás szekció beolvad.
   Nem szettenkénti bontás (a modell gyakorlatonként egységes sémát tárol — YAGNI).
4. **Passzív izomütközés-jelzés** (A): borostyán jelzés + lint-sor, nem blokkol, nem
   rendez át. Generátor-oldali elkerülés külön bd-issue (nem része ennek a munkának).
5. **Egyképernyős interjú** (A): a 2 wizard-lépés egy görgethető, kártyás oldallá olvad.
6. **▲▼ átrendezés** (prototípuson): a gyakorlat-sorrendet nyílgombpár mozgatja
   (szélső irány letiltva), nem drag&drop.

## 1. Flow és információs architektúra

- **`/train/mesocycles/new`** — egyetlen interjú-oldal (Mozaik, arany tónus,
  a `meso-body.html` wizard-oldalából iterálva): kártyák — *Mikor* (heti napok chip-sor
  + hetek), *Cél* (szöveg/preset), *Fókusz* (`MusclePriorityPicker` élő heti-cél
  StatStrippel) — alul nagy CTA: **Program generálása**. Generálás után Huawei slide-in
  az egységes szerkesztőbe, **draft módban** (in-memory, page-state drill-in mintával).
- **`/train/mesocycles/templates/:id`** — ugyanaz az egységes szerkesztő, **sablon
  módban** (local-authoritative state + teljes-sablon PUT minden szerkesztésre,
  `musclePriorities`/`goalPreset` minden írásban). A régi `pghead-np` oldal megszűnik,
  a felület Mozaik-ra áll (a `train.nav.test.tsx` scaffold-pin tudatosan frissül).
- **Az egységes szerkesztő fentről le:**
  1. PageHead/Hero: szerkeszthető mezo-név, meta (hetek · split · futtatások).
  2. **Nap-csempesor: 1 sorban, balról jobbra scrollozható** DayTile-ok (fix ~124px
     szélesség, snap). Csempén: `nap · típus` eyebrow, nap neve, szett · ~perc,
     arányos izom-szín sáv, borostyán pötty ha a napot lint érinti. Koppintás →
     nap-szerkesztő slide-in.
  3. **Heti terhelés csempe** (teljes szélesség): heti összes szett + a 3 legnagyobb
     volumenű izom mini-gauge-a; koppintás → Heti terhelés oldal.
  4. Lint-sorok (ha van), majd a mód szerinti CTA-k.
- Draft és sablon mód közt csak a perzisztencia és a fejléc-CTA-k különböznek
  (draft: "Vázlat · még nincs mentve" eyebrow + "Mentés sablonként" / "Mentés + indítás";
  sablon: "Sablon · n× futtatva" + auto-mentés jelző + "Indítás ebből a sablonból");
  a szerkesztő-komponens egy.

## 2. Nap-szerkesztő és gyakorlat-kártyák

- **Nap-hero:** inline átnevezhető napnév (a `MesoEditor` meglévő `onRenameDay`
  mechanikája élesítve, minden napra) + "✎ koppints a névre az átnevezéshez" súgó,
  alatta `nap · szettek · ~perc · gyakorlatszám`.
- **Napi terhelés csempe** a hero alatt, a gyakorlat-lista **fölött** (10px térközzel):
  napi összes szett/perc + a 3 legnagyobb izom session-cap gauge-a; koppintás →
  Napi terhelés oldal.
- **Gyakorlat-kártya (mindig nyitva):**
  - Fejsor: izom-színű wash + bal oldali színcsík, clay ikon-korong, név + izom/szinergista
    alcím (+ opcionális cél-jegyzet), jobbra **▲▼** átrendezés (szélső irány letiltva)
    és **×** törlés (snackbar "Visszavonás"-sal).
  - Input-sor: **Szett · Rep min–max · Kg (üríthető, `auto` placeholder) · RIR** — natív
    `inputmode` mezők, spinner elrejtve; a FineTune-mezők ide olvadnak be.
  - Másodlagos sor: 🔥Failure/🌿Volume toggle + bemelegítő szett mező.
  - Kártya alján kontextus-sor: izomcsoport-hozzájárulás ("Mell +3 · Váll +1,5",
    szinergista fél szettel).
- **Render-fegyelem:** szerkesztéskor (átrendezés, törlés, hozzáadás, számbevitel) a
  nap-oldal **nem** renderelődik újra és a belépő choreográfia **nem** játszik újra —
  csak a kártyalista + a napi csempe frissül helyben. A `rise` stagger csak a nap első
  megnyitásakor fut. (Prototípuson ez konkrét hibaként jött vissza: "flashel és újratölt".)
- **Hozzáadás:** szaggatott "Gyakorlat hozzáadása" gomb, meglévő multi-add
  `ExercisePickerSheet`, defaultok az `exerciseDefaults`-ból.

## 3. Volumen-vizualizáció (zöld/sárga/piros helyett)

A UI nélkül maradt `muscleBudgets` motor (`logic/setBudget.ts`, MEV/MAV/MRV)
feltámasztása egy **zóna-sáv (gauge)** komponensben:

**Heti terhelés oldal** (`MozaikPage`, arany tónus):
- Hero: clay spot + count-up heti összes szett + "Heti terhelés · izmonként" + meta.
- StatStrip: `szett · W1` · `szett · csúcs` · `rámpázik` · `célon`.
- Egy **izom-washed poszter-kártya izomcsoportonként**, **csökkenő heti szettszám szerint**:
  - fejsor: izom-pill + **tier-chip** (Emphasize / Grow / Maintain) + frekvencia-chip
    ("3 nap / hét");
  - nagy számsor: `13,5 ▲ 22 cél` — **irány-nyíl** a tier-cél felé (Maintain→MV,
    Grow→MAV, Emphasize→MRV), mellette rövid státusz-mondat
    ("▲ +2 / hét · 8,5 a MRV-célig");
  - **zóna-sáv**: MEV–MAV és MAV–MRV zóna-sávozás, MV/MEV/MAV/MRV vonalak feliratozva,
    cél-vonal, izom-színű marker az aktuális értéken. **Százalék nem jelenik meg**;
  - **rámpa-spark**: W1→deload oszlopsor (a mostani hét arany, a deload csíkos);
  - koppintásra kibomlik a **hozzájárulás-lebontás**: naponként a gyakorlatok
    szett-hozzájárulással (szinergista fél szettel).
- Alul lint-sorok: egymást követő napok izomütközése, majd a csúcshét-ellenőrzés
  (borostyán észrevétel vagy zöld "rendben") — `structureLint` / `sessionCapWarnings` /
  `peakWeekFit` logikákra kötve.

**Napi terhelés oldal** (`MozaikPage`, a nap típusa szerinti tónus):
- Hero: count-up napi szettszám + `nap · név`; StatStrip: szett · perc · izomcsoport ·
  plafon-közeli izmok száma.
- Izomcsoportonként poszter-kártya: aktuális szett `/ ~8` session-cap ellen, felfutó
  töltés (plafon-közelben borostyán gradiens + "közel a plafonhoz" chip), alatta a
  hozzájáruló gyakorlatok chipjei.
- Záró coach-sor: a plafon nem tiltás, a modell átosztást javasol.

**Kompakt csempék** (a fenti két oldal belépői): összes szett nagy számmal + a 3
legnagyobb izom mini-gauge-a; a szerkesztő-csempénél lint esetén borostyán jelzés.

## 3.a Mozgás és élő visszajelzés (kötelező, nem díszítés)

- **Count-up** minden hero-főszámon és a csempék nagy számán (`useCountUp` /
  `useCountUpOnChange`).
- **Felfutó sávok**: a nap-csempék izom-railje staggerrel skálázódik, a gauge-ok és
  session-cap sávok szélessége animált átmenettel áll be.
- **Staggerelt `rise` belépés** (`EntranceGroup`) minden oldalon, egyszer — nem
  ismétlődik szerkesztéskor (lásd Render-fegyelem).
- **Lélegző hero-spot** és **pulzáló zóna-marker**.
- Minden animáció `prefers-reduced-motion`-tisztelő (a prototípus reduced-ágai a minta).

## 4. Prototípus — a vizuális igazság

`docs/design_2.0/prototypes/mezo-szerkeszto.html` (3 iterációs kör után jóváhagyva).
Lefedi: belépők → interjú → generálás-átmenet → egységes szerkesztő → horizontális
nap-csempesor → nap-szerkesztő → Napi és Heti terhelés teljes oldalak → zóna-sávok
lebontással → lint-demó (a H–K Váll-ütközés élőben tűnik el, ha törlöd a K-nap
oldalemelését) → snackbar-visszavonás. Az implementáció ehhez igazodik; ahol a spec
szövege és a prototípus eltér, a **prototípus dönt**.

Az iterációk során lezárt kérdések (napló: `docs/design_2.0/2026-09-07-mezo-szerkeszto-design-iterations.md`):
drawer → teljes oldal; napi csempe a nap-oldalra; drag&drop → ▲▼; input-spinner elrejtése;
villanásmentes szerkesztés; élő animációk.

## Scope / non-goals

- Backend/contract (`api/feature/train/train.yml`) nem változik.
- Nem cél: szettenkénti szerkesztés, gyakorlat-drag&drop (▲▼ váltotta ki),
  nap-átrendezés, egy-koppintásos ütközés-javítás, generátor-oldali ütközés-elkerülés
  (külön bd-issue), in-cycle tier-szerkesztés.
- A futó mezo napi szerkesztője (`MesoDayPage`/`MesoExercises`) csak annyiban érintett,
  hogy a gyakorlat-kártya komponenst később átveheti — e munka nem nyúl hozzá.

## Prior art

- **RP Hypertrophy** — hét-rács napokkal, izomcsoport-slot mint építőelem; napcímkék
  szerkeszthetők. Átvéve: nap-központú hét-nézet csempesorként. Elvetve: kézi
  gyakorlat-tologatás nap-átrendezéshez.
  https://hypertrophy.zendesk.com/hc/en-us/articles/32430129362327-Where-to-start
- **Hevy Coach** — élő összesítő panel (szett/izom-eloszlás) a szerkesztő mellett.
  Átvéve: élő volumen-visszajelzés; mobilon kompakt csempévé csukva, a teljes bontás
  saját oldalon.
  https://hevycoach.com/features/workout-builder/
- **Liftosaur** — traffic-light szettszám irány-nyíllal + hozzájárulás-lebontás +
  frekvencia. Átvéve: ez a zóna-sáv fő mintája.
  https://www.liftosaur.com/blog/posts/launched-workout-planner/
- **Alpha Progression** — vékony interjú-wizard, kimenete draft az egyetlen közös
  szerkesztőben. Átvéve: a teljes flow-modell.
  https://alphaprogression.com/en
- **Hevy (consumer)** — long-press drag, overflow/swipe törlés, közös sor-komponens
  builder/logging közt. Átvéve: a közös sor-komponens elve. Elvetve: a drag — kis
  kártyáknál a ▲▼ pontosabb (prototípus-visszajelzés).
  https://www.hevyapp.com/features/gym-routines/
- Egymást követő napok izomütközés-jelzésére nincs látható prior art — saját minta.

## Codebase terrain

- **Wizard:** `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` +
  `wizard/wizardState.ts` (in-memory draft, `activeDay` page-state drill-in),
  `wizard/StepWhen.tsx`, `wizard/StepFocus.tsx`, `wizard/StepProgram.tsx`,
  `wizard/DayTile.tsx` + `wizard/dayTiles.ts`, `wizard/ProgramDayView.tsx`.
- **Sablon-szerkesztő:** `pages/MesoTemplateEditorPage.tsx` — pre-redesign `pghead-np`;
  teljes-sablon PUT idióma (`toUpsert` minden íráskor `musclePriorities`-szel, válasz
  nem re-seedelt, `TemplateDayEditor` `template.id`-ra kulcsolva).
- **Közös mag:** mindkettő a `components/MesoEditor.tsx`-t rendereli (`weekDays` prop
  fegyelem: egynapos nézet is a teljes hetet kapja a hét-szintű matekhoz). Harmadik
  testvér: `pages/MesoDayPage.tsx` → `components/MesoExercises.tsx` (nem érintett).
- **Terhelés-kártyák ma:** `MesoEditorHero.tsx`, `DayBreakdownCard.tsx`,
  `WeeklyBandsCard.tsx` (százalék-tilalom innen öröklődik).
- **Alvó képességek:** `logic/setBudget.ts:134` `muscleBudgets`/`BudgetLevel`
  (tesztelt, consumer nélkül — a zóna-sáv erre épül); `MesoEditor.tsx` `onRenameDay`
  (bekötetlen, ma csak `custom` napra).
- **Logikák:** `logic/mesoPlan.ts` (split/hetek/ceiling), `logic/weeklyBands.ts`,
  `logic/structureLint.ts`, `logic/sessionLength.ts`, `logic/peakWeekFit.ts`,
  `logic/musclePriorities.ts` (`tierTargetOf`, `EMPHASIZE_CAP=2`),
  `logic/muscleColors.ts`.
- **UI-kit:** `shared/ui/mozaik` (`Tile`/`Mosaic`/`StatStrip`/`MozaikPage`/
  `CollapsibleStrip`, `EntranceGroup`, count-up hookok, arrival/slide-in),
  `shared/ui/clay` (`ClayIcon`/`ClaySpot` — soha emoji). Gauge-ok feature-szintűek
  (`VolumeArcChart`, `ZoneTrack` stb.).
- **Prototípus-ősök:** `docs/design_2.0/prototypes/src/meso-body.html` (#page-wizard),
  `prototypes/mezociklus.html`, `prototypes/rutin-epito.html`.
- **Csapdák:** `prototypeCssStructure.test.ts` a 9k soros `prototype.css`-t parsolja;
  visual goldens (`meso-hub`, `meso-week`) közvetve törhetnek; `train.nav.test.tsx`
  scaffold-pin; `VITE_USE_MOCK` unset = mock mód, mindkét mód futtatandó; `pnpm test`
  `--` utáni fájlszűrő nem szűkít; CODEMAP-frissesség gate; teljes-sablon PUT
  láb-lövés (`musclePriorities` mindig).
