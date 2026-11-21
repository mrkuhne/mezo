# Rest pause technique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fifth owner-pickable set technique `rest_pause` — 20 reps, then four mini-sets of 5 after a 10 s rest, fixed — that pins its exercise to 20 reps.

**Architecture:** Reuses the myo leg machinery (`MINI` legs) with `minReps = null`, so the player never auto-stops. The server pins the rep range in `ExerciseStyler` after stamping, on every save path; the iOS draft mirrors it on pick.

**Tech Stack:** Spring Boot 3 / Java 21 / Liquibase / OpenAPI generator; SwiftUI + BoopKit (Swift Testing).

**Spec:** `docs/superpowers/specs/2026-11-20-rest-pause-technique-design.md` · bd `mezo-r36n9.125`

## Global Constraints
- Wire value `rest_pause`; visible name „Rest pause”; config `main-reps: 20, main-reserve: 0, mini-reps: 5, mini-rest-sec: 10, minis: 4`.
- Owner pick only: `TechniquePlanner`, `TechniqueRecommender`, `TechniqueMerger` / `TechniqueLlmAdapter` never produce it.
- Same eligibility as myo (`TechniqueRules`: stable + judged). Myo unchanged.
- No bare `?` in the Liquibase SQL.

## Review Focus
- An old client (or the frozen web) reads `rest_pause` → iOS `SetTechnique(wire:)` is lenient; server enum must accept it everywhere it parses (`Technique.fromWire`).
- A swapped exercise that keeps rest_pause must stay at 20 — covered by the styler pin running on `styleRows`.
- Block style change (`restampRows`) must not stamp the 20 away — pin runs there too (test in Task 2).
- A logged rest_pause set with 4 mini legs + the challenge's partials leg is accepted (`allowedLegKinds`).
- Short mini-set (e.g. 3 reps) does not end the run in the player (Task 4 test).

---

### Task 1: Backend technique value, config, prescription, DB

**Files:** `feature/train/service/Technique.java`, `TechniqueRules.java` (`allowedLegKinds`), `TechniquePrescriber.java`,
`config/TrainTechniqueProperties.java` (+ `record RestPause(mainReps, mainReserve, miniReps, miniRestSec, minis)`),
`application.yml` (`rest-pause:` beside `myo:`), `api/feature/train/train.yml` enum → `npm run generate:api`,
Liquibase `script/202611211100_mezo-r36n9.125_rest_pause.sql` + master entry (drop/re-add both check constraints),
entity/json comments. Tests: `TechniquePrescriberTest`, `TechniqueRulesTest`, `TrainTechniquePropertiesIT`.

- [ ] Test `restPauseIsTwentyThenFourFixedMinis`: prescription of a 3-set exercise with REST_PAUSE → last working set
  `targetReps 20`, `targetRIR 0`, 4 legs each `kind MINI, reps 5, restBeforeSec 10, minReps null, toFailure false`,
  weight = main weight; with `challenge=true` a 5th `PARTIALS` leg.
- [ ] Test `allowedLegKinds(REST_PAUSE) == {MINI}`; properties IT binds `restPause()` values.
- [ ] Implement; run `./mvnw -q test -Dtest='TechniquePrescriberTest,TechniqueRulesTest'` → PASS.

### Task 2: Server pins the exercise to 20 reps

**Files:** `ExerciseStyler.java` — `static GymExerciseJson pinRestPause(GymExerciseJson e, int reps)`: when
`technique == "rest_pause"` returns `repMin = repMax = reps` and `overrides ∪ {"repRange"}`; otherwise `e` unchanged.
Applied to the stamp result in `styleTemplateDays`, `styleRows`, `restampRows` (inject `TrainTechniqueProperties`,
`reps = restPause().mainReps()`). Tests: `ExerciseStylerTest` (unit, pure) + `ExerciseTechniqueApiIT` case.

- [ ] Unit test: `pinRestPause` on rest_pause 8–12 → 20–20 with `repRange`; on myo → untouched.
- [ ] IT `restPausePinsTheRowToTwentyReps`: day edit saving a stable exercise with `technique rest_pause`, repMin 8 →
  stored row 20/20; template save same.
- [ ] Implement; run the two tests → PASS.

### Task 3: iOS model + copy + picker

**Files:** `BoopCore/Train/BlockDraft.swift` (`case restPause = "rest_pause"`, name „Rest pause”, about
„20 ismétlés, aztán 10 mp pihenő és 5 ismétlés, ezt négyszer. Fix menet, nem áll le magától.”, steps
[„20 ismétlés”, „10 mp pihenő”, „5 ismétlés, négyszer”]; `allowedTechniques` adds `.restPause` after `.myo`;
`setTechnique` pins `repMin = repMax = 20` + `overrides.insert("repRange")` for `.restPause`),
`openapi.yaml` (`scripts/sync-openapi.sh`), the three `mark` switches (`.restPause: .myo`),
`PlayerTechnique.swift` (`case .myo, .restPause:` lines branch), `PreviewTransport.swift` if exhaustive.
Tests: `BlockDraftEditTests`.

- [ ] Test `pickingRestPauseSetsTwentyReps`: draft row 8–12, `setTechnique(.restPause)` → 20/20, overrides ∋ repRange.
- [ ] Implement; `swift test --filter BlockDraftEditTests` in `ios/BoopKit` → PASS.

### Task 4: Player runs the fixed set

**Files:** test only, `WorkoutTechniqueTests.swift` (`WorkoutSession.logLeg` already stops only when `minReps` set).

- [ ] Test `restPauseDoesNotStopOnAShortMiniSet`: rest_pause set with 4 minis (minReps nil): main 20, legs 5, 3, 5 →
  still running, 4th leg logs, set complete with 4 legs; `endTechnique()` mid-way logs what was done.
- [ ] Run → PASS (fix `WorkoutSession` only if it fails).

### Task 5: Gates, docs, ship
- [ ] Backend: focused ITs + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true`; iOS `xcodebuild test` BoopKit + Boop.
- [ ] `node scripts/gen-codemap.mjs`; docs: `docs/boop-handbook/07-edzes/15-technikak.md`, `docs/features/train.md`,
  `docs/features/boop-ios.md`, `_jegyek.json`, `_kiadasok.json`; `node scripts/lint-docs.mjs` 0/0.
- [ ] Merge `--no-ff` to main, push, deploy green, install on phone, Notion sync `check` exit 0, tracker backup.
