---
title: Meso feature remnants — handoff
type: handoff
status: open
created: 2026-08-25
issues: [mezo-yqpf, mezo-ltk0, mezo-szsi, mezo-dz9c]
related:
  - 2026-08-24-volume-engine-weekly-distribution-design.md
  - 2026-08-24-meso-goal-preset-and-muscle-priorities-design.md
---

# Meso feature remnants — handoff

A meso-tervezés három fő szelete él a mainen: a volumen-motor heti elosztása +
`countsTowardVolume` (mezo-gbo7), a `goalPreset` + séma-vezérelt picker-kitöltés
(mezo-dq60), és az Emphasize/Grow/Maintain tierek (mezo-3m5m, PR #256). Ez a
dokumentum a maradékot adja át — mind trackelt bd issue, ez csak a kontextus
egy helyen. Fontossági sorrendben; a négy tétel független egymástól, bármelyik
külön ágon vihető.

## 1. mezo-yqpf (P2) — countsForVolume a programFit-be és a MesoEditor highlightba

Az utolsó hely, ahová a volumen-mentesség nem ér el. Literális `type !== 'plyo'`
ellenőrzés maradt a `countsForVolume(ex)` predikátum (`setBudget.ts`) helyett:

- `frontend/src/features/train/logic/programFit.ts` — ~31, 53, 151, 162
- `frontend/src/features/train/components/MesoEditor.tsx` — ~213 (over-budget
  kiemelés; az `overGroups` maga már a helyes `muscleBudgets`-ből jön, így a
  hiba kozmetikai: egy hidratált 45° Back Extension piros keretet kap)

Ugyanitt: `programFit.ts:24` a hiányzó plyo-sávot másképp oldja fel (csendben
az izolációs plafont adja), mint a `structureLint` (kihagyja az R2-t) — két
politika egy hiányzó kulcsra, válasszatok egyet. A `fitProgram` egyetlen hívási
helye a `planner.ts:16` (generált napok, flag nélkül), ezért ma a két forma
ekvivalens ott — a fix a jövőt védi, nem élő bugot javít.

## 2. mezo-ltk0 (P3) — tier-review parked itemek

A mezo-3m5m záró review-jának nem-blokkoló tételei (az eredeti issue, mezo-jtpj,
egy dolt-szinkronban elveszett; mezo-ltk0 az újra-felvett példány):

1. `MusclePriorityPicker` segmented gombok minHeight 36px — a DS 44px-es
   touch-target padlója alatt (prototype.css `.segtab`). Akadálymentesség.
2. `PUT /mesocycles/{id}/muscle-priorities` és a template upsert tetszőleges
   tier-stringet/izomkulcsot elfogad, ami csendben Grow-ra oldódik. Egy olcsó
   400 ismeretlen tier-értékre kliens-bugokat tenne láthatóvá.
3. Kozmetika: `trainHooks.toMesocycle` a `musclePriorities`-t blanket `...r`
   spread + cast-tal viszi, típus-szűkítés nélkül (a `toMesoTemplate` szűkít).
4. A wizard Fókusz lépés címe duplán renderel (PageTitle + kártya-fejléc) —
   terv szerint szándékos volt, product-copy revisit.

## 3. mezo-szsi (P3) — dq60-utómunka

A goalPreset/autofill záró review-jának follow-upjai. Felhasználó-látható fele:

1. `CustomWorkoutBuilderPage` `DEFAULT_RECIPE`-je (~:19): egy ott felvett PLYO
   8-12 repet és bemelegítő szettet kap, míg a mezo-pickerek 3×5/0-t adnak —
   érdemes `libraryToGymExercise(item, null)`-ra kötni.
2. `warmupSuggest` bodyweight-heurisztika (`repMax >= 15 && anchorWeightKg ==
   null` → 0 bemelegítés): cut-prep/recovery preset alatt egy súlyzós 12-15
   repes izoláció is 0 bemelegítést kap. Valódi heurisztika-bug, amit a
   preset-sémák tettek elérhetővé; `train.md` már dokumentálja.

Tesztrések: a goal_preset backfill 6 CASE-ágából csak a hypertrophy fedett;
`applyUpsert` goalPreset-null-ra-törlése nincs pinelve; plyo az
`addExerciseWithDefaults`-on át (0 bemelegítés) + `exerciseCount`-növelés
nincs pinelve; a `catalogId`-conditional-spread unit-pin kiesett; redundáns
`countsTowardVolume: false` a picker-plyo-n (a generátor-plyo nem hordozza —
origin szerint eltérő checkbox-állapot).

## 4. mezo-dz9c (P3) — volumen-motor higiénia

1. Custom / nem-mezo napok most a sablon `workingSets`-ét tartják (helyesebb,
   de jelöletlen viselkedésváltás) — teszt kell.
2. `VolumeProgressionService.lastWeekSignals` guard-teszt csak a
   `loggedLastWeek` felét pinneli; a grind-ág a fixture-ben soha nem tüzel.
3. A base-1 padló túllövése heti léptékben könnyen elérhető (5 gyakorlat,
   `currentSets=4` → 5) — nincs pinelve.
4. `getToday` háromszor kéri le a mezo session-listáját (ClosingBlockService,
   `findPlannedTemplateForDate`, `weekTemplateExercises`) — egy megosztott fetch.
5. `weekTemplateExercises` duplikálja a `seedBaselines` template-id betöltőjét.

## Zajforrások (nem feature-részek, de a lokális kaput piszkítják)

- `mezo-cy6d`: `CompanionToolsRenderIT` gyógyszer-ciklus teszt bukik a
  00:00–02:00 CEST ablakban (TZ-eltérés; az érintetlen mainen bizonyított).
- `mezo-0p2q`: `ActiveWorkoutPage.test.tsx` timeout CPU-terhelés alatt,
  izoláltan zöld.

## Házirend-emlékeztetők a vivő sessionnek

- `bd update <id> --claim` mielőtt nekiállsz; egy issue = egy `feat/` ág.
- Backend tesztek: `-Dmezo.test.use-testcontainers=true` (a fix-DB mód hazudik).
- FE: mindkét mód kell (`pnpm test` ÉS `VITE_USE_MOCK=false pnpm test`).
- Kontraktus-változásnál: `api/generate` merge ELŐBB, aztán frontend
  `pnpm generate:api`.
- A repo Jackson 3-on van (`tools.jackson.*`); `ownerId()` per-osztály helper
  a train IT-kben, nem öröklődik.
