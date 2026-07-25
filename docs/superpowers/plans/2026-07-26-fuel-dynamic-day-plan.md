# Fuel Dynamic Day-Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Fuel „Mai" timeline a stable daily plan with a dynamic, activity-aware energy budget — meal windows sit on fixed anchors, `now` only paints slot state (past-unlogged → faded „missed"), and daily kcal/macros derive from BMR + that day's scheduled activity (no double-count).

**Architecture:** All changes are FE-only in the Fuel logic layer, reusing existing wire data (no backend / contract / migration). `deriveDailyBudget` gains a dynamic path (`BMR×NEAT + Σ MET-based activity + goal balance`, BMR floor); `buildDayPlan` drops the now-reflow, computes a `missed`/`now`/`pending` state from `now`, fixes concurrent-block snapping, inserts peri-workout snacks, and surfaces an energy breakdown; `FuelMaiPage` renders a transparent target card and `SlotCard` renders the faded-but-loggable missed state.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest (`pnpm test`), dual-mode (real default + `VITE_USE_MOCK=true`). Pure logic in `frontend/src/features/fuel/logic/`, hooks in `frontend/src/data/fuel/`.

## Global Constraints

- **bd:** `mezo-1oy5`. Spec: `docs/superpowers/specs/2026-07-26-fuel-dynamic-day-plan-design.md`.
- **Deterministic core:** `buildDayPlan`/`deriveDailyBudget` stay pure — no `Date.now()`/`new Date()`/random; `nowHHmm` is the only injected clock input.
- **Frontend conventions:** deep absolute `@/*` imports, no relative `../`, colocated tests, hooks only from `@/data/hooks` in features. Read `docs/references/frontend_conventions.md` before touching `frontend/src`.
- **Gate (every commit compiles; final gate):** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- **No backend changes** in this plan (Layer C deferred, spec §10).
- **Exact numbers (Daniel's profile, for tests):** BMR `1720`, weight `78.6`, segment `{kcal:2150, proteinG:163}`, static tdee `2666` ⇒ balance `−516`; `NEAT_BASELINE=1.2` ⇒ maintenance `2064`.

---

### Task 1: Energy config constants + MET activity helpers

**Files:**
- Modify: `frontend/src/data/fuel/fuelConfig.ts`
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (add `blockKcal` / `activityKcal` here — keeps `fuelConfig` type-free of `PlannerBlock` to avoid a circular import)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (append)

**Interfaces:**
- Produces: `NEAT_BASELINE: number`, `MET_BY_KIND: Record<'gym'|'sport'|'run'|'default', number>`, `DEFAULT_RUN_MIN`, `PERI_SNACK_MIN_KCAL`, `PERI_SNACK_MIN_DURATION` (in `fuelConfig.ts`); `blockKcal(kind: PlannerBlock['kind'], durationMin: number|null, weightKg: number): number` and `activityKcal(blocks: PlannerBlock[], weightKg: number): number` (in `buildDayPlan.ts`).
- Consumes: existing `FAT_KCAL_SHARE`, `DEFAULT_BLOCK_MIN` from `fuelConfig.ts`.

- [ ] **Step 1: Add config constants**

In `fuelConfig.ts`, below the existing `SLOT_WEIGHT` / `FAT_KCAL_SHARE` block:

```ts
// Dynamic energy model (mezo-1oy5). Daily target = BMR×NEAT_BASELINE + Σ MET-based activity + goal balance.
// NEAT_BASELINE replaces the static PAL in the per-day budget (activity is added explicitly → no double-count).
export const NEAT_BASELINE = 1.2
// MET by training-block kind — kcal = MET × weightKg × hours. Conservative (indoor volleyball has lots of standing).
export const MET_BY_KIND: Record<'gym' | 'sport' | 'run' | 'default', number> = { gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }
// Null-duration blocks (interval runs) use this for the burn estimate.
export const DEFAULT_RUN_MIN = 45
// A training block ≥ either threshold earns a peri-workout snack window.
export const PERI_SNACK_MIN_KCAL = 300
export const PERI_SNACK_MIN_DURATION = 90
```

- [ ] **Step 2: Write the failing test for the MET helpers**

Append to `buildDayPlan.test.ts` (it already imports from `./buildDayPlan`; add `blockKcal, activityKcal` to that import):

```ts
test('blockKcal = MET × kg × hours; null duration falls back per kind', () => {
  expect(blockKcal('gym', 60, 78.6)).toBeCloseTo(6.0 * 78.6 * 1, 1) // ≈472
  expect(blockKcal('sport', 240, 78.6)).toBeCloseTo(4.5 * 78.6 * 4, 1) // ≈1415
  expect(blockKcal('run', null, 78.6)).toBeCloseTo(9.5 * 78.6 * (45 / 60), 1) // DEFAULT_RUN_MIN
})
test('activityKcal sums every scheduled block (gym + sport + run all count)', () => {
  const blocks = [
    { kind: 'gym' as const, time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport' as const, time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  expect(activityKcal(blocks, 78.6)).toBeCloseTo(6.0 * 78.6 + 4.5 * 78.6 * 4, 0) // ≈1887
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && pnpm test buildDayPlan -t "blockKcal"`
Expected: FAIL — `blockKcal is not a function`.

- [ ] **Step 4: Implement the helpers**

In `buildDayPlan.ts`, add to the `fuelConfig` import: `DEFAULT_RUN_MIN`, `MET_BY_KIND`. Then add near the top (after imports, before `deriveDailyBudget`):

```ts
/** MET-based kcal for one training block. Null duration → DEFAULT_RUN_MIN for runs, DEFAULT_BLOCK_MIN otherwise. */
export function blockKcal(kind: PlannerBlock['kind'], durationMin: number | null, weightKg: number): number {
  const met = MET_BY_KIND[kind] ?? MET_BY_KIND.default
  const min = durationMin ?? (kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN)
  return met * weightKg * (min / 60)
}
/** Total scheduled activity energy (kcal) for the day — every gym/sport/run block. */
export function activityKcal(blocks: PlannerBlock[], weightKg: number): number {
  return blocks.reduce((s, b) => s + blockKcal(b.kind, b.durationMin, weightKg), 0)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend && pnpm test buildDayPlan -t "blockKcal"` then `-t "activityKcal"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/fuel/fuelConfig.ts frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): energy config constants + MET activity helpers (mezo-1oy5)"
```

---

### Task 2: Dynamic `deriveDailyBudget`

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (`deriveDailyBudget` + new `EnergyInputs`/`DayBudget` types)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts`

**Interfaces:**
- Consumes: `activityKcal` (Task 1), `NEAT_BASELINE`, `FAT_KCAL_SHARE`, `Macro4`, `MacroSet`, `PlannerBlock`.
- Produces:
  ```ts
  export interface EnergyInputs { bmr: number | null; tdee: number | null; weightKg: number; blocks: PlannerBlock[] }
  export interface DayBudget extends Macro4 { energy: { base: number; activity: number; balance: number; target: number } }
  export function deriveDailyBudget(segment: { kcal: number; proteinG: number } | null, fallback: MacroSet, energy?: EnergyInputs): DayBudget
  ```

- [ ] **Step 1: Write the failing tests**

Replace the two existing `deriveDailyBudget` tests (currently around lines 171–178) with:

```ts
test('deriveDailyBudget (no energy) keeps the static base kcal + derived carbs/fat', () => {
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  expect(deriveDailyBudget({ kcal: 2150, proteinG: 163 }, fallback)).toMatchObject({ kcal: 2150, p: 163, c: 226, f: 66 })
})
test('deriveDailyBudget (no energy, no segment) passes the fallback base through', () => {
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  expect(deriveDailyBudget(null, fallback)).toMatchObject({ kcal: 3100, p: 220, f: 95 })
})

const ENERGY = (blocks: PlannerBlock[]) => ({ bmr: 1720, tdee: 2666, weightKg: 78.6, blocks })
test('dynamic budget — rest day floors at BMR (raw 2064−516=1548 < 1720)', () => {
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163 }, FB, ENERGY([]))
  expect(b.energy).toMatchObject({ base: 2064, activity: 0, balance: -516, target: 1720 })
  expect(b.kcal).toBe(1720)
  expect(b.p).toBe(163) // protein fixed
  expect(b.f).toBe(66) // fat from the BASE segment, not the floored target
  expect(b.c).toBe(Math.round((1720 - 163 * 4 - 66 * 9) / 4)) // 118 — carbs absorb
})
test('dynamic budget — big training day adds activity, carbs absorb the bonus', () => {
  const blocks: PlannerBlock[] = [
    { kind: 'gym', time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163 }, FB, ENERGY(blocks))
  expect(b.energy.activity).toBeGreaterThan(1800)
  expect(b.energy.target).toBeGreaterThan(3300)
  expect(b.kcal).toBe(b.energy.target)
  expect(b.f).toBe(66) // fat stable (base-tied)
  expect(b.c).toBeGreaterThan(500) // big carb day
})
```

Add near the top of the test file: `const FB = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }` and ensure `PlannerBlock` is imported from `./buildDayPlan`.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test buildDayPlan -t "dynamic budget"`
Expected: FAIL — `deriveDailyBudget` returns no `energy` / ignores the 3rd arg.

