---
title: Medal collection — live per-set records + progression-target medals
type: spec
status: approved
created: 2026-07-30
driving_issue: mezo-wp6n
tags: [train, progression, gamification, backend, frontend, data-layer]
supersedes_decision:
  - docs/superpowers/specs/2026-06-12-exercise-records-design.md §"Out of scope (YAGNI)"
---

# Medal collection — live per-set records + progression-target medals

Driving issue: **mezo-wp6n**. Design date: 2026-07-30.

## 1. Problem

Nothing in mezo compares a **logged** set against anything.

- The mid-workout "Personal Record" toast is a **scripted demo**: `ActiveWorkoutPage.tsx:405` fires it only when the *first* exercise's *third* set is logged at ≥ `PR_DEMO_THRESHOLD_KG` (105). It consults no record store, and `PRToast.tsx:51` carries a hardcoded date ("Március 4 óta vártuk…").
- The workout summary's `· PR ✨` suffix (`WorkoutSummary.tsx:75`) is driven by `hadPrFromSignal` — a `max_strength` **skill level-up**, i.e. an XP-threshold crossing, not a broken record. In mock mode `gymLevelUpMock` always includes `max_strength`, so the suffix is always on.
- Completing the set/rep the **Progresszió** engine prescribes produces **no feedback at all**. `ProgressionSignal` reaches the UI purely for display (`ProgressionBanner.tsx`), and the prescribed target is used only to prefill the steppers (`ActiveWorkoutPage.tsx:292-312`). The only logged-vs-target comparison anywhere is the *challenge* path (`ChallengeOutcomeEvaluator.java`), which judges one LLM-authored challenge per day — not the plan.

Meanwhile the **record engine already exists and is real**: `ExerciseRecordService` computes, per exercise identity, the best set, best Epley e1RM, best session volume, and the best reps at each of the top-3 weights. It is read-only history on the Gyakorlatok tab; nothing ever asks it a question at the moment a set is logged.

The gap is therefore narrow and specific: **evaluate each logged set against the user's own history and against the prescription, and say so.**

## 2. Goals / non-goals

**Goals**
- Every logged working set is evaluated live against the user's history for that exercise identity and against the prescribed target.
- Broken records celebrate; the frequent target-hit medal stays quiet.
- The workout summary lists the session's medals.
- A **medal cabinet** on Train shows the full dated history, backfilled from existing set data.
- Medal XP folds into the existing GYM award — no new ledger, no coins.

**Non-goals (explicitly out)**
- Milestone/achievement medals (100th workout, 1M kg lifetime volume, streak medals). The user ruled these out.
- A materialized `set_medal` table, medal "unseen" state, and push notifications on a record (see §4 — the derived model forecloses unseen-state by construction).
- Touching the 9 LIFE/quest badges on `/me/growth` → Kitüntetések. Those stay life-domain; medals are train-domain.
- Records for sport/running.

## 3. Decisions (all confirmed with the user, 2026-07-30)

1. **Medal types:** the four Hevy record types **plus** a mezo-specific `TARGET_HIT`.
2. **`TARGET_HIT` granularity: per working set.** Each set that meets the prescribed weight AND reps earns its own medal. (Rejected: per-exercise "all prescribed sets hit", and "at least one set hit".)
3. **Collection depth:** live set-row feedback **+** workout-summary list **+** a medal cabinet. No milestone medals.
4. **Backfill: yes.** The four record types are replayed over the entire existing set history and appear in the cabinet with their real dates. `TARGET_HIT` cannot be backfilled — the prescribed target was never stored (§5.1) — so it accrues only from this change forward.
5. **XP yes, coins no.** A record medal pays the existing-but-dead `prBonusXp`; a target medal pays a small capped amount. Coins stay the quest/level-up economy's business.
6. **Visual direction: two tiers.** `TARGET_HIT` is a quiet mark on the set row; a RECORD-tier medal fires a ~3s celebration toast in the rest window and leaves a gold chip on the row.
7. **Storage: derived, not materialized.** No medal table; medals are replayed from `exercise_set`.
8. **Cabinet location:** a new **Medálok** entry in Train's sub-navigation.

## 4. Storage: derived, not materialized

