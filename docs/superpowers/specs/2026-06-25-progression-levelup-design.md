# Gamified Post-Workout Level-Up + Athletic/Muscle Progression — Design

**Date:** 2026-06-25
**Driving bd:** mezo-8e4 (parent epic — split into slices P1–P6, §8)
**Status:** approved-pending-review
**Driving need:** turn every logged workout into a gamified moment. After each session a
full-screen, animated "level-up" screen shows what improved — XP gained, which
skills/muscles leveled, which perks unlocked. A profile **stats card** surfaces the
standing athletic + muscle profile. Builds on the Train domain (`exercise_set` volume/e1RM,
`sport_session`, `run_session_log`) and the dual-mode hook layer.

> This spec was adversarially reviewed against the codebase + house standards (workflow
> `levelup-spec-review`, 2026-06-25); the fixes below fold in those findings.

## Decisions (made with the user, incl. browser mockup rounds)

1. **Skill model = two bands** (mockup A+C): **12 athletic attributes** (how you perform)
   + **13 muscle-group levels** (what you build, from gym volume). `skill-model-v3.html`.
2. **Overlap resolved:** muscle **Core** (volume) ≠ athletic **Core-stability**
   (TRX/plank); athletic **Max strength** (e1RM peak) ≠ per-muscle volume levels.
3. **Two new athletic skills:** **Anaerobic capacity** (sprint/cross/TRX) + **Coordination**
   (volleyball) → 12 athletic total.
4. **Full-stack**, persisted XP (not on-the-fly — needed for the before/after "leveled up"
   moment, streaks, perk-unlock dates).
5. **Trigger after all three backend workout families** (gym + sport + run); sport/run get a
   **new completion flow** (they close silently today).
6. **Level-up screen** (`levelup-v4.html`): full-screen, strict top-to-bottom stagger,
   total-XP count-up hero, level-ups as mini-ring rows (1.7s fill), other gains as a bars
   grid (skills + muscles), perk card, robustness line, CTA. Scales to **multiple
   simultaneous level-ups**.
7. **Profile card** (`profile-card.html`): radar (6 axes) hero + athlete-level/streak/best,
   plus a compact muscle top-list card.
8. **Perks = title + estimated-effect copy, display-only in v1**, unlocked at milestone
   levels (5/10/15/20…). Real recommendation influence is Phase 3.

## 1. Skill model, taxonomy & workout mapping

**Athletic (12)** — `skill_kind = ATHLETIC`: `explosiveness`, `vertical_jump`,
`sprint_speed`, `aerobic_capacity`, `anaerobic_capacity` *(new)*, `strength_endurance`,
`core_stability`, `max_strength` (e1RM), `coordination` *(new)*, `mobility`, `agility`,
`robustness`.

**Muscle (13)** — `skill_kind = MUSCLE`, **exact existing Train tokens**
(`ExerciseCatalogLoader.MUSCLES`, note the hyphens): `back-mid`, `lats`, `chest`,
`shoulder`, `rear-delt`, `biceps`, `triceps`, `quad`, `ham`, `glute`, `calf`, `core`,
`traps`. (`skill_key` stores these verbatim — no `back`/`rear_delt` rename.)

**Workout → source_type / signal → skills.** The 6 user-facing workout types map onto the
**3 existing backend families** via a signal sub-kind:

| Workout type | `source_type` · signal (`kind`) | Athletic skills | Muscle |
|---|---|---|---|
| **Klasszik kondi** | `GYM` · GymSignal | max_strength, strength_endurance | that day's logged muscles (per-set volume) |
| **Sprint futás** | `RUN` · RunSignal(`SPRINT`) | sprint_speed, explosiveness, anaerobic_capacity | — |
| **Futás** | `RUN` · RunSignal(`STEADY`) | aerobic_capacity, strength_endurance | — |
| **Röpi** | `SPORT` · SportSignal(`VOLLEYBALL`) | vertical_jump, agility, explosiveness, coordination, aerobic_capacity | — |
| **Cross training** | `SPORT` · SportSignal(`CROSS`) | anaerobic_capacity, strength_endurance, explosiveness, core_stability | — |
| **TRX köredzés** | `SPORT` · SportSignal(`TRX`) | core_stability, strength_endurance, anaerobic_capacity, mobility | — |

