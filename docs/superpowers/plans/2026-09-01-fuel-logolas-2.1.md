# Fuel · Logolás 2.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Logolás 2.1 prototype on `/fuel/log`: the hub's KeretHero as the page hero, bigger macro rings with fiber, an AI-score pill + kcal row with a Standard / Pre / Post context chip on done cards, and the redesigned MealScoreSheet breakdown (ledger, collapsible dimension cards, gain cards, no tools list).

**Architecture:** Pure view-model additions in `features/fuel/logic/` (`scoreTone`, `mealContext`, `formatImpact`, `asPastDayHero`, widened `TileRingVM`), presentational changes in `features/fuel/components/` + `sheets/`, hooks only in `pages/FuelLogPage.tsx`. All visuals via existing `prototype.css` token families (`.khero`, `.flog-*`, `.fh-*`, `.mz-cell-*`), CSS-only animation with reduced-motion kills.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom), pnpm 9, `prototype.css` design tokens. Spec: `docs/superpowers/specs/2026-09-01-fuel-logolas-2.1-design.md`. Prototype: `docs/design_2.0/prototypes/fuel-logolas-2.1.html`.

## Global Constraints

- bd issue **mezo-zeeq**; every commit subject carries `(mezo-zeeq)`.
- Frontend tests run from `frontend/`: `pnpm vitest run <path>`; both modes before PR: `VITE_USE_MOCK=true pnpm vitest run` and `VITE_USE_MOCK=false pnpm vitest run`; then `pnpm build`.
- Honest states: never fabricate a number — no fiber ring without `fiberG`, no context chip without a breakdown, `✨ folyamatban` for unscored.
- Hooks are imported from `@/data/hooks` only, deep `@/` imports, no barrels. Pure logic in `logic/` has no React and no `@/data/*` hook import.
- Tone thresholds: `jó` ≥ 80, `közepes` ≥ 60, else `gyenge` (existing `MealScoreChip` rule).
- Context labels: `Standard` / `Pre-workout` / `Post-workout`; derived ONLY from the breakdown `context` dimension's `Szerep` row (prefix `Pre-workout` / `Post-workout`).
- Animation: `2.6s ease-in-out infinite` CSS keyframes, `animation: none` under `@media (prefers-reduced-motion: reduce)`, `:active` stops it.
- New files under `features/fuel/{logic,components}` → regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) and update `docs/features/fuel.md` §2 + §10 in the same change.
- The fiber target is `FIBER_TARGET_G` from `@/data/fuel/fuelConfig`; fiber colour `var(--macro-fiber)`.

---

## File map

| File | Responsibility |
|---|---|
| `frontend/src/features/fuel/logic/scoreTone.ts` (new) | `toneOf(pct)` → `{cls, word}` shared by the pill, `MealScoreChip`, `ScoreHero` |
| `frontend/src/features/fuel/logic/mealContext.ts` (new) | `mealContextOf(meal)` → `'standard'\|'pre'\|'post'\|null`, `MEAL_CONTEXT_LABEL` |
| `frontend/src/features/fuel/logic/formatImpact.ts` (new) | `formatImpact('+0.04 score')` → `'+4 pont'` |
| `frontend/src/features/fuel/logic/keretHero.ts` | `asPastDayHero(vm)` |
| `frontend/src/features/fuel/logic/fuelSwimlane.ts` | `TileRingVM.key` incl. `'r'`, fiber ring on done tiles, `WindowTileVM.context` |
| `frontend/src/features/fuel/components/KeretHero.tsx` | optional `ofLine` prop |
| `frontend/src/features/fuel/components/WindowBlock.tsx` | done card anatomy: ctx chip, `.flog-srow` (pill + kcal), 44px SVG rings |
| `frontend/src/features/fuel/components/ScoreLedger.tsx` (new) | contribution bar |
| `frontend/src/features/fuel/components/DimensionCard.tsx` | collapsible header |
| `frontend/src/features/fuel/components/ScoreBreakdownBody.tsx` | ledger + gain cards, tools removed |
| `frontend/src/features/fuel/components/ScoreHero.tsx` | 112px ring hero with tone word + facts |
| `frontend/src/features/fuel/sheets/MealScoreSheet.tsx` | header ctx chip, new eyebrow |
| `frontend/src/features/fuel/pages/FuelLogPage.tsx` | KeretHero hero + Energy/Water sheets |
| `frontend/src/styles/prototype.css` | `.fh-aisc`, `.fh-ctx`, `.flog-srow`, `.fh-wring` (SVG), `.sb-*` breakdown family |
| `frontend/src/data/fuel/fuel.ts` | mock m2 context gets a `Szerep` row |

---

### Task 1: `scoreTone` — one tone rule for every score surface

**Files:**
- Create: `frontend/src/features/fuel/logic/scoreTone.ts`
- Create: `frontend/src/features/fuel/logic/scoreTone.test.ts`
- Modify: `frontend/src/features/fuel/components/MealScoreChip.tsx:9-15`

**Interfaces:**
- Produces: `export type ScoreTone = 'hi' | 'md' | 'lo'`; `export function toneOf(pct: number): { tone: ScoreTone; cls: 's-hi'|'s-md'|'s-lo'; word: 'jó'|'közepes'|'gyenge' }`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/fuel/logic/scoreTone.test.ts
import { test, expect } from 'vitest'
import { toneOf } from '@/features/fuel/logic/scoreTone'

test('80+ is jó, 60–79 közepes, below 60 gyenge — the MealScoreChip thresholds', () => {
  expect(toneOf(80)).toEqual({ tone: 'hi', cls: 's-hi', word: 'jó' })
  expect(toneOf(79)).toEqual({ tone: 'md', cls: 's-md', word: 'közepes' })
  expect(toneOf(60)).toEqual({ tone: 'md', cls: 's-md', word: 'közepes' })
  expect(toneOf(59)).toEqual({ tone: 'lo', cls: 's-lo', word: 'gyenge' })
})
```

- [ ] **Step 2: Run it to verify it fails** — `cd frontend && pnpm vitest run src/features/fuel/logic/scoreTone.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/fuel/logic/scoreTone.ts
// AI-score tone ladder (mezo-zeeq) — ONE rule for the block pill, MealScoreChip and the
// score-sheet hero, so a "közepes" on the card is never a "jó" in the sheet.
export type ScoreTone = 'hi' | 'md' | 'lo'
export interface ScoreToneVM { tone: ScoreTone; cls: 's-hi' | 's-md' | 's-lo'; word: 'jó' | 'közepes' | 'gyenge' }

export function toneOf(pct: number): ScoreToneVM {
  if (pct >= 80) return { tone: 'hi', cls: 's-hi', word: 'jó' }
  if (pct >= 60) return { tone: 'md', cls: 's-md', word: 'közepes' }
  return { tone: 'lo', cls: 's-lo', word: 'gyenge' }
}
```

In `MealScoreChip.tsx` delete the local `Tone`/`toneOf` and `import { toneOf } from '@/features/fuel/logic/scoreTone'`; the JSX keeps `tone.cls` / `tone.word`.

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/logic/scoreTone.test.ts src/features/fuel/components/MealScoreChip.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(fuel): scoreTone — shared AI-score tone ladder (mezo-zeeq)`

---

### Task 2: `mealContext` — Standard / Pre / Post from the `Szerep` row

