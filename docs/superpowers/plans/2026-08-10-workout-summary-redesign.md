# Workout Summary + Review Unified Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shared `WorkoutSummary` (closing + closed modes) to the house colorful pill/chip language per spec `docs/superpowers/specs/2026-08-10-workout-summary-redesign-design.md` (driving bd: `mezo-w943`).

**Architecture:** One new pure-logic module (`summaryStats.ts`) derives every number/grouping the screen needs; `WorkoutSummary.tsx` is rewritten against it with a new `.wsum-*` CSS vocabulary appended to `prototype.css`; the two callers (`WorkoutReviewPage`, `ActiveWorkoutPage`) pass two new inputs (`muscle` per exercise, `durationMin`) and the review page starts feeding medals from the existing `useMedals()` hook. Frontend-only; no API change.

**Tech Stack:** React 19 + Vite + Vitest + Testing Library; CSS in `frontend/src/styles/prototype.css` (design tokens via `var()` only).

## Global Constraints

- **Read `docs/references/frontend_conventions.md` BEFORE writing any code** (mandatory house standard). Also skim spec §2–§6 (`docs/superpowers/specs/2026-08-10-workout-summary-redesign-design.md`).
- Imports: deep + absolute via `@/*`; **no new barrels**; data hooks only from `@/data/hooks`.
- Tests colocated next to sources. AssertJ-style naming not needed (that's backend); follow the existing vitest style in the touched files.
- UI copy is **Hungarian**; code/comments **English**.
- Colors ONLY via CSS custom properties (`var(--…)`) — no hex literals in the appended CSS except inside `rgba()` halo gradients (guarded for dark theme, see Task 2).
- All commits on branch `feat/train-summary-redesign`, conventional subjects carrying `(mezo-w943)`.
- Frontend gate per task: run the focused vitest files in **both modes** (`pnpm test -- <paths>` and `VITE_USE_MOCK=true pnpm test -- <paths>` from `frontend/`). Do NOT run any backend suite — this change is frontend-only.
- Task tracking is `bd` — do NOT use TodoWrite/TaskCreate.

**Verbatim interfaces already in the codebase (do not redefine):**

```ts
// @/data/types
export interface LastWeekSet { weight: number; reps: number; rir: number }

// @/data/train/medalTypes — generated from the OpenAPI contract
// Medal: { type: 'WEIGHT'|'REPS_AT_WEIGHT'|'E1RM'|'SESSION_VOLUME'|'TARGET_HIT',
//   tier: 'RECORD'|'TARGET', exerciseName: string, date: string,
//   workoutSessionId?: string|null, setIndex?: number|null (0-based logged position),
//   value: number, unit: 'KG'|'REPS', weightKg?: number|null, reps?: number|null,
//   previousValue?: number|null, muscle?: string|null, catalogId?: string|null, previousDate?: string|null }

// @/features/train/logic/muscleColors
export type RegionKey = 'coral'|'sky'|'lav'|'rose'|'sage'|'amber'
export const REGION_ORDER: readonly RegionKey[]
export const REGION_LABELS: Record<RegionKey, string> // Mell/Hát/Váll/Kar/Láb/Core
export function muscleRegion(muscle: string): RegionKey | null
export function regionColor(region: RegionKey): { rail: string; wash: string; deep: string }
export function muscleColor(muscle: string): { rail: string; wash: string; deep: string }

// @/features/train/logic/medalLabels
export const MEDAL_TYPE_LABEL: Record<MedalType, string>
export const MEDAL_UNIT_LABEL: Record<'KG'|'REPS', string>
export const formatMedalNumber: (n: number) => string  // hu-HU
export function medalValueLabel(medal: Medal): string

// @/data/train/train
export const MUSCLE_LABELS: Record<string, string> // 'back-wide' -> 'Hát (széles)' …

// @/data/hooks
export { useMedals } // () => { data: Medal[]; isPending: boolean }
```

---

### Task 1: `summaryStats.ts` — pure derivations + table tests

**Files:**
- Create: `frontend/src/features/train/logic/summaryStats.ts`
- Create: `frontend/src/features/train/logic/summaryStats.test.ts`

**Interfaces:**
- Consumes: `LastWeekSet` (`@/data/types`), `Medal` (`@/data/train/medalTypes`), `muscleRegion`/`REGION_ORDER`/`REGION_LABELS` (`@/features/train/logic/muscleColors`).
- Produces (Task 2 relies on these exact names):

```ts
export interface SummaryExerciseInput {
  id: string
  name: string
  muscle: string
  plannedSets: number
  sets: LastWeekSet[]
  skipped: boolean
}
export interface SummarySetChip { weight: number; reps: number; rir: number; record: boolean; top: boolean }
export interface SummaryExerciseView {
  id: string; name: string; muscle: string
  plannedSets: number; doneSets: number
  abandoned: boolean          // sets.length === 0
  partial: boolean            // 0 < doneSets < plannedSets
  missing: number             // max(0, plannedSets - doneSets)
  chips: SummarySetChip[]
}
export interface RegionPill { region: RegionKey; label: string; sets: number; off: boolean }
export interface TargetGroup { exerciseName: string; count: number }
export interface SummaryStats {
  doneSets: number; plannedSets: number
  doneEx: number; totalEx: number
  volumeT: number             // Σ(weight×reps)/1000
  avgRir: number | null       // 1-decimal mean over ALL logged sets; null if none
  regions: RegionPill[]
  records: Medal[]            // tier === 'RECORD', input order
  targetGroups: TargetGroup[] // TARGET_HITs grouped by exerciseName, count desc, tie first-seen
  targetCount: number
  exercises: SummaryExerciseView[]
}
export function deriveSummaryStats(exercises: SummaryExerciseInput[], medals: Medal[]): SummaryStats
```

**Derivation rules (implement exactly):**
- `regions`: aggregate logged-set counts by `muscleRegion(ex.muscle)`; `null` region keys are skipped entirely. A pill is `off` when its region has ≥1 exercise but 0 logged sets. Order: non-off pills by `sets` desc, tie by `REGION_ORDER` index; `off` pills last in `REGION_ORDER` order.
- Record chip marking, per exercise: for each `RECORD` medal with `exerciseName === ex.name` — if `setIndex` is a valid index into `sets` (0-based), mark that chip `record`; else if `weightKg`/`reps` are non-null, mark the FIRST chip with `weight === weightKg && reps === reps`; else mark nothing (the medal still appears in `records`).
- `top` chip: the heaviest set (tie → more reps, tie → first); `top` is set ONLY if that chip is not already `record`. No `top` on an exercise with 0 sets.
- `avgRir`: `Math.round(mean * 10) / 10`.

- [ ] **Step 1: Write the failing table tests**

Create `frontend/src/features/train/logic/summaryStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveSummaryStats, type SummaryExerciseInput } from '@/features/train/logic/summaryStats'
import type { Medal } from '@/data/train/medalTypes'

const ex = (over: Partial<SummaryExerciseInput>): SummaryExerciseInput => ({
  id: 'x', name: 'Ex', muscle: 'back-wide', plannedSets: 3,
  sets: [], skipped: false, ...over,
})
const recordMedal = (over: Partial<Medal>): Medal => ({
  type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Row', date: '2026-08-04',
  value: 70, unit: 'KG', weightKg: 70, reps: 8, previousValue: 67.5, ...over,
})
const targetMedal = (name: string, setIndex: number): Medal => ({
  type: 'TARGET_HIT', tier: 'TARGET', exerciseName: name, date: '2026-08-04',
  setIndex, value: 8, unit: 'REPS', weightKg: 60, reps: 8, previousValue: null,
})

describe('deriveSummaryStats', () => {
  const exercises: SummaryExerciseInput[] = [
    ex({ id: 'a', name: 'Row', muscle: 'back-mid', plannedSets: 4,
      sets: [{ weight: 65, reps: 10, rir: 2 }, { weight: 65, reps: 10, rir: 2 }, { weight: 70, reps: 8, rir: 1 }, { weight: 70, reps: 7, rir: 1 }] }),
    ex({ id: 'b', name: 'Lat pulldown', muscle: 'back-wide', plannedSets: 4,
      sets: [{ weight: 60, reps: 12, rir: 3 }, { weight: 60, reps: 11, rir: 2 }, { weight: 60, reps: 10, rir: 2 }] }),
    ex({ id: 'c', name: 'Face pull', muscle: 'shoulder-rear', plannedSets: 3,
      sets: [{ weight: 25, reps: 15, rir: 2 }, { weight: 25, reps: 15, rir: 2 }, { weight: 25, reps: 15, rir: 1 }] }),
    ex({ id: 'd', name: 'Cable crunch', muscle: 'core', plannedSets: 3, sets: [], skipped: true }),
  ]

  it('totals: sets, exercises, volume, avgRir', () => {
    const s = deriveSummaryStats(exercises, [])
    expect(s.doneSets).toBe(10)
    expect(s.plannedSets).toBe(14)
    expect(s.doneEx).toBe(3)
    expect(s.totalEx).toBe(4)
    // 650+650+560+490 + 720+660+600 + 375+375+375 = 5455 kg
    expect(s.volumeT).toBeCloseTo(5.455, 3)
    expect(s.avgRir).toBe(1.8) // (2+2+1+1+3+2+2+2+2+1)/10 = 1.8
  })

  it('avgRir is null with zero logged sets', () => {
    expect(deriveSummaryStats([ex({ sets: [] })], []).avgRir).toBeNull()
  })

  it('regions: aggregated, sorted by done sets, off region last + unknown muscle skipped', () => {
    const s = deriveSummaryStats([...exercises, ex({ id: 'e', name: 'Mystery', muscle: 'not-a-muscle', sets: [{ weight: 1, reps: 1, rir: 0 }] })], [])
    expect(s.regions).toEqual([
      { region: 'sky', label: 'Hát', sets: 7, off: false },
      { region: 'lav', label: 'Váll', sets: 3, off: false },
      { region: 'amber', label: 'Core', sets: 0, off: true },
    ])
  })

  it('record chip: setIndex match wins', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: 2 })])
    const row = s.exercises.find((e) => e.name === 'Row')!
    expect(row.chips.map((c) => c.record)).toEqual([false, false, true, false])
    expect(row.chips.map((c) => c.top)).toEqual([false, false, false, false]) // top === record → suppressed
  })

  it('record chip: null setIndex falls back to first weight+reps match', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: null })])
    expect(s.exercises.find((e) => e.name === 'Row')!.chips[2].record).toBe(true)
  })

  it('record with no matching set still lands in records[] without a chip', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: 9, weightKg: null, reps: null })])
    expect(s.records).toHaveLength(1)
    expect(s.exercises.flatMap((e) => e.chips).some((c) => c.record)).toBe(false)
  })

  it('top chip: heaviest set, tie broken by reps', () => {
    const s = deriveSummaryStats(exercises, [])
    const lat = s.exercises.find((e) => e.name === 'Lat pulldown')!
    expect(lat.chips.map((c) => c.top)).toEqual([true, false, false])
    expect(lat.partial).toBe(true)
    expect(lat.missing).toBe(1)
    const row = s.exercises.find((e) => e.name === 'Row')!
    expect(row.chips.map((c) => c.top)).toEqual([false, false, true, false]) // 70×8 beats 70×7
  })

  it('abandoned exercise: no chips, flagged', () => {
    const s = deriveSummaryStats(exercises, [])
    const dead = s.exercises.find((e) => e.name === 'Cable crunch')!
    expect(dead.abandoned).toBe(true)
    expect(dead.chips).toEqual([])
  })

  it('target groups: counted per exercise, count desc, targetCount totals', () => {
    const s = deriveSummaryStats(exercises, [
      targetMedal('Face pull', 0), targetMedal('Row', 0), targetMedal('Row', 1), recordMedal({ setIndex: 2 }),
    ])
    expect(s.targetGroups).toEqual([
      { exerciseName: 'Row', count: 2 },
      { exerciseName: 'Face pull', count: 1 },
    ])
    expect(s.targetCount).toBe(3)
    expect(s.records).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test -- src/features/train/logic/summaryStats.test.ts`
Expected: FAIL — module `summaryStats` not found.

- [ ] **Step 3: Implement `summaryStats.ts`**

```ts
// ============================================================
// Mezo · summaryStats — pure derivations for the WorkoutSummary redesign
// (mezo-w943): totals, muscle-region pills, RECORD/TARGET medal split and
// the per-exercise set-chip map (record/top/ghost marking). Table-tested;
// keeps WorkoutSummary.tsx presentational.
// ============================================================
import type { LastWeekSet } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { REGION_LABELS, REGION_ORDER, muscleRegion, type RegionKey } from '@/features/train/logic/muscleColors'

export interface SummaryExerciseInput {
  id: string
  name: string
  muscle: string
  plannedSets: number
  sets: LastWeekSet[]
  skipped: boolean
}
export interface SummarySetChip { weight: number; reps: number; rir: number; record: boolean; top: boolean }
export interface SummaryExerciseView {
  id: string; name: string; muscle: string
  plannedSets: number; doneSets: number
  abandoned: boolean
  partial: boolean
  missing: number
  chips: SummarySetChip[]
}
export interface RegionPill { region: RegionKey; label: string; sets: number; off: boolean }
export interface TargetGroup { exerciseName: string; count: number }
export interface SummaryStats {
  doneSets: number; plannedSets: number
  doneEx: number; totalEx: number
  volumeT: number
  avgRir: number | null
  regions: RegionPill[]
  records: Medal[]
  targetGroups: TargetGroup[]
  targetCount: number
  exercises: SummaryExerciseView[]
}

/** The heaviest set's index — ties break to more reps, then to the earlier set. */
function topSetIndex(sets: LastWeekSet[]): number {
  let best = -1
  sets.forEach((s, i) => {
    if (best === -1) { best = i; return }
    const b = sets[best]
    if (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best = i
  })
  return best
}

/** Chip index a RECORD medal points at: valid setIndex wins, else first weight+reps match. */
function recordChipIndex(medal: Medal, sets: LastWeekSet[]): number {
  if (medal.setIndex != null && medal.setIndex >= 0 && medal.setIndex < sets.length) return medal.setIndex
  if (medal.weightKg != null && medal.reps != null) {
    return sets.findIndex((s) => s.weight === medal.weightKg && s.reps === medal.reps)
  }
  return -1
}

export function deriveSummaryStats(exercises: SummaryExerciseInput[], medals: Medal[]): SummaryStats {
  const records = medals.filter((m) => m.tier === 'RECORD')
  const targets = medals.filter((m) => m.tier === 'TARGET')

  const views: SummaryExerciseView[] = exercises.map((e) => {
    const chips: SummarySetChip[] = e.sets.map((s) => ({ ...s, record: false, top: false }))
    for (const m of records) {
      if (m.exerciseName !== e.name) continue
      const idx = recordChipIndex(m, e.sets)
      if (idx >= 0) chips[idx].record = true
    }
    const top = topSetIndex(e.sets)
    if (top >= 0 && !chips[top].record) chips[top].top = true
    const doneSets = e.sets.length
    return {
      id: e.id, name: e.name, muscle: e.muscle,
      plannedSets: e.plannedSets, doneSets,
      abandoned: doneSets === 0,
      partial: doneSets > 0 && doneSets < e.plannedSets,
      missing: Math.max(0, e.plannedSets - doneSets),
      chips,
    }
  })

  const byRegion = new Map<RegionKey, number>()
  for (const e of exercises) {
    const region = muscleRegion(e.muscle)
    if (!region) continue
    byRegion.set(region, (byRegion.get(region) ?? 0) + e.sets.length)
  }
  const on = [...byRegion.entries()].filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || REGION_ORDER.indexOf(a[0]) - REGION_ORDER.indexOf(b[0]))
  const off = [...byRegion.entries()].filter(([, n]) => n === 0)
    .sort((a, b) => REGION_ORDER.indexOf(a[0]) - REGION_ORDER.indexOf(b[0]))
  const regions: RegionPill[] = [...on, ...off].map(([region, sets]) => ({
    region, label: REGION_LABELS[region], sets, off: sets === 0,
  }))

  const targetByName = new Map<string, number>()
  for (const m of targets) targetByName.set(m.exerciseName, (targetByName.get(m.exerciseName) ?? 0) + 1)
  const targetGroups: TargetGroup[] = [...targetByName.entries()]
    .map(([exerciseName, count]) => ({ exerciseName, count }))
    .sort((a, b) => b.count - a.count)

  const allSets = exercises.flatMap((e) => e.sets)
  const volumeT = allSets.reduce((a, s) => a + s.weight * s.reps, 0) / 1000
  const avgRir = allSets.length === 0 ? null : Math.round((allSets.reduce((a, s) => a + s.rir, 0) / allSets.length) * 10) / 10

  return {
    doneSets: allSets.length,
    plannedSets: exercises.reduce((a, e) => a + e.plannedSets, 0),
    doneEx: views.filter((v) => !v.abandoned).length,
    totalEx: exercises.length,
    volumeT, avgRir, regions, records, targetGroups,
    targetCount: targets.length,
    exercises: views,
  }
}
```

Note on `targetGroups` tie order: `Map` preserves insertion order and `Array.prototype.sort` is stable — equal counts stay first-seen, which is what the test asserts.

- [ ] **Step 4: Run to verify pass (both modes)**

Run: `cd frontend && pnpm test -- src/features/train/logic/summaryStats.test.ts && VITE_USE_MOCK=true pnpm test -- src/features/train/logic/summaryStats.test.ts`
Expected: PASS ×2.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/summaryStats.ts frontend/src/features/train/logic/summaryStats.test.ts
git commit -m "feat(train): summaryStats — pure derivations for the workout summary redesign (mezo-w943)"
```

---

### Task 2: `WorkoutSummary` rewrite + `.wsum-*` CSS + component tests

**Files:**
- Modify: `frontend/src/features/train/components/WorkoutSummary.tsx` (full rewrite below)
- Modify: `frontend/src/styles/prototype.css` (append the `.wsum-*` block at the end)
- Modify: `frontend/src/features/train/components/WorkoutSummary.test.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `deriveSummaryStats` + types from Task 1; `muscleColor` (`@/features/train/logic/muscleColors`); `MEDAL_TYPE_LABEL`/`MEDAL_UNIT_LABEL`/`formatMedalNumber`/`medalValueLabel` (`@/features/train/logic/medalLabels`); `MUSCLE_LABELS` (`@/data/train/train`); existing CSS classes `.cta-primary`, `.cta-ghost`, `.eyebrow`, `.card` untouched.
- Produces (Task 3 relies on): `WorkoutSummary` props
  `{ title: string; eyebrow: string; mode: 'closing'|'closed'; exercises: SummaryExercise[]; challenges: SummaryChallenge[]; medals?: Medal[]; durationMin?: number|null; onFinish?: () => void; finishPending?: boolean; onBack?: () => void; onExit: () => void }`
  where `export type SummaryExercise = SummaryExerciseInput` (re-exported so existing caller imports keep working, now WITH the `muscle` field) and `SummaryChallenge` is unchanged. **`showSetLines` is deleted.**

- [ ] **Step 1: Append the CSS block to `frontend/src/styles/prototype.css`**

```css
/* ===== WorkoutSummary redesign (mezo-w943) — hero+halo, region pills,
   mérleg strip, medal cards, challenge rows, set-chip map. Feature-scoped
   vocabulary (same precedent as .setdots/.excard); tokens only. ===== */
.wsum-top { display: flex; align-items: center; gap: 7px; padding: 16px 20px 0; }
.wsum-top button { display: flex; align-items: center; gap: 6px; background: none; border: none; font: inherit; cursor: pointer; color: var(--text-secondary); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.wsum-top .wsum-xi { width: 26px; height: 26px; border-radius: var(--r-full); background: var(--surface-recess); display: flex; align-items: center; justify-content: center; font-size: 12px; }
.wsum-hero { position: relative; text-align: center; padding: 18px 22px 0; }
.wsum-halo { position: absolute; width: 300px; height: 300px; top: -110px; left: 50%; margin-left: -150px; filter: blur(2px); z-index: 0; pointer-events: none; animation: wsum-morph 9s ease-in-out infinite alternate; }
.wsum-halo.fire { background: radial-gradient(ellipse at 50% 45%, rgba(255,107,74,.20), rgba(255,179,71,.14) 55%, transparent 75%); }
.wsum-halo.calm { background: radial-gradient(ellipse at 50% 45%, rgba(127,164,138,.22), rgba(212,168,83,.10) 55%, transparent 75%); animation-duration: 14s; }
:root[data-theme="dark"] .wsum-halo { opacity: .35; }
@keyframes wsum-morph {
  0% { border-radius: 58% 42% 55% 45%/50% 58% 42% 50%; transform: translate(-8px,-6px); }
  100% { border-radius: 52% 48% 60% 40%/44% 54% 46% 56%; transform: translate(6px,4px) scale(1.05); }
}
@media (prefers-reduced-motion: reduce) { .wsum-halo { animation: none; } }
.wsum-hero > :not(.wsum-halo) { position: relative; z-index: 1; }
.wsum-hero .wsum-over { font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--coral-deep); }
.wsum-hero .wsum-over.closed { color: var(--text-muted); }
.wsum-hero h2 { font-family: var(--ff-display); font-size: 20px; font-weight: 800; letter-spacing: -.02em; margin-top: 5px; color: var(--ink); }
.wsum-num { font-size: 54px; font-weight: 200; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; margin-top: 14px; color: var(--ink); }
.wsum-num .of { font-size: 26px; font-weight: 200; color: var(--text-muted); }
.wsum-num .unit { font-size: 17px; font-weight: 300; color: var(--text-muted); margin-left: 6px; }
.wsum-sub { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-top: 8px; }
.wsum-sub b { font-weight: 700; color: var(--ink); }
.wsum-regrow { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 14px 22px 0; position: relative; z-index: 1; }
.wsum-reg { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--r-full); padding: 5px 11px; font-size: 10.5px; font-weight: 800; background: var(--fam-wash, var(--surface-recess)); color: var(--fam-deep, var(--text-secondary)); }
.wsum-reg .n { font-family: var(--ff-mono); font-weight: 600; font-size: 9.5px; opacity: .85; }
.wsum-reg.off { background: var(--surface-recess); color: var(--text-disabled); text-decoration: line-through; }
.wsum-stripwrap { padding: 16px 20px 0; }
.wsum-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--divider); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.wsum-strip .cell { background: var(--surface-card); padding: 11px 4px 10px; text-align: center; }
.wsum-strip .v { font-size: 17px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
.wsum-strip .v .u { font-size: 9.5px; font-weight: 500; color: var(--text-muted); margin-left: 1px; }
.wsum-strip .v.gold { color: var(--amber-deep); }
.wsum-strip .v.green { color: var(--sage-deep); }
.wsum-strip .l { font-size: 7.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--text-muted); margin-top: 3px; }
.wsum-sec { padding: 20px 20px 0; }
.wsum-slabel { font-size: 9.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 9px; display: flex; align-items: center; gap: 6px; }
.wsum-slabel .cnt { font-family: var(--ff-mono); font-size: 9px; color: var(--text-disabled); font-weight: 600; letter-spacing: 0; }
.wsum-medal { display: flex; align-items: center; gap: 10px; background: linear-gradient(120deg, var(--accent-bg), var(--surface-card) 70%); border: 1px solid var(--accent-soft); border-radius: var(--r-xl); padding: 11px 13px; box-shadow: var(--shadow-sm); }
.wsum-medal + .wsum-medal { margin-top: 8px; }
.wsum-medal .disc { width: 34px; height: 34px; border-radius: var(--r-full); background: var(--wash-amber); display: flex; align-items: center; justify-content: center; font-size: 16px; flex: none; box-shadow: inset 0 0 0 1.5px var(--accent-soft); }
.wsum-medal .tx { flex: 1; min-width: 0; }
.wsum-medal .tx .t { font-size: 12.5px; font-weight: 700; color: var(--ink); }
.wsum-medal .tx .m { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
.wsum-medal .val { text-align: right; flex: none; }
.wsum-medal .val .now { font-family: var(--ff-mono); font-size: 12px; font-weight: 700; color: var(--amber-deep); white-space: nowrap; }
.wsum-medal .val .prev { font-family: var(--ff-mono); font-size: 8.5px; color: var(--text-disabled); margin-top: 2px; white-space: nowrap; }
.wsum-targets { display: flex; align-items: center; gap: 9px; background: var(--success-bg); border: 1px solid var(--success-soft); border-radius: var(--r-xl); padding: 10px 13px; margin-top: 8px; }
.wsum-targets .tick { width: 24px; height: 24px; border-radius: var(--r-full); background: var(--surface-card); color: var(--sage-deep); font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none; }
.wsum-targets .t { font-size: 11.5px; font-weight: 700; color: var(--success-hover); }
.wsum-targets .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.wsum-targets .chips span { font-family: var(--ff-mono); font-size: 8.5px; font-weight: 600; color: var(--sage-deep); background: var(--surface-card); border-radius: var(--r-full); padding: 2px 7px; }
.wsum-chal { display: flex; align-items: center; gap: 10px; background: var(--surface-card); border: 1px solid var(--divider); border-radius: var(--r-xl); padding: 10px 12px; box-shadow: var(--shadow-sm); }
.wsum-chal + .wsum-chal { margin-top: 8px; }
.wsum-chal .st { width: 28px; height: 28px; border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex: none; }
.wsum-chal.hit .st { background: var(--wash-sage); color: var(--sage-deep); }
.wsum-chal.miss .st { background: var(--warning-bg); color: var(--warning-hover); }
.wsum-chal.skip .st { background: var(--surface-recess); color: var(--text-disabled); }
.wsum-chal .tx { flex: 1; min-width: 0; }
.wsum-chal .tx .t { font-size: 12px; font-weight: 700; color: var(--ink); }
.wsum-chal .tx .m { font-family: var(--ff-mono); font-size: 9px; color: var(--text-muted); margin-top: 2px; }
.wsum-chal .out { font-size: 9.5px; font-weight: 800; border-radius: var(--r-full); padding: 4px 9px; white-space: nowrap; flex: none; }
.wsum-chal.hit .out { background: var(--wash-sage); color: var(--sage-deep); }
.wsum-chal.miss .out { background: var(--warning-bg); color: var(--warning-hover); }
.wsum-chal.skip .out { background: var(--surface-recess); color: var(--text-disabled); }
.wsum-exc { position: relative; background: linear-gradient(180deg, color-mix(in srgb, var(--fam-rail) 10%, transparent) 0%, var(--surface-card) 55%); border: 1px solid var(--divider); border-left: 5px solid var(--fam-rail); border-radius: var(--r-xl); padding: 12px 13px 13px; box-shadow: var(--shadow-sm); }
.wsum-exc + .wsum-exc { margin-top: 9px; }
.wsum-exc .hd { display: flex; align-items: center; gap: 8px; }
.wsum-exc .nm { font-size: 13px; font-weight: 700; flex: 1; min-width: 0; color: var(--ink); }
.wsum-exc .mus { font-size: 8.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; border-radius: var(--r-sm); padding: 3px 6px; background: var(--fam-wash); color: var(--fam-deep); flex: none; }
.wsum-exc .setn { font-family: var(--ff-mono); font-size: 9.5px; font-weight: 700; color: var(--fam-deep); flex: none; }
.wsum-exc .setn.part { color: var(--warning-hover); }
.wsum-exc .setn.dead { color: var(--text-disabled); }
.wsum-exc .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.wsum-chip { display: inline-flex; align-items: baseline; gap: 4px; font-family: var(--ff-mono); font-size: 10px; font-weight: 600; color: var(--ink); background: var(--surface-recess); border: 1px solid transparent; border-radius: var(--r-full); padding: 4px 9px; font-variant-numeric: tabular-nums; }
.wsum-chip .rir { font-size: 8px; color: var(--text-muted); }
.wsum-chip.top { border-color: color-mix(in srgb, var(--fam-rail) 55%, transparent); background: var(--fam-wash); color: var(--fam-deep); }
.wsum-chip.top .rir { color: var(--fam-deep); opacity: .7; }
.wsum-chip.rec { background: var(--wash-amber); border-color: var(--accent-soft); color: var(--amber-deep); }
.wsum-chip.rec .rir { color: var(--amber-deep); opacity: .75; }
.wsum-chip.ghost { background: transparent; border: 1px dashed var(--divider); color: var(--text-disabled); }
.wsum-exc.dead { background: var(--surface-card); border-left-color: var(--text-disabled); opacity: .72; }
.wsum-exc.dead .nm { color: var(--text-muted); text-decoration: line-through; }
.wsum-note { background: var(--surface-card); border: 1px solid var(--divider); border-radius: var(--r-xl); padding: 12px 13px; box-shadow: var(--shadow-sm); }
.wsum-note .l { font-family: var(--ff-mono); font-size: 8.5px; font-weight: 600; color: var(--text-muted); letter-spacing: .08em; text-transform: uppercase; }
.wsum-note textarea { width: 100%; margin-top: 8px; min-height: 52px; resize: none; font-size: 13px; line-height: 1.45; }
.wsum-ctas { padding: 20px 20px 26px; display: flex; flex-direction: column; gap: 9px; }
```

- [ ] **Step 2: Rewrite the component test file**

Replace `frontend/src/features/train/components/WorkoutSummary.test.tsx` with:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'
import type { Medal } from '@/data/train/medalTypes'

const exercises = [
  { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', muscle: 'back-wide', plannedSets: 2, sets: [], skipped: true },
]
const challenges = [
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', state: 'hit' as const },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', state: 'skipped' as const },
]
const medals: Medal[] = [
  {
    type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Bench Press',
    date: '2026-07-20', value: 1250, unit: 'KG', previousValue: 1180, previousDate: '2026-07-13',
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Bench Press',
    date: '2026-07-20', setIndex: 0, value: 8, unit: 'REPS', weightKg: 80, reps: 8, previousValue: null,
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Row',
    date: '2026-07-20', setIndex: 2, value: 10, unit: 'REPS', weightKg: 60, reps: 10, previousValue: null,
  },
]

describe('WorkoutSummary', () => {
  it('closing mode: hero counts, region pills, challenge outcomes, finish CTA', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing" durationMin={65}
      exercises={exercises} challenges={challenges} onFinish={onFinish} onBack={() => {}} onExit={() => {}} />)
    // hero: 1/6 sets + duration ("1" alone is ambiguous — Ø RIR cell also shows 1)
    const num = document.querySelector('.wsum-num') as HTMLElement
    expect(num.textContent).toBe('1/6szett')
    expect(screen.getByText(/~65 perc/)).toBeInTheDocument()
    // region pills: Mell live (has a set-count child → regex), Hát off (bare label)
    expect(screen.getByText(/Mell/)).toBeInTheDocument()
    expect(screen.getByText('Hát')).toBeInTheDocument()
    // challenge outcomes keep the existing vocabulary
    expect(screen.getByText('megcsináltad')).toBeInTheDocument()
    expect(screen.getByText('skippelted')).toBeInTheDocument()
    // abandoned exercise
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('closed mode: no finish CTA, set chips render in full', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    expect(screen.getByText(/80\s*×\s*8/)).toBeInTheDocument()
    expect(screen.getByText('@1')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Edzés-jegyzet/)).toBeNull() // note is closing-only
  })

  it('closing mode still renders the note textarea', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByLabelText('Edzés-jegyzet · opcionális')).toBeInTheDocument()
  })

  describe('medals (mezo-wp6n / mezo-w943 split)', () => {
    it('RECORD medal renders as a celebration card with value + previous', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const section = screen.getByText('Medálok').closest('.wsum-sec') as HTMLElement
      expect(within(section).getByText('Volumen-rekord')).toBeInTheDocument()
      expect(within(section).getByText(/1[\s ]?250/)).toBeInTheDocument()
      expect(within(section).getByText(/előző:/)).toBeInTheDocument()
    })

    it('TARGET_HITs collapse into a single summary row with per-exercise chips', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('2 célszett teljesítve')).toBeInTheDocument()
      expect(screen.getByText('Bench Press ×1')).toBeInTheDocument()
      expect(screen.getByText('Row ×1')).toBeInTheDocument()
      // no per-TARGET rows anymore
      expect(screen.queryAllByText('Cél teljesítve')).toHaveLength(0)
    })

    it('renders no medal section and no title suffix when medals is empty', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={[]} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('Pull Day A')).toBeInTheDocument()
      expect(screen.queryByText(/medál/)).not.toBeInTheDocument()
      expect(screen.queryByText('Medálok')).not.toBeInTheDocument()
    })

    it('marks the record set chip on the exercise card', () => {
      const recordOnSet: Medal[] = [{
        type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Bench Press',
        date: '2026-07-20', setIndex: 0, value: 80, unit: 'KG', weightKg: 80, reps: 8, previousValue: 77.5,
      }]
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={recordOnSet} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const chip = screen.getByText(/80\s*×\s*8/).closest('.wsum-chip') as HTMLElement
      expect(chip.className).toContain('rec')
    })
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

