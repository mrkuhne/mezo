# Fuel "Mai" guided redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose `/fuel` "Mai" into a guided, mobile-first page — one hero decision card for the open eating window, one day-status card carrying the full energy/macro breakdown, and time-of-day zone cards with their own kcal/burn balance — while keeping all 15 existing functions and deleting the two static-seed surfaces.

**Architecture:** Two new pure logic modules (`dayZones`, `heroWindow`) turn the already-composed `FuelPlanToday` into view models; five new presentational components consume them; `FuelMaiPage` becomes a thin composition. `useFuelTimeline` gains three additive return fields (`wake`, `bed`, `nowHHmm`) so the page never reads the wall clock itself (mock determinism). The flat `FuelTimeline`/`SlotCard`/`KcalGauge`/`PacingCard` chain is retired, its behaviour ported into `ZoneSlotRow` with its test suite carried over 1:1.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind v4 + the hand-written Napív vocabulary in `frontend/src/styles/prototype.css`.

**Spec:** [`docs/superpowers/specs/2026-07-28-fuel-mai-guided-redesign-design.md`](../specs/2026-07-28-fuel-mai-guided-redesign-design.md) · **bd issue:** `mezo-rrtj` · **Mockup:** [`docs/design/fuel-mai-hybrid-v1.html`](../../design/fuel-mai-hybrid-v1.html)

## Global Constraints

- **Frontend only.** Zero backend, zero `api/` contract, zero generated-type change.
- **Read the conventions first:** [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md) is mandatory before touching `frontend/src`. Four layers, `*Page`/`*Section` naming, deep absolute `@/*` imports, **no barrels except `data/hooks.ts`**, no relative `../`, tests colocated.
- **Hungarian UI copy, English code/comments/commits.**
- **No fabricated data and no dead affordances.** A surface with no real source renders nothing (not a seeded placeholder); a button with no destination is not shipped.
- **No ambient time in pure logic.** `Date.now()`/`new Date()` must not appear in `logic/` modules; the clock is injected (`nowHHmm`), exactly as `buildDayPlan` already does.
- **Preserve these aria-labels verbatim** (existing tests depend on them): header log chip `Logolás`, header AI chip `AI naplózás`, water `Víz +250 ml` / `Víz +500 ml`, score chip `AI score`, settings chip `Fuel beállítások`, sheet close `Bezárás`, `Replan`.
- **New aria-label rules:** the hero primary is `{slot.label} logolása` (never bare `Logolás` — it would collide with the header chip), the hero AI button `{slot.label} AI-logolása`, the missed strip `{slot.label} pótlása`, the closed-day primary `Késői snack logolása`.
- **Animations** are additive CSS only and must be disabled under `@media (prefers-reduced-motion: reduce)`.
- **Test command:** `cd frontend && pnpm test -- <path>` for one file. Full gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Commit subjects** carry the bd id: `feat(fuel): ... (mezo-rrtj)`.

---

### Task 1: Zone derivation logic + config constants + hook fields

**Files:**
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (append zone constants)
- Modify: `frontend/src/data/fuel/timelineHooks.ts:160` (additive return fields)
- Modify: `frontend/src/data/fuel/timelineHooks.test.tsx` (assert the new fields)
- Create: `frontend/src/features/fuel/logic/dayZones.ts`
- Test: `frontend/src/features/fuel/logic/dayZones.test.ts`

**Interfaces:**
- Consumes: `toMin` (`data/fuel/fuelConfig.ts:28`), `blockKcal` + `PlannerBlock` (`features/fuel/logic/buildDayPlan.ts:99/43`), `FuelSlot` (`data/types.ts:21`).
- Produces (later tasks rely on these exact names):
  ```ts
  export type ZoneKey = 'morning' | 'midday' | 'afternoon' | 'evening'
  export type ZoneState = 'done' | 'open' | 'ahead'
  export type SlotRole = 'supplement' | 'activity' | 'meal' | 'other'
  export function slotRole(slot: FuelSlot): SlotRole
  export function isMealSlot(slot: FuelSlot): boolean
  export interface DayZone {
    key: ZoneKey; label: string; slots: FuelSlot[]
    kcal: number; hasMeals: boolean; state: ZoneState
    burnKcal: number; stackPips: boolean[]
  }
  export function buildDayZones(input: {
    slots: FuelSlot[]; wake: string; bed: string
    blocks: PlannerBlock[]; weightKg: number
  }): DayZone[]
  ```
  `useFuelTimeline()` additionally returns `wake: string`, `bed: string`, `nowHHmm: string`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/dayZones.test.ts`:

```ts
import { buildDayZones, isMealSlot, slotRole } from '@/features/fuel/logic/dayZones'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

const WAKE = '06:45'
const BED = '23:00'

const meal = (time: string, over: Partial<FuelSlot> = {}): FuelSlot => ({
  time, kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'pending', kcal: 600, p: 40, c: 60, f: 20, ...over,
})
const supplement = (time: string, done = false): FuelSlot => ({
  time, kind: 'snack', label: 'Pre-workout snack', state: done ? 'done' : 'pending',
  items: [{ type: 'supplement', refId: 'a', label: 'Koffein · 200mg', done }],
})
const workout = (time: string): FuelSlot => ({ time, kind: 'workout', label: 'Pull Day', state: 'pending', duration: 90 })

const zones = (slots: FuelSlot[], blocks: PlannerBlock[] = [], weightKg = 82) =>
  buildDayZones({ slots, wake: WAKE, bed: BED, blocks, weightKg })

test('slotRole classifies by item-presence first, then kind', () => {
  // A protocol slot can carry kind 'snack' (PROTOCOL_KIND['pre-fuel']) — items must win,
  // otherwise a supplement window would be counted as an eating window.
  expect(slotRole(supplement('16:00'))).toBe('supplement')
  expect(slotRole(workout('17:00'))).toBe('activity')
  expect(slotRole(meal('13:00'))).toBe('meal')
  expect(slotRole({ time: '07:00', kind: 'wake', label: 'Ébresztő', state: 'done' })).toBe('other')
  expect(isMealSlot(meal('13:00'))).toBe(true)
  expect(isMealSlot(supplement('16:00'))).toBe(false)
})

test('buckets slots into the four wake→bed zones', () => {
  const result = zones([meal('09:15'), meal('13:00'), meal('17:00'), meal('19:30')])
  expect(result.map(z => z.key)).toEqual(['morning', 'midday', 'afternoon', 'evening'])
  expect(result.map(z => z.label)).toEqual(['Reggel', 'Dél', 'Délután', 'Este'])
})

test('omits zones with no slots — a 3-meal day produces no empty chrome', () => {
  const result = zones([meal('09:15'), meal('13:00')])
  expect(result.map(z => z.key)).toEqual(['morning', 'midday'])
})

test('kcal sums only eating windows, never supplement slots of kind snack', () => {
  const result = zones([meal('12:30', { kcal: 700 }), supplement('13:30')])
  expect(result).toHaveLength(1)
  expect(result[0].kcal).toBe(700)
  expect(result[0].hasMeals).toBe(true)
})

test('zone state: done when every eating window is logged', () => {
  const result = zones([meal('09:00', { state: 'done' }), meal('10:30', { state: 'done' })])
  expect(result[0].state).toBe('done')
})

test('zone state: open when the zone holds the now window', () => {
  const result = zones([meal('09:00', { state: 'done' }), meal('11:00', { state: 'now' })])
  expect(result[0].state).toBe('open')
})

test('zone state: ahead otherwise', () => {
  expect(zones([meal('19:30')])[0].state).toBe('ahead')
})

test('burnKcal reuses blockKcal, matched to its block by exact time', () => {
  // MET gym 6.0 × 82 kg × 1.5 h = 738
  const result = zones([workout('17:00')], [{ kind: 'gym', time: '17:00', durationMin: 90, label: 'Pull Day' }])
  expect(result[0].burnKcal).toBe(738)
  expect(result[0].hasMeals).toBe(false)
})

test('an activity slot with no matching block contributes no burn', () => {
  expect(zones([workout('17:00')], [])[0].burnKcal).toBe(0)
})

test('stackPips carry one entry per supplement item, true when taken', () => {
  const result = zones([supplement('16:00', true), supplement('21:30', false)])
  expect(result.flatMap(z => z.stackPips)).toEqual([true, false])
})

test('a pre-wake slot clamps into the first zone instead of being dropped', () => {
  const result = zones([meal('05:30', { state: 'done' })])
  expect(result).toHaveLength(1)
  expect(result[0].key).toBe('morning')
})