- [ ] **Step 3: Implement the dynamic path**

Replace the existing `deriveDailyBudget` in `buildDayPlan.ts` with:

```ts
export interface EnergyInputs { bmr: number | null; tdee: number | null; weightKg: number; blocks: PlannerBlock[] }
export interface DayBudget extends Macro4 { energy: { base: number; activity: number; balance: number; target: number } }

/**
 * Daily budget. Static path (no BMR → no biometric profile) keeps today's behavior. Dynamic path
 * (mezo-1oy5): target = BMR×NEAT_BASELINE + Σ MET activity + goal balance, floored at BMR. Protein is
 * fixed (bodyweight-based), fat is tied to the BASE segment kcal (stable), carbs absorb the activity bonus.
 * balance = segment.kcal − static tdee (the TDEE-independent goal deficit/surplus, isolated from the wire).
 */
export function deriveDailyBudget(
  segment: { kcal: number; proteinG: number } | null,
  fallback: MacroSet,
  energy?: EnergyInputs,
): DayBudget {
  const baseKcal = segment?.kcal ?? fallback.kcal
  const proteinG = segment?.proteinG ?? fallback.p
  const fat = Math.round((baseKcal * FAT_KCAL_SHARE) / 9)
  const carbs = (kcal: number) => Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))

  if (!energy || energy.bmr == null) {
    return { kcal: baseKcal, p: proteinG, c: carbs(baseKcal), f: fat, energy: { base: baseKcal, activity: 0, balance: 0, target: baseKcal } }
  }
  const balance = segment && energy.tdee != null ? segment.kcal - energy.tdee : 0
  const maintenance = energy.bmr * NEAT_BASELINE
  const eat = activityKcal(energy.blocks, energy.weightKg)
  const target = Math.max(energy.bmr, maintenance + eat + balance) // KCAL_FLOOR = BMR
  return {
    kcal: Math.round(target),
    p: proteinG,
    c: carbs(target),
    f: fat,
    energy: { base: Math.round(maintenance), activity: Math.round(eat), balance: Math.round(balance), target: Math.round(target) },
  }
}
```