A medal is **not a stored fact**. It is a consequence of the set rows, recomputed by chronological replay per exercise identity.

**Why (reverses the YAGNI call in `2026-06-12-exercise-records-design.md:123`, which deferred live PR detection "until a materialized record table" exists — it turns out none is needed):**

- **It cannot drift.** Editing or deleting a past set automatically corrects the medal history. A materialized table would keep asserting a record that the data no longer supports.
- **Backfill is free.** No migration script, no one-shot job, no reconciliation path to maintain.
- **It matches the neighbouring engine.** `ExerciseRecordService` already aggregates over *all* the user's working sets in memory on every read (`ExerciseRecordService.java:49`), for the stated reason that single-user data volume makes it trivially fast. Medal replay is the same order of magnitude over the same rows.

**Accepted costs**
- The cabinet recomputes on open. At single-user volume (low thousands of sets) this is milliseconds; if it ever isn't, the escape hatch is a cache in front of `MedalService`, not a table.
- **No "new / unseen medal" state is possible** — that is mutable state and cannot be derived. Accepted: v1 has no unseen badge and no record notification.

**The one thing that must be persisted:** the prescription in force when the set was logged (§5.1). Without it `TARGET_HIT` is underivable, because `ProgressionSignal` is recomputed from the *latest* history on every read and therefore cannot be reconstructed retroactively.

## 5. Data model

### 5.1 `exercise_set` gains the target snapshot

```
target_weight_kg  NUMERIC(6,2)  NULL
target_reps       INTEGER       NULL
```

Both nullable; both written server-side from the client-supplied prescription snapshot at log time. Null means "no prescription was in force" (first session, engine switch off, or a row that predates this change) — such a set can never earn a `TARGET_HIT`, and must not be treated as a miss either.

Liquibase: `202607301900_mezo-wp6n_exercise_set_target.sql`, appended to the versioned changelog per `liquibase_conventions.md`. No constraints beyond nullability; no backfill of the new columns.

Secondary benefit, deliberately claimed: with the target on the row, *plan adherence* becomes measurable for the first time. Not built here, but it stops being impossible.

### 5.2 No other schema change

No new table, no new index (identity lookups ride the existing `created_by` + exercise joins already used by `ExerciseRecordService`).

## 6. Medal taxonomy

**Identity** = `c:{catalogId}` when the exercise is catalog-linked, else `n:{name}` — the exact idiom already used by `ExerciseRecordService.java:65` and mirrored on the frontend by `prepBriefing.ts:90-92`. History is read over **all** exercise rows including soft-deleted ones, so editing a day's plan never erases records.

**Eligibility:** working sets only (`kind = 'working'`), `reps` present. Weight-based types additionally require `weight_kg`. Warmups never medal.

**Prior** = every eligible set of the same identity strictly earlier in time, **including earlier sets of the same session**.

| key | tier | condition |
|---|---|---|
| `WEIGHT` | RECORD | `weight > max(prior weight)` |
| `REPS_AT_WEIGHT` | RECORD | `reps > max(prior reps at exactly this weight)` |
| `E1RM` | RECORD | `epley(set) > max(epley(prior))`, Epley = `w × (30 + reps) / 30` |
| `SESSION_VOLUME` | RECORD | session-scoped: `Σ(w×reps) for this identity this session > max(Σ of any prior session)` |
| `TARGET_HIT` | TARGET | `target_weight_kg` and `target_reps` both present, `weight ≥ target_weight_kg` **and** `reps ≥ target_reps` |

**Rules that keep it honest**