test('with a past-midnight bedtime a 00:30 slot lands in the evening zone', () => {
  const result = buildDayZones({
    slots: [meal('09:00'), meal('00:30')], wake: '06:45', bed: '01:00', blocks: [], weightKg: 80,
  })
  expect(result.map(z => z.key)).toEqual(['morning', 'evening'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/logic/dayZones.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/fuel/logic/dayZones"`.

- [ ] **Step 3: Append the zone constants to `fuelConfig.ts`**

```ts
// ── Time-of-day zones (mezo-rrtj) ────────────────────────────────────────────
// The Mai page groups the day's slots into four napszak zones. Boundaries are FRACTIONS of the
// user's wake→bed span (never wall-clock constants): wake/bed are owned by the sleep goal, so an
// early riser and a night owl must both get sensible buckets. Tuned on the reference day
// (06:45→23:00) so 13:00 lunch lands in `Dél`, a 17:00 gym in `Délután` and a 19:00 dinner in `Este`.
export const ZONE_KEYS = ['morning', 'midday', 'afternoon', 'evening'] as const
export type ZoneKeyName = (typeof ZONE_KEYS)[number]
export const ZONE_FRACTIONS: Record<ZoneKeyName, number> = {
  morning: 0, midday: 0.30, afternoon: 0.52, evening: 0.72,
}
export const ZONE_LABELS: Record<ZoneKeyName, string> = {
  morning: 'Reggel', midday: 'Dél', afternoon: 'Délután', evening: 'Este',
}
```

- [ ] **Step 4: Write `dayZones.ts`**

```ts
// Mai page zone model (mezo-rrtj) — pure: the composed FuelPlanToday's flat slot list becomes
// four napszak buckets, each with its own kcal / burn / stack-pip balance. No ambient time: the
// wake/bed anchor is injected exactly like buildDayPlan's nowHHmm.

import { ZONE_FRACTIONS, ZONE_KEYS, ZONE_LABELS, toMin, type ZoneKeyName } from '@/data/fuel/fuelConfig'
import { blockKcal, type PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

export type ZoneKey = ZoneKeyName
export type ZoneState = 'done' | 'open' | 'ahead'
export type SlotRole = 'supplement' | 'activity' | 'meal' | 'other'

export interface DayZone {
  key: ZoneKey
  label: string
  slots: FuelSlot[]
  /** Σ kcal of the zone's eating windows (logged AND planned); 0 when it has none. */
  kcal: number
  hasMeals: boolean
  state: ZoneState
  /** Σ MET burn of the zone's training blocks. */
  burnKcal: number
  /** One entry per supplement item in the zone; true = already taken. */
  stackPips: boolean[]
}

/**
 * Item-presence wins over `kind`: buildDayPlan maps the 'pre-fuel' protocol window onto
 * FuelKind 'snack' (PROTOCOL_KIND), so a kind-first rule would count a capsule window as an
 * eating window and inflate the zone's kcal.
 */
export function slotRole(slot: FuelSlot): SlotRole {
  if ((slot.items?.length ?? 0) > 0) return 'supplement'
  if (slot.kind === 'workout' || slot.kind === 'sport') return 'activity'
  if (slot.kind === 'meal' || slot.kind === 'snack') return 'meal'
  return 'other'
}

export function isMealSlot(slot: FuelSlot): boolean {
  return slotRole(slot) === 'meal'
}

export function buildDayZones(input: {
  slots: FuelSlot[]
  wake: string
  bed: string
  blocks: PlannerBlock[]
  weightKg: number
}): DayZone[] {
  const { slots, wake, bed, blocks, weightKg } = input
  const wakeMin = toMin(wake)
  // A bedtime at/before wake crosses midnight — unwrap it so the span stays positive.
  const bedMin = toMin(bed) <= wakeMin ? toMin(bed) + 1440 : toMin(bed)
  const span = Math.max(1, bedMin - wakeMin)

  const zoneOf = (slot: FuelSlot): ZoneKey => {
    const raw = toMin(slot.time)
    // Only unwrap a past-midnight slot when the DAY itself crosses midnight; otherwise an
    // early-morning log (before wake) must clamp forward into the first zone, not jump a day.
    const t = bedMin > 1440 && raw < wakeMin ? raw + 1440 : raw
    const frac = Math.min(1, Math.max(0, (t - wakeMin) / span))
    let key: ZoneKey = ZONE_KEYS[0]
    for (const k of ZONE_KEYS) if (frac >= ZONE_FRACTIONS[k]) key = k
    return key
  }

  return ZONE_KEYS.map<DayZone>(key => {
    const zoneSlots = slots.filter(s => zoneOf(s) === key)
    const meals = zoneSlots.filter(isMealSlot)
    const kcal = meals.reduce((sum, s) => sum + (s.kcal ?? 0), 0)
    const state: ZoneState = zoneSlots.some(s => s.state === 'now')
      ? 'open'
      : meals.length > 0 && meals.every(s => s.state === 'done')
        ? 'done'
        : 'ahead'
    const burnKcal = zoneSlots
      .filter(s => slotRole(s) === 'activity')
      .reduce((sum, s) => {
        const block = blocks.find(b => b.time === s.time)
        return sum + (block ? Math.round(blockKcal(block.kind, block.durationMin, weightKg)) : 0)
      }, 0)
    const stackPips = zoneSlots
      .filter(s => slotRole(s) === 'supplement')
      .flatMap(s => (s.items ?? []).map(i => i.done))
    return { key, label: ZONE_LABELS[key], slots: zoneSlots, kcal, hasMeals: meals.length > 0, state, burnKcal, stackPips }
  }).filter(z => z.slots.length > 0)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/logic/dayZones.test.ts`
Expected: PASS (13 assertions green).

- [ ] **Step 6: Extend `useFuelTimeline`'s return (additive)**

In `frontend/src/data/fuel/timelineHooks.ts`, change the final return (currently line 160) to:

```ts
  // wake/bed/nowHHmm are returned so view-side zone math never re-derives the day anchor and never
  // reads the wall clock itself (mock mode must stay deterministic — MOCK_NOW_HHMM). Additive.
  return { plan, budget, blocks, weightKg, energyBreakdown, wake, bed, nowHHmm, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuel.meals) }
```

- [ ] **Step 7: Pin the new fields with a test**

Append to `frontend/src/data/fuel/timelineHooks.test.tsx` (follow the file's existing render/wrapper idiom — reuse whatever `renderHook` helper the file already defines rather than inventing a new one):

```ts
test('returns the day anchor + injected now so view-side zone math needs no clock (mezo-rrtj)', () => {
  const { result } = renderTimeline()
  expect(result.current.wake).toMatch(/^\d{2}:\d{2}$/)
  expect(result.current.bed).toMatch(/^\d{2}:\d{2}$/)
  // Mock mode pins the demo clock (spec D6) — the page must never read Date.now().
  expect(result.current.nowHHmm).toBe('13:30')
})
```

- [ ] **Step 8: Run both test files**

Run: `cd frontend && pnpm test -- src/features/fuel/logic/dayZones.test.ts src/data/fuel/timelineHooks.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/fuel/fuelConfig.ts frontend/src/data/fuel/timelineHooks.ts \
  frontend/src/data/fuel/timelineHooks.test.tsx frontend/src/features/fuel/logic/dayZones.ts \
  frontend/src/features/fuel/logic/dayZones.test.ts
git commit -m "feat(fuel): zone model for the Mai day — wake/bed-fraction buckets with kcal+burn balance (mezo-rrtj)"
```

---

### Task 2: Hero window selection logic

**Files:**
- Create: `frontend/src/features/fuel/logic/heroWindow.ts`
- Test: `frontend/src/features/fuel/logic/heroWindow.test.ts`

**Interfaces:**
- Consumes: `isMealSlot` from Task 1, `toMin`, `PlannerBlock`, `FuelSlot`.
- Produces:
  ```ts
  export interface HeroOpen { kind: 'open'; slot: FuelSlot; suggestion: boolean; why: string }
  export interface HeroClosed {
    kind: 'closed'; consumedKcal: number; targetKcal: number
    doneCount: number; totalCount: number; proteinG: number; proteinTargetG: number
  }
  export type HeroWindow = HeroOpen | HeroClosed
  export interface HeroResult { hero: HeroWindow; missed: FuelSlot[] }
  export function pickHeroWindow(input: {
    slots: FuelSlot[]; blocks: PlannerBlock[]
    budget: { kcal: number; p: number; c: number }
    consumed: { kcal: number; p: number }
  }): HeroResult
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/heroWindow.test.ts`:

```ts
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

const BUDGET = { kcal: 3010, p: 185, c: 265 }
const CONSUMED = { kcal: 790, p: 58 }
const GYM: PlannerBlock = { kind: 'gym', time: '17:00', durationMin: 90, label: 'Pull Day' }

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now',
  kcal: 900, p: 68, c: 105, f: 24, ...over,
})

const pick = (slots: FuelSlot[], blocks: PlannerBlock[] = []) =>
  pickHeroWindow({ slots, blocks, budget: BUDGET, consumed: CONSUMED })

test('the now window with a recipe suggestion becomes an open hero', () => {
  const now = slot({ mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1' })
  const { hero } = pick([now])
  expect(hero.kind).toBe('open')
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.suggestion).toBe(true)
  expect(hero.slot).toBe(now)
})

test('the why line names the next training block and the carb share', () => {
  const { hero } = pick([slot({ mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1' })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  // 105 / 265 = 39.6% → 40
  expect(hero.why).toBe('Pull Day 17:00 — ez az ablak viszi a napi szénhidrát 40%-át')
})

test('with no later training block the why line falls back to the window budget', () => {
  const { hero } = pick([slot({ time: '19:00' })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.why).toBe('900 kcal ebben az ablakban — 68 g fehérje a napi célhoz')
})

test('a macro-less window never prints a NaN share', () => {
  const { hero } = pick([slot({ c: undefined, p: undefined })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.why).toBe('900 kcal ebben az ablakban')
  expect(hero.why).not.toMatch(/NaN/)
})

test('an open window without a suggestion is flagged suggestion:false', () => {
  const { hero } = pick([slot()])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.suggestion).toBe(false)
})

test('no now window → a closed summary hero with the day totals', () => {
  const { hero } = pick([slot({ state: 'done' }), slot({ time: '19:00', state: 'done' })])
  expect(hero.kind).toBe('closed')
  if (hero.kind !== 'closed') throw new Error('unreachable')
  expect(hero.consumedKcal).toBe(790)
  expect(hero.targetKcal).toBe(3010)
  expect(hero.doneCount).toBe(2)
  expect(hero.totalCount).toBe(2)
  expect(hero.proteinG).toBe(58)
  expect(hero.proteinTargetG).toBe(185)
})

test('the eating-window counts ignore supplement and training slots', () => {
  const capsule: FuelSlot = {
    time: '21:30', kind: 'evening', label: 'Esti stack', state: 'pending',
    items: [{ type: 'supplement', refId: 'mg', label: 'Magnézium', done: false }],
  }
  const gymSlot: FuelSlot = { time: '17:00', kind: 'workout', label: 'Pull Day', state: 'done', duration: 90 }
  const { hero } = pick([slot({ state: 'done' }), capsule, gymSlot])
  if (hero.kind !== 'closed') throw new Error('unreachable')
  expect(hero.totalCount).toBe(1)
})

test('missed windows are returned separately, in chronological order', () => {
  const a = slot({ time: '11:30', label: 'Tízórai', state: 'missed', kcal: 300 })
  const b = slot({ time: '09:15', label: 'Reggeli', state: 'missed', kcal: 580 })
  const { hero, missed } = pick([a, b, slot()])
  expect(hero.kind).toBe('open')
  expect(missed.map(s => s.time)).toEqual(['09:15', '11:30'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/logic/heroWindow.test.ts`
Expected: FAIL — cannot resolve `@/features/fuel/logic/heroWindow`.

- [ ] **Step 3: Write `heroWindow.ts`**

```ts
// Mai page hero selection (mezo-rrtj) — pure. buildDayPlan already encodes the day's state
// (exactly one `now` while the day is awake, `missed` for past-unlogged windows, none after
// bedtime), so the hero is a projection of that, never a second state machine.

import { toMin } from '@/data/fuel/fuelConfig'
import { isMealSlot } from '@/features/fuel/logic/dayZones'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

export interface HeroOpen {
  kind: 'open'
  slot: FuelSlot
  /** True when the planner attached a recipe suggestion — drives the CTA copy. */
  suggestion: boolean
  /** Derived, plain-text rationale. NEVER LLM prose (the coach layer owns prose). */
  why: string
}
export interface HeroClosed {
  kind: 'closed'
  consumedKcal: number
  targetKcal: number
  doneCount: number
  totalCount: number
  proteinG: number
  proteinTargetG: number
}
export type HeroWindow = HeroOpen | HeroClosed
export interface HeroResult {
  hero: HeroWindow
  missed: FuelSlot[]
}

function deriveWhy(slot: FuelSlot, blocks: PlannerBlock[], budget: { c: number }): string {
  const next = blocks
    .filter(b => toMin(b.time) > toMin(slot.time))
    .sort((a, z) => toMin(a.time) - toMin(z.time))[0]
  if (next && slot.c && budget.c) {
    const share = Math.round((slot.c / budget.c) * 100)
    return `${next.label} ${next.time} — ez az ablak viszi a napi szénhidrát ${share}%-át`
  }
  if (slot.kcal && slot.p) return `${slot.kcal} kcal ebben az ablakban — ${slot.p} g fehérje a napi célhoz`
  if (slot.kcal) return `${slot.kcal} kcal ebben az ablakban`
  return ''
}

export function pickHeroWindow(input: {
  slots: FuelSlot[]
  blocks: PlannerBlock[]
  budget: { kcal: number; p: number; c: number }
  consumed: { kcal: number; p: number }
}): HeroResult {
  const { slots, blocks, budget, consumed } = input
  const missed = slots
    .filter(s => s.state === 'missed' && isMealSlot(s))
    .sort((a, z) => toMin(a.time) - toMin(z.time))
  const now = slots.find(s => s.state === 'now')

  if (now) {
    return {
      hero: { kind: 'open', slot: now, suggestion: !!now.suggestedRecipeId, why: deriveWhy(now, blocks, budget) },
      missed,
    }
  }
  const windows = slots.filter(isMealSlot)
  return {
    hero: {
      kind: 'closed',
      consumedKcal: consumed.kcal,
      targetKcal: budget.kcal,
      doneCount: windows.filter(s => s.state === 'done').length,
      totalCount: windows.length,
      proteinG: consumed.p,
      proteinTargetG: budget.p,
    },
    missed,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/logic/heroWindow.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/heroWindow.ts frontend/src/features/fuel/logic/heroWindow.test.ts
git commit -m "feat(fuel): hero-window selection for Mai — open/closed projection + derived why line (mezo-rrtj)"
```

---

### Task 3: Napív CSS families + `MealScoreChip`

**Files:**
- Modify: `frontend/src/styles/prototype.css` (append one clearly-headed block at the end)
- Create: `frontend/src/features/fuel/components/MealScoreChip.tsx`
- Test: `frontend/src/features/fuel/components/MealScoreChip.test.tsx`

**Interfaces:**
- Consumes: `FuelMeal` (`data/types.ts:81`).
- Produces:
  ```ts
  export function MealScoreChip(props: {
    meal: FuelMeal | null
    coachPending?: boolean
    onOpen: (meal: FuelMeal) => void
  }): JSX.Element | null
  ```
  CSS class names later tasks must use verbatim: `.nowcard` (+ `.plain`/`.closed`), `.nowcard .lbl/.dot/.clock/.why/.budget/.bignum/.ctas/.primary/.alt/.foot`, `.missedstrip`, `.daystrip` (+ `.r1/.n/.of/.pc`), `.seg` (+ `i`, `.ghost`, `.mark`), `.brk` (+ `.cap2`, `.chips`), `.ebchip` (+ `.base/.move/.def`), `.mac.water`, `.zcard` (+ `.zh/.zn/.zk/.caps`), `.zrow` (+ `.zf/.zt/.zv/.act/.sport/.anchor/.bn/.bl`), `.aiscore` (+ `.s-hi/.s-md/.s-lo/.rg/.pop`), `.coachline` (+ `.sk`), `.retamicro`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/MealScoreChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelMeal } from '@/data/types'
import { MealScoreChip } from '@/features/fuel/components/MealScoreChip'

const meal = (score: number | null): FuelMeal => ({
  id: 'm1', slot: 'Ebéd', title: 'Csirkés rizs', score,
  kcal: 900, p: 68, c: 105, f: 24, mealItems: [], items: [], tags: [],
  loggedAt: '2026-07-28T13:10:00', mealDate: '2026-07-28',
})

test('renders nothing without a scored meal — no fabricated placeholder', () => {
  const { container } = render(<MealScoreChip meal={null} onOpen={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('a high score renders the sage tone with a one-word verdict', () => {
  const { container } = render(<MealScoreChip meal={meal(0.84)} onOpen={vi.fn()} />)
  const chip = screen.getByRole('button', { name: 'AI score' })
  expect(chip).toHaveTextContent('84')
  expect(chip).toHaveTextContent('jó')
  expect(container.querySelector('.aiscore.s-hi')).toBeInTheDocument()
})

test('a mid score renders amber "közepes", a low score coral "gyenge"', () => {
  const { container: mid } = render(<MealScoreChip meal={meal(0.74)} onOpen={vi.fn()} />)
  expect(mid.querySelector('.aiscore.s-md')).toBeInTheDocument()
  expect(mid.textContent).toContain('közepes')
  const { container: low } = render(<MealScoreChip meal={meal(0.41)} onOpen={vi.fn()} />)
  expect(low.querySelector('.aiscore.s-lo')).toBeInTheDocument()
  expect(low.textContent).toContain('gyenge')
})

test('a pending coach adds a twinkle marker — the number is final, the prose is not', () => {
  render(<MealScoreChip meal={meal(0.84)} coachPending onOpen={vi.fn()} />)
  expect(screen.getByTestId('coach-twinkle')).toBeInTheDocument()
})

test('no twinkle once the coach is settled', () => {
  render(<MealScoreChip meal={meal(0.84)} onOpen={vi.fn()} />)
  expect(screen.queryByTestId('coach-twinkle')).toBeNull()
})

test('clicking the chip opens the score sheet for that meal', async () => {
  const onOpen = vi.fn()
  const m = meal(0.84)
  render(<MealScoreChip meal={m} onOpen={onOpen} />)
  await userEvent.click(screen.getByRole('button', { name: 'AI score' }))
  expect(onOpen).toHaveBeenCalledWith(m)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/components/MealScoreChip.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Append the CSS families to `prototype.css`**

Append at the end of `frontend/src/styles/prototype.css`. Copy the rules verbatim from
`docs/design/fuel-mai-hybrid-v1.html` (the `<style>` block), with these adaptations:
mockup-local tokens are already global here, `.nowcard`/`.daystrip`/`.zcard` keep their
`margin: 0 20px` → change to **`margin: 0 24px`** to match the page's existing 24px gutter
(`.pghead-np`, `.slot`), and every animation must sit behind the reduced-motion guard.

```css
/* ===== Napív Fuel Mai — guided recomposition (mezo-rrtj) =====
   Hero now-window card, day-status card with the energy/macro breakdown, and the
   napszak zone cards. Geometry mirrors docs/design/fuel-mai-hybrid-v1.html. */

/* Reta micro-strip — replaces the full RetaPhaseBar block on this page */
.retamicro { display: flex; gap: 3px; margin: 9px 24px 12px; }
.retamicro i { flex: 1; height: 5px; border-radius: 999px; background: var(--warm); }
.retamicro i.pk { background: var(--coral); }
.retamicro i.stb { background: var(--sage); }
.retamicro i.tr { background: var(--amber); }
.retamicro i.cur { box-shadow: 0 0 0 2px var(--ink); }

/* Hero — the day's single open decision */
.nowcard { position: relative; margin: 0 24px 11px; border-radius: 26px; padding: 17px;
  background: linear-gradient(152deg, #FFF3EC, #FFFDFB 62%);
  box-shadow: 0 0 0 2px var(--coral), 0 16px 34px -10px rgba(255,107,74,.32); overflow: hidden; }
:root[data-theme="dark"] .nowcard { background: linear-gradient(152deg, rgba(255,107,74,.16), rgba(255,255,255,.03) 62%); }
.nowcard::after { content: ''; position: absolute; top: -52px; right: -52px; width: 168px; height: 168px;
  border-radius: 50%; background: radial-gradient(circle, rgba(255,107,74,.15), transparent 68%); }
.nowcard > * { position: relative; z-index: 1; }
.nowcard .top { display: flex; align-items: center; gap: 8px; }
.nowcard .lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase; color: var(--coral-deep); }
.nowcard .lbl .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--coral); }
.nowcard .clock { margin-left: auto; font-family: var(--ff-mono); font-size: 10.5px; font-weight: 600;
  color: var(--sub); background: rgba(255,255,255,.82); border-radius: 999px; padding: 4px 9px; }
:root[data-theme="dark"] .nowcard .clock { background: rgba(255,255,255,.1); }
.nowcard h2 { font-family: var(--ff-display); font-size: 25px; font-weight: 800; letter-spacing: -.4px;
  line-height: 1.1; margin-top: 10px; color: var(--ink); }
.nowcard .why { font-size: 11.5px; color: var(--sub); margin-top: 5px; font-weight: 600; }
.nowcard .budget { display: flex; align-items: center; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
.nowcard .bignum { font-family: var(--ff-display); font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.nowcard .bignum small { font-size: 11px; color: var(--faint); font-weight: 800; }
.nowcard .mpill { background: rgba(255,255,255,.82); border-radius: 999px; padding: 4px 9px; font-size: 10.5px; font-weight: 800; }
:root[data-theme="dark"] .nowcard .mpill { background: rgba(255,255,255,.1); }
.nowcard .ctas { display: flex; gap: 8px; margin-top: 14px; }
.nowcard .primary { flex: 1; border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 14px 0;
  text-align: center; font-size: 14.5px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, var(--cta-g1), var(--cta-g2));
  box-shadow: 0 10px 22px rgba(255,107,74,.34), inset 0 1px 0 rgba(255,255,255,.25); }
.nowcard .alt { width: 52px; flex-shrink: 0; border: 0; cursor: pointer; font: inherit; border-radius: 999px;
  background: rgba(255,255,255,.88); box-shadow: var(--np-shadow-row); display: grid; place-items: center; font-size: 17px; }
:root[data-theme="dark"] .nowcard .alt { background: rgba(255,255,255,.1); }
.nowcard .foot { display: flex; gap: 10px; margin-top: 11px; }
.nowcard .foot button { border: 0; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; color: var(--coral-deep); }
.nowcard.closed { background: linear-gradient(152deg, #EDF3E7, #FFFDFB 62%);
  box-shadow: 0 0 0 2px var(--sage), 0 16px 34px -10px rgba(127,164,138,.28); }
:root[data-theme="dark"] .nowcard.closed { background: linear-gradient(152deg, rgba(127,164,138,.16), rgba(255,255,255,.03) 62%); }
.nowcard.closed .lbl { color: var(--sage-deep); }
.nowcard.closed .lbl .dot { background: var(--sage); }
.nowcard.closed .primary { background: linear-gradient(135deg, #9CBCA6, var(--sage)); box-shadow: 0 10px 22px rgba(127,164,138,.32); }
.nowcard.closed .foot button { color: var(--sage-deep); }

/* Missed-window strip */
.missedstrip { display: flex; align-items: center; gap: 9px; margin: 0 24px 11px; padding: 11px 14px;
  border-radius: 18px; background: var(--wash-amber); }
.missedstrip .mt { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 700; color: var(--amber-deep); }
.missedstrip button { border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 6px 12px;
  font-size: 10.5px; font-weight: 800; background: var(--surface); color: var(--amber-deep); flex-shrink: 0; }

/* Day-status card */
.daystrip { margin: 0 24px 12px; background: var(--surface); border-radius: 20px; padding: 14px 15px; box-shadow: var(--np-shadow-row); }
.daystrip .r1 { display: flex; align-items: baseline; gap: 7px; }
.daystrip .r1 .n { font-family: var(--ff-display); font-size: 23px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.3px; }
.daystrip .r1 .of { font-size: 11px; color: var(--faint); font-weight: 800; }
.daystrip .r1 .pc { margin-left: auto; font-size: 11px; font-weight: 800; color: var(--sage-deep);
  background: var(--wash-sage); border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
.daystrip .wins { font-size: 10.5px; font-weight: 700; color: var(--faint); margin-top: 7px; }
.seg { position: relative; height: 12px; border-radius: 999px; background: var(--warm); margin-top: 9px; overflow: hidden; display: flex; gap: 2px; }
.seg i { display: block; height: 100%; }
.seg .ghost { flex: 1; background: repeating-linear-gradient(90deg, rgba(43,33,24,.05) 0 4px, transparent 4px 9px); }
.seg .mark { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--coral); border-radius: 2px; }
.brk { margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--line); }
.brk .cap2 { display: flex; align-items: center; gap: 8px; font-size: 9px; font-weight: 800; letter-spacing: .12em;
  text-transform: uppercase; color: var(--faint); }
.brk .cap2::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.brk .chips { display: flex; gap: 6px; margin-top: 9px; flex-wrap: wrap; }
.ebchip { display: inline-flex; align-items: baseline; gap: 5px; border: 0; cursor: pointer; font: inherit;
  border-radius: 12px; padding: 6px 10px; font-size: 10px; font-weight: 800; }
.ebchip b { font-family: var(--ff-display); font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.2px; }
.ebchip.base { background: var(--wash-sage); color: var(--sage-deep); }
.ebchip.move { background: var(--wash-amber); color: var(--amber-deep); }
.ebchip.def { background: var(--warm); color: var(--coral-deep); }
.mac .v em { font-style: normal; color: var(--faint); font-weight: 700; }
.mac.water .v { width: auto; }
.mac.water .wq { display: flex; gap: 5px; flex-shrink: 0; }
.mac.water .wq button { border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 5px 10px;
  font-size: 10.5px; font-weight: 800; background: var(--wash-run); color: var(--tag-run); }

/* Zone cards */
.zcard { margin: 0 24px 9px; background: var(--surface); border-radius: 20px; box-shadow: var(--np-shadow-row); overflow: hidden; }
.zcard .zh { display: flex; align-items: center; gap: 9px; padding: 11px 14px; background: var(--warm); }
.zcard .zh .zn { font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); }
.zcard .zh .zk { margin-left: auto; font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink); }
.zcard .zh .zk .burn { color: var(--tag-gym); }
.zcard .zh .caps { display: flex; gap: 3px; }
.zcard .zh .caps i { width: 6px; height: 6px; border-radius: 50%; border: 1.5px solid var(--lav); box-sizing: border-box; }
.zcard .zh .caps i.on { background: var(--lav); }
.zcard.donez .zh { background: var(--wash-sage); }
.zcard.donez .zh .zn, .zcard.donez .zh .zk { color: var(--sage-deep); }
.zcard.openz { box-shadow: 0 0 0 2px var(--coral), 0 12px 28px -8px rgba(255,107,74,.24); }
.zcard.openz .zh { background: var(--wash-gym); }
.zcard.openz .zh .zn, .zcard.openz .zh .zk { color: var(--coral-deep); }
.zrow { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-top: 1px solid var(--line); }
.zrow:first-of-type { border-top: 0; }
.zrow .zf { width: 31px; height: 31px; border-radius: 11px; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; }
.zrow .zt { flex: 1; min-width: 0; }
.zrow .zt .a { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.zrow .zt .b { display: flex; align-items: center; gap: 7px; font-size: 10px; color: var(--faint); font-weight: 700; margin-top: 2px; flex-wrap: wrap; }
.zrow .zt .b b { color: var(--ink); font-weight: 800; font-size: 10.5px; }
.zrow .zv { font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--sub); flex-shrink: 0; }
.zrow .zacts { display: flex; gap: 5px; flex-shrink: 0; }
.zrow .zacts button { border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 6px 12px; font-size: 10.5px; font-weight: 800; }
.zrow .zacts .log { background: var(--wash-sage); color: var(--sage-deep); }
.zrow .zacts .log.pot { background: var(--warm); color: var(--coral-deep); }
.zrow .zacts .ai { background: var(--wash-lav); color: var(--lav-deep); }
.zrow.missedrow { opacity: .72; }
.zrow.act { background: linear-gradient(110deg, var(--wash-gym), transparent 76%); }
.zrow.act.sport { background: linear-gradient(110deg, var(--wash-sport), transparent 76%); }
.zrow.act .bn { font-family: var(--ff-display); font-size: 15px; font-weight: 800; color: var(--tag-gym);
  font-variant-numeric: tabular-nums; text-align: right; }
.zrow.act.sport .bn { color: var(--tag-sport); }
.zrow.act .bl { font-size: 7.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); text-align: right; }
.zrow.anchor { background: linear-gradient(110deg, #FFF3EC, transparent 70%); box-shadow: inset 2px 0 0 var(--coral); }
:root[data-theme="dark"] .zrow.anchor { background: linear-gradient(110deg, rgba(255,107,74,.12), transparent 70%); }
.zrow.anchor .zt .a { color: var(--coral-deep); }

/* AI score chip + coach line */
.aiscore { display: inline-flex; align-items: center; gap: 5px; border: 0; cursor: pointer; font: inherit;
  border-radius: 999px; padding: 4px 9px 4px 5px; font-size: 10px; font-weight: 800; flex-shrink: 0; }
.aiscore .rg { width: 16px; height: 16px; flex-shrink: 0; }
.aiscore.s-hi { background: var(--wash-sage); color: var(--sage-deep); }
.aiscore.s-md { background: var(--wash-amber); color: var(--amber-deep); }
.aiscore.s-lo { background: var(--wash-gym); color: var(--tag-gym); }
.coachline { font-size: 10.5px; line-height: 1.35; color: var(--sub); margin-top: 3px; }
.coachline.sk { height: 10px; border-radius: 5px; width: 78%; margin-top: 5px;
  background: linear-gradient(90deg, var(--warm), var(--canvas), var(--warm)); background-size: 220% 100%; }

@media (prefers-reduced-motion: no-preference) {
  .nowcard .lbl .dot { animation: np-hero-pulse 2.2s ease-out infinite; }
  .nowcard .primary { transition: transform .18s var(--np-ease-spring); }
  .nowcard .primary:active { transform: scale(.96); }
  .seg i { animation: np-seg-grow 1.1s var(--np-ease-ios) both; }
  .aiscore { animation: np-chip-pop .5s var(--np-ease-spring); }
  .coachline.sk { animation: np-sk-slide 1.4s linear infinite; }
}
@keyframes np-hero-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255,107,74,.5); }
  70% { box-shadow: 0 0 0 9px rgba(255,107,74,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,107,74,0); }
}
@keyframes np-seg-grow { from { width: 0 !important; } }
@keyframes np-chip-pop {
  0% { transform: scale(.75); opacity: .4; }
  70% { transform: scale(1.12); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes np-sk-slide { to { background-position: -120% 0; } }
```

- [ ] **Step 4: Write `MealScoreChip.tsx`**

```tsx
import type { FuelMeal } from '@/data/types'

// AI score chip (mezo-rrtj) — replaces SlotCard's bare `AI 74`. The score itself is deterministic
// and arrives WITH the write (P7), so it is never "computing"; the seconds-long LLM step is the
// coach verdict, which is why a pending coach only adds a twinkle beside a final number.
const RING_R = 8
const RING_C = 2 * Math.PI * RING_R

type Tone = { cls: 's-hi' | 's-md' | 's-lo'; word: string }
function toneOf(pct: number): Tone {
  if (pct >= 80) return { cls: 's-hi', word: 'jó' }
  if (pct >= 60) return { cls: 's-md', word: 'közepes' }
  return { cls: 's-lo', word: 'gyenge' }
}

export function MealScoreChip({
  meal,
  coachPending,
  onOpen,
}: {
  meal: FuelMeal | null
  /** The coach verdict for this meal is still in flight (useMealCoach().isPending). */
  coachPending?: boolean
  onOpen: (meal: FuelMeal) => void
}) {
  if (!meal) return null
  const pct = Math.round((meal.score ?? 0) * 100)
  const tone = toneOf(pct)
  return (
    <button
      type="button"
      aria-label="AI score"
      className={`aiscore ${tone.cls}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(meal)
      }}
    >
      <svg className="rg" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r={RING_R} fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
        <circle
          cx="10" cy="10" r={RING_R} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${((pct / 100) * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
      {pct} · {tone.word}
      {coachPending && (
        <span data-testid="coach-twinkle" className="np-twinkle" aria-hidden="true">✨</span>
      )}
    </button>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/components/MealScoreChip.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify the CSS compiles and the reduced-motion guard is present**

Run: `cd frontend && pnpm build`
Expected: build succeeds. Then confirm the guard:
Run: `grep -c "prefers-reduced-motion" src/styles/prototype.css`
Expected: a count ≥ 4 (the pre-existing guards plus the new one).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/prototype.css frontend/src/features/fuel/components/MealScoreChip.tsx \
  frontend/src/features/fuel/components/MealScoreChip.test.tsx
git commit -m "feat(fuel): Mai CSS families + scaled MealScoreChip with a coach-pending twinkle (mezo-rrtj)"
```

---

### Task 4: `NowWindowCard` + `MissedStrip`

**Files:**
- Create: `frontend/src/features/fuel/components/NowWindowCard.tsx`
- Create: `frontend/src/features/fuel/components/MissedStrip.tsx`
- Test: `frontend/src/features/fuel/components/NowWindowCard.test.tsx`
- Test: `frontend/src/features/fuel/components/MissedStrip.test.tsx`

**Interfaces:**
- Consumes: `HeroWindow` from Task 2, the `.nowcard`/`.missedstrip` CSS from Task 3, `FuelSlot`.
- Produces:
  ```ts
  export function NowWindowCard(props: {
    hero: HeroWindow
    onLogMeal: (slot: FuelSlot) => void      // suggestion prefill / window log
    onAiLog: (slot: FuelSlot) => void
    onLogOther: (slot: FuelSlot) => void     // same window, no recipe prefill
    onLogEmpty: () => void                   // closed-day late snack
  }): JSX.Element
  export function MissedStrip(props: {
    slots: FuelSlot[]
    onLogMeal: (slot: FuelSlot) => void
  }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/fuel/components/NowWindowCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { HeroWindow } from '@/features/fuel/logic/heroWindow'
import type { FuelSlot } from '@/data/types'
import { NowWindowCard } from '@/features/fuel/components/NowWindowCard'

const slot: FuelSlot = {
  time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now',
  mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1', kcal: 900, p: 68, c: 105, f: 24,
}
const openHero: HeroWindow = { kind: 'open', slot, suggestion: true, why: 'Pull Day 17:00 — fuel' }

const renderCard = (hero: HeroWindow, handlers: Partial<Parameters<typeof NowWindowCard>[0]> = {}) => {
  const props = {
    hero, onLogMeal: vi.fn(), onAiLog: vi.fn(), onLogOther: vi.fn(), onLogEmpty: vi.fn(), ...handlers,
  }
  render(<NowWindowCard {...props} />)
  return props
}

test('an open suggestion hero shows the recipe, the why line and the window budget', () => {
  const { container } = render(
    <NowWindowCard hero={openHero} onLogMeal={vi.fn()} onAiLog={vi.fn()} onLogOther={vi.fn()} onLogEmpty={vi.fn()} />,
  )
  expect(container.querySelector('.nowcard')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Csirkés rizs bowl' })).toBeInTheDocument()
  expect(screen.getByText('Pull Day 17:00 — fuel')).toBeInTheDocument()
  expect(screen.getByText(/900/)).toBeInTheDocument()
  expect(screen.getByText('F 68')).toBeInTheDocument()
  expect(screen.getByText('13:00 óta')).toBeInTheDocument()
})

test('the primary CTA is slot-scoped so it cannot collide with the header log chip', async () => {
  const props = renderCard(openHero)
  const cta = screen.getByRole('button', { name: 'Ebéd logolása' })
  expect(cta).toHaveTextContent('Logolás')
  await userEvent.click(cta)
  expect(props.onLogMeal).toHaveBeenCalledWith(slot)
})

test('the AI button fires onAiLog for the open window', async () => {
  const props = renderCard(openHero)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd AI-logolása' }))
  expect(props.onAiLog).toHaveBeenCalledWith(slot)
})

test('the foot link logs something else into the same window', async () => {
  const props = renderCard(openHero)
  await userEvent.click(screen.getByRole('button', { name: 'Más ételt logolok az Ebéd ablakba' }))
  expect(props.onLogOther).toHaveBeenCalledWith(slot)
})

test('a suggestion-less open window asks what was eaten instead of naming a recipe', () => {
  const bare: FuelSlot = { ...slot, mealName: undefined, suggestedRecipeId: undefined }
  renderCard({ kind: 'open', slot: bare, suggestion: false, why: '900 kcal ebben az ablakban' })
  expect(screen.getByRole('heading', { name: 'Ebéd-ablak' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toHaveTextContent('Mit ettél?')
})

test('the closed-day hero summarises and offers only a real affordance', async () => {
  const props = renderCard({
    kind: 'closed', consumedKcal: 2940, targetKcal: 3010, doneCount: 5, totalCount: 5,
    proteinG: 178, proteinTargetG: 185,
  })
  const { container } = render(
    <NowWindowCard
      hero={{ kind: 'closed', consumedKcal: 2940, targetKcal: 3010, doneCount: 5, totalCount: 5, proteinG: 178, proteinTargetG: 185 }}
      onLogMeal={vi.fn()} onAiLog={vi.fn()} onLogOther={vi.fn()} onLogEmpty={vi.fn()}
    />,
  )
  expect(container.querySelector('.nowcard.closed')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { name: '2940 / 3010 kcal' }).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/5\/5 ablak/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/fehérje 178\/185 g/).length).toBeGreaterThan(0)
  // No dead CTA: the day-closing view does not exist yet, so there is no "Napi zárás" button.
  expect(screen.queryByRole('button', { name: /napi zárás/i })).toBeNull()
  await userEvent.click(screen.getAllByRole('button', { name: 'Késői snack logolása' })[0])
  expect(props.onLogEmpty).toHaveBeenCalled()
})
```

Create `frontend/src/features/fuel/components/MissedStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { MissedStrip } from '@/features/fuel/components/MissedStrip'

const missed = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '11:30', kind: 'snack', label: 'Tízórai', slotKey: 'snack', state: 'missed', kcal: 300, ...over,
})

test('renders nothing when no window was missed', () => {
  const { container } = render(<MissedStrip slots={[]} onLogMeal={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('names the missed window and retro-logs it', async () => {
  const slot = missed()
  const onLogMeal = vi.fn()
  render(<MissedStrip slots={[slot]} onLogMeal={onLogMeal} />)
  expect(screen.getByText(/Tízórai kimaradt/)).toBeInTheDocument()
  expect(screen.getByText(/300 kcal/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tízórai pótlása' }))
  expect(onLogMeal).toHaveBeenCalledWith(slot)
})

test('counts the remaining missed windows instead of stacking strips', () => {
  render(<MissedStrip slots={[missed(), missed({ label: 'Reggeli', time: '09:15' })]} onLogMeal={vi.fn()} />)
  expect(screen.getByText(/\+1 másik/)).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm test -- src/features/fuel/components/NowWindowCard.test.tsx src/features/fuel/components/MissedStrip.test.tsx`
Expected: FAIL — components cannot be resolved.

- [ ] **Step 3: Write `MissedStrip.tsx`**

```tsx
import type { FuelSlot } from '@/data/types'

// Missed-window strip (mezo-rrtj). buildDayPlan guarantees at most one `now`, so a missed window is
// never the day's single actionable thing — it is an ADDITIONAL affordance next to the hero, not a
// replacement for it. Only the earliest one gets a CTA; the rest are counted, so a badly-tracked
// day cannot bury the hero under a stack of amber strips.
export function MissedStrip({
  slots,
  onLogMeal,
}: {
  slots: FuelSlot[]
  onLogMeal: (slot: FuelSlot) => void
}) {
  const [first, ...rest] = slots
  if (!first) return null
  return (
    <div className="missedstrip">
      <span aria-hidden="true">⚠</span>
      <span className="mt">
        {first.label} kimaradt{first.kcal != null ? ` · ${first.kcal} kcal` : ''}
        {rest.length > 0 ? ` · +${rest.length} másik` : ''}
      </span>
      <button type="button" aria-label={`${first.label} pótlása`} onClick={() => onLogMeal(first)}>
        Pótlás
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Write `NowWindowCard.tsx`**

```tsx
import type { HeroWindow } from '@/features/fuel/logic/heroWindow'
import type { FuelSlot } from '@/data/types'

// The Mai hero (mezo-rrtj) — the single decision the page asks for. Its content is a projection of
// buildDayPlan's own state (pickHeroWindow), so it can never disagree with the timeline below it.
export function NowWindowCard({
  hero,
  onLogMeal,
  onAiLog,
  onLogOther,
  onLogEmpty,
}: {
  hero: HeroWindow
  onLogMeal: (slot: FuelSlot) => void
  onAiLog: (slot: FuelSlot) => void
  onLogOther: (slot: FuelSlot) => void
  onLogEmpty: () => void
}) {
  if (hero.kind === 'closed') {
    return (
      <div className="nowcard closed">
        <div className="top">
          <span className="lbl"><span className="dot" /> nap lezárva</span>
        </div>
        <h2>{hero.consumedKcal} / {hero.targetKcal} kcal</h2>
        <div className="why">
          {hero.doneCount}/{hero.totalCount} ablak · fehérje {hero.proteinG}/{hero.proteinTargetG} g
        </div>
        <div className="ctas">
          <button type="button" className="primary" aria-label="Késői snack logolása" onClick={onLogEmpty}>
            Késői snack logolása
          </button>
        </div>
      </div>
    )
  }

  const { slot, suggestion, why } = hero
  const title = suggestion && slot.mealName ? slot.mealName : `${slot.label}-ablak`
  return (
    <div className="nowcard">
      <div className="top">
        <span className="lbl"><span className="dot" /> most nyitva · {slot.label}</span>
        <span className="clock">{slot.time} óta</span>
      </div>
      <h2>{title}</h2>
      {why && <div className="why">{why}</div>}
      <div className="budget">
        {slot.kcal != null && <span className="bignum">{slot.kcal} <small>kcal</small></span>}
        {slot.p != null && <span className="mpill" style={{ color: 'var(--sage-deep)' }}>F {slot.p}</span>}
        {slot.c != null && <span className="mpill" style={{ color: 'var(--amber-deep)' }}>Sz {slot.c}</span>}
        {slot.f != null && <span className="mpill" style={{ color: 'var(--lav-deep)' }}>Zs {slot.f}</span>}
      </div>
      <div className="ctas">
        <button
          type="button" className="primary"
          aria-label={`${slot.label} logolása`}
          onClick={() => onLogMeal(slot)}
        >
          {suggestion ? 'Logolás' : 'Mit ettél?'}
        </button>
        <button
          type="button" className="alt"
          aria-label={`${slot.label} AI-logolása`}
          onClick={() => onAiLog(slot)}
        >
          ✨
        </button>
      </div>
      <div className="foot">
        <button
          type="button"
          aria-label={`Más ételt logolok az ${slot.label} ablakba`}
          onClick={() => onLogOther(slot)}
        >
          Más ételt logolok
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- src/features/fuel/components/NowWindowCard.test.tsx src/features/fuel/components/MissedStrip.test.tsx`
Expected: PASS. If the `Más ételt logolok az Ebéd ablakba` label reads awkwardly for a label
starting with a consonant, keep the string exactly as the test expects — copy tuning is a
follow-up, and a mismatch here is a test failure.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/NowWindowCard.tsx frontend/src/features/fuel/components/NowWindowCard.test.tsx \
  frontend/src/features/fuel/components/MissedStrip.tsx frontend/src/features/fuel/components/MissedStrip.test.tsx
git commit -m "feat(fuel): Mai hero now-window card + missed-window strip (mezo-rrtj)"
```

---

### Task 5: `DayBudgetCard`

**Files:**
- Create: `frontend/src/features/fuel/components/DayBudgetCard.tsx`
- Test: `frontend/src/features/fuel/components/DayBudgetCard.test.tsx`

**Interfaces:**
- Consumes: the `.daystrip`/`.seg`/`.brk`/`.ebchip`/`.mac` CSS from Task 3, `pct` (`shared/lib/pct.ts`), `EnergySection` (`features/fuel/sheets/EnergyBreakdownSheet.tsx`).
- Produces:
  ```ts
  export function DayBudgetCard(props: {
    consumed: { kcal: number; p: number; c: number; f: number; water: number }
    budget: { kcal: number; p: number; c: number; f: number }
    waterTarget: number
    energy: { base: number; activity: number; balance: number; target: number }
    /** Hide the breakdown chips on the static-fallback path (no BMR → chips are meaningless). */
    staticEnergy: boolean
    loggedKcals: number[]
    doneCount: number
    totalCount: number
    /** 0..1 position of `now` within the wake→bed span; null hides the tick. */
    nowFrac: number | null
    onOpenEnergy: (section: EnergySection) => void
    onLogWater: (ml: number) => void
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/DayBudgetCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { DayBudgetCard } from '@/features/fuel/components/DayBudgetCard'

const base = {
  consumed: { kcal: 790, p: 58, c: 92, f: 22, water: 1850 },
  budget: { kcal: 3010, p: 185, c: 265, f: 86 },
  waterTarget: 4000,
  energy: { base: 2380, activity: 930, balance: -300, target: 3010 },
  staticEnergy: false,
  loggedKcals: [580, 210],
  doneCount: 2,
  totalCount: 5,
  nowFrac: 0.42,
}

const renderCard = (over: Partial<typeof base> & { onOpenEnergy?: ReturnType<typeof vi.fn>; onLogWater?: ReturnType<typeof vi.fn> } = {}) => {
  const onOpenEnergy = over.onOpenEnergy ?? vi.fn()
  const onLogWater = over.onLogWater ?? vi.fn()
  const result = render(<DayBudgetCard {...base} {...over} onOpenEnergy={onOpenEnergy} onLogWater={onLogWater} />)
  return { ...result, onOpenEnergy, onLogWater }
}

test('leads with the REMAINING kcal — the number a decision is made from', () => {
  renderCard()
  expect(screen.getByText('2220')).toBeInTheDocument()
  expect(screen.getByText(/790 \/ 3010/)).toBeInTheDocument()
  expect(screen.getByText('26%')).toBeInTheDocument()
  expect(screen.getByText(/2\/5 ablak/)).toBeInTheDocument()
})

test('an overshot day clamps the remaining number at zero instead of going negative', () => {
  renderCard({ consumed: { ...base.consumed, kcal: 3300 } })
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('110%')).toBeInTheDocument()
})

test('renders one segment per logged meal plus the ghost remainder', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.seg > i')).toHaveLength(2)
  expect(container.querySelector('.seg .ghost')).toBeInTheDocument()
  expect(container.querySelector('.seg .mark')).toBeInTheDocument()
})

test('hides the now tick when there is no now window', () => {
  const { container } = renderCard({ nowFrac: null })
  expect(container.querySelector('.seg .mark')).toBeNull()
})

test('explains where the target comes from with three tappable chips', async () => {
  const { onOpenEnergy } = renderCard()
  expect(screen.getByText(/honnan a 3010 kcal/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Alaphő 2380/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('base')
  await userEvent.click(screen.getByRole('button', { name: /Mozgás \+930/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('movement')
  await userEvent.click(screen.getByRole('button', { name: /Deficit 300/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('deficit')
})

test('a surplus balance reads Felesleg, a zero balance Egyensúly', () => {
  renderCard({ energy: { ...base.energy, balance: 250 } })
  expect(screen.getByRole('button', { name: /Felesleg \+250/ })).toBeInTheDocument()
})

test('hides the breakdown chips on the static-energy fallback path', () => {
  renderCard({ staticEnergy: true })
  expect(screen.queryByText(/honnan a/i)).toBeNull()
  expect(screen.queryByRole('button', { name: /Alaphő/ })).toBeNull()
})

test('renders four named macro rows with absolute values, water last', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.mac')).toHaveLength(4)
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('Szénhidrát')).toBeInTheDocument()
  expect(screen.getByText('Zsír')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()
  expect(screen.getByText(/58/)).toBeInTheDocument()
  expect(screen.getByText(/\/ 185 g/)).toBeInTheDocument()
  expect(screen.getByText(/1850/)).toBeInTheDocument()
  expect(screen.getByText(/\/ 4000 ml/)).toBeInTheDocument()
})

test('the water row keeps the quick-add buttons and their aria-labels', async () => {
  const { onLogWater } = renderCard()
  await userEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  expect(onLogWater).toHaveBeenNthCalledWith(1, 250)
  expect(onLogWater).toHaveBeenNthCalledWith(2, 500)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/components/DayBudgetCard.test.tsx`
Expected: FAIL — component cannot be resolved.

- [ ] **Step 3: Write `DayBudgetCard.tsx`**

```tsx
import { pct } from '@/shared/lib/pct'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'

// The Mai day-status card (mezo-rrtj). Replaces BOTH the old "Mai cél" card and the KcalGauge —
// they printed the same number twice (budget.kcal === plan.energy.target). One hero number here,
// and it is the REMAINING kcal, because that is what the next decision is made from. The three
// energy chips keep the old card's EnergyBreakdownSheet wiring; water became the 4th macro row.
const WATER_STEPS = [250, 500] as const

function balanceLabel(balance: number): string {
  if (balance < 0) return `Deficit ${Math.abs(balance)}`
  if (balance > 0) return `Felesleg +${balance}`
  return 'Egyensúly'
}

export function DayBudgetCard({
  consumed,
  budget,
  waterTarget,
  energy,
  staticEnergy,
  loggedKcals,
  doneCount,
  totalCount,
  nowFrac,
  onOpenEnergy,
  onLogWater,
}: {
  consumed: { kcal: number; p: number; c: number; f: number; water: number }
  budget: { kcal: number; p: number; c: number; f: number }
  waterTarget: number
  energy: { base: number; activity: number; balance: number; target: number }
  staticEnergy: boolean
  loggedKcals: number[]
  doneCount: number
  totalCount: number
  nowFrac: number | null
  onOpenEnergy: (section: EnergySection) => void
  onLogWater: (ml: number) => void
}) {
  const remaining = Math.max(0, budget.kcal - consumed.kcal)
  const consumedPct = budget.kcal > 0 ? Math.round((consumed.kcal / budget.kcal) * 100) : 0
  // Segment widths share ONE denominator with the ghost remainder, so the bar can never overflow.
  const segWidth = (kcal: number) => `${Math.min(100, pct(kcal, budget.kcal))}%`

  return (
    <div className="daystrip">
      <div className="r1">
        <span className="n">{remaining}</span>
        <span className="of">kcal hátra · {consumed.kcal} / {budget.kcal}</span>
        <span className="pc">{consumedPct}%</span>
      </div>
      <div className="wins">{doneCount}/{totalCount} ablak logolva</div>
      <div className="seg">
        {loggedKcals.map((kcal, i) => (
          <i key={i} style={{ width: segWidth(kcal), background: i % 2 === 0 ? 'var(--sage)' : '#93B49C' }} />
        ))}
        <span className="ghost" />
        {nowFrac != null && <span className="mark" style={{ left: `${Math.min(100, Math.max(0, nowFrac * 100))}%` }} />}
      </div>

      {!staticEnergy && (
        <div className="brk">
          <div className="cap2">honnan a {energy.target} kcal</div>
          <div className="chips">
            <button type="button" className="ebchip base" onClick={() => onOpenEnergy('base')}>
              Alaphő <b>{energy.base}</b>
            </button>
            <button type="button" className="ebchip move" onClick={() => onOpenEnergy('movement')}>
              Mozgás <b>+{energy.activity}</b>
            </button>
            <button type="button" className="ebchip def" onClick={() => onOpenEnergy('deficit')}>
              {balanceLabel(energy.balance)}
            </button>
          </div>
        </div>
      )}

      <div className="macror">
        <div className="mac">
          <span className="k">Fehérje</span>
          <span className="bar"><i style={{ width: pct(consumed.p, budget.p) + '%', background: 'var(--sage)' }} /></span>
          <span className="v">{consumed.p} <em>/ {budget.p} g</em></span>
        </div>
        <div className="mac">
          <span className="k">Szénhidrát</span>
          <span className="bar"><i style={{ width: pct(consumed.c, budget.c) + '%', background: 'var(--amber)' }} /></span>
          <span className="v">{consumed.c} <em>/ {budget.c} g</em></span>
        </div>
        <div className="mac">
          <span className="k">Zsír</span>
          <span className="bar"><i style={{ width: pct(consumed.f, budget.f) + '%', background: 'var(--lav)' }} /></span>
          <span className="v">{consumed.f} <em>/ {budget.f} g</em></span>
        </div>
        <div className="mac water">
          <span className="k">Víz</span>
          <span className="bar"><i style={{ width: pct(consumed.water, waterTarget) + '%', background: 'var(--sky)' }} /></span>
          <span className="wq">
            {WATER_STEPS.map(ml => (
              <button key={ml} type="button" aria-label={`Víz +${ml} ml`} onClick={() => onLogWater(ml)}>
                +{ml}
              </button>
            ))}
          </span>
          <span className="v">{consumed.water} <em>/ {waterTarget} ml</em></span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/components/DayBudgetCard.test.tsx`
Expected: PASS (9 tests). If `getByText(/58/)` matches more than one node, tighten the query to
`getByText(/^58$/)` on the value node — do not weaken the assertion by deleting it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/DayBudgetCard.tsx frontend/src/features/fuel/components/DayBudgetCard.test.tsx
git commit -m "feat(fuel): Mai day-status card — remaining kcal + energy breakdown + water as the 4th macro row (mezo-rrtj)"
```

---

### Task 6: `ZoneSlotRow` (ports every `SlotCard` behaviour)

**Files:**
- Create: `frontend/src/features/fuel/components/ZoneSlotRow.tsx`
- Test: `frontend/src/features/fuel/components/ZoneSlotRow.test.tsx`
- Read (source of the behaviours to port): `frontend/src/features/fuel/components/SlotCard.tsx`, `frontend/src/features/fuel/components/SlotCard.test.tsx`

**Interfaces:**
- Consumes: `slotRole` (Task 1), `MealScoreChip` (Task 3), the `.zrow` CSS (Task 3),
  `SupplementItemRow` (`features/fuel/components/SupplementItemRow.tsx`), `SafeMarkdown`
  (`shared/lib/safeMarkdown.ts`), `FuelMeal`/`FuelSlot`.
- Produces:
  ```ts
  export function ZoneSlotRow(props: {
    slot: FuelSlot
    scoredMeal: FuelMeal | null
    tagline: string | null
    coachPending: boolean
    burnKcal: number
    /** The hero already renders this window's CTA — the row becomes a chronology anchor. */
    anchored: boolean
    onOpenScore: (meal: FuelMeal) => void
    onLogMeal?: (slot: FuelSlot) => void
    onAiLog?: (slot: FuelSlot) => void
    onOpenStack?: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/ZoneSlotRow.test.tsx`. This is the ported
`SlotCard.test.tsx` — every behaviour below existed before and must survive:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelMeal, FuelSlot } from '@/data/types'
import { ZoneSlotRow } from '@/features/fuel/components/ZoneSlotRow'

const noop = () => {}
const defaults = {
  scoredMeal: null, tagline: null, coachPending: false, burnKcal: 0, anchored: false, onOpenScore: noop,
}

function renderRow(slot: FuelSlot, over: Record<string, unknown> = {}) {
  const onLogMeal = (over.onLogMeal as ReturnType<typeof vi.fn>) ?? vi.fn()
  render(<ZoneSlotRow slot={slot} {...defaults} {...over} onLogMeal={onLogMeal} />)
  return onLogMeal
}

// ── Recipe-suggestion window (ported) ─────────────────────────────────────────
const suggestion: FuelSlot = {
  time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  mealName: 'Túrós palacsinta', suggestedRecipeId: 'r1', kcal: 500, p: 35, c: 50, f: 15,
}

test('suggestion row renders the recipe name, macros and an "ajánlott" marker', () => {
  renderRow(suggestion)
  expect(screen.getByText('Túrós palacsinta')).toBeInTheDocument()
  expect(screen.getByText('ajánlott')).toBeInTheDocument()
  expect(screen.getByText('500 kcal')).toBeInTheDocument()
  expect(screen.getByText('F 35')).toBeInTheDocument()
  expect(screen.getByText('Sz 50')).toBeInTheDocument()
  expect(screen.getByText('Zs 15')).toBeInTheDocument()
})

test('tapping the suggestion Logolás CTA fires onLogMeal(slot)', async () => {
  const onLogMeal = renderRow(suggestion)
  await userEvent.click(screen.getByRole('button', { name: 'Túrós palacsinta logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(suggestion)
})

// ── Budget-only window (ported) ───────────────────────────────────────────────
const budget: FuelSlot = { time: '12:30', kind: 'meal', label: 'Ebéd', state: 'pending', kcal: 700, p: 45, c: 70, f: 22 }

test('budget-only row renders its label and a Logolás affordance', async () => {
  const onLogMeal = renderRow(budget)
  expect(screen.getByText('Ebéd')).toBeInTheDocument()
  expect(screen.getByText('700 kcal')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(budget)
})

// ── AI chip gating (ported, mezo-53su) ────────────────────────────────────────
const budgetWithSlotKey: FuelSlot = { ...budget, slotKey: 'lunch' }

test('an open window with a slotKey renders BOTH Logolás and the AI chip', () => {
  render(<ZoneSlotRow slot={budgetWithSlotKey} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd AI-logolása' })).toBeInTheDocument()
})

test('clicking the AI chip fires onAiLog(slot)', async () => {
  const onAiLog = vi.fn()
  render(<ZoneSlotRow slot={budgetWithSlotKey} {...defaults} onLogMeal={vi.fn()} onAiLog={onAiLog} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd AI-logolása' }))
  expect(onAiLog).toHaveBeenCalledWith(budgetWithSlotKey)
})

test('a window WITHOUT a slotKey renders Logolás but no AI chip', () => {
  render(<ZoneSlotRow slot={budget} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ebéd AI-logolása' })).toBeNull()
})

test('a done window renders neither log affordance', () => {
  const done: FuelSlot = {
    time: '09:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
    mealName: 'Zabkása', kcal: 500, p: 30, c: 55, f: 12,
  }
  render(<ZoneSlotRow slot={done} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /logolása/ })).toBeNull()
})

// ── Missed window (ported, mezo-1oy5) ─────────────────────────────────────────
test('a missed window renders faded with a Pótlás retro-log', () => {
  const slot = { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed', kcal: 610 } as FuelSlot
  const onLogMeal = vi.fn()
  const { container } = render(<ZoneSlotRow slot={slot} {...defaults} onLogMeal={onLogMeal} />)
  expect(container.querySelector('.zrow.missedrow')).toBeInTheDocument()
  expect(screen.getByText('kihagyott')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /pótlása/i }))
  expect(onLogMeal).toHaveBeenCalledWith(slot)
})

test('a missed window that still carries suggestedRecipeId renders ONLY Pótlás', () => {
  const slot = {
    time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed',
    mealName: 'Túrós tészta', suggestedRecipeId: 'r1', kcal: 610,
  } as FuelSlot
  render(<ZoneSlotRow slot={slot} {...defaults} onLogMeal={vi.fn()} />)
  expect(screen.getByRole('button', { name: /pótlása/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /logolása/i })).toBeNull()
})

// ── Empty mealName falls back to the label (ported, mezo-u68c) ─────────────────
test('falls back to the slot label when mealName is empty', () => {
  renderRow({
    time: '08:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: '',
    kcal: 500, p: 30, c: 55, f: 12,
  })
  expect(screen.getByText('Reggeli')).toBeInTheDocument()
})

// ── Activity rows: duration guard (ported) + the burn readout (new) ───────────
test('an activity row without a duration renders no "· perc" suffix', () => {
  renderRow({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending' })
  expect(screen.getByText('Push A')).toBeInTheDocument()
  expect(screen.queryByText(/perc/)).toBeNull()
  expect(screen.queryByText(/undefined/)).toBeNull()
})

test('an activity row with a duration keeps the "· N perc" suffix', () => {
  renderRow({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending', duration: 60 })
  expect(screen.getByText('Push A · 60 perc')).toBeInTheDocument()
})

test('an activity row shows the kcal it contributed to the target', () => {
  const { container } = render(
    <ZoneSlotRow
      slot={{ time: '17:00', kind: 'workout', label: 'Pull Day', state: 'pending', duration: 90 }}
      {...defaults} burnKcal={510}
    />,
  )
  expect(container.querySelector('.zrow.act')).toBeInTheDocument()
  expect(screen.getByText('+510')).toBeInTheDocument()
  expect(screen.getByText(/kcal a célban/)).toBeInTheDocument()
})

test('a sport activity row uses the sport accent', () => {
  const { container } = render(
    <ZoneSlotRow slot={{ time: '20:00', kind: 'sport', label: 'Röplabda', state: 'pending', duration: 90 }} {...defaults} burnKcal={420} />,
  )
  expect(container.querySelector('.zrow.act.sport')).toBeInTheDocument()
})

test('an activity row with no computed burn prints no burn block', () => {
  render(<ZoneSlotRow slot={{ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending' }} {...defaults} burnKcal={0} />)
  expect(screen.queryByText(/kcal a célban/)).toBeNull()
})

// ── Supplement rows (ported: items + 🌙) ──────────────────────────────────────
test('a supplement row lists its items and offers the stack as its destination', async () => {
  const onOpenStack = vi.fn()
  render(
    <ZoneSlotRow
      slot={{
        time: '21:30', kind: 'evening', label: 'Esti stack', state: 'pending',
        items: [
          { type: 'supplement', refId: 'mg', label: 'Magnézium · 300mg', done: false },
          { type: 'supplement', refId: 'o3', label: 'Omega-3 · 2g', done: true },
        ],
      }}
      {...defaults} onOpenStack={onOpenStack}
    />,
  )
  expect(screen.getByText(/Magnézium · 300mg/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Esti stack · Stack megnyitása' }))
  expect(onOpenStack).toHaveBeenCalled()
})

// ── Coach tagline + score chip (ported, mezo-mr4n) ────────────────────────────
const loggedSlot: FuelSlot = {
  time: '06:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
  mealName: 'Zabkása', kcal: 520, p: 24, c: 70, f: 12,
}
const scored: FuelMeal = {
  id: 'm1', slot: 'Reggeli', title: 'Zabkása', score: 0.74, kcal: 520, p: 24, c: 70, f: 12,
  mealItems: [], items: [], tags: [], loggedAt: '2026-07-28T06:15:00', mealDate: '2026-07-28',
}

test('renders the coach tagline when a verdict exists', () => {
  render(<ZoneSlotRow slot={loggedSlot} {...defaults} tagline="Remek pre-workout üzemanyag" />)
  expect(screen.getByTestId('coach-tagline')).toHaveTextContent('Remek pre-workout üzemanyag')
})

test('renders a skeleton line while the coach verdict is in flight — the expensive call is visible', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} coachPending scoredMeal={scored} />)
  expect(container.querySelector('.coachline.sk')).toBeInTheDocument()
  expect(screen.queryByTestId('coach-tagline')).toBeNull()
})

test('renders no coach row at all when the coach is settled and silent', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} tagline={null} />)
  expect(container.querySelector('.coachline')).toBeNull()
  expect(screen.queryByTestId('coach-tagline')).toBeNull()
})

test('the score chip opens the score sheet for the scored meal', async () => {
  const onOpenScore = vi.fn()
  render(<ZoneSlotRow slot={loggedSlot} {...defaults} scoredMeal={scored} onOpenScore={onOpenScore} />)
  await userEvent.click(screen.getByRole('button', { name: 'AI score' }))
  expect(onOpenScore).toHaveBeenCalledWith(scored)
})

// ── Anchored row: the hero owns this window's CTA (new) ───────────────────────
test('an anchored now row points at the hero and renders NO duplicate CTA', () => {
  const now: FuelSlot = { ...budgetWithSlotKey, state: 'now' }
  const { container } = render(<ZoneSlotRow slot={now} {...defaults} anchored onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(container.querySelector('.zrow.anchor')).toBeInTheDocument()
  expect(screen.getByText(/a kártya fent/)).toBeInTheDocument()
  // Critical: a second `Ebéd logolása` button would collide with the hero's aria-label.
  expect(screen.queryByRole('button', { name: /logolása/ })).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/components/ZoneSlotRow.test.tsx`
Expected: FAIL — component cannot be resolved.

- [ ] **Step 3: Write `ZoneSlotRow.tsx`**

```tsx
import { slotRole } from '@/features/fuel/logic/dayZones'
import { MealScoreChip } from '@/features/fuel/components/MealScoreChip'
import { SupplementItemRow } from '@/features/fuel/components/SupplementItemRow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { FuelKind, FuelMeal, FuelSlot } from '@/data/types'

// One row inside a DayZoneCard (mezo-rrtj) — the retired SlotCard's behaviour at zone density.
// Every gating rule is carried over verbatim (missed wins over a lingering suggestion; the AI chip
// needs a slotKey AND a handler; the duration suffix is guarded), plus two additions: an activity
// row prints the kcal it added to the target, and the hero's own window renders as a CTA-less
// anchor so the page never ships two buttons with the same aria-label.
const FAV_EMOJI: Record<FuelKind, string> = {
  wake: '💧', meal: '🥣', midday: '💊', snack: '🍎', preworkout: '💊', workout: '🏋️', sport: '🏐', evening: '💊',
}
const FAV_WASH: Record<FuelKind, string> = {
  wake: 'var(--wash-run)', meal: 'var(--wash-sage)', midday: 'var(--wash-lav)', snack: 'var(--wash-amber)',
  preworkout: 'var(--wash-lav)', workout: 'var(--wash-gym)', sport: 'var(--wash-sport)', evening: 'var(--wash-lav)',
}

export function ZoneSlotRow({
  slot,
  scoredMeal,
  tagline,
  coachPending,
  burnKcal,
  anchored,
  onOpenScore,
  onLogMeal,
  onAiLog,
  onOpenStack,
}: {
  slot: FuelSlot
  scoredMeal: FuelMeal | null
  tagline: string | null
  coachPending: boolean
  burnKcal: number
  anchored: boolean
  onOpenScore: (meal: FuelMeal) => void
  onLogMeal?: (slot: FuelSlot) => void
  onAiLog?: (slot: FuelSlot) => void
  onOpenStack?: () => void
}) {
  const role = slotRole(slot)
  const isDone = slot.state === 'done'
  const isMissed = slot.state === 'missed'
  const isSuggestion = !isDone && !isMissed && !!slot.suggestedRecipeId
  const isBudgetSlot = !slot.mealName && role === 'meal' && !isDone && !!slot.kcal
  const loggable = !anchored && (isSuggestion || isBudgetSlot || isMissed)
  const isActivity = role === 'activity'
  const title = slot.mealName || slot.label
  const durationSuffix = isActivity && slot.duration ? ` · ${slot.duration} perc` : ''

  const avatar = (
    <span className="zf" role="img" aria-label={slot.label} style={{ background: FAV_WASH[slot.kind] ?? FAV_WASH.meal }}>
      {FAV_EMOJI[slot.kind] ?? FAV_EMOJI.meal}
    </span>
  )

  // ── Supplement row: a compact line whose destination is the Stack page (logging lives there) ──
  if (role === 'supplement') {
    const labels = (slot.items ?? []).map(i => i.label).join(' · ')
    return (
      <div className="zrow">
        {avatar}
        <button
          type="button" className="zt" style={{ textAlign: 'left' }}
          aria-label={`${slot.label} · Stack megnyitása`} onClick={() => onOpenStack?.()}
        >
          <div className="a">{slot.label}</div>
          <div className="b"><span>{slot.time}</span>{labels && <span>{labels}</span>}</div>
        </button>
        <span className="zv" aria-hidden="true">🌙</span>
      </div>
    )
  }

  // ── Activity row: the burn lands where it is earned ──
  if (isActivity) {
    return (
      <div className={`zrow act${slot.kind === 'sport' ? ' sport' : ''}`}>
        {avatar}
        <div className="zt">
          <div className="a">{title}{durationSuffix}</div>
          <div className="b"><span>{slot.time}</span></div>
        </div>
        {burnKcal > 0 && (
          <div>
            <div className="bn">+{burnKcal}</div>
            <div className="bl">kcal a célban</div>
          </div>
        )}
      </div>
    )
  }

  // ── Anchored: the hero already renders this window's decision ──
  if (anchored) {
    return (
      <div className="zrow anchor">
        {avatar}
        <div className="zt">
          <div className="a">{slot.label}-ablak · most</div>
          <div className="b"><span>{slot.time}</span><span>a kártya fent ↑</span></div>
        </div>
        {slot.kcal != null && <span className="zv">{slot.kcal}</span>}
      </div>
    )
  }

  return (
    <div className={`zrow${isMissed ? ' missedrow' : ''}`}>
      {avatar}
      <div className="zt">
        <div className="a">
          {title}
          {isMissed && <span className="misstag"> kihagyott</span>}
        </div>
        <div className="b">
          <span>{slot.time}</span>
          {slot.kcal != null && <b>{slot.kcal} kcal</b>}
          {slot.p != null && <span className="mm"><i style={{ background: 'var(--sage)' }} />F {slot.p}</span>}
          {slot.c != null && <span className="mm"><i style={{ background: 'var(--amber)' }} />Sz {slot.c}</span>}
          {slot.f != null && <span className="mm"><i style={{ background: 'var(--lav)' }} />Zs {slot.f}</span>}
          {isSuggestion && <span>ajánlott</span>}
          {slot.windowTip && <span>{slot.windowTip}</span>}
        </div>
        {tagline && !coachPending && (
          <div data-testid="coach-tagline" className="coachline">{tagline}</div>
        )}
        {coachPending && !tagline && <div className="coachline sk" data-testid="coach-skeleton" />}
        {slot.mezoNote && (
          <div className="coachline"><SafeMarkdown text={slot.mezoNote} /></div>
        )}
        {(slot.items?.length ?? 0) > 0 && (
          <div className="col gap-sm mt-md">
            {slot.items?.map((item, i) => <SupplementItemRow key={i} item={item} />)}
          </div>
        )}
      </div>
      <MealScoreChip meal={scoredMeal} coachPending={coachPending} onOpen={onOpenScore} />
      {loggable && (
        <div className="zacts">
          <button
            type="button"
            className={`log${isMissed ? ' pot' : ''}`}
            aria-label={`${title} ${isMissed ? 'pótlása' : 'logolása'}`}
            onClick={() => onLogMeal?.(slot)}
          >
            {isMissed ? 'Pótlás' : 'Logolás'}
          </button>
          {slot.slotKey && onAiLog && (
            <button type="button" className="ai" aria-label={`${slot.label} AI-logolása`} onClick={() => onAiLog(slot)}>
              AI
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

Note on the `aria-label` for the log button: it uses **`title`** (`mealName || label`) exactly like
`SlotCard` did — that is why the ported tests expect `Túrós palacsinta logolása` for a suggestion
row and `Ebéd logolása` for a budget row.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/components/ZoneSlotRow.test.tsx`
Expected: PASS (all ported + new assertions).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/ZoneSlotRow.tsx frontend/src/features/fuel/components/ZoneSlotRow.test.tsx
git commit -m "feat(fuel): ZoneSlotRow — SlotCard behaviour ported to zone density + burn readout + CTA-less anchor (mezo-rrtj)"
```

---

### Task 7: `DayZoneCard`

**Files:**
- Create: `frontend/src/features/fuel/components/DayZoneCard.tsx`
- Test: `frontend/src/features/fuel/components/DayZoneCard.test.tsx`

**Interfaces:**
- Consumes: `DayZone` (Task 1), the `.zcard` CSS (Task 3).
- Produces:
  ```ts
  export function DayZoneCard(props: {
    zone: DayZone
    index: number                                  // drives the --i stagger delay
    children: ReactNode                            // the ZoneSlotRow list, composed by the page
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/DayZoneCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import type { DayZone } from '@/features/fuel/logic/dayZones'
import { DayZoneCard } from '@/features/fuel/components/DayZoneCard'

const zone = (over: Partial<DayZone> = {}): DayZone => ({
  key: 'morning', label: 'Reggel', slots: [], kcal: 790, hasMeals: true,
  state: 'done', burnKcal: 0, stackPips: [], ...over,
})

test('a done zone prints its kcal with a ✓ and the sage header', () => {
  const { container } = render(<DayZoneCard zone={zone()} index={0}><div>row</div></DayZoneCard>)
  expect(screen.getByText('Reggel')).toBeInTheDocument()
  expect(screen.getByText(/790 kcal ✓/)).toBeInTheDocument()
  expect(container.querySelector('.zcard.donez')).toBeInTheDocument()
})

test('the zone holding the now window is marked open', () => {
  const { container } = render(<DayZoneCard zone={zone({ state: 'open', kcal: 900 })} index={1}><div /></DayZoneCard>)
  expect(screen.getByText(/900 kcal nyitva/)).toBeInTheDocument()
  expect(container.querySelector('.zcard.openz')).toBeInTheDocument()
})

test('an upcoming zone prints a plain kcal balance', () => {
  render(<DayZoneCard zone={zone({ state: 'ahead', kcal: 1020 })} index={2}><div /></DayZoneCard>)
  expect(screen.getByText('1020 kcal')).toBeInTheDocument()
})

test('a zone with no eating window prints no kcal at all', () => {
  render(<DayZoneCard zone={zone({ hasMeals: false, kcal: 0, state: 'ahead' })} index={0}><div /></DayZoneCard>)
  expect(screen.queryByText(/kcal/)).toBeNull()
})

test('the burn is appended only when the zone actually earned some', () => {
  render(<DayZoneCard zone={zone({ state: 'ahead', kcal: 300, burnKcal: 510 })} index={0}><div /></DayZoneCard>)
  expect(screen.getByText(/\+510/)).toBeInTheDocument()
})

test('stack pips render one dot per supplement item, filled when taken', () => {
  const { container } = render(
    <DayZoneCard zone={zone({ stackPips: [true, false, false] })} index={0}><div /></DayZoneCard>,
  )
  expect(container.querySelectorAll('.caps i')).toHaveLength(3)
  expect(container.querySelectorAll('.caps i.on')).toHaveLength(1)
})

test('the stagger index rides on a CSS custom property', () => {
  const { container } = render(<DayZoneCard zone={zone()} index={3}><div /></DayZoneCard>)
  expect(container.querySelector('.zcard')).toHaveAttribute('style', expect.stringContaining('--i: 3'))
})

test('renders the composed rows', () => {
  render(<DayZoneCard zone={zone()} index={0}><div data-testid="child-row" /></DayZoneCard>)
  expect(screen.getByTestId('child-row')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- src/features/fuel/components/DayZoneCard.test.tsx`
Expected: FAIL — component cannot be resolved.

- [ ] **Step 3: Write `DayZoneCard.tsx`**

```tsx
import type { ReactNode } from 'react'
import type { DayZone } from '@/features/fuel/logic/dayZones'

// A napszak zone (mezo-rrtj). The header carries the zone's own kcal + burn balance, which is what
// turns "where did my 3010 kcal go" from a mental sum into something readable. Rows are composed by
// the page (children) so this component stays free of the page's five callbacks.
export function DayZoneCard({
  zone,
  index,
  children,
}: {
  zone: DayZone
  index: number
  children: ReactNode
}) {
  const stateCls = zone.state === 'done' ? ' donez' : zone.state === 'open' ? ' openz' : ''
  const kcalSuffix = zone.state === 'done' ? ' ✓' : zone.state === 'open' ? ' nyitva' : ''
  return (
    <div className={`zcard${stateCls}`} style={{ ['--i' as string]: index }}>
      <div className="zh">
        <span className="zn">{zone.label}</span>
        {zone.stackPips.length > 0 && (
          <span className="caps" aria-hidden="true">
            {zone.stackPips.map((on, i) => <i key={i} className={on ? 'on' : undefined} />)}
          </span>
        )}
        {(zone.hasMeals || zone.burnKcal > 0) && (
          <span className="zk">
            {zone.hasMeals && `${zone.kcal} kcal${kcalSuffix}`}
            {zone.hasMeals && zone.burnKcal > 0 && ' · '}
            {zone.burnKcal > 0 && <span className="burn">+{zone.burnKcal}</span>}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- src/features/fuel/components/DayZoneCard.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/DayZoneCard.tsx frontend/src/features/fuel/components/DayZoneCard.test.tsx
git commit -m "feat(fuel): DayZoneCard — napszak header with its own kcal/burn balance + stack pips (mezo-rrtj)"
```

---

### Task 8: Recompose `FuelMaiPage`, retire the old chain

**Files:**
- Rewrite: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Rewrite: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.logMeal.test.tsx` (adapt queries)
- Delete: `frontend/src/features/fuel/components/PacingCard.tsx`
- Delete: `frontend/src/features/fuel/components/FuelTimeline.tsx`, `FuelTimeline.test.tsx`
- Delete: `frontend/src/features/fuel/components/SlotCard.tsx`, `SlotCard.test.tsx`
- Delete: `frontend/src/features/fuel/components/KcalGauge.tsx`, `KcalGauge.test.tsx`

**Interfaces:**
- Consumes everything produced by Tasks 1–7, plus the unchanged hooks/sheets already imported by the
  page (`useFuelDay`, `useFuelTimeline`, `useMealCoach`, `useProtocol`, `useReplanScenarios`,
  `useTodayScenario`, `useWaterActions`, `MealScoreSheet`, `ReplanSheet`, `LogMealSheet`,
  `AiLogSheet`, `FuelSettingsSheet`, `EnergyBreakdownSheet`).
- Produces: nothing (leaf page).

- [ ] **Step 1: Verify nothing else consumes the four doomed components**

Run:
```bash
cd frontend && grep -rn "PacingCard\|FuelTimeline\b\|SlotCard\|KcalGauge" src/ --include="*.tsx" --include="*.ts" | grep -v "src/features/fuel/components/" | grep -v "src/features/fuel/pages/FuelMaiPage"
```
Expected: **no output** (Today's preview is its own `FuelTimelinePreview`). If anything else appears,
STOP and report — the deletion set is wrong.

- [ ] **Step 2: Rewrite the page**

Replace `frontend/src/features/fuel/pages/FuelMaiPage.tsx` with:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FuelMeal, FuelSlot, MealSlot } from '@/data/types'
import {
  useFuelDay, useFuelTimeline, useMealCoach, useProtocol, useReplanScenarios, useTodayScenario, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { buildDayZones, isMealSlot } from '@/features/fuel/logic/dayZones'
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import { NowWindowCard } from '@/features/fuel/components/NowWindowCard'
import { MissedStrip } from '@/features/fuel/components/MissedStrip'
import { DayBudgetCard } from '@/features/fuel/components/DayBudgetCard'
import { DayZoneCard } from '@/features/fuel/components/DayZoneCard'
import { ZoneSlotRow } from '@/features/fuel/components/ZoneSlotRow'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { Icon } from '@/shared/ui/Icon'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { ReplanSheet } from '@/features/fuel/sheets/ReplanSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'
import { EnergyBreakdownSheet, type EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { localDateString } from '@/shared/lib/dates'

// Guided recomposition (spec 2026-07-28, mezo-rrtj): one-line header + Reta micro-strip → the
// NowWindowCard hero (the day's single open decision) → MissedStrip → DayBudgetCard (remaining kcal,
// "honnan a napi cél" chips, named macro rows incl. water) → napszak DayZoneCards → protocol footer.
// Retired here: the "Mai cél" card + KcalGauge (they printed the SAME number twice), the static-seed
// PacingCard prose and the static-seed weekly micronutrients, and the flat FuelTimeline/SlotCard
// chain (its behaviour lives in ZoneSlotRow). Nothing that had a real source was dropped.
const RETA_PHASE_CLS = ['pk', 'pk', 'pk', 'stb', 'stb', 'tr', 'tr'] as const

export function FuelMaiPage() {
  const navigate = useNavigate()
  const { fuel } = useFuelDay()
  const { plan, budget, blocks, weightKg, energyBreakdown, wake, bed, nowHHmm, getScoredMeal } = useFuelTimeline()
  // Coach verdicts ride a SEPARATE request so the deterministic day never waits on an LLM
  // roundtrip; `isPending` is what makes that expensive call visible (mezo-rrtj).
  const { verdicts, isPending: coachPending } = useMealCoach(localDateString())
  const { protocol } = useProtocol()
  const { retaDay } = useTodayScenario()
  const { logWater } = useWaterActions()
  // Honest-empty in real mode (replan engine is P8) — no scenarios, no Replan CTA (mezo-t16y.4).
  const { scenarios: replanScenarios } = useReplanScenarios()

  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)

  const zones = buildDayZones({ slots: plan.slots, wake, bed, blocks, weightKg })
  const { hero, missed } = pickHeroWindow({
    slots: plan.slots, blocks, budget, consumed: { kcal: fuel.consumed.kcal, p: fuel.consumed.p },
  })
  const windows = plan.slots.filter(isMealSlot)
  const doneWindows = windows.filter(s => s.state === 'done')
  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — hide them.
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const daySpan = Math.max(1, (toMin(bed) <= toMin(wake) ? toMin(bed) + 1440 : toMin(bed)) - toMin(wake))
  const nowFrac = Math.min(1, Math.max(0, (toMin(nowHHmm) - toMin(wake)) / daySpan))

  const getTagline = (slot: FuelSlot) => {
    const meal = getScoredMeal(slot)
    return meal ? (verdicts[meal.id]?.tagline ?? null) : null
  }

  const openLog = (prefill: LogMealPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  const handleLogMeal = (slot: FuelSlot) => {
    if (slot.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId })
    else openLog(null, slot.slotKey ?? 'snack')
  }
  const handleLogOther = (slot: FuelSlot) => openLog(null, slot.slotKey ?? 'snack')
  const handleAiLog = (slot: FuelSlot) => {
    setAiSlot(slot.slotKey)
    setAiOpen(true)
  }

  return (
    <>
      {/* Header — one row; the Reta phase is the link to the medication page */}
      <div className="pghead-np sage">
        <div>
          <button
            type="button"
            className="over"
            aria-label="Reta ciklus megnyitása"
            onClick={() => navigate('/fuel/gyogyszer')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            Fuel · Reta D{retaDay} ›
          </button>
          <h1>A mai nap</h1>
        </div>
        <div className="row gap-xs" style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { setAiSlot(undefined); setAiOpen(true) }}
            className="pgact-np np-press"
            aria-label="AI naplózás"
            style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
          >
            <Icon name="sparkle" size={12} /> AI
          </button>
          <button
            type="button"
            onClick={() => openLog()}
            className="pgact-np np-press"
            aria-label="Logolás"
            style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
          >
            <Icon name="plus" size={12} /> Log
          </button>
        </div>
      </div>

      <div className="retamicro" role="img" aria-label={`Reta ciklus — ${retaDay}. nap`}>
        {RETA_PHASE_CLS.map((cls, i) => (
          <i key={i} className={`${cls}${i + 1 === retaDay ? ' cur' : ''}`} />
        ))}
      </div>

      <NowWindowCard
        hero={hero}
        onLogMeal={handleLogMeal}
        onAiLog={handleAiLog}
        onLogOther={handleLogOther}
        onLogEmpty={() => openLog()}
      />

      <MissedStrip slots={missed} onLogMeal={handleLogMeal} />

      <DayBudgetCard
        consumed={fuel.consumed}
        budget={budget}
        waterTarget={fuel.targets.water}
        energy={plan.energy}
        staticEnergy={staticEnergy}
        loggedKcals={doneWindows.map(s => s.kcal ?? 0)}
        doneCount={doneWindows.length}
        totalCount={windows.length}
        nowFrac={hero.kind === 'open' ? nowFrac : null}
        onOpenEnergy={(section) => energyBreakdown && setEnergyOpen(section)}
        onLogWater={logWater}
      />

      {zones.map((zone, zi) => (
        <DayZoneCard key={zone.key} zone={zone} index={zi}>
          {zone.slots.map((slot, si) => (
            <ZoneSlotRow
              key={`${zone.key}-${si}`}
              slot={slot}
              scoredMeal={getScoredMeal(slot)}
              tagline={getTagline(slot)}
              coachPending={coachPending}
              burnKcal={zone.burnKcal}
              anchored={hero.kind === 'open' && slot === hero.slot}
              onOpenScore={setScoreMeal}
              onLogMeal={handleLogMeal}
              onAiLog={handleAiLog}
              onOpenStack={() => navigate('/fuel/stack')}
            />
          ))}
        </DayZoneCard>
      ))}

      {/* Kitchen close / caffeine cutoff — reference data, at the end of the day it belongs to */}
      <div className="zrow" style={{ margin: '0 24px 9px', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--np-shadow-row)' }}>
        <span className="zf" role="img" aria-label="Konyha" style={{ background: 'var(--warm)' }}>🍽</span>
        <div className="zt">
          <div className="a">Konyha zár · {plan.kitchenClose}</div>
          <div className="b"><span>kávé cutoff {plan.caffeineCutoff}</span></div>
        </div>
        <button
          type="button" className="chip" aria-label="Fuel beállítások"
          onClick={() => setSettingsOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}
        >
          szerkeszt
        </button>
      </div>

      {/* Protocol meta — hidden when there is no active protocol yet (real-mode ghost, v0) */}
      {protocol.version > 0 && (
        <div className="zrow" style={{ margin: '0 24px 16px', background: 'var(--warm)', borderRadius: 20 }}>
          <Icon name="sparkle" size={11} color="var(--sage-deep)" />
          <div className="zt">
            <div className="a" style={{ fontSize: 11, color: 'var(--sage-deep)' }}>
              Stack · v{protocol.version} · {protocol.builtAt}
            </div>
            <div className="b">
              <span>
                {protocol.lastReplanReason
                  ? '↳ ' + protocol.lastReplanReason
                  : protocol.itemCount + ' item · conf ' + (protocol.confidence * 100).toFixed(0) + '%'}
              </span>
            </div>
          </div>
          {replanScenarios.length > 0 && (
            <button
              type="button" onClick={() => setReplanOpen(true)} className="chx"
              style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
            >
              <Icon name="tool" size={10} /> Replan
            </button>
          )}
        </div>
      )}

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
      {replanOpen && <ReplanSheet onClose={() => setReplanOpen(false)} />}
      {logOpen && <LogMealSheet prefill={logPrefill} initialSlot={logInitialSlot} onClose={() => setLogOpen(false)} />}
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
      {energyOpen && energyBreakdown && (
        <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
      )}
      {aiOpen && (
        <AiLogSheet
          date={localDateString()}
          initialSlot={aiSlot}
          onClose={() => setAiOpen(false)}
          onManualFallback={() => { setAiOpen(false); openLog() }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Rewrite `FuelMaiPage.test.tsx`**

Keep the file's existing header verbatim (lines 1–44: the hoisted `useFuelTimeline` override, the
`VITE_USE_MOCK` stub, `renderView`). Replace the test bodies with:

```tsx
test('renders the one-line header, the hero, the day-status card and the zones', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: 'A mai nap' })).toBeInTheDocument()
  expect(container.querySelector('.retamicro')).toBeInTheDocument()
  // Hero — the mock day (fixed now 13:30) has an open window.
  expect(container.querySelector('.nowcard')).toBeInTheDocument()
  // Day status — remaining kcal + the four named macro rows (water is the 4th).
  expect(container.querySelector('.daystrip')).toBeInTheDocument()
  expect(container.querySelectorAll('.mac')).toHaveLength(4)
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('Szénhidrát')).toBeInTheDocument()
  expect(screen.getByText('Zsír')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()
  // Zones replace the flat timeline.
  expect(container.querySelectorAll('.zcard').length).toBeGreaterThan(1)
  // Kitchen close / coffee cutoff kept their real data, now at the end of the day.
  expect(screen.getByText(/Konyha zár/)).toBeInTheDocument()
  expect(screen.getByText(/kávé cutoff/)).toBeInTheDocument()
})

test('the two static-seed surfaces are gone — no fabricated prose, no fake weekly micros', () => {
  renderView()
  expect(screen.queryByText('Mikrotápanyagok · heti')).toBeNull()
  expect(screen.queryByText(/tegnapi átlag ebben az időben/)).toBeNull()
})

test('the daily target is stated ONCE, and as the remaining kcal', () => {
  const { container } = renderView()
  expect(container.querySelector('.gauge')).toBeNull()
  expect(screen.queryByText(/Mai cél/)).toBeNull()
  expect(screen.getByText(/kcal hátra/)).toBeInTheDocument()
})

test('the energy breakdown chips explain where the target comes from', async () => {
  renderView()
  expect(screen.getByText(/honnan a/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mozgás/ }))
  expect(screen.getByText(/Honnan jön/)).toBeInTheDocument()
})

// Carried over verbatim from the current file — the chip moved into the kitchen-close row but its
// aria-label and the sheet it opens are unchanged.
test('opens the FuelSettingsSheet from the szerkeszt chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel beállítások' }))
  expect(await screen.findByRole('dialog', { name: 'Fuel beállítások' })).toBeInTheDocument()
})

test('the hero primary CTA is slot-scoped and does not collide with the header log chip', async () => {
  renderView()
  // The header chip keeps the bare `Logolás` label; the hero uses `{label} logolása`.
  expect(screen.getByRole('button', { name: 'Logolás' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /\wlogolása$/ }).length).toBeGreaterThan(0)
})

test('opens the LogMealSheet from the ＋ Log entry', async () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Logolás' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('logs water via the +250/+500 quick-add on the water macro row', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  await waitFor(() => expect(screen.getByText(/\/ 4000 ml/)).toBeInTheDocument())
})
```

Then **carry over unchanged** (adapting only queries that referenced deleted markup) these existing
tests from the current file: the protocol-meta v3 row, the protocol-meta v0 hiding, the real-mode
Replan suppression, the score-sheet open/close, the slot-level AI chip (`hoisted.injectOpenSlot`),
and the real-mode schedule-derived workout label. Read the current file before rewriting so none of
them is silently dropped.

- [ ] **Step 4: Adapt `FuelMaiPage.logMeal.test.tsx`**

Read it first; it drives the planner tap-to-log path. Its slot-level queries
(`{name} logolása` / `{label} AI-logolása`) still hold because `ZoneSlotRow` kept those labels.
Only update assertions that referenced `.slot`/`FuelTimeline` markup to `.zrow`/`.zcard`.

- [ ] **Step 5: Delete the retired components**

```bash
cd frontend && git rm src/features/fuel/components/PacingCard.tsx \
  src/features/fuel/components/FuelTimeline.tsx src/features/fuel/components/FuelTimeline.test.tsx \
  src/features/fuel/components/SlotCard.tsx src/features/fuel/components/SlotCard.test.tsx \
  src/features/fuel/components/KcalGauge.tsx src/features/fuel/components/KcalGauge.test.tsx
```

- [ ] **Step 6: Run the page tests, then the whole suite in both modes**

Run: `cd frontend && pnpm test -- src/features/fuel/pages/FuelMaiPage.test.tsx src/features/fuel/pages/FuelMaiPage.logMeal.test.tsx`
Expected: PASS.
Then: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, both modes green. Fix any fallout in the failing file — do not weaken an
assertion to make it pass.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "feat(fuel): recompose Mai into hero + day-status + napszak zones; retire the flat timeline (mezo-rrtj)"
```

---

### Task 9: Documentation + final gate

**Files:**
- Modify: `docs/features/fuel.md` (the `"Mai"` paragraph in §2 — overwrite in place; also check §9)
- Modify: `docs/features/_platform-design-system.md` (§1a — register the new CSS families)
- Modify: `docs/milestones/roadmap.md` **only if** it references the Mai layout

- [ ] **Step 1: Rewrite the `"Mai"` paragraph in `docs/features/fuel.md` §2**

Living-doc policy: **overwrite in place, no changelog, no dated snapshot** — git is the history.
The new paragraph must state: the one-line header (Reta phase → `/fuel/gyogyszer`) + `.retamicro`;
`NowWindowCard` (3 hero states, derived why-line, slot-scoped aria-labels); `MissedStrip`;
`DayBudgetCard` (remaining kcal + segmented bar + `honnan a napi cél` chips → the unchanged
`EnergyBreakdownSheet` + four macro rows with water quick-add); `DayZoneCard`/`ZoneSlotRow`
(wake→bed fraction zones, per-zone kcal/burn, supplement rows → Stack, activity rows print their
MET burn, the CTA-less anchor row); `MealScoreChip` (score scale + coach-pending twinkle) and the
coach skeleton; and explicitly that the `KcalGauge`, `PacingCard`, `FuelTimeline`, `SlotCard` mounts
and the weekly micronutrient block are **gone**, with the two static-seed surfaces removed on
purpose (`FuelDay.pacing`/`.micronutrients` remain in the data layer, unconsumed). Reference the
spec + mockup paths.

- [ ] **Step 2: Register the CSS families in `_platform-design-system.md` §1a**

Add the new families next to the existing Napív entries: `.nowcard`, `.missedstrip`, `.daystrip`
(+`.seg`/`.brk`/`.ebchip`), `.zcard`/`.zrow`, `.aiscore`, `.coachline`, `.retamicro` — one line each,
naming the owning component and the page.

- [ ] **Step 3: Run the doc lint**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo && node scripts/lint-docs.mjs`
Expected: clean, and `fuel.md` must not be flagged stale (its `key_files` git-drift clears because
the doc was touched in the same change).

- [ ] **Step 4: Final full gate**

Run:
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green in both modes.

- [ ] **Step 5: Commit**

```bash
git add docs/features/fuel.md docs/features/_platform-design-system.md
git commit -m "docs(fuel): Mai guided recomposition — feature doc + design-system CSS families (mezo-rrtj)"
```

---

## Self-Review

**Spec coverage:** §2 D1→Tasks 4–8 · D2→Task 8 Step 5 + Task 9 · D3→Task 5 (bar) + Task 8 (gauge
deletion) · D4→Task 1 · D5→Task 2 + Task 4 · D6→Task 4 · D7→Task 5 · D8→Task 6 (`onOpenStack`) ·
D9→Task 8 (render removal only) · D10→Task 8 (protocol footer). §3 layout→Task 8. §3 zone
derivation→Task 1. §3 hero selection→Task 2. §4 AI visibility→Tasks 3 + 6. §5 motion→Task 3 CSS.
§6 file map→Tasks 1–9. §7 tests→every task's test step, aria-label contract in Global Constraints.
§8 follow-ups→filed as bd issues after the merge (not code).

**Deviations from the spec, deliberate:** the spec's `1 850 / 4 000 ml` typographic spacing is
implemented as raw digits (`1850 / 4000 ml`) to match the page's existing number rendering and to
keep test queries free of non-breaking-space traps. The mockup's `⟳ Másik javaslat` and the
closed-day `Napi zárás ›` are **not** implemented — neither has a real destination, and shipping a
dead affordance would contradict the spec's own honesty rule; the hero's foot link is
`Más ételt logolok` instead, which resolves to a real `LogMealSheet` open.

**Type consistency:** `DayZone`, `ZoneKey`, `ZoneState`, `SlotRole`, `slotRole`, `isMealSlot`,
`buildDayZones` (Task 1) are used with identical names in Tasks 2, 6, 7, 8. `HeroWindow`/`HeroOpen`/
`HeroClosed`/`HeroResult`/`pickHeroWindow` (Task 2) match Tasks 4 and 8. `MealScoreChip`'s
`{meal, coachPending, onOpen}` matches its Task 6 call site. `DayBudgetCard`'s prop names match the
Task 8 call site one-for-one. `EnergySection` values `'base' | 'movement' | 'deficit'` match the
existing sheet's contract (`FuelMaiPage.tsx:119-121` today).