Run: `cd frontend && pnpm test -- src/features/train/components/WorkoutSummary.test.tsx`
Expected: FAIL (old component: no region pills, no chips, `muscle` prop unused).

- [ ] **Step 4: Rewrite `WorkoutSummary.tsx`**

Replace the whole file with:

```tsx
// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen,
// colorful pill/chip redesign (mezo-w943, spec 2026-08-10; supersedes the
// grey 2026-07-15 layout). One shell, two modes:
//   'closing': pre-finish — hero + halo(fire) + note + "Edzés lezárása ✓".
//   'closed':  the same shell read-only (post-finish + /train/review).
// All numbers come from logic/summaryStats (pure, table-tested).
// ============================================================
import type { CSSProperties } from 'react'
import type { Medal } from '@/data/train/medalTypes'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor, regionColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel } from '@/features/train/logic/medalLabels'
import { deriveSummaryStats, type SummaryExerciseInput } from '@/features/train/logic/summaryStats'
import { Icon } from '@/shared/ui/Icon'

export type SummaryExercise = SummaryExerciseInput

export interface SummaryChallenge {
  id: string
  typeLabel: string
  exercise?: string
  target: string
  state: 'hit' | 'miss' | 'skipped' | 'inconclusive'
  detail?: string
}

const CHALLENGE_COPY: Record<SummaryChallenge['state'], { glyph: string; label: string; cls: string }> = {
  hit: { glyph: '✓', label: 'megcsináltad', cls: 'hit' },
  miss: { glyph: '◯', label: 'nem jött össze', cls: 'miss' },
  skipped: { glyph: '⊘', label: 'skippelted', cls: 'skip' },
  inconclusive: { glyph: '◌', label: 'nem értékelhető', cls: 'skip' },
}

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, medals = [], durationMin = null,
  onFinish, finishPending = false, onBack, onExit,
}: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  medals?: Medal[]
  durationMin?: number | null
  onFinish?: () => void
  finishPending?: boolean
  onBack?: () => void
  onExit: () => void
}) {
  const s = deriveSummaryStats(exercises, medals)
  const chalHit = challenges.filter((c) => c.state === 'hit').length
  const chalMiss = challenges.filter((c) => c.state !== 'hit').length

  return (
    <div>
      <div className="wsum-top">
        <button onClick={onExit}>
          <span className="wsum-xi" aria-hidden="true">{mode === 'closing' ? '✕' : '←'}</span>
          {mode === 'closing' ? 'Bezárás' : 'Vissza'}
        </button>
      </div>

      <div className="wsum-hero">
        <div className={`wsum-halo ${mode === 'closing' ? 'fire' : 'calm'}`} aria-hidden="true" />
        <div className={`wsum-over${mode === 'closed' ? ' closed' : ''}`}>{eyebrow}</div>
        <h2>{title}</h2>
        <div className="wsum-num">
          {s.doneSets}<span className="of">/{s.plannedSets}</span><span className="unit">szett</span>
        </div>
        <div className="wsum-sub">
          <b>{hu(s.volumeT)} t</b> összvolumen · <b>{s.doneEx}/{s.totalEx}</b> gyakorlat
          {durationMin ? <> · ~{durationMin} perc</> : null}
        </div>
      </div>

      {s.regions.length > 0 && (
        <div className="wsum-regrow">
          {s.regions.map((r) => {
            const fam = regionColor(r.region)
            return (
              <span key={r.region} className={`wsum-reg${r.off ? ' off' : ''}`}
                style={r.off ? undefined : { '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties}>
                {r.label}{r.off ? null : <span className="n">{r.sets} szett</span>}
              </span>
            )
          })}
        </div>
      )}

      <div className="wsum-stripwrap">
        <div className="wsum-strip">
          <div className="cell"><div className="v">{hu(s.volumeT)}<span className="u">t</span></div><div className="l">Volumen</div></div>
          <div className="cell"><div className={`v${s.records.length ? ' gold' : ''}`}>{s.records.length}<span className="u">🏅</span></div><div className="l">Rekord</div></div>
          <div className="cell"><div className={`v${s.targetCount ? ' green' : ''}`}>{s.targetCount}<span className="u">✓</span></div><div className="l">Célszett</div></div>
          <div className="cell"><div className="v">{s.avgRir == null ? '–' : hu(s.avgRir)}</div><div className="l">Ø RIR</div></div>
        </div>
      </div>

      {medals.length > 0 && (
        <div className="wsum-sec">
          <div className="wsum-slabel">Medálok <span className="cnt">{s.records.length} rekord · {s.targetCount} cél</span></div>
          {s.records.map((m, i) => (
            <div key={`${m.type}-${m.exerciseName}-${m.setIndex ?? i}`} className="wsum-medal">
              <div className="disc" aria-hidden="true">🏅</div>
              <div className="tx">
                <div className="t">{MEDAL_TYPE_LABEL[m.type] ?? m.type}</div>
                <div className="m">{m.exerciseName}{m.type === 'E1RM' && m.weightKg != null && m.reps != null ? ` · ${formatMedalNumber(m.weightKg)} × ${m.reps}-ből becsülve` : ''}</div>
              </div>
              <div className="val">
                <div className="now">{medalValueLabel(m)}</div>
                {m.previousValue != null && (
                  <div className="prev">előző: {formatMedalNumber(m.previousValue)} {MEDAL_UNIT_LABEL[m.unit] ?? ''}</div>
                )}
              </div>
            </div>
          ))}
          {s.targetCount > 0 && (
            <div className="wsum-targets">
              <div className="tick" aria-hidden="true">✓</div>
              <div style={{ flex: 1 }}>
                <div className="t">{s.targetCount} célszett teljesítve</div>
                <div className="chips">
                  {s.targetGroups.map((g) => <span key={g.exerciseName}>{g.exerciseName} ×{g.count}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {challenges.length > 0 && (
        <div className="wsum-sec">
          <div className="wsum-slabel">Kihívások <span className="cnt">{chalHit} megvan · {chalMiss} kimaradt</span></div>
          {challenges.map((c) => {
            const copy = CHALLENGE_COPY[c.state]
            return (
              <div key={c.id} className={`wsum-chal ${copy.cls}`}>
                <div className="st" aria-hidden="true">{copy.glyph}</div>
                <div className="tx">
                  <div className="t">{c.typeLabel}{c.exercise ? ` · ${c.exercise}` : ''}</div>
                  <div className="m">{c.detail ?? c.target}</div>
                </div>
                <div className="out">{copy.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="wsum-sec">
        <div className="wsum-slabel">Gyakorlatonként <span className="cnt">szett-térkép</span></div>
        {s.exercises.map((e) => {
          const fam = muscleColor(e.muscle)
          const famStyle = { '--fam-rail': fam.rail, '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties
          return (
            <div key={e.id} className={`wsum-exc${e.abandoned ? ' dead' : ''}`} style={famStyle}>
              <div className="hd">
                <span className="nm">{e.name}</span>
                <span className="mus">{MUSCLE_LABELS[e.muscle] ?? e.muscle}</span>
                {e.abandoned
                  ? <span className="setn dead">kihagyva</span>
                  : <span className={`setn${e.partial ? ' part' : ''}`}>{e.doneSets}/{e.plannedSets}</span>}
              </div>
              {e.chips.length > 0 && (
                <div className="chips">
                  {e.chips.map((c, i) => (
                    <span key={i} className={`wsum-chip${c.record ? ' rec' : c.top ? ' top' : ''}`}>
                      {c.record ? '🏅 ' : ''}{hu(c.weight)} × {c.reps} <span className="rir">@{c.rir}</span>
                    </span>
                  ))}
                  {e.missing > 0 && <span className="wsum-chip ghost">— kimaradt</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mode === 'closing' && (
        <div className="wsum-sec">
          <div className="wsum-note">
            <div className="l">Edzés-jegyzet · opcionális</div>
            <textarea aria-label="Edzés-jegyzet · opcionális" placeholder='pl. "pumpa brutális volt"' />
          </div>
        </div>
      )}

      <div className="wsum-ctas">
        {mode === 'closing' ? (
          <>
            <button className="cta-primary" disabled={finishPending} onClick={onFinish}>
              <Icon name="check" size={16} />
              <span>Edzés lezárása ✓</span>
            </button>
            <button type="button" className="cta-ghost" style={{ padding: 12 }} onClick={onBack}>
              ← Vissza az edzéshez
            </button>
          </>
        ) : (
          <button className="cta-ghost" style={{ padding: 12 }} onClick={onExit}>
            ← Vissza
          </button>
        )}
      </div>
    </div>
  )
}
```

