# Fuel P5 — Mai merged timeline design

- **Date:** 2026-07-02
- **Status:** designed — client-side merge + generic meal placeholders chosen as recommended defaults
  (Daniel AFK at the two decision points); awaiting his spec review before implementation
- **Driving bd:** `mezo-9ys` (roadmap P5)
- **Parent roadmap:** [`docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md`](../plans/2026-06-26-fuel-completion-roadmap.md) §P5
- **Depends on (all shipped):** P0a ADR 0004 (Train owns the schedule), P2 `supplement_intake` +
  protocol (mezo-09g), P3 medication (mezo-d94), meal-logging (mezo-arb), Train schedule endpoints.
- **Living doc to update on ship:** [`docs/features/fuel.md`](../../features/fuel.md) (+ `today.md` for the preview)

## 1. Problem

The Mai page's pacing timeline and Today's `FuelTimelinePreview` are hand-authored fiction:
`useFuelTimeline()` returns the static `fuelPlan.today` (11 narrative slots with invented planned
meals), `useFuelPreview()` imports the same const directly, the timeline's gym/volleyball blocks are
disconnected from the real Train schedule, and `getScoredMeal` joins slots to meals by exact
title-string match (already broken for 2 of 4 mock slots). Meanwhile every ingredient of a REAL
timeline now exists: logged meals (`/api/fuel/day/{date}`), supplement intakes (`/api/fuel/intake/{date}`,
P2), the active protocol's FE-computed slots (`buildProtocol`, P2), the weekly gym/sport schedule
(`/api/train/{gym,sport}-schedule`), and the medication cycle (P3).

## 2. Decisions

1. **Client-side merge — zero new backend.** No `GET /api/fuel/timeline` endpoint, no contract or
   Liquibase change. Rationale: the protocol slots are FE-computed *by design* (P2 persisted
   selection+version only — a server timeline would either duplicate `buildProtocol` or contradict
   that decision), and every input already has a real dual-mode read. The merge is a pure,
   deterministic function; the roadmap's "DB view vs service composition vs client merge" open
   decision resolves to client merge.
2. **Generic meal placeholders** (recommended default, Daniel to veto at review): real mode renders
   the four canonical meal slots — Reggeli 07:00 · Ebéd 12:30 · Snack 16:00 · Vacsora 19:00 — as
   honest pending placeholders (no invented dish names); a logged meal replaces its slot's
   placeholder. Tapping a placeholder opens `LogMealSheet` with that slot preselected.
3. **Mock mode keeps the hand-authored seed** (`fuelPlan.today`) via the established
   mock-seed/real-honest invariant; the narrative `mezoNote`/`windowTip` prose stays mock-only
   (P8 writes real prose). Real mode never fabricates notes.
4. **`getScoredMeal` becomes id-based.** `FuelSlot` gains optional `mealId?: string` (additive);
   the two matching mock seed slots get their `mealId` so one lookup path serves both modes; the
   title-string join is deleted.

## 3. The pure merge: `buildTimeline`

New `frontend/src/features/fuel/logic/buildTimeline.ts` (the `buildProtocol` precedent — pure,
deterministic, fixture-tested):

```ts
buildTimeline(input: {
  meals: FuelMeal[]                    // the day's logged meals (useFuelDay)
  protocolSlots: ProtocolSlotData[]    // buildProtocol(activeSelection ?? default, stash)
  intakes: Intake[]                    // the day's supplement intakes (useIntakes)
  gymToday: { time: string; type: string | null } | null      // from useTrain schedule (today row)
  sportToday: { time: string; durationMin: number; kind: string } | null
  now: { hhmm: string }                // injected — buildTimeline itself never calls Date.now()
}): FuelPlanToday
```

Slot assembly:
- **Meals:** for each canonical window (`MEAL_WINDOWS` const in `data/fuel/fuelConfig.ts`):
  every logged meal of that slot becomes a `done` FuelSlot at its `loggedAt` HH:mm (title, macros,
  `mealId`); if none logged, one `pending` placeholder at the window time (label only, no
  mealName/macros). Multiple meals in one slot all render; nothing is dropped.
- **Supplements:** each `ProtocolSlotData` maps to a FuelSlot (kind mapping table pinned in the
  plan: wake→wake, pre-workout→preworkout, midday→midday, evening→evening, pre-fuel→snack);
  `items[]` become `SlotItem`s with `done = intakes.some(i => i.pantryItemId === refId)`.
- **Train blocks:** `gymToday` → `kind:'workout'` slot (type label; no fabricated duration — the
  schedule has none), `sportToday` → `kind:'sport'` slot with `durationMin`.
- **States:** `done` from the event itself (meal logged / all items taken / block start+duration
  passed); `now` = the latest non-done slot whose time ≤ now (exact rule pinned by unit tests);
  everything else `pending`. Slots sort by time.
- **Top fields:** `workout`/`volleyball` blocks derived from the same gym/sport inputs;
  `caffeineCutoff`/`kitchenClose`/`bedtime` from `fuelConfig.ts` constants (single-sourced; today
  they only exist inside the mock seed).

## 4. Hook & consumer wiring (signatures stable)

- **`useFuelTimeline()`** moves to `data/fuel/timelineHooks.ts`, stays `{ plan, getScoredMeal }`:
  mock returns the seed exactly as today; real composes `useFuelDay().meals` + `useProtocol()` +
  `useStack()` + `useIntakes(today)` (exported from stackHooks) + `useTrain()` schedule into
  `buildTimeline`. `getScoredMeal(slot)` = `slot.mealId` lookup with `breakdown` guard (both modes).
- **`useFuelPreview()`** composes `useFuelTimeline()` instead of importing the static const;
  return shape `{ visible, nextStack }` unchanged.
- **`FuelMaiPage`:** context strip reads the now-real `plan.workout`/`plan.volleyball`/anchors
  (drops the `today.workoutType` static for the gym label); pending meal placeholders get the
  tap→`LogMealSheet(slot)` affordance; `SlotCard` learns to omit the duration suffix when duration
  is unknown and to render placeholder slots (small additive props only).
- **Today preview:** placeholder-aware rendering; otherwise unchanged.

## 5. Out of scope

Meal score population (P7) — score buttons keep the breakdown guard, so real mode shows none until
P7; real `mezoNote`/`windowTip`/`pacing.msg` prose + Replan (P8); Terv page (P4); a Reta pip on the
timeline (possible later extension); "missed" slot semantics (a passed window stays `pending`).

## 6. Testing

`buildTimeline` unit tests with fixtures (empty day → 4 placeholders + protocol slots; mid-day with
logged meals + partial intakes; gym day / sport day / rest day; now-flag edge rules; multi-meal
slot). Hook tests in both modes (mock seed byte-identical to today; real composed via MSW). Updated
`FuelMaiPage` / `FuelTimelinePreview` tests for real mode (placeholders, real context strip). Full
gates: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; backend untouched.

## 7. Size

M, frontend-only (the roadmap's L assumed a backend composition; P2's shipped intake read + the
client-merge decision shrink it).