- **Strict `>`.** Tying a record earns nothing.
- **A baseline earns nothing.** If there is no prior comparable set, no RECORD medal fires — the first weighted set of an exercise establishes the record silently. Likewise `REPS_AT_WEIGHT` needs a prior set at that exact weight, and `SESSION_VOLUME` needs a prior session. This is what stops the backfill and every new exercise from flooding the cabinet with pseudo-medals.
- **`TARGET_HIT` is history-independent** — it compares only against the row's own stored target, so it fires on a first session and on a HOLD/deload week just the same.
- **A set may carry several medals** (e.g. `WEIGHT` + `E1RM` + `TARGET_HIT`). All that hold are emitted. The *toast* shows the highest-priority one and counts the rest: `WEIGHT > E1RM > REPS_AT_WEIGHT > SESSION_VOLUME`.
- **Escalating within one session is genuinely several medals.** 100×9 then 100×10 in the same session yields two `REPS_AT_WEIGHT` medals, because each beat everything before it. *Considered and rejected:* collapsing to one medal per (session, identity, type). It would desynchronise the live chip from the cabinet row — a set that truthfully broke a record at the moment it was logged would later show none. Truthfulness beat tidiness; the flood is bounded (you can only out-do your own running best a few times per session).
- **`SESSION_VOLUME` is not a per-set medal.** It resolves at workout finish and appears in the summary and the cabinet, never on a set row.

**What `value` / `unit` / `previousValue` mean per type** (the `Medal` payload of §8 — stated here so both evaluators agree):

| type | `value` | `unit` | `previousValue` |
|---|---|---|---|
| `WEIGHT` | the achieving weight, kg | `KG` | the prior best weight |
| `REPS_AT_WEIGHT` | the achieving reps (`weightKg` carries the weight it was at) | `REPS` | the prior best reps at that weight |
| `E1RM` | the achieving Epley e1RM, kg, 1 decimal | `KG` | the prior best e1RM |
| `SESSION_VOLUME` | this session's volume for the identity, whole kg | `KG` | the prior best session volume |
| `TARGET_HIT` | the achieving reps (`weightKg` carries the load) | `REPS` | **always null** — nothing was beaten |

`previousDate` follows `previousValue`: the date of the set (or session) that held the record before. Both are null on a `TARGET_HIT`.

## 7. Backend

### 7.1 New units

- **`feature/train/service/MedalEvaluator.java`** — pure, no Spring, no DB (the `ProgressionDecider` idiom). Given the ordered prior sets of one identity plus a candidate set, returns the medals that set earns. Home of every rule in §6; the bulk of the test surface.
- **`feature/train/service/MedalService.java`** — `@Service`, `@RequiredArgsConstructor`. Loads the owner's working sets once (reusing `ExerciseSetRepository.findByCreatedByAndRepsNotNullAndKind`), groups by identity, replays chronologically, and serves:
  - `list(createdBy)` → the full cabinet, newest first;
  - `forSet(createdBy, setId)` → the medals a just-logged set earned;
  - `forSession(createdBy, workoutSessionId)` → the session's medals including `SESSION_VOLUME`.
- **`TrainController`** gains `GET /api/train/medals`, delegating to `MedalService.list`.

Ownership filtering is app-level `created_by = currentUser`, as everywhere.

### 7.2 Wiring into existing flows

- **`WorkoutService.logSet`** persists the two new target columns from the request, then attaches `medals[]` to the `ExerciseSetResponse` it already returns (`train.yml:751-756`) — additive, no breaking change.
- **`WorkoutService.finishWorkout`** attaches the session's `medals[]` (incl. `SESSION_VOLUME`) to `WorkoutInstanceResponse`, alongside the `levelUp` it already sets.

### 7.3 XP — folded into the existing GYM award

No new progression source. `LevelUpEventEntity.sourceType` keeps its DB CHECK; `GamificationAccountAdapter` needs no new branch; no coins are minted.

- `GymSignal` gains `recordMedalCount` and `targetMedalCount`, computed by `GymSignalCalculator` from `MedalService.forSession`.
- `ProgressionService.applyGym` — **fix the dead bonus.** Today (`ProgressionService.java:88-92`) `prBonusXp` is paid only when `skill_progress` has no `max_strength` row at all, i.e. exactly once in the account's lifetime, despite the property being documented as *"bonus when e1RM beats prior best"* (`ProgressionProperties.java:35`). Replace `firstEver` with `prBonusXp × recordMedalCount` → `max_strength` (ATHLETIC).
- Target medals pay `targetMedalXp × min(targetMedalCount, targetMedalCap)` → `strength_endurance` (ATHLETIC).
- `ProgressionProperties.Gym` gains `targetMedalXp` (default 5) and `targetMedalCap` (default 12) under `mezo.progression.gym.*`, per `configuration_conventions.md` — no `@Value`, no hardcoded tunables.