Note: the exercises in the "Gyakorlatonként" section keep the CALLER's order (it is the workout's own order); `s.exercises` preserves input order by construction.

- [ ] **Step 5: Run the component tests (both modes)**

Run: `cd frontend && pnpm test -- src/features/train/components/WorkoutSummary.test.tsx && VITE_USE_MOCK=true pnpm test -- src/features/train/components/WorkoutSummary.test.tsx`
Expected: PASS ×2. If a text query fails on split nodes, prefer `screen.getByText((_, el) => el?.textContent === '…')` narrowing — do not weaken assertions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/WorkoutSummary.tsx frontend/src/features/train/components/WorkoutSummary.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): WorkoutSummary colorful pill/chip redesign — hero+halo, region pills, set-chip map (mezo-w943)"
```

---

### Task 3: Callers — `WorkoutReviewPage` + `ActiveWorkoutPage`

**Files:**
- Modify: `frontend/src/features/train/pages/WorkoutReviewPage.tsx` (full replacement below)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx:429-435` (summaryExercises mapping) and `:899-916` (the summary/complete render)
- Test: `frontend/src/features/train/pages/WorkoutReviewPage.test.tsx`, `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (fix expectations only)

**Interfaces:**
- Consumes: `WorkoutSummary` props from Task 2 (`muscle` in `SummaryExercise`, `durationMin`, NO `showSetLines`); `useMedals` from `@/data/hooks`.
- Produces: nothing new.

- [ ] **Step 1: Replace `WorkoutReviewPage.tsx`**

```tsx
// ============================================================
// Mezo · WorkoutReviewPage — read-only review of a COMPLETED workout
// (/train/review/:workoutId — spec 2026-07-15 done-day review, option B;
// visual redesign mezo-w943). Data: GET /api/train/workouts/{id}, the day's
// challenges (server outcomes) and the medal cabinet filtered to this
// workout (workoutSessionId). Renders the shared WorkoutSummary in
// 'closed' mode.
// ============================================================
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useMedals, useWorkoutDetail } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train')
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')
  const { data: allMedals } = useMedals()

  if (pending) return <ScreenSkeleton />
  if (error || !detail) {
    return (
      <div style={{ padding: 24 }}>
        <GhostState lines={3} message="Ez az edzés nem található." ctaLabel="← Vissza az edzésekhez" onCta={() => navigate('/train')} />
      </div>
    )
  }

  const exercises: SummaryExercise[] = detail.exercises.map((e) => ({
    id: e.exerciseId,
    name: e.name,
    muscle: e.muscle,
    plannedSets: e.warmupSets + e.workingSets,
    sets: e.sets.map((s) => ({ weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? 0 })),
    skipped: e.skipped,
  }))
  // Server-resolved outcomes; anything not hit/miss/inconclusive reads as skipped.
  const challengeRows: SummaryChallenge[] = challenges.map((c) => ({
    id: c.id,
    typeLabel: c.typeLabel,
    exercise: c.exercise,
    target: c.target,
    state: c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive' ? c.status : 'skipped',
    detail: c.outcome ?? undefined,
  }))
  // The medal cabinet scoped to this workout — empty filter → no medal section.
  const medals = allMedals.filter((m) => m.workoutSessionId === detail.id)

  return (
    <WorkoutSummary
      title={detail.title}
      eyebrow={`Lezárva · ${huMonthDayDow(detail.date)}`}
      mode="closed"
      exercises={exercises}
      challenges={challengeRows}
      medals={medals}
      durationMin={detail.durationEst ?? null}
      onExit={goBack}
    />
  )
}
```

- [ ] **Step 2: Update `ActiveWorkoutPage.tsx`**

(a) `summaryExercises` mapping (~line 429) — add `muscle`:

```ts
  const summaryExercises: SummaryExercise[] = W.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscle: e.muscle,
    plannedSets: effectiveSetCount(session, e.id),
    sets: session.logged[e.id] ?? [],
    skipped: session.skipped.includes(e.id),
  }))
