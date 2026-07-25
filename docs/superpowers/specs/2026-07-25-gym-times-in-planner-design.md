# Gym times in the mesocycle planner — single source, Fuel read-only — Design

**Date:** 2026-07-25
**Driving bd:** mezo-4t43
**Status:** approved-pending-review
**Refines:** [`2026-06-15-gym-schedule-times-design.md`](2026-06-15-gym-schedule-times-design.md) — keeps its **Option Y**
data model (a standalone weekly schedule that persists across mesocycles); this is the **Y+**
refinement that moves *where you edit* the schedule.

## Driving need

Gym times have **no home in the mesocycle planner** — Step 2 (`MesocyclePlannerPage`) picks *which*
weekdays you train (the "WHAT", via `selectedDays`) but never *when*. The times ("WHEN") live in the
standalone `GymScheduleSlot` schedule (`PUT /api/train/gym-schedule`), editable in **two** UI places:
the **Fuel** `GymScheduleSheet` (`FuelPlanPage`, visible) and the **Gym** page "Időpontok" chip
(`train/GymScheduleSheet`, mock-gated / hidden in mock). Setting the same thing in two places is the
problem the user wants gone: it should be set **in one place — the planner, at the days** — and fed
to Fuel, where the **Mai Timeline** already uses it for pre/post-workout meal + supplement timing.

Note (verified in code): both editors already write the **same** backend endpoint, so the times are
not duplicated *in storage* — only the *editing surfaces* are duplicated, and the planner is missing
one entirely.

## Decisions (made with the user)

1. **Data model unchanged — Y+ (keep the standing schedule).** Gym times remain the Train-owned
   `GymScheduleSlot` weekly schedule that **persists across mesocycles** (`PUT /api/train/gym-schedule`,
   replace-all). We do **not** move times onto the meso day (that was Option X, explicitly rejected
   here again). Consequence: **pure frontend change — no API contract, backend, or Liquibase work.**
2. **The planner is the primary editing entry point.** Planner Step 2 gains a per-day time picker,
   **prefilled** from the current standing schedule (`useTrain().gymSlots`); saving the meso also
   writes the schedule.
3. **Keep one always-available editor for mid-cycle tweaks: the Gym page "Időpontok" chip** — made
   **visible in mock mode too** (its `!isMockMode()` gate removed). Both the planner and the chip
   write the same `saveGymSchedule` (`PUT /api/train/gym-schedule`).
4. **Fuel becomes read-only.** Its `GymScheduleSheet` editor is removed; `FuelPlanPage` keeps the
   read-only `WeekRhythmGrid` display, and the Mai Timeline keeps consuming the derived schedule.
5. **New-day default time = `18:00`** where the standing schedule has no slot for that weekday
   (evening default matches the "stable evening habit" rationale). Existing slots prefill as-is.
6. **Time is optional in the planner** — it does **not** gate "Tovább". A day with no time renders
   `time: null` gracefully (the existing join model); the exact-day-count gate is unchanged.
7. **Mock mode:** `createMesocycle` and `saveGymSchedule` both no-op in mock (Phase-1). To keep the
   demo honest, the Gym page holds a **local optimistic override** (mirroring the Fuel page's prior
   behavior) so a chip edit reflects immediately (does not persist across reload). The feature is
   fully functional only in **real mode**.

## Architecture & data flow

```
EDIT (two entry points, one target):
  Mesocycle planner · Step 2  ──┐
  Gym page · "Időpontok" chip ──┤
                                └─► saveGymSchedule(slots)  →  PUT /api/train/gym-schedule
                                        (replace-all, owner-scoped, Train-owned)
                                                 │
                                                 ▼
  deriveGymSchedule(activeMeso, slots)   // meso WHAT × slot WHEN, unchanged
                                                 │
READ (Fuel, no editing):                         ▼
  Fuel Terv   · WeekRhythmGrid           (useFuelWeek().gymSchedule → weeklyTimes)
  Fuel Mai    · Timeline                 (useFuelTimeline → deriveBlocks → buildDayPlan/buildProtocol:
                                          meal pre −75m / post +45m, supplement stack −40m)
```

No change to `deriveGymSchedule`, `buildDayPlan`, `buildProtocol`, the `GymScheduleSlot` contract, or
any backend code. The Timeline feed already exists; this design only guarantees times exist to feed it.

