# WeightView Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `Me · Súly` page into a hero + plan-trajectory trend chart + expandable weekly-history view, frontend-only, both modes green.

**Architecture:** All derivations live in one pure, unit-tested module (`weightStats.ts`). Three pure presentational components (`WeightHero`, `WeightTrendChart`, `WeeklyWeightCard`) consume plain data. `WeightView` is the only stateful node — it calls the existing `useWeight()`/`useGoal()` hooks, runs the selectors, and composes the blocks. No hook-signature, backend, or contract change.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + React Testing Library, inline-style + `prototype.css` class idioms, inline SVG charts.

## Global Constraints

- **Frontend-only.** No edits under `backend/`, `api/`, or `src/data/hooks.ts` (and no change to `useWeight`/`useGoal` return shapes). Verbatim boundary: `useWeight()` → `{ weightLog, weightTrends, logWeight }`; `useGoal()` → `{ goal, goalResponse, … }`.
- **Both modes green:** every change must pass `pnpm test` (real default) **and** `VITE_USE_MOCK=true pnpm test`, plus `pnpm build`.
- **Design tokens only** — no invented colors. Use `var(--brand-glow)`, `var(--success)` (#34D399), `var(--error)` (#F43F5E), `var(--warning)` (#F59E0B = the plan/"gold"), `var(--surface-2)`, `var(--text-*)`, `var(--border-subtle)`, `var(--ff-display|mono)`. Class idioms: `card`, `notch-4|8|12`, `chip`, `cta-primary`, `eyebrow`, `label-mono`, `row`, `flex-1`, `gap-sm`.
- **HU UI copy, EN code/comments.** Driving bd id in every commit subject: `(mezo-l82h)`.
- **Tunables (from spec §9):** `TOLERANCE_KG = 1.0`, MA window `3`, initial `visibleWeeks = 6` step `+6`, weekly delta = avg-to-avg, per-day delta = consecutive-entry, default period `'30d'`.
- Working directory for all commands: `frontend/`. Branch: `feat/weight-view-redesign` (already created; spec already committed).

---

### Task 1: `weightStats.ts` — pure derivations + tests

**Files:**
- Create: `frontend/src/features/me/components/weightStats.ts`
- Test: `frontend/src/features/me/components/weightStats.test.ts`

**Interfaces:**
- Consumes: `WeightEntry`, `WeightTrends`, `GoalKind` from `@/data/types`; `GoalResponse` from `@/lib/goalApi`; `localDateString` from `@/lib/dates`.
- Produces (used by Tasks 2–5):
  - `type Period = '7d' | '30d' | '90d' | '1y'`
  - `type WeekDir = 'down' | 'up' | 'flat'`
  - `interface WeekAggregate { startIso; endIso; entries: WeightEntry[]; avg; low; count; delta: number|null; direction: WeekDir; sparkPoints: number[] }`
  - `interface DayRow { iso: string; value: number; dod: number|null }`
  - `interface PlanTrajectory { plan: { iso: string; kg: number }[]; tolKg: number }`
  - `const TOLERANCE_KG = 1.0`
  - `isoMinusDays(iso, days): string` · `daysBetween(aIso, bIso): number`
  - `latestValue(log): number|null` · `changeFromStart(log, startWeight: number|null): number|null`
  - `progressPct(start, latest, target: number|null): number|null` · `etaWeeks(latest, target: number|null, weeklyRate): number|null`
  - `isImprovement(delta, goalKind?: GoalKind): boolean`
  - `movingAverage(values, win?): number[]`
  - `periodWindow(log, period): { startIso; endIso } | null` · `sliceByPeriod(log, period): WeightEntry[]`
  - `groupByWeek(log): WeekAggregate[]` · `dayRows(log, week): DayRow[]`
  - `planTrajectory(goalResponse: GoalResponse|null, windowStartIso, windowEndIso): PlanTrajectory|null`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/components/weightStats.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  changeFromStart, progressPct, etaWeeks, isImprovement, movingAverage,
  periodWindow, sliceByPeriod, groupByWeek, dayRows, planTrajectory, daysBetween, isoMinusDays,
} from './weightStats'
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/lib/goalApi'

