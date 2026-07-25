# Morning-training reschedule + Tasty Dose/Origin protocol seed — design

- **Date:** 2026-07-25 · **bd:** `mezo-67rb` · **Branch:** `feat/morning-training`
- **Source:** Jeremy Ethier, *"The Perfect Morning Routine to Build Muscle"* — rec #5 (morning
  training reinforces the wake anchor; see
  [`research/concepts/morning-routine.md`](../../research/concepts/morning-routine.md)). This is
  **sub-project ④**, the last unbuilt piece of the video-1 4-part decomposition
  (① habit engine `mezo-d1jb` → ② sleep screenshot `mezo-66ab` → ③ Fuel slot-timing `mezo-53su` → ④ this).
- **Cluster context:** [`2026-07-23-sleep-routine-cluster-notes.md`](2026-07-23-sleep-routine-cluster-notes.md) §3/§5 —
  the remaining **anchor consumer** after the Fuel „Mai" slot-timing slice.
- **Approved in brainstorm (2026-07-25):** product shape = nudge + one-tap reschedule; placement =
  Train · Mai; anchor depth = FE **and** BE share one wake-derived window; data setup = demodata
  seed (which reaches prod) + mock parity.

## 1. What it is

Two halves, one slice:

1. **Morning-training reschedule** — the morning training window stops being a static 12:00
   config and derives from the sleep goal's **wake anchor**; a gentle card on the Train „Mai" tab
   offers a one-tap move of out-of-window gym slots into the morning window.
2. **Tasty Dose / Origin protocol data setup** — the habit-engine spec deferred this verbatim:
   *"Getting the Tasty Dose coffee + Origin pre-workout into the stash/protocol is data setup in
   sub-project ④, not code."* An idempotent demodata seed lands the two real stim products as
   `pantry_item` rows + an active `protocol` when none exists, so the M4 `morning_coffee` and
   E1 `caffeine_cutoff` DERIVED habits can complete from real intake logs.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | **One window formula everywhere:** morning-training window = **[wake + 60′, wake + 6h]**, wake from the sleep anchor (`useSleepGoal()` on the FE, `SleepAnchorPort` on the BE). `wake + 6h` reproduces the current static 12:00 at the 06:00 config-ghost wake — zero behavior change until a goal is saved. |
