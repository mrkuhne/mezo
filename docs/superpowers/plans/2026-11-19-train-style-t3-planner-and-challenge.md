# Train style & techniques — T3: the planner and the challenge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a block that opts in (it has a `trainingStyle` **and** `techniquesEnabled`), the engine itself decides
where the intensity techniques go (which exercise gets a rest-drop or a myo set, how many per day and per muscle,
from week 3 to the last loading week) and which exercise is each day's **challenge** (lengthened partials right after
its last set, from week 1). The block builder sees the plan week by week through the evaluator; during the run the
changes arrive as lines of the weekly proposal (auto mode applies them), and a muscle that stopped moving gets one
offer (a technique, a rep-range change, or a one-week reduction). The owner's own picks are never moved. No AI (T4).

**Architecture:** One pure, config-driven `TechniquePlanner` decides a week's assignment from a block snapshot; a thin
`TechniquePlanService` builds that snapshot (template rows or a draft, catalog attributes incl. equipment, tiers,
sport groups + sport weekdays, deficit) and is the single caller for the three readers: the evaluator (draft + run),
run start (week-1 challenges) and the weekly proposal (week ≥ 2 lines). The weekly proposal turns the difference
between the stored rows and the planner's week into `technique` lines (a planner technique replaces one straight set:
sets − 1 / + 1) and a pure `StallOffers` turns a stalled muscle into at most one offer. Prescription is untouched
(T2's `TechniquePrescriber` already prescribes stored picks); `getToday` only adds the sport-day suppression.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, JUnit 5 + Testcontainers; contract-first OpenAPI
(`api/feature/train/train.yml`, `train-week-proposal.yml` → `api/openapi.yml` → generated DTOs + `frontend/src/data/_client/api.gen.ts`).

**Spec:** `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` §6.5 rules 1–7 + "where the result
goes", §6.6, §6.7.4, §7 slice T3, §11 (Q1 all-out never gains sets, Q2 sets − 1, Q4 owner picks, Q5 stall rule, Q6
challenge wins). bd `mezo-r36n9.81`, epic `mezo-r36n9`. Builds on T1 (`2026-11-18-train-style-t1-style-and-progression.md`)
and T2 (`2026-11-18-train-style-t2-technique-model.md`). T2's open notes on `.81` are folded in (Task 7).

## Decisions this plan makes