// 3 ISO weeks: May 11–17 (Mon 11), May 18–24 (Mon 18) ... using the mock spine tail.
const log: WeightEntry[] = [
  { date: '2026-05-11', value: 80.3 },
  { date: '2026-05-13', value: 79.5 },
  { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-17', value: 79.0 },
  { date: '2026-05-19', value: 79.4 },
  { date: '2026-05-20', value: 78.9 },
  { date: '2026-05-21', value: 78.8 },
  { date: '2026-05-22', value: 78.6 },
]

test('date helpers', () => {
  expect(daysBetween('2026-05-11', '2026-05-18')).toBe(7)
  expect(isoMinusDays('2026-05-18', 7)).toBe('2026-05-11')
})

test('changeFromStart is signed latest−start; falls back to first log when no goal start', () => {
  expect(changeFromStart(log, 81.4)).toBe(-2.8)      // 78.6 − 81.4
  expect(changeFromStart(log, null)).toBe(-1.7)      // 78.6 − 80.3 (first entry)
  expect(changeFromStart([], 81.4)).toBeNull()
})

test('progressPct cut, bulk, clamp, null', () => {
  expect(progressPct(81.4, 78.6, 73.0)).toBe(33)     // cut: 2.8/8.4
  expect(progressPct(70, 72, 75)).toBe(40)           // bulk: 2/5
  expect(progressPct(81.4, 90, 73.0)).toBe(0)        // clamp low
  expect(progressPct(81.4, 78.6, null)).toBeNull()
  expect(progressPct(80, 79, 80)).toBeNull()         // start==target
})

test('etaWeeks valid only toward target', () => {
  expect(etaWeeks(78.6, 73.0, -0.5)).toBe(11)        // (73−78.6)/−0.5 = 11.2
  expect(etaWeeks(78.6, 73.0, 0.5)).toBeNull()       // moving away
  expect(etaWeeks(78.6, 73.0, 0)).toBeNull()
  expect(etaWeeks(78.6, null, -0.5)).toBeNull()
})

test('isImprovement is goal-direction aware', () => {
  expect(isImprovement(-0.4)).toBe(true)             // default cut: down good
  expect(isImprovement(0.4)).toBe(false)
  expect(isImprovement(0.4, 'bulk')).toBe(true)
})

test('movingAverage trailing window 3', () => {
  expect(movingAverage([1, 2, 3, 4], 3)).toEqual([1, 1.5, 2, 3])
})

test('periodWindow anchors to last entry; sliceByPeriod filters', () => {
  expect(periodWindow(log, '7d')).toEqual({ startIso: '2026-05-16', endIso: '2026-05-22' })
  expect(sliceByPeriod(log, '7d').map(e => e.date)).toEqual(['2026-05-17','2026-05-19','2026-05-20','2026-05-21','2026-05-22'])
  expect(periodWindow([], '7d')).toBeNull()
})

test('groupByWeek: Mon–Sun, newest first, avg/low/delta/direction', () => {
  const w = groupByWeek(log)
  expect(w.map(x => x.startIso)).toEqual(['2026-05-18', '2026-05-11'])  // newest first
  const newest = w[0]
  expect(newest.endIso).toBe('2026-05-24')
  expect(newest.count).toBe(4)
  expect(newest.low).toBe(78.6)
  expect(newest.direction).toBe('down')               // 79.4 → 78.6
  expect(newest.avg).toBeCloseTo(78.9, 1)              // (79.4+78.9+78.8+78.6)/4 = 78.925 (full precision)
  expect(w[1].delta).toBeNull()                        // oldest week has no prev
  expect(newest.delta).toBeCloseTo(-0.58, 1)           // 78.925 − 79.5 (full precision; display rounds to 1dp)
})

test('dayRows: newest first, dod across whole log', () => {
  const w = groupByWeek(log)[0]                        // May 18–24
  const rows = dayRows(log, w)
  expect(rows.map(r => r.iso)).toEqual(['2026-05-22','2026-05-21','2026-05-20','2026-05-19'])
  expect(rows[0].dod).toBe(-0.2)                        // 78.6 − 78.8
  expect(rows[3].dod).toBe(0.4)                         // 79.4 − 79.0 (prev week's last)
})

const goalResponse = {
  startDate: '2026-04-01', targetDate: '2026-08-15',
  startWeightKg: 81.4, targetWeightKg: 73.0,
} as unknown as GoalResponse

test('planTrajectory: linear interp, null when no goal/target', () => {
  expect(planTrajectory(null, '2026-05-01', '2026-05-31')).toBeNull()
  expect(planTrajectory({ ...goalResponse, targetWeightKg: null } as GoalResponse, '2026-05-01', '2026-05-31')).toBeNull()
  const pt = planTrajectory(goalResponse, '2026-05-01', '2026-05-31')!
  expect(pt.tolKg).toBe(1.0)
  expect(pt.plan[0].iso).toBe('2026-05-01')
  expect(pt.plan[pt.plan.length - 1].iso).toBe('2026-05-31')
  // monotonic decreasing toward target
  expect(pt.plan[0].kg).toBeGreaterThan(pt.plan[pt.plan.length - 1].kg)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/weightStats.test.ts`
Expected: FAIL — cannot resolve `./weightStats`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/me/components/weightStats.ts`:

```ts
import type { WeightEntry, GoalKind } from '@/data/types'
import type { GoalResponse } from '@/lib/goalApi'
import { localDateString } from '@/lib/dates'

export type Period = '7d' | '30d' | '90d' | '1y'
export type WeekDir = 'down' | 'up' | 'flat'

export interface WeekAggregate {
  startIso: string
  endIso: string
  entries: WeightEntry[]
  avg: number
  low: number
  count: number
  delta: number | null   // avg − previous week's avg
  direction: WeekDir     // sign(lastEntry − firstEntry) within the week
  sparkPoints: number[]
}
export interface DayRow { iso: string; value: number; dod: number | null }
export interface PlanTrajectory { plan: { iso: string; kg: number }[]; tolKg: number }

export const TOLERANCE_KG = 1.0
const MA_WINDOW = 3
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const isoMinusDays = (iso: string, days: number): string => {
  const d = parseIso(iso)
  d.setDate(d.getDate() - days)
  return localDateString(d)
}
export const daysBetween = (aIso: string, bIso: string): number =>
  Math.round((parseIso(bIso).getTime() - parseIso(aIso).getTime()) / 86_400_000)

export const latestValue = (log: WeightEntry[]): number | null =>
  log.length ? log[log.length - 1].value : null

export function changeFromStart(log: WeightEntry[], startWeight: number | null): number | null {
  const latest = latestValue(log)
  if (latest === null) return null
  const start = startWeight ?? log[0].value
  return +(latest - start).toFixed(1) // signed; negative = lost
}

export function progressPct(start: number, latest: number, target: number | null): number | null {
  if (target === null || start === target) return null
  const pct = target < start
    ? ((start - latest) / (start - target)) * 100   // cut
    : ((latest - start) / (target - start)) * 100   // bulk
  return Math.round(Math.max(0, Math.min(100, pct)))
}

export function etaWeeks(latest: number, target: number | null, weeklyRate: number): number | null {
  if (target === null || weeklyRate === 0) return null
  const weeks = (target - latest) / weeklyRate
  if (!isFinite(weeks) || weeks <= 0) return null
  return Math.max(1, Math.round(weeks))
}

export const isImprovement = (delta: number, goalKind?: GoalKind): boolean =>
  goalKind === 'bulk' ? delta > 0 : delta < 0

export function movingAverage(values: number[], win = MA_WINDOW): number[] {
  return values.map((_, i) => {
    const s = values.slice(Math.max(0, i - win + 1), i + 1)
    return s.reduce((a, x) => a + x, 0) / s.length
  })
}

export function periodWindow(log: WeightEntry[], period: Period): { startIso: string; endIso: string } | null {
  if (!log.length) return null
  const endIso = log[log.length - 1].date
  return { startIso: isoMinusDays(endIso, PERIOD_DAYS[period] - 1), endIso }
}
export function sliceByPeriod(log: WeightEntry[], period: Period): WeightEntry[] {
  const w = periodWindow(log, period)
  return w ? log.filter(e => e.date >= w.startIso && e.date <= w.endIso) : []
}

const mondayOf = (iso: string): string => {
  const d = parseIso(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localDateString(d)
}

export function groupByWeek(log: WeightEntry[]): WeekAggregate[] {
  const byWeek = new Map<string, WeightEntry[]>()
  for (const e of log) {
    const k = mondayOf(e.date)
    const arr = byWeek.get(k) ?? []
    arr.push(e)
    byWeek.set(k, arr)
  }
  const asc = [...byWeek.keys()].sort().map((startIso): WeekAggregate => {
    const entries = byWeek.get(startIso)!
    const values = entries.map(e => e.value)
    // avg & delta are stored at FULL precision (no rounding) so test assertions use
    // toBeCloseTo and the components round for display (avg → toFixed(1), delta → fmtSigned).
    const avg = values.reduce((a, x) => a + x, 0) / values.length
    const diff = values[values.length - 1] - values[0]
    const direction: WeekDir = Math.abs(diff) < 0.05 ? 'flat' : diff < 0 ? 'down' : 'up'
    return { startIso, endIso: isoMinusDays(startIso, -6), entries, avg, low: Math.min(...values), count: entries.length, direction, sparkPoints: values, delta: null }
  })
  for (let i = 1; i < asc.length; i++) asc[i].delta = asc[i].avg - asc[i - 1].avg
  return asc.reverse()
}

export function dayRows(log: WeightEntry[], week: WeekAggregate): DayRow[] {
  const rows: DayRow[] = []
  for (let i = 0; i < log.length; i++) {
    const e = log[i]
    if (e.date >= week.startIso && e.date <= week.endIso) {
      rows.push({ iso: e.date, value: e.value, dod: i > 0 ? +(e.value - log[i - 1].value).toFixed(1) : null })
    }
  }
  return rows.reverse()
}

export function planTrajectory(goalResponse: GoalResponse | null, windowStartIso: string, windowEndIso: string): PlanTrajectory | null {
  if (!goalResponse || goalResponse.targetWeightKg == null) return null
  const { startDate: sIso, targetDate: tIso } = goalResponse
  const sKg = Number(goalResponse.startWeightKg)
  const tKg = Number(goalResponse.targetWeightKg)
  const span = daysBetween(sIso, tIso)
  const kgAt = (iso: string): number => {
    if (span <= 0) return tKg
    const f = Math.max(0, Math.min(1, daysBetween(sIso, iso) / span))
    return +(sKg + f * (tKg - sKg)).toFixed(2)
  }
  const isos = [windowStartIso, windowEndIso]
  if (sIso > windowStartIso && sIso < windowEndIso) isos.push(sIso)
  if (tIso > windowStartIso && tIso < windowEndIso) isos.push(tIso)
  const uniq = [...new Set(isos)].sort()
  return { plan: uniq.map(iso => ({ iso, kg: kgAt(iso) })), tolKg: TOLERANCE_KG }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/weightStats.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/features/me/components/weightStats.ts src/features/me/components/weightStats.test.ts
git commit -m "feat(me): weightStats pure derivations for WeightView redesign (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `WeightHero` component + test

**Files:**
- Create: `frontend/src/features/me/components/WeightHero.tsx`
- Test: `frontend/src/features/me/components/WeightHero.test.tsx`

**Interfaces:**
- Consumes: `weightStats` (`changeFromStart`, `latestValue`, `progressPct`, `etaWeeks`, `isImprovement`); `Icon`; types `WeightEntry`, `WeightTrends`, `Goal`.
- Produces: `WeightHero({ log, weightTrends, goal, onLog })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/components/WeightHero.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { WeightHero } from './WeightHero'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'

const log: WeightEntry[] = [{ date: '2026-04-22', value: 81.4 }, { date: '2026-05-22', value: 78.6 }]
const trends: WeightTrends = { last7d: { avg: 78.96, weeklyRate: -0.5 }, last4w: { weeklyRate: -0.7 } }
const goal = { startWeight: 81.4, currentWeight: 78.6, targetWeight: 73.0, kind: 'cut' } as Goal

test('renders down-from-start, progress, stats, and fires onLog', () => {
  const onLog = vi.fn()
  render(<WeightHero log={log} weightTrends={trends} goal={goal} onLog={onLog} />)
  expect(screen.getByText('Induláshoz képest')).toBeInTheDocument()
  expect(screen.getByText('−2.8')).toBeInTheDocument()
  expect(screen.getByText('✓ 33% a célig')).toBeInTheDocument()
  expect(screen.getByText('Jelenleg')).toBeInTheDocument()
  expect(screen.getByText(/4-hét tempó/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(onLog).toHaveBeenCalledOnce()
})

test('no-goal fallback: no progress pill, ETA dash', () => {
  render(<WeightHero log={log} weightTrends={trends} goal={null} onLog={() => {}} />)
  expect(screen.queryByText(/a célig/)).not.toBeInTheDocument()
  expect(screen.getByText('ETA')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeightHero.test.tsx`
Expected: FAIL — cannot resolve `./WeightHero`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/me/components/WeightHero.tsx`:

```tsx
import { Icon } from '@/components/ui/Icon'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'
import { changeFromStart, latestValue, progressPct, etaWeeks, isImprovement } from './weightStats'

const fmtSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`

export function WeightHero({ log, weightTrends, goal, onLog }: {
  log: WeightEntry[]
  weightTrends: WeightTrends
  goal: Goal | null
  onLog: () => void
}) {
  const latest = latestValue(log)
  const start = goal?.startWeight ?? (log.length ? log[0].value : null)
  const target = goal?.targetWeight ?? null
  const change = changeFromStart(log, goal?.startWeight ?? null)
  const pct = latest !== null && start !== null ? progressPct(start, latest, target) : null
  const rate = weightTrends.last7d.weeklyRate
  const eta = latest !== null ? etaWeeks(latest, target, rate) : null
  const rateColor = Math.abs(rate) < 0.005 ? undefined : isImprovement(rate, goal?.kind) ? 'var(--success)' : 'var(--error)'

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <div className="card notch-12" style={{ padding: '18px 18px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="label-mono" style={{ color: 'var(--text-secondary)' }}>Induláshoz képest</span>
          <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 0.95, color: 'var(--brand-glow)', textShadow: '0 0 26px rgba(94,234,212,0.4)' }}>
              {change === null ? '—' : fmtSigned(change)}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, color: 'var(--text-tertiary)' }}>kg</span>
          </div>
          {latest !== null && start !== null && (
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              {start.toFixed(1)} → <b style={{ color: 'var(--text-primary)' }}>{latest.toFixed(1)}</b>
              {target !== null && <> · cél {target} kg</>}
            </div>
          )}
          {pct !== null && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 14%, transparent)', padding: '4px 10px', borderRadius: 999 }}>
                ✓ {pct}% a célig
              </span>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

        <div className="row gap-sm">
          <Stat value={latest === null ? '—' : latest.toFixed(1)} label="Jelenleg" />
          <Stat value={fmtSigned(rate)} label="7-nap/hét" color={rateColor} />
          <Stat value={eta === null ? '—' : `${eta}h`} label="ETA" />
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span className="label-mono">4-hét tempó {fmtSigned(weightTrends.last4w.weeklyRate)} kg/hét</span>
        </div>

        <button className="cta-primary notch-8" onClick={onLog} style={{ width: '100%', marginTop: 14, padding: 12, justifyContent: 'center' }}>
          <Icon name="plus" size={14} /> Súly naplózása
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 11, textAlign: 'center', background: 'var(--surface-2)' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1, color: color ?? 'var(--text-primary)' }}>{value}</div>
      <div className="label-mono" style={{ marginTop: 4 }}>{label}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeightHero.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/features/me/components/WeightHero.tsx src/features/me/components/WeightHero.test.tsx
git commit -m "feat(me): WeightHero — down-from-start + progress + stat cards (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `WeightTrendChart` component (variant B) + test

**Files:**
- Create: `frontend/src/features/me/components/WeightTrendChart.tsx`
- Test: `frontend/src/features/me/components/WeightTrendChart.test.tsx`

**Interfaces:**
- Consumes: `weightStats` (`periodWindow`, `sliceByPeriod`, `movingAverage`, `planTrajectory`, `daysBetween`, `isoMinusDays`, `Period`); `huMonthDay`; types `WeightEntry`, `GoalResponse`.
- Produces: `WeightTrendChart({ log, goalResponse, period })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/components/WeightTrendChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeightTrendChart } from './WeightTrendChart'
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/lib/goalApi'

const log: WeightEntry[] = [
  { date: '2026-05-11', value: 80.3 }, { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-19', value: 79.4 }, { date: '2026-05-22', value: 78.6 },
]
const goalResponse = {
  startDate: '2026-04-01', targetDate: '2026-08-15', startWeightKg: 81.4, targetWeightKg: 73.0,
} as unknown as GoalResponse

test('renders an svg with the plan legend when a goal exists', () => {
  const { container } = render(<WeightTrendChart log={log} goalResponse={goalResponse} period="30d" />)
  expect(container.querySelector('svg')).toBeInTheDocument()
  expect(screen.getByText('terv')).toBeInTheDocument()
  expect(screen.getByText('tűréssáv')).toBeInTheDocument()
})

test('no goal → actual-only, no plan legend', () => {
  render(<WeightTrendChart log={log} goalResponse={null} period="30d" />)
  expect(screen.queryByText('terv')).not.toBeInTheDocument()
  expect(screen.getByText('tényleges')).toBeInTheDocument()
})

test('insufficient data in window → hint', () => {
  render(<WeightTrendChart log={[{ date: '2026-05-22', value: 78.6 }]} goalResponse={null} period="7d" />)
  expect(screen.getByText(/Kevés mérés/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeightTrendChart.test.tsx`
Expected: FAIL — cannot resolve `./WeightTrendChart`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/me/components/WeightTrendChart.tsx`:

```tsx
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/lib/goalApi'
import { huMonthDay } from '@/lib/dates'
import { periodWindow, sliceByPeriod, movingAverage, planTrajectory, daysBetween, isoMinusDays, type Period } from './weightStats'

const W = 360, H = 172
const PX0 = 34, PX1 = 352, PY0 = 12, PY1 = 128

const path = (p: { x: number; y: number }[]): string =>
  p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')

export function WeightTrendChart({ log, goalResponse, period }: {
  log: WeightEntry[]
  goalResponse: GoalResponse | null
  period: Period
}) {
  const win = periodWindow(log, period)
  const data = sliceByPeriod(log, period)
  if (!win || data.length < 2) {
    return (
      <div className="card notch-12" style={{ padding: 24, textAlign: 'center' }}>
        <span className="label-mono" style={{ color: 'var(--text-tertiary)' }}>Kevés mérés ehhez az ablakhoz</span>
      </div>
    )
  }
  const plan = planTrajectory(goalResponse, win.startIso, win.endIso)
  const totalDays = Math.max(1, daysBetween(win.startIso, win.endIso))
  const xForIso = (iso: string): number => PX0 + (daysBetween(win.startIso, iso) / totalDays) * (PX1 - PX0)

  const ys: number[] = data.map(d => d.value)
  if (plan) for (const p of plan.plan) ys.push(p.kg + plan.tolKg, p.kg - plan.tolKg)
  let minV = Math.min(...ys) - 0.5
  let maxV = Math.max(...ys) + 0.5
  if (maxV - minV < 1) { maxV += 0.5; minV -= 0.5 }
  const yFor = (v: number): number => PY0 + (1 - (v - minV) / (maxV - minV)) * (PY1 - PY0)

  const pts = data.map(d => ({ x: xForIso(d.date), y: yFor(d.value) }))
  const ma = movingAverage(data.map(d => d.value))
  const maPts = data.map((d, i) => ({ x: xForIso(d.date), y: yFor(ma[i]) }))
  const areaPath = `${path(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${PY1} L ${pts[0].x.toFixed(1)} ${PY1} Z`

  let bandPath = '', planPath = ''
  if (plan) {
    const up = plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg + plan.tolKg) }))
    const dn = plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg - plan.tolKg) })).reverse()
    bandPath = `${path(up)} ${dn.map(q => `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')} Z`
    planPath = path(plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg) })))
  }

  const yTicks = [maxV - 0.5, (maxV + minV) / 2, minV + 0.5].map(v => ({ label: (Math.round(v * 10) / 10).toString(), y: yFor(v) }))
  const midIso = isoMinusDays(win.endIso, Math.floor(totalDays / 2))
  const xLabels = [{ iso: win.startIso, x: PX0 }, { iso: midIso, x: xForIso(midIso) }, { iso: win.endIso, x: PX1 }]
  const last = pts[pts.length - 1]
  const lastVal = data[data.length - 1].value

  return (
    <div className="card notch-12" style={{ padding: '14px 12px 10px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="wtc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-glow)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PX0} x2={PX1} y1={t.y} y2={t.y} stroke="var(--border-subtle)" strokeDasharray="3 4" />
            <text x={PX0 - 4} y={t.y + 3} fontFamily="var(--ff-mono)" fontSize="9" fill="var(--text-tertiary)" textAnchor="end">{t.label}</text>
          </g>
        ))}

        {plan && <path d={bandPath} fill="color-mix(in srgb, var(--warning) 14%, transparent)" />}
        {plan && <path d={planPath} fill="none" stroke="var(--warning)" strokeWidth="1.6" strokeDasharray="5 4" />}

        <path d={areaPath} fill="url(#wtc-area)" />
        <path d={path(pts)} fill="none" stroke="var(--brand-glow)" strokeWidth="1" opacity="0.4" strokeLinejoin="round" />
        <path d={path(maPts)} fill="none" stroke="var(--brand-glow)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px var(--brand-glow))' }} />

        <circle cx={last.x} cy={last.y} r="4.5" fill="var(--brand-glow)" stroke="var(--canvas)" strokeWidth="2" />
        <text x={last.x - 8} y={last.y - 8} fontFamily="var(--ff-mono)" fontSize="11" fontWeight="600" fill="var(--brand-glow)" textAnchor="end">{lastVal.toFixed(1)}</text>

        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} fontFamily="var(--ff-mono)" fontSize="9" fill="var(--text-tertiary)"
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{huMonthDay(l.iso)}</text>
        ))}
      </svg>

      <div className="row gap-md" style={{ marginTop: 6, flexWrap: 'wrap', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
        <span className="row" style={{ gap: 5 }}><i style={{ width: 14, borderTop: '2px solid var(--brand-glow)' }} /> tényleges</span>
        {plan && <span className="row" style={{ gap: 5 }}><i style={{ width: 14, borderTop: '2px dashed var(--warning)' }} /> terv</span>}
        {plan && <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 10, background: 'color-mix(in srgb, var(--warning) 18%, transparent)', borderRadius: 2 }} /> tűréssáv</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeightTrendChart.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/features/me/components/WeightTrendChart.tsx src/features/me/components/WeightTrendChart.test.tsx
git commit -m "feat(me): WeightTrendChart — actual + plan trajectory + tolerance band (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `WeeklyWeightCard` component + test

**Files:**
- Create: `frontend/src/features/me/components/WeeklyWeightCard.tsx`
- Test: `frontend/src/features/me/components/WeeklyWeightCard.test.tsx`

**Interfaces:**
- Consumes: `weightStats` (`isImprovement`, types `WeekAggregate`, `DayRow`); `Icon`; `huMonthDay`, `huMonthDayDow`; `GoalKind`.
- Produces: `WeeklyWeightCard({ week, dayRows, expanded, onToggle, goalKind })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/components/WeeklyWeightCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { WeeklyWeightCard } from './WeeklyWeightCard'
import type { WeekAggregate, DayRow } from './weightStats'

const week: WeekAggregate = {
  startIso: '2026-05-18', endIso: '2026-05-24', entries: [], avg: 78.9, low: 78.6, count: 4,
  delta: -0.5, direction: 'down', sparkPoints: [79.4, 78.9, 78.8, 78.6],
}
const rows: DayRow[] = [
  { iso: '2026-05-22', value: 78.6, dod: -0.2 },
  { iso: '2026-05-19', value: 79.4, dod: 0.4 },
]

test('collapsed shows range, avg, delta, direction; toggle fires', () => {
  const onToggle = vi.fn()
  render(<WeeklyWeightCard week={week} dayRows={[]} expanded={false} onToggle={onToggle} goalKind="cut" />)
  expect(screen.getByText('Máj 18–24')).toBeInTheDocument()
  expect(screen.getByText('78.9')).toBeInTheDocument()
  expect(screen.getByText('−0.5 kg')).toBeInTheDocument()
  expect(screen.getByText(/lefelé/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Máj 18–24/ }))
  expect(onToggle).toHaveBeenCalledOnce()
})

test('expanded shows per-day rows', () => {
  render(<WeeklyWeightCard week={week} dayRows={rows} expanded onToggle={() => {}} goalKind="cut" />)
  expect(screen.getByText('Máj 22 · Pén')).toBeInTheDocument()
  expect(screen.getByText('−0.2')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeeklyWeightCard.test.tsx`
Expected: FAIL — cannot resolve `./WeeklyWeightCard`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/me/components/WeeklyWeightCard.tsx`:

```tsx
import { Icon } from '@/components/ui/Icon'
import { huMonthDay, huMonthDayDow } from '@/lib/dates'
import type { GoalKind } from '@/data/types'
import { isImprovement, type WeekAggregate, type DayRow } from './weightStats'

const DIR_LABEL: Record<WeekAggregate['direction'], string> = { down: '↓ lefelé', up: '↑ felfelé', flat: '→ stabil' }
const fmtSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`

function rangeLabel(startIso: string, endIso: string): string {
  const sameMonth = startIso.slice(5, 7) === endIso.slice(5, 7)
  return sameMonth ? `${huMonthDay(startIso)}–${Number(endIso.slice(8, 10))}` : `${huMonthDay(startIso)}–${huMonthDay(endIso)}`
}

// mini sparkline path over the week's points, drawn in a 300×34 box
function spark(points: number[]): { line: string; area: string } {
  if (points.length < 2) return { line: '', area: '' }
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1
  const xs = (i: number) => 4 + (i / (points.length - 1)) * 292
  const ys = (v: number) => 4 + (1 - (v - min) / range) * 26
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')
  return { line, area: `${line} L296 34 L4 34 Z` }
}

export function WeeklyWeightCard({ week, dayRows, expanded, onToggle, goalKind }: {
  week: WeekAggregate
  dayRows: DayRow[]
  expanded: boolean
  onToggle: () => void
  goalKind?: GoalKind
}) {
  const deltaColor = week.delta === null || Math.abs(week.delta) < 0.005 ? 'var(--text-tertiary)'
    : isImprovement(week.delta, goalKind) ? 'var(--success)' : 'var(--error)'
  const dirGood = week.direction !== 'flat' && isImprovement(week.direction === 'down' ? -1 : 1, goalKind)
  const sp = spark(week.sparkPoints)

  return (
    <div className="card notch-12" style={{ padding: 14, marginBottom: 10 }}>
      <button onClick={onToggle} aria-expanded={expanded} className="row" style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <span className="label-mono" style={{ fontSize: 10 }}>{rangeLabel(week.startIso, week.endIso)}</span>
        <span className="row" style={{ gap: 8 }}>
          {week.delta !== null && (
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 600, color: deltaColor, background: 'color-mix(in srgb, currentColor 12%, transparent)', padding: '3px 8px', borderRadius: 999 }}>
              {fmtSigned(week.delta)} kg
            </span>
          )}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </span>
      </button>

      <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600 }}>{week.avg.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>kg átlag · {week.count} bejegyzés · min {week.low}</span>
      </div>

      <svg viewBox="0 0 300 34" width="100%" height="34" style={{ display: 'block', marginTop: 8 }}>
        <path d={sp.area} fill="url(#wtc-area)" />
        <path d={sp.line} fill="none" stroke="var(--brand-glow)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="label-mono" style={{ letterSpacing: '2px' }}>H K Sz Cs P Sz V</span>
        <span className="label-mono" style={{ color: dirGood ? 'var(--success)' : 'var(--text-tertiary)' }}>{DIR_LABEL[week.direction]}</span>
      </div>

      {expanded && (
        <div className="col gap-sm" style={{ marginTop: 12 }}>
          {dayRows.map(r => {
            const c = r.dod === null || Math.abs(r.dod) < 0.005 ? 'var(--text-tertiary)' : isImprovement(r.dod, goalKind) ? 'var(--success)' : 'var(--error)'
            return (
              <div key={r.iso} className="card notch-4 row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{huMonthDayDow(r.iso)}</span>
                <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                  <b style={{ fontFamily: 'var(--ff-display)', fontSize: 16 }}>{r.value}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>kg</span>
                  {r.dod !== null && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: c }}>{fmtSigned(r.dod)}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

> Note: the sparkline reuses the `url(#wtc-area)` gradient defined by `WeightTrendChart`'s `<defs>`. `WeightView` always renders the chart above the week list, so the gradient id is present in the DOM. (In isolated component tests the fill simply resolves to none — harmless.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/WeeklyWeightCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/features/me/components/WeeklyWeightCard.tsx src/features/me/components/WeeklyWeightCard.test.tsx
git commit -m "feat(me): WeeklyWeightCard — weekly aggregate + expandable day rows (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rewire `WeightView` + update its test + delete retired components

**Files:**
- Modify: `frontend/src/features/me/views/WeightView.tsx` (full rewrite)
- Modify: `frontend/src/features/me/views/WeightView.test.tsx` (full rewrite)
- Delete: `frontend/src/features/me/components/WeightChart.tsx`, `frontend/src/features/me/components/TrendCell.tsx`

**Interfaces:**
- Consumes: `useWeight`, `useGoal` (existing); `WeightHero`, `WeightTrendChart`, `WeeklyWeightCard`, `weightStats` (`groupByWeek`, `dayRows`, `Period`); `WeightLogSheet`, `Eyebrow`, `PageTitle`, `Icon`.
- Produces: the `WeightView` route component (no exported API change).

- [ ] **Step 1: Write the failing test**

Replace `frontend/src/features/me/views/WeightView.test.tsx` with:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeightView } from './WeightView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the hero, trend chart, weekly history, and opens the log sheet', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('Induláshoz képest')).toBeInTheDocument()
  expect(screen.getByText('Jelenleg')).toBeInTheDocument()
  expect(screen.getByText('Heti előzmény')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument()
})