Everything still rides the one idempotent `award(createdBy, SOURCE_GYM, instanceId, …)` call, so re-finishing a workout is the same no-op it is today.

## 8. Contract (`api/feature/train/train.yml`)

Contract-first per `api_contract_conventions.md`: edit the fragment, merge, then implement.

```yaml
Medal:
  type: object
  required: [type, tier, exerciseName, date, value, unit]
  properties:
    type:  { enum: [WEIGHT, REPS_AT_WEIGHT, E1RM, SESSION_VOLUME, TARGET_HIT] }
    tier:  { enum: [RECORD, TARGET] }
    exerciseName: { type: string }
    catalogId:    { type: string, format: uuid, nullable: true }
    muscle:       { type: string, nullable: true }
    date:         { type: string, format: date }
    workoutSessionId: { type: string, format: uuid, nullable: true }
    setIndex:     { type: integer, nullable: true }
    value:        { type: number }            # kg | reps | e1RM kg | volume kg
    unit:         { enum: [KG, REPS] }
    weightKg:     { type: number, nullable: true }   # the achieving set
    reps:         { type: integer, nullable: true }
    previousValue: { type: number, nullable: true }  # null for TARGET_HIT / baseline
    previousDate:  { type: string, format: date, nullable: true }
```

- `SetLogRequest` += `targetWeightKg` (number, nullable), `targetReps` (integer, nullable).
- `ExerciseSetResponse` += `medals: [Medal]`.
- `WorkoutInstanceResponse` += `medals: [Medal]`.
- New `GET /api/train/medals` → `MedalListResponse { medals: [Medal] }`.

## 9. Frontend

Structure per `docs/references/frontend_conventions.md` — four layers, deep absolute `@/*` imports, hooks only through the `@/data/hooks` barrel.

### 9.1 Data layer — `frontend/src/data/train/`

| file | role |
|---|---|
| `medalTypes.ts` | `Medal`, `MedalType`, `MedalTier` (FE-side types over the generated client) |
| `medalApi.ts` | `medalApi.list()` → `GET /api/train/medals` |
| `medalEvaluator.ts` | the §6 rules, ported for **mock mode** so mock logging really produces medals |
| `medalMock.ts` | a seeded cabinet + the mock baseline |
| `medalHooks.ts` | `useMedals()` — `useDualQuery`, key `['train','medals']` |

`data/hooks.ts` re-exports `useMedals`.

**Mock mode needs a baseline.** `trainHooks.ts:317-323` hardcodes an empty exercise-record list in mock mode, so a mock-mode medal engine reading records would never fire. Rather than change that (it would move existing `ExercisesPage` ghost-state tests), the mock evaluator seeds its baseline from the mock workout's existing **`lastWeek`** per exercise — data that is already there and is exactly "your previous best-known set". `useMedals` gets its own `medalMock` seed so the cabinet has content offline.

### 9.2 Components — `frontend/src/features/train/`

- **`components/MedalToast.tsx`** — replaces `PRToast.tsx`. Real values: type, the achieving set, the previous value and **its date**. Fires only for RECORD tier, once per set, in the rest window.
- **`components/MedalChip.tsx`** — the row mark. Gold chip for RECORD; a quiet sage mark for `TARGET_HIT`.
- **`components/WorkoutSummary.tsx`** — `hadPR?: boolean` → `medals: Medal[]`, rendered as a listed block. The `· PR ✨` title suffix and the `hadPrFromSignal` derivation both go.
- **`pages/MedalsPage.tsx`** — the cabinet. Grouped by date, newest first; each row names the exercise, the medal type, the new value and what it beat. An honest empty line before the first medal.
- **`pages/ActiveWorkoutPage.tsx`** — sends the prescription snapshot with each logged set (`prescribedAt(...)` already has it at the call site, `:390`); consumes the response's `medals[]`; renders chips and the toast. **Deletes** `PR_DEMO_THRESHOLD_KG`, `PR_TOAST_MS`, `showPR`/`PRState`, and the `:403-412` demo block.

**The double-tick problem** (surfaced by the mockup): the row already ends in a coral "set done" `✓`. A separate sage "target hit" `✓` next to it reads as two ticks. Resolution: the target medal does **not** add a second tick — the existing done-tick turns **sage** when the set hit its target and stays coral when it did not. One mark, two meanings, no new glyph.