| Question | Decision |
|---|---|
| Who gets the planner | Only a run / draft with **`trainingStyle != null` and `techniquesEnabled = true`**. Everything else — every web block and the owner's run in flight (unstyled, flag off) — is planned, proposed and prescribed exactly as today: the planner is not even called. |
| Where planner picks live | On the **run's exercise rows** (T2 columns) with `technique_source = planner`. The template document keeps only the owner's picks. Week 1: run start writes the week-1 challenges. Week ≥ 2: the weekly proposal's lines. A rerun re-plans at its own start. |
| Rule 1 — eligible | `stable`, counts toward volume, the **last counting exercise of its coarse muscle group that day**, `workingSets ≥ 2` (it gives one straight set back), not the day's challenge, not all-out effective style (rule 6), the day's cap weight not already over a cap. |
| Rule 2 — weeks | Techniques from `start-week` (3) to the last non-Deload week. **In a Deload week the proposal emits no technique lines** — stored picks stay and T2's prescriber already prescribes the deload plainly, so nothing flips off and back on. |
| Rule 3 — tiers | `emphasize` (Hangsúly) groups first, then `grow` (Építés) while allowance remains, `maintain` (Tartás) never. Inside a tier: later in the day first ("late in the session"), then day order. |
| Rule 4 — allowance | Per training day at most `max-per-day` (2) techniques, the challenge not counted; **1** in a deficit or when the plan day's weekday has a sport slot. A sport-loaded group on a sport day gets none. Plus **at most `max-per-muscle-week` (2) technique exercises per muscle group per week** (a muscle trained three times gets its technique on its two last days of the week) — the "per muscle and week" limit; config. |
| Rule 5 — which | Isolation with rep max ≥ `myo-rep-top` (15) → `myo`; otherwise equipment `machine` / `cable` → `rest_drop` (the owner's variant); otherwise (e.g. a stable dumbbell compound) → not eligible. `drop` and `partials` are never chosen by the planner. Needs `equipment` added to `CatalogAttributes.Attrs` (same batched read). |
| Rule 7 — owner picks | A row with `technique_source = owner` (or `ai`, reserved for T4) is never touched by a planner line; its technique counts against the day's and the muscle's allowance first. Over the allowance → an evaluator warning `owner_over_allowance`, nothing removed. |
| The challenge (§6.6) | Per training day (not in a Deload week): an owner challenge wins; otherwise the day's **first** counting exercise that is `stable` + `lengthened_friendly`, preferring `emphasize`, then `grow`, then the rest; a sport-loaded group on a sport day is skipped; none → no challenge that day (evaluator warning `no_challenge_candidate`). Placed **before** techniques; the challenge row carries no other technique (Q6). It keeps its set count (it is an add-on of a few partial reps), weighs 2 against the caps and is never the thing removed for a cap. |
| sets − 1 (Q2) | A planner technique line: `workingSets` from → from − 1, technique none → X. Removing a planner technique: technique X → none and sets + 1 when the exercise and session caps allow (else just the technique goes). All-out exercises are never given a set (Q1). Applied only while the row still holds the line's `from` sets and technique (else `kept`, his edit stands — same rule as set lines). |
| Proposal line shape | `kind: technique` (new enum value) with new optional fields `fromTechnique` / `toTechnique` (Technique enum) and `challenge` (bool, a challenge move: technique `partials` ⇄ `none`, sets unchanged); `from`/`to` = working sets before/after. `kind: rep_range` with `fromRepMin/fromRepMax/toRepMin/toRepMax`, `from`/`to` = rep max. Reasons gain `technique_week`, `emphasis`, `deficit_allowance`, `sport_day`, `challenge`, `ai_suggested` (unused until T4). Lines come after the set lines and before the weight/rep previews. Applied in auto mode by `applySetLine` (now dispatching by kind); manual mode decides them like any line. |
| Order inside one weekly build | Set decisions (incl. deload restore) on the working copy → stall offers → planner on the working copy (so its `sets − 1` and allowance see this week's numbers) → load previews. |
| Stall offers (§6.7.4, Q5) | For each stalled group (T1's detector, **deload-phase weeks now skipped in its window** — T1 note), outside a Deload week, the **first** that applies: (a) a planner technique on the group's last exercise of a day if rule 1 eligible and the allowance has room (reason `stalled`); (b) a `rep_range` line on that exercise: one step along heavy ↔ balanced ↔ volume away from where it stalled (heavy → balanced, volume → balanced, balanced → volume), the new range from `StyleTable` for the exercise's class, written to `rep_min`/`rep_max` with `repRange` added to the row's `overrides` so later stamps keep it; not for all-out or an owner `repRange` override; (c) only when the group's decision was HOLD/none and the tier is not `maintain`: a one-week reduction, `SetSlots.pickDown` −1, recorded in the proposal's `restore` so the next week gives it back through the existing restore path (reason `deload_restore` on the way back). |
| Evaluator output | `MesoPlanEvaluateRequest` gains optional `trainingStyle`, `techniquesEnabled` (closes T2 note 4: the draft's cap weight). Each `VolumePathWeek` gains `techniques[]` {dayIndex, exerciseIndex, technique, source} and `challenges[]` {dayIndex, exerciseIndex}; the response gains `techniqueWarnings[]` {code, dayIndex, exerciseIndex?}. Empty when the block does not opt in. The run evaluation shows the **stored** picks for the current week and the planner's projection for later weeks. |
| Prescription | Unchanged except T2 note 1: on a day whose real date's weekday has a sport slot, a challenge (any source) and a **planner** technique on a sport-loaded group are suppressed in `getToday` (echo cleared, stored row untouched). An owner technique stands (Q4). |
| T2 notes 2–3 | A swap keeps `planner` as the source when the technique survives (no relabel to owner). `RirCalibrationDetector` / `CharacterSignalReads` skip working sets that carry a technique (now reachable without a manual pick). |
| Tunables | `mezo.train.technique.planner`: `start-week 3`, `max-per-day 2`, `max-per-day-reduced 1`, `max-per-muscle-week 2`, `myo-rep-top 15` — in `TrainTechniqueProperties`. **No change** to `VolumeProperties` / `mezo.volume`, no Liquibase change, no `ResetDatabase` change. |

## Global Constraints

- Contract changes additive and optional; the two enums that gain values (`WeekProposalLine.kind`,
  `WeekProposalReason`) are read only by Boop (announced on bd `.83` and to the `boop-blokk-screens` session before the
  contract commit). The frozen web client sends none of the new fields; only `api.gen.ts` regenerates.
- Owner picks (`technique_source = owner`) are never written by any T3 path.
- `SetRecommendationService`, `ProgressionDecider`, `TechniquePrescriber` are not edited.
- The weekly engine must never block `getToday`: a planner failure inside the weekly build is caught and the week's
  proposal is built without technique lines (logged), like the stall detector.
- ArchUnit: no raw generic exceptions outside techcore; layer subpackages; pure units in `service/`.
- Backend test command per task: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>`.
  One Maven process per working tree. Before merge: `ArchitectureTest`, codemap, lint-docs, the full suite with the flag.
- Conventional commits carrying `(mezo-r36n9.81)`.

## Review Focus

1. **The owner's run and every unflagged / unstyled block are untouched** — no planner call, no new lines, no
   prescription change. → Task 5 `unflaggedRunGetsNoTechniqueLines`, Task 3 `unstyledRunStartWritesNothing`, Task 8
   production check.
2. **Owner picks are never moved**, and they consume allowance. → Task 2 `ownerPickKeptAndCountsAgainstAllowance`,
   Task 5 `ownerRowGetsNoLine`.
3. **No technique or challenge on an unsafe lift**, on a sport-loaded group on a sport day, in weeks 1–2 (technique),
   in a deload. → Task 2 tests.
4. **sets − 1 / + 1 never breaks a cap and never touches a row he edited.** → Task 5 `editedRowIsKept`, `removalGivesSetBackWithinCaps`.
5. **The stall offer is one offer, in order, and the reduction comes back.** → Task 6.

## File structure

Created under `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/`:

| File | Responsibility |
|---|---|
| `TechniquePlanner.java` | pure: block snapshot + week → per-row technique, per-day challenge, warnings |
| `TechniquePlanService.java` | builds the snapshot (draft / run rows, attrs, tiers, sport, deficit); week projection for the evaluator; week-1 challenge write |
| `TechniqueLines.java` | pure: stored rows vs planner week → `technique` lines on the working copy (sets ∓ 1, caps) |
| `StallOffers.java` | pure: stalled group → at most one offer (technique / rep_range / reduction) |

---

### Task 1: Contract (hot spot — hold it briefly)

**Files:** `api/feature/train/train.yml` (`MesoPlanEvaluateRequest` +`trainingStyle`, `techniquesEnabled`;
`VolumePathWeek` +`techniques[]`, `challenges[]`; `MesoPlanEvaluation` +`techniqueWarnings[]`; new schemas
`PlannedTechnique`, `PlannedChallenge`, `TechniqueWarning` {code enum `owner_over_allowance|no_challenge_candidate`,
dayIndex, exerciseIndex?}), `api/feature/train/train-week-proposal.yml` (`kind` + `technique`, `rep_range`; line
+`fromTechnique`, `toTechnique`, `challenge`, `fromRepMin`, `fromRepMax`, `toRepMin`, `toRepMax`; reasons + six codes);
regenerate `api/openapi.yml` and `api.gen.ts`. `WeekProposalLineJson` gains the seven nullable fields (old rows read null).

- [ ] **Step 1:** Edit; regenerate; `./mvnw -q -DskipTests compile`; `CI=true pnpm typecheck` green.
- [ ] **Step 2:** Commit `feat(api): technique planner and challenge, additive (mezo-r36n9.81)`; post the final shape
  on bd `.83`.

### Task 2: The pure planner

**Files:** `config/TrainTechniqueProperties.java` (+`Planner`), `application.yml`, `service/CatalogAttributes.java`
(`Attrs` + `equipment`), create `service/TechniquePlanner.java`; tests `TechniquePlannerTest`, properties binding test.

**Interfaces:**
```java
record PlanRow(int dayIndex, int exerciseIndex, UUID id, String group, boolean counts, int workingSets,
               String type, Integer repMax, CatalogAttributes.Attrs attrs, TrainingStyle effectiveStyle,
               Technique technique, String source, boolean challenge) {}
record PlanDay(int dayIndex, boolean sportDay, List<PlanRow> rows) {}
record Input(int week, boolean deloadWeek, List<PlanDay> days, Map<String,String> priorities,
             Set<String> sportGroups, boolean deficit, int exerciseCap, int sessionCap, int capWeight,
             TrainTechniqueProperties.Planner cfg) {}
record Pick(int dayIndex, int exerciseIndex, UUID id, Technique technique, String source, String reason) {}
record Week(List<Pick> techniques, List<Pick> challenges, List<Warning> warnings) {}
static Week plan(Input in);
```

- [ ] **Step 1: Failing tests:** `weeksOneAndTwoHaveOnlyChallenges`, `deloadWeekHasNothing`, `freeExerciseNeverPicked`,
  `onlyLastExerciseOfTheGroupThatDay`, `emphasizeBeforeGrowMaintainNever`, `twoPerDayOneInDeficit`,
  `oneOnASportDay`, `sportLoadedGroupSkippedOnSportDay`, `maxTwoPerMuscleWeek`, `myoForHighRepIsolation`,
  `restDropForMachineAndCable`, `stableDumbbellCompoundNotEligible`, `alloutGetsNone`, `singleSetNotEligible`,
  `ownerPickKeptAndCountsAgainstAllowance`, `ownerOverAllowanceWarns`, `challengeFirstStableLengthenedEmphasizeFirst`,
  `ownerChallengeWins`, `challengeRowGetsNoTechnique`, `noCandidateNoChallengeWarns`, `deterministic`.
- [ ] **Step 2:** Implement → pass. Commit `feat(train): technique planner (mezo-r36n9.81)`.

### Task 3: The snapshot service and week-1 challenges

**Files:** create `service/TechniquePlanService.java`; `service/TrainService.java` (`stampRun`); test
`TechniquePlanServiceIT`.

**Behaviour:** `snapshotRun(createdBy, run, week, workingSets overlay)` and `snapshotDraft(userId, request)` build
`Input` (attrs one batched read; effective style via `ExerciseStyler.effective`; sport weekday from the day label vs
`sport_schedule_slot.day_of_week`; deficit from `EnergyBalancePort`). `projectRun` / `projectDraft` give every week's
`Week`. `stampRun`, when the new run opts in, writes week 1's planner challenges (`challenge = true`,
`technique_source = planner`) on the run rows.

- [ ] **Step 1: Failing ITs:** `runStartPlacesWeekOneChallenges`, `unstyledRunStartWritesNothing`,
  `flagOffRunStartWritesNothing`, `ownerChallengeDayGetsNoPlannerChallenge`, `sportDayFromScheduleSlot`.
- [ ] **Step 2:** Implement → pass; rerun `MesoTemplateTechniqueIT`, `TrainServiceIT`. Commit
  `feat(train): plan snapshot and week-1 challenges (mezo-r36n9.81)`.

### Task 4: The evaluator shows the plan

**Files:** `service/MesoPlanEvaluateService.java` (draft: cap weight from the request flag + picks; both: week
techniques / challenges / warnings); test `MesoPlanEvaluateTechniqueIT`.

- [ ] **Step 1: Failing ITs:** `draftShowsTechniquesFromWeekThree`, `draftWithoutFlagShowsNone`,
  `draftCapWeightCountsPicks`, `runShowsStoredPicksThisWeek`, `ownerOverAllowanceWarning`, `evaluationOfUnflaggedRunUnchanged`.
- [ ] **Step 2:** Implement → pass; rerun `MesoPlanEvaluateApiIT`. Commit `feat(train): evaluator shows techniques and challenges (mezo-r36n9.81)`.

### Task 5: Weekly proposal lines (hot spot `WeekProposalService`)

**Files:** create `service/TechniqueLines.java`; `service/WeekProposalService.java` (one call in `build`, the
`applySetLine` dispatch); `service/WeekProposalDecisionService.java` if it bypasses `applySetLine`; tests
`TechniqueLinesTest`, `WeekProposalTechniqueIT` (in `feature/train/service/`).

- [ ] **Step 1: Failing tests:** `weekThreeAddsTechniqueAndTakesASet`, `unflaggedRunGetsNoTechniqueLines`,
  `ownerRowGetsNoLine`, `deloadWeekEmitsNoTechniqueLines`, `deficitRemovesOneAndGivesSetBack`,
  `removalGivesSetBackWithinCaps`, `challengeMoveIsOneLinePair`, `editedRowIsKept`, `manualAcceptWritesTechnique`,
  `plannerFailureLeavesProposalWithoutTechniqueLines`.
- [ ] **Step 2:** Implement → pass; rerun `WeekProposalAutoIT`, `WeekProposalManualIT` (or the S3 decision ITs),
  `TierChangeProposalServiceIT`. Commit `feat(train): technique lines in the weekly proposal (mezo-r36n9.81)`.

### Task 6: The stall offers

**Files:** create `service/StallOffers.java`; `service/MuscleProgressReader.java` (skip deload-phase weeks);
`service/WeekProposalService.java` (offers for the stalled groups; `rep_range` apply); tests `StallOffersTest`,
`MuscleProgressReaderIT` (extend), `WeekProposalStallIT`.

- [ ] **Step 1: Failing tests:** `techniqueOfferedFirst`, `rangeChangeWhenNoTechniqueRoom`, `heavyGoesBalanced`,
  `balancedGoesVolume`, `alloutNoRangeChange`, `ownerRangeOverrideNoRangeChange`, `reductionOnlyOnHoldNotMaintain`,
  `reductionRestoredNextWeek`, `deloadWeekNoOffer`, `midBlockDeloadWeekNotAHold`.
- [ ] **Step 2:** Implement → pass. Commit `feat(train): stalled muscle gets one offer (mezo-r36n9.81)`.

### Task 7: Prescription and T2 notes

**Files:** `service/WorkoutService.java` (sport-day suppression), `service/WorkoutExerciseChangeService.java` /
`ExerciseStyler` (keep planner source on swap), `feature/character/detector/RirCalibrationDetector` (+ its reads);
tests `WorkoutTodayTechniqueIT` (extend), `WorkoutExerciseChangeServiceIT` (extend), `RirCalibrationDetectorTest`.

- [ ] **Step 1: Failing tests:** `sportDayHidesChallenge`, `sportDayHidesPlannerTechniqueOnLoadedGroup`,
  `sportDayKeepsOwnerTechnique`, `swapKeepsPlannerSource`, `rirCalibrationSkipsTechniqueSets`.
- [ ] **Step 2:** Implement → pass. Commit `feat(train): sport-day challenge rule and T2 follow-ups (mezo-r36n9.81)`.

### Task 8: Docs, gates, ship

**Files:** `docs/features/train.md` (§4 planner, challenge placement, stall offers; §9 traps; §10 key files),
`docs/features/README.md` row, `docs/milestones/roadmap.md`, handbook `docs/boop-handbook/07-edzes/15-technikak.md`
(+ `05-heti-volumen.md`), `_jegyek.json`, `_dontesek.json`, `_kiadasok.json`, the spec's status line, `docs/CODEMAP.md`.

- [ ] **Step 1:** Production baseline (reads): active run id, `training_style`, `techniques_enabled`, plan rows hash.
- [ ] **Step 2:** Full suite `./mvnw -q clean test -Dmezo.test.use-testcontainers=true` → BUILD SUCCESS;
  `ArchitectureTest`; frontend `CI=true pnpm test` both modes + `pnpm build` (only `api.gen.ts` changed).
- [ ] **Step 3:** Docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0 / 0.
- [ ] **Step 4:** Fetch, rebase, merge `--no-ff` on detached `origin/main`, push; `ci` + `deploy` green; pod tag = release.
- [ ] **Step 5:** Production check: the active run still unstyled / flag off, plan hash unchanged, `count(*) from exercise
  where technique_source = 'planner'` = 0.
- [ ] **Step 6:** Announce on bd, fetch + rebase, Notion `plan` → apply → `check` 0; beads backup; close `.81`; push; report.

## Kész, ha…

- Egy edzésstílusos, technikára bekapcsolt blokkban a gép maga teszi a technikákat: csak stabil gyakorlatra, az izom
  aznapi utolsó gyakorlatára, a 3. héttől az utolsó terhelő hétig; naponta legfeljebb 2 (fogyásban vagy sportos napon
  1), izmonként hetente legfeljebb 2; a Hangsúly izmok előbb, a Tartás soha; magas ismétlésű izolációra myo, gépre /
  kábelre pihenős drop; a technika egy sima sorozatot vált ki.
- Minden edzésnapnak van kihívása az 1. héttől (a könnyített héten nincs): az első stabil, nyújtott helyzetben
  biztonságos gyakorlat, Hangsúly izom előnyben; sportos napon a sport terhelte izom kimarad; ha nincs ilyen gyakorlat,
  aznap nincs kihívás. A kihívás nyer a technikával szemben.
- A tulaj saját technikáit és kihívásait a gép soha nem írja felül, de beleszámolja őket a keretbe; ha túllépi, az
  értékelő figyelmeztet.
- A blokképítő az értékelőben hétről hétre látja a tervezett technikákat és kihívásokat.
- Futó blokkban a változások a heti javaslat soraiként jönnek (automatikus módban maguktól életbe lépnek, kézi módban
  egyenként eldönthetők); amit a tulaj közben átírt, azt a sor nem írja felül.
- A megtorpant izom egy ajánlatot kap ebben a sorrendben: technika, ismétléstartomány-váltás, egyhetes könnyítés (ami a
  következő héten visszaáll); a középső könnyített hét nem számít megtorpanásnak.
- Ahol a blokknak nincs stílusa vagy nincs bekapcsolva a technika (minden webes blokk és a tulaj futó blokkja), minden
  pontosan úgy működik, mint eddig — teszttel és éles lekérdezéssel igazolva.
- A webes app változatlan: frontend tesztek mindkét módban zöldek, csak a generált kliens változott.
- A teljes backend tesztkészlet zöld; `ArchitectureTest`, kódtérkép és dokumentum-ellenőrzés hibátlan.
- Élesítve: `deploy` zöld, a pod az új verziót futtatja, az éles lekérdezések a várt értékeket adják.
- `train.md`, a kézikönyv technika- és heti-volumen oldala, a döntésnapló, a mérföldkő-napló és a Notion tükör a
  kiadott állapotot írja le.
