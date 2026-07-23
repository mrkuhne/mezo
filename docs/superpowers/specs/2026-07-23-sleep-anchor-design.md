# Sleep goal + day-anchor — the Sleep feature as the day's timing foundation (design spec)

- **Date:** 2026-07-23 · **bd:** `mezo-dbsr` · **Related ADRs:** [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback) · [0012](../../decisions/0012-consumer-owned-llm-ports.md) (consumer-owned LLM port — for the follow-on screenshot slice)
- **Sources:** (1) owner insight — the sleep goal should be the foundation everything derives from; (2) **Matthew Walker** on *The Diary of a CEO* (https://www.youtube.com/watch?v=qxxnRMT9C-8) — "regularity is king": going to bed & waking at the **same time (±15 min), weekday or weekend**, beat sleep *quantity* at predicting all-cause mortality (UK Biobank ~60k: most-vs-least-regular → −49% all-cause mortality, −57% cardiometabolic disease, −39% cancer mortality). Duration target is a **7–9 h range** (debunks "8 h for everyone"). **Sleep efficiency (asleep ÷ in-bed) ≥ 85%** is the one tracker metric he endorses.
- **Decided with Daniel in-session** (6 explicit choices, 2026-07-23) + a browser mockup of the SleepPage/SleepGoalSheet, approved.
- **First of a 3-slice Sleep effort:** ① **this** (goal + anchor + enriched log + manual logging) → ② Sleep Cycle **screenshot ingestion** (LLM-vision extraction into this slice's enriched model) → ③ later practical layers from the video (sleep-banking mode, calm-toolkit, motivation cards). The pending Fuel "Mai" slot-fix + morning-training reschedule become **consumers** of this anchor.

## 1. Goal

Make the **Sleep feature** own a first-class **sleep goal** — a target duration plus one fixed end (WAKE or BED), from which the other end is derived — and make that wake/bed pair the **single source of truth for the day's timing anchor**, replacing the anchor currently buried in the weight goal's "Napi ritmus" day-planner. Surface it on **SleepPage** with a sleep-goal card + a **regularity score** (±15 min adherence, the video's #1 lever) + **sleep efficiency** (≥85%). Enrich `sleep_log` so a manual log — and, next slice, a Sleep Cycle **screenshot** — can store real asleep-vs-in-bed time and the phase breakdown. No new gamification; the existing `wake_on_time`/`bed_on_time` habits simply re-center on the sleep goal.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Goal model | **Target duration + choose the fixed end.** `target_minutes` (default 480 = 8 h; UI shows the 7–9 h range) + `anchor` (`WAKE`|`BED`, default `WAKE`) + `anchor_time`. The other end is **derived** (`WAKE 06:00` + 8 h → bed `22:00`). Circadian-first default (fixed wake anchors the clock); flexible for evening-fixed people. Matches Walker's "regularity is king." |
| D2 | Regularity band | **±15 min** (`regularity_band_min`, default 15) — Walker's threshold. Drives the **regularity score**, weekend = weekday. |
| D3 | Anchor migration | **Sleep goal = single source of truth; consumers repointed.** A new per-user `sleep_goal` (singleton, the `intention_creed` shape) owns wake/bed; `HabitTargets`, `buildDayPlan`, `timelineHooks`, `buildProtocol` read it; "Napi ritmus" editing moves from `EditGoalSheet` to SleepPage; `goal.wakeTime/bedTime` retired, migration copies existing values (or config defaults 06:00/23:00). **`mealsPerDay` stays on the goal** this slice (eating cadence, a Fuel concern → relocated in the Fuel slot-fix slice). |
| D4 | Derived time on the wire | The `GET /api/sleep/goal` response returns **both** `wakeTime` and `bedTime` (derived server-side from `anchor`/`anchor_time`/`target_minutes`), so backend (HabitTargets) and FE (buildDayPlan) read one identical derivation. |
| D5 | Enriched log | `sleep_log` gains nullable columns so a tracker/screenshot can store richer data than a manual log: `in_bed_min` (accurate efficiency), phase minutes `awake_min`/`light_min`/`rem_min`/`deep_min`, `source_quality_pct` (0–100 tracker quality), `source` (`manual`|`screenshot`, default `manual`). `duration_h` stays the canonical **asleep** duration (existing UI/consumers unchanged). |
| D6 | Efficiency | **`efficiency = asleep ÷ in-bed`.** `in_bed_min` present → `duration_h·60 / in_bed_min`; else fall back to `duration_h·60 / (wakeup − bedtime)`. Target ≥ 85% (Walker). |
| D7 | Habit re-center (not tighten) | `wake_on_time`/`bed_on_time` re-center on the sleep goal, but keep their **generous config window (45 min)** — a habit shouldn't feel "failed" at 20 min off; the strict ±15 is only the *score*. Two purposes: the habit encourages, the score measures. |
| D8 | Screenshot deferred | This slice ships **manual logging into the enriched model**. The Sleep Cycle **screenshot LLM-vision** extraction is the immediate follow-on slice, landing into the model D5 establishes (the meal-ai-draft / pantry-scrape consumer-owned-port precedent, ADR 0012). |

## 3. Backend design (`feature/biometrics/sleep`)

The sleep domain already lives here (`sleep_log` + `SleepLogService`/`Controller`). Add:

- **Table `sleep_goal`** (migration `{ts}_mezo-dbsr_create_sleep_goal.sql`): per-user singleton (partial-unique `(created_by) where is_deleted = false`, the `intention_creed` shape) — `target_minutes int` (`ck` 1..1440), `anchor varchar(4)` (`ck` WAKE|BED), `anchor_time varchar(5)`, `regularity_band_min int` (default 15). `extends OwnedEntity`, soft delete.
- **Enrich `sleep_log`** (same migration, additive `ALTER TABLE ADD COLUMN`, all **nullable**): `in_bed_min int`, `awake_min int`, `light_min int`, `rem_min int`, `deep_min int`, `source_quality_pct int` (`ck` 0..100), `source varchar(10)` (`ck` manual|screenshot, default 'manual'). No change to existing columns.
- **Anchor migration — none needed (runtime default handles it).** The migration only creates schema. `SleepGoalService.getGoal` returns a **config-default ghost** (WAKE 06:00 / 480 / band 15) when no row exists, so every user has a working anchor immediately; the first `PUT` persists their real goal. Existing `goal.wake_time/bed_time` columns are left in place but **unread** (a later cleanup migration drops them). A convenience: if the demodata owner has a `wake_time`/`bed_time` on their active goal, the owner-seed (`@Profile("demodata")`, Java per house rules) writes a matching `sleep_goal` so the demo starts pre-filled — optional, not required for correctness.
- **`SleepGoalService`** (gated `mezo.feature.sleep-goal.enabled`): `getGoal(userId)` → composes `{ targetMinutes, anchor, anchorTime, wakeTime (derived), bedTime (derived), regularityBandMin }` (derivation: WAKE → bed = wake − target (mod 24h); BED → wake = bed + target); when no row exists returns the config default (WAKE 06:00, 480, band 15) — never 404. `setGoal(userId, req)` upserts (validate target 1..1440, anchor ∈ {WAKE,BED}, anchor_time HH:mm, band ≥ 1). `SleepAnchorPort` (a tiny read interface `Resolved(LocalTime wake, LocalTime bed)`) that `HabitTargets` consumes — replacing its current `GoalRepository` read (D3).
- **Enriched write:** the existing `POST /api/biometrics/sleep` `LogSleepRequest` gains the D5 optional fields; `SleepLogMapper` maps them; unset → null (manual path). `SleepLogResponse` returns them for the FE efficiency/phase display.
- **Config:** `mezo.feature.sleep-goal.enabled` (+ `FeaturesConfiguration` constant + `@ConditionalOnProperty`). `SleepGoalProperties` (`mezo.sleep`, `@Validated`): `default-target-min 480`, `default-anchor WAKE`, `default-wake 06:00`, `default-bed 23:00`, `regularity-band-min 15`, `regularity-window-days 14`, `efficiency-target-pct 85`.
- **Dependency direction:** habit → sleep (via `SleepAnchorPort`), fuel → sleep (FE reads the goal). Sleep depends on neither. `feature_slices_are_cycle_free` holds; `HabitTargets` swaps its `GoalRepository` dependency for `SleepAnchorPort`.

## 4. API contract (`api/feature/sleep/sleep-goal.yml`, tag `Sleep`)

- `GET /api/sleep/goal` → `SleepGoalResponse{ targetMinutes, anchor (WAKE|BED), anchorTime, wakeTime, bedTime, regularityBandMin }` (config-default composition when unset; never 404).
- `PUT /api/sleep/goal` `SetSleepGoalRequest{ targetMinutes, anchor, anchorTime, regularityBandMin? }` → `SleepGoalResponse` (400 `SLEEP_GOAL_INVALID` on bad target/anchor/time).
- The enriched sleep-log fields ride the **existing** `sleep.yml` `LogSleepRequest`/`SleepLogResponse` (additive optional properties — no new endpoint). Controller gated on `mezo.feature.sleep-goal.enabled` (off → 404, FE honest-default).

## 5. Frontend design

**Data layer** (`data/me/sleepHooks.ts`): add `useSleepGoal()` + `useSleepGoalActions()` (dual-mode via `useDualQuery`; mock seed = WAKE 06:00 / 480 / band 15 → derived bed 22:00; a write invalidates `['sleepGoal']` + `['habitDay']` + `['fuelDay']` + `['fuelTimeline']` since the anchor feeds them). `useSleep` gains the enriched fields on each entry. A pure **`sleepStats.ts`** (the `weightStats.ts` sibling): `regularityScore(logs, goal, windowDays)` (fraction of the last-N nights whose bedtime AND wakeup fall within `±band` of the derived targets) and `efficiencyPct(entry)` (D6). No new backend read for the scores.

**SleepPage** (`features/me/pages/SleepPage.tsx`) — the approved mockup, above the kept last-night hero:
- **Sleep-goal card** (the anchor): a night arc — derived/fixed **bed 🛏️ ↔ wake ☀️** with the `{target} ó cél` pill on the lav→sky thread, the „a rendszeresség a király" line + the `±{band}p` sage pill, and a `szerkeszt` button opening `SleepGoalSheet`.
- **Two score cards:** **Rendszeresség** ring (`regularityScore`, `{windowDays} nap · ±{band}p`) + **Hatékonyság** ring (last-night `efficiencyPct`, „cél ≥ 85%").
- The existing **last-night hero** stays, enriched with a `+{Δ}p vs. cél lefekvés` stat and the night's efficiency; the trend chart + last-7 log rows are unchanged.
- **`SleepGoalSheet`** (`features/me/sheets/`): a `<Sheet>` — target-duration stepper (7–9 h hinted), a fixed-end segmented toggle (☀️ Ébredés / 🛏️ Lefekvés), the fixed `<input type=time>`, and a **live-derived** other-end read-out; save → `setGoal`.
- **`SleepLogSheet`** (manual) gains an optional „Ágyban" (in-bed) field so a careful manual logger can get true efficiency; phase fields are **not** in the manual sheet (they come from the screenshot slice). Ghost/empty states unchanged.

**Repoint the anchor consumers** (off `useGoal().goal.wakeTime/bedTime` → `useSleepGoal()`): `buildDayPlan` inputs, `timelineHooks`, `buildProtocol`. **`EditGoalSheet`** drops the wake/bed rows of its "Napi ritmus" section (moved to SleepPage) and keeps only the `mealsPerDay` stepper (D3).

## 6. Integrations

- **→ Habit:** `HabitTargets` reads `SleepAnchorPort` (was `GoalRepository`); `wake_on_time`/`bed_on_time` re-center on the sleep goal, window stays config (D7). No catalog change.
- **→ Fuel:** `buildDayPlan`/`timeline`/`buildProtocol` read wake/bed from `useSleepGoal`; meal-slot / kitchen-close / caffeine-cutoff derivation is unchanged, just re-sourced.
- **→ Me / weight goal:** `EditGoalSheet` loses the wake/bed editing (SleepPage owns it); `goal.wakeTime/bedTime` unread (columns kept for a later drop).
- **← Screenshot slice (②, next):** the LLM-vision extractor writes into the D5 enriched `sleep_log` via the same `POST /api/biometrics/sleep`.

## 7. Testing

**Backend** (`integration_test_framework.md`): `SleepGoalApiIT` — get default-when-unset (no 404), upsert + derivation both anchors (WAKE→bed, BED→wake, midnight wrap), 400 on bad input, switch-off → 404; `SleepLogEnrichedIT` — POST with the new optional fields round-trips + null when omitted; `HabitTargetsSleepIT` (or extend the habit evaluator IT) — `wake_on_time`/`bed_on_time` center on the sleep goal via `SleepAnchorPort`. New table → `ResetDatabase` TRUNCATE list + a `SleepGoalPopulator`; enriched columns need no new populator.

**Frontend:** `sleepStats` pure tests (regularity fraction incl. the ±band boundary + midnight-wrap; efficiency with/without `in_bed_min`); `useSleepGoal` both modes (default-when-unset, derivation, invalidation fan-out); `SleepGoalSheet` (anchor toggle flips which end is derived, live read-out); `SleepPage` (goal card + two scores + enriched hero); repointed `buildDayPlan`/timeline read the sleep goal. Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Visual: `/me/sleep` is **not** in the visual-golden set (only today/me/me-cel/insights-*), so no golden refresh expected.

## 8. Out of scope (this slice)

- **Sleep Cycle screenshot LLM-vision ingestion** (slice ②) — the enriched model lands here, the extractor next.
- The video's later practical layers (slice ③): sleep-banking mode, get-out-of-bed 20-min timer, calm-toolkit (box-breathing/body-scan), motivation/education stat cards, T-60/T-90 wind-down nudges (wind-down/caffeine/kitchen-close already exist as habits).
- Dropping the now-unread `goal.wake_time/bed_time` columns (a later cleanup migration).
- Relocating `mealsPerDay` to Fuel (the Fuel "Mai" slot-fix slice).
- Phase-based sleep scoring / deep-REM analytics beyond the raw phase minutes.
