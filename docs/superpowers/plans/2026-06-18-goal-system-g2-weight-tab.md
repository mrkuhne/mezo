# Goal System — G2 Súly Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give daily weight logging its own first-class home — a new `Súly` tab at `/me/weight` (dedicated number + trend + log) — by extracting the weight chart, trend cells, and log entry out of `GoalsView`, leaving `GoalsView` as the goal/strategy view.

**Architecture:** Frontend-only IA move (the weight backend is already live via `useWeight`, slice G1). Add a `WeightView` sub-view + a `Súly` `MeSubNav` tab + a `/me/weight` child route; relocate the existing `WeightChart` / `TrendCell` / `WeightLogSheet` usages (reused verbatim, not rebuilt) from `GoalsView` into `WeightView`. `GoalsView` keeps the goal hero, insights, factors, and linked mesos.

**Tech Stack:** React 19 · react-router-dom (`RouteObject` config) · TanStack Query (via `useWeight`/`useGoal`) · Vitest + Testing Library.

**Driving issue:** `mezo-9sv` (G2), child of epic `mezo-2hp`. **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md` (decision D12; mockup `.superpowers/brainstorm/8732-1781770664/content/me-ia-layout.html` option B).

## Global Constraints

- **Frontend-only.** No backend, contract, or migration changes. The weight data already flows through `useWeight()` (`frontend/src/data/weightHooks.ts`, returns `{ weightLog, weightTrends, logWeight }`) and `useGoal()` (`{ goal, linkedMesocycles }`), both re-exported from `@/data/hooks` (G1).
- **Reuse, don't rebuild:** `WeightChart` (`features/me/components/WeightChart.tsx`, props `{ entries: WeightEntry[], startWeight: number, targetWeight: number, period: '7d'|'30d'|'all' }`), `TrendCell` (`features/me/components/TrendCell.tsx`, props `{ label, avg, delta, rate, onTrack }`), `WeightLogSheet` (`features/me/WeightLogSheet.tsx`, props `{ onClose, onSave, currentWeight }`). Do not modify these components.
- **Sub-view pattern:** a Me sub-view is a function component owning its own `.page-header` (`Eyebrow` + `PageTitle`), reading its hook, rendering directly — mirror `features/me/views/SleepView.tsx`. It renders inside `MeScreen`'s `<Outlet>` (`features/me/MeScreen.tsx`).
- **Router:** routes are a `RouteObject[]` in `frontend/src/app/router.tsx`; the `me` route's `children` array holds the sub-views. `MeSubNav` (`features/me/MeSubNav.tsx`) is a separate `SUBNAV` array of `{ to, label, end? }`.
- **Dual-mode:** mock mode seeds data synchronously (parity/tests); real mode loads async. Guard against an empty `weightLog` (real-mode first paint) — `WeightChart` already returns `null` for `< 2` entries.
- **Hungarian UI copy**, English code. Design tokens via CSS vars (`var(--brand-glow)` etc.); match the existing inline-style idiom of `GoalsView`/`SleepView`.
- **Gates:** `cd frontend && pnpm test` (real mode) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build` — all green. (Parity screenshots: the Súly tab is an intentional Phase-2 design beyond the prototype; parity is NOT a hard gate for this slice — note any baseline drift, don't chase it.)
- **Scope boundary:** G2 is the IA move only. The full `GoalsView`→command-center timeline restructure is G4; the inline ±-stepper log hero from mockup B is reused via `WeightLogSheet` (a button opens it), not rebuilt inline.

---

### Task 1: `WeightView` sub-view + test

**Files:**
- Create: `frontend/src/features/me/views/WeightView.tsx`
- Test: `frontend/src/features/me/views/WeightView.test.tsx`

**Interfaces:**
- Consumes: `useWeight()` → `{ weightLog: WeightEntry[], weightTrends: WeightTrends, logWeight: (WeightLogInput)=>void }`; `useGoal()` → `{ goal: Goal }` (for the chart's `startWeight`/`targetWeight` reference lines + a sensible current-weight fallback). `WeightChart`, `TrendCell`, `WeightLogSheet`.
- Produces: `export function WeightView()`.

- [ ] **Step 1: Write the failing test** (`WeightView.test.tsx`) — renders in mock mode (default), asserts the Súly view shows the trend chart + cells + a log entry point

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { WeightView } from './WeightView'

function renderView() {
  return render(
    <QueryProvider>
      <MemoryRouter><WeightView /></MemoryRouter>
    </QueryProvider>,
  )
}

test('WeightView renders the Súly header, trend cells, and a log entry point', () => {
  renderView()
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('7 nap')).toBeInTheDocument()
  expect(screen.getByText('4 hét')).toBeInTheDocument()
  // the log CTA opens the WeightLogSheet
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument() // WeightLogSheet title
})
```

> The `WeightLogSheet` title `Mi a számunk ma?` is verbatim from `WeightLogSheet.tsx`. Confirm the import path for `QueryProvider` (`@/app/providers/QueryProvider`) against an existing view test (e.g. `SleepView.test.tsx`) and match it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm test -- WeightView`
Expected: FAIL — `WeightView` not found / file missing.

- [ ] **Step 3: Write `WeightView.tsx`**

```tsx
import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useGoal, useWeight } from '@/data/hooks'
import { WeightChart } from '../components/WeightChart'
import { TrendCell } from '../components/TrendCell'
import { WeightLogSheet } from '../WeightLogSheet'

type Period = '7d' | '30d' | 'all'
const PERIODS: Period[] = ['7d', '30d', 'all']

export function WeightView() {
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { goal } = useGoal() // chart reference lines (start/target) + current-weight fallback
  const [period, setPeriod] = useState<Period>('30d')
  const [logOpen, setLogOpen] = useState(false)

  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : goal.currentWeight

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Súly</Eyebrow>
          <PageTitle className="mt-sm">Napi súly</PageTitle>
        </div>
      </div>

      {/* Daily-log hero — latest number + naplózás CTA (opens WeightLogSheet) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="card notch-12" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 52, fontWeight: 600, color: 'var(--brand-glow)', lineHeight: 1, textShadow: '0 0 24px rgba(94, 234, 212, 0.4)' }}>
              {latest.toFixed(1)}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>kg</span>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
              {weightTrends.last7d.weeklyRate} kg/hét · 7-napos átlag {weightTrends.last7d.avg}
            </span>
          </div>
          <button className="cta-primary notch-8" onClick={() => setLogOpen(true)} style={{ width: '100%', marginTop: 14, padding: 12, justifyContent: 'center' }}>
            <Icon name="plus" size={14} /> Súly naplózása
          </button>
        </div>
      </div>

      {/* Trend chart */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Súly · trend</Eyebrow>
          <div className="row gap-xs">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={'chip' + (period === p ? ' brand' : '')} style={{ fontSize: 9, padding: '3px 8px' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <WeightChart entries={weightLog} startWeight={goal.startWeight} targetWeight={goal.targetWeight} period={period} />
      </div>

      {/* Trend cells */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row gap-sm">
          <TrendCell label="7 nap" avg={weightTrends.last7d.avg} delta={weightTrends.last7d.deltaVsPrev} rate={weightTrends.last7d.weeklyRate} onTrack={weightTrends.last7d.onTrack} />
          <TrendCell label="4 hét" avg={weightTrends.last4w.avg} delta={weightTrends.last4w.deltaVsStart} rate={weightTrends.last4w.weeklyRate} onTrack={weightTrends.last4w.onTrack} />
        </div>
      </div>

      {logOpen && (
        <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest} />
      )}
    </>
  )
}
```

> `cta-primary` / `notch-8` / `chip` / `page-header` / `label-mono` are existing global classes (used in `GoalsView`/`SleepView`). `Icon name="plus"` matches the existing chip usage.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm test -- WeightView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/views/WeightView.tsx frontend/src/features/me/views/WeightView.test.tsx
git commit -m "feat(fe): WeightView (Súly) sub-view (mezo-9sv)"
```

---

### Task 2: Wire the `/me/weight` route + `Súly` tab + nav test

**Files:**
- Modify: `frontend/src/app/router.tsx` (import `WeightView`; add the `weight` child to the `me` route)
- Modify: `frontend/src/features/me/MeSubNav.tsx` (add the `Súly` tab)
- Test: `frontend/src/features/me/MeSubNav.test.tsx` (create if absent) or extend an existing nav test

**Interfaces:**
- Consumes: `WeightView` (Task 1).
- Produces: navigable `/me/weight`; a `Súly` `NavLink` in `MeSubNav`.

- [ ] **Step 1: Add the route** — in `router.tsx`, add the import and the child (after `goals`):

```tsx
import { WeightView } from '@/features/me/views/WeightView'
```
and inside the `me` route's `children` array, after `{ path: 'goals', element: <GoalsView /> },`:
```tsx
        { path: 'weight', element: <WeightView /> },
```

- [ ] **Step 2: Add the `Súly` tab to `MeSubNav`** — insert into the `SUBNAV` array between `Cél` and `Alvás`:

```tsx
  { to: '/me/goals', label: 'Cél' },
  { to: '/me/weight', label: 'Súly' },
  { to: '/me/sleep', label: 'Alvás' },
```

- [ ] **Step 3: Write the failing nav test** (`MeSubNav.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MeSubNav } from './MeSubNav'