```

(b) The summary/complete render (~line 899) — new eyebrow, `durationMin`, drop `showSetLines`:

```tsx
  if (phase === 'summary' || phase === 'complete') {
    const closing = phase === 'summary'
    return (
      <WorkoutSummary
        title={W.title}
        eyebrow={closing ? 'Edzés vége' : 'Lezárva · ma'}
        mode={closing ? 'closing' : 'closed'}
        exercises={summaryExercises}
        challenges={summaryChallenges}
        medals={sessionMedals}
        durationMin={W.durationEst}
        onFinish={finishAndCelebrate}
        finishPending={finishPending}
        onBack={() => setPhase('active')}
        onExit={onExit}
      />
    )
  }
```

- [ ] **Step 3: Run the callers' tests, fix expectations only**

Run: `cd frontend && pnpm test -- src/features/train/pages/WorkoutReviewPage.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx`

Expected: possible failures ONLY in assertions about the old summary layout (e.g. `Mai mérleg`, `@RIR` set-line format, `Edzés vége · {title}` eyebrow text, `· N medál` suffix). Fix the EXPECTATIONS to the new layout (`{n} × {m}` chips, `@{rir}`, eyebrow `Edzés vége`); do NOT change component behavior to satisfy old tests. If a test mocks `@/data/hooks`, add `useMedals: () => ({ data: [], isPending: false })` to the mock factory.
Then both modes: `VITE_USE_MOCK=true pnpm test -- src/features/train/pages/WorkoutReviewPage.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx`
Expected: PASS ×2.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/train/pages/WorkoutReviewPage.tsx frontend/src/features/train/pages/ActiveWorkoutPage.tsx frontend/src/features/train/pages/WorkoutReviewPage.test.tsx frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx
git commit -m "feat(train): wire summary redesign into review + active pages — muscle, duration, review medals (mezo-w943)"
```

