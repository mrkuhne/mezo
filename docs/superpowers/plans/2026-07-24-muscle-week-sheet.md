# Muscle Week Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GymPage per-muscle weekly breakdown — region-grouped muscle grid on the meta card, tap → `MuscleWeekSheet` with ① per-muscle sets/reps/exercises/stimulus, ② sport+running muscle load (static heuristic), ③ Growth athletic-skill XP forecast.

**Architecture:** Three pure logic modules under `features/train/logic/` feed one new sheet + a card grid. Zero backend/contract change; all inputs are live in both modes (meso days, sport schedule, running block, progression profile). Spec: `docs/superpowers/specs/2026-07-24-muscle-week-sheet-design.md` (mezo-ly27).

**Tech Stack:** React 19 + TS, TanStack Query hooks from `@/data/hooks`, vitest + testing-library, shared `Sheet` primitive.

## Global Constraints

- Follow `docs/references/frontend_conventions.md`: sheets in `features/train/sheets/`, pure logic in `features/train/logic/`, data hooks ONLY from `@/data/hooks`, deep absolute `@/*` imports, colocated tests, no new barrel, no `*Screen`/`*View`.
- Colors only via CSS custom-property tokens (`var(--…)`), reusing `muscleColor()` families; no raw hex in components.
- Working-set counting excludes warmups everywhere (consistent with `GymPage.tsx:63`).
- Rest/sport template rows are excluded by muscle key (`''` / `'sport'`), the builder's off-day rule.
- All user-facing copy is Hungarian; estimates carry the `~` marker.
- Commits: conventional subject + driving bd id `(mezo-ly27)`.
- Gate after the last task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.

---

### Task 1: Region vocabulary on `muscleColors.ts`

**Files:**
- Modify: `frontend/src/features/train/logic/muscleColors.ts`
- Test: `frontend/src/features/train/logic/muscleColors.test.ts` (extend)

**Interfaces:**
- Consumes: existing private `MUSCLE_FAMILY` map + `FAMILIES`.
- Produces: `export type RegionKey = 'coral'|'sky'|'lav'|'rose'|'sage'|'amber'`; `export const REGION_ORDER: readonly RegionKey[]`; `export const REGION_LABELS: Record<RegionKey, string>`; `export function muscleRegion(muscle: string): RegionKey | null`.

- [ ] **Step 1: Write the failing tests** — append to `muscleColors.test.ts`:

```ts
import { muscleRegion, REGION_LABELS, REGION_ORDER } from '@/features/train/logic/muscleColors'

describe('muscleRegion (mezo-ly27)', () => {
  it('maps every catalog muscle to its color-family region', () => {
    expect(muscleRegion('chest')).toBe('coral')
    expect(muscleRegion('lats')).toBe('sky')
    expect(muscleRegion('back')).toBe('sky') // legacy key
    expect(muscleRegion('rear-delt')).toBe('lav')
    expect(muscleRegion('triceps')).toBe('rose')
    expect(muscleRegion('calf')).toBe('sage')
    expect(muscleRegion('core')).toBe('amber')
  })
  it('returns null for unknown muscles', () => {
    expect(muscleRegion('sport')).toBeNull()
    expect(muscleRegion('')).toBeNull()
  })
  it('labels + order cover the six regions', () => {
    expect(REGION_ORDER).toEqual(['coral', 'sky', 'lav', 'rose', 'sage', 'amber'])
    expect(REGION_LABELS.coral).toBe('Mell')
    expect(REGION_LABELS.sky).toBe('Hát')
    expect(REGION_LABELS.lav).toBe('Váll')
    expect(REGION_LABELS.rose).toBe('Kar')
    expect(REGION_LABELS.sage).toBe('Láb')
    expect(REGION_LABELS.amber).toBe('Core')
  })
})
```

(If the existing file imports with a plain relative-free pattern, match its import style; `describe/it/expect` are vitest globals there.)

- [ ] **Step 2: Run to verify failure** — `cd frontend && pnpm vitest run src/features/train/logic/muscleColors.test.ts` → FAIL (`muscleRegion` not exported).

- [ ] **Step 3: Implement** — append to `muscleColors.ts` (below the existing `muscleColor`):

```ts
// --- Region vocabulary (mezo-ly27 muscle-week) — region == color family. ---
export type RegionKey = Exclude<keyof typeof FAMILIES, 'neutral'>

export const REGION_ORDER = ['coral', 'sky', 'lav', 'rose', 'sage', 'amber'] as const satisfies readonly RegionKey[]

/** HU region label per color family (card grid row labels + event-load chips). */
export const REGION_LABELS: Record<RegionKey, string> = {
  coral: 'Mell', sky: 'Hát', lav: 'Váll', rose: 'Kar', sage: 'Láb', amber: 'Core',
}

/** Region (== color family) of a muscle key; null for unknown/off-day keys. */
export function muscleRegion(muscle: string): RegionKey | null {
  return MUSCLE_FAMILY[muscle] ?? null
}
```

Note: `MUSCLE_FAMILY`'s value type is `keyof typeof FAMILIES` but only non-neutral values occur; if `tsc` complains about the narrowing, type the map as `Record<string, RegionKey>` (it contains no `neutral` entries).

