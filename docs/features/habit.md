---
title: Habit — Morning & Evening Routine Engine
type: feature-domain
status: done
updated: 2026-07-20
tags: [today, me, growth, fuel, train, backend, frontend, data-layer, progression]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/habit
  - frontend/src/data/habit
  - frontend/src/features/today/components/RoutineCard.tsx
  - frontend/src/features/me/components/RoutinesTab.tsx
  - api/feature/habit/habit.yml
related: [today, growth, me, fuel, train, intention, _platform-data-layer, _platform-api-backend]
---

# Habit — Morning & Evening Routine Engine

> Two fixed habit-stacking chains — a **morning** and an **evening** routine — surfaced as a daypart-aware **`RoutineCard`** in Today's "Teendők ma" zone (`/today`) and a **„Rutin"** tab on the `/me/growth` page. **Status: ✅ done** (backend + FE real + FE mock). Driving spec: [`2026-07-19-morning-evening-routine-habit-engine-design.md`](../superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md); driving ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback, not payment). bd `mezo-d1jb`.

## 1. Summary

**Habit** is a lean habit engine built on habit-stacking psychology: two **fixed identity chains** — 7 MORNING + 5 EVENING catalog habits (incl. the two **intention** habits added by `mezo-a686` — `daily_intention` MORNING / `intention_reflect` EVENING, see [intention.md](intention.md)) — each item anchored to an existing routine ("fogmosás után", "vacsora után"). Most completion is **DERIVED** over data the user already logs (sleep, weight, supplement intakes, training, meals) — a habit is **never self-claimed where a real signal exists** — with two MANUAL exceptions (morning sunlight, evening wind-down). Each habit maps to a **LIFE skill** and earns a small deterministic XP (5–15) through a new idempotent **`HABIT` progression source** — the quest/activity twin. Consistency is a gentle trailing-28-day **habit strength** ratio (a lapse fades, never zeroes) plus a quiet **perfect-day** celebration — **no hard streak, no break-punishment** (the [ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md) tone: `missed` renders dim and silent, no red).

It is deliberately the **quest pattern's mirror, not a quest extension** (spec [D2](../superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md)): quests are rotating *offers* (reroll, adaptive difficulty, expiry), habits are *fixed chains* — same machinery (catalog JSON + per-day table + evaluator over pure reads + lazy read-time evaluation), different psychology. The data model is general (chain/position/anchor/mode/metric) so a later custom-habit expansion needs no redesign; v1 ships exactly the two fixed chains.

Status per layer: **backend** ✅ (`feature/habit` — catalog, `habit_day` table, evaluator, service + nightly close job, controller, `HABIT` progression source), **FE real** ✅ (`RoutineCard` + Rutin tab over the real endpoints), **FE mock** ✅ (deterministic seed day + summary; mock check also moves the account XP total). Design decisions are spec §2 **D1–D9**; the catalog table is spec §3; the three evaluation-closure classes are **D7**.

## 2. User-facing behavior

**Today — `RoutineCard`** (`features/today/components/RoutineCard.tsx`, mounted in the "Teendők ma" zone **between `TodayQuestsCard` and `CheckInStrip`**, `TodayPage.tsx:64`). It is **daypart-aware** (`daypartNow()`, `shared/lib/daypart.ts`):

- **Morning (`reggel`)** → the **MORNING** chain as a vertical list. Each row: a status mark (`◦` pending / `✓` done / `—` missed), the faint `anchorCopy` cue line above the HU title, a `+N XP` chip, and — while pending — one action affordance. The **first pending item glows** (`--wash-lav`, single-next-action nudge). MANUAL rows carry a **`Pipa`** check button; **DERIVED rows tap through to their logging surface** via a **`Logolás`** button (never self-complete — ADR 0010): the CTA map lives in `features/today/logic/habitAction.ts`.
- **Evening (`este`)** → same anatomy over the **EVENING** chain.
- **Afternoon (`delutan`, expandable `mezo-km27`)** → a single compact summary row (`🔁 Reggeli rutin {done}/{morning.length}` + `este: {done}/{evening.length}`) that is a **collapse toggle** (`.rt-toggle` button + rotating chevron, `expanded` state, default collapsed — the midday "not now" state). Tapping it **expands the morning chain inline** (the same `renderRow` list as the morning daypart, since `chain === morning` outside the evening), so a habit missed in the morning can still be **logged retroactively** on Today rather than only linking away to `/me/growth`.
- **Chain completion** fires one quiet celebration toast via `toastBus` — `🌅 Tökéletes reggel` / `🌙 Tökéletes este` — exactly once per mount (a `wasComplete` ref guards re-fires).
- **Level-ups** produced by the read (or a manual check) ride the shared `LevelUpProvider` overlay via `useLevelUp().showLevelUp`, with a new **HABIT** source meta (`A rutin épít.` / chip ☀️) in `features/progression/logic/levelUpMeta.ts`.
- **Honest ghost:** renders `null` when there are no habits (switch off in real mode, or real mode before the day resolves) — no skeleton, no seed leak.