**Files:**
- Create: `frontend/src/features/fuel/logic/mealContext.ts`, `mealContext.test.ts`
- Modify: `frontend/src/data/fuel/fuel.ts:236-250` (m2 context rows)

**Interfaces:**
- Produces: `export type MealContext = 'standard' | 'pre' | 'post'`; `export function mealContextOf(meal: Pick<FuelMeal, 'breakdown'>): MealContext | null`; `export const MEAL_CONTEXT_LABEL: Record<MealContext, string> = { standard: 'Standard', pre: 'Pre-workout', post: 'Post-workout' }`

- [ ] **Step 1: Failing test**

```ts
// frontend/src/features/fuel/logic/mealContext.test.ts
import { test, expect } from 'vitest'
import type { MealBreakdown, ContextDimension } from '@/data/types'
import { mealContextOf, MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'

const ctx = (rows: { label: string; value: string }[]): MealBreakdown => ({
  confidence: 0.8, summary: null, tagline: null, improve: [], tools: [],
  dimensions: [{ id: 'context', label: 'Időzítés', weight: 0.2, score: 0.5, color: 'x', detail: '', context: rows } as ContextDimension],
})

test('no breakdown → null (unscored meal carries no chip)', () => {
  expect(mealContextOf({ breakdown: undefined })).toBeNull()
})
test('scored without a Szerep row → standard', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Időzítés', value: '13:30 · Ebéd ablakban' }]) })).toBe('standard')
})
test('Szerep prefix Pre-workout → pre, Post-workout → post (server label may grow a suffix)', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Pre-workout üzemanyag-ablak' }]) })).toBe('pre')
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Post-workout regeneráció' }]) })).toBe('post')
})
test('an unknown Szerep value falls back to standard', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Általános' }]) })).toBe('standard')
})
test('labels', () => {
  expect(MEAL_CONTEXT_LABEL).toEqual({ standard: 'Standard', pre: 'Pre-workout', post: 'Post-workout' })
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// frontend/src/features/fuel/logic/mealContext.ts
// Meal role as the SERVER scored it (mezo-zeeq). The backend classifies pre/post/standard at
// write time (MealScoringService.classifyRole) but neither persists nor sends the enum — the
// only wire trace is the context dimension's `Szerep` row, emitted for non-standard roles.
// Reading it back (rather than re-deriving on the FE from plan.workout) keeps the card chip
// and the sheet's own context dimension telling the same story. Unscored → null (no chip).
import type { FuelMeal } from '@/data/types'

export type MealContext = 'standard' | 'pre' | 'post'
export const MEAL_CONTEXT_LABEL: Record<MealContext, string> = { standard: 'Standard', pre: 'Pre-workout', post: 'Post-workout' }

export function mealContextOf(meal: Pick<FuelMeal, 'breakdown'>): MealContext | null {
  const b = meal.breakdown
  if (!b) return null
  const dim = b.dimensions.find(d => d.id === 'context')
  const row = dim && 'context' in dim ? dim.context.find(r => r.label === 'Szerep') : undefined
  const v = row?.value ?? ''
  if (v.startsWith('Pre-workout')) return 'pre'
  if (v.startsWith('Post-workout')) return 'post'
  return 'standard'
}
```