test('MeSubNav exposes a Súly tab linking to /me/weight', () => {
  render(<MemoryRouter><MeSubNav /></MemoryRouter>)
  const link = screen.getByRole('link', { name: 'Súly' })
  expect(link).toHaveAttribute('href', '/me/weight')
})
```

- [ ] **Step 4: Run** — `cd frontend && pnpm test -- MeSubNav` → PASS. (If a broader navigation test in `src/app/navigation.test.tsx` enumerates Me tabs and now fails on the extra tab, update it to include `Súly`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/features/me/MeSubNav.tsx frontend/src/features/me/MeSubNav.test.tsx
git commit -m "feat(fe): /me/weight route + Súly tab (mezo-9sv)"
```

---

### Task 3: Slim `GoalsView` — remove the relocated weight sections

**Files:**
- Modify: `frontend/src/features/me/views/GoalsView.tsx`
- Modify: `frontend/src/features/me/views/GoalsView.test.tsx`

**Interfaces:**
- Consumes: `useGoal()` (`{ goal, linkedMesocycles }`), `useWeight()` (now only `{ weightTrends }` — the hero's Tempó/Vége + insights + factors still read it).
- Produces: a goal-only `GoalsView` (hero + insights + factors + linked mesos), no weight chart/cells/log.

- [ ] **Step 1: Edit `GoalsView.tsx`** — make exactly these removals (everything else stays):
  - Destructure: change `const { weightLog, weightTrends, logWeight } = useWeight()` → `const { weightTrends } = useWeight()`.
  - Remove the `period`/`PERIODS` state and the `Period` type (lines 19-20, 38).
  - Change `const [sheet, setSheet] = useState<'weight' | 'goal' | null>(null)` → `const [sheet, setSheet] = useState<'goal' | null>(null)`.
  - Remove the header `+ Súly` chip button (the `<button className="chip" ... onClick={() => setSheet('weight')}>` block) — the header keeps only the eyebrow + title.
  - Remove the entire **Weight chart** section (the `{/* Weight chart */}` block) and the **Trend bar** section (the `{/* Trend bar */}` block).
  - Remove the `{sheet === 'weight' && (<WeightLogSheet .../>)}` block.
  - Remove now-unused imports: `WeightChart`, `TrendCell`, `WeightLogSheet`.
  - Keep: the goal hero (it still reads `weightTrends.last4w.weeklyRate` for Tempó and `weightTrends.sinceStart` for Vége), the Mezo insights, the Factors, the Linked mesocycles, and the `EditGoalSheet` (`sheet === 'goal'`).

- [ ] **Step 2: Update `GoalsView.test.tsx`** — drop any assertion tied to the moved weight UI (the chart / `7 nap` / `4 hét` trend cells / the `+ Súly` chip). The hero still renders the current weight, so an assertion like line 9 (`getAllByText('78.6')`) stays valid; remove its stale `(hero + chart label)` comment. Add an assertion that the weight **chart/cells no longer render** here, to lock the move:

```tsx
// after rendering GoalsView in mock mode:
expect(screen.queryByText('7 nap')).not.toBeInTheDocument() // trend cells moved to /me/weight
```

> Read the current `GoalsView.test.tsx` fully first; keep its goal-hero/factors/insights/mesos assertions intact, change only the weight-specific ones.

- [ ] **Step 3: Run + type-check**

Run: `cd frontend && pnpm test -- GoalsView && pnpm build`
Expected: PASS. `grep -n "WeightChart\|WeightLogSheet\|TrendCell" src/features/me/views/GoalsView.tsx` returns nothing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/me/views/GoalsView.tsx frontend/src/features/me/views/GoalsView.test.tsx
git commit -m "feat(fe): slim GoalsView — weight sections moved to Súly tab (mezo-9sv)"
```

---

### Task 4: Full gates + docs

**Files:**
- Modify: `docs/features/me.md` (note the new Súly tab + the GoalsView/WeightView split)

- [ ] **Step 1: Run the full FE gates**

```bash
cd frontend
pnpm test                 # real mode (default)
VITE_USE_MOCK=true pnpm test
pnpm build
```
Expected: all PASS. If a mock-mode component/parity test asserted the weight chart inside the Cél screen, update it to the new location (the chart now lives under `/me/weight`).

- [ ] **Step 2: Update `docs/features/me.md`** — in the Me-domain doc, update the views/IA section: `Súly` is now a first-class tab (`/me/weight`, `WeightView`) owning the daily log + trend; `Cél` (`GoalsView`) is goal/strategy only. Use `file:line` pointers (`router.tsx` me children, `MeSubNav.tsx` SUBNAV, `WeightView.tsx`), no pasted code, no changelog. Then run `node scripts/lint-docs.mjs` and confirm `me.md` is clean.

- [ ] **Step 3: Commit**

```bash
git add frontend docs/features/me.md
git commit -m "docs(features): Súly tab IA + green gates (mezo-9sv)"
```

---

## Self-review notes (controller)

- **Spec coverage (D12):** separate `Súly` tab (daily log + trend) ✓ Task 1-2; `Cél` keeps strategy ✓ Task 3.
- **No backend touched** ✓ (reuses G1 `useWeight`).
- **Type consistency:** `WeightChart`/`TrendCell`/`WeightLogSheet` props match their definitions verbatim (Task 1 uses the same prop sets `GoalsView` passed pre-move).
- **Known acceptable coupling:** `WeightView` calls `useGoal()` for the chart's start/target reference lines (same pattern flagged in `mezo-4nu`); acceptable — the goal target line on the weight chart is a real product feature (mockup B). If no active goal exists in real mode, `useGoal` falls back to `mockGoal`, so `goal.startWeight`/`targetWeight` are always defined.

## Post-G2

- **G3** adds `goal_plan_link` (timeline coupling). **G4** restructures `GoalsView` into the command-center timeline. **G5** the engine.