**Growth — „Rutin" tab** (`features/me/components/RoutinesTab.tsx`): the **2nd** segment of the `/me/growth` segmented control — order **Skillek · Rutin · Napló · Kitüntetések** (`GrowthPage.tsx:77-80`). It is the overview/statistics surface (daily interaction stays on Today): the two **perfect-day counters** (`Tökéletes reggelek · 30 nap` / `Tökéletes esték · 30 nap`) over two chain cards (`Reggeli lánc` / `Esti lánc`), each habit rendered as a `.skl` row with its status mark, title, and a **28-day strength bar** (`{pct}%`, or `—` under the min-sample). Reads `useHabitDay(today)` (statuses) + `useHabitSummary()` (strengths + perfect days).

## 3. Architecture & data flow

The domain is the **`QuestService` mirror**: a static catalog → one per-day table → a pure-read evaluator → the shared progression award tail.

```
RoutineCard / RoutinesTab
  → useHabitDay(date) / useHabitActions(date) / useHabitSummary()   (@/data/hooks)
      mock: habitMock seed (+ awardGamificationEvent on check)
      real: habitApi → GET /api/habit/day/{date} | POST/DELETE /api/habit/{key}/check | GET /api/habit/summary
              → HabitController → HabitService
                    ├─ getDay: lazy row-per-catalog-entry (today only) → closePast → evaluateIntraday
                    ├─ check/uncheck: MANUAL, today only
                    └─ summary: 28d strength + 30d perfect days
              → HabitEvaluator (pure reads: sleep/weight/intake/train/meal/goal)
              → ProgressionService.applyHabit / revertHabit  (source_type = HABIT)
              → habit_day (Postgres)
```

- **Lazy day materialization** (`HabitService.getDay`): the first **today** read inserts one `pending` `habit_day` row per catalog entry (`ensureRows`), guarded against the cron race by the **partial-unique index** + a `DataIntegrityViolationException` catch that re-reads the winner's rows. A non-today read never creates rows (past days are read as-is).
- **Three evaluation-closure classes** (spec [D7](../superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md), the metric sets live in `HabitEvaluator`):
  - **INTRADAY** (`INTRADAY_METRICS` — M1 `sleep_wake_window`, M3 `weight_logged_before`, M4 `stim_intake_before`, M5 `training_done_today`, M6 `breakfast_protein`, + the two intention metrics `intention_focus_set` / `intention_reflected` (`mezo-a686`); MANUAL M2/E3 nominally here but skipped): re-evaluated on **every today-read** (`evaluateIntraday`); a `pending → done` transition on this read carries its level-up out on the response.
  - **END_OF_DAY** (`END_OF_DAY_METRICS` — E1 `no_stim_after`, E2 `last_meal_before`): decidable only once the day is over, so they stay `pending` during the day and close on the **nightly `HabitJob`** or the next-day read (`closePast → closeByEvaluation`).
  - **BED_NEXT_DAY** (`METRIC_BED_NEXT_DAY` = E4 `bedtime_next_day`): completes on the read/close that first sees **the next morning's** sleep log; if the **next-day-noon** deadline passes first (`today.isAfter(habitDate+1) || now > 12:00`), it closes quietly `missed`.
- **`closePast`** (called by both the today-read and the cron) flips every stale `pending` row: END_OF_DAY/intraday metrics get one last honest evaluation, E4 gets the deadline logic, unknown/stale catalog keys close quietly `missed`.
- **Completion** (`complete`) stamps `done_at`/`xp_awarded`/`source`, saves, then — when the `ProgressionGate` is available (`ObjectProvider`) — calls `ProgressionService.applyHabit` (idempotent per `habit_day.id`). Award amounts are the catalog XP (deterministic, ADR 0010).
- **Manual path:** `check` flips a MANUAL `pending → done` (today only) and awards; `uncheck` (same-day, MANUAL, `done`) reverts via `revertHabit` — it **soft-deletes** the `level_up_event` and **directly decrements** the skill row (the `moveActivityXp` precedent, no new event), so a re-check can cleanly re-award.
- **Read-triggered heartbeat:** the FE day read runs `staleTime: 0` in real mode (`useHabitDay`) so the server re-evaluates derived completion on every mount/focus — the READ *is* the evaluation trigger, mirroring `useDailyQuests`.