## Frontend changes

### 1. `MesocyclePlannerPage` — Step 2 time picker + save
- **UI:** below the existing "Melyik napokon?" chip grid, add an **"Időpontok"** sub-section listing
  the currently `selectedDays` (in `DAY_ORDER` order), each with a `type="time"` input (16px, matching
  the existing sheet's iOS-zoom-safe style). Only selected days appear; toggling a day adds/removes its
  row.
- **State:** a `dayTimes: Record<string, string>` (day label → `HH:mm`), seeded from `useTrain().gymSlots`
  (map `dayOfWeek` → `DAY_ORDER[i]`), defaulting a newly-selected day with no existing slot to `18:00`.
  A goal re-pick / day toggle keeps already-entered times where the day stays selected.
- **Save (`saveMesocycle`):** after building the existing `MesocycleCreateRequest`, also call
  `saveGymSchedule(slots)` where `slots = selectedDays with a time → { dayOfWeek: DAY_ORDER.indexOf(day), time }`
  (replace-all). Fire the schedule write, then `createMesocycle(request, { onSuccess: backToLibrary })`.
  Mock: both no-op → same navigate-only behavior as today.
- `useTrain()` already exposes `gymSlots` and `saveGymSchedule` (`trainHooks.ts`) — no data-layer change.

### 2. `GymPage` — un-gate the "Időpontok" chip
- Remove the `!isMockMode()` wrapper around the chip so it is always visible.
- Add a local optimistic override (mirror the pre-change Fuel page): `gymOverride` state set on save,
  passed to `train/GymScheduleSheet` so a mock-mode edit reflects; real mode relies on the query
  invalidation as today.

### 3. `FuelPlanPage` — read-only
- Remove: the header edit button (opens `editOpen`), the `editOpen` + `gymOverride` state, the
  `useFuelWeekActions`/`saveGymSchedule` usage, the `fuel/GymScheduleSheet` import + render, and the
  now-unused `GymScheduleDay` type import.
- Keep: `WeekRhythmGrid` read-only display fed by `useFuelWeek().gymSchedule`.

### 4. Data layer cleanup
- Delete `frontend/src/features/fuel/sheets/GymScheduleSheet.tsx` + `GymScheduleSheet.test.tsx`.
- In `frontend/src/data/fuel/fuelWeekHooks.ts`: remove `useFuelWeekActions` and `gymDaysToSlots`
  (both become dead once Fuel stops editing). **Keep** `withDefaultDuration` (read path) and
  `useFuelWeek`. Update `fuelWeekHooks.test.tsx` accordingly.
- Verify no other importer of `useFuelWeekActions` / `fuel/GymScheduleSheet` remains.

## Testing (both modes green — house gate)
- **Planner:** Step 2 renders a time input per selected day; prefills from `gymSlots`; a new day with
  no slot defaults to `18:00`; toggling days adds/removes rows; time is not required to advance; save
  calls `saveGymSchedule` with the mapped `{dayOfWeek, time}` slots **and** `createMesocycle`.
- **GymPage:** the "Időpontok" chip is visible in **mock** mode; opening + saving reflects via the
  local override.
- **FuelPlanPage:** no edit affordance / no `GymScheduleSheet` rendered; `WeekRhythmGrid` still shows
  the schedule.
- Deleted Fuel-sheet test removed; `fuelWeekHooks.test.tsx` no longer references the removed exports.
- Gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

## Out of scope / non-goals
- **No backend / API contract / Liquibase change** (data model stays Option Y).
- Gym **duration** stays out of scope (no DB home; `DEFAULT_BLOCK_MIN` presentational default).
- No per-week / per-meso time overrides (Option X and Hybrid both rejected).
- The pre/post-workout meal + supplement timing math already exists (`buildDayPlan`/`buildProtocol`) —
  not re-touched.

## Docs to update on completion
- `docs/features/train.md` — §4 gym schedule: the planner is now a schedule editor; the "Időpontok"
  chip is visible in mock too.
- `docs/features/fuel.md` — Terv: gym times are **read-only** in Fuel (editor removed; write-through
  path retired); Mai Timeline consumption unchanged.
- This spec records the Y+ refinement of the 2026-06-15 decision (no separate ADR).
