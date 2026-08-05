# Live Zone Unification Implementation Plan (mezo-oyhy.7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared zone-bar language across surfaces: a live (done → today → plan) weekly zone card on the workout prep screen and live mini zone bars on the GYM tab meta card, both built on a shared `ZoneTrack` primitive that `SetBudgetCard` also adopts with zero visual change.

**Architecture:** Pure client-side. New logic module `weekZone.ts` (projects logged + planned sets onto the existing budget scale, reusing `setBudget.ts` exports), new data hook `useWeekMuscleLog` (details of this week's completed workout instances via `useQueries`, mock = empty), new presentational `ZoneTrack` primitive + two consumer components (`WeekZoneCard`, `ZoneMiniGrid`). No backend/API change. Spec: `docs/superpowers/specs/2026-08-04-live-zone-unification-design.md`.

**Tech Stack:** React 19 + TypeScript, TanStack Query (`useQueries`), Vitest + Testing Library + msw. All under `frontend/`.

## Global Constraints

- Read `docs/references/frontend_conventions.md` first; it is the house standard.
- Imports deep + absolute via `@/*`; never relative `../`; no new barrels (only `data/hooks.ts` re-export line).
- Colors ONLY as `var(--…)` / `color-mix(...)` — no raw hex/rgba in components.
- UI copy Hungarian exactly as specified; code/comments/commits English.
- Commit subjects conventional with the bd id, e.g. `feat(train): ... (mezo-oyhy.7)`.
- Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2`, branch `feat/live-zone-unify` (already checked out — do NOT create branches).
- Run ONLY the focused frontend tests named per task; NEVER the backend suite (`./mvnw`), never `pnpm dev`. The full gate runs once, in Task 5.
- Data-flow invariants: plyo exercises never enter zone math; logged sets count only when `!set.skipped && (set.kind ?? 'working') === 'working'`; logged-set style prices by `setStyle(set.rir ?? exercise.targetRIR)`; custom-origin workouts count in the bars but NOT in the `kész n/m edzés` day counts (meso-origin only).
- The repo pre-commit hook may force-add a root-level `issues.jsonl`. After every commit run `git show --stat HEAD`; if `issues.jsonl` (repo root, NOT `.beads/issues.jsonl`) appears, fix with `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify`.

---

### Task 1: `weekZone.ts` — live week zone logic

**Files:**
- Create: `frontend/src/features/train/logic/weekZone.ts`
- Test: `frontend/src/features/train/logic/weekZone.test.ts`

**Interfaces:**
- Consumes (all existing, from `@/features/train/logic/setBudget`): `GROUP_MEV`, `BUDGET_GROUP_LABELS`, `budgetGroup(muscle)`, `budgetOf(failure, volume)`, `setStyle(rir)`, `muscleBudgets(days)`; types `MesoDay`, `ExerciseKind` from `@/data/types`; type `WorkoutDetailResponse` from `@/data/train/trainApi`.
- Produces (later tasks rely on these exact names):
  - `export interface ZoneSegment { pct: number; kind: 'solid' | 'today' | 'ghost' | 'overflow' }`
  - `export interface TodayPlanExercise { muscle: string; type: ExerciseKind; workingSets: number; targetRIR: number }`
  - `export type WeekZoneStatus = 'below' | 'entering' | 'in' | 'over'`
  - `export interface WeekZoneRow { group: string; label: string; colorMuscle: string; mev: number | null; zoneStart: number | null; doneSets: number; todaySets: number; plannedSets: number; doneBudget: number; todayBudget: number; planBudget: number; status: WeekZoneStatus }`
  - `export function weekZoneRows(args: { plannedDays: MesoDay[]; completed: WorkoutDetailResponse[]; todayPlan?: TodayPlanExercise[] | null }): WeekZoneRow[]`
  - `export function selectPrepRows(rows: WeekZoneRow[]): WeekZoneRow[]`
  - `export function selectGymRows(rows: WeekZoneRow[]): WeekZoneRow[]`
  - `export function prepSegments(row: WeekZoneRow): ZoneSegment[]`
  - `export function gymSegments(row: WeekZoneRow): ZoneSegment[]`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/logic/weekZone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import {
  gymSegments, prepSegments, selectGymRows, selectPrepRows, weekZoneRows,
} from '@/features/train/logic/weekZone'

const ex = (muscle: string, workingSets: number, targetRIR: number): GymExercise => ({
  id: `${muscle}-${workingSets}-${targetRIR}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound',
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })

// Minimal completed-instance builder. `sets` are logged working sets; rir per set.
let uid = 0
const detail = (exs: { muscle: string; type?: 'compound' | 'isolation' | 'plyo'; targetRIR?: number; setRirs: (number | undefined)[]; skippedSets?: number }[]): WorkoutDetailResponse => ({
  id: `w-${uid++}`, templateSessionId: 't1', date: '2026-08-03', status: 'completed',
  title: 'Push Day', dayLabel: 'Hét',
  exercises: exs.map((e, i) => ({
    exerciseId: `e-${i}`, name: 'X', muscle: e.muscle, type: e.type ?? 'compound',
    warmupSets: 1, workingSets: e.setRirs.length, repMin: 8, repMax: 10,
    targetRIR: e.targetRIR ?? 2, skipped: false,
    sets: [
      ...e.setRirs.map((rir, j) => ({ id: `s-${i}-${j}`, exerciseId: `e-${i}`, setIndex: j, reps: 8, skipped: false, kind: 'working' as const, ...(rir === undefined ? {} : { rir }) })),
      ...Array.from({ length: e.skippedSets ?? 0 }, (_, j) => ({ id: `sk-${i}-${j}`, exerciseId: `e-${i}`, setIndex: 90 + j, skipped: true })),
    ],
  })),
})