## 4. Data model & API

**Table `habit_day`** (migration [`202607192100_mezo-d1jb_create_habit_day.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607192100_mezo-d1jb_create_habit_day.sql), the `daily_quest` sibling): `id uuid pk`, `created_by`, `is_deleted`/`created_at`, `habit_date date`, `habit_key varchar(40)`, `status varchar(8)` (`ck_` `pending|done|missed`), `done_at timestamptz`, `xp_awarded int` (`ck_` ≥ 0), `source varchar(7)` (`ck_` null|`DERIVED`|`MANUAL`). Identity: **partial unique** `uq_habit_day_user_date_key (created_by, habit_date, habit_key) where is_deleted = false` (+ `idx_habit_day_user_date`). The **same migration** relaxes the released `level_up_event.source_type` CHECK additively: `+= HABIT`.

**Schema change #2 — `level_up_event` partial-unique** (migration [`202607192130_mezo-d1jb_level_up_event_partial_unique.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607192130_mezo-d1jb_level_up_event_partial_unique.sql)): the habit **un-check** is the **first** source to soft-delete a `level_up_event` and later re-award with the same `(created_by, source_type, source_ref_id)`. The original plain unique constraint spanned soft-deleted rows, so the re-insert would collide — this converts it to the house-standard **partial unique** index (`where is_deleted = false`): one *live* award per source ref, soft-deleted rows ignored. GYM/RUN/SPORT/QUEST/ACTIVITY keep identical live-row idempotency.

**Catalog** (`content/habit-catalog.json`, fail-fast `HabitCatalog` loader — the `QuestCatalog` pattern): **12 `HabitDef`s** (7 MORNING + 5 EVENING — the base 6+4 plus the two `mezo-a686` intention habits: `daily_intention` MORNING pos 7 / `intention_reflect` EVENING pos 5, both DERIVED, `mindset` LIFE skill). Each carries `key`, `chain`, `position` (stacking order), `title`/`why`/`anchorCopy` (all HU), `mode` (DERIVED|MANUAL), `metric`, `skillKey` (a LIFE skill), `skillKind` (`LIFE`), `xp` (5–15). The loader validates chain/mode membership, `skillKind == LIFE`, `5 ≤ xp ≤ 15`, and the **MANUAL ⇔ metric == "manual"** invariant — an out-of-band row fails startup. See the habit spec §3 for the base 10-row table + [intention.md §2](intention.md) for the two intention rows.

