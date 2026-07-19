# Habit engine — reggeli & esti rutin (design spec)

- **Date:** 2026-07-19 · **bd:** `mezo-d1jb` · **Driving ADR:** [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback, not payment)
- **Source:** Jeremy Ethier, *„The Perfect Morning Routine to Build Muscle (Science-Based)"* (https://www.youtube.com/watch?v=eifEiCYH2yc) — the video's six recommendations (circadian-aligned wake, morning sunlight, morning weigh-in, caffeine timing, morning training, protein-rich breakfast) become app-supported habits, plus the evening counterparts they imply (caffeine cutoff, kitchen close, wind-down, on-time bedtime).
- **Decided with Daniel in-session** (7 explicit choices, 2026-07-19).
- **Part 1 of a 4-part decomposition** (agreed up front): ① this habit engine → ② Sleep Cycle screenshot ingestion → ③ Fuel „Mai" slot-timing fix + slot-level AI logging → ④ morning-training reschedule + caffeine/supplement protocol setup. ②–④ get their own specs.

## 1. Goal

A **lean habit engine** with two fixed chains (morning + evening) built on habit-stacking /
habit-building psychology: ordered chain items anchored to existing routines, mostly
**DERIVED completion** over data the user already logs (sleep, weight, meals, intakes,
training) — never self-claimed where a real signal exists — with per-habit skill-mapped XP
riding the existing progression economy, a gentle 28-day **habit strength** consistency model
(no hard streak), and a daypart-aware **`RoutineCard`** on Today + a **„Rutin"** tab on
`/me/growth`. The data model is general (any chain/anchor/metric) so a later evening-plus /
custom-habit expansion needs no redesign; the v1 UI ships exactly the two chains.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Scope | **Lean engine, morning AND evening chains in v1.** General data model (chain, position, anchor, mode, metric), fixed catalog UI. Full custom-habit platform explicitly out of scope. |
| D2 | Architecture | **Own `feature/habit` domain — the quest pattern's mirror** (catalog JSON + per-day table + evaluator over pure reads + lazy read-time evaluation). NOT a quest extension: quests are rotating *offers* (reroll, adaptive difficulty, expiry), habits are *fixed identity chains* — mixing the two psychologies would muddy both domains. NOT FE-mock-first: derived completion is the point, and it needs server reads. |
| D3 | XP target | **Per-habit skill mapping** into the existing bands via a new idempotent `HABIT` progression source (quest-signal twin). Morning weigh-in's „bonus XP" IS the habit XP — a plain weight log earns nothing in real mode, a pre-09:00 one completes M3. Amounts stay ADR-0010 garnish (5–15/habit). |
| D4 | Consistency model | **Habit strength + chain celebration, no hard streak.** Per habit: trailing-28-day `done/(done+missed)` ratio (a lapse fades, never zeroes). Per chain: „perfect day" counting + a quiet celebration toast. `missed` renders dim and silent — no red, no break-punishment (ADR 0010 tone). The account-level 🔥 streak (gamification) is untouched and separate. |
| D5 | Surfaces | **Today `RoutineCard` (daypart-aware) + Growth „Rutin" tab.** Morning shows the morning chain, evening the evening chain, midday a one-row summary. Full both-chain view + strengths + perfect-day counts on `/me/growth` (4th segment). |
| D6 | Target sources | Wake/bed anchors come from the **goal day-planner** (`goal.wakeTime`/`bedTime` — the same source `buildDayPlan` uses; config defaults `06:00`/`23:00` when no active goal). Every other tunable lives in `HabitProperties` (`mezo.habit.*`) — never code. `kitchenClose = bedTime − 90′` mirrors `buildDayPlan`'s derivation. |
| D7 | Evening closure | Three evaluation classes: **intraday** (M1–M6, re-evaluated on every read), **end-of-day negative** (E1/E2 — closed by the nightly `HabitJob` or the next read), **next-day** (E4 — closes when the next morning's sleep log arrives, deadline next-day 12:00 → quiet `missed`). |
| D8 | Manual un-check | Same-day un-check of MANUAL habits allowed; XP reversed by direct skill-row decrement (the `moveActivityXp` precedent), no new `level_up_event`. DERIVED habits are never user-toggleable (honest completion). |
| D9 | Mock parity | Deterministic mock seed (day + summary); mock manual check mutates the cache AND calls `awardGamificationEvent` with the habit XP (the nine-mutation account-XP precedent), so the AppHero total moves in mock mode too. Real mode returns the empty/pending day while loading — no seed fallback. |

## 3. Catalog (v1 — `content/habit-catalog.json`)

Fail-fast loader (`HabitCatalog`, the `QuestCatalog` pattern). `position` = the stacking order;
`anchorCopy` is the habit-stacking cue rendered above the title. All copy HU, identity-vote tone.

| # | key | Habit (HU title) | Anchor | Mode | Metric | Skill | XP |
|---|---|---|---|---|---|---|---|
| M1 | `wake_on_time` | Ébredés időben | — (chain head) | DERIVED | today's sleep log exists AND `wakeup` within `goal.wakeTime ± wake-window` (45′) | LIFE `recovery` | 10 |
| M2 | `morning_sunlight` | Reggeli napfény | „ébredés után" | MANUAL | user check | LIFE `recovery` | 5 |
| M3 | `morning_weigh_in` | Reggeli súlymérés | „fogmosás után" | DERIVED | today's weight log created before `weigh-in-cutoff` (09:00) | LIFE `mindset` | 10 |
| M4 | `morning_coffee` | Gombakávé (Tasty Dose) | „súlymérés után" | DERIVED | a stimulant-kind `supplement_intake` logged today before `morning-window-end` (10:00) | LIFE `productivity` | 5 |
| M5 | `morning_workout` | Reggeli edzés | „kávé után" | DERIVED | a gym session finished OR a run logged today before `workout-cutoff` (12:00) | LIFE `mindset` | 15 |
| M6 | `protein_breakfast` | Fehérjés reggeli | „edzés után" | DERIVED | Σ protein of today's `reggeli`-slot meals ≥ `protein-target-g` (25) | LIFE `cooking` | 10 |
| E1 | `caffeine_cutoff` | Koffein-cutoff | — (chain head) | DERIVED | **no** stimulant-kind intake after `caffeine-cutoff` (14:00) — end-of-day close | LIFE `recovery` | 10 |
| E2 | `kitchen_close` | Konyha zárva | „vacsora után" | DERIVED | last meal log time ≤ `kitchenClose` (= bed − 90′) — end-of-day close | LIFE `recovery` | 10 |
| E3 | `wind_down` | Wind-down, képernyő le | „konyhazárás után" | MANUAL | user check (evening) | LIFE `mindfulness` | 5 |
| E4 | `bed_on_time` | Lefekvés időben | „wind-down után" | DERIVED | NEXT day's sleep log `bedtime ≤ goal.bedTime + bed-grace` (30′) — next-day close | LIFE `recovery` | 15 |

Notes:
- M1/E4 work **today** via the manual `SleepLogSheet`; sub-project ② (Sleep Cycle screenshot
  ingestion) only makes the logging easier — no fallback mode needed.
- M4/E1 read `supplement_intake` joined to stimulant-kind pantry items. Getting the Tasty Dose
  coffee + Origin pre-workout into the stash/protocol is **data setup in sub-project ④**, not code.
- Time-of-day checks (M3/M4/M5) use the row's creation/completion timestamp where one exists;
  where a source only records a date (e.g. a done-date without a time), date-presence counts —
  an honest fallback, never a guess.
- The cold-shower anti-recommendation from the video is deliberately absent.

## 4. Backend design

**Table `habit_day`** (migration `{ts}_mezo-d1jb_create_habit_day.sql`, the `daily_quest`
sibling): `id uuid pk`, `created_by`, soft-delete cols, `habit_date date`, `habit_key varchar(40)`,
`status varchar(8)` (`ck_` pending|done|missed), `done_at timestamptz`, `xp_awarded int`,
`source varchar(7)` (`ck_` DERIVED|MANUAL), partial unique
`uq_habit_day (created_by, habit_date, habit_key) where is_deleted = false`. The same migration
relaxes the released `level_up_event.source_type` CHECK additively: `+= HABIT` (the E1/E2
migration precedent).

**`HabitService.getDay(date)`** — lazy: first read of a date inserts one `pending` row per
enabled catalog entry (guarded against the cron race the way `QuestService.getDay` is), then
runs **`HabitEvaluator`** over the intraday rows: pure reads only —
`SleepLogRepository` (M1), `WeightLogRepository` + created-at (M3), `SupplementIntakeRepository`
(M4/E1), `WorkoutSessionRepository.findDoneInstanceDates` / run-log repo (M5),
`MealRepository` breakfast-slot protein Σ + last-meal time (M6/E2). A `pending → done`
transition stamps `done_at`/`xp_awarded` and calls
**`ProgressionService.applyHabit(HabitSignal)`** → the shared idempotent `award(...)` tail
(`source_type=HABIT`, `source_ref_id=habit_day.id`). Level-up payloads ride the day response.

**`HabitJob`** (nightly, `mezo.techcore.cron.habit-job.enabled`): closes yesterday — evaluates
E1/E2, flips remaining `pending` → `missed` (except E4), and closes any E4 older than its
next-day-noon deadline. E4 otherwise completes on the read that first sees the next morning's
sleep log.

**Strength & summary** (read-time, no new table): per habit
`done / (done + missed)` over the trailing `strength-window-days` (28), `pending` excluded;
`null` (not 0) under `min-sample` (5) closed days. Perfect day = every enabled habit of a chain
`done` that date; the summary endpoint counts them over `summary-days` (30).

**Manual path:** `check` flips a MANUAL `pending → done` (today only) and awards; `uncheck`
(same-day, MANUAL, `done`) flips back and reverses via direct skill-row decrement — no event row.

**Dependency direction:** habit → {biometrics, meal, fuel, train, progression} direct
service/repo reads (the `QuestEvaluator` precedent); nothing depends back on habit —
`feature_slices_are_cycle_free` holds.

## 5. API contract (`api/feature/habit/habit.yml`, tag `Habit`)

- `GET /api/habit/day/{date}` → `HabitDayResponse{ date, habits[], levelUps[] }`.
  `HabitResponse{ id, key, chain (MORNING|EVENING), position, title, why, anchorCopy,
  mode (DERIVED|MANUAL), status (pending|done|missed), doneAt?, xp, strengthPct? }`.
- `POST /api/habit/{key}/check` `{ date }` → `HabitWriteResponse{ habit, levelUps[] }` —
  404 `HABIT_UNKNOWN`, 409 `HABIT_NOT_MANUAL` / `HABIT_NOT_TODAY` / `HABIT_ALREADY_DONE`.
- `DELETE /api/habit/{key}/check?date=` → 200 `HabitResponse` — same-day MANUAL un-check;
  409 `HABIT_NOT_DONE` / `HABIT_NOT_TODAY` / `HABIT_NOT_MANUAL`.
- `GET /api/habit/summary` → `HabitSummaryResponse{ perfectMorningDays30, perfectEveningDays30,
  habits[{ key, strengthPct?, done28, missed28 }] }`.

Controller gated on `mezo.feature.habit.enabled` (off → 404, FE honest-empty). Errors via
`SystemRuntimeErrorException` + `SystemMessage` codes per `error_handling.md`.

## 6. Frontend design

**Data layer** (`data/habit/`): `habitTypes.ts`, `habitApi.ts` (wire ↔ domain off `api.gen.ts`),
`habitMock.ts` (deterministic seed day + summary), `habitHooks.ts` — `useHabitDay(date)`,
`useHabitActions(date)` (`check`/`uncheck`), `useHabitSummary()`; dual-mode via `useDualQuery`
(mock `initialData`, real honest-empty while unresolved), barrel-exported from `data/hooks.ts`.
Query keys `['habitDay', date]`, `['habitSummary']`; a write invalidates both +
`['progressionProfile']`. Mock check also calls `awardGamificationEvent` (D9).

**Today — `RoutineCard`** (`features/today/components/RoutineCard.tsx`, mounted between the
check-in strip and the quick-stats row):
- **Morning daypart:** the MORNING chain as a vertical list — each row: position/link glyph, faint
  `anchorCopy` line, title, status mark (◦ pending / ✓ done / — missed, quest-card idiom),
  `+N XP` chip. The **first pending item glows** (single-next-action psychology). MANUAL rows
  carry a tappable check; **DERIVED rows tap through to their logging surface** (M1 → `/me/sleep`,
  M3 → `/me/weight`, M4 → `/fuel/stack`, M5 → `/train`, M6 → opens `LogMealSheet`) — the quest
  `Naplózz`-chip pattern.
- **Evening daypart:** same anatomy, EVENING chain.
- **Midday:** one summary row (`Reggeli rutin {done}/{total}` + evening preview), the
  `GrowthTodayRow` compactness; ghosts (`null`) when the habit switch is off / no data.
- Chain completion fires one quiet toast via `toastBus` („🌅 Tökéletes reggel" / „🌙 Tökéletes
  este"); skill level-ups ride the existing `LevelUpProvider` overlay with a new HABIT source
  meta (icon ☀️) in `levelUpMeta.ts`.
- Exact visual layout goes through the usual mockup → approve → implement loop at build time.

**Growth — „Rutin" tab:** `/me/growth`'s segmented control gains a 4th segment. Content: both
chains in full (all statuses today), per-habit **strength bars** (the `.skl`/`.bar` idiom), and
the two perfect-day counters (30d). Daily interaction lives on Today; this is the
overview/statistics surface. Reads `useHabitDay(today)` + `useHabitSummary()`.

## 7. Integrations

- **← Biometrics:** M1/E4 from `sleep_log` (bedtime/wakeup), M3 from `weight_log` + creation
  timestamp. No biometrics-side change.
- **← Fuel:** M6 breakfast-slot protein Σ and E2 last-meal time from the `meal` aggregate;
  M4/E1 from `supplement_intake` × stimulant-kind pantry items. No fuel-side change.
- **← Train:** M5 from finished gym sessions / run logs (the `gym_session_done` metric's sibling).
- **→ Progression:** new `HABIT` source on the shared idempotent `award(...)` tail; CHECK
  relaxed additively. Discipline trait and the Growth journal do NOT consume habit signals in v1
  (deliberate — wireable later).
- **→ Today / Growth pages:** `RoutineCard` + the Rutin tab as in §6; `AppHero`'s ⚡ counter
  stays quest-only.

## 8. Configuration

`mezo.feature.habit.enabled` (+ `FeaturesConfiguration` constant + `@ConditionalOnProperty`),
`mezo.techcore.cron.habit-job.enabled`. **`HabitProperties`** (`mezo.habit`, `@Validated`
record): `wake-window-min 45`, `weigh-in-cutoff 09:00`, `morning-window-end 10:00`,
`workout-cutoff 12:00`, `protein-target-g 25`, `caffeine-cutoff 14:00`, `bed-grace-min 30`,
`kitchen-close-offset-min 90`, `default-wake 06:00`, `default-bed 23:00`,
`strength-window-days 28`, `min-sample 5`, `summary-days 30`. XP amounts live in the catalog.

## 9. Testing

**Backend** (`integration_test_framework.md`): `HabitApiIT` extends `ApiIntegrationTest` —
lazy day creation (row-per-enabled-catalog-entry); MANUAL check → done + XP + idempotency
(re-check 409, re-read no double award); un-check reversal (skill row decremented, no event);
DERIVED completion via populators (morning weight log → M3 done; breakfast meal ≥25 g protein →
M6 done; late intake → E1 missed on close); `HabitJob` end-of-day close; E4 next-day close with
and without a sleep log; switch-off → 404; the 409/404 error branches. New domain
table → `ResetDatabase` TRUNCATE list + a `HabitPopulator`. Catalog loader fail-fast unit test.

**Frontend:** hook tests in both modes (mock seed synchronous; real honest-empty + invalidation
fan-out), `RoutineCard` daypart branches + tap-through targets + manual check flow, Growth Rutin
tab render, toast on chain completion. Gate: `pnpm build && pnpm test` +
`VITE_USE_MOCK=true pnpm test` green.

## 10. Out of scope (v1)

- Custom / user-edited habits, catalog management UI (the data model already supports it).
- Push / notification reminders (PWA notifications are their own topic).
- Companion flavor copy on habits, discipline-trait consumption, Growth-journal HABIT rows.
- Sub-projects ② (Sleep Cycle screenshot ingestion), ③ (Fuel „Mai" slot-timing fix + slot-level
  AI logging), ④ (morning-training reschedule + Tasty Dose / Origin pre-workout protocol
  setup) — each gets its own spec, in that order.