> **Open scope decision (user to confirm in review):** **Cross training** and **TRX
> köredzés** are NOT loggable in mezo today — `sport_session` is volleyball-shaped
> (`shoulderStrain`, `setsPlayed`). Supporting them means **generalizing the sport-session
> domain** with a `kind` discriminator (`VOLLEYBALL|CROSS|TRX`) + general effort fields
> (`rounds`, `rpe`, `durationMin`) and matching log sheets. That generalization lives in
> slice **P3**. If we want a leaner v1, ship P1–P2 + the existing 4 types (gym, sprint,
> futás, röpi) first and add cross/TRX in P3 as planned — the model already accounts for
> them.

`robustness` is cross-cutting (§2).

## 2. XP, leveling & signals

**Level curve (unambiguous, cumulative-threshold).** Each skill has a cumulative XP
accumulator. `xpThreshold(n)` = cumulative XP required to **be at** level `n`, with
`xpThreshold(1) = 0` and `xpThreshold(n) = round(base · (n-1)^exp)` for n≥2 (defaults
`base=100, exp=1.6` → Lv2=100, Lv3≈303, Lv4≈580, Lv5≈919). `level(cum) = max n such that
xpThreshold(n) ≤ cum`. **Every skill starts at level 1, `cumulative_xp = 0`.** Constants
are `mezo.progression.curve.*` config (§ House-standards). (There is no separate "per-level
cost" — the single threshold function defines everything.)

**Within-level progress** (drives the ring/bar fill), for a skill at `level L` with `cum`:
`progressPct = (cum − xpThreshold(L)) / (xpThreshold(L+1) − xpThreshold(L)) · 100`. The
payload's `progressFromPct`/`progressToPct` are this value computed on the before/after
state; for a multi-level jump `progressToPct` reflects the **final** level's partial fill.

**Per-workout XP per fed skill** = `normalize(signalValue) · skillWeight`, config-scaled.
Signal value per family:

- **GymSignal** (`finishWorkout`): per-muscle Σ(weight×reps) over the instance's sets →
  muscle XP (config volume→XP divisor); bodyweight/plyo sets (no weight) → config flat
  per-rep XP (never 0). `max_strength` XP from the instance's **best Epley e1RM**
  (`weight·(1+reps/30)`) vs the prior stored best, with a config PR bonus.
- **RunSignal** `(kind, distanceM, durationSec, hrRecoverySec, rpeActual?, sprintLandmark?)`:
  `STEADY` → aerobic/strength-endurance from distance/time + HR-recovery quality; `SPRINT`
  → sprint_speed/explosiveness/anaerobic from `sprintLandmark` + RPE + distance.
- **SportSignal** `(kind, rpe, durationMin, jumpCount?, setsPlayed?, shoulderStrain?,
  rounds?)`: `VOLLEYBALL` → vertical/agility/explosiveness/coordination/aerobic from
  jumpCount + RPE + duration; `CROSS`/`TRX` → from `rounds` + RPE + duration.

Nullable signal fields: a null RPE/landmark falls back to a config neutral value in
`normalize()`.

**Robustness (v1 = streak-only; weighted load-quality deferred to v1.1).** A "training
week" = ISO week, `Europe/Budapest`. `streakWeeks` = consecutive ISO weeks each with ≥1
logged session of any family. Robustness is stored as an **absolute recomputed target**:
`robustness.cumulative_xp = streakWeeks · perWeekXp` (config). Because it is recomputed
absolutely on every `applyWorkout`, two workouts in the same week are **idempotent** (no
double-count); the payload's `robustness.xpGained` is the delta vs the previously persisted
robustness XP. (v1.1 adds bounded load-quality bonuses from shoulder-strain/HR-recovery.)

**All weights, divisors, curve, mapping, robustness rate** are `mezo.progression.*`
`@Validated` config records (never `@Value`/hardcoded). The §1 mapping table is config data.

## 3. Backend

New module **`io.mrkuhne.mezo.feature.progression`** (`controller/service/repository/
entity/dto/mapper`). UUID PKs, `OwnedEntity` (`created_by`/`is_deleted`/`created_at`),
per-user filtering.

**Tables** (Liquibase `1.0.0/script/{12-digit UTC}_mezo-8e4_*.sql`; each script also
registered as a `changeSet` in `1.0.0_master.yml` id `1.0.0:<ts>_mezo-8e4_<desc>`,
author daniel.kuhne, never modify released changesets; **named** constraints throughout):

- **`skill_progress`** — `(created_by, skill_key)` unique. `skill_key` text, `skill_kind`
  (`@Enumerated(STRING)`, `ck_skill_progress_kind` ATHLETIC|MUSCLE), `cumulative_xp` bigint,
  `current_level` int, `updated_at` (**entity-level `@UpdateTimestamp @Column(nullable
  false)` — NOT inherited from OwnedEntity**). `uq_skill_progress_created_by_skill_key`.
- **`level_up_event`** — append-only XP-grant ledger (one row **per XP-granting workout
  regardless of whether a level was crossed; `levelUps[]` may be empty**). `source_type`
  (`ck_…_source_type` GYM|SPORT|RUN), `source_ref_id` uuid (**intentionally NOT an FK** —
  polymorphic across gym instance / sport / run session), `occurred_at`, `total_xp`,
  `payload` jsonb (`@JdbcTypeCode(JSON)` → `LevelUpResult`).
  `uq_level_up_event_created_by_source (created_by, source_type, source_ref_id)` =
  idempotency guard.
- **`perk_unlock`** — `skill_key`, `perk_key`, `milestone_level`, `unlocked_at`;
  `uq_perk_unlock_created_by_perk (created_by, perk_key)`. Persisted so perks show on
  profile and never re-fire.

**Perk catalog** = master data, loaded by an **every-profile `CommandLineRunner`** (the
`ExerciseCatalogLoader`/`PantryCatalogLoader` pattern — NOT `@Profile("demodata")`, NOT SQL
DML), keyed `(skill_key, milestone_level)` → stable catalog-assigned `perk_key` + name +
estimated-effect copy (HU). Invariant: each `(skill_key, milestone_level)` → exactly one
`perk_key`. (If stored as a table it is **master data: excluded** from the ResetDatabase
TRUNCATE list, like `exercise_catalog`.)

**`ProgressionService`:**
- `applyWorkout(createdBy, signal)` — **idempotent**: if a `level_up_event` already exists
  for `(source_type, source_ref_id)`, **read back and return its stored `LevelUpResult`**
  (short-circuit, no re-insert) so re-finish/resume is a clean no-op. Otherwise: compute
  per-skill XP deltas (config + §1 mapping), add to `skill_progress`, recompute levels,
  detect level-ups, recompute robustness (absolute), resolve **all** milestones strictly
  crossed by each level jump (a level 4→11 jump unlocks both 5 and 10 — each a `perk_unlock`
  row + a `perks[]` entry), persist, write one `level_up_event`, return `LevelUpResult` (§5).
- `getProfile(createdBy)` — all `skill_progress` + derived athlete-level (mean of the 11
  non-robustness athletic levels, 1-decimal; **null/omitted when no XP** → ghost state),
  `streakWeeks`, the 6 radar axes (§6), highlights.

**Triggers** (build the family signal, call `applyWorkout`, surface the result):
- `WorkoutService.finishWorkout` → GymSignal (per-muscle volumes + best e1RM over the
  instance's `exercise_set`; **the e1RM/PR computation is net-new** — today `hadPR` is just
  a FE boolean) → attach `levelUp` to the gym finish response.
- `SportService.logSportSession` → SportSignal.
- `RunningService.logSession` (FE hook name is `logRunSession`) → RunSignal.

**Contract** (contract-first):
- Register `../feature/progression/progression.yml` in **`api/generate/merge.yml`** before
  `npm run generate:api`; regenerate FE (`pnpm generate:api`) + BE types; commit both.
- `GET /api/progression/profile` → `ProgressionProfileResponse` (`athletic[]`, `muscle[]`,
  `athleteLevel?`, `streakWeeks`, `radarAxes[]`, `highlights`).
- The **`levelUp` extension to the gym/sport/run finish responses is authored in the
  existing `train`/`run`/sport fragments** (a fragment is a self-contained doc — it cannot
  `$ref` across files). Define `LevelUpResult` **once in `api/common/common-schemas.yml`**
  and reference it from each fragment, OR inline-duplicate per fragment if cross-file refs
  aren't wired — pick the shared-schema route if `common-schemas` resolves in the merge.
- Error paths use **SystemMessage** (`PROGRESSION_*` codes in `messages.properties`, no
  hardcoded user text); every operation references `SystemMessageList` for non-2xx. (HU
  perk/headline strings are display **content**, not error messages.)

**Feature switch:** `mezo.feature.progression.enabled` — a constant in a **new**
`techcore/configuration/FeaturesConfiguration` (first switch in the repo), consumed via
`@ConditionalOnProperty` (no `matchIfMissing`) at the `ProgressionController` + the
`applyWorkout` call sites; both states tested.

## 4. Frontend

- New `progressionHooks.ts` → `useProgressionProfile()`, re-exported from `data/hooks.ts`,
  built on **`useDualQuery`** (mockData / real-empty — **not** a `data = mockSeed`
  destructuring default; the `dualMode.guard.test` enforces this).
- **FE seams that must change** (the current flows discard the response):
  - **Gym:** `finishWorkout` is fire-and-forget then `setPhase('complete')` synchronously
    (`ActiveWorkoutScreen.tsx:248` and the skip path `:264`). Change the hook to
    `finishWorkout(workoutId, { onSuccess?: (r) => void })` (mirror the existing
    `startWorkout` opts), capture the `levelUp` in `onSuccess`, then present the level-up.
    Both call sites route through it.
  - **Sport/Run:** `logSportSession`/`logRunSession` currently take a **zero-arg**
    `onSuccess` and discard the response (`.then(() => undefined)`); the sheets call
    `onSave` then `close()` synchronously, and are rendered from **3 different parents**
    (SportView, TrainTodayView, RunningView). Change both mutations to forward the response
    (`onSuccess: (r) => …`), defer `close()` until success, and present the level-up from a
    single host (the portal overlay below).
- **`LevelUpScreen`** (`features/progression/`): a **full-bleed portal overlay** mounted
  into `.phone-screen` (the `Sheet` portal technique) so it covers **TabBar + Fab** — they
  render unconditionally in `AppLayout`, so a route alone is NOT full-screen. Driven by a
  `LevelUpResult`. Hand-rolled CSS `@keyframes` (no framer-motion), explicit per-element
  top-to-bottom delays, rAF count-up, mini-rings (1.7s), bars grid scaling to multiple
  level-ups, perk card, robustness row, **single CTA `Tovább`** (the undefined `Megosztom`
  share is dropped for v1 — single-user app, no social scope).
  **`prefers-reduced-motion` is a first-class requirement** (codebase gates only sheets
  today): count-up jumps to final, rings/bars render filled, stagger collapses. Consider a
  small shared `useReducedMotion` gate reused by the radar.
- **Gym composition:** the level-up is the new primary post-gym celebration; the existing
  `WorkoutComplete` recap (per-exercise, fuel window) follows on `Tovább`. The old `hadPR`
  demo path is replaced by real `max_strength`/PR data from the signal.
- **Profile cards** (`ProfileView`, below `BiometricCard`): `AthleticProfileCard` (new SVG
  radar + athlete-level/best/streak) and `MuscleLevelsCard` (top-N + reserve note). Both
  read `useProgressionProfile()`; ghost state before any XP (mirrors BiometricCard).
- **Mock mode:** a **hand-authored seeded `skill_progress` snapshot** (the gym
  muscle/max_strength portion can't be derived — mock has no logged set history,
  `exerciseRecords` is `[]`); the mock finish/sport/run mutations return a **deterministic
  seeded `LevelUpResult` fixture** (the no-op mutations can't compute one). Both FE modes
  must stay green.

## 5. Level-up payload (`LevelUpResult`)

```
{ source: 'GYM'|'SPORT'|'RUN', workoutLabel, durationMin, rpe?,
  totalXp,
  gains: [ { skillKey, kind:'ATHLETIC'|'MUSCLE', name, icon?, xpGained,
             levelBefore, levelAfter, progressFromPct, progressToPct } ],
  levelUps: [ skillKey… ],                       // gains where levelAfter > levelBefore
  perks:    [ { skillKey, perkKey, name, effectCopy, milestoneLevel } ],
  robustness: { xpGained, streakWeeks } }
```

Render: headline + `totalXp` (count-up) → `levelUps` mini-ring rows + their `perks` →
remaining `gains` grid → `robustness` → `Tovább`.
**No-level-up case** (the common one): screen always shows (`totalXp` + bars); the
"Szintlépés" section is omitted, headline adapts ("Szépen gyűlik."). Never a dead-end.

## 6. Radar axes & athlete-level

Athlete-level = mean of the **11 non-robustness athletic** levels (1-decimal). The **6 axes
regroup those 11**, except the **Erő axis additionally blends the muscle-level mean** (so it
is not a pure athletic regroup — config blend weight, both inputs scaled onto one 0..N axis):

| Axis | Aggregates |
|---|---|
| **Erő** | max_strength + muscle-level mean (blended) |
| **Robbanékonyság** | explosiveness + vertical_jump |
| **Sebesség** | sprint_speed |
| **Állóképesség** | aerobic_capacity + strength_endurance + anaerobic_capacity |
| **Mozgékonyság** | mobility + core_stability |
| **Koordináció** | agility + coordination |

`robustness` shows as its own profile element, not an axis. (v1: fixed grouping; making the
axis weights config is v1.1.)

## 7. Testing

- **`ProgressionServiceIT`** (extends `AbstractIntegrationTest`, data via **new
  `SkillProgressPopulator` / `LevelUpEventPopulator`** under `support/populator/`, AssertJ,
  no mocks/H2, `test{Method}_should{Result}_when{Condition}`): XP math per family; threshold
  crossing (single + multiple level-ups in one workout); **two-milestone jump** unlocks both
  perks; **idempotency** (re-finish/resume returns the stored payload, no double-count and
  no constraint violation); robustness streak recompute is idempotent within a week;
  bodyweight/plyo flat XP; cross-user isolation; the net-new e1RM/PR computation.
- **`ProgressionProfileApiIT`** (extends `ApiIntegrationTest`): profile aggregation
  (athlete-level, radar grouping, highlights, **empty profile → ghost**); finish responses
  carry `levelUp`; **401-without-token on every protected endpoint**; SystemMessage codes.
- **New tables → `ResetDatabase.resetExceptMasterData()` TRUNCATE list in the same change**
  (`skill_progress`, `level_up_event`, `perk_unlock`); perk catalog (if a table) excluded
  as master data.
- **FE:** hook tests both modes (real maps endpoint, mock fixture); `LevelUpScreen`
  (level-up, no-level-up, multiple level-ups, **reduced-motion**); profile cards (radar
  render, ghost pre-XP); updated gym-finish/SportView/RunningView/sheet tests for the new
  flows; both FE modes + build + parity captures.

## 8. Build order (parent epic mezo-8e4 → child slices)

This is **not one bd unit**; `writing-plans` produces one plan per child:

- **P1 — Progression domain foundation** *(blocker of all)*: 3 tables + entities + repos +
  `ResetDatabase` registration + the curve + config records + the `skill_progress`
  accumulator + perk catalog loader. No triggers. Unit/IT on pure XP/curve math.
- **P2 — Gym path end-to-end**: GymSignal (incl. the net-new e1RM/PR sub-task over
  `exercise_set`), `finishWorkout → applyWorkout`, extend the gym finish contract with
  `levelUp`, idempotency. Proves the richest signal + the contract seam.
- **P3 — Sport + Run signals + new completion flows**: the sport-session **generalization**
  (`kind` VOLLEYBALL|CROSS|TRX + general effort fields + sheets) and run signals; backend
  response-shape changes; existing-test churn (SportView/RunningView/sheet tests) is in the
  done-definition.
- **P4 — Profile endpoint**: `GET /api/progression/profile` + radar aggregation + streak +
  highlights.
- **P5 — FE LevelUpScreen** (FE-parallelizable once P2–P4 freeze the contract): the animated
  full-bleed portal overlay incl. the reduced-motion fallback + no-level-up case; wires the
  3 mount seams.
- **P6 — FE profile cards + radar SVG + dual-mode mock** (FE-parallelizable): the two cards,
  the radar component, mock fixture/snapshot.

## Deferred to v1.1 (keep v1 lean)

- **Robustness load-quality bonuses** (shoulder-strain/HR-recovery week modeling) — v1 ships
  **streak-only** robustness.
- **Full "Teljes profil" route** (all 12+13 in one screen) — v1 has the two cards + the
  level-up; the link can stub.
- **Config-driven radar axis weights** — v1 uses fixed grouping.

## Out of scope (YAGNI)

- Real perk gameplay effects (Phase 3 / Spring AI).
- Re-opening past `level_up_event`s from a history UI (table exists; `GET …/{eventId}`
  deferred).
- Leaderboards / multi-user / ranking (single-user app).
- XP decay / levels going down (consistency-positive; robustness handles cadence without
  punishing — matches "a try maga a jutalom").
- Body-map silhouette for muscles (top-list now).
- Sound / haptics.