test('newest week is expanded by default and a day row is visible', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  // mock spine ends 2026-05-22 (Fri); huMonthDayDow → "Máj 22 · Pén"
  expect(screen.getByText('Máj 22 · Pén')).toBeInTheDocument()
})

test('real mode: the 7-nap/hét stat reads the backend EWMA weekly rate', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])), // empty log → the stat value is unique
    http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
      HttpResponse.json({
        ewmaSeries: [{ date: '2026-06-01', trendKg: 81.3 }],
        latestTrendKg: 81.3, weeklyRateKgPerWeek: -0.5, weeklyRatePctPerWeek: -0.62,
        last4wRateKgPerWeek: -0.7, dataSufficiency: 'full',
      }),
    ),
  )
  render(<WeightView />, { wrapper: QueryWrapper })
  await waitFor(() => expect(screen.getByText('−0.5')).toBeInTheDocument()) // hero 7-nap/hét = fmtSigned(-0.5)
})
```

> The real-mode assertion targets the hero `7-nap/hét` stat (`fmtSigned(-0.5)` → `−0.5`). The weight list is stubbed empty so the hero shows `—`/`Jelenleg` and the chart hint (no other `−0.5` on the page); the trend stat still renders once the EWMA query resolves.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/views/WeightView.test.tsx`
Expected: FAIL — new assertions (`Induláshoz képest`, `Heti előzmény`, `Máj 22 · Pén`) not present in the old view.