---

### Task 4: Full gates, visual check, feature doc, lint

**Files:**
- Modify: `docs/features/train.md` (the WorkoutSummary / done-day review passages)
- No code files expected; fix anything the gates surface.

**Interfaces:** consumes everything above; produces the releasable branch.

- [ ] **Step 1: Full frontend gate**

Run from `frontend/`:
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build green, ALL tests green in BOTH modes. Fix regressions before proceeding (test-only expectation fixes belong in the task that broke them — amend there if needed).

- [ ] **Step 2: Visual golden check (darwin)**

Run from `frontend/`: `pnpm test:visual`
Expected: PASS — the visual suite pins `/train/session` in its pre-workout (prep) phase, which this change does not touch. If any snapshot DOES differ, stop and inspect: only regenerate (`pnpm test:visual:update`, darwin; linux via the `mezo-uz4g` workflow) if the diff is genuinely this redesign leaking into a covered state — otherwise it's a bug: fix the code.

- [ ] **Step 3: Update `docs/features/train.md`**

Locate the passages describing the explicit-finish summary and `/train/review` (search for `WorkoutSummary`, `Mai mérleg`, `showSetLines`, `done-day review`). Rewrite them (overwrite in place — no changelog) to describe: the mezo-w943 colorful redesign (hero-number + fire/calm halo, region pills via `muscleRegion()`, 4-cell strip, RECORD cards + TARGET summary row, set-chip map with record/top/ghost chips, note still presentational and closing-only), `deriveSummaryStats` in `logic/summaryStats.ts`, the deleted `showSetLines` prop, and the review page's `useMedals()`-filtered medals. Update any stale `file:line` pointers you touch.

- [ ] **Step 4: Lint the docs**

Run from repo root: `node scripts/lint-docs.mjs`
Expected: no errors for `train.md` (staleness flag cleared).

- [ ] **Step 5: Commit**

```bash
git add docs/features/train.md
git commit -m "docs(train): summary/review redesign — feature doc update (mezo-w943)"
```