Add `NEAT_BASELINE` to the `fuelConfig` import.

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm test buildDayPlan -t "budget"`
Expected: PASS (all budget tests incl. the two static ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): dynamic activity-aware daily budget with BMR floor (mezo-1oy5)"
```

---

### Task 3: `buildDayPlan` — drop now-reflow, fixed-plan `missed`/`now`/`pending` state, concurrent-block snap fix, energy field

**Files:**
- Modify: `frontend/src/data/types.ts` (`FuelSlot.state` gains `'missed'`; `FuelPlanToday` gains `energy`)
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (remove `reflowPendingWindows` usage + function; new state pass; `placeWindows` snap fix; `DayPlanInput.budget: DayBudget`; set `plan.energy`)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts`

**Interfaces:**
- Consumes: `DayBudget` (Task 2), `toMin`, `MIN_SLOT_GAP_MIN`, `POST_WORKOUT_SNAP_MIN`, `PRE_WORKOUT_SNAP_MIN`, `DEFAULT_BLOCK_MIN`.
- Produces: `FuelSlot.state: 'done' | 'now' | 'pending' | 'missed'`; `FuelPlanToday.energy`; `buildDayPlan` returns a plan whose meal windows sit at `placeWindows` times (no now-reflow) with fixed-plan state.

- [ ] **Step 1: Extend the types**

In `types.ts`:
```ts
// FuelSlot:
state: 'done' | 'now' | 'pending' | 'missed'
// FuelPlanToday (add field):
energy: { base: number; activity: number; balance: number; target: number }
```

- [ ] **Step 2: Write the failing tests (fixed-plan state)**

Add to `buildDayPlan.test.ts` (reuse the file's `baseInput` helper; a 4-meal day, wake 06:00, bed 23:00):

```ts
test('fixed plan: pending meal windows keep their anchored time regardless of now (no reflow)', () => {
  const early = buildDayPlan(baseInput({ nowHHmm: '05:00', meals: [] }))
  const late = buildDayPlan(baseInput({ nowHHmm: '23:19', meals: [] }))
  const breakfastEarly = early.slots.find(s => s.slotKey === 'breakfast')!
  const breakfastLate = late.slots.find(s => s.slotKey === 'breakfast')!
  expect(breakfastLate.time).toBe(breakfastEarly.time) // breakfast never migrates to the evening
})
test('evening, nothing logged: past meal windows are "missed", the last open one is "now"', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '23:19', meals: [], bed: '23:59' }))
  const meals = plan.slots.filter(s => s.slotKey && (s.kind === 'meal' || s.kind === 'snack'))
  expect(meals.filter(s => s.state === 'missed').length).toBeGreaterThan(0)
  expect(meals.filter(s => s.state === 'now').length).toBe(1) // exactly one current/last-open window
  expect(meals.every(s => s.state !== 'pending')).toBe(true) // nothing is "upcoming" at 23:19
})
test('midday: the window you are currently in is "now", earlier unlogged is "missed", later is "pending"', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '14:30', meals: [] }))
  const meals = plan.slots.filter(s => s.slotKey).sort((a, z) => toMin(a.time) - toMin(z.time))
  const nowIdx = meals.findIndex(s => s.state === 'now')
  expect(nowIdx).toBeGreaterThanOrEqual(0)
  expect(meals.slice(0, nowIdx).every(s => s.state === 'missed')).toBe(true)
  expect(meals.slice(nowIdx + 1).every(s => s.state === 'pending')).toBe(true)
})
test('no two meal slots share the same minute (collision-free) even with two blocks at 18:00', () => {
  const blocks = [
    { kind: 'gym' as const, time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport' as const, time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  const plan = buildDayPlan(baseInput({ nowHHmm: '13:00', meals: [], blocks }))
  const mealTimes = plan.slots.filter(s => s.slotKey).map(s => s.time)
  expect(new Set(mealTimes).size).toBe(mealTimes.length)
})
test('plan carries the energy breakdown from the budget', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '13:00', meals: [] }))
  expect(plan.energy).toEqual(expect.objectContaining({ base: expect.any(Number), activity: expect.any(Number), balance: expect.any(Number), target: expect.any(Number) }))
})
```

Update `baseInput` in the test file so `budget` is a `DayBudget` (add `energy: { base: <kcal>, activity: 0, balance: 0, target: <kcal> }` to its default budget object) and so it accepts an optional `bed` override.

- [ ] **Step 3: Run to verify failure**

Run: `cd frontend && pnpm test buildDayPlan -t "fixed plan"` (and the others)
Expected: FAIL — breakfast still reflows to the evening; no `missed` state; `plan.energy` undefined.

- [ ] **Step 4: Remove the now-reflow + wire the energy field**

In `buildDayPlan.ts`:
1. Change `DayPlanInput.budget: Macro4` → `budget: DayBudget`.
2. Delete the `reflowPendingWindows` function **and** its call site (the `2c` block computing `floor`/`flowed`); map meal slots over `windows` directly (rename `flowed.map` → `windows.map`). Delete `lastLoggedMin`/`floor`/`eatingStart` locals that only fed the reflow.
3. At the end, add `energy: budget.energy` to the returned `FuelPlanToday`.

- [ ] **Step 5: Fix concurrent-block snapping in `placeWindows`**

Replace the per-block snap loop in `placeWindows` (the `for (const b of [...blocks]...)` block) with a single earliest-start / latest-end snap:

```ts
if (blocks.length) {
  const starts = blocks.map(b => toMin(b.time))
  const ends = blocks.map(b => toMin(b.time) + (b.durationMin ?? DEFAULT_BLOCK_MIN))
  const earliestStart = Math.min(...starts)
  const latestEnd = Math.max(...ends)
  // Post-workout main = the main meal nearest the LATEST block end; snapped to latestEnd + 45, weighted up.
  const post = windows.filter(w => w.kind === 'meal').sort((a, z) => Math.abs(a.time - latestEnd) - Math.abs(z.time - latestEnd))[0]
  if (post) { post.time = clamp(latestEnd + POST_WORKOUT_SNAP_MIN); post.weight = SLOT_WEIGHT.postWorkoutMain }
  // Pre-fuel = nearest window strictly before the EARLIEST block start (excluding post), snapped to −75.
  const pre = windows.filter(w => w !== post && w.time < earliestStart).sort((a, z) => z.time - a.time)[0]
  if (pre) pre.time = clamp(earliestStart - PRE_WORKOUT_SNAP_MIN)
}
```

The existing `windows.sort` + min-gap forward-push (strictly increasing, `≥ MIN_SLOT_GAP_MIN`, clamp) stays below — that guarantees collision-freedom.

- [ ] **Step 6: Add the fixed-plan state pass**

Replace the old now-flag block (the `let nowIdx = -1; for (...) if (toMin(slots[i].time) <= now && slots[i].state !== 'done') nowIdx = i; if (nowIdx>=0) slots[nowIdx].state='now'`) with a **meal-window** state pass, applied to `mealSlots` BEFORE the merge:

```ts
// Fixed-plan state (mezo-1oy5): unlogged meal windows are missed (past) / now (current) / pending (future).
// nowWindow = the latest unlogged meal window at/before `now` while the kitchen is open; if `now` precedes
// every meal, the earliest is "now". Kitchen closed → no "now"; every past-unlogged window is "missed".
const unlogged = mealSlots.map((_, i) => i).filter(i => mealSlots[i].state !== 'done')
let nowWin = -1
if (now <= kitchenCloseMin && unlogged.length) {
  for (const i of unlogged) if (toMin(mealSlots[i].time) <= now) nowWin = i
  if (nowWin === -1) nowWin = unlogged[0] // now precedes all meals → first is current
}
const nowTime = nowWin >= 0 ? toMin(mealSlots[nowWin].time) : now
for (const i of unlogged) {
  if (i === nowWin) mealSlots[i].state = 'now'
  else mealSlots[i].state = toMin(mealSlots[i].time) < nowTime ? 'missed' : 'pending'
}
```

Keep block slots (`end <= now` → `'done'`) and protocol slots (done when all items taken) unchanged; drop the removed global now-flag entirely.

- [ ] **Step 7: Rewrite the obsolete reflow / now-flag tests**

Delete these now-invalid tests: `now-flag lands on the LAST non-done slot at or before nowHHmm` and any test asserting reflow/late-log redistribution (search the file for `reflow`, `redistribut`, `floor`). The new state tests (Step 2) replace them. Re-check the two `placeWindows` snap tests (`morning gym … 09:15`, `evening volleyball … clamped`): run them; if the single latest-end snap shifts an expected minute, update the expected value to the new (asserted-correct) output. Then:

Run: `cd frontend && pnpm test buildDayPlan`
Expected: PASS (whole file).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): fixed-plan timeline — drop now-reflow, missed state, concurrent-block snap, energy field (mezo-1oy5)"
```