- [ ] **Step 3: Write the implementation**

Replace `frontend/src/features/me/views/WeightView.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useGoal, useWeight } from '@/data/hooks'
import { WeightHero } from '../components/WeightHero'
import { WeightTrendChart } from '../components/WeightTrendChart'
import { WeeklyWeightCard } from '../components/WeeklyWeightCard'
import { groupByWeek, dayRows, type Period } from '../components/weightStats'
import { WeightLogSheet } from '../WeightLogSheet'

const PERIODS: Period[] = ['7d', '30d', '90d', '1y']
const WEEK_STEP = 6

export function WeightView() {
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { goal, goalResponse } = useGoal()
  const [period, setPeriod] = useState<Period>('30d')
  const [logOpen, setLogOpen] = useState(false)
  // undefined = "use default (newest week expanded)"; a concrete iso or null after the first toggle.
  const [expandedIso, setExpandedIso] = useState<string | null | undefined>(undefined)
  const [visibleWeeks, setVisibleWeeks] = useState(WEEK_STEP)

  const weeks = useMemo(() => groupByWeek(weightLog), [weightLog])
  const effectiveExpanded = expandedIso === undefined ? (weeks[0]?.startIso ?? null) : expandedIso
  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : (goal?.currentWeight ?? 0)

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Súly</Eyebrow>
          <PageTitle className="mt-sm">Napi súly</PageTitle>
        </div>
      </div>

      <WeightHero log={weightLog} weightTrends={weightTrends} goal={goal} onLog={() => setLogOpen(true)} />

      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Súly · trend</Eyebrow>
          <div className="row gap-xs">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={'chip' + (period === p ? ' brand' : '')} style={{ fontSize: 9, padding: '3px 8px' }}>{p}</button>
            ))}
          </div>
        </div>
        <WeightTrendChart log={weightLog} goalResponse={goalResponse} period={period} />
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Heti előzmény</Eyebrow>
          {weeks.length > 0 && <span className="label-mono">{Math.min(visibleWeeks, weeks.length)} / {weeks.length} hét</span>}
        </div>
        {weeks.slice(0, visibleWeeks).map(week => (
          <WeeklyWeightCard
            key={week.startIso}
            week={week}
            dayRows={effectiveExpanded === week.startIso ? dayRows(weightLog, week) : []}
            expanded={effectiveExpanded === week.startIso}
            onToggle={() => setExpandedIso(effectiveExpanded === week.startIso ? null : week.startIso)}
            goalKind={goal?.kind}
          />
        ))}
        {weeks.length > visibleWeeks && (
          <button className="chip" onClick={() => setVisibleWeeks(v => v + WEEK_STEP)} style={{ width: '100%', justifyContent: 'center', padding: 11, marginTop: 2 }}>
            Régebbi hetek <Icon name="chevron-down" size={12} />
          </button>
        )}
      </div>

      {logOpen && <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest} />}
    </>
  )
}
```

