# Habit honest-derivation fix — date-presence metrics (design spec)

- **Date:** 2026-08-05 · **bd:** `mezo-u6jx` (bug, P1) · **Parent feature:** [habit.md](../../features/habit.md) · **Original spec:** [2026-07-19 habit engine](2026-07-19-morning-evening-routine-habit-engine-design.md)
- **Decided with Daniel in-session** (2026-08-05), diagnosis grounded in the **live DB** (offsite dump `mezo-2026-08-05-0919.dump` restored to a throwaway local DB).
- **Companion piece:** the [routine editor spec](2026-08-05-routine-editor-design.md) (`mezo-n5e9`) builds on the same catalog; this fix ships first and standalone.

## 1. Problem — the evaluator punishes LOG time, not the act

Daniel's report: „a habitek csak akkor logolódnak le készre, ha a habitről navigálok át — ha
a súly szekcióban logolok, a habit nem pipálódik." The live data shows the real mechanism —
the wall-clock cutoffs in `HabitEvaluator` compare against the **log-entry timestamp**
(`created_at` / `taken_at`), and Daniel's real logging behavior lands after them:

| Date | `morning_weigh_in` | weight log (local) | verdict |
|---|---|---|---|
| 08-04 | missed | **10:14** | after the 09:00 cutoff |
| 08-03 | done | 06:50 | before |
| 08-02 | missed | **09:47** | after |
| 07-30 | missed | **09:00:20** | missed the cutoff **by 20 seconds** |

| Date | `morning_coffee` | stim intake (local) | verdict |
|---|---|---|---|
| 08-04 | missed | **15:35** | gombakávé retro-logged in the afternoon — `taken_at` records the LOG moment, not the morning consumption |
| 08-01 | done | 06:31 | logged live |
| 07-29 | missed | **16:29** | retro-log again |

Two distinct defects fall out:

1. **Semantics:** `weight_logged_before` (cutoff `weigh-in-cutoff` = 09:00), `stim_intake_before`
   (window `morning-window-end` = 10:00) and the run-branch of `training_done_today`
   (wake + `workout-window-hours`) gate on wall-clock log time. Retroactive logging — which the
   app otherwise encourages — is structurally punished. The quest twins are already
   date-presence (`QuestEvaluator.weight_logged` has no cutoff), so habits are the outlier.
2. **UI staleness (real bug, independent of semantics):** `useStackActions.log/undo`
   (`data/fuel/stackHooks.ts`) invalidates only the intake cache — **not** `['habitDay']` /
   `['dailyQuests']` — so even a metric-satisfying intake leaves the habit row visually
   `pending` until the Today surface remounts. Every other metric-feeding mutation
   (weight/sleep/meal/gym/run, `mezo-pquo`) already fans out.

## 2. Decision — „aznapi log elég" (date-presence)

Daniel's explicit choice (over configurable windows and real-time-entry logging): **a DERIVED
habit completes if the act was logged for that day at all.** The timing coaching stays in the
`anchorCopy` cue („fogmosás után", „súlymérés után") — the *tick* rewards the logged act.

| Metric | Today | Becomes |
|---|---|---|
| `weight_logged_before` | latest weight log `created_at` < 09:00 | **`weight_logged_today`** — a live weight log exists for the date (the quest-twin semantics) |
| `stim_intake_before` | any stim intake `taken_at` < 10:00 | **`stim_intake_today`** — any stim-kind intake exists for the date |
| `training_done_today` (run branch) | run `created_at` < wake + 6h | **any run logged for the date** (gym half already date-presence; the branches unify) |

**Deliberately unchanged** — where the wall-clock IS the habit, honest derivation stays:

- `sleep_wake_window` (Ébredés időben) and `bedtime_next_day` (Lefekvés időben) — the sleep
  log's own `wakeup`/`bedtime` fields are business times, not log-entry times.
- `no_stim_after` (E1 Koffein-cutoff) and `last_meal_before` (E2 Konyha zárva) — timing-essence.
  **Known residual unfairness:** a retro-logged afternoon gombakávé still busts E1 because
  `taken_at` is the log moment. Accepted for now; the honest fix (an optional „mikor
  ittad?" time field on the intake log) is deferred — noted in §5.
- `breakfast_protein` — slot-based (breakfast-slot protein ≥ target), no wall clock involved.
- All intention/ritual metrics — existence checks already.

## 3. Changes

**Backend (`feature/habit`):**

- `HabitEvaluator`: replace the two metric cases with date-presence reads
  (`weight_logged_today`: `findFirstByCreatedByAndDeletedFalseAndDate…().isPresent()`;
  `stim_intake_today`: `!stimIntakes(userId, date).isEmpty()`); drop the run-branch cutoff in
  `training_done_today` (any `r.getDate().equals(date)` run). Update `INTRADAY_METRICS`.
- `content/habit-catalog.json`: `morning_weigh_in.metric` → `weight_logged_today`,
  `morning_coffee.metric` → `stim_intake_today` (catalog is still code in this slice — the
  rename ships atomically with the evaluator; `habit_day` stores keys, not metrics, so history
  is untouched). Copy check: `title`/`why`/`anchorCopy` don't reference the cutoffs — no text change.
- `HabitProperties`: remove `weighInCutoff`, `morningWindowEnd`, `workoutWindowHours` + their
  `mezo.habit.*` yml keys (the `mezo-53su`/`mezo-67rb` removal precedent). `wakeWindowMin`,
  `bedGraceMin`, `kitchenCloseOffsetMin`, `proteinTargetG` stay.
- No contract change, no migration, no quest change (`weight_logged` already date-presence).

**Frontend:**

- `data/fuel/stackHooks.ts`: `log`/`undo` `onSuccess` additionally invalidates
  `['habitDay']` + `['dailyQuests', date]` (the `mezo-pquo` fan-out pattern; real mode only,
  matching the other mutations).

**Semantics note (already-closed rows):** past `missed` rows stay `missed` — `evaluateIntraday`
only flips `pending → done` and history must stay honest. The fix applies from its deploy
forward; no backfill.

## 4. Testing

- `HabitEvaluatorIT`: truth-table update — weight logged any time of day → satisfied; absent →
  not; stim intake late-logged → satisfied; run late in the day → satisfied. The removed-property
  cases (weigh-in cutoff boundary, morning window, run cutoff + ghost-wake back-compat) are deleted.
- `HabitServiceIT`/`HabitApiIT`: unchanged surface — spot-run in the focused gate.
- FE `data/fuel/stackHooks.test`: assert the new invalidation fan-out (the weightHooks test
  precedent); both modes green.
- Focused gate: `./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`
  + `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Full suite: CI.

## 5. Out of scope / deferred

- **Intake „mikor ittad?" time field** (fixes E1 for retro-logs) — deferred; file under the
  routine-editor epic if wanted.
- **Configurable per-habit time windows** — the [routine editor](2026-08-05-routine-editor-design.md)
  data model leaves room (`habit_def` is general), but v1 ships no window editing.
- Backfilling past `missed` rows — deliberately not done (honest history).

## 6. Docs to update in the same change

`docs/features/habit.md` §3 (metric table), §5 (fuel integration note), §9 (gotchas: the
M3-latest-weigh-in gotcha dies with the cutoff) + `docs/features/fuel.md` (stack hooks fan-out).
