# Training volume engine v2 — the plan is the amount, the band advises

- **Date:** 2026-11-17
- **Issue:** `mezo-r36n9.65` (epic `mezo-r36n9`)
- **Status:** design, awaiting owner approval
- **Scope:** backend engine + contract now; the Boop screens (block builder, weekly review) as a later slice on
  top of B5 (`mezo-r36n9.15`). **No web UI work** (owner decision, 2026-11-17).

## 1. Intent and why

The owner builds a mesocycle from exercises and marks each muscle group **Hangsúly / Építés / Tartás**
(`emphasize` / `grow` / `maintain`). He wants the app to help him land each group's weekly sets inside the range
that tier calls for, and then to move sets and load week by week **inside that range, with his approval**.

Today the engine does the opposite of what he typed. On 2026-11-17 a hand-built block with one quad exercise of
three sets prescribed **eight** leg-press sets in one session, and an emphasized biceps with ten planned sets was
cut to six. The cause is structural, not a bug in one line: the exercise's `working_sets` is only a *proportion*;
the *amount* comes from a generic per-muscle table that knows nothing about the plan (see §7 *Codebase terrain*).
Production was patched by hand (landmarks overwritten with the plan's own totals); this design removes the need.

## 2. Goals, non-goals, anti-goals

**Goals**

1. **One number.** The set count the owner accepted for an exercise is exactly what the workout prescribes. No
   second, hidden amount.
2. **The band advises.** Each (muscle group, tier) has a weekly band. The plan is measured against it at build
   time, with concrete, cap-respecting proposals. Saving is never blocked.
3. **A weekly proposal he decides on**, line by line (per exercise), or accepts wholesale. Until the Boop screen
   exists the proposal is applied automatically (owner decision) — the same thing as "accept without looking".
4. **All nine mapped defects fixed** (§5).
5. **No change for a run in flight at deploy** beyond what the owner already sees: a one-time migration turns each
   active run's currently-effective sets into its amounts.

**Non-goals**

- Web screens for any of this. The web app must keep working and showing true numbers; it gets no new surface.
- Changing load progression rules (`ProgressionDecider`). They are kept; the weekly proposal only *previews* them
  and can hold them for a week.
- Fractional (indirect) set counting. ADR 0021 stands: direct sets only.
- The Boop screens' implementation — designed here (§6.6), built in their own slice with their own plan.

**Anti-goals** (would make this a failure even if it "works")

- The workout ever prescribing a set count the owner has not seen and accepted (or auto-accepted by his standing
  choice).
- A proposal that breaks its own caps (more than 5 sets on an exercise, more than 8 for a muscle in a session).
- Two places computing bands (the FE's `GROUP_LANDMARKS` duplicate must not gain a third sibling in Swift).

## 3. Owner decisions (2026-11-17, this conversation)

| # | Decision |
|---|---|
| 1 | The app proposes, the owner decides. His accepted number is the amount. |
| 2 | Every defect in §5 is to be fixed. |
| 3 | Engine first, in the shared backend; the screens come on the phone. The web app gets no new UI. |
| 4 | A weekly review he approves, with a quick "accept without looking". Decisions are **per exercise**. |
| 5 | Until the phone screen ships, the weekly proposal is **applied automatically**. |
| 6 | Approach A (§4): rebuild the engine's core rather than patch it. |
| 7 | The demo's bands and rules stand as shown (he raised no objection when asked): tier bands, the sport lowering for legs, at most +1 set a week in a deficit, 5 sets per exercise, 8 per muscle per session. |
| 8 | Look of the two phone screens: the round-6 simulator demo (§6.6). On the weekly card there is **no** per-muscle weekly total and no dial — the per-exercise tiles carry the change. |

## 4. Approaches

| | Approach | Trade-off |
|---|---|---|
| **A — the plan is the amount (chosen)** | `exercise.working_sets` on a run becomes the amount. Bands are derived, never stored as amounts. The weekly change is a first-class *proposal* with per-line decisions. | Most work: the distribution step is deleted, the rollover is rewritten, pinned ITs are replaced. Removes the defect class. |
| B — keep the engine, derive landmarks from the plan | Automate the manual production patch: seed each group's landmark from the plan's own total. | Cheap. Keeps "sets are weights", so per-exercise decisions are impossible, swaps and the "+1 set" action stay broken, and the band is no longer a band (low = high = plan). |
| C — compute on the phone | Swift decides, the server stores. | Violates the standing rule that logic more than one display needs lives in the backend; web and phone would disagree. |

The owner picked **A**.

## 5. The nine defects and what fixes each

| # | Defect today | Fix |
|---|---|---|
| 1 | Template sets are weights; the amount is the landmark (`effectiveWorkingSets`). | Amount model (§6.1): the distribution is removed. |
| 2 | The week-1 rollover overwrites the Hangsúly start with MEV (`VolumeDecider` week 1). | Week 1 is the plan, untouched. Tiers no longer pick a start, only a band (§6.2). |
| 3 | The editor shows the user's sets against a band; the run prescribes landmark-derived sets. | One number end to end; one evaluator serves the build-time view (§6.3). |
| 4 | No server-side per-session cap. | The evaluator warns above 8 per muscle per session; no proposal ever crosses the caps (§6.3, §6.4). |
| 5 | "Add a set" (`plan-sets`) only changes a weight once a volume row exists. | It changes the amount directly and recomputes the group totals (§6.1). |
| 6 | Sets logged on a today-only swapped row are invisible to the rollover (`lastWeekSignals` resolves via template day ids). | Last week's signals are counted per **muscle group over the sessions actually logged**, whatever row they hang on (§6.4). |
| 7 | Pump / soreness / workload feedback does not feed the set decision. | It does (§6.4). |
| 8 | One landmark table for everyone: no sport, no deficit. | Band modifiers: sport-loaded groups, deficit pace (§6.2, §6.4). |
| 9 | A tier change mid-run applies only at the next rollover and never cuts. | It re-evaluates immediately and raises an out-of-cycle proposal when the plan is now outside the new band (§6.5). |

## 6. Design

### 6.1 The amount model

- On a run, `exercise.working_sets` of a **template-day row** is the amount for the current week. `getToday`
  prescribes it as is; the existing read-time overlays (day delta, comeback lightening, readiness care) still
  apply on top and still never edit the row.
- `WorkoutService.effectiveWorkingSets` and its call site are deleted.
- `muscle_group_volume_log` stays one row per (run, trained counting group) but is **derived**: `current_sets` is
  the sum of the group's counting exercises' `working_sets`; `mev/mav/mrv` carry the group's landmarks for
  readers that still want them (web week page, volume arc). It is recomputed by one function
  (`VolumeLedger.sync(run)`) after every write that can change it: run start, plan edit, plan-sets, a
  "Mezociklusra is" swap, a tier change, a proposal apply. Rows for groups the plan no longer trains are removed;
  no row is fabricated for a group without a landmark entry (DA5 stands).
- `POST …/plan-sets` (`addPlanWorkingSets`) keeps its contract and now changes the amount.
- A template's `volume_per_muscle` is **no longer read by the engine**. The column and the wire field stay
  (tolerated, ignored) so no contract breaks; the generator stops writing it.

### 6.2 Bands

Pure function `VolumeBands.band(group, tier, modifiers) → {low, high, limit}` in weekly **direct** sets, from the
single landmark table `mezo.volume.baselines` (`mev/mav/mrv` per group):

| Tier | low | high |
|---|---|---|
| Tartás (`maintain`) | ⌈mev / 3⌉ | mev − 1 |
| Építés (`grow`) | mev | mav |
| Hangsúly (`emphasize`) | mav − 2 | mrv |

`limit` = mrv (for scaling a picture only). Example, back (10 / 16 / 22): 4–9, 10–16, 14–22.

Modifiers:

- **Sport-loaded groups.** A run and a template carry `sportGroups: string[]` (new, sparse; the builder's
  "Röplabda: a láb sávja lejjebb" switch sets `quad, ham, glute, calf`). For such a group: `low = max(1, low − 1)`,
  `high = max(low + 1, high − 2)`. The amounts are `@Validated` config (`mezo.volume.bands.sport-low-shift`,
  `…sport-high-shift`), not literals.
- Groups without a landmark entry (core, traps) have no band and are never judged.

The tier formulas' constants also live in `VolumeProperties`.

### 6.3 Build-time advice — one evaluator

`POST /api/train/meso-plans/evaluate` — **stateless**, deterministic, no LLM, never blocks a save.

Request: the plan as the editor holds it — `weeks`, `phaseCurve`, `days[]` (`GymExerciseInput`s), `musclePriorities`,
`sportGroups`.

Response:

- per muscle group: `tier`, `band{low, high, limit, sportAdjusted}`, `weeklySets`, `fit` (`below|inside|above`),
  `diff`, `spread[]` (day index → sets), `proposal[]` (`{dayIndex, exerciseIndex, delta}`) and `proposalBlocked`
  when the caps leave no slot ("needs a new exercise");
- per day: `minutesEstimate`, `sessionCapWarnings[]` (group, sets);
- per week of the block: the projected total and per-group sets (`path`), using the same step rules as §6.4, so the
  builder's *Blokk* view and the volume arc's planned line come from one place.

Proposal rule (the demo's, now the server's): move one set at a time; going up, to the counting exercise of the
group with the fewest sets (ties: the day with the lower group total); going down, from the one with the most;
never above `exercise-cap` (5) on an exercise or `session-cap` (8) for the group in a day; stop when inside the
band or when no slot is left.

`VolumeArcService.plannedScaffold` switches to the evaluator's `path` (fixes the arc's own divergence).

### 6.4 The weekly proposal

A new owned table **`meso_week_proposal`**: `mesocycle_id`, `week`, `kind` (`weekly|tier_change`), `status`
(`pending|applied|auto_applied|expired|superseded`), `created_at`, `decided_at`, `lines jsonb`, `plan_after jsonb`
(exercise row id → sets once applied: the per-week history the arc and the review's "last week" read).

A **line** is one change to one exercise: `id`, `exerciseId` (the run's template-day row), `exerciseName`,
`dayIndex`, `muscleGroup`, `kind` (`sets|weight|reps`), `from`, `to`, `reasons[]` (contract-enumerated codes, see
below), `decision` (`null|accepted|kept`).

**When.** At the start-date-anchored week boundary, generated once (a `weekly` proposal is unique per
`(mesocycle_id, week)`; a `tier_change` is not — see §6.5):
lazily from `getToday` as today, **and** from the proposal read endpoint, so the phone can show it before any
workout is opened.

**Set lines — `VolumeDecider` v2** (pure), per trained counting group:

1. Week 1: no lines. The plan stands.
2. Deload phase: every counting exercise goes to ⌈sets / 2⌉ (min 1). A deload is a **week, not a new baseline**:
   the proposal stores `restore` (exercise row id → the pre-deload sets), and the week after a deload starts from
   the restored amounts, as today's arc scaffold already assumes (`VolumeArcService`).
3. Tartás: no set line, ever.
4. Step down by 1 when the group is at or above its band's `high` **and** an overreach signal fired (a grind, or
   workload "too much"). This is checked **before** the hold.
5. Hold (no line) when last week's logged sets for the group were below its planned sets, or a grind was flagged,
   or the feedback says it was too much, or joint pain of 2+ was reported on one of its exercises, or the daily
   check-in's soreness was still high on the day of the group's next session.
6. Otherwise step up: Hangsúly +2, Építés +1; **in an energy deficit both are +1**. Never past the tier's ceiling
   (`band.high`), never past the caps. The set goes to the slot the §6.3 rule picks. No slot → no line, and the
   group is reported with reason `no_slot` on the proposal (not silently dropped).

Signals (fixes #6, #7): logged sets are summed per muscle group over the previous week's **completed sessions of
the run**, including instance-scoped rows (today-only swaps and additions), using each logged row's own muscle.
Feedback is the per-exercise `exercise_feedback` of those sessions (pump 1–4, joint pain 1–3, workload 1–3),
reduced per group. **Soreness is not a per-exercise field** (`ExerciseFeedbackEntity` has none): it is the daily
check-in's whole-body scale, read through the existing `DayCheckInPort`. No new feedback field is added.

A plan that sits **above** its band because the owner saved it that way is not pulled back by the weekly proposal
(it was his accepted number); `above_band` appears only in the evaluator and in tier-change proposals.

**Deficit** means: the owner's **active weight goal aims at losing weight** (the goal's planned direction, not a
measured trend or a day's intake). No active goal → not a deficit. It comes through a train-owned port
(`EnergyBalancePort.isInDeficit(userId, date)`), implemented in the goal slice — the `GoalRecomputePort` pattern, so `feature/train` does not import `feature/goal`.

**Load lines** are a *preview* of what `ProgressionDecider` will prescribe for the exercise's first session of the
week (weight up / rep up / rep down), with its own reason codes. They do not replace read-time prescription. A
`kept` decision on a load line pins that exercise for that week to last week's reference (weight and reps);
`SetRecommendationService` consults the week's decided proposal before deciding.

**Applying.** `accepted` set lines write `exercise.working_sets`; then `VolumeLedger.sync`. A proposal is `applied`
once every line is decided or it is accepted wholesale. **Nothing is force-decided:** in manual mode an undecided
line simply stays pending and unapplied (last week's numbers hold, as the owner was promised), and the proposal
becomes `expired` at the next week boundary. Opening a workout never decides anything.

**Automatic mode.** `mezo.volume.weekly-review.mode` = `auto` (default now) | `manual`. In `auto` the proposal is
generated and applied in the same transaction (`auto_applied`, every line `accepted`). The Boop slice adds a
per-user override when the review screen ships; the server default flips to `manual` for a user only by that
setting.

**Reason codes** (enumerated in the contract, Hungarian wording is the client's): `all_sets_done`, `felt_easy`,
`deficit_pace`, `room_in_band`, `soreness_cleared`, `top_of_rep_range`, `reserve_left`, `next_plate`, `grind`,
`too_much`, `sets_missed`, `tier_maintain`, `deload`, `no_slot`, `above_band`.

### 6.5 Tier or sport change mid-run

`PUT …/muscle-priorities` (and the new `sportGroups` on the same request) takes effect immediately: bands are
re-evaluated, and for every group now outside its band a `tier_change` proposal is raised with the §6.3 edits
(which may cut). It follows the same mode (auto → applied at once). A newer tier change **supersedes** a still
pending `tier_change` proposal of the run (`superseded`), so at most one is pending.

**Kímélő return (`RecoveryReturnService`).** Its step-back today lowers the ledger's `current_sets` and keeps
`prevSets` for undo; with a derived ledger that would change nothing and be erased by the next sync. It moves to
the amount model: the step-back cuts **exercise amounts** with the §6.3 down-rule and stores the edit list for the
undo. It still moves `start_date` back, so a week number repeats and that week's `weekly` proposal is not
regenerated — intended, the same as today's "recovery resume keeps `lastRun`" skip.

### 6.6 Contract additions (`api/feature/train/train.yml`, all additive)

| Operation | Purpose |
|---|---|
| `POST /api/train/meso-plans/evaluate` | §6.3 |
| `GET /api/train/mesocycles/{id}/week-proposals` | the run's open proposals — the week's `weekly` one (generated if due) and a pending `tier_change`, if any; an empty list when there is none |
| `POST /api/train/mesocycles/{id}/week-proposals/{proposalId}/decisions` | `{decisions: [{lineId, decision}], acceptRest?: bool, keepRest?: bool}` → the updated proposal; applies when complete |
| `sportGroups` on `MesoTemplateUpsertRequest`, `MesoTemplateResponse`, `MesocycleResponse`, `MusclePrioritiesUpdateRequest` | §6.2 |

### 6.7 The phone screens (designed here, built later)

Executable look: branch `spike/boop-blokk-epito`, `ios/Boop/EdzesTervDemo/` (`-previewBlokk YES`), cut from the B5
branch. Throwaway code, approved look.

- **Block builder** — full screen, own three-way bar: **Izmok** (body map on a dark stage, one muscle a card:
  tier switch, half dial with the band lit and his number as the bead, where the sets sit in the week, the
  proposal with *Elfogadom* / *miért?*), **Napok** (one day a page, steppers, per-day muscle totals, the cap
  warning), **Blokk** (the six weeks: totals per week and each muscle's path). One primary button: *Igazítsd a
  sávba* while anything is outside, else *Mentés*. The head always names the scope ("egy hét · izmonként", "a
  teljes blokk · 6 hét").
- **Weekly review** — a deck: one muscle a card, **one tile per exercise change** (kind mark, day and kind pills,
  the change as the loudest thing, reasons as pills, its own accept / keep), card-level "accept all" / "the rest
  stays", then a "nothing changes" card and a summary card (ring, three stat tiles, per-muscle result, where the
  changes land in the week). Entrance: a card on the Edzés page with *Átnézem* and *Elfogadom átnézés nélkül*.
- Its own drawn mark family (sets, weight, reps, calendar, check, keep, …) on the kit's 64-unit grid; no emoji, no
  system symbols.

Both read only §6.6 operations. Hungarian tier words are the shipped ones: Hangsúly · Építés · Tartás.

### 6.8 Migration

- Liquibase (`1.1.0/`): `meso_week_proposal`; `sport_groups jsonb` on `meso_template` and `mesocycle`;
  `volume_model smallint not null default 1` on `mesocycle`.
- A one-time, idempotent startup runner (`VolumeAmountMigrationRunner`): for every run with `volume_model = 1` and
  status `active` or `planned`, compute the **currently effective** per-exercise sets with the old distribution,
  write them into `exercise.working_sets`, sync the ledger, set `volume_model = 2`. New runs are stamped 2. The old
  distribution code lives only inside this runner and is deleted with it in a follow-up once production shows no
  run left on model 1.
- Archived runs are not touched (nothing reads their effective sets).
- The owner's current run was hand-aligned on 2026-11-17 (landmarks = plan totals), so for it the runner is a
  no-op in effect; the ATLAS templates' hand-written `volume_per_muscle` becomes inert.

### 6.9 Readers that must follow

- **Goal guard** (`GuardEvaluationService`, "any muscle with `current_sets` under 6"): compares against the
  group's `band.low` instead — a Tartás group at 3 sets is in its band, not a problem.
- **Web week page / MesoVolume**: keep reading the ledger; numbers are now the plan's. No UI change.
- **`MesoPlanGeneratorService`**: generated plans already match the landmarks; it stops writing
  `volume_per_muscle`.
- **Boop handbook** `docs/boop-handbook/07-edzes/{02,04,05}`: describe today's engine and say "Mi marad ki: Nincs";
  rewritten when the engine ships.

## 7. Codebase terrain (recon, investigator)

**Affected:** `feature/train` (service, config, entity/json), `api/feature/train/train.yml`, `feature/goal/engine`
(guard), `feature/companion` (`MesoPlanLlmAdapter` — untouched), web FE readers (`features/train`, `data/train` —
no change intended), Boop (no training code on main; B5 branch carries `MuscleBands.swift`, `EdzesBlokk.swift`
that read the ledger shape).

**How it works today**

- Landmarks: one table `mezo.volume.baselines` (nine groups), duplicated by hand in the FE (`GROUP_LANDMARKS`).
- `PriorityTier`: ceiling Emphasize → MRV, Grow → MAV, Maintain → MEV; week-one start MEV+2 for Emphasize.
- Seeding (`TrainService.stampRun` → `seedPlanBaselines`, then `VolumeProgressionService.seedBaselines`):
  `current_sets` = the tier's week-one start; template sets never consulted. Activating a planned run ignores the
  template's own landmarks.
- Rollover (`VolumeProgressionService.rolloverIfDue`, lazily in `getToday`): `VolumeDecider` — week 1 → MEV;
  deload or MRV-with-grind → half; logged ≥ target, no grind, below ceiling → +2; else hold.
- Distribution (`WorkoutService.effectiveWorkingSets`, one caller, `getToday`): `current_sets` split over the
  group's counting exercises of the template week, proportional to template `working_sets`; no caps.
- Load (`SetRecommendationService` → `ProgressionDecider`): top set of the last completed session; rep-max → next
  real weight (~+2.5 % compound / +5 % isolation, capped at 10 %); in range → +1 rep or hold on a grind; deload
  ×0.9. `E1rmSeries` / `EwmaEstimator` / `OneRepMax` do **not** drive prescription.
- Generator: skeleton from the landmark table, LLM picks exercises only, merger renormalises. Nothing validates an
  edited plan.

**Key files:** `service/{PriorityTier,VolumeDecider,VolumeProgressionService,MuscleGroup,MesoWeeks,TrainService,
MesoTemplateService,WorkoutService,SessionExerciseAssembler,WorkoutExerciseChangeService,SetRecommendationService,
ProgressionDecider,MesoPlanSkeleton,MesoPlanGeneratorService,VolumeArcService}.java`,
`config/VolumeProperties.java`, `application.yml` (volume block), `goal/engine/service/GuardEvaluationService.java`.

**Patterns to follow:** pure deciders with direct unit tests, thin services; tunables in `@Validated` config
records; the feature switch via the `VolumeProgressionGate` marker bean with a `…SwitchOffIT`; a
`ProvenanceEnvelope` on every volume row; read-time overlays never edit the plan; sparse priority map normalised
in one place; consumer-owned ports across slices.

**Traps a builder must respect**

- ADR 0021 (direct sets only); ADR 0027 (a template is a jsonb document, only a run has exercise rows).
- A day edit re-mints exercise UUIDs: history is tied to identity (`ExerciseHistoryResolver`), so a proposal line
  whose `exerciseId` vanished must fail soft (the line is dropped as `kept`), never 500.
- `getToday` writes; Boop's read assemblers must not call it — hence the proposal read endpoint.
- The adjustment `kind` on volume provenance is contract-enumerated; recovery resume keeps `lastRun` on purpose.
- Exempt exercises (closing block, plyo; `counts_toward_volume = false`) are out of everything here.
- Gates: ArchUnit layer subpackages; contract drift on `train.yml`; `gen-codemap --check`; FE tests in both
  `VITE_USE_MOCK` modes (the mock must return the new optional fields' shapes); full backend suite needs
  Testcontainers; a bare `?` in jsonb Liquibase SQL breaks every IT context.

**Tests pinning today's behaviour (to be replaced, not patched):** `VolumeEffectiveSetsIT`,
`VolumeEffectiveSetsSwitchOffIT`, `VolumeBaselineSeedIT`, `MesoStartTierSeedIT`, `VolumeProgressionServiceIT`,
`VolumeProgressionTierIT`, `VolumeArcContractIT`, `WorkoutTodayPrescriptionIT`, `WorkoutExerciseChangeIT`, and the
pure `VolumeDeciderTest`, `PriorityTierTest`.

**Stale docs found:** `train.md` §4 line refs for the rollover call and `createMesocycle`; §9's
`ProgressionDecider.decide` signature; the claim that MEV+2 survives week 1.

## 8. Prior art (recon, researcher)

| Pattern | Source | Adopted? |
|---|---|---|
| Volume landmarks per muscle (MV/MEV/MAV/MRV), start low, ramp, deload; maintenance for non-priority muscles | Renaissance Periodization — https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth | **Adopted** as the band source. The numbers are coaching heuristics, so they stay config. |
| Fractional set counting; continuous dose-response with diminishing returns | Pelland et al. meta-regression — https://sportrxiv.org/index.php/server/preprint/view/460 | **Not adopted** now: ADR 0021 keeps direct sets, and RP's landmarks are in direct sets too. Revisit separately. |
| Per-session ceiling (~11 fractional sets a muscle a session); split by frequency | Stronger By Science volume guide — https://www.strongerbyscience.com/volume/ | **Adopted** as the session cap (8 direct, the web editor's existing number). |
| Maintenance at a fraction of volume if load is kept; in a deficit hold volume, do not slash | Spiering / Roth — https://pmc.ncbi.nlm.nih.gov/articles/PMC9012799 | **Adopted**: the Tartás band starts at a third of MEV; a deficit slows the ramp instead of cutting. |
| Auto-rewriting the user's set counts from feedback | RP Hypertrophy (third-party descriptions) | **Rejected** as a silent rewrite; kept as a *proposal* the owner decides. |
| Leave sets to the user, automate load and reps | MacroFactor Workouts — https://macrofactor.com/workouts/ , Alpha Progression | **Adopted** as the default posture. |

Not found: evidence for how much jump-sport load should lower leg volume. The sport shift (§6.2) is the owner's
accepted default, in config.

## 9. Slices

1. **S1 — the engine's core, in one release.** The amount model (§6.1, §6.8, `VolumeLedger`), the band function
   (§6.2, without `sportGroups`), `VolumeDecider` v2's **set lines** with the new signals and the proposal table in
   **auto mode** (§6.4, no endpoints yet), the kímélő step-back (§6.5), the guard (§6.9). Defects 1, 2, 3, 5, 6, 7.
   The distribution cannot be removed without the new decider in the same release — otherwise sets would freeze —
   so they ship together. The migration honours `volume_recompute.lastRun`: a run already rolled over this week is
   not stepped a second time.
2. **S2 — the evaluator.** §6.3, `sportGroups` and the deficit pace, the arc scaffold; defects 4, 8.
3. **S3 — the proposal's API.** The two endpoints, load lines and the weekly pin in `SetRecommendationService`,
   manual mode, tier-change proposals (§6.5); defect 9.
4. **S4 — Boop screens** (§6.7) — after B5's Edzés room is on main; its own plan, coordinated with the B5 session.

Each slice: contract first, focused ITs with `-Dmezo.test.use-testcontainers=true` + `ArchitectureTest`, codemap,
`docs/features/train.md` (§4, §9 and the stale lines above), the Boop handbook pages, Notion mirror.

## 10. Left to the builder

- The exact reduction of `exercise_feedback` to "felt easy" / "too much" per group (thresholds in config).
- Whether `VolumeLedger.sync` is a method on `VolumeProgressionService` or its own class.
- The jsonb line schema's Java record names and the reason-code enum's home.
- The minutes estimate formula for a day (the demo uses 2.4 min a set + 6).

## 11. Builder-check resolutions (2026-11-17)

An independent read of this document against the code raised nine points. None needed the owner; each is settled
above as the author's call:

1. S1 and the decider ship together (§9) — the distribution cannot go before its replacement exists.
2. The kímélő step-back moves to exercise amounts; the repeated week keeps its skipped proposal (§6.5).
3. Soreness is the daily check-in's, via `DayCheckInPort`; joint pain 2+ holds; no new feedback field (§6.4).
4. The step-down is checked before the hold; a saved-above-band plan is not pulled back weekly (§6.4).
5. A deload week restores to the pre-deload amounts afterwards (§6.4 rule 2).
6. "Deficit" = the active weight goal aims at loss; no goal → no deficit (§6.4).
7. One pending tier-change proposal at a time; the read returns a list (§6.5, §6.6).
8. Nothing is force-decided in manual mode; an undecided proposal expires at the week boundary (§6.4).
9. The band function is part of S1, so the guard can use `band.low` there (§9).

Confirmed from the code: the volume switch is on by default; the distribution has one caller; the hand-patched
landmarks on the owner's run are replaced by the config table at the first ledger sync (intended); a rerun returns
the linked template, so ramped amounts never leak into templates.