- [ ] **Step 4: Delete the retired components**

```bash
cd frontend && git rm src/features/me/components/WeightChart.tsx src/features/me/components/TrendCell.tsx
```

- [ ] **Step 5: Run the view test + both-mode suites to verify green**

Run: `cd frontend && pnpm vitest run src/features/me/views/WeightView.test.tsx`
Expected: PASS (3 tests).
Then confirm nothing else imported the deleted files:
Run: `cd frontend && pnpm vitest run src/features/me`
Expected: PASS (no "cannot resolve WeightChart/TrendCell" errors).

- [ ] **Step 6: Commit**

```bash
cd frontend && git add -A src/features/me
git commit -m "feat(me): rewire WeightView to hero + trend chart + weekly history; retire WeightChart/TrendCell (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Feature doc + full quality gates + close

**Files:**
- Modify: `docs/features/me.md` (Súly section)
- Run: doc lint, both-mode tests, build, parity.

- [ ] **Step 1: Update the feature doc**

Open `docs/features/me.md`, find the **Súly / WeightView** section (grep `WeightView` / `WeightChart` / `TrendCell`). Update it to describe the new structure (overwrite in place — git is the history):
- Súly view = `WeightHero` (down-from-start, progress %, stat cards Jelenleg/7-nap-hét/ETA, 4-week pace caption, log CTA) + `WeightTrendChart` (actual + smoothed MA + plan trajectory + tolerance band from `goalResponse`, `7d/30d/90d/1y`, graceful actual-only fallback) + `WeeklyWeightCard` list (ISO-week aggregates, expandable per-day rows, "Régebbi hetek" load-more).
- New pure module `components/weightStats.ts` holds all derivations; point to it with `file:line` pointers for §4/§10 of the doc.
- Note `WeightChart`/`TrendCell` were retired. Update the doc's `key_files` frontmatter list to drop those two and add `weightStats.ts`, `WeightHero.tsx`, `WeightTrendChart.tsx`, `WeeklyWeightCard.tsx`.

- [ ] **Step 2: Lint docs (clears staleness flag)**

Run: `node scripts/lint-docs.mjs`
Expected: no errors for `docs/features/me.md` (no broken links / orphans / staleness).

- [ ] **Step 3: Full test gates — BOTH modes**

Run: `cd frontend && pnpm test`
Expected: PASS (real default).
Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Expected: PASS (mock).

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && pnpm build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 5: Parity screenshot refresh**

Run: `cd frontend && pnpm parity`
Expected: completes; review the Súly route screenshot visually matches the redesign (hero, chart with plan band, weekly cards). Commit any updated baseline.

- [ ] **Step 6: Commit + close**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add docs/features/me.md frontend
git commit -m "docs(me): WeightView redesign feature-doc + parity baseline (mezo-l82h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
bd close mezo-l82h "WeightView redesign shipped: hero + plan-trajectory trend chart + expandable weekly history; weightStats pure module; both modes green"
```