| D2 | **BE:** the `mezo.habit.workout-cutoff: "12:00"` yml key + `HabitProperties.workoutCutoff` are **removed**; new `mezo.habit.workout-window-hours: 6`. `HabitEvaluator` M5 (`morning_workout`) cutoff = anchor wake + window-hours — the `mezo-53su` CaffeineCutoffPort precedent (static key out, anchor-derived value in). The 60′ start offset is FE-only (the `buildDayPlan` "reggeli = wake+45" idiom); the habit metric needs only the cutoff. |
| D3 | **FE nudge:** new `MorningTrainingCard` on `TrainTodayPage` + pure logic in `features/train/logic/morningWindow.ts`. The anchor always exists (`GET /api/sleep/goal` never 404s), so the card shows iff ≥1 gym slot's time falls outside the window. Gentle identity-vote copy (ADR 0010 — no red, no guilt). Lists offending slots („Kedd 18:00 → 07:00", target = window start), one CTA applies all moves via the existing `saveGymSchedule` replace-all `PUT /api/train/gym-schedule`. |
| D4 | **Dismiss = content-keyed snooze, not time-keyed:** „Maradjon így" writes a localStorage key holding a hash of (wake anchor + offending slot list). The card returns only when the schedule or the wake changes — never on a timer. |
| D5 | **Sport slots untouched.** The rec is about gym training; volleyball/TRX slots are team-scheduled and not the user's to move. Only `gym_schedule_slot` rows are evaluated/moved. |
| D6 | **Seed = demodata, which runs in prod:** a new idempotent seed (the `PantryCatalogLoader` pattern) with a **by-name guard** (the prod shelf is curated — the loader's "empty shelf" guard would never fire). Seeds (a) the two stim `pantry_item`s if absent by name, (b) an **active protocol** containing both **only if the owner has no active protocol** — an existing protocol is never touched (protocol curation stays a Stack-UI decision). The live k3s DB gets the rows on the next deploy; no manual data entry. |
| D7 | **Mock stash parity by replacement:** in `data/fuel/fuel.ts` the generic `aakg` + `betaalanin` + `caffeine200` items are **replaced** by the single real **Origin PWO** (they are literally its ingredients), and **Tasty Dose gombakávé** is added next to the espresso. Tests asserting the old ids/names follow in the same change. |
| D8 | **Scope guard:** no auto-reschedule (Option Y stands — gym time is a standalone, manually owned schedule); M4 `morning-window-end` (10:00) and M3 `weigh-in-cutoff` stay static; no new table/endpoint/contract change; `FuelStackPage` untouched (the seeded protocol appears on it naturally). |

## 3. The window & the card

```
wake (anchor) ──┬── +60′ ────────── window start  (FE suggestion target)
                └── +6h  ────────── window end    (= M5 habit cutoff, BE + FE)
ghost wake 06:00  →  07:00 – 12:00  (today's exact behavior)
goal wake 05:30   →  06:30 – 11:30
```

- `morningWindow.ts` exports the window computation + the offending-slot filter as pure
  functions over `(wake: string, slots: GymScheduleSlot[])` — unit-testable, no hook coupling.
- The card's one-tap builds the full replacement slot list: offending slots get the window-start
  time (same weekday), in-window slots pass through unchanged → one `saveGymSchedule` call.
- **Mock mode:** `saveGymSchedule` is a no-op in mock, so the card's apply additionally updates
  the `['train','gymSchedule']` query cache (the D9 mock-parity idiom — the habit manual-check
  precedent), keeping the flow demonstrable end-to-end on the mock FE.

## 4. Seed data (from the product labels, 2026-07-25)

**Tasty Dose gombakávé** — stim-kind `pantry_item` (powder, hot drink):
- Serving **8 g** (1 heaped scoop in 200 ml hot water) · box 240 g = **30 servings** · **100 mg caffeine/serving** (from guarana 200 mg).
- Mushroom blend / serving: Tremella 504 mg (10:1), Lion's Mane 400 mg (10:1), Shiitake 250 mg (4:1), Maitake 200 mg (5:1), Samsoniella 200 mg (10:1), Reishi 100 mg (10:1), Cordyceps 48 mg (20:1); plus ashwagandha 160 mg (4 mg withanolides), L-tyrosine 150 mg, rhodiola 100 mg, magnesium 60 mg, collagen 1 g, myo-inositol 1 g, multivitamin mix.
- Protocol slot: **morning** („súlymérés után" — the M4 anchor), timing `morning`.

**Origin PWO** — stim-kind `pantry_item` (powder, blue-raspberry):
- Daily serving **20 g**: L-citrulline-DL-malate 8 g, AAKG 4 g, beta-alanine 3.5 g, **caffeine 300 mg**, L-theanine 250 mg.
- Stock **~25 servings — estimated, not from the label**; correctable in the Kamra.
- Protocol slot: **pre-workout**, timing `pre-workout`. Note: logged after the caffeine cutoff it
  correctly fails E1 — that is the feature working, not a bug.

Both: `kind='stim'`, caffeine-flagged, real dose/form strings; seeded protocol = version 1,
`active`, reason `"seed: video-1 ④ protocol setup"`.

## 5. Tests

- **BE (focused ITs, the OOM-safe local gate):** M5 with a saved goal (wake 05:00 → a session
  finished 11:30 does **not** complete; finished 10:30 does); ghost-wake back-compat (no goal →
  cutoff 12:00, exactly today's behavior); seed idempotency (second run: no duplicate items, an
  existing active protocol untouched, by-name guard holds when one item pre-exists).
- **FE (both modes):** `morningWindow` pure-function tests (window math, offending filter,
  replacement-list builder); card tests — hidden when all slots in-window, shown + apply calls
  `saveGymSchedule` with the moved list, snooze hides + schedule/wake change re-shows.

## 6. Docs impact (same change)

`habit.md` §4/§9 (M5 metric + config change), `train.md` §2/§5/§10 (card + integration + files),
`fuel.md` §4/§9 (seed), `me.md` §5 (anchor-consumer list), cluster-notes §0/§3/§5 (④ done),
`node scripts/lint-docs.mjs` green.
