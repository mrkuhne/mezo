# Mezociklus-szerkesztő redesign — egységes szerkesztő + vékony wizard (design 2.0)

**Dátum:** 2026-09-07 · **Státusz:** jóváhagyott design, prototípus-fázis előtt
**Előzmény:** `docs/features/train.md` §9 F7.2/F7.4 ("design first, dev issue after")

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
2. **Kompakt terhelés-csempék + drawer** (A): a fő nézeten kis "Mai" és "Heti" csempe,
   koppintásra alsó drawer a teljes bontással.
3. **Inline inputos gyakorlat-kártyák** (A): accordion és stepper-gombok helyett mindig
   nyitott kártya közvetlen számbeviteli mezőkkel; a Finomhangolás szekció beolvad.
   Nem szettenkénti bontás (a modell gyakorlatonként egységes sémát tárol — YAGNI).
4. **Passzív izomütközés-jelzés** (A): borostyán jelzés + lint-sor, nem blokkol, nem
   rendez át. Generátor-oldali elkerülés külön bd-issue (nem része ennek a munkának).
5. **Egyképernyős interjú** (A): a 2 wizard-lépés egy görgethető, kártyás oldallá olvad.

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
  2. **Nap-csempesor: 1 sorban, balról jobbra scrollozható** DayTile-ok. Csempén:
     nap neve, szett · ~perc, izom-szín sáv, állapot/lint-pötty. Koppintás → nap-szerkesztő
     slide-in.
  3. Két kompakt terhelés-csempe egymás mellett: **Mai** (aktív nap) és **Heti** —
     koppintásra alsó drawer.
- Draft és sablon mód közt csak a perzisztencia és a fejléc-CTA-k különböznek
  ("Mentés sablonként / Indítás" vs. automata mentés); a szerkesztő-komponens egy.

## 2. Nap-szerkesztő és gyakorlat-kártyák

- **Nap-hero:** inline átnevezhető napnév (a `MesoEditor` meglévő `onRenameDay`
  mechanikája élesítve, minden napra), alatta szettek · ~perc · gyakorlatszám
  számfelfutással; session-cap/ütközés esetén borostyán jelzés itt és a csempén.
- **Gyakorlat-kártya (mindig nyitva):**
  - Fejsor: izom-színű wash-csík + clay ikon, név, jobbra **×** törlés (snackbar
    "Visszavonás"-sal) és drag-fogantyú (long-press, meglévő `SortableList`).
  - Input-sor: **Szett · Rep min–max · Kg (üríthető) · RIR** — natív
    `inputmode="numeric"` mezők, a FineTune-mezők ide olvadnak be.
  - Másodlagos sor: 🔥Failure/🌿Volume toggle + bemelegítő szett szám.
  - Kártya alján kontextus-sor: izomcsoport-hozzájárulás ("Mell +3 · Tricepsz +1,5").
- **Hozzáadás:** szaggatott "Gyakorlat hozzáadása" gomb, meglévő multi-add
  `ExercisePickerSheet`, defaultok az `exerciseDefaults`-ból.
- **Mai terhelés drawer:** izmonkénti zóna-sávok session-cap ellen, gyakorlat-szintű
  lebontással.

## 3. Volumen-vizualizáció (zöld/sárga/piros helyett)

A UI nélkül maradt `muscleBudgets` motor (`logic/setBudget.ts`, MEV/MAV/MRV)
feltámasztása egy **zóna-sáv (gauge)** komponensben:

- Heti drawer: egy sor = egy izomcsoport, **csökkenő heti szettszám szerint rendezve**.
  Sor: izom-színű clay ikon + név, **tier-chip** (Emphasize / Grow / Maintain), zóna-sáv.
- Zóna-sáv: halvány sávozás (MEV alatt / MEV–MAV / MAV–MRV / MRV felett), töltés +
  marker az aktuális heti szettszámmal, **irány-nyíl** a tier-cél felé
  (Maintain→MEV, Grow→MAV, Emphasize→MRV), pl. "12 ▲ 16". **Százalék nem jelenik meg**
  (meglévő szabály marad).
- Koppintás a sorra → hozzájárulás-lebontás: napok, gyakorlatok, szettek (szinergista
  fél szettel), plusz frekvencia ("3 nap/hét").
- Kompakt heti csempe: a 3–4 legnagyobb volumenű izom mini-gauge-a + összes heti szett;
  lint esetén borostyán pötty.
- Lint-sorok a drawer alján: egymást követő napok izomütközése, session-cap, peak-week
  idő — a meglévő `structureLint` / `sessionCapWarnings` / `peakWeekFit` logikákra kötve.
- Ugyanez a zóna-sáv komponens szolgálja ki a napi drawert is (session-cap ellen).

## 4. Prototípus és iterációs menet

- Új interaktív HTML: **`docs/design_2.0/prototypes/mezo-szerkeszto.html`**, a
  `meso-body.html` + `rutin-epito.html` mintáiból, a prototípus-készlet CSS-nyelvén,
  mock adatokkal (életszerű 5 napos hypertrophy split). Lefedi: interjú → generálás
  átmenet → egységes szerkesztő → horizontális nap-csempesor → nap-szerkesztő slide-in →
  mindkét drawer → zóna-sávok lebontással → lint-demó (ütköző kedd–szerda váll).
- Vizuális iteráció az app-beli böngészőben `file://`-ról, döntésnapló:
  `docs/design_2.0/2026-09-07-mezo-szerkeszto-design-iterations.md`.
- Megállapodás után e spec frissül a véglegesre, majd `writing-plans` (ott: `mz-*`
  osztályok a `prototype.css`-ben, golden/nav-teszt frissítések, CODEMAP,
  `train.md` §2/§10).

## Scope / non-goals

- Backend/contract (`api/feature/train/train.yml`) nem változik.
- Nem cél: szettenkénti szerkesztés, nap-átrendezés drag-and-droppal, egy-koppintásos
  ütközés-javítás, generátor-oldali ütközés-elkerülés (külön bd-issue), in-cycle
  tier-szerkesztés.
- A futó mezo napi szerkesztője (`MesoDayPage`/`MesoExercises`) csak annyiban érintett,
  hogy a gyakorlat-kártya komponenst később átveheti — e munka nem nyúl hozzá.

## Prior art

- **RP Hypertrophy** — hét-rács napokkal, izomcsoport-slot mint építőelem; napcímkék
  szerkeszthetők. Átvéve: nap-központú hét-nézet csempesorként. Elvetve: kézi
  gyakorlat-tologatás nap-átrendezéshez.
  https://hypertrophy.zendesk.com/hc/en-us/articles/32430129362327-Where-to-start
- **Hevy Coach** — élő összesítő panel (szett/izom-eloszlás) a szerkesztő mellett.
  Átvéve: élő volumen-visszajelzés; mobilon csempévé/drawerré csukva.
  https://hevycoach.com/features/workout-builder/
- **Liftosaur** — traffic-light szettszám irány-nyíllal + hozzájárulás-lebontás +
  frekvencia. Átvéve: ez a zóna-sáv fő mintája.
  https://www.liftosaur.com/blog/posts/launched-workout-planner/
- **Alpha Progression** — vékony interjú-wizard, kimenete draft az egyetlen közös
  szerkesztőben. Átvéve: a teljes flow-modell.
  https://alphaprogression.com/en
- **Hevy (consumer)** — long-press drag, overflow/swipe törlés, közös sor-komponens
  builder/logging közt. Átvéve: mobil affordanciák.
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