### 9.3 Routing

`MedalsPage` mounts under the Train section in `app/router.tsx` and gains an entry in Train's `SubNavDropdown` (the shared primitive, `@/shared/ui/SubNavDropdown`).

## 10. Testing

Per `testing_standards.md` / `integration_test_framework.md`.

- **`MedalEvaluatorTest`** (pure JUnit + AssertJ, table-driven) — the rule surface: strict `>`, the baseline-earns-nothing rule, `REPS_AT_WEIGHT` requiring a prior set at that weight, multi-medal sets, warmup exclusion, null-target sets never hitting or missing, escalation within one session, soft-deleted exercise rows still counting toward identity history.
- **`MedalApiIT`** (`ApiIntegrationTest`) — the cabinet read, the medals on a set-log response, the medals + `SESSION_VOLUME` on finish, ownership isolation. Data via the existing workout populators; **create users via `UserPopulator`, not the seeded owner** (see the CI trap in `docs/infrastructure/local-dev-testing.md`).
- **`ProgressionServiceIT`** — extend for the fixed PR bonus: N record medals pay `N × prBonusXp`; re-finishing stays idempotent.
- No `ResetDatabase` change (no new table).
- **Frontend:** `medalEvaluator.test.ts` (mirrors the backend table), `MedalToast.test.tsx`, `MedalsPage.test.tsx`, plus updates to `ActiveWorkoutPage.test.tsx` (the 105 kg demo test at `:397-407` must go) and `WorkoutSummary.test.tsx`. **Both modes green**: `pnpm test` and `VITE_USE_MOCK=true pnpm test`.
- Playwright goldens for the new route and the changed summary are regenerated by the coordinator at ship time (linux via `update-visual-baselines.yml`), never by an implementer.

## 11. Documentation

- **`docs/features/train.md`** — §2 behavior (medals, the cabinet tab), §4 (the new endpoint + the two set columns), and **remove PR detection from the Phase-3-deferred list** at `:35` and `:395`; drop the `hadPrFromSignal` sentence at `:87`.
- **`docs/features/growth.md`** — the GYM XP paragraph gains the medal bonus.
- **ADR `docs/decisions/0015-medals-derived-not-materialized.md`** — records §4: why medals are replayed rather than stored, and that this reverses the 2026-06-12 YAGNI call.
- `node scripts/lint-docs.mjs` must pass.

## 12. Slices

| slice | content | gate |
|---|---|---|
| **S1** | Contract + Liquibase + entity columns + `MedalEvaluator` + `MedalService` + `GET /api/train/medals` | `MedalEvaluatorTest`, `MedalApiIT` (cabinet only) |
| **S2** | Live wiring: targets persisted on log, medals on the set-log and finish responses, `GymSignal` + the `prBonusXp` fix + the two new properties | `MedalApiIT` (full), `ProgressionServiceIT` |
| **S3** | Frontend data layer + mock evaluator + `MedalToast`/`MedalChip` + `ActiveWorkoutPage` + `WorkoutSummary`; delete the demo PR path | FE tests, both modes, `pnpm build` |
| **S4** | `MedalsPage` + routing + sub-nav; docs (train.md, growth.md, ADR 0015); doc lint | FE tests both modes, `lint-docs` |

S1 → S2 are backend-only and sequential. S3 depends on S1's contract. S4 depends on S3.

## 13. Risks

- **Mock/real divergence.** Two evaluators (Java + TypeScript) implement §6. Mitigation: the FE test table is a deliberate mirror of the backend's, and §6 is written to be the single normative statement of the rules. A shared source is not worth it for one ported function.
- **Backfill surprise.** The cabinet appears full on first open with medals the user never "earned" live. This is intended (decision 4) and the baseline-earns-nothing rule keeps it from being absurd, but the cabinet copy should say the history was reconstructed.
- **Target-medal frequency.** Per-set `TARGET_HIT` on a 20-set workout can mint ~20 medals. The quiet tier and the XP cap contain it; if it still reads as noise, the fallback is the per-exercise variant the user rejected — a copy/aggregation change in the cabinet, not a data change.