describe('weekZoneRows — done aggregation', () => {
  it('prices each logged set by its own RIR, falling back to the exercise targetRIR', () => {
    // 2 sets at RIR 0 (failure, 1/12 each) + 1 set at RIR 3 (volume, 1/20) + 1 set without rir → exercise targetRIR 2 → volume
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'chest', targetRIR: 2, setRirs: [0, 0, 3, undefined] }])] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ group: 'chest', doneSets: 4 })
    expect(rows[0].doneBudget).toBeCloseTo(2 / 12 + 2 / 20)
  })
  it('ignores skip-marker rows and plyo exercises', () => {
    const rows = weekZoneRows({
      plannedDays: [],
      completed: [detail([
        { muscle: 'quad', setRirs: [1, 1], skippedSets: 3 },
        { muscle: 'quad', type: 'plyo', setRirs: [0, 0, 0] },
      ])],
    })
    expect(rows[0]).toMatchObject({ group: 'quad', doneSets: 2 })
  })
  it('counts custom-workout sets toward the group like any other instance', () => {
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'biceps-long', setRirs: [1] }]), detail([{ muscle: 'biceps', setRirs: [1] }])] })
    expect(rows[0]).toMatchObject({ group: 'biceps', doneSets: 2 })
  })
})

describe('weekZoneRows — status boundaries', () => {
  const planned = [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])]
  it('entering exactly when today reaches the MEV floor (chest MEV 4)', () => {
    const todayPlan = [{ muscle: 'chest-mid', type: 'compound' as const, workingSets: 3, targetRIR: 2 }]
    const below = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [] }])], todayPlan: [{ ...todayPlan[0], workingSets: 3 }] })
    expect(below[0].status).toBe('below') // 0 done + 3 today < 4
    const entering = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [2] }])], todayPlan })
    expect(entering[0].status).toBe('entering') // 1 done + 3 today = 4
  })
  it('in once done alone reaches MEV; over past 100% budget', () => {
    const inRow = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2] }])] })
    expect(inRow[0].status).toBe('in')
    const overRow = weekZoneRows({
      plannedDays: planned,
      completed: [detail([{ muscle: 'chest', setRirs: Array.from({ length: 11 }, () => 0) }])], // 11/12
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 4, targetRIR: 0 }], // +4/12 → 1.25
    })
    expect(overRow[0].status).toBe('over')
  })
  it('traps/core never report below/entering', () => {
    const rows = weekZoneRows({ plannedDays: [day('Hét', [ex('traps', 2, 2)])], completed: [], todayPlan: [{ muscle: 'traps', type: 'isolation', workingSets: 2, targetRIR: 2 }] })
    expect(rows[0]).toMatchObject({ group: 'traps', mev: null, zoneStart: null, status: 'in' })
  })
})

describe('weekZoneRows — zone projection reference', () => {
  it('uses the weekly plan mix when a plan exists (chest 10 volume sets planned, MEV 4 → 20%)', () => {
    const rows = weekZoneRows({ plannedDays: [day('Hét', [ex('chest-mid', 10, 2)])], completed: [] })
    expect(rows[0].zoneStart).toBeCloseTo((10 / 20) * 4 / 10)
  })
  it('falls back to done+today mix for plan-less (custom-only) groups', () => {
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'chest', setRirs: [0, 0, 0, 0, 0] }])] })
    expect(rows[0].zoneStart).toBeCloseTo((5 / 12) * 4 / 5) // pure failure mix
  })
})

describe('row selection', () => {
  const planned = [day('Hét', [ex('chest-mid', 6, 2), ex('quad', 4, 2)])]
  const todayPlan = [{ muscle: 'chest-mid', type: 'compound' as const, workingSets: 6, targetRIR: 2 }]
  it('selectPrepRows keeps only groups trained today, ordered by today contribution', () => {
    const rows = selectPrepRows(weekZoneRows({ plannedDays: planned, completed: [], todayPlan }))
    expect(rows.map((r) => r.group)).toEqual(['chest'])
  })
  it('selectGymRows keeps planned OR done groups, ordered by plan budget desc', () => {
    const rows = selectGymRows(weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'biceps', setRirs: [1] }])] }))
    expect(rows.map((r) => r.group)).toEqual(['chest', 'quad', 'biceps'])
  })
})