Then merge to main per the project git workflow (`--no-ff`), push, and `bd dolt push`.

---

## Self-Review

**Spec coverage:**
- §1 hero/chart/weeks → Tasks 2/3/4; rewire → Task 5; doc + gates → Task 6. ✓
- §3 every helper (`changeFromStart`, `progressPct`, `etaWeeks`, `isImprovement`, `movingAverage`, `periodWindow`/`sliceByPeriod`, `groupByWeek`, `dayRows`, `planTrajectory`, date utils) → Task 1, each with a test. ✓
- §4 components with exact props → Tasks 2–4; §4d WeightView state model (period/expandedIso/visibleWeeks/logOpen) → Task 5. ✓
- §5 single stateful node → Task 5. ✓
- §6 edge cases: empty/1-entry log (hero `—`, chart hint) covered by chart Task 3 test + hero null-goal test; no-goal fallback (Task 2/3 tests); ZERO-trend brief window (real-mode behavior, benign). ✓
- §7 testing: `weightStats.test.ts` (Task 1), `WeightView.test.tsx` both modes (Task 5), build + both-mode + parity (Task 6). ✓
- §8 file map matches Tasks 1–5 creates + Task 5 deletes. ✓
- §9 tunables encoded as named consts (`TOLERANCE_KG`, `MA_WINDOW`, `WEEK_STEP`, default `'30d'`). ✓

**Placeholder scan:** none — every step has full code/commands.

**Type consistency:** `Period`, `WeekAggregate`, `DayRow`, `PlanTrajectory`, `isImprovement`, `groupByWeek`, `dayRows`, `planTrajectory`, `periodWindow`/`sliceByPeriod` names are identical across Tasks 1→3→4→5. `WeightHero`/`WeightTrendChart`/`WeeklyWeightCard` prop names match their consumers in Task 5. `goalResponse` typed `GoalResponse | null` end-to-end.