**Contract** ([`api/feature/habit/habit.yml`](../../api/feature/habit/habit.yml), tag `Habit` → `HabitApi`, `HabitController implements HabitApi`, gated on `mezo.feature.habit.enabled` — off ⇒ the whole surface 404s, no habit beans exist):

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/habit/day/{date}` | `getHabitDay` | `HabitDayResponse{date, habits[], levelUps[]}` — lazily creates+evaluates today's rows | — |
| `POST /api/habit/{key}/check` | `checkHabit` (`{date}`) | `HabitWriteResponse{habit, levelUps[]}` | 404 `HABIT_UNKNOWN`; 409 `HABIT_NOT_MANUAL` / `HABIT_NOT_TODAY` / `HABIT_ALREADY_DONE` |
| `DELETE /api/habit/{key}/check?date=` | `uncheckHabit` | `HabitResponse` — same-day MANUAL un-check | 404 `HABIT_UNKNOWN`; 409 `HABIT_NOT_MANUAL` / `HABIT_NOT_TODAY` / `HABIT_NOT_DONE` |
| `GET /api/habit/summary` | `getHabitSummary` | `HabitSummaryResponse{perfectMorningDays30, perfectEveningDays30, habits[HabitStrength{key, strengthPct?, done28, missed28}]}` | — |

`HabitResponse{id, key, chain, position, title, why, anchorCopy, mode, status, doneAt?, xp, strengthPct?}`; `strengthPct` is the trailing-28-day `done/(done+missed)` ratio, **`null` under min-sample** (5 closed days). Errors go through `SystemRuntimeErrorException` + `SystemMessage` per [`error_handling.md`](../references/error_handling.md).

**FE types** (`data/types.ts`): `HabitChain`/`HabitMode`/`HabitStatus`, `HabitItem`, `HabitStrengthRow`, `HabitSummary`. Wire↔domain mapping in `data/habit/habitApi.ts` off `api.gen.ts`.

## 5. Integrations

All inbound edges are **pure reads** — habit depends on {biometrics, meal, fuel, train, goal, progression}; nothing depends back on habit (`feature_slices_are_cycle_free` holds).

- **← Biometrics** (`HabitEvaluator`): M1 `sleep_wake_window` and E4 `bedtime_next_day` from `SleepLogRepository` (wakeup / next-day bedtime vs the goal anchor ± window); M3 `weight_logged_before` from `WeightLogRepository` + the row's `created_at` vs `weigh-in-cutoff`. No biometrics-side change.
- **← Fuel** (`HabitEvaluator`): M6 `breakfast_protein` = Σ protein of today's `breakfast`-slot meals via `FuelDayService.getDay` ≥ `protein-target-g`; E2 `last_meal_before` = last `meal` `logged_at` ≤ `kitchenClose`; M4 `stim_intake_before` / E1 `no_stim_after` join `SupplementIntakeRepository` to **stim-kind** `PantryItemRepository` items. No fuel-side change.
- **← Train** (`HabitEvaluator`): M5 `training_done_today` = a finished gym session (`WorkoutSessionRepository.findDoneInstanceDates`) **or** a run logged today before `workout-cutoff` (`RunSessionLogRepository`).
- **← Intention** (`HabitEvaluator`, `mezo-a686`): the two intention habits complete off `IntentionFocusRepository` (`intention_focus_set` = today has ≥ 1 live focus) and `DailyIntentionRepository` (`intention_reflected` = today's reflection set) — both plain JPA beans injected directly (the cross-feature-read precedent). RoutineCard's `daily_intention`/`intention_reflect` rows open `IntentionSheet`/`ReflectSheet` (the honest log surface). One-directional (habit → intention). See [intention.md](intention.md).
- **← Goal** (`HabitTargets`): the wake/bed anchors come from the **active goal** day-planner (`goal.wakeTime`/`bedTime`, the `buildDayPlan` source), falling back to config `default-wake` `06:00` / `default-bed` `23:00`; `kitchenClose = bedTime − kitchen-close-offset-min (90′)`.
- **→ Progression** (`ProgressionService.applyHabit` / `revertHabit`, source `HABIT`): completion rides the shared idempotent `award(...)` tail (`source_type=HABIT`, `source_ref_id=habit_day.id`) onto the habit's **LIFE** skill; un-check reverts by soft-deleting the event + decrementing the skill row directly (§4 schema change #2). The CHECK was relaxed additively. Discipline trait and the Growth journal do **not** consume habit signals in v1 (deliberate — wireable later).
- **→ Today / Growth surfaces:** `RoutineCard` (Today) + the Rutin tab (`/me/growth`) as in §2. The `AppHero` ⚡ counter stays **quest-only** — habits do not feed it.
- **↔ Account progression / `AppHero` (mock-mode side-effect):** in **mock mode** `useHabitActions.check` also calls `awardGamificationEvent(qc, {type:'HABIT', xpOverride})` (`data/habit/habitHooks.ts:58`) so the `AppHero` account XP/streak/coin ledger moves in an offline demo — the tenth call site of the mock account-XP precedent (see [growth.md §2](growth.md), "Account progression"). `HABIT` is registered in `gamificationTypes.XpEventType` + `xpValues` (`XP_VALUES.HABIT = 0`, `DAILY_CAPS.HABIT = 10` — the amount comes from the habit's own `xpOverride`). **Real mode never calls it** (account XP is derived from the profile there). DERIVED completions carry no mock account-XP (there is no mock "derived" event, same as quests).

## 6. How to use it (consume)

```ts
import { useHabitDay, useHabitActions, useHabitSummary } from '@/data/hooks'

const { habits, levelUps, mode } = useHabitDay(date)      // date = 'YYYY-MM-DD'; habits: HabitItem[]
const { check, uncheck, pending, consumeLevelUps } = useHabitActions(date)
const { data: summary } = useHabitSummary()               // { perfectMorningDays30, perfectEveningDays30, habits[] }