describe('segments', () => {
  it('prepSegments: done solid + today dashed + plan ghost, widths in budget units', () => {
    const rows = weekZoneRows({
      plannedDays: [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])],
      completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2, 2] }])],
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 5, targetRIR: 2 }],
    })
    expect(prepSegments(rows[0])).toEqual([
      { pct: expect.closeTo(0.25, 5), kind: 'solid' },
      { pct: expect.closeTo(0.25, 5), kind: 'today' },
    ])
  })
  it('prepSegments: the today segment turns overflow and everything caps at 100% when over', () => {
    const rows = weekZoneRows({
      plannedDays: [],
      completed: [detail([{ muscle: 'chest', setRirs: Array.from({ length: 11 }, () => 0) }])],
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 4, targetRIR: 0 }],
    })
    const segs = prepSegments(rows[0])
    expect(segs[0]).toEqual({ pct: expect.closeTo(11 / 12, 5), kind: 'solid' })
    expect(segs[1].kind).toBe('overflow')
    expect(segs[0].pct + segs[1].pct).toBeCloseTo(1)
  })
  it('gymSegments: done solid + plan-remainder ghost, no today segment', () => {
    const rows = weekZoneRows({
      plannedDays: [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])],
      completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2, 2] }])],
    })
    expect(gymSegments(rows[0])).toEqual([
      { pct: expect.closeTo(0.25, 5), kind: 'solid' },
      { pct: expect.closeTo(0.25, 5), kind: 'ghost' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/weekZone.test.ts`
Expected: FAIL — module `weekZone` does not exist.

- [ ] **Step 3: Implement `weekZone.ts`**

```ts
// ============================================================
// Mezo · weekZone — live weekly zone rows for mid-cycle surfaces
// (mezo-oyhy.7, spec 2026-08-04). Projects the week's LOGGED sets
// (completed workout instances, meso + custom), TODAY's session plan,
// and the weekly meso plan onto the shared budget scale (budgetOf
// units, GROUP_MEV zone floors from setBudget). Pure derivations —
// consumed by WeekZoneCard (prep screen) and ZoneMiniGrid (GymPage).
// Logged sets price by their own RIR (fallback: exercise targetRIR);
// skip-marker and warmup rows are excluded, plyo exercises never count.
// ============================================================
import type { ExerciseKind, MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import {
  BUDGET_GROUP_LABELS, GROUP_MEV, budgetGroup, budgetOf, muscleBudgets, setStyle,
} from '@/features/train/logic/setBudget'

export interface ZoneSegment { pct: number; kind: 'solid' | 'today' | 'ghost' | 'overflow' }

export interface TodayPlanExercise { muscle: string; type: ExerciseKind; workingSets: number; targetRIR: number }

export type WeekZoneStatus = 'below' | 'entering' | 'in' | 'over'

export interface WeekZoneRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor(). */
  colorMuscle: string
  mev: number | null
  /** Green-zone start on the budget scale (0..1); null when mev is. */
  zoneStart: number | null
  doneSets: number
  todaySets: number
  plannedSets: number
  doneBudget: number
  todayBudget: number
  planBudget: number
  status: WeekZoneStatus
}

interface StyleAcc { failure: number; volume: number; colorMuscle: string }

function bump(map: Map<string, StyleAcc>, group: string, muscle: string, style: 'failure' | 'volume', sets: number) {
  let acc = map.get(group)
  if (!acc) { acc = { failure: 0, volume: 0, colorMuscle: muscle }; map.set(group, acc) }
  acc[style] += sets
}

export function weekZoneRows({ plannedDays, completed, todayPlan }: {
  plannedDays: MesoDay[]
  completed: WorkoutDetailResponse[]
  todayPlan?: TodayPlanExercise[] | null
}): WeekZoneRow[] {
  const done = new Map<string, StyleAcc>()
  for (const w of completed) {
    for (const wx of w.exercises) {
      if (wx.type === 'plyo') continue
      const group = budgetGroup(wx.muscle)
      if (!group) continue
      for (const s of wx.sets) {
        if (s.skipped || (s.kind ?? 'working') !== 'working') continue
        bump(done, group, wx.muscle, setStyle(s.rir ?? wx.targetRIR), 1)
      }
    }
  }

  const today = new Map<string, StyleAcc>()
  for (const tx of todayPlan ?? []) {
    if (tx.type === 'plyo') continue
    const group = budgetGroup(tx.muscle)
    if (!group) continue
    bump(today, group, tx.muscle, setStyle(tx.targetRIR), tx.workingSets)
  }

  const plan = new Map(muscleBudgets(plannedDays).map((r) => [r.group, r]))

  const groups = new Set([...done.keys(), ...today.keys(), ...plan.keys()])
  return [...groups].map((group) => {
    const d = done.get(group)
    const t = today.get(group)
    const p = plan.get(group)
    const doneSets = d ? d.failure + d.volume : 0
    const todaySets = t ? t.failure + t.volume : 0
    const plannedSets = p?.workingSets ?? 0
    const doneBudget = d ? budgetOf(d.failure, d.volume) : 0
    const todayBudget = t ? budgetOf(t.failure, t.volume) : 0
    const planBudget = p?.budget ?? 0
    const mev = GROUP_MEV[group] ?? null
    // Zone floor projected with the week PLAN's style mix; plan-less (custom-only)
    // groups fall back to the live done+today mix.
    const refSets = plannedSets > 0 ? plannedSets : doneSets + todaySets
    const refBudget = plannedSets > 0 ? planBudget : doneBudget + todayBudget
    const zoneStart = mev !== null && refSets > 0 ? Math.min(1, (refBudget * mev) / refSets) : null
    const liveBudget = doneBudget + todayBudget
    const status: WeekZoneStatus =
      liveBudget > 1 ? 'over'
        : mev === null ? 'in'
          : doneSets >= mev ? 'in'
            : doneSets + todaySets >= mev ? 'entering'
              : 'below'
    return {
      group,
      label: BUDGET_GROUP_LABELS[group] ?? group,
      colorMuscle: p?.colorMuscle ?? d?.colorMuscle ?? t?.colorMuscle ?? group,
      mev, zoneStart, doneSets, todaySets, plannedSets, doneBudget, todayBudget, planBudget, status,
    }
  })
}

/** Prep card rows: groups trained today, biggest contribution first. */
export function selectPrepRows(rows: WeekZoneRow[]): WeekZoneRow[] {
  return rows
    .filter((r) => r.todaySets > 0)
    .sort((a, b) => b.todaySets - a.todaySets || a.group.localeCompare(b.group))
}

/** GYM meta-card rows: every planned or already-trained group, heaviest plan first. */
export function selectGymRows(rows: WeekZoneRow[]): WeekZoneRow[] {
  return rows
    .filter((r) => r.plannedSets > 0 || r.doneSets > 0)
    .sort((a, b) => b.planBudget - a.planBudget || a.group.localeCompare(b.group))
}

/** done → today → remaining-plan segments; caps at 100%, over turns the today slice into overflow. */
export function prepSegments(row: WeekZoneRow): ZoneSegment[] {
  const done = Math.min(row.doneBudget, 1)
  const live = Math.min(row.doneBudget + row.todayBudget, 1)
  const today = live - done
  const plan = Math.max(0, Math.min(row.planBudget, 1) - live)
  const segs: ZoneSegment[] = []
  if (done > 0) segs.push({ pct: done, kind: 'solid' })
  if (today > 0) segs.push({ pct: today, kind: row.status === 'over' ? 'overflow' : 'today' })
  if (plan > 0) segs.push({ pct: plan, kind: 'ghost' })
  return segs
}

/** done → remaining-plan segments for the GYM mini bars (no today slice). */
export function gymSegments(row: WeekZoneRow): ZoneSegment[] {
  const done = Math.min(row.doneBudget, 1)
  const plan = Math.max(0, Math.min(row.planBudget, 1) - done)
  const segs: ZoneSegment[] = []
  if (done > 0) segs.push({ pct: done, kind: row.doneBudget > 1 ? 'overflow' : 'solid' })
  if (plan > 0) segs.push({ pct: plan, kind: 'ghost' })
  return segs
}
```

Note on the test builder's types: `WorkoutDetailResponse` is a generated contract type — if the literal in the test needs a cast, cast the whole builder return once (`as WorkoutDetailResponse`), not per-field.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/weekZone.test.ts src/features/train/logic/setBudget.test.ts`
Expected: ALL PASS (setBudget untouched but re-run as the direct dependency).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/weekZone.ts frontend/src/features/train/logic/weekZone.test.ts
git commit -m "feat(train): weekZone live zone-row logic (mezo-oyhy.7)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 2: `ZoneTrack` primitive + `SetBudgetCard` refactor (zero visual change)

**Files:**
- Create: `frontend/src/features/train/components/ZoneTrack.tsx`
- Test: `frontend/src/features/train/components/ZoneTrack.test.tsx`
- Modify: `frontend/src/features/train/components/SetBudgetCard.tsx` (the expanded-row track block only)

**Interfaces:**
- Consumes: `ZoneSegment` type from Task 1 (`@/features/train/logic/weekZone`).
- Produces: `export function ZoneTrack(props: { zoneStart: number | null; segments: ZoneSegment[]; color: { rail: string; deep: string }; height?: number; zoneTestId?: string })` — Tasks 4 & 5 render it.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/components/ZoneTrack.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

const coral = { rail: 'var(--coral)', deep: 'var(--coral-deep)' }

describe('ZoneTrack', () => {
  it('renders the zone underlay at the rounded zoneStart', () => {
    render(<ZoneTrack zoneStart={0.28} segments={[]} color={coral} zoneTestId="zone-x" />)
    expect(screen.getByTestId('zone-x')).toHaveStyle({ left: '28%' })
  })
  it('renders no underlay when zoneStart is null', () => {
    render(<ZoneTrack zoneStart={null} segments={[{ pct: 0.5, kind: 'solid' }]} color={coral} zoneTestId="zone-x" />)
    expect(screen.queryByTestId('zone-x')).not.toBeInTheDocument()
  })
  it('lays segments left-to-right with their kinds', () => {
    const { container } = render(
      <ZoneTrack zoneStart={0.2} segments={[{ pct: 0.25, kind: 'solid' }, { pct: 0.25, kind: 'today' }, { pct: 0.3, kind: 'ghost' }]} color={coral} />,
    )
    const segs = [...container.querySelectorAll('[data-kind]')]
    expect(segs.map((s) => s.getAttribute('data-kind'))).toEqual(['solid', 'today', 'ghost'])
    expect(segs[1]).toHaveStyle({ left: '25%', width: '25%' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/ZoneTrack.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ZoneTrack.tsx`**

```tsx
// ============================================================
// Mezo · ZoneTrack — the shared zone-bar primitive (mezo-oyhy.7):
// --surface-2 track + sage optimal-zone underlay (zoneStart → 100%) +
// ordered value segments. Kinds: solid (full rail color), today
// (55% + dashed-look inset ring in the deep shade), ghost (22%),
// overflow (coral→error gradient). Single source of the bar language —
// used by SetBudgetCard, WeekZoneCard and ZoneMiniGrid.
// ============================================================
import type { CSSProperties } from 'react'
import type { ZoneSegment } from '@/features/train/logic/weekZone'

interface ZoneTrackProps {
  zoneStart: number | null
  segments: ZoneSegment[]
  /** Muscle color family pair — rail fills the segments, deep rings the today slice. */
  color: { rail: string; deep: string }
  height?: number
  zoneTestId?: string
}

export function ZoneTrack({ zoneStart, segments, color, height = 8.5, zoneTestId }: ZoneTrackProps) {
  let cursor = 0
  return (
    <div style={{ position: 'relative', height, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
      {zoneStart !== null && (
        <div
          {...(zoneTestId ? { 'data-testid': zoneTestId } : {})}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            left: `${Math.min(100, Math.round(zoneStart * 100))}%`,
            background: 'color-mix(in srgb, var(--sage) 28%, transparent)',
          }}
        />
      )}
      {segments.map((seg, i) => {
        const left = cursor
        cursor += seg.pct
        const last = i === segments.length - 1
        const style: CSSProperties = {
          position: 'absolute', top: 0, bottom: 0,
          left: `${left * 100}%`, width: `${seg.pct * 100}%`,
          // Rounded outer end like the pre-refactor fill; inner joints stay square.
          borderRadius: last ? (i === 0 ? 999 : '0 999px 999px 0') : 0,
        }
        if (seg.kind === 'solid') style.background = color.rail
        else if (seg.kind === 'today') { style.background = color.rail; style.opacity = 0.55; style.boxShadow = `inset 0 0 0 1.5px ${color.deep}` }
        else if (seg.kind === 'ghost') { style.background = color.rail; style.opacity = 0.22 }
        else style.background = 'linear-gradient(90deg, var(--coral), var(--error))'
        return <div key={i} data-kind={seg.kind} style={style} />
      })}
    </div>
  )
}
```

- [ ] **Step 4: Refactor `SetBudgetCard.tsx` onto `ZoneTrack`**

In `frontend/src/features/train/components/SetBudgetCard.tsx`:

Add imports:

```tsx
import { ZoneTrack } from '@/features/train/components/ZoneTrack'
```

In the expanded-row map, DELETE the `fillBackground` const and REPLACE the track block

```tsx
                  <div style={{ position: 'relative', height: 8.5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    {row.zoneStart !== null && ( ... )}
                    <div style={{ position: 'relative', height: '100%', width: `${fillWidth}%`, borderRadius: 999, background: fillBackground }} />
                  </div>
```

with:

```tsx
                  <ZoneTrack
                    zoneStart={row.zoneStart}
                    segments={[{ pct: Math.min(1, row.budget), kind: row.level === 'over' ? 'overflow' : 'solid' }]}
                    color={row.level === 'under'
                      ? { rail: 'var(--text-tertiary)', deep: 'var(--text-tertiary)' }
                      : { rail: fam.rail, deep: fam.deep }}
                    zoneTestId={`zone-${row.group}`}
                  />
```

The `p` / `fillWidth` consts: keep `p` (used in the numerics), delete `fillWidth`. Everything else in the card (pills, hints, explanation rows) stays byte-identical.

- [ ] **Step 5: Run tests to verify everything passes**

Run: `cd frontend && pnpm vitest run src/features/train/components/ZoneTrack.test.tsx src/features/train/components/SetBudgetCard.test.tsx`
Expected: ALL PASS — the SetBudgetCard suite must be green WITHOUT edits (`zone-<group>` testid, left %, copy all preserved). If a SetBudgetCard test fails, the refactor changed the contract — fix the refactor, not the test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/ZoneTrack.tsx frontend/src/features/train/components/ZoneTrack.test.tsx frontend/src/features/train/components/SetBudgetCard.tsx
git commit -m "feat(train): ZoneTrack shared primitive; SetBudgetCard adopts it (mezo-oyhy.7)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 3: `useWeekMuscleLog` data hook

**Files:**
- Create: `frontend/src/data/train/weekMuscleLogHooks.ts`
- Test: `frontend/src/data/train/weekMuscleLogHooks.test.ts`
- Modify: `frontend/src/data/hooks.ts` (one re-export line)

**Interfaces:**
- Consumes: `useWeekWorkouts` from `@/data/train/workoutDetailHooks`, `trainApi.getWorkout`, `isMockMode` from `@/data/_client/mode`, `useQueries` from `@tanstack/react-query`.
- Produces: `export function useWeekMuscleLog(): { details: WorkoutDetailResponse[]; completedSummaries: WorkoutSummaryResponse[]; pending: boolean }` re-exported from `@/data/hooks` — Tasks 4 & 5 call it.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/data/train/weekMuscleLogHooks.test.ts`. Follow the sibling `frontend/src/data/train/workoutDetailHooks.test.ts` idiom exactly (same wrapper util, msw `server.use`, env stubbing — read that file first and reuse its helpers/imports):

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'

const summary = (id: string, status: string, origin: string) =>
  ({ id, templateSessionId: `t-${id}`, date: '2026-08-03', status, origin })
const detailBody = (id: string) =>
  ({ id, templateSessionId: `t-${id}`, date: '2026-08-03', status: 'completed', title: 'Push', dayLabel: 'Hét', exercises: [] })

describe('useWeekMuscleLog (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('serves an empty week with pending false', () => {
    const { result } = renderHook(() => useWeekMuscleLog(), { wrapper: makeHookWrapper() })
    expect(result.current.details).toEqual([])
    expect(result.current.completedSummaries).toEqual([])
    expect(result.current.pending).toBe(false)
  })
})

describe('useWeekMuscleLog (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('fetches details for completed instances only (both origins), pending resolves', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/workouts`, () =>
        HttpResponse.json([summary('w1', 'completed', 'meso'), summary('w2', 'planned', 'meso'), summary('w3', 'completed', 'custom')])),
      http.get(`${API_BASE}/api/train/workouts/:id`, ({ params }) =>
        HttpResponse.json(detailBody(params.id as string))),
    )
    const { result } = renderHook(() => useWeekMuscleLog(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.completedSummaries.map((s) => s.id)).toEqual(['w1', 'w3'])
    expect(result.current.details.map((d) => d.id).sort()).toEqual(['w1', 'w3'])
  })
})
```

(Handler note: the `/api/train/workouts` handler must not also catch `/api/train/workouts/:id` — register the more specific `:id` route as shown; verify against the sibling file's handler style.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/data/train/weekMuscleLogHooks.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook + barrel line**

Create `frontend/src/data/train/weekMuscleLogHooks.ts`:

```ts
import { useQueries } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useWeekWorkouts } from '@/data/train/workoutDetailHooks'
import { trainApi, type WorkoutDetailResponse, type WorkoutSummaryResponse } from '@/data/train/trainApi'

/**
 * This week's completed workout instances WITH full per-set detail — the live
 * data source of the zone bars (mezo-oyhy.7). Composes useWeekWorkouts (summaries)
 * with one detail query per completed instance (meso AND custom origins); the
 * query keys match useWorkoutDetail so the review screens share the cache.
 * Mock mode has no persisted instances → empty, pending false (documented).
 * Conscious v1: client-side aggregation over ≤7 cached fetches, no backend
 * aggregate endpoint until this measurably hurts.
 */
export function useWeekMuscleLog(): {
  details: WorkoutDetailResponse[]
  completedSummaries: WorkoutSummaryResponse[]
  pending: boolean
} {
  const mock = isMockMode()
  const { workouts } = useWeekWorkouts()
  const completedSummaries = workouts.filter((w) => w.status === 'completed')
  const queries = useQueries({
    queries: completedSummaries.map((w) => ({
      queryKey: ['train', 'workoutDetail', w.id],
      queryFn: () => trainApi.getWorkout(w.id),
      enabled: !mock,
      retry: false,
    })),
  })
  return {
    details: queries.map((q) => q.data).filter((d): d is WorkoutDetailResponse => d !== undefined),
    completedSummaries,
    pending: !mock && queries.some((q) => q.isPending),
  }
}
```

In `frontend/src/data/hooks.ts`, next to the existing `workoutDetailHooks` re-export line, add:

```ts
export { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/data/train/weekMuscleLogHooks.test.ts src/data/train/workoutDetailHooks.test.ts`
Expected: ALL PASS in the default (real) mode. Also run: `VITE_USE_MOCK=true pnpm vitest run src/data/train/weekMuscleLogHooks.test.ts` — the env-stubbed tests must hold in both launch modes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/train/weekMuscleLogHooks.ts frontend/src/data/train/weekMuscleLogHooks.test.ts frontend/src/data/hooks.ts
git commit -m "feat(train): useWeekMuscleLog week-detail hook (mezo-oyhy.7)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 4: `WeekZoneCard` + prep-screen integration

**Files:**
- Create: `frontend/src/features/train/components/WeekZoneCard.tsx`
- Test: `frontend/src/features/train/components/WeekZoneCard.test.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (prep phase block, ~line 706-740; hook call at the session component's top, ~line 212)

**Interfaces:**
- Consumes: `WeekZoneRow`, `prepSegments` (Task 1); `ZoneTrack` (Task 2); `useWeekMuscleLog` via `@/data/hooks` (Task 3); `muscleColor` from `@/features/train/logic/muscleColors`; `Eyebrow` from `@/shared/ui/Eyebrow`.
- Produces: `export function WeekZoneCard(props: { rows: WeekZoneRow[]; doneWorkouts: number; planWorkouts: number })` — renders null on empty rows.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/components/WeekZoneCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeekZoneRow } from '@/features/train/logic/weekZone'
import { WeekZoneCard } from '@/features/train/components/WeekZoneCard'

const row = (over: Partial<WeekZoneRow>): WeekZoneRow => ({
  group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', mev: 4, zoneStart: 0.2,
  doneSets: 4, todaySets: 4, plannedSets: 10, doneBudget: 0.2, todayBudget: 0.2, planBudget: 0.5,
  status: 'in', ...over,
})

describe('WeekZoneCard', () => {
  it('renders header counts and the row numerics', () => {
    render(<WeekZoneCard rows={[row({})]} doneWorkouts={2} planWorkouts={4} />)
    expect(screen.getByText('Heti zóna-kontextus')).toBeInTheDocument()
    expect(screen.getByText('kész 2/4 edzés')).toBeInTheDocument()
    expect(screen.getByText('kész 4 · ma +4 · terv 10')).toBeInTheDocument()
  })
  it('shows the status hint per variant', () => {
    render(<WeekZoneCard
      rows={[
        row({ group: 'chest', label: 'Mell', status: 'entering' }),
        row({ group: 'back', label: 'Hát', status: 'in' }),
        row({ group: 'biceps', label: 'Bicepsz', status: 'over' }),
        row({ group: 'ham', label: 'Hamstring', status: 'below', mev: 4, doneSets: 1, todaySets: 1 }),
      ]}
      doneWorkouts={1} planWorkouts={4}
    />)
    expect(screen.getByText('▲ a mai edzéssel zónába érsz')).toBeInTheDocument()
    expect(screen.getByText('✓ zónában')).toBeInTheDocument()
    expect(screen.getByText('⚠ a mai edzéssel túlmennél a kereten')).toBeInTheDocument()
    expect(screen.getByText('↓ a zóna alatt — még 2 szett hiányzik a héten')).toBeInTheDocument()
  })
  it('renders nothing when there are no rows', () => {
    const { container } = render(<WeekZoneCard rows={[]} doneWorkouts={0} planWorkouts={4} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/WeekZoneCard.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `WeekZoneCard.tsx`**

```tsx
// ============================================================
// Mezo · WeekZoneCard — "Heti zóna-kontextus" card on the workout prep
// screen (mezo-oyhy.7, mockup variant A): per muscle group trained today,
// a three-segment ZoneTrack (done → TODAY → remaining plan) over the green
// optimal zone, with a status hint. Presentational — the caller selects
// rows (selectPrepRows) and counts the week's workouts.
// ============================================================
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { prepSegments, type WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

function hint(row: WeekZoneRow): { text: string; color: string } | null {
  switch (row.status) {
    case 'entering': return { text: '▲ a mai edzéssel zónába érsz', color: 'var(--sage-deep)' }
    case 'in': return row.mev === null ? null : { text: '✓ zónában', color: 'var(--sage-deep)' }
    case 'over': return { text: '⚠ a mai edzéssel túlmennél a kereten', color: 'var(--error)' }
    case 'below': {
      const missing = (row.mev ?? 0) - row.doneSets - row.todaySets
      return { text: `↓ a zóna alatt — még ${missing} szett hiányzik a héten`, color: 'var(--text-tertiary)' }
    }
  }
}

export function WeekZoneCard({ rows, doneWorkouts, planWorkouts }: {
  rows: WeekZoneRow[]
  doneWorkouts: number
  planWorkouts: number
}) {
  if (rows.length === 0) return null
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow brand>Heti zóna-kontextus</Eyebrow>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          kész {doneWorkouts}/{planWorkouts} edzés
        </span>
      </div>
      <div className="col" style={{ gap: 13, marginTop: 12 }}>
        {rows.map((row) => {
          const fam = muscleColor(row.colorMuscle)
          const h = hint(row)
          return (
            <div key={row.group} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 5, height: 34, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
              <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
                  <span className="label-mono" style={{ fontSize: 10 }}>
                    kész {row.doneSets} · ma +{row.todaySets} · terv {row.plannedSets}
                  </span>
                </div>
                <ZoneTrack zoneStart={row.zoneStart} segments={prepSegments(row)} color={{ rail: fam.rail, deep: fam.deep }} />
                {h && <span style={{ fontSize: 10.5, color: h.color }}>{h.text}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

(Copy deviation from the spec, on purpose: the `below` hint is `↓ a zóna alatt — még {k} szett hiányzik a héten` — the spec's `↓ a heti terv is a zóna alatt marad` was factually wrong when later sessions could still reach the floor. The `in` hint hides for mev-less groups (traps/core) — "zónában" would be meaningless there.)

- [ ] **Step 4: Integrate into the prep phase of `ActiveWorkoutPage.tsx`**

All inside `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`, in the SESSION component (the inner component that owns `phase` — starts near line 212; the prep block is `if (phase === 'prep') {` near line 707):

4a. Imports (top of file):

```tsx
import { useWeekMuscleLog } from '@/data/hooks'
import { selectPrepRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { WeekZoneCard } from '@/features/train/components/WeekZoneCard'
```

(`useWeekMuscleLog` joins the file's existing `@/data/hooks` import list if one exists.)

4b. Hook call — at the top of the session component, next to its other hook calls (unconditional, before any early return):

```tsx
  const weekLog = useWeekMuscleLog()
```

4c. In the prep block, right after the existing `const exerciseGroups = groupExercisesByRegion(W.exercises)` line, add:

```tsx
    // Live weekly zone context (mezo-oyhy.7): the week's logged sets + today's
    // plan on the optimal-zone scale, for the groups this session trains.
    const zoneRows = activeMeso?.days && !weekLog.pending
      ? selectPrepRows(weekZoneRows({
          plannedDays: activeMeso.days,
          completed: weekLog.details,
          todayPlan: W.exercises.map((e) => ({ muscle: e.muscle, type: e.type, workingSets: e.workingSets, targetRIR: e.targetRIR })),
        }))
      : []
    const zonePlanWorkouts = (activeMeso?.days ?? []).filter((d) => d.exerciseCount > 0).length
    const zoneDoneWorkouts = weekLog.completedSummaries.filter((s) => s.origin === 'meso').length
```

4d. In the prep JSX, directly BELOW the `PrepHero` wrapper `<div style={{ padding: '6px 24px' }}>…</div>`, add:

```tsx
        {zoneRows.length > 0 && (
          <div style={{ padding: '10px 24px 0' }}>
            <WeekZoneCard rows={zoneRows} doneWorkouts={zoneDoneWorkouts} planWorkouts={zonePlanWorkouts} />
          </div>
        )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/components/WeekZoneCard.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx`
(If `ActiveWorkoutPage.test.tsx` does not exist, run whatever `src/features/train/pages/ActiveWorkoutPage*.test.*` glob matches; if none, note it in the report and rely on Task 5's full gate.)
Expected: ALL PASS — the integration must not break any existing prep-phase test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/WeekZoneCard.tsx frontend/src/features/train/components/WeekZoneCard.test.tsx frontend/src/features/train/pages/ActiveWorkoutPage.tsx
git commit -m "feat(train): WeekZoneCard live zone context on the prep screen (mezo-oyhy.7)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 5: `ZoneMiniGrid` + GymPage integration + docs + full gate

**Files:**
- Create: `frontend/src/features/train/components/ZoneMiniGrid.tsx`
- Test: `frontend/src/features/train/components/ZoneMiniGrid.test.tsx`
- Modify: `frontend/src/features/train/pages/GymPage.tsx` (meta card: pill grid → mini grid; live stats)
- Modify: `frontend/src/features/train/pages/GymPage.test.tsx` (the two grid tests)
- Modify: `docs/features/train.md` (§4 + the GymPage/prep surface descriptions)

**Interfaces:**
- Consumes: `WeekZoneRow`, `gymSegments`, `selectGymRows`, `weekZoneRows` (Task 1); `ZoneTrack` (Task 2); `useWeekMuscleLog` via `@/data/hooks` (Task 3); `muscleColor`.
- Produces: `export function ZoneMiniGrid(props: { rows: WeekZoneRow[] })`.

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/features/train/components/ZoneMiniGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneMiniGrid } from '@/features/train/components/ZoneMiniGrid'

const row = (over: Partial<WeekZoneRow>): WeekZoneRow => ({
  group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', mev: 4, zoneStart: 0.2,
  doneSets: 4, todaySets: 0, plannedSets: 10, doneBudget: 0.2, todayBudget: 0, planBudget: 0.5,
  status: 'in', ...over,
})

describe('ZoneMiniGrid', () => {
  it('renders a cell per row with done/plan numerics', () => {
    render(<ZoneMiniGrid rows={[row({}), row({ group: 'quad', label: 'Comb', doneSets: 0, plannedSets: 8 })]} />)
    expect(screen.getByText('Mell')).toBeInTheDocument()
    expect(screen.getByText('4/10')).toBeInTheDocument()
    expect(screen.getByText('0/8')).toBeInTheDocument()
  })
  it('marks a plan over budget with ⚠ in error color', () => {
    render(<ZoneMiniGrid rows={[row({ plannedSets: 16, planBudget: 8 / 12 + 8 / 20 })]} />)
    const numeric = screen.getByText(/^4\/16 ⚠$/)
    expect(numeric).toHaveStyle({ color: 'var(--error)' })
  })
  it('marks a plan under its MEV with ↓', () => {
    render(<ZoneMiniGrid rows={[row({ group: 'ham', label: 'Hamstring', mev: 2, plannedSets: 1, doneSets: 0, planBudget: 0.05 })]} />)
    expect(screen.getByText(/^0\/1 ↓$/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/ZoneMiniGrid.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ZoneMiniGrid.tsx`**

```tsx
// ============================================================
// Mezo · ZoneMiniGrid — two-column live mini zone bars for the GymPage
// meta card (mezo-oyhy.7, mockup variant C): per muscle group, done (solid)
// + remaining plan (ghost) on the green optimal zone, `{done}/{plan}`
// numerics. Marks describe the WEEKLY PLAN (the old pill grid's semantics):
// ⚠ = plan over budget, ↓ = plan under its MEV.
// ============================================================
import { Fragment } from 'react'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { gymSegments, type WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

export function ZoneMiniGrid({ rows }: { rows: WeekZoneRow[] }) {
  if (rows.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
      {rows.map((row) => {
        const fam = muscleColor(row.colorMuscle)
        const planOver = row.planBudget > 1
        const planUnder = row.mev !== null && row.plannedSets < row.mev
        const numeric = `${row.doneSets}/${row.plannedSets}${planOver ? ' ⚠' : planUnder ? ' ↓' : ''}`
        return (
          <Fragment key={row.group}>
            <div>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 10.5 }}>{row.label}</span>
                <span className="label-mono" style={{ fontSize: 9, color: planOver ? 'var(--error)' : 'var(--text-tertiary)' }}>
                  {numeric}
                </span>
              </div>
              <ZoneTrack zoneStart={row.zoneStart} segments={gymSegments(row)} color={{ rail: fam.rail, deep: fam.deep }} height={7} />
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
```

(If the `Fragment` wrapper ends up redundant around a single `<div>`, drop it and key the `<div>` directly — match what lints clean.)

- [ ] **Step 4: Integrate into `GymPage.tsx`**

4a. Imports: REMOVE `MUSCLE_LABELS` (from `@/data/train/train`), `muscleRegionGroups`, `muscleWeekFromMeso` (from `@/features/train/logic/muscleWeek`), `budgetGroup` and `muscleBudgets` (from `@/features/train/logic/setBudget`), `Fragment` (from `react`) — IF nothing else in the file still uses them (verify each with a grep in the file). ADD:

```tsx
import { useWeekMuscleLog } from '@/data/hooks'
import { selectGymRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { ZoneMiniGrid } from '@/features/train/components/ZoneMiniGrid'
```

4b. Hook call — with the other hooks at the component top (BEFORE the `workoutPending` / `!activeMeso` early returns, hook order must stay render-stable):

```tsx
  const weekLog = useWeekMuscleLog()
```

4c. Replace the derivation block (currently `const muscleGroups = muscleRegionGroups(...)` and `const overGroups = new Set(...)`) with:

```tsx
  // Live zone rows (mezo-oyhy.7): done sets from the week's completed instances
  // + the weekly plan on the optimal-zone scale, one mini bar per muscle group.
  const zoneRows = selectGymRows(weekZoneRows({ plannedDays: days, completed: weekLog.details }))
  const doneWorkingSets = weekLog.details.reduce(
    (acc, w) => acc + w.exercises.reduce(
      (b, e) => b + e.sets.filter((s) => !s.skipped && (s.kind ?? 'working') === 'working').length, 0), 0)
  const doneGymDays = weekLog.completedSummaries.filter((s) => s.origin === 'meso').length
```

4d. Stat row — the `Szetek` and `Gym napok` stats go live:

```tsx
            <GymStat label="Szetek" val={`${doneWorkingSets}/${totalSets}`} sub="kész / heti terv" color="var(--cat-physiology)" />
            <GymStat label="Gym napok" val={`${doneGymDays}/${gymDays.length}`} sub="kész / hét" color="var(--cat-preference)" />
```

4e. Replace the whole region-grid block (`{muscleGroups.length > 0 && ( <div style={{ marginTop: 12, ... gridTemplateColumns: '44px 1fr' ... )}` including its `muscleGroups.map`) with:

```tsx
          {zoneRows.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <ZoneMiniGrid rows={zoneRows} />
            </div>
          )}
```

Everything else on the card (Fázis/Split stats, footer row, `tap → heti izomterhelés`, MuscleWeekSheet wiring) stays unchanged.

- [ ] **Step 5: Rewrite the two grid tests in `GymPage.test.tsx`**

Replace the test `'meta card shows the region-grouped muscle grid'` with:

```tsx
test('meta card shows the live zone mini grid (mezo-oyhy.7)', () => {
  renderView()
  const card = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  // Group-level rows now (budget groups, not per-head pills); mock week has no
  // completed instances → done is 0 for every group.
  expect(within(card).getByText('Hát')).toBeInTheDocument()
  expect(within(card).getAllByText(/^0\/\d+( [⚠↓])?$/).length).toBeGreaterThan(0)
  // Live stats: the Szetek/Gym napok subs flipped to done/plan phrasing.
  expect(within(card).getByText('kész / heti terv')).toBeInTheDocument()
  expect(within(card).getByText('kész / hét')).toBeInTheDocument()
})
```

Replace the test `'an over-budget muscle pill shows the warning icon in error color (mezo-7rdg)'` with:

```tsx
test('an over-budget group cell shows ⚠ in error color (mezo-oyhy.7)', () => {
  daysOverride = [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 2,
    exercises: [
      { id: 'ob1', name: 'Bench Press', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 4, repMax: 6, targetRIR: 1, type: 'compound', anchorWeightKg: 100 },
      { id: 'ob2', name: 'Cable Fly', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 12, repMax: 15, targetRIR: 3, type: 'isolation', anchorWeightKg: 15 },
    ],
  }]
  renderView()
  const card = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  const numeric = within(card).getByText(/^0\/16 ⚠$/)
  expect(numeric).toHaveStyle({ color: 'var(--error)' })
})
```

- [ ] **Step 6: Run the focused tests**

Run: `cd frontend && pnpm vitest run src/features/train/components/ZoneMiniGrid.test.tsx src/features/train/pages/GymPage.test.tsx`
Expected: ALL PASS (including the untouched GymPage tests — header, navigation, sheets, skeleton).

- [ ] **Step 7: Update `docs/features/train.md`**

Living doc, overwrite in place. Update the §4 set-budget/zone passage and the GymPage + prep-screen surface descriptions so they state:

- The zone-bar language is single-sourced in `ZoneTrack` (`features/train/components/ZoneTrack.tsx`); `SetBudgetCard` (plan-only), `WeekZoneCard` (prep, live: done → today → plan segments) and `ZoneMiniGrid` (GymPage meta card, live: done + plan-remainder) all render through it.
- Live data: `useWeekMuscleLog` (`data/train/weekMuscleLogHooks.ts`, via the `@/data/hooks` barrel) fetches this week's completed instance details (meso + custom); mock mode is an empty week. Logged sets price by per-set RIR (fallback: exercise `targetRIR`); skip-marker/warmup rows and plyo exercises are excluded (`weekZone.ts`).
- GymPage meta card: the mezo-ly27 per-head pill grid is replaced by the group-level `ZoneMiniGrid`; `Szetek` and `Gym napok` stats are now `done/plan`; per-head detail remains on `MuscleWeekSheet`.
- Prep screen: `WeekZoneCard` below `PrepHero`, rows = groups trained today, with the four status hints.
- Spec pointer: `docs/superpowers/specs/2026-08-04-live-zone-unification-design.md`; bd `mezo-oyhy.7`.

Run: `node scripts/lint-docs.mjs` — `train.md` must come out clean (pre-existing stale flags on OTHER docs are known and out of scope; report them, don't fix them).

- [ ] **Step 8: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, full suite green in BOTH modes. If anything unrelated to this branch's files is red, stop and report — do not fix unrelated tests.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/train/components/ZoneMiniGrid.tsx frontend/src/features/train/components/ZoneMiniGrid.test.tsx frontend/src/features/train/pages/GymPage.tsx frontend/src/features/train/pages/GymPage.test.tsx docs/features/train.md
git commit -m "feat(train): ZoneMiniGrid live GYM summary + live stats + docs (mezo-oyhy.7)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```