Mock seed: in `fuel.ts` m2's context rows prepend `{ label: 'Szerep', value: 'Pre-workout üzemanyag-ablak' },` (the meal is already narrated as pre-workout T-3.5h).

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/logic/mealContext.test.ts src/features/fuel` → PASS (existing suites unaffected by the added row).
- [ ] **Step 5: Commit** `feat(fuel): mealContext — Standard/Pre/Post from the scored Szerep row (mezo-zeeq)`

---

### Task 3: `formatImpact`

**Files:** Create `frontend/src/features/fuel/logic/formatImpact.ts`, `formatImpact.test.ts`

**Interfaces:** `export function formatImpact(impact: string): string`

- [ ] **Step 1: Failing test**

```ts
import { test, expect } from 'vitest'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
test('"+0.04 score" → "+4 pont", "−0.02 score" → "−2 pont", "-0.1 score" → "−10 pont"', () => {
  expect(formatImpact('+0.04 score')).toBe('+4 pont')
  expect(formatImpact('−0.02 score')).toBe('−2 pont')
  expect(formatImpact('-0.1 score')).toBe('−10 pont')
})
test('free text is passed through untouched', () => {
  expect(formatImpact('Mg-status 32% → 48%')).toBe('Mg-status 32% → 48%')
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// frontend/src/features/fuel/logic/formatImpact.ts
// "Lehetne jobb" gain box (mezo-zeeq): the wire's `impact` is free text; the scorer's own
// "+0.04 score" shape becomes "+4 pont" (×100, rounded, Unicode minus), anything else is
// shown verbatim — never a fabricated number.
const SCORE_RE = /^([+\-−])?\s*(\d+(?:[.,]\d+)?)\s*score$/i
export function formatImpact(impact: string): string {
  const m = SCORE_RE.exec(impact.trim())
  if (!m) return impact
  const sign = m[1] === '-' || m[1] === '−' ? '−' : '+'
  const pts = Math.round(parseFloat(m[2].replace(',', '.')) * 100)
  return `${sign}${pts} pont`
}
```

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** `feat(fuel): formatImpact — score gain as pont (mezo-zeeq)`

---

### Task 4: KeretHero on a past day + the of-line prop

**Files:**
- Modify: `frontend/src/features/fuel/logic/keretHero.ts` (append), `keretHero.test.ts` (append)
- Modify: `frontend/src/features/fuel/components/KeretHero.tsx:112-140`, `KeretHero.test.tsx` (append)

**Interfaces:**
- Produces: `export function asPastDayHero(vm: KeretHeroVM): KeretHeroVM` (chips → null, nowFrac → null, rest identical); `KeretHero` prop `ofLine?: string` rendered as `<div className="khero-of">{ofLine}</div>` right under `.khero-n`.

- [ ] **Step 1: Failing tests**

```ts
// keretHero.test.ts (append)
test('asPastDayHero: chips + now-marker go, everything else stays (energy/clock are TODAY\'s)', () => {
  const vm = buildKeretHero({ budget, staticEnergy: false, consumed: { kcal: 900, p: 60, c: 100, f: 30 }, meals: [],
    water: { currentMl: 500, targetMl: 2500 }, slots: [slot({ time: '08:00', state: 'done' }), slot({ time: '13:00', state: 'now' }), slot({ time: '19:00', state: 'pending' })], nowHHmm: '13:30' })
  expect(vm.chips).not.toBeNull(); expect(vm.nowFrac).not.toBeNull()
  const past = asPastDayHero(vm)
  expect(past.chips).toBeNull(); expect(past.nowFrac).toBeNull()
  expect({ ...past, chips: vm.chips, nowFrac: vm.nowFrac }).toEqual(vm)
})
```
(use the file's existing `budget`/`slot` helpers; if the file has none, build `budget` as `{ kcal: 2400, p: 180, c: 240, f: 72, energy: { base: 2400, activity: 300, balance: -300, target: 2400 } }` and `slot` as a `FuelSlot` factory with `kind: 'meal', label: 'X', slotKey: 'lunch'`.)

```tsx
// KeretHero.test.tsx (append)
describe('KeretHero — ofLine (log page)', () => {
  it('renders the of-line only when given', () => {
    stubReduced()
    const { container, rerender } = render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} ofLine="4/6 ablak kész · 1 081 kcal még belefér" />)
    expect(container.querySelector('.khero-of')).toHaveTextContent('4/6 ablak kész · 1 081 kcal még belefér')
    rerender(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(container.querySelector('.khero-of')).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// keretHero.ts (append)
/** Past-day normalisation (mezo-zeeq, the asPastDayLane shape): useFuelTimeline's energy chips
 *  and the wall-clock now-marker describe TODAY even when `date` is in the past — a past-day
 *  hero drops both instead of showing today's Alap/Mozgás/Cél under yesterday's meals. Consumed
 *  kcal, segments, rings and water read the date's own data and stay. */
export function asPastDayHero(vm: KeretHeroVM): KeretHeroVM {
  return { ...vm, chips: null, nowFrac: null }
}
```

```tsx
// KeretHero.tsx — props + render
export function KeretHero({ vm, onChip, onWaterRing, durationMs = 2000, ofLine }: {
  vm: KeretHeroVM; onChip: (section: EnergySection) => void; onWaterRing: () => void; durationMs?: number
  /** Optional line under the number (the /fuel/log page's "n/m ablak kész · x kcal még belefér");
   *  the hub passes nothing and keeps its v3 declutter. */
  ofLine?: string
}) {
  …
      <div className="khero-n" …>…</div>
      {ofLine && <div className="khero-of">{ofLine}</div>}
      <div className="khero-dayseg">
```

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/logic/keretHero.test.ts src/features/fuel/components/KeretHero.test.tsx` → PASS (the hub's "renders NO of-line" test still passes: no prop, no line).
- [ ] **Step 5: Commit** `feat(fuel): KeretHero ofLine prop + asPastDayHero (mezo-zeeq)`

---

### Task 5: Tile VM — fiber ring on done tiles, `context`

**Files:**
- Modify: `frontend/src/features/fuel/logic/fuelSwimlane.ts:39-48, 128-160`; header comment lines 15-16
- Modify: `frontend/src/features/fuel/logic/fuelSwimlane.test.ts:79-101` (+ new tests)

**Interfaces:**
- `TileRingVM.key: 'p' | 'c' | 'f' | 'r'`; done tile with `meal.fiberG != null` gets a 4th ring `ringOf('r', 'R', 'Rost', meal.fiberG, FIBER_TARGET_G, 'var(--macro-fiber)')`; `WindowTileVM.context: MealContext | null` (`mealContextOf(meal)` on done tiles, null otherwise).

- [ ] **Step 1: Failing tests** (append; keep the existing 3-ring test as-is — planned tiles still have 3)

```ts
import { FIBER_TARGET_G } from '@/data/fuel/fuelConfig'
import type { ContextDimension } from '@/data/types'

test('a done window with fiberG gets a 4th Rost ring against FIBER_TARGET_G; without it, three', () => {
  const withFiber = buildWindowLane({ slots: [slot({ state: 'done', mealId: 'm1' })], budget, meals: [meal({ fiberG: 9 })] })
  expect(withFiber.tiles[0].rings.map(r => [r.key, r.grams, r.pct])).toEqual([
    ['p', 36, 20], ['c', 48, 20], ['f', 9, 13], ['r', 9, Math.round(9 / FIBER_TARGET_G * 100)],
  ])
  expect(withFiber.tiles[0].rings[3]).toMatchObject({ letter: 'R', label: 'Rost', color: 'var(--macro-fiber)' })
  const noFiber = buildWindowLane({ slots: [slot({ state: 'done', mealId: 'm1' })], budget, meals: [meal({ fiberG: null })] })
  expect(noFiber.tiles[0].rings).toHaveLength(3)
})

test('context: done tile reads the scored Szerep row; unscored/planned → null', () => {
  const dim = { id: 'context', label: 'x', weight: 0.2, score: 0.5, color: 'x', detail: '', context: [{ label: 'Szerep', value: 'Post-workout regeneráció' }] } as ContextDimension
  const scored = meal({ breakdown: { confidence: 0.8, summary: null, tagline: null, improve: [], tools: [], dimensions: [dim] } })
  expect(buildWindowLane({ slots: [slot({ state: 'done', mealId: 'm1' })], budget, meals: [scored] }).tiles[0].context).toBe('post')
  expect(buildWindowLane({ slots: [slot({ state: 'done', mealId: 'm1' })], budget, meals: [meal()] }).tiles[0].context).toBeNull()
  expect(buildWindowLane({ slots: [slot({ state: 'now' })], budget, meals: [] }).tiles[0].context).toBeNull()
})
```
(Adjust the p/c/f expectations to the file's `meal()` factory macros 36/48/9 and `budget` 180/240/72 → 20/20/13.)

- [ ] **Step 2: Run → FAIL** (type error on `'r'` / missing `context`).
- [ ] **Step 3: Implement** in `fuelSwimlane.ts`:

```ts
import { FIBER_TARGET_G, toMin } from '@/data/fuel/fuelConfig'
import { mealContextOf, type MealContext } from '@/features/fuel/logic/mealContext'
…
export interface TileRingVM { key: 'p' | 'c' | 'f' | 'r'; … }
…
  /** The role the meal was scored under (Standard / Pre / Post) — done tiles only, null when
   *  unscored or planned (mezo-zeeq; see logic/mealContext.ts). */
  context: MealContext | null
…
    const rings = [
      ringOf('p', 'P', 'Fehérje', p, budget.p, 'var(--macro-protein)'),
      ringOf('c', 'C', 'Szénhidrát', c, budget.c, 'var(--macro-carbs)'),
      ringOf('f', 'F', 'Zsír', f, budget.f, 'var(--macro-fat)'),
    ]
    // Rost only where it is real: a done tile's logged meal carrying fiberG (FuelSlot has none).
    if (done && meal?.fiberG != null) rings.push(ringOf('r', 'R', 'Rost', meal.fiberG, FIBER_TARGET_G, 'var(--macro-fiber)'))
    return { …, rings, context: done && meal ? mealContextOf(meal) : null, … }
```
Header comment lines 15-16: replace "imported sight-unseen by WindowLane.tsx and FuelMaiPage.tsx" with "imported sight-unseen by WindowBlock.tsx, FuelLogHeroTile.tsx, FuelLogPage.tsx and FuelMaiPage.tsx (WindowLane retired, mezo-byo1)".

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/logic/fuelSwimlane.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(fuel): tile VM — Rost ring on done tiles + scored context (mezo-zeeq)`

---

### Task 6: WindowBlock done card — ctx chip, score pill + kcal row, 44px rings + CSS

**Files:**
- Modify: `frontend/src/features/fuel/components/WindowBlock.tsx` (whole render)
- Modify: `frontend/src/styles/prototype.css:6372-6390` (`.fh-wring`, `.fh-scorech`) and `6803-6831` (`.flog-*`), reduced-motion block `6425-6428`
- Test: `frontend/src/features/fuel/pages/FuelLogPage.test.tsx` (append)

**Interfaces:**
- Consumes: `WindowTileVM.rings/context/scorePct/scorable`, `toneOf`, `MEAL_CONTEXT_LABEL`.
- Produces: markup — `.flog-top` → `<time> <span.flog-lbl> [<span.fh-ctx.is-{ctx}>● LABEL</span>] <span.fh-wstamp>`; done main → `.flog-main` (icon + name) then `.flog-srow` (`<button.fh-aisc.s-{tone}>` + `.flog-kcal`), then `.flog-rings` with `.fh-wring` SVG rings (`{grams} g` + `{pct}% napi`). Non-done: unchanged apart from rings being the new SVG ring.

- [ ] **Step 1: Failing tests** (append to `FuelLogPage.test.tsx`)

```tsx
test('a scored done meal shows the big score pill (number + tone word), kcal and a Rost ring (mezo-zeeq)', async () => {
  renderView() // mock day: m1 (fiberG 8) is scored
  const pill = (await screen.findAllByRole('button', { name: /AI score részletek$/ }))[0]
  expect(pill.className).toMatch(/fh-aisc/)
  expect(pill).toHaveTextContent(/^✨?\s*\d{1,3}(jó|közepes|gyenge)/) // number then word
  expect(screen.getAllByRole('img', { name: /^Rost \d+ g, a napi cél/ }).length).toBeGreaterThan(0)
})

test('the context chip reads the scored Szerep row — mock m2 is Pre-workout, m1 Standard', async () => {
  renderView()
  expect(await screen.findByText('Pre-workout')).toBeInTheDocument()
  expect(screen.getAllByText('Standard').length).toBeGreaterThan(0)
})

test('an unscored done window shows no context chip and the folyamatban pill', () => {
  hoisted.plan = { ...baseCtx, slots: [
    { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
  ] }
  renderView()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
  expect(screen.queryByText('Standard')).not.toBeInTheDocument()
  expect(screen.queryByText('Pre-workout')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `WindowBlock.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { huInt } from '@/shared/lib/huNum'
import { toneOf } from '@/features/fuel/logic/scoreTone'
import { MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'
import type { TileRingVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'

const RING = 44, STROKE = 4.5, R = RING / 2 - STROKE, C = 2 * Math.PI * R
const PILL = 30, PSTROKE = 3.5, PR = PILL / 2 - PSTROKE, PC = 2 * Math.PI * PR

/** One-frame `filled` flip so the CSS stroke-dashoffset transition carries the sweep — the
 *  KeretHero ring recipe (reduced motion: already filled, no transition). */
function useFilled(): boolean {
  const reduced = useReducedMotion()
  const [filled, setFilled] = useState(reduced)
  useEffect(() => {
    if (reduced) return
    const raf = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(raf)
  }, [reduced])
  return filled
}

function MacroRing({ ring, filled }: { ring: TileRingVM; filled: boolean }) {
  const frac = Math.max(0, Math.min(1, ring.pct / 100))
  return (
    <span className="fh-wring" role="img" aria-label={`${ring.label} ${ring.grams} g, a napi cél ${ring.pct} százaléka`}>
      <span className="fh-wring-w">
        <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
          <circle className="fh-wring-t" cx={RING / 2} cy={RING / 2} r={R} strokeWidth={STROKE} />
          <circle className="fh-wring-f" cx={RING / 2} cy={RING / 2} r={R} strokeWidth={STROKE} stroke={ring.color}
            strokeDasharray={C} strokeDashoffset={filled ? C - frac * C : C} />
        </svg>
        <i aria-hidden="true">{ring.letter}</i>
      </span>
      <b>{ring.grams}<em> g</em></b>
      <small>{ring.pct}% napi</small>
    </span>
  )
}

function ScorePill({ tile, filled, onScore }: { tile: WindowTileVM; filled: boolean; onScore: (mealId: string) => void }) {
  if (tile.scorePct == null) return <span className="fh-scorech is-pend">✨ folyamatban</span>
  const tone = toneOf(tile.scorePct)
  const frac = tile.scorePct / 100
  const body = (
    <>
      <span className="fh-aisc-r">
        <svg width={PILL} height={PILL} viewBox={`0 0 ${PILL} ${PILL}`} aria-hidden="true">
          <circle className="fh-aisc-t" cx={PILL / 2} cy={PILL / 2} r={PR} strokeWidth={PSTROKE} />
          <circle className="fh-aisc-f" cx={PILL / 2} cy={PILL / 2} r={PR} strokeWidth={PSTROKE}
            strokeDasharray={PC} strokeDashoffset={filled ? PC - frac * PC : PC} />
        </svg>
        <i aria-hidden="true">✨</i>
      </span>
      <span className="fh-aisc-t2"><b>{tile.scorePct}</b><small>{tone.word}</small></span>
    </>
  )
  if (!tile.scorable || tile.mealId == null) return <span className={`fh-aisc ${tone.cls}`}>{body}</span>
  return (
    <button type="button" className={`fh-aisc ${tone.cls} is-tap`} onClick={() => onScore(tile.mealId!)}
      aria-label={`${tile.name} · AI score részletek`}>
      {body}<span className="fh-aisc-chev" aria-hidden="true">›</span>
    </button>
  )
}
```
Render (inside `WindowBlock`): `const filled = useFilled()`; top row adds
`{done && tile.context && <span className={`fh-ctx is-${tile.context}`}><i aria-hidden="true" />{MEAL_CONTEXT_LABEL[tile.context]}</span>}` between the label and the stamp.
Done branch:
```tsx
<div className="flog-main">
  <div className="flog-icon"><ClayIcon name={tile.icon} size={34} /></div>
  <div className="flog-txt"><div className="flog-name">{tile.name}</div></div>
</div>
<div className="flog-srow">
  <ScorePill tile={tile} filled={filled} onScore={onScore} />
  {tile.kcal != null && <div className="flog-kcal"><b>{huInt(tile.kcal)}</b><small>kcal</small></div>}
</div>
<div className="flog-rings is-done">{tile.rings.map(r => <MacroRing key={r.key} ring={r} filled={filled} />)}</div>
```
Non-done branch keeps the current `.flog-main` with `.flog-data` (kcal + `.flog-rings`), rings now `MacroRing`. Delete `MiniRing`/`ScoreChip` and the `useCountUp` import.

- [ ] **Step 4: CSS** — replace `.fh-wring*` (6378-6384) and `.fh-scorech` block (6386-6390) with:

```css
/* 44px SVG macro rings on the /fuel/log block (mezo-zeeq; prototype fuel-logolas-2.1.html
   `.m`) — stroke-dashoffset transition, the .khero-ring-fill recipe. */
.fh-wring { display: grid; gap: 1px; justify-items: center; flex: 1; min-width: 0; }
.fh-wring-w { position: relative; width: 44px; height: 44px; }
.fh-wring-w svg { transform: rotate(-90deg); display: block; }
.fh-wring-t { fill: none; stroke: var(--mz-gbar-bg); }
:where(.fh-wring-f) { fill: none; stroke-linecap: round; transition: stroke-dashoffset 1.4s cubic-bezier(.2, .8, .2, 1); }
.fh-wring-w i { position: absolute; inset: 0; display: grid; place-items: center; font-style: normal;
  font-size: 11px; font-weight: 800; color: var(--mz-ink-soft); }
.fh-wring b { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; margin-top: 3px; font-variant-numeric: tabular-nums; }
.fh-wring b em { font-style: normal; font-size: 9px; font-weight: 600; color: var(--mz-ink-mut); }
.fh-wring small { font-size: 8.5px; font-weight: 600; color: var(--mz-ink-mut); font-variant-numeric: tabular-nums; }
.flog-rings.is-done { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px;
  padding-top: 10px; border-top: 1px solid var(--border-subtle); }

/* Unscored pill (kept) */
.fh-scorech { font-size: 9px; font-weight: 800; border-radius: 999px; padding: 3px 9px; flex: none;
  font-variant-numeric: tabular-nums; background: var(--mz-chat-refch-bg); color: var(--mz-ink-mut); }
.fh-scorech.is-pend { min-height: 36px; display: inline-flex; align-items: center; padding: 3px 14px; }

/* AI score pill (mezo-zeeq): 30px ring + 19px number + tone word + chevron; nudges every 2.6s
   (the fh-lt-nowpulse cadence) so it reads as tappable; :active and reduced motion stop it. */
.fh-aisc { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px 4px 5px; border-radius: 999px;
  background: var(--surface-card, #fff); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10), inset 0 0 0 1px var(--border-subtle);
  color: var(--text-primary); transform-origin: 40% 50%; border: none; font-family: inherit; text-align: left; }
.fh-aisc.is-tap { cursor: pointer; min-height: 44px; }
.fh-aisc-r { position: relative; width: 30px; height: 30px; flex: none; }
.fh-aisc-r svg { transform: rotate(-90deg); display: block; }
.fh-aisc-t { fill: none; stroke: var(--mz-gbar-bg); }
:where(.fh-aisc-f) { fill: none; stroke-linecap: round; stroke: var(--sc); transition: stroke-dashoffset 1.2s cubic-bezier(.2, .8, .2, 1); }
.fh-aisc-r i { position: absolute; inset: 0; display: grid; place-items: center; font-style: normal; font-size: 10px; }
.fh-aisc-t2 { display: grid; line-height: 1.1; }
.fh-aisc-t2 b { font-size: 19px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
.fh-aisc-t2 small { font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sc-ink); }
.fh-aisc-chev { font-size: 16px; color: var(--mz-ink-mut); margin-left: -2px; }
.fh-aisc.s-hi { --sc: var(--dv-sage); --sc-ink: var(--mz-cell-sage-ink); }
.fh-aisc.s-md { --sc: var(--dv-amber); --sc-ink: var(--mz-cell-amber-ink); }
.fh-aisc.s-lo { --sc: var(--dv-coral); --sc-ink: var(--mz-cell-coral-ink); }
@keyframes fh-aisc-nudge {
  0%, 14%, 100% { transform: rotate(0) scale(1); }
  3% { transform: rotate(-5deg) scale(1.05); } 6% { transform: rotate(5deg) scale(1.06); }
  9% { transform: rotate(-3deg) scale(1.04); } 12% { transform: rotate(2deg) scale(1.02); }
}
@keyframes fh-aisc-halo {
  0%, 14%, 100% { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10), inset 0 0 0 1px var(--border-subtle); }
  6% { box-shadow: 0 4px 18px color-mix(in srgb, var(--sc) 45%, transparent), inset 0 0 0 1.5px var(--sc); }
}
.fh-aisc.is-tap { animation: fh-aisc-nudge 2.6s ease-in-out 0.3s infinite, fh-aisc-halo 2.6s ease-in-out 0.3s infinite; }
.fh-aisc.is-tap:active { animation: none; transform: scale(0.96); }

/* Context chip — Standard / Pre-workout / Post-workout (mezo-zeeq) */
.fh-ctx { display: inline-flex; align-items: center; gap: 5px; font-size: 7.5px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 3px 8px; border-radius: 999px; flex: none; }
.fh-ctx i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.fh-ctx.is-standard { background: var(--mz-gbar-bg); color: var(--mz-ink-soft); }
.fh-ctx.is-pre { background: var(--mz-cell-amber-bg); color: var(--mz-cell-amber-ink); }
.fh-ctx.is-post { background: var(--mz-cell-lav-bg); color: var(--mz-cell-lav-ink); }
```
In the `.flog-*` block: `.flog-name` font-size 13.5 → 15px; add `.flog-srow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }`; `.flog-srow .flog-kcal { background: none; box-shadow: none; padding: 0; text-align: right; }`, `.flog-srow .flog-kcal b { font-size: 24px; letter-spacing: -0.03em; }`, `.flog-srow .flog-kcal small { font-size: 8px; margin-left: 4px; }`. In the reduced-motion block (6425-6428) add `.fh-aisc.is-tap { animation: none; } :where(.fh-wring-f), :where(.fh-aisc-f) { transition: none; }`.

- [ ] **Step 5: Run** `pnpm vitest run src/features/fuel/pages/FuelLogPage.test.tsx` → PASS; `pnpm tsc -b` clean.
- [ ] **Step 6: Commit** `feat(fuel): WindowBlock 2.1 — score pill + kcal row, 44px rings with Rost, context chip (mezo-zeeq)`

---

### Task 7: FuelLogPage hero → KeretHero (+ Energy / Water sheets)

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelLogPage.tsx:25-35, 60-65, 112-139, 200-203`
- Modify: `frontend/src/styles/prototype.css` (`.flog-page .khero` band tweak)
- Test: `FuelLogPage.test.tsx` (append; update the two "ezen a napon nem volt" expectations if needed)

**Interfaces:**
- Consumes: `buildKeretHero`, `asPastDayHero`, `KeretHero {vm, onChip, onWaterRing, ofLine}`, `EnergyBreakdownSheet`, `WaterLogSheet`, `useWaterActions(date)`.

- [ ] **Step 1: Failing tests**

```tsx
test('the hero is the KeretHero: kcal-ma number + of-line, no bignum / target ratio (mezo-zeeq)', () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  const { container } = renderView()
  expect(container.querySelector('.khero-n')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')).toBeNull()
  expect(container.querySelector('.khero-of')).toHaveTextContent(/0\/1 ablak kész · .* kcal még belefér/)
})

test('the víz ring opens the WaterLogSheet on the log page', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Víz logolása/ }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('a past day hides the energy chips and the now-marker (energy/clock are today\'s)', async () => {
  hoisted.plan = { ...baseCtx, energy: { base: 2400, activity: 300, balance: -300, target: 2400 }, slots: [UZSONNA] }
  const user = userEvent.setup()
  const { container } = renderView()
  expect(container.querySelector('.khero-chips')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(container.querySelector('.khero-chips')).toBeNull()
  expect(container.querySelector('.khero-mark')).toBeNull()
})
```
(If `WaterLogSheet` renders no `role="dialog"`, assert on its title text instead — check `WaterLogSheet.tsx` first.)

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** in `FuelLogPage.tsx`:

```tsx
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { useFuelDay, useFuelTimeline, useWaterActions } from '@/data/hooks'
import { buildKeretHero, asPastDayHero } from '@/features/fuel/logic/keretHero'
import { KeretHero } from '@/features/fuel/components/KeretHero'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
…
  const { plan, budget, nowHHmm, energyBreakdown } = useFuelTimeline(date)
  const { logWater } = useWaterActions(date)
  const [waterOpen, setWaterOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)

  // The hub's own hero, fed the same way FuelMaiPage feeds it; a past day drops the chips and the
  // now-marker (asPastDayHero) because useFuelTimeline's energy/clock describe TODAY.
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const heroRaw = buildKeretHero({ budget, staticEnergy, consumed: fuel.consumed, meals: fuel.meals,
    water: { currentMl: fuel.consumed.water, targetMl: fuel.targets.water }, slots: plan.slots, nowHHmm })
  const heroVm = past ? asPastDayHero(heroRaw) : heroRaw
  const remaining = heroVm.remainingKcal
  const ofLine = lane.tiles.length > 0
    ? `${doneCount}/${lane.tiles.length} ablak kész · ${huInt(Math.abs(remaining))} kcal ${remaining >= 0 ? 'még belefér' : 'fölötte'}`
    : past ? 'ezen a napon nem volt étkezési ablak' : 'nincs mai étkezési ablak'
```
Render: keep `PageHead`, `.flog-daysw`, the eyebrow; delete `.mz-hero-row` + `.mz-hero-sb`; after the eyebrow div close the `.mz-page-hero`, then:
```tsx
<div className="flog-khero">
  <KeretHero vm={heroVm} ofLine={ofLine} onChip={s => setEnergyOpen(s)} onWaterRing={() => setWaterOpen(true)} />
</div>
```
Keep `.flog-pastnote` inside `.mz-page-hero` above the eyebrow's sibling (order: stepper, eyebrow, pastnote). Sheets at the bottom next to `MealScoreSheet`:
```tsx
{waterOpen && <WaterLogSheet currentMl={fuel.consumed.water} targetMl={fuel.targets.water} onLog={ml => logWater(ml)} onClose={() => setWaterOpen(false)} />}
{energyOpen && energyBreakdown && <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />}
```
Remove the now-unused `flog-goal` usage (keep CSS or delete `.flog-goal` line 6764). CSS: `.flog-khero .khero { padding-top: 0; background: none; }` (the page's coral/gold tone already washes the top; the halo-sage band would double up).

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/pages/FuelLogPage.test.tsx` → PASS. The "üres múltbeli nap" test expects ≥2 occurrences of the note — the of-line + the block meta still give 2.
- [ ] **Step 5: Commit** `feat(fuel): /fuel/log hero = KeretHero with of-line, energy + water sheets (mezo-zeeq)`

---

### Task 8: `ScoreLedger`

**Files:** Create `frontend/src/features/fuel/components/ScoreLedger.tsx`, `ScoreLedger.test.tsx`; CSS `.sb-ledger*`.

**Interfaces:** `export function ScoreLedger({ dimensions }: { dimensions: MealDimension[] })` — one `.sb-ledger-seg` per dimension with `style={{ flex: weight }}` and an inner fill `width: score*100%`, footer shows each weight `%` and `Σ {sum} / 100` where `sum = Σ(weight × score × 100)` to one decimal (HU comma).

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { ScoreLedger } from '@/features/fuel/components/ScoreLedger'
import type { MealDimension } from '@/data/types'
const dims = [
  { id: 'macro', label: 'Makró', weight: 0.35, score: 0.64, color: 'red', detail: '' , macroRatio: { p: 0, c: 0, f: 0 }, macroTargets: { p: '', c: '', f: '' }, kcalShareOfDay: 0 },
  { id: 'context', label: 'Kontextus', weight: 0.2, score: 0.52, color: 'blue', detail: '', context: [] },
] as MealDimension[]
test('one segment per dimension, flex = weight, fill = score, Σ = weight×score×100', () => {
  const { container } = render(<ScoreLedger dimensions={dims} />)
  const segs = container.querySelectorAll<HTMLElement>('.sb-ledger-seg')
  expect(segs).toHaveLength(2)
  expect(segs[0].style.flexGrow).toBe('0.35')
  expect((segs[0].firstElementChild as HTMLElement).style.width).toBe('64%')
  expect(screen.getByText('Σ')).toBeInTheDocument()
  expect(screen.getByText('32,8')).toBeInTheDocument() // 22.4 + 10.4
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```tsx
// frontend/src/features/fuel/components/ScoreLedger.tsx
// Contribution ledger (mezo-zeeq, Lighthouse-style): one segment per dimension, width = its
// weight, fill = its sub-score — the empty part of each segment IS the "could be better" room.
// Pure presentational, only reads `weight`/`score`/`color` — nothing fabricated.
import type { MealDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'

export function ScoreLedger({ dimensions }: { dimensions: MealDimension[] }) {
  const sum = dimensions.reduce((s, d) => s + d.weight * d.score * 100, 0)
  return (
    <div className="sb-ledger" aria-label="Pontszám-összetétel">
      <div className="sb-ledger-bar">
        {dimensions.map(d => (
          <span key={d.id} className="sb-ledger-seg" style={{ flexGrow: d.weight, flexBasis: 0 }}>
            <i style={{ width: `${Math.round(d.score * 100)}%`, background: d.color }} />
          </span>
        ))}
      </div>
      <div className="sb-ledger-sum">
        <span>{dimensions.map((d, i) => (
          <b key={d.id} style={{ color: d.color }}>{i > 0 ? ' · ' : ''}{Math.round(d.weight * 100)}%</b>
        ))}</span>
        <span><em>Σ</em> <b>{hu1(sum)}</b> / 100</span>
      </div>
    </div>
  )
}
```
(Check `hu1` exists in `@/shared/lib/huNum` — KeretHero imports it; it formats one HU decimal.)

CSS (append near `.flog-*` as a new `/* ═══ Score breakdown 2.1 (mezo-zeeq) ═══ */` block):
```css
.sb-ledger { border-radius: 18px; background: var(--surface-card, #fff); border: 0.5px solid var(--border-subtle); padding: 12px 14px; }
.sb-ledger-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; gap: 2px; }
.sb-ledger-seg { position: relative; display: block; height: 100%; background: var(--mz-gbar-bg); }
.sb-ledger-seg i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 0 3px 3px 0; display: block; }
.sb-ledger-sum { display: flex; justify-content: space-between; margin-top: 8px; font-size: 10.5px; color: var(--mz-ink-mut); font-variant-numeric: tabular-nums; }
.sb-ledger-sum b { font-weight: 800; } .sb-ledger-sum em { font-style: normal; }
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(fuel): ScoreLedger contribution bar (mezo-zeeq)`

---

### Task 9: `DimensionCard` collapsible

**Files:**
- Modify: `frontend/src/features/fuel/components/DimensionCard.tsx` (whole), `DimensionCard.test.tsx`
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx:210-222` (only if the label assertion needs `getAllByText`)
- CSS `.sb-dim*`

**Interfaces:** `DimensionCard({ dim, defaultOpen = false })`; header is a `<button aria-expanded aria-controls>` containing a 52px ring (`Math.round(dim.score*100)`), the label, `súly {w}% → {contribution} pont`, the `detail` prose clamped to 2 lines; the expanded panel (`id`) holds the full `detail` + the existing per-id panel.

- [ ] **Step 1: Update the test**

```tsx
test('collapsed header shows label, ring score, weight→pont line; the rows appear after expanding', async () => {
  render(<DimensionCard dim={whoDim} />)
  const head = screen.getByRole('button', { name: /Ajánlások · WHO/ })
  expect(head).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('90')).toBeInTheDocument()
  expect(screen.getByText(/súly 14% → 12,6 pont/)).toBeInTheDocument()
  expect(screen.queryByText('6 E% / 10 E% limit')).not.toBeInTheDocument()
  await userEvent.click(head)
  expect(head).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('6 E% / 10 E% limit')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```tsx
import { useId, useState } from 'react'
import type { MealDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'

const SIZE = 52, STROKE = 5, R = SIZE / 2 - STROKE, C = 2 * Math.PI * R

export function DimensionCard({ dim, defaultOpen = false }: { dim: MealDimension; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const sub = Math.round(dim.score * 100)
  const contribution = hu1(dim.score * dim.weight * 100)
  return (
    <div className="sb-dim" style={{ '--c': dim.color } as React.CSSProperties}>
      <button type="button" className="sb-dim-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="sb-dim-ring">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle className="sb-dim-t" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
            <circle className="sb-dim-f" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE}
              strokeDasharray={C} strokeDashoffset={C - (sub / 100) * C} />
          </svg>
          <b>{sub}</b>
        </span>
        <span className="sb-dim-txt">
          <span className="sb-dim-lb"><i aria-hidden="true" />{dim.label}</span>
          <span className="sb-dim-w">súly <b>{Math.round(dim.weight * 100)}%</b> → <b>{contribution}</b> pont</span>
          {!open && <span className="sb-dim-one"><SafeMarkdown text={dim.detail} /></span>}
        </span>
        <span className="sb-dim-arr" aria-hidden="true">›</span>
      </button>
      {open && (
        <div id={id} className="sb-dim-body">
          <p><SafeMarkdown text={dim.detail} /></p>
          {dim.id === 'macro' && <MacroPanel dim={dim} />}
          {dim.id === 'micro' && <MicroPanel dim={dim} />}
          {dim.id === 'nova' && <NovaPanel dim={dim} />}
          {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
            || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
            && <ContextPanel dim={dim} />}
        </div>
      )}
    </div>
  )
}
```
CSS:
```css
.sb-dim { border-radius: 18px; background: var(--surface-card, #fff); border: 0.5px solid var(--border-subtle); overflow: hidden; }
.sb-dim-head { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; width: 100%;
  padding: 12px 14px; border: none; background: none; font-family: inherit; text-align: left; color: var(--text-primary); cursor: pointer; }
.sb-dim-ring { position: relative; width: 52px; height: 52px; }
.sb-dim-ring svg { transform: rotate(-90deg); display: block; }
.sb-dim-t { fill: none; stroke: var(--mz-gbar-bg); }
.sb-dim-f { fill: none; stroke: var(--c); stroke-linecap: round; }
.sb-dim-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 16px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.sb-dim-txt { display: grid; gap: 2px; min-width: 0; }
.sb-dim-lb { font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.sb-dim-lb i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); flex: none; }
.sb-dim-w { font-size: 10.5px; color: var(--mz-ink-mut); } .sb-dim-w b { color: var(--mz-ink-soft); font-weight: 700; }
.sb-dim-one { font-size: 12px; color: var(--mz-ink-soft); line-height: 1.35; margin-top: 3px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sb-dim-arr { font-size: 16px; color: var(--mz-ink-mut); transition: transform 0.25s; }
.sb-dim-head[aria-expanded="true"] .sb-dim-arr { transform: rotate(90deg); }
.sb-dim-body { padding: 0 14px 14px; } .sb-dim-body > p { margin: 0 0 10px; font-size: 13px; line-height: 1.5; }
```

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel/components/DimensionCard.test.tsx src/features/fuel/pages/RecipeDetailPage.test.tsx` → PASS ('Kcal & makró arány' is in the collapsed header).
- [ ] **Step 5: Commit** `feat(fuel): DimensionCard collapsible with ring header (mezo-zeeq)`

---

### Task 10: Breakdown body (ledger + gain cards, no tools), ScoreHero, MealScoreSheet header

**Files:**
- Modify: `ScoreBreakdownBody.tsx` (whole), `ScoreHero.tsx` (whole), `MealScoreSheet.tsx:78-88` + header
- Modify: `MealScoreSheet.test.tsx:23-27` (+ new tests)
- CSS `.sb-hero*`, `.sb-imp*`, `.sb-sec`

**Interfaces:**
- `ScoreBreakdownBody({ breakdown, scorePct })` — `scorePct` for the section eyebrow `Miből áll össze a {scorePct}` (RecipeScoreSheet passes `Math.round(weightedScore)`: compute `Math.round(breakdown.dimensions.reduce((s,d)=>s+d.weight*d.score*100,0))` inside the body when `scorePct` is omitted).
- `ScoreHero({ meal, scorePct, confidence })` unchanged signature.

- [ ] **Step 1: Update/extend tests**

```tsx
test('renders the score hero, summary, the ledger and 8 collapsed dimension cards; no tools list', () => {
  const meal = renderSheet()
  expect(screen.getByText(meal.title)).toBeInTheDocument()
  expect(screen.getByText(/Miből áll össze a \d+/)).toBeInTheDocument()
  expect(screen.getByText('8 dimenzió · súlyozva')).toBeInTheDocument()
  expect(screen.getByLabelText('Pontszám-összetétel')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { expanded: false }).length).toBeGreaterThanOrEqual(8)
  expect(screen.queryByText('Hogyan számoltam')).not.toBeInTheDocument()
})
test('the hero carries the tone word and the Rost fact, the header the context chip', () => {
  renderSheet() // mock m1: fiberG 8, standard
  expect(screen.getByText(/^(jó|közepes|gyenge)$/)).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Standard')).toBeInTheDocument()
})
test('Lehetne jobb renders the gain as pont', () => {
  renderSheet() // mock improve impacts are "+0.04 score" / "+0.01 score"
  expect(screen.getByText('+4')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

`ScoreBreakdownBody.tsx`:
```tsx
import type { MealBreakdown } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'
import { ScoreLedger } from '@/features/fuel/components/ScoreLedger'

export function ScoreBreakdownBody({ breakdown, scorePct }: { breakdown: MealBreakdown; scorePct?: number }) {
  const b = breakdown
  const total = scorePct ?? Math.round(b.dimensions.reduce((s, d) => s + d.weight * d.score * 100, 0))
  return (
    <>
      <div className="sb-sec"><Eyebrow>Miből áll össze a {total}</Eyebrow><span className="sb-sec-r">{b.dimensions.length} dimenzió · súlyozva</span></div>
      <ScoreLedger dimensions={b.dimensions} />
      <div className="col gap-sm" style={{ marginTop: 8 }}>
        {b.dimensions.map(d => <DimensionCard key={d.id} dim={d} />)}
      </div>
      {b.improve && b.improve.length > 0 && (
        <>
          <div className="sb-sec"><Eyebrow className="text-warning">Lehetne jobb</Eyebrow><span className="sb-sec-r">{b.improve.length} javaslat</span></div>
          <div className="col gap-sm">
            {b.improve.map((it, i) => {
              const gain = formatImpact(it.impact)
              const m = /^([+−]\d+) pont$/.exec(gain)
              return (
                <div key={i} className="sb-imp">
                  <p><SafeMarkdown text={it.text} /></p>
                  <span className="sb-imp-gain">{m ? <>{m[1]}<small>pont</small></> : gain}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
```
`ScoreHero.tsx`:
```tsx
import type { FuelMeal } from '@/data/types'
import { toneOf } from '@/features/fuel/logic/scoreTone'
const SIZE = 112, STROKE = 8, R = SIZE / 2 - STROKE, C = 2 * Math.PI * R
export function ScoreHero({ meal, scorePct, confidence }: { meal: FuelMeal; scorePct: number; confidence: number }) {
  const pct = Math.round(scorePct)
  const tone = toneOf(pct)
  return (
    <div className={`sb-hero ${tone.cls}`}>
      <div className="sb-hero-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle className="sb-hero-t" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
          <circle className="sb-hero-f" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} />
        </svg>
        <span className="sb-hero-n"><b>{pct}</b><small>/ 100</small></span>
      </div>
      <div className="sb-hero-meta">
        <div className="sb-hero-word">{tone.word}</div>
        <div className="sb-hero-facts">
          <span><i>kcal</i>{meal.kcal}</span><span><i>P</i>{meal.p} g</span><span><i>C</i>{meal.c} g</span><span><i>F</i>{meal.f} g</span>
          {meal.fiberG != null && <span><i>Rost</i>{meal.fiberG} g</span>}
        </div>
        <div className="sb-hero-conf">Konfidencia <span className="bar"><i style={{ width: `${Math.round(confidence * 100)}%` }} /></span><b>{Math.round(confidence * 100)}%</b></div>
      </div>
    </div>
  )
}
```
`MealScoreSheet.tsx`: import `mealContextOf`, `MEAL_CONTEXT_LABEL`; under the slot label add `{ctx && <span className={`fh-ctx is-${ctx}`}><i aria-hidden="true" />{MEAL_CONTEXT_LABEL[ctx]}</span>}` (`const ctx = mealContextOf(meal)`); replace the "Súlyozott bontás" row (lines 78-84) with nothing (the body renders its own section head) and pass `scorePct={Math.round(scorePct)}` to `ScoreBreakdownBody`. Keep the `RecipeScoreSheet` call unchanged (no `scorePct` → computed).

CSS:
```css
.sb-sec { display: flex; justify-content: space-between; align-items: baseline; margin: 18px 2px 8px; }
.sb-sec-r { font-size: 10.5px; font-weight: 700; color: var(--mz-ink-mut); }
.sb-hero { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; padding: 16px; border-radius: 22px;
  border: 0.5px solid var(--border-subtle); background: linear-gradient(150deg, color-mix(in srgb, var(--sc) 18%, var(--surface-card)), color-mix(in srgb, var(--sc) 4%, var(--surface-page))); }
.sb-hero.s-hi { --sc: var(--dv-sage); } .sb-hero.s-md { --sc: var(--dv-amber); } .sb-hero.s-lo { --sc: var(--dv-coral); }
.sb-hero-ring { position: relative; width: 112px; height: 112px; } .sb-hero-ring svg { transform: rotate(-90deg); display: block; }
.sb-hero-t { fill: none; stroke: var(--mz-gbar-bg); } .sb-hero-f { fill: none; stroke: var(--sc); stroke-linecap: round; }
.sb-hero-n { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; line-height: 1; }
.sb-hero-n b { font-size: 40px; font-weight: 200; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.sb-hero-n small { display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mz-ink-mut); margin-top: 4px; }
.sb-hero-word { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; text-transform: capitalize; }
.sb-hero-facts { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; font-variant-numeric: tabular-nums; }
.sb-hero-facts span { font-size: 10.5px; font-weight: 700; padding: 4px 8px; border-radius: 999px; background: var(--surface-card, #fff); color: var(--mz-ink-soft); }
.sb-hero-facts i { font-style: normal; color: var(--mz-ink-mut); font-weight: 600; margin-right: 3px; }
.sb-hero-conf { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mz-ink-mut); }
.sb-hero-conf .bar { flex: 1; max-width: 90px; height: 4px; border-radius: 999px; background: var(--mz-gbar-bg); overflow: hidden; }
.sb-hero-conf .bar i { display: block; height: 100%; background: var(--sc); border-radius: 999px; }
.sb-imp { border-radius: 16px; background: var(--surface-card, #fff); border: 0.5px solid var(--border-subtle); padding: 12px 12px 12px 14px;
  display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.sb-imp p { margin: 0; font-size: 13px; line-height: 1.45; }
.sb-imp-gain { font-size: 15px; font-weight: 700; color: var(--mz-cell-sage-ink); background: var(--mz-cell-sage-bg); padding: 6px 10px; border-radius: 12px; white-space: nowrap; letter-spacing: -0.02em; text-align: center; }
.sb-imp-gain small { display: block; font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; opacity: 0.8; }
```

- [ ] **Step 4: Run** `pnpm vitest run src/features/fuel` → PASS (RecipeDetailPage, MealScoreSheet, DimensionCard, FuelLogPage). `pnpm tsc -b` clean.
- [ ] **Step 5: Commit** `feat(fuel): score sheet 2.1 — tone hero, ledger, gain cards, tools list retired (mezo-zeeq)`

---

### Task 11: Docs, CODEMAP, gates, PR

**Files:** `docs/features/fuel.md` §2 (43-74) + §10 (379-391); `docs/CODEMAP.md` (regenerate); `docs/design_2.0/prototypes/README.md` (index `fuel-logolas-2.1.html`); `bd`.

- [ ] **Step 1: fuel.md** — in §2 describe: `/fuel/log` hero = KeretHero with `ofLine` (deliberate divergence from the hub v3 declutter), `asPastDayHero`; done block anatomy (ctx chip from the `Szerep` row via `logic/mealContext.ts`, score pill `.fh-aisc` with tone ladder `logic/scoreTone.ts`, kcal row, 44px rings incl. Rost only with `fiberG`); MealScoreSheet: `ScoreLedger`, collapsible `DimensionCard`, `formatImpact`, tools list removed; fix line 383 (ScoreBreakdownBody reused via `RecipeScoreSheet`). §10: add the new files.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check` (also absorbs the pre-existing `RecipeWorkshopPage.tsx` staleness); run the docs linter the repo uses in `ci.yml:31` (`pnpm --dir frontend lint-docs` or the script named there) → green.
- [ ] **Step 3: Gates** from `frontend/`: `pnpm tsc -b`, `VITE_USE_MOCK=true pnpm vitest run`, `VITE_USE_MOCK=false pnpm vitest run`, `pnpm build`.
- [ ] **Step 4: Runtime check** — `verify` skill: build + mock-mode PWA, open `/fuel/log`, screenshot light + dark; open a score pill → sheet.
- [ ] **Step 5: Commit** `docs(fuel): Logolás 2.1 feature doc + CODEMAP (mezo-zeeq)`; push; `gh pr create`; wait CI green; merge `--no-ff` locally after `git pull --rebase` on main; push; `bd close mezo-zeeq`; `bd dolt push`.

---

## Self-review

- **Spec coverage:** §1 hero → Task 4 + 7; §2 card → Task 5 + 6; §3 context → Task 2 + 5 + 6 + 10 (sheet chip); §4 sheet → Task 8 + 9 + 10; "Nem cél" honoured (no sticky, no composer choice, no hub change); docs → Task 11; prior-art nudge caveat recorded in spec (follow-up issue filed in Task 11 step 5 as `bd create "Logolás 2.1: bounded score-pill nudge option"`).
- **Types:** `toneOf` → `{tone, cls, word}` used in Tasks 6, 10; `mealContextOf` / `MEAL_CONTEXT_LABEL` used in Tasks 5, 6, 10; `TileRingVM.key` incl. `'r'` (Task 5) rendered by `MacroRing` (Task 6); `KeretHero.ofLine` (Task 4) passed in Task 7; `ScoreBreakdownBody.scorePct` optional (Task 10) so `RecipeScoreSheet` compiles unchanged.