await check('morning_sunlight')                            // MANUAL only → resolves the write's levelUps
```

- `useHabitDay` is a **manual dual-mode** shape (like `useDailyQuests`, not `useDualQuery`): real mode runs `staleTime: 0` and returns the **empty day** (never the seed) while unresolved. `levelUps` is non-empty only on the read that performed the completion — feed `levelUps[0]` to `showLevelUp(...)` then call `consumeLevelUps()` (RoutineCard does this in an effect).
- `check(key)` resolves the write's `levelUps` array; the caller surfaces `lu?.[0]` to the overlay.
- Ghost-guard: `habits.length === 0` → render nothing (RoutineCard's honest ghost). Never import `habitApi`/`habitMock` directly — go through `@/data/hooks`.
- Query keys: `['habitDay', date]`, `['habitSummary']`; a real-mode write invalidates both + `['progressionProfile']`.

## 7. How to extend it

**Add a habit to a chain:** append a `HabitDef` to `content/habit-catalog.json` (unique `key`, correct `chain`/`position`, a LIFE `skillKey`, `xp` 5–15, and the MANUAL ⇔ `metric == "manual"` invariant — the loader fails fast otherwise). Then:
- **MANUAL habit** (`mode: "MANUAL"`, `metric: "manual"`): no evaluator work — it completes via the `Pipa` check. Add its key to `habitAction`'s implicit path (MANUAL already maps to `{kind:'check'}`).
- **DERIVED habit:** add a `case` to `HabitEvaluator.satisfied` reading the owning feature's repository/service (**pure reads only** — honest completion), and register the metric in the right closure set (`INTRADAY_METRICS` / `END_OF_DAY_METRICS` / `METRIC_BED_NEXT_DAY`) so `evaluateIntraday`/`closePast` route it. Optionally add a **CTA nav target** in `features/today/logic/habitAction.ts` (`NAV_BY_KEY`, or a bespoke `kind` like `protein_breakfast`'s meal-sheet) so the DERIVED row taps through to its logging surface.
- New tunable → `HabitProperties` (`mezo.habit.*`), never a code constant ([`configuration_conventions.md`](../references/configuration_conventions.md)). New XP → the catalog.
- **Mock parity:** mirror the new row in `data/habit/habitMock.ts` (`mockHabitDay` + `mockHabitSummary`) so both `pnpm test` modes stay green.
- House standards: contract-first ([`api_contract_conventions.md`](../references/api_contract_conventions.md)), backend per [`docs/references/*.md`](../references/), dual-mode hook recipe in [`_platform-data-layer.md`](_platform-data-layer.md).

A whole new chain or custom/user-edited habits are **out of scope** in v1 (the data model already supports them — spec §10).

## 8. Testing

- **Backend ITs** (`feature/habit/`, extend `ApiIntegrationTest`/`AbstractIntegrationTest` + real Postgres; data via `support/populator/HabitPopulator`, `habit_day` in `ResetDatabase`): `HabitCatalogIT` (loader fail-fast + invariants), `HabitDayEntityIT` (DDL/soft-delete), `HabitEvaluatorIT` (the metric truth table — wake window, weigh-in cutoff, stim before/after, training done, breakfast protein, kitchen close, next-day bedtime, unknown-metric → false), `HabitServiceIT` (lazy creation, intraday completion + XP, close/miss, E4 next-day close with/without a sleep log, un-check reversal), `HabitApiIT` (HTTP: MANUAL check → done+XP, idempotent re-check 409, un-check, the 404/409 branches), `HabitJobIT` (nightly close). Progression: `ProgressionHabitIT` (`applyHabit` idempotency + `revertHabit` decrement/soft-delete). `QuestApiIT` is run in the same focused gate to catch progression-shared regressions.
- **FE** (both modes green): `data/habit/habitHooks.test.tsx` (dual-mode read, mock check cache-patch + `awardGamificationEvent`, real invalidation fan-out, summary via `useDualQuery`). RoutineCard daypart branches + tap-through targets + toast/level-up and the Rutin tab render are covered under `features/today` / `features/me`.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`.

## 9. Decisions, gotchas & deferred

- **Decisions:** spec §2 **D1–D9** — own `feature/habit` domain (the quest mirror, D2), per-habit LIFE-skill XP via the `HABIT` source (D3), habit-strength + perfect-day, no hard streak (D4), Today `RoutineCard` + Growth Rutin tab (D5), goal-planner wake/bed anchors + `HabitProperties` for everything else (D6), the three closure classes (D7), same-day MANUAL un-check with direct decrement (D8), mock parity that also moves the account XP total (D9). ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md) is the tone contract (no failure state, no break-punishment).
- **Gotcha — E4's noon deadline:** `bed_on_time` completes only when the **next** morning's sleep log arrives; past next-day 12:00 (`closePast`) it closes quietly `missed`. A late-arriving sleep log after the deadline no longer counts.
- **Gotcha — vacuous kitchen-close:** E2 `last_meal_before` yields **`true`** when **no** meals were logged that day (nothing eaten after close ⇒ the habit is honestly kept), not `missed`.
- **Gotcha — gym date-presence fallback:** finished gym sessions have no `completed_at`, so M5 counts a **done instance on the date** (date-presence, an honest fallback per spec §3) rather than a wall-clock check; the run half still applies the `workout-cutoff` time.
- **Gotcha — latest-weigh-in decides M3:** the evaluator reads the day's **latest** weight log (`findFirst…OrderByCreatedAtDesc`); a second, later weigh-in after the cutoff would flip an already-derived M3 back to un-satisfiable on a fresh evaluation before it's marked `done`.
- **Gotcha — END_OF_DAY habits show `pending` all day:** E1/E2 are not in `INTRADAY_METRICS`, so the today-read never completes them — they resolve only at the nightly close or the next-day read. Expected, not a stuck row.
- **Gotcha — MANUAL habits are never auto-completed:** M2/E3 nominally sit in the intraday set but `evaluateIntraday` skips `metric == "manual"` — they complete solely via the `check` write (honest self-claim), and quietly `missed` at close if untapped.
- **Gotcha — the perfect toast fires on mount:** `RoutineCard`'s `wasComplete` ref starts `false`, so a chain that is already complete when the card first mounts emits the celebration toast once on that mount (an accepted "welcome back" chime, not a per-completion-only event).
- **Deferred (spec §10 / sub-projects ②③④):** custom/user-edited habits + catalog-management UI; PWA reminder notifications; companion flavor copy + discipline-trait/Growth-journal HABIT consumption; and the three sibling specs — ② Sleep Cycle screenshot ingestion, ③ Fuel „Mai" slot-timing fix + slot-level AI logging, ④ morning-training reschedule + Tasty Dose/Origin protocol data setup.

## 10. Key files

- **Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/habit/`): `HabitCatalog.java` + `content/habit-catalog.json` (12 habits — incl. the 2 `mezo-a686` intention habits) · `entity/HabitDayEntity.java` · `repository/HabitDayRepository.java` · `service/{HabitService,HabitEvaluator,HabitTargets,HabitJob}.java` · `controller/HabitController.java` · `mapper/HabitMapper.java` · `config/HabitProperties.java`. Progression seam: `feature/progression/habit/HabitSignal.java` + `ProgressionService.{applyHabit,revertHabit}` (`SOURCE_HABIT`). Switches: `FeaturesConfiguration.{HABIT_SWITCH,HABIT_JOB_SWITCH}`.
- **Migrations:** `…/202607192100_mezo-d1jb_create_habit_day.sql` (table + `level_up_event.source_type += HABIT`) · `…/202607192130_mezo-d1jb_level_up_event_partial_unique.sql` (soft-delete-aware idempotency).
- **Contract:** `api/feature/habit/habit.yml` (tag `Habit`, 4 endpoints, `HabitResponse`/`HabitDayResponse`/`HabitWriteResponse`/`HabitSummaryResponse`/`HabitStrength`/`HabitCheckRequest`).
- **FE data:** `frontend/src/data/habit/{habitApi,habitMock,habitHooks}.ts` (+ barrel line in `data/hooks.ts`; types in `data/types.ts`). `HABIT` XP source in `data/gamification/{gamificationTypes,xpValues}.ts`; source meta in `features/progression/logic/levelUpMeta.ts`.
- **FE UI:** `frontend/src/features/today/components/RoutineCard.tsx` (mounted `TodayPage.tsx:64`) + `features/today/logic/habitAction.ts` (DERIVED-row CTA map) · `frontend/src/features/me/components/RoutinesTab.tsx` (Rutin tab, `GrowthPage.tsx:78/115`).
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/habit/{HabitCatalogIT,HabitDayEntityIT,HabitEvaluatorIT,HabitServiceIT,HabitApiIT,HabitJobIT}.java` + `feature/progression/ProgressionHabitIT.java` + `support/populator/HabitPopulator.java` · `frontend/src/data/habit/habitHooks.test.tsx`.
- **Docs:** spec [`docs/superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md`](../superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md) · ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md).
</content>
</invoke>