- [ ] **Step 4: Run to verify pass** — same command → PASS (existing + new tests).
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/muscleColors.{ts,test.ts} && git commit -m "feat(train): region vocabulary on muscleColors (mezo-ly27)"`

---

### Task 2: `muscleWeek.ts` — per-muscle weekly aggregation

**Files:**
- Create: `frontend/src/features/train/logic/muscleWeek.ts`
- Test: `frontend/src/features/train/logic/muscleWeek.test.ts`

**Interfaces:**
- Consumes: `MesoDay`/`GymExercise` from `@/data/types`; Task 1's `muscleRegion`, `REGION_ORDER`, `REGION_LABELS`, `RegionKey`.
- Produces:
  - `interface MuscleWeekRow { muscle: string; workingSets: number; repMinTotal: number; repMaxTotal: number; exerciseCount: number; gymFrequency: number }`
  - `function muscleWeekFromMeso(days: MesoDay[]): MuscleWeekRow[]` (sets-desc sorted)
  - `interface MuscleRegionGroup { region: RegionKey; label: string; rows: MuscleWeekRow[] }`
  - `function muscleRegionGroups(rows: MuscleWeekRow[]): MuscleRegionGroup[]` (REGION_ORDER, empty regions omitted)

- [ ] **Step 1: Write the failing test** — `muscleWeek.test.ts`:

```ts
import type { GymExercise, MesoDay } from '@/data/types'
import { muscleRegionGroups, muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'

let n = 0
const ex = (muscle: string, workingSets: number, repMin = 8, repMax = 12): GymExercise => ({
  id: `ex-${n++}`, name: `${muscle}-${n}`, muscle, warmupSets: 1, workingSets,
  repMin, repMax, targetRIR: 2, type: 'compound',
})
const day = (d: string, exercises: GymExercise[]): MesoDay => ({
  day: d, type: 'Day', muscle: exercises[0]?.muscle ?? '', exerciseCount: exercises.length, exercises,
})

describe('muscleWeekFromMeso', () => {
  it('aggregates sets, weekly rep range, exercise count and frequency per muscle', () => {
    const rows = muscleWeekFromMeso([
      day('Hét', [ex('chest', 3, 8, 12), ex('chest', 3, 10, 15), ex('lats', 4)]),
      day('Csü', [ex('chest', 4, 8, 12)]),
    ])
    const chest = rows.find((r) => r.muscle === 'chest')!
    expect(chest.workingSets).toBe(10)
    expect(chest.repMinTotal).toBe(3 * 8 + 3 * 10 + 4 * 8)   // 86
    expect(chest.repMaxTotal).toBe(3 * 12 + 3 * 15 + 4 * 12)  // 129
    expect(chest.exerciseCount).toBe(3)
    expect(chest.gymFrequency).toBe(2)
    expect(rows.find((r) => r.muscle === 'lats')!.gymFrequency).toBe(1)
  })
  it('excludes rest/sport rows and sorts by sets desc', () => {
    const rows = muscleWeekFromMeso([
      day('Hét', [ex('quad', 6), ex('chest', 3)]),
      day('Kedd', [ex('sport', 5), ex('', 2)]),
    ])
    expect(rows.map((r) => r.muscle)).toEqual(['quad', 'chest'])
  })
})

describe('muscleRegionGroups', () => {
  it('groups by region in fixed order, omitting empty regions', () => {
    const rows = muscleWeekFromMeso([day('Hét', [ex('core', 2), ex('chest', 3), ex('quad', 4), ex('ham', 2)])])
    const groups = muscleRegionGroups(rows)
    expect(groups.map((g) => g.label)).toEqual(['Mell', 'Láb', 'Core'])
    expect(groups[1].rows.map((r) => r.muscle)).toEqual(['quad', 'ham'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/train/logic/muscleWeek.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `muscleWeek.ts`:

```ts
// ============================================================
// Mezo · muscleWeek — per-muscle weekly aggregation of the active meso's
// template week (mezo-ly27 muscle-week sheet). Working sets only (warmups
// excluded, the GymPage `Szetek` convention); off-day rows excluded by
// muscle key ('' / 'sport'), the builder's off-day rule.
// ============================================================
import type { MesoDay } from '@/data/types'
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from '@/features/train/logic/muscleColors'

export interface MuscleWeekRow {
  muscle: string
  workingSets: number
  /** Weekly total reps at the recipe's low/high end (Σ sets×repMin / Σ sets×repMax). */
  repMinTotal: number
  repMaxTotal: number
  exerciseCount: number
  /** Days of the template week with ≥1 exercise for this muscle. */
  gymFrequency: number
}

export function muscleWeekFromMeso(days: MesoDay[]): MuscleWeekRow[] {
  const acc = new Map<string, MuscleWeekRow & { daysSeen: Set<string> }>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const m = ex.muscle
      if (!m || m === 'sport') continue
      let row = acc.get(m)
      if (!row) {
        row = { muscle: m, workingSets: 0, repMinTotal: 0, repMaxTotal: 0, exerciseCount: 0, gymFrequency: 0, daysSeen: new Set() }
        acc.set(m, row)
      }
      row.workingSets += ex.workingSets
      row.repMinTotal += ex.workingSets * ex.repMin
      row.repMaxTotal += ex.workingSets * ex.repMax
      row.exerciseCount += 1
      row.daysSeen.add(d.day)
    }
  }
  return [...acc.values()]
    .map(({ daysSeen, ...row }) => ({ ...row, gymFrequency: daysSeen.size }))
    .sort((a, b) => b.workingSets - a.workingSets || a.muscle.localeCompare(b.muscle))
}

export interface MuscleRegionGroup { region: RegionKey; label: string; rows: MuscleWeekRow[] }

/** Card-grid grouping: fixed region order, empty regions omitted. */
export function muscleRegionGroups(rows: MuscleWeekRow[]): MuscleRegionGroup[] {
  return REGION_ORDER
    .map((region) => ({ region, label: REGION_LABELS[region], rows: rows.filter((r) => muscleRegion(r.muscle) === region) }))
    .filter((g) => g.rows.length > 0)
}
```

- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/muscleWeek.{ts,test.ts} && git commit -m "feat(train): muscleWeek per-muscle weekly aggregation (mezo-ly27)"`

---

### Task 3: `sportMuscleLoad.ts` — static sport/run → muscle heuristic

**Files:**
- Create: `frontend/src/features/train/logic/sportMuscleLoad.ts`
- Test: `frontend/src/features/train/logic/sportMuscleLoad.test.ts`

**Interfaces:**
- Consumes: `VolleyballSession` from `@/data/types`; `RunPrescribedSession` from `@/data/train/runningApi`; `sportOf`, `SPORT_LABELS`, `SPORT_TAGS` from `@/features/train/logic/sportKinds`; Task 1 region helpers; `DAY_ORDER` from `@/data/train/train`.
- Produces:
  - `type SportLoadKind = 'volleyball' | 'cross' | 'trx' | 'run-steady' | 'run-sprint'`
  - `type LoadLevel = 1 | 2 | 3`
  - `interface MuscleLoadSource { kind: SportLoadKind; label: string; load: LoadLevel; count: number }` (label: `Röpi`/`Cross`/`TRX`/`futás`)
  - `interface SportLoadEvent { kind: SportLoadKind; tag: string; title: string; day: string; time: string | null; regionLoads: { region: RegionKey; label: string; load: LoadLevel }[] }`
  - `interface SportLoadResult { perMuscle: Record<string, MuscleLoadSource[]>; events: SportLoadEvent[] }`
  - `function sportLoadForWeek(slots: VolleyballSession[], runSessions: RunPrescribedSession[]): SportLoadResult`

- [ ] **Step 1: Write the failing test** — `sportMuscleLoad.test.ts`:

```ts
import type { VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'

const slot = (day: string, sport?: VolleyballSession['sport']): VolleyballSession => ({
  day, time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés', ...(sport ? { sport } : {}),
})
const runSession = (kind: string, workSegments: number): RunPrescribedSession => ({
  key: `${kind}-1`, dayOfWeek: 5, timeOfDay: '09:00', label: 'Sprint-intervallum', kind,
  rpeTarget: { min: 8, max: 9 },
  segments: [
    { type: 'warmup', durationSec: 300 },
    ...Array.from({ length: workSegments }, () => ({ type: 'work' as const, durationSec: 15 })),
    { type: 'cooldown', durationSec: 300 },
  ],
})

describe('sportLoadForWeek', () => {
  it('aggregates repeated kinds per muscle with a count', () => {
    const r = sportLoadForWeek([slot('Hét'), slot('Kedd')], [])
    expect(r.perMuscle.shoulder).toEqual([{ kind: 'volleyball', label: 'Röpi', load: 3, count: 2 }])
    expect(r.perMuscle.quad?.[0]).toMatchObject({ load: 2, count: 2 })
  })
  it('maps TRX and sprint-run loads onto their muscles', () => {
    const r = sportLoadForWeek([slot('Sze', 'trx')], [runSession('sprint', 6)])
    expect(r.perMuscle.core).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'trx', load: 3 }),
      expect.objectContaining({ kind: 'run-sprint', load: 1, label: 'futás' }),
    ]))
    expect(r.perMuscle.ham?.[0]).toMatchObject({ kind: 'run-sprint', load: 3 })
  })
  it('emits one event per slot/session with region-aggregated loads', () => {
    const r = sportLoadForWeek([slot('Hét')], [runSession('sprint', 6)])
    expect(r.events).toHaveLength(2)
    const vb = r.events[0]
    expect(vb).toMatchObject({ tag: 'RÖPI', title: 'Röplabda', day: 'Hét', time: '18:00' })
    expect(vb.regionLoads).toEqual([
      { region: 'lav', label: 'Váll', load: 3 },
      { region: 'sage', label: 'Láb', load: 2 },
      { region: 'amber', label: 'Core', load: 1 },
    ])
    const run = r.events[1]
    expect(run).toMatchObject({ tag: 'FUTÁS', title: 'Sprint-intervallum', day: 'Szo', time: '09:00' })
    expect(run.regionLoads[0]).toEqual({ region: 'sage', label: 'Láb', load: 3 })
  })
  it('handles empty inputs', () => {
    expect(sportLoadForWeek([], [])).toEqual({ perMuscle: {}, events: [] })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/train/logic/sportMuscleLoad.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `sportMuscleLoad.ts`:

```ts
// ============================================================
// Mezo · sportMuscleLoad — static per-sport-kind muscle→load heuristic
// (mezo-ly27 muscle-week sheet, spec §1.2). A PRODUCT HEURISTIC, not
// physiology ground truth: honest "~ becslés" labeling in the UI; the
// Phase-3 cross-load engine replaces this table wholesale (train.md §Phase-3).
// Inputs are live in both modes: the weekly sport schedule slots + the
// active running block's current-week prescribed sessions.
// ============================================================
import type { VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { SPORT_LABELS, SPORT_TAGS, sportOf } from '@/features/train/logic/sportKinds'
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from '@/features/train/logic/muscleColors'

export type SportLoadKind = 'volleyball' | 'cross' | 'trx' | 'run-steady' | 'run-sprint'
export type LoadLevel = 1 | 2 | 3

const LOAD_TABLE: Record<SportLoadKind, Record<string, LoadLevel>> = {
  volleyball: { shoulder: 3, 'rear-delt': 1, quad: 2, calf: 2, core: 1 },
  cross: { quad: 2, glute: 2, core: 2, shoulder: 1, triceps: 1 },
  trx: { core: 3, 'back-mid': 2, lats: 1, biceps: 1, triceps: 1, shoulder: 1 },
  'run-steady': { quad: 2, ham: 1, calf: 2, core: 1 },
  'run-sprint': { quad: 3, ham: 3, glute: 2, calf: 2, core: 1 },
}
const KIND_CHIP_LABELS: Record<SportLoadKind, string> = {
  volleyball: SPORT_LABELS.volleyball, cross: SPORT_LABELS.cross, trx: SPORT_LABELS.trx,
  'run-steady': 'futás', 'run-sprint': 'futás',
}
const KIND_TITLES: Record<'volleyball' | 'cross' | 'trx', string> = {
  volleyball: 'Röplabda', cross: 'Cross training', trx: 'TRX köredzés',
}

export interface MuscleLoadSource { kind: SportLoadKind; label: string; load: LoadLevel; count: number }
export interface SportLoadEvent {
  kind: SportLoadKind
  tag: string
  title: string
  day: string
  time: string | null
  regionLoads: { region: RegionKey; label: string; load: LoadLevel }[]
}
export interface SportLoadResult { perMuscle: Record<string, MuscleLoadSource[]>; events: SportLoadEvent[] }

const runKind = (kind: string): SportLoadKind =>
  kind === 'sprint' || kind === 'pyramid' ? 'run-sprint' : 'run-steady'

/** Region-aggregated loads of one kind's table row (max load per region, fixed order). */
function regionLoads(kind: SportLoadKind): SportLoadEvent['regionLoads'] {
  const byRegion = new Map<RegionKey, LoadLevel>()
  for (const [muscle, load] of Object.entries(LOAD_TABLE[kind])) {
    const region = muscleRegion(muscle)
    if (!region) continue
    byRegion.set(region, Math.max(byRegion.get(region) ?? 0, load) as LoadLevel)
  }
  return REGION_ORDER.filter((r) => byRegion.has(r))
    .map((region) => ({ region, label: REGION_LABELS[region], load: byRegion.get(region)! }))
}

export function sportLoadForWeek(slots: VolleyballSession[], runSessions: RunPrescribedSession[]): SportLoadResult {
  const perMuscle: Record<string, MuscleLoadSource[]> = {}
  const events: SportLoadEvent[] = []

  const addEvent = (kind: SportLoadKind, tag: string, title: string, day: string, time: string | null) => {
    events.push({ kind, tag, title, day, time, regionLoads: regionLoads(kind) })
    for (const [muscle, load] of Object.entries(LOAD_TABLE[kind])) {
      const sources = (perMuscle[muscle] ??= [])
      const existing = sources.find((s) => s.kind === kind)
      if (existing) existing.count += 1
      else sources.push({ kind, label: KIND_CHIP_LABELS[kind], load, count: 1 })
    }
  }

  for (const slot of slots) {
    const sport = sportOf(slot)
    addEvent(sport, SPORT_TAGS[sport], KIND_TITLES[sport], slot.day, slot.time || null)
  }
  for (const s of runSessions) {
    addEvent(runKind(s.kind), 'FUTÁS', s.label, DAY_ORDER[s.dayOfWeek] ?? '', s.timeOfDay ?? null)
  }
  for (const sources of Object.values(perMuscle)) sources.sort((a, b) => b.load - a.load)
  return { perMuscle, events }
}
```

- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/sportMuscleLoad.{ts,test.ts} && git commit -m "feat(train): static sport/run muscle-load heuristic (mezo-ly27)"`

---

### Task 4: `growthForecast.ts` — planned week → XP estimate

**Files:**
- Create: `frontend/src/features/train/logic/growthForecast.ts`
- Test: `frontend/src/features/train/logic/growthForecast.test.ts`

**Interfaces:**
- Consumes: `MesoDay`, `VolleyballSession` from `@/data/types`; `RunPrescribedSession` from `@/data/train/runningApi`; `SkillLevel` from `@/data/progression/progressionApi`; `sportOf` from `@/features/train/logic/sportKinds`.
- Produces:
  - `function xpThreshold(level: number): number`
  - `interface ForecastSkill { skillKey: string; xpEst: number; level: number; progressPct: number; willLevelUp: boolean }`
  - `interface GrowthForecast { skills: ForecastSkill[]; muscleXp: Record<string, number> }`
  - `function growthForecast(input: { days: MesoDay[]; slots: VolleyballSession[]; runSessions: RunPrescribedSession[]; athletic: SkillLevel[] }): GrowthForecast`

- [ ] **Step 1: Write the failing test** — `growthForecast.test.ts`:

```ts
import type { GymExercise, MesoDay, VolleyballSession } from '@/data/types'
import type { SkillLevel } from '@/data/progression/progressionApi'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { growthForecast, xpThreshold } from '@/features/train/logic/growthForecast'

let n = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `ex-${n++}`, name: `${muscle}-${n}`, muscle, warmupSets: 1, workingSets,
  repMin: 8, repMax: 12, targetRIR: 2, type: 'compound', ...over,
})
const day = (exercises: GymExercise[]): MesoDay => ({
  day: 'Hét', type: 'Day', muscle: 'chest', exerciseCount: exercises.length, exercises,
})
const skill = (skillKey: string, level: number, cumulativeXp: number): SkillLevel => ({
  skillKey, kind: 'ATHLETIC', level, cumulativeXp, progressPct: 50,
})
const empty = { days: [], slots: [], runSessions: [], athletic: [] }

describe('xpThreshold', () => {
  it('mirrors the backend curve (base 100, exp 1.6)', () => {
    expect(xpThreshold(1)).toBe(0)
    expect(xpThreshold(2)).toBe(100)
    expect(xpThreshold(4)).toBe(Math.round(100 * 3 ** 1.6)) // 580
  })
})

describe('growthForecast — gym', () => {
  it('estimates muscle volume XP, max_strength and strength_endurance from anchored recipes', () => {
    // chest 3×(8–12) @100kg: repMid 10 → volume 3000 → 300 muscle XP;
    // e1RM 100*(1+10/30)=133.33 → floor → 133 → 266 max_strength; endurance 3×8=24.
    const f = growthForecast({ ...empty, days: [day([ex('chest', 3, { anchorWeightKg: 100 })])] })
    expect(f.muscleXp.chest).toBe(300)
    expect(f.skills.find((s) => s.skillKey === 'max_strength')?.xpEst).toBe(266)
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(24)
  })
  it('skips volume/e1RM for anchor-less exercises but keeps endurance', () => {
    const f = growthForecast({ ...empty, days: [day([ex('chest', 3)])] })
    expect(f.muscleXp.chest).toBeUndefined()
    expect(f.skills.find((s) => s.skillKey === 'max_strength')).toBeUndefined()
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(24)
  })
  it('counts plyo as bodyweight reps', () => {
    // plyo 3×(4–6): repMid 5 → 15 reps ×1 XP
    const f = growthForecast({ ...empty, days: [day([ex('quad', 3, { type: 'plyo', repMin: 4, repMax: 6 })])] })
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(15)
  })
})

describe('growthForecast — sport + run', () => {
  const slot = (sport?: VolleyballSession['sport']): VolleyballSession => ({
    day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés', ...(sport ? { sport } : {}),
  })
  it('volleyball defaults: 3 sets, RPE 7, duration from slot', () => {
    const f = growthForecast({ ...empty, slots: [slot()] })
    expect(f.skills.find((s) => s.skillKey === 'vertical_jump')?.xpEst).toBe(36)
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')?.xpEst).toBe(42)
    expect(f.skills.find((s) => s.skillKey === 'aerobic_capacity')?.xpEst).toBe(360)
  })
  it('sprint run: rounds from work segments, RPE mid from target', () => {
    const rs: RunPrescribedSession = {
      key: 's1', dayOfWeek: 5, timeOfDay: null, label: 'Sprint', kind: 'sprint',
      rpeTarget: { min: 8, max: 9 },
      segments: Array.from({ length: 6 }, () => ({ type: 'work', durationSec: 15 })),
    }
    const f = growthForecast({ ...empty, runSessions: [rs] })
    expect(f.skills.find((s) => s.skillKey === 'sprint_speed')?.xpEst).toBe(150)
    expect(f.skills.find((s) => s.skillKey === 'anaerobic_capacity')?.xpEst).toBe(90)
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')?.xpEst).toBe(Math.round(8.5) * 6)
  })
  it('steady run: minutes from segments (default 30 when none)', () => {
    const rs: RunPrescribedSession = {
      key: 's2', dayOfWeek: 3, timeOfDay: null, label: 'Steady', kind: 'steady',
      rpeTarget: { min: 5, max: 6 }, segments: [{ type: 'work', durationSec: 1800 }],
    }
    const f = growthForecast({ ...empty, runSessions: [rs] })
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(120)
    expect(f.skills.find((s) => s.skillKey === 'aerobic_capacity')?.xpEst).toBe(150)
  })
})

describe('growthForecast — levels', () => {
  it('flags willLevelUp against the profile skill and sorts by xpEst desc', () => {
    // vertical_jump Lv3 @300 XP: threshold(4)=580 → 36 XP won't flip; explosiveness Lv1 @70: threshold(2)=100 → 42 flips.
    const f = growthForecast({
      ...empty,
      slots: [{ day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés' }],
      athletic: [skill('vertical_jump', 3, 300), skill('explosiveness', 1, 70)],
    })
    expect(f.skills.find((s) => s.skillKey === 'vertical_jump')).toMatchObject({ level: 3, willLevelUp: false })
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')).toMatchObject({ level: 1, willLevelUp: true })
    const xps = f.skills.map((s) => s.xpEst)
    expect([...xps].sort((a, b) => b - a)).toEqual(xps)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/train/logic/growthForecast.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `growthForecast.ts`:

```ts
// ============================================================
// Mezo · growthForecast — planned week → estimated athletic/muscle XP
// (mezo-ly27 muscle-week sheet, spec §1.3). MIRRORS the backend economy:
// AUTHORITATIVE SOURCE = backend/src/main/resources/application.yml
// (mezo.progression.*) + ProgressionService.applyGym/applyRun/applySport.
// Keep ECONOMY in sync by hand — drift is accepted (the whole surface is
// "~ becslés"); revisit a forecast endpoint if it becomes a pain (spec §5).
// NOT forecast: PR/HR bonuses, robustness streak, quest/activity/habit XP.
// ============================================================
import type { MesoDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import type { SkillLevel } from '@/data/progression/progressionApi'
import { sportOf } from '@/features/train/logic/sportKinds'

const ECONOMY = {
  curve: { base: 100, exp: 1.6 },
  gym: { volumeUnit: 100, volumeXpPerUnit: 10, e1rmXpPerKg: 2, strengthEnduranceXpPerSet: 8, bodyweightXpPerRep: 1 },
  run: { sprintXpPerRound: 25, anaerobicXpPerRound: 15, steadyXpPerMin: 4, aerobicXpPerMin: 5, rpeXpPerPoint: 6 },
  sport: { xpPerSet: 12, xpPerRound: 14, xpPerMin: 4, rpeXpPerPoint: 6 },
  defaults: { volleyballSets: 3, rounds: 4, rpe: 7, steadyMin: 30 },
} as const

/** Cumulative XP required to BE at `level` — mirrors ProgressionCurve.xpThreshold. */
export function xpThreshold(level: number): number {
  return level <= 1 ? 0 : Math.round(ECONOMY.curve.base * (level - 1) ** ECONOMY.curve.exp)
}

export interface ForecastSkill {
  skillKey: string
  xpEst: number
  level: number
  progressPct: number
  willLevelUp: boolean
}
export interface GrowthForecast {
  /** Athletic skills with est. XP > 0, sorted by xpEst desc. */
  skills: ForecastSkill[]
  /** Muscle key → estimated weekly volume XP (rendered in the muscle rows, not as skills). */
  muscleXp: Record<string, number>
}

export function growthForecast(input: {
  days: MesoDay[]
  slots: VolleyballSession[]
  runSessions: RunPrescribedSession[]
  athletic: SkillLevel[]
}): GrowthForecast {
  const athleticXp = new Map<string, number>()
  const muscleXp: Record<string, number> = {}
  const add = (skill: string, xp: number) => {
    if (xp > 0) athleticXp.set(skill, (athleticXp.get(skill) ?? 0) + xp)
  }
  const g = ECONOMY.gym

  // Gym — per template day (mirrors applyGym: per-workout volume/e1RM/set tallies).
  for (const d of input.days) {
    const volumeByMuscle = new Map<string, number>()
    let bestE1rm = 0
    let workSets = 0
    let bwReps = 0
    for (const ex of d.exercises) {
      if (!ex.muscle || ex.muscle === 'sport') continue
      const repMid = (ex.repMin + ex.repMax) / 2
      if (ex.type === 'plyo') {
        bwReps += ex.workingSets * repMid
        continue
      }
      workSets += ex.workingSets
      if (ex.anchorWeightKg) {
        volumeByMuscle.set(ex.muscle, (volumeByMuscle.get(ex.muscle) ?? 0) + ex.workingSets * repMid * ex.anchorWeightKg)
        bestE1rm = Math.max(bestE1rm, ex.anchorWeightKg * (1 + repMid / 30)) // Epley
      }
    }
    for (const [muscle, volume] of volumeByMuscle) {
      const xp = Math.floor(volume / g.volumeUnit) * g.volumeXpPerUnit
      if (xp > 0) muscleXp[muscle] = (muscleXp[muscle] ?? 0) + xp
    }
    if (bestE1rm > 0) add('max_strength', Math.floor(bestE1rm) * g.e1rmXpPerKg)
    add('strength_endurance', workSets * g.strengthEnduranceXpPerSet + Math.floor(bwReps) * g.bodyweightXpPerRep)
  }

  // Sport — per planned slot (mirrors applySport; plan has no sets/rounds/RPE → defaults).
  const sp = ECONOMY.sport
  const { volleyballSets, rounds, rpe } = ECONOMY.defaults
  for (const slot of input.slots) {
    switch (sportOf(slot)) {
      case 'cross':
        add('anaerobic_capacity', rounds * sp.xpPerRound)
        add('strength_endurance', rounds * sp.xpPerRound)
        add('explosiveness', rpe * sp.rpeXpPerPoint)
        add('core_stability', rpe * sp.rpeXpPerPoint)
        break
      case 'trx':
        add('core_stability', rounds * sp.xpPerRound)
        add('strength_endurance', rounds * sp.xpPerRound)
        add('anaerobic_capacity', rpe * sp.rpeXpPerPoint)
        add('mobility', slot.duration * sp.xpPerMin)
        break
      default: // volleyball
        add('vertical_jump', volleyballSets * sp.xpPerSet)
        add('agility', volleyballSets * sp.xpPerSet)
        add('coordination', volleyballSets * sp.xpPerSet)
        add('explosiveness', rpe * sp.rpeXpPerPoint)
        add('aerobic_capacity', slot.duration * sp.xpPerMin)
    }
  }

  // Running — per prescribed session of the current block week (mirrors applyRun).
  const r = ECONOMY.run
  for (const s of input.runSessions) {
    const rpeMid = Math.round((s.rpeTarget.min + s.rpeTarget.max) / 2)
    if (s.kind === 'sprint' || s.kind === 'pyramid') {
      const workRounds = s.segments.filter((seg) => seg.type === 'work').length || ECONOMY.defaults.rounds
      add('sprint_speed', workRounds * r.sprintXpPerRound)
      add('anaerobic_capacity', workRounds * r.anaerobicXpPerRound)
      add('explosiveness', rpeMid * r.rpeXpPerPoint)
    } else {
      const min = Math.round(s.segments.reduce((acc, seg) => acc + seg.durationSec, 0) / 60) || ECONOMY.defaults.steadyMin
      add('strength_endurance', min * r.steadyXpPerMin)
      add('aerobic_capacity', min * r.aerobicXpPerMin)
    }
  }

  const byKey = new Map(input.athletic.map((s) => [s.skillKey, s]))
  const skills = [...athleticXp.entries()]
    .map(([skillKey, xpEst]) => {
      const row = byKey.get(skillKey)
      const level = row?.level ?? 1
      const cumulativeXp = row?.cumulativeXp ?? 0
      return {
        skillKey, xpEst, level,
        progressPct: row?.progressPct ?? 0,
        willLevelUp: cumulativeXp + xpEst >= xpThreshold(level + 1),
      }
    })
    .sort((a, b) => b.xpEst - a.xpEst || a.skillKey.localeCompare(b.skillKey))
  return { skills, muscleXp }
}
```

- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/growthForecast.{ts,test.ts} && git commit -m "feat(train): growth XP forecast from the planned week (mezo-ly27)"`

---

### Task 5: `MuscleWeekSheet`

**Files:**
- Create: `frontend/src/features/train/sheets/MuscleWeekSheet.tsx`
- Test: `frontend/src/features/train/sheets/MuscleWeekSheet.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4 functions; `Sheet` from `@/shared/ui/Sheet`; `useRunning`, `useProgressionProfile` from `@/data/hooks`; `muscleColor` (Task 1 file); `MUSCLE_LABELS`, `DAY_LABELS` from `@/data/train/train`; `ATHLETIC_META` from `@/features/progression/logic/levelUpMeta`; types `Mesocycle`, `VolleyballSession` from `@/data/types`.
- Produces: `MuscleWeekSheet({ meso, sportSlots, onClose })` — mounted conditionally by `GymPage` (Task 6).

- [ ] **Step 1: Write the failing test** — `MuscleWeekSheet.test.tsx` (mock mode: `useRunning` serves the active block fixture, `useProgressionProfile` the seeded profile):

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
import { QueryWrapper } from '@/test/queryWrapper'
import type { Mesocycle, VolleyballSession } from '@/data/types'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const meso: Mesocycle = {
  id: 'm1', status: 'active', title: 'Hypertrophy', shortTitle: 'Hyper', goal: 'hipertrófia',
  startDate: 'Júl 13', endDate: 'Aug 24', weeks: 6, currentWeek: 1,
  split: 'Custom split · 4×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  days: [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 1,
    exercises: [{ id: 'e1', name: 'Bench', muscle: 'chest', warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2, type: 'compound', anchorWeightKg: 100 }],
  }],
}
const slots: VolleyballSession[] = [{ day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés' }]

const renderSheet = () =>
  render(<QueryWrapper><MuscleWeekSheet meso={meso} sportSlots={slots} onClose={() => {}} /></QueryWrapper>)

test('renders header + the three sections', () => {
  renderSheet()
  expect(screen.getByRole('heading', { name: 'Heti izomterhelés' })).toBeInTheDocument()
  expect(screen.getByText('Izomcsoportok')).toBeInTheDocument()
  expect(screen.getByText('Sport & futás terhelés')).toBeInTheDocument()
  expect(screen.getByText('Growth előrejelzés')).toBeInTheDocument()
})

test('muscle row shows sets, weekly reps, exercise count and stimulus chips', () => {
  renderSheet()
  expect(screen.getByText('Mell')).toBeInTheDocument()
  expect(screen.getByText('24–36 rep · 1 gyakorlat')).toBeInTheDocument()
  expect(screen.getByText('1×/hét gym')).toBeInTheDocument()
  expect(screen.getByText('+~300 XP')).toBeInTheDocument()
})

test('sport event card renders with region loads; forecast lists volleyball skills', () => {
  renderSheet()
  expect(screen.getByText('RÖPI')).toBeInTheDocument()
  expect(screen.getByText('Váll ▲▲▲')).toBeInTheDocument()
  expect(screen.getByText('Vertikális emelkedés')).toBeInTheDocument()
  expect(screen.getByText('Maximális erő')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/train/sheets/MuscleWeekSheet.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — `MuscleWeekSheet.tsx`:

```tsx
// ============================================================
// Mezo · MuscleWeekSheet — weekly per-muscle load detail for the GymPage
// meta card (mezo-ly27, spec 2026-07-24-muscle-week-sheet-design.md).
// ① per-muscle sets/reps/exercises/stimulus (muscleWeek), ② planned
// sport+run events → muscle load (sportMuscleLoad heuristic), ③ Growth
// athletic-skill XP forecast (growthForecast, "~ becslés"). The sheet owns
// the lazy queries (useRunning/useProgressionProfile) so GymPage's mount
// stays cheap; meso + sport slots arrive as props from useTrain data the
// page already holds.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { useProgressionProfile, useRunning } from '@/data/hooks'
import type { Mesocycle, VolleyballSession } from '@/data/types'
import { DAY_LABELS, MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { growthForecast } from '@/features/train/logic/growthForecast'
import { ATHLETIC_META } from '@/features/progression/logic/levelUpMeta'

interface MuscleWeekSheetProps {
  meso: Mesocycle
  /** The weekly sport schedule slots ([] when no schedule). */
  sportSlots: VolleyballSession[]
  onClose: () => void
}

const tri = (n: number) => '▲'.repeat(n)

function SectionHead({ color, title, sub }: { color: string; title: string; sub: string }) {
  return (
    <div style={{ margin: '26px 0 12px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span style={{ width: 14, height: 3, borderRadius: 2, background: color }} />
        {/* textTransform keeps the DOM text mixed-case (testable) while rendering uppercase. */}
        <span className="label-mono" style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', margin: '4px 0 0 21px' }}>{sub}</div>
    </div>
  )
}

export function MuscleWeekSheet({ meso, sportSlots, onClose }: MuscleWeekSheetProps) {
  const { activeRunningBlock } = useRunning()
  const { data: profile } = useProgressionProfile()

  const days = meso.days ?? []
  const runSessions = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []
  const rows = muscleWeekFromMeso(days)
  const load = sportLoadForWeek(sportSlots, runSessions)
  const forecast = growthForecast({ days, slots: sportSlots, runSessions, athletic: profile?.athletic ?? [] })
  const phase = meso.phaseCurve[meso.currentWeek - 1]

  return (
    <Sheet onClose={onClose} labelledBy="muscle-week-title">
      {() => (
        <>
          <div className="eyebrow brand">Gym · W{meso.currentWeek} / {meso.weeks}{phase ? ` · ${phase}` : ''}</div>
          <h2 id="muscle-week-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 800, margin: '3px 0 0' }}>
            Heti izomterhelés
          </h2>

          {/* ① Izomcsoportok */}
          <SectionHead color="var(--tag-gym)" title="Izomcsoportok" sub="szett · rep · gyakorlat · stimulus — a heti splitből" />
          <div className="col" style={{ gap: 8 }}>
            {rows.map((r) => {
              const fam = muscleColor(r.muscle)
              const sources = load.perMuscle[r.muscle] ?? []
              const xp = forecast.muscleXp[r.muscle]
              return (
                <div key={r.muscle} className="row" style={{
                  gap: 12, borderRadius: 14, background: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)', borderLeft: `5px solid ${fam.rail}`,
                  padding: '12px 14px', alignItems: 'flex-start',
                }}>
                  <div className="col flex-1" style={{ minWidth: 0, gap: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: fam.deep }}>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {r.repMinTotal}–{r.repMaxTotal} rep · {r.exerciseCount} gyakorlat
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 9, alignItems: 'center' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: fam.wash, color: fam.deep }}>
                        {r.gymFrequency}×/hét gym
                      </span>
                      {sources.map((s) => (
                        <span key={s.kind} style={{
                          fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                          background: s.kind.startsWith('run') ? 'var(--wash-run)' : 'var(--wash-sport)',
                          color: s.kind.startsWith('run') ? 'var(--tag-run)' : 'var(--tag-sport)',
                        }}>
                          {tri(s.load)} {s.label}{s.count > 1 ? ` ×${s.count}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 62, paddingTop: 2 }}>
                    <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{r.workingSets}</div>
                    <div className="label-mono text-tertiary" style={{ fontSize: 8.5, marginTop: 3 }}>SZETT</div>
                    {xp ? <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--tag-gym)', marginTop: 8 }}>+~{xp} XP</div> : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
            ▲ = sport/futás plusz-stimulus · XP = becslés a tervezett hétből
          </div>

          {/* ② Sport & futás terhelés */}
          <SectionHead color="var(--tag-sport)" title="Sport & futás terhelés" sub="a hét tervezett eseményei izomcsoportokra vetítve" />
          {load.events.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Nincs tervezett sport/futás esemény ezen a héten.</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {load.events.map((e, i) => (
                <div key={`${e.kind}-${e.day}-${i}`} style={{
                  borderRadius: 14, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '12px 14px',
                }}>
                  <div className="row" style={{ alignItems: 'center', gap: 9 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999, letterSpacing: '.06em',
                      background: e.tag === 'FUTÁS' ? 'var(--wash-run)' : 'var(--wash-sport)',
                      color: e.tag === 'FUTÁS' ? 'var(--tag-run)' : 'var(--tag-sport)',
                    }}>{e.tag}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{e.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                      {DAY_LABELS[e.day] ?? e.day}{e.time ? ` · ${e.time}` : ''}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                    {e.regionLoads.map((rl) => {
                      const fam = muscleColor(rl.region === 'coral' ? 'chest' : rl.region === 'sky' ? 'lats' : rl.region === 'lav' ? 'shoulder' : rl.region === 'rose' ? 'biceps' : rl.region === 'sage' ? 'quad' : 'core')
                      return (
                        <span key={rl.region} style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: fam.wash, color: fam.deep }}>
                          {rl.label} {tri(rl.load)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ③ Growth előrejelzés */}
          <SectionHead color="var(--lav-deep)" title="Growth előrejelzés" sub="várható skill-fejlődés a tervezett hét alapján" />
          {forecast.skills.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Még nincs előrejelzés ehhez a héthez.</div>
          ) : (
            <div className="col" style={{ gap: 0 }}>
              {forecast.skills.map((s, i) => {
                const meta = ATHLETIC_META[s.skillKey]
                return (
                  <div key={s.skillKey} className="row" style={{
                    alignItems: 'center', gap: 12, padding: '11px 2px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: '50%', background: 'var(--wash-lav)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none',
                    }}>{meta?.icon ?? '✨'}</span>
                    <div className="col flex-1" style={{ minWidth: 0, gap: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{meta?.name ?? s.skillKey}</div>
                      <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${s.progressPct}%`, background: 'var(--lav)', borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 800, color: 'var(--tag-gym)' }}>+~{s.xpEst}</div>
                      {s.willLevelUp && (
                        <span style={{
                          display: 'inline-block', fontSize: 9, fontWeight: 800, color: 'var(--sage-deep)',
                          background: 'var(--wash-sage)', padding: '2px 7px', borderRadius: 999, marginTop: 4,
                        }}>Lv {s.level} → {s.level + 1} ↗</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
            ~ becslés a tervezett hét alapján — a valós XP a logolt teljesítményből számolódik
          </div>
        </>
      )}
    </Sheet>
  )
}
```

Implementation note: the ② region-chip color lookup goes through a representative muscle per region — if this reads awkwardly, add `export function regionColor(region: RegionKey): MuscleColorFamily` to `muscleColors.ts` (`FAMILIES[region]`) and use that instead; prefer the helper if `tsc`/review flags the ternary chain.

- [ ] **Step 4: Run to verify pass** — same command → PASS. If an assertion mismatches on copy, fix the component (the test copy is the spec).
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/sheets/MuscleWeekSheet.{tsx,test.tsx} && git commit -m "feat(train): MuscleWeekSheet weekly muscle-load detail (mezo-ly27)"`

---

### Task 6: GymPage integration — region grid + tappable card

**Files:**
- Modify: `frontend/src/features/train/pages/GymPage.tsx`
- Test: `frontend/src/features/train/pages/GymPage.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 2 `muscleWeekFromMeso`/`muscleRegionGroups`; Task 5 `MuscleWeekSheet`; `muscleColor` from Task 1's file; `MUSCLE_LABELS` from `@/data/train/train`; `useTrain().sport`.
- Produces: the meta card as a `<button>` (`aria-label="Heti izomterhelés — részletek"`) opening the sheet.

- [ ] **Step 1: Write the failing tests** — append to `GymPage.test.tsx` (mock-mode block, next to the existing card tests):

```tsx
// add `within` to the existing @testing-library/react import
test('meta card shows the region-grouped muscle grid', () => {
  renderView()
  const card = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  // The mock meso trains ham/glute/calf → the sage region label "Láb" is on the card.
  expect(within(card).getByText('Láb')).toBeInTheDocument()
  // Pills carry "{label} {sets}" — the lats pill (Lat Pulldown, 3 working sets).
  expect(within(card).getByText(/^Lat \d+$/)).toBeInTheDocument()
})

test('tapping the meta card opens the MuscleWeekSheet', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Heti izomterhelés — részletek' }))
  expect(screen.getByRole('heading', { name: 'Heti izomterhelés' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/train/pages/GymPage.test.tsx` → the two new tests FAIL.

- [ ] **Step 3: Implement** — in `GymPage.tsx`:

1. Extend imports:

```tsx
import { Fragment } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { muscleRegionGroups, muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
```

2. Destructure `sport` from `useTrain()` and add state:

```tsx
const { activeMeso, gymSlots, saveGymSchedule, workoutPending, todaySession, sport } = useTrain()
const [muscleOpen, setMuscleOpen] = useState(false)
```

3. Compute after `totalSets`:

```tsx
const muscleGroups = muscleRegionGroups(muscleWeekFromMeso(days))
```

4. Replace the meta-card wrapper `<div className="card" style={{ padding: 16 }}>…</div>` with a button (content unchanged), insert the grid between the stat row and the footer row, and add a hint under the card:

```tsx
<button
  type="button"
  className="card np-press"
  onClick={() => setMuscleOpen(true)}
  aria-label="Heti izomterhelés — részletek"
  style={{ padding: 16, width: '100%', textAlign: 'left', display: 'block' }}
>
  {/* existing stat row unchanged */}
  {muscleGroups.length > 0 && (
    <div style={{
      marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
      display: 'grid', gridTemplateColumns: '44px 1fr', rowGap: 8, columnGap: 8, alignItems: 'baseline',
    }}>
      {muscleGroups.map((g) => (
        <Fragment key={g.region}>
          <span className="label-mono" style={{ fontSize: 8.5, fontWeight: 800, color: muscleColor(g.rows[0].muscle).deep }}>
            {g.label}
          </span>
          <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {g.rows.map((r) => {
              const fam = muscleColor(r.muscle)
              return (
                <span key={r.muscle} style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  background: fam.wash, color: fam.deep, whiteSpace: 'nowrap',
                }}>
                  {MUSCLE_LABELS[r.muscle] ?? r.muscle} {r.workingSets}
                </span>
              )
            })}
          </span>
        </Fragment>
      ))}
    </div>
  )}
  {/* existing footer row (dates + PhaseDots) unchanged */}
</button>
<div className="label-mono text-tertiary" style={{ fontSize: 9, textAlign: 'center', marginTop: 8 }}>
  tap → heti izomterhelés
</div>
```

5. Mount the sheet next to the existing ones:

```tsx
{muscleOpen && activeMeso && (
  <MuscleWeekSheet
    meso={activeMeso}
    sportSlots={sport.schedule?.volleyball.sessions ?? []}
    onClose={() => setMuscleOpen(false)}
  />
)}
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run src/features/train/pages/GymPage.test.tsx` → PASS (existing tests must stay green — the card content is unchanged, only its wrapper element changed).
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/pages/GymPage.{tsx,test.tsx} && git commit -m "feat(train): region muscle grid on the gym meta card + sheet opener (mezo-ly27)"`

---

### Task 7: Docs + full gates

**Files:**
- Modify: `docs/features/train.md` (§2 Gym paragraph, §Phase-3 note, file map)
- Run: doc lint + full FE gates

- [ ] **Step 1: Update `docs/features/train.md`:**
  - §2 `Gym` paragraph: after the meta-stats sentence, describe the region-grouped muscle grid on the (now tappable) meta card and the `MuscleWeekSheet` (three sections, what feeds each, the `~ becslés` labeling, lazy `useRunning`/`useProgressionProfile` in the sheet, props from `GymPage`). Reference the spec `docs/superpowers/specs/2026-07-24-muscle-week-sheet-design.md` and `mezo-ly27`.
  - Phase-3 list (§1 status paragraph): note that the **static `sportMuscleLoad` heuristic is the interim** for the live cross-load engine (the mock-only `crossLoad` fixtures remain untouched).
  - File map (§8/§9 area listing `features/train/logic/…` and sheets): add `muscleWeek.ts`, `sportMuscleLoad.ts`, `growthForecast.ts`, `MuscleWeekSheet.tsx` with one-line descriptions.
- [ ] **Step 2: Lint docs** — `node scripts/lint-docs.mjs` → no staleness/lint error for train.md.
- [ ] **Step 3: Full gates** — `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → build green + both modes green.
- [ ] **Step 4: Commit** — `git add docs/features/train.md && git commit -m "docs(train): muscle-week sheet feature doc (mezo-ly27)"`

---

### Task 8: Integration — PR flow

Per CLAUDE.md git workflow (single dev, self-PR as CI gate):

- [ ] **Step 1:** `git push -u origin feat/muscle-week-sheet`
- [ ] **Step 2:** `gh pr create --fill --title "feat(train): gym weekly muscle-load sheet (mezo-ly27)"`
- [ ] **Step 3:** wait for CI green (`gh pr checks --watch`)
- [ ] **Step 4:** `git checkout main && git pull --rebase && git merge --no-ff feat/muscle-week-sheet && git push && git branch -d feat/muscle-week-sheet`
- [ ] **Step 5:** `bd close mezo-ly27` + `bd dolt push` + final `git status` = clean/up-to-date.