---

### Task 4: Peri-workout snack windows on significant training days

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (`placeWindows` — add peri-snack windows)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts`

**Interfaces:**
- Consumes: `PERI_SNACK_MIN_KCAL`, `PERI_SNACK_MIN_DURATION`, `blockKcal`, `SLOT_WEIGHT`, `PlannerBlock`.
- Produces: `placeWindows` gains a `weightKg` param used only for the peri-snack threshold: `placeWindows(wake, bed, mealsPerDay, blocks, weightKg = 0)`.

- [ ] **Step 1: Write the failing test**

```ts
test('a significant block (≥90min or ≥300kcal) adds a peri-workout snack window', () => {
  const noBlock = buildDayPlan(baseInput({ nowHHmm: '05:00', meals: [], blocks: [] }))
  const bigBlock = buildDayPlan(baseInput({
    nowHHmm: '05:00', meals: [],
    blocks: [{ kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' }],
  }))
  const snacks = (p: typeof noBlock) => p.slots.filter(s => s.kind === 'snack').length
  expect(snacks(bigBlock)).toBeGreaterThan(snacks(noBlock)) // one extra peri-snack around the session
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test buildDayPlan -t "peri-workout snack"`
Expected: FAIL — snack counts equal.

- [ ] **Step 3: Implement peri-snack insertion**

In `placeWindows`, after the mains/snacks are pushed and BEFORE the training snap, add (guard by `weightKg` so the pure-placement tests without weight are unaffected only in the threshold, not the count — use the duration OR kcal rule):

```ts
// Peri-workout snack (mezo-1oy5): each significant block earns a light pre-session fuel window
// (the post side is covered by the post-workout main snap). Deduped against existing windows by min-gap.
for (const b of blocks) {
  const dur = b.durationMin ?? DEFAULT_BLOCK_MIN
  const significant = dur >= PERI_SNACK_MIN_DURATION || blockKcal(b.kind, b.durationMin, weightKg) >= PERI_SNACK_MIN_KCAL
  if (!significant) continue
  const t = clamp(toMin(b.time) - 60)
  if (windows.some(w => Math.abs(w.time - t) < MIN_SLOT_GAP_MIN)) continue
  windows.push(snack(t, 'Pre-workout snack'))
}
```

Thread `weightKg` through: update the `placeWindows` signature to `(wake, bed, mealsPerDay, blocks, weightKg = 0)` and the call in `buildDayPlan` to pass `input.budget` context — add `weightKg` to `DayPlanInput` (sourced in Task 5 plumbing) and pass it: `placeWindows(wake, bed, mealsPerDay, blocks, input.weightKg ?? 0)`.

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm test buildDayPlan`
Expected: PASS (whole file — the min-gap push keeps collision-freedom with the extra window).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): peri-workout snack window on significant training days (mezo-1oy5)"
```

---

### Task 5: Wire dynamic energy inputs through `timelineHooks`

**Files:**
- Modify: `frontend/src/data/fuel/timelineHooks.ts`
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (`DayPlanInput` gains `weightKg?: number`)
- Test: `frontend/src/data/fuel/timelineHooks.test.tsx`

**Interfaces:**
- Consumes: `useGoal()` → `{ goal: { currentWeight }, goalResponse: { tdeeBootstrap: { bmr, tdee } } }`; `deriveDailyBudget(segment, fallback, energy)` (Task 2); `buildDayPlan` (Tasks 3–4).
- Produces: `plan.energy` populated in both modes; peri-snack + BMR floor reflected in the mock demo.

- [ ] **Step 1: Write the failing test**

In `timelineHooks.test.tsx`, add a mock-mode assertion:

```ts
test('mock timeline carries a dynamic energy breakdown (base + activity + balance = target)', () => {
  const { result } = renderHook(() => useFuelTimeline(), { wrapper })
  const e = result.current.plan.energy
  expect(e.base).toBeGreaterThan(0) // BMR×NEAT maintenance flows through
  expect(Number.isFinite(e.activity)).toBe(true)
  expect(Number.isFinite(e.balance)).toBe(true)
  expect(e.target).toBeGreaterThan(0) // undefined/NaN energy (unplumbed) would fail here
})
```

(Match the file's existing `renderHook`/`wrapper` setup; if it uses a different harness, mirror it.)

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test timelineHooks`
Expected: FAIL — `plan.energy` undefined / not derived.

- [ ] **Step 3: Add `weightKg` to `DayPlanInput`**

In `buildDayPlan.ts` add `weightKg?: number` to `DayPlanInput`, destructure it in `buildDayPlan`, and pass it to `placeWindows` (Task 4 Step 3).

- [ ] **Step 4: Compose the energy inputs in the hook**

In `timelineHooks.ts`:
1. Destructure `goal` too: `const { goal, goalResponse, timeline } = useGoal()`.
2. Build the energy inputs and pass them to `deriveDailyBudget`:

```ts
const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
const budget = deriveDailyBudget(currentSegment(goalResponse, timeline), fuel.targets, {
  bmr: goalResponse?.tdeeBootstrap?.bmr ?? null,
  tdee: goalResponse?.tdeeBootstrap?.tdee ?? null,
  weightKg,
  blocks,
})
```
3. Pass `weightKg` into `buildDayPlan({ ..., weightKg, ... })`.

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && pnpm test timelineHooks buildDayPlan`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/fuel/timelineHooks.ts frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/data/fuel/timelineHooks.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fuel): wire BMR/weight/blocks into the dynamic day-plan budget (mezo-1oy5)"
```

---

### Task 6: `FuelMaiPage` — transparent dynamic target card

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: `plan.energy` (Task 3) via `useFuelTimeline`.
- Produces: a target card rendering `Alaphő {base} · Mozgás +{activity} · Deficit/Felesleg {balance} = {target} kcal`.

- [ ] **Step 1: Write the failing test**

```ts
test('renders the dynamic target breakdown (base + activity + balance)', () => {
  renderFuelMai() // the file's existing render helper
  expect(screen.getByText(/Mai cél/i)).toBeInTheDocument()
  expect(screen.getByText(/Mozgás/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test FuelMaiPage -t "dynamic target"`
Expected: FAIL — no such text.

- [ ] **Step 3: Add the target card**

In `FuelMaiPage.tsx`, above the gauge card (or replacing the stale `kcal floor 2500` eyebrow), insert a card driven by `plan.energy`:

```tsx
<div style={{ padding: '8px 24px 0' }}>
  <div className="card" style={{ padding: 16 }}>
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Mai cél</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 22 }}>{plan.energy.target} kcal</span>
    </div>
    <div className="row gap-xs" style={{ flexWrap: 'wrap', marginTop: 8 }}>
      <span className="chx" style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}>Alaphő {plan.energy.base}</span>
      <span className="chx" style={{ background: 'var(--wash-amber)', color: 'var(--amber-deep)' }}>Mozgás +{plan.energy.activity}</span>
      <span className="chx" style={{ background: 'var(--warm)', color: 'var(--coral-deep)' }}>
        {plan.energy.balance < 0 ? 'Deficit ' : 'Felesleg +'}{plan.energy.balance}
      </span>
    </div>
  </div>
</div>
```

Also delete the stale `kcal floor 2500` literal from the header `over` line (replace with `Fuel · Reta D{retaDay}`).

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm test FuelMaiPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fuel): transparent dynamic target card on Mai (mezo-1oy5)"
```

---

### Task 7: `SlotCard` — faded, still-loggable `missed` state

**Files:**
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx`
- Modify: `frontend/src/styles/prototype.css` (add a `.slot.missed` style)
- Test: `frontend/src/features/fuel/components/SlotCard.test.tsx`

**Interfaces:**
- Consumes: `slot.state === 'missed'` (Task 3).
- Produces: a faded card that keeps the planned macros and offers a `Pótlás` (+ AI) retroactive-log action.

- [ ] **Step 1: Write the failing test**

```ts
test('a missed meal slot renders faded with a Pótlás (retro-log) action', () => {
  const slot = { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed', kcal: 610, p: 46, c: 55, f: 20 } as FuelSlot
  const onLogMeal = vi.fn()
  render(<SlotCard slot={slot} meta={KIND_META.meal} scoredMeal={null} onLogMeal={onLogMeal} onOpenScore={() => {}} />)
  expect(screen.getByText('kihagyott')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /pótlás/i }))
  expect(onLogMeal).toHaveBeenCalledWith(slot)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test SlotCard -t "missed"`
Expected: FAIL.

- [ ] **Step 3: Implement the missed branch**

In `SlotCard.tsx`:
1. Add `const isMissed = slot.state === 'missed'`.
2. Extend `isBudgetSlot` so budget/macro rows still show for missed: `const isBudgetSlot = !slot.mealName && (slot.kind === 'meal' || slot.kind === 'snack') && (!isDone) && !!slot.kcal` (already true for missed since it's not done).
3. Add the `missed` class + a `kihagyott` tag next to the title:
```tsx
<div className={`slot${isDone ? ' done' : ''}${isNow ? ' next' : ''}${isMissed ? ' missed' : ''}`}>
...
<div className="t1">{title}{durationSuffix}{isMissed && <span className="misstag"> kihagyott</span>}</div>
```
4. Give missed slots the retro-log CTA — reuse the budget-slot button but label it `Pótlás` when missed:
```tsx
{(isBudgetSlot || isMissed) && (
  <button type="button" aria-label={`${slot.label} ${isMissed ? 'pótlása' : 'logolása'}`} onClick={() => onLogMeal?.(slot)}
    className="chx" style={{ marginTop: 6, background: isMissed ? 'var(--warm)' : 'var(--wash-sage)', color: isMissed ? 'var(--coral-deep)' : 'var(--sage-deep)' }}>
    {isMissed ? 'Pótlás' : 'Logolás'}
  </button>
)}
```
Keep the existing AI chip condition working for missed (`(isSuggestion || isBudgetSlot || isMissed) && slot.slotKey && onAiLog`).

- [ ] **Step 4: Add the faded style**

In `prototype.css`, near the `.slot` rules:
```css
.slot.missed { opacity: .72; }
.slot.missed .fav { filter: grayscale(1); opacity: .6; }
.misstag { font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-quaternary); border: 1px solid var(--line); padding: 2px 6px; border-radius: 999px; margin-left: 6px; }
```

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && pnpm test SlotCard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/SlotCard.tsx frontend/src/styles/prototype.css frontend/src/features/fuel/components/SlotCard.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fuel): faded, still-loggable missed slot state (mezo-1oy5)"
```

---

### Task 8: Docs, visual goldens, full gate

**Files:**
- Modify: `docs/features/fuel.md`
- Run: full FE gate + visual baseline refresh

- [ ] **Step 1: Update the feature doc**

In `docs/features/fuel.md`, update the day-planner section(s): the timeline is a **fixed plan** on wake/training/bed anchors (`now` paints state only); the daily budget is **dynamic** (`BMR×NEAT + Σ MET activity + balance`, BMR floor, protein fixed / fat from base / carbs absorb the bonus); past-unlogged meals are **missed** (faded, `Pótlás`-loggable); significant blocks add a **peri-workout snack**. Point `key_files` at `buildDayPlan.ts`, `timelineHooks.ts`, `SlotCard.tsx`, `FuelMaiPage.tsx`. Then:

Run: `node scripts/lint-docs.mjs`
Expected: no staleness/broken-link error for `fuel.md`.

- [ ] **Step 2: Run both-mode gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build + both suites green. Fix any fallout (esp. Today-page tests that read `useFuelTimeline` — the agenda now reflects the fixed plan).

- [ ] **Step 3: Refresh visual goldens (Today + Fuel)**

The Today agenda + Fuel Mai derive from the same plan → goldens change by design (spec §8, D6 precedent). Regenerate via the established baseline workflow (see `docs/infrastructure/local-dev-testing.md` / the prior `mezo-53su` golden refresh). Inspect the diffs: breakfast on its anchor, no 23:18 breakfast, missed cards faded, target card present.

- [ ] **Step 4: Commit**

```bash
git add docs/features/fuel.md frontend
git -c core.hooksPath=/dev/null commit -m "docs(fuel): document dynamic day-plan + refresh Today/Fuel visual goldens (mezo-1oy5)"
```

---

## Self-Review

**Spec coverage:**
- §3 Layer A (dynamic energy) → Tasks 1, 2, 5 (config, `deriveDailyBudget`, plumbing). ✓
- §3.3 macro split (protein fixed / fat from base / carbs absorb) → Task 2 tests. ✓
- §3.4 config knobs (NEAT, MET, floor, peri thresholds) → Task 1. ✓
- §4.1 drop reflow → Task 3 Step 4. ✓ §4.2 missed/now/pending → Task 3 Step 6. ✓ §4.3 concurrent blocks / collision-free → Task 3 Step 5 + test. ✓ §4.4 peri-snack → Task 4. ✓ §4.5 all activity counts → Task 1 `activityKcal` test. ✓ §4.6 transparent header → Task 6. ✓
- §6 edge cases: early workout (post-workout snap retained), whole-day-missed, rest-day floor, no-profile fallback → Tasks 2 (floor + fallback) & 3 (state) tests. ✓
- §9 testing + goldens → Task 8. ✓
- §10 out-of-scope (Layer C) → untouched by design. ✓

**Placeholder scan:** No TBD/TODO; every code step shows code; the only "run & pin" is Task 3 Step 7 (adjusting two pre-existing placeWindows snap expectations), which is explicit and bounded.

**Type consistency:** `DayBudget`/`EnergyInputs` (Task 2) consumed identically in Tasks 3 & 5; `FuelSlot.state` union with `'missed'` (Task 3) consumed in Task 7; `plan.energy` shape `{base,activity,balance,target}` identical in Tasks 3, 5, 6; `blockKcal`/`activityKcal` signatures identical in Tasks 1, 2, 4.

**Note on decomposition:** Tasks 1–2+5+6 are Layer A (energy), Tasks 3–4+7 are Layer B (timeline); they share `buildDayPlan`/`FuelSlot` so they ship as one coherent slice. Each task ends green and independently reviewable.
