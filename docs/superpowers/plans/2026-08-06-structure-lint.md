# Structure Lint Implementation Plan (mezo-oyhy.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft, explained structural checks (exercises/muscle/session, sets/exercise, frequency, variety, session size, push:pull + ham:quad balance) over the meso week, rendered as a collapsible Struktúra card in the MesoEditor.

**Architecture:** One pure logic module (`structureLint.ts`, thresholds in exported constant tables, muscle→group via the existing `budgetGroup`) + one presentational collapsible card (`StructureLintCard`) + a two-line MesoEditor integration. Never red, never force-opens, never blocks. Spec: `docs/superpowers/specs/2026-08-06-structure-lint-design.md`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library. All under `frontend/`.

## Global Constraints

- Read `docs/references/frontend_conventions.md` first.
- Imports deep + absolute `@/*`; no relative `../`; no new barrels.
- Colors ONLY `var(--…)`/`color-mix(...)`.
- UI copy Hungarian EXACTLY as given below; code/comments/commits English.
- Commit subjects carry the bd id `(mezo-oyhy.2)`.
- Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2`, branch `feat/structure-lint` (already checked out — do NOT create branches).
- Focused tests only per task; NEVER `./mvnw`, never `pnpm dev`; the full gate runs once in Task 2.
- Rule invariants: plyo exercises are exempt from the per-exercise/per-muscle/weekly set math but DO count in session size; off-days (`isOffDay`) and exercise-less days are skipped entirely; muscle→group via `budgetGroup` (null → skip).
- The repo pre-commit hook may force-add a root-level `issues.jsonl`. After every commit run `git show --stat HEAD`; if it appears (repo root, NOT `.beads/issues.jsonl`), fix with `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify`.

---

### Task 1: `structureLint.ts` — the rule engine

**Files:**
- Create: `frontend/src/features/train/logic/structureLint.ts`
- Test: `frontend/src/features/train/logic/structureLint.test.ts`

**Interfaces:**
- Consumes: `budgetGroup`, `BUDGET_GROUP_LABELS` from `@/features/train/logic/setBudget`; `isOffDay` from `@/features/train/logic/offDay`; type `MesoDay` from `@/data/types`.
- Produces (Task 2 relies on these exact names):
  - `export type StructureRuleId = 'exercises-per-muscle' | 'sets-per-exercise' | 'frequency' | 'variety' | 'session-size' | 'push-pull' | 'ham-quad'`
  - `export interface StructureFinding { rule: StructureRuleId; label: string; detail: string; day?: string }`
  - `export function structureLint(days: MesoDay[]): StructureFinding[]`
  - Exported constants: `MAX_EXERCISES_PER_MUSCLE_SESSION_DEFAULT`, `MAX_EXERCISES_PER_MUSCLE_SESSION`, `SETS_PER_EXERCISE`, `FREQUENCY_MIN_WEEKLY_SETS`, `VARIETY_MAX`, `VARIETY_MIN`, `VARIETY_MIN_WEEKLY_SETS`, `SESSION_SIZE`, `PUSH_PULL_BAND`, `HAM_QUAD_MIN`, `HAM_QUAD_QUAD_GATE`, `PUSH_PULL_SIDE`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/logic/structureLint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { structureLint } from '@/features/train/logic/structureLint'

let seq = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `e${seq++}`, name: over.name ?? `X${seq}`, muscle, warmupSets: 1, workingSets,
  repMin: 8, repMax: 10, targetRIR: 2, type: 'compound', ...over,
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })
// A quiet 6-exercise day that trips no rule on its own (2 groups × 2 days handled per test).
const rules = (days: MesoDay[]) => structureLint(days).map((f) => f.rule)

// Balanced 2-day base: every group 2×/week, 3 sets/exercise, 6 exercises/day,
// push:pull ≈ 1:1, ham present vs quad — the clean fixture single tests mutate.
const cleanWeek = (): MesoDay[] => [
  day('Hét', [
    ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
    ex('ham', 3), ex('shoulder-side', 3), ex('biceps-long', 3),
  ]),
  day('Csü', [
    ex('chest-mid', 3, { name: 'B1' }), ex('back-mid', 3, { name: 'B2' }), ex('quad', 3, { name: 'B3' }),
    ex('ham', 3, { name: 'B4' }), ex('triceps-long', 3, { name: 'B5' }), ex('back-wide', 3, { name: 'B6' }),
  ]),
]

describe('clean week', () => {
  it('produces zero findings', () => {
    expect(structureLint(cleanWeek())).toEqual([])
  })
})

describe('exercises-per-muscle (R1)', () => {
  it('flags 4 chest exercises in one session, not 3', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('chest-upper', 2, { name: 'C2' }), ex('chest-lower', 2, { name: 'C3' }))
    expect(rules(w)).not.toContain('exercises-per-muscle') // 3 chest on Hét
    w[0].exercises.push(ex('chest-mid', 2, { name: 'C4', type: 'isolation' }))
    const found = structureLint(w).filter((f) => f.rule === 'exercises-per-muscle')
    expect(found).toHaveLength(1)
    expect(found[0].day).toBe('Hét')
    expect(found[0].label).toContain('Mell')
  })
  it('ham is stricter: 3 hamstring exercises flag, 2 do not', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('ham', 2, { name: 'H2', type: 'isolation' }))
    expect(rules(w)).not.toContain('exercises-per-muscle')
    w[0].exercises.push(ex('ham', 2, { name: 'H3', type: 'isolation' }))
    expect(rules(w)).toContain('exercises-per-muscle')
  })
})

describe('sets-per-exercise (R2)', () => {
  it('flags a 5-set compound and a 1-set compound; 4 and 2 are silent', () => {
    const w = cleanWeek()
    w[0].exercises[0].workingSets = 4
    expect(rules(w)).not.toContain('sets-per-exercise')
    w[0].exercises[0].workingSets = 5
    expect(rules(w)).toContain('sets-per-exercise')
    w[0].exercises[0].workingSets = 1
    expect(rules(w)).toContain('sets-per-exercise')
  })
  it('isolation band is 2–3: a 4-set isolation flags', () => {
    const w = cleanWeek()
    w[0].exercises[5] = ex('biceps-long', 4, { type: 'isolation' })
    expect(rules(w)).toContain('sets-per-exercise')
  })
  it('plyo is exempt at any set count', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('quad', 1, { name: 'Box Jump', type: 'plyo' }))
    expect(rules(w)).not.toContain('sets-per-exercise')
  })
})

describe('frequency (R3)', () => {
  it('flags a group with ≥4 weekly sets all on one day; <4 sets stays silent', () => {
    const w = cleanWeek()
    // biceps only on Hét with 3 sets → below the 4-set gate
    expect(rules(w)).not.toContain('frequency')
    w[0].exercises[5].workingSets = 4 // biceps 4 sets, single day
    const found = structureLint(w).filter((f) => f.rule === 'frequency')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('Bicepsz')
  })
})

describe('variety (R4)', () => {
  it('flags 6 distinct chest movements in the week; 5 silent', () => {
    const w = cleanWeek()
    w[1].exercises.push(
      ex('chest-upper', 2, { name: 'V1' }), ex('chest-lower', 2, { name: 'V2' }), ex('chest-mid', 2, { name: 'V3' }),
    )
    expect(rules(w)).not.toContain('variety') // 5 distinct chest names
    w[1].exercises.push(ex('chest-mid', 2, { name: 'V4', type: 'isolation' }))
    expect(rules(w)).toContain('variety')
  })
  it('flags a single movement carrying ≥6 weekly sets; 1 movement with 4 sets silent', () => {
    const base = [day('Hét', [ex('chest-mid', 2, { name: 'Bench' })]), day('Csü', [ex('chest-mid', 2, { name: 'Bench' })])]
    expect(structureLint(base).filter((f) => f.rule === 'variety')).toHaveLength(0)
    const heavy = [day('Hét', [ex('chest-mid', 3, { name: 'Bench' })]), day('Csü', [ex('chest-mid', 3, { name: 'Bench' })])]
    expect(structureLint(heavy).filter((f) => f.rule === 'variety')).toHaveLength(1)
  })
})

describe('session-size (R5)', () => {
  it('flags a 4-exercise day and a 10-exercise day; 5 and 9 silent', () => {
    const small = cleanWeek()
    small[0].exercises = small[0].exercises.slice(0, 4)
    expect(structureLint(small).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(1)
    const big = cleanWeek()
    big[0].exercises.push(
      ex('glute', 2, { name: 'G1' }), ex('calf', 2, { name: 'G2' }), ex('core', 2, { name: 'G3' }), ex('glute', 2, { name: 'G4', type: 'isolation' }),
    )
    expect(structureLint(big).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(1)
  })
  it('plyo counts as a session slot', () => {
    const w = cleanWeek()
    w[0].exercises = [...w[0].exercises.slice(0, 4), ex('quad', 3, { name: 'Depth Jump', type: 'plyo' })]
    // 5 slots incl. plyo → silent
    expect(structureLint(w).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(0)
  })
})

describe('push-pull (R6)', () => {
  it('stays silent at ratio 1.6, flags above', () => {
    // push 8 (chest), pull 5 (back) → 1.6 exactly → silent
    const edge = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4), ex('back-mid', 5)])]
    expect(structureLint(edge).filter((f) => f.rule === 'push-pull')).toHaveLength(0)
    const over = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 5), ex('back-mid', 5)])]
    const found = structureLint(over).filter((f) => f.rule === 'push-pull')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('1.8')
  })
  it('needs both sides: a legs-only week never flags', () => {
    const legs = [day('Hét', [ex('quad', 4), ex('ham', 3), ex('glute', 3)])]
    expect(structureLint(legs).filter((f) => f.rule === 'push-pull')).toHaveLength(0)
  })
})

describe('ham-quad (R7)', () => {
  it('flags ham:quad 0.33 when quad has ≥6 weekly sets; quad 5 sets silent', () => {
    const flagged = [day('Hét', [ex('quad', 6), ex('ham', 2), ex('chest-mid', 4), ex('back-mid', 4)])]
    const found = structureLint(flagged).filter((f) => f.rule === 'ham-quad')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('0.3')
    const smallQuad = [day('Hét', [ex('quad', 5), ex('ham', 1), ex('chest-mid', 4), ex('back-mid', 4)])]
    expect(structureLint(smallQuad).filter((f) => f.rule === 'ham-quad')).toHaveLength(0)
  })
})

describe('scoping & ordering', () => {
  it('skips off-days and empty days entirely', () => {
    const w = [...cleanWeek(), { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] }]
    expect(structureLint(w)).toEqual([])
  })
  it('session-scoped findings precede weekly ones', () => {
    const w = cleanWeek()
    w[0].exercises[0].workingSets = 5 // session-scoped R2
    w[0].exercises[5].workingSets = 4 // weekly R3 (biceps single-day 4 sets)
    const out = structureLint(w)
    expect(out.findIndex((f) => f.rule === 'sets-per-exercise')).toBeLessThan(out.findIndex((f) => f.rule === 'frequency'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `structureLint.ts`**

```ts
// ============================================================
// Mezo · structureLint — soft structural checks over the meso week
// (mezo-oyhy.2, spec 2026-08-06). Encodes the RP/Helms/Nippard/Ethier
// session- and week-structure consensus (docs/research/concepts/
// program-design-rules.md) plus wide-tolerance push:pull and ham:quad
// balance checks (structural-balance literature — the copy says so).
// Pure derivation; findings are soft observations (never red, never
// blocking) rendered by StructureLintCard. Thresholds live in the
// exported tables below — one place to tune.
// ============================================================
import type { MesoDay } from '@/data/types'
import { BUDGET_GROUP_LABELS, budgetGroup } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'

export type StructureRuleId =
  | 'exercises-per-muscle' | 'sets-per-exercise' | 'frequency'
  | 'variety' | 'session-size' | 'push-pull' | 'ham-quad'

export interface StructureFinding {
  rule: StructureRuleId
  /** Short HU headline. */
  label: string
  /** The why-explanation (HU). */
  detail: string
  /** Set for session-scoped findings. */
  day?: string
}

// Exercises per muscle group per session (RP: 1–3; hams/traps stricter).
export const MAX_EXERCISES_PER_MUSCLE_SESSION_DEFAULT = 3
export const MAX_EXERCISES_PER_MUSCLE_SESSION: Record<string, number> = { ham: 2, traps: 2 }
// Working-set band per exercise kind (plyo exempt).
export const SETS_PER_EXERCISE = { compound: { min: 2, max: 4 }, isolation: { min: 2, max: 3 } } as const
// The frequency rule fires only at/above this weekly set count (splitting less is noise).
export const FREQUENCY_MIN_WEEKLY_SETS = 4
// Weekly distinct exercises per group.
export const VARIETY_MAX = 5
export const VARIETY_MIN = 2
export const VARIETY_MIN_WEEKLY_SETS = 6
// Exercises per training day — plyo counts, it is a real session slot.
export const SESSION_SIZE = { min: 5, max: 9 } as const
// Weekly push:pull working-set ratio silence band; needs both sides > 0.
export const PUSH_PULL_BAND = { min: 0.6, max: 1.6 } as const
// ham:quad floor, checked only when quad weekly sets reach the gate.
export const HAM_QUAD_MIN = 0.4
export const HAM_QUAD_QUAD_GATE = 6

// Muscle key → push/pull side; legs and core are neutral (absent). The legacy
// coarse 'shoulder' maps to push (press-dominant); rear delts pull.
export const PUSH_PULL_SIDE: Record<string, 'push' | 'pull'> = {
  'chest-upper': 'push', 'chest-mid': 'push', 'chest-lower': 'push', chest: 'push',
  'shoulder-front': 'push', 'shoulder-side': 'push', shoulder: 'push',
  'triceps-long': 'push', 'triceps-lateral': 'push', 'triceps-medial': 'push', triceps: 'push',
  'back-wide': 'pull', 'back-mid': 'pull', 'back-lower': 'pull', back: 'pull', lats: 'pull',
  traps: 'pull', 'rear-delt': 'pull', 'shoulder-rear': 'pull',
  'biceps-long': 'pull', 'biceps-short': 'pull', 'biceps-brachialis': 'pull', biceps: 'pull',
}

const groupLabel = (group: string) => BUDGET_GROUP_LABELS[group] ?? group
const ratio1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1)

export function structureLint(days: MesoDay[]): StructureFinding[] {
  const session: StructureFinding[] = []
  const weekly: StructureFinding[] = []
  const training = days.filter((d) => !isOffDay(d) && d.exercises.length > 0)

  const weeklySets = new Map<string, number>()
  const weeklyDays = new Map<string, Set<string>>()
  const weeklyNames = new Map<string, Set<string>>()
  let pushSets = 0
  let pullSets = 0

  for (const d of training) {
    const perGroupExercises = new Map<string, number>()

    for (const ex of d.exercises) {
      if (ex.type === 'plyo') continue
      const group = budgetGroup(ex.muscle)
      if (!group) continue

      perGroupExercises.set(group, (perGroupExercises.get(group) ?? 0) + 1)
      weeklySets.set(group, (weeklySets.get(group) ?? 0) + ex.workingSets)
      if (!weeklyDays.has(group)) weeklyDays.set(group, new Set())
      weeklyDays.get(group)!.add(d.day)
      if (!weeklyNames.has(group)) weeklyNames.set(group, new Set())
      weeklyNames.get(group)!.add(ex.name)

      const side = PUSH_PULL_SIDE[ex.muscle]
      if (side === 'push') pushSets += ex.workingSets
      else if (side === 'pull') pullSets += ex.workingSets

      // R2 — sets per exercise
      const band = SETS_PER_EXERCISE[ex.type]
      if (ex.workingSets < band.min) {
        session.push({
          rule: 'sets-per-exercise', day: d.day,
          label: `${ex.name}: ${ex.workingSets} szett (${d.day}).`,
          detail: '2 szett alatt egy gyakorlat alig ad ingert — a 2 szett teljesen legitim kezdés.',
        })
      } else if (ex.workingSets > band.max) {
        session.push({
          rule: 'sets-per-exercise', day: d.day,
          label: `${ex.name}: ${ex.workingSets} szett (${d.day}).`,
          detail: `${band.max} szett fölött egy gyakorlaton a plusz szett már alig hoz — inkább új gyakorlat vagy másik nap.`,
        })
      }
    }

    // R1 — exercises per muscle group in this session
    for (const [group, n] of perGroupExercises) {
      const max = MAX_EXERCISES_PER_MUSCLE_SESSION[group] ?? MAX_EXERCISES_PER_MUSCLE_SESSION_DEFAULT
      if (n > max) {
        session.push({
          rule: 'exercises-per-muscle', day: d.day,
          label: `${groupLabel(group)}: ${n} gyakorlat egy edzésen (${d.day}).`,
          detail: '1–3 gyakorlat izmonként edzésenként a hatékony sáv — kevesebb gyakorlat jól csinálva többet ér, mint a variálás.',
        })
      }
    }

    // R5 — session size (ALL exercises, plyo included: it is a session slot)
    const size = d.exercises.length
    if (size < SESSION_SIZE.min) {
      session.push({
        rule: 'session-size', day: d.day,
        label: `${d.day}: csak ${size} gyakorlat.`,
        detail: 'A bevált sablonok 5–9 gyakorlattal dolgoznak edzésenként.',
      })
    } else if (size > SESSION_SIZE.max) {
      session.push({
        rule: 'session-size', day: d.day,
        label: `${d.day}: ${size} gyakorlat.`,
        detail: '9 fölött a session vége már fáradtan megy — oszd el, vagy húzd meg.',
      })
    }
  }

  // R3 — frequency
  for (const [group, sets] of weeklySets) {
    if (sets >= FREQUENCY_MIN_WEEKLY_SETS && (weeklyDays.get(group)?.size ?? 0) === 1) {
      weekly.push({
        rule: 'frequency',
        label: `${groupLabel(group)}: minden heti szett egy napon.`,
        detail: 'Ugyanez a volumen ≥2 napra elosztva akár ~30%-kal gyorsabb fejlődést hozhat.',
      })
    }
  }

  // R4 — variety
  for (const [group, names] of weeklyNames) {
    const sets = weeklySets.get(group) ?? 0
    if (names.size > VARIETY_MAX) {
      weekly.push({
        rule: 'variety',
        label: `${groupLabel(group)}: ${names.size} különböző gyakorlat a héten.`,
        detail: '5 fölött a variálás már a progressziót nehezíti — kevesebb mozdulat, jobban csinálva.',
      })
    } else if (names.size < VARIETY_MIN && sets >= VARIETY_MIN_WEEKLY_SETS) {
      weekly.push({
        rule: 'variety',
        label: `${groupLabel(group)}: 1 gyakorlat egész héten.`,
        detail: 'Heti 2–5 különböző gyakorlat izmonként fedi le a szögeket — egy másik variáció beférne.',
      })
    }
  }

  // R6 — push:pull
  if (pushSets > 0 && pullSets > 0) {
    const ratio = pushSets / pullSets
    if (ratio < PUSH_PULL_BAND.min || ratio > PUSH_PULL_BAND.max) {
      weekly.push({
        rule: 'push-pull',
        label: `Push:pull arány ${ratio1(ratio)}.`,
        detail: 'A ≈1:1 heti tolóerő-húzóerő arány védi a vállat (strukturális-balansz irodalom, nem RP-szabály).',
      })
    }
  }

  // R7 — ham:quad
  const quad = weeklySets.get('quad') ?? 0
  const ham = weeklySets.get('ham') ?? 0
  if (quad >= HAM_QUAD_QUAD_GATE && ham / quad < HAM_QUAD_MIN) {
    weekly.push({
      rule: 'ham-quad',
      label: `Ham:quad arány ${ratio1(ham / quad)}.`,
      detail: 'A hátsó comb a quad-volumen ~0.6–0.8-szorosát kéri (strukturális-balansz irodalom).',
    })
  }

  return [...session, ...weekly]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts src/features/train/logic/setBudget.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/structureLint.ts frontend/src/features/train/logic/structureLint.test.ts
git commit -m "feat(train): structureLint rule engine (mezo-oyhy.2)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 2: `StructureLintCard` + MesoEditor integration + docs + full gate

**Files:**
- Create: `frontend/src/features/train/components/StructureLintCard.tsx`
- Test: `frontend/src/features/train/components/StructureLintCard.test.tsx`
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (import + one derivation line + one JSX line below `<SetBudgetCard …/>` at ~line 180)
- Modify: `frontend/src/features/train/components/MesoEditor.test.tsx` (one new test)
- Modify: `docs/features/train.md`

**Interfaces:**
- Consumes from Task 1: `structureLint(days)`, `StructureFinding`.
- Produces: `export function StructureLintCard(props: { findings: StructureFinding[] })`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/components/StructureLintCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StructureFinding } from '@/features/train/logic/structureLint'
import { StructureLintCard } from '@/features/train/components/StructureLintCard'

const f = (over: Partial<StructureFinding>): StructureFinding => ({
  rule: 'frequency', label: 'Bicepsz: minden heti szett egy napon.',
  detail: 'Ugyanez a volumen ≥2 napra elosztva akár ~30%-kal gyorsabb fejlődést hozhat.', ...over,
})

describe('StructureLintCard', () => {
  it('collapsed: shows the count pill, hides the detail rows', () => {
    render(<StructureLintCard findings={[f({}), f({ rule: 'push-pull', label: 'Push:pull arány 1.8.' })]} />)
    expect(screen.getByText('2 észrevétel')).toBeInTheDocument()
    expect(screen.queryByText(/gyorsabb fejlődést/)).not.toBeInTheDocument()
  })
  it('clean: shows the ✓ pill and the clean line when expanded', () => {
    render(<StructureLintCard findings={[]} />)
    expect(screen.getByText('✓ rendben')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Struktúra/i }))
    expect(screen.getByText(/strukturálisan rendben/)).toBeInTheDocument()
  })
  it('expanded: renders label + detail per finding', () => {
    render(<StructureLintCard findings={[f({})]} />)
    fireEvent.click(screen.getByRole('button', { name: /Struktúra/i }))
    expect(screen.getByText('Bicepsz: minden heti szett egy napon.')).toBeInTheDocument()
    expect(screen.getByText(/gyorsabb fejlődést hozhat/)).toBeInTheDocument()
  })
})
```

Add to `frontend/src/features/train/components/MesoEditor.test.tsx` (inside the existing `describe`, reusing its `days`/`props` fixtures):

```tsx
  it('renders the Struktúra lint card (mezo-oyhy.2)', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByRole('button', { name: /Struktúra/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/StructureLintCard.test.tsx src/features/train/components/MesoEditor.test.tsx`
Expected: StructureLintCard suite FAILS (module missing); the new MesoEditor test FAILS; pre-existing MesoEditor tests PASS.

- [ ] **Step 3: Implement `StructureLintCard.tsx`**

```tsx
// ============================================================
// Mezo · StructureLintCard — collapsible "Struktúra" card in the meso
// day editor (mezo-oyhy.2): soft structural observations from
// structureLint with why-explanations. Never red, never force-opens,
// never blocks — MacroFactor principle (explain, don't scold).
// Header pill: "{n} észrevétel" (amber wash) or "✓ rendben" (sage wash).
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import type { StructureFinding } from '@/features/train/logic/structureLint'

export function StructureLintCard({ findings }: { findings: StructureFinding[] }) {
  const [open, setOpen] = useState(false)
  const clean = findings.length === 0

  return (
    <div className="card" style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="row"
        style={{
          width: '100%', justifyContent: 'space-between', alignItems: 'center',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
        }}
      >
        <Eyebrow brand>Struktúra</Eyebrow>
        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              background: clean ? 'var(--wash-sage)' : 'var(--wash-amber)',
              color: clean ? 'var(--sage-deep)' : 'var(--amber-deep)',
            }}
          >
            {clean ? '✓ rendben' : `${findings.length} észrevétel`}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="col" style={{ gap: 8, marginTop: 12 }}>
          {clean ? (
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--sage-deep)' }}>
              ✓ A terv strukturálisan rendben — gyakorlat/izom, frekvencia és balansz a sávban.
            </div>
          ) : (
            findings.map((f, i) => (
              <div
                key={`${f.rule}-${i}`}
                style={{
                  borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.45,
                  background: 'var(--surface-2)', color: 'var(--text-secondary)',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{f.label}</strong> {f.detail}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

(Token check: `--wash-sage` exists in `prototype.css`; if the light theme lacks it, use `color-mix(in srgb, var(--sage) 16%, transparent)` instead — verify with a grep before choosing.)

- [ ] **Step 4: Integrate into `MesoEditor.tsx`**

Imports:

```tsx
import { structureLint } from '@/features/train/logic/structureLint'
import { StructureLintCard } from '@/features/train/components/StructureLintCard'
```

Next to the existing `const budgets = muscleBudgets(days)` line add:

```tsx
  const lintFindings = structureLint(days)
```

Directly below the `<SetBudgetCard budgets={budgets} capWarnings={capWarnings} defaultOpen={warningCount > 0} />` line add:

```tsx
      <StructureLintCard findings={lintFindings} />
```

- [ ] **Step 5: Run the focused tests**

Run: `cd frontend && pnpm vitest run src/features/train/components/StructureLintCard.test.tsx src/features/train/components/MesoEditor.test.tsx src/features/train/logic/structureLint.test.ts`
Expected: ALL PASS (including every pre-existing MesoEditor test).

- [ ] **Step 6: Update `docs/features/train.md`**

Living doc, overwrite in place: in the section describing the meso editor's guidance layer (§4 — where the budget/zone layer is described), add the structure-lint layer:

- `structureLint.ts` (`features/train/logic/`) runs the RP/Helms/Nippard/Ethier structural consensus over the meso week: exercises/muscle/session (≤3, ham/traps ≤2), sets/exercise (compound 2–4, isolation 2–3, plyo exempt), single-day frequency (≥4 weekly sets on one day), weekly variety (2–5 distinct movements), session size (5–9 slots, plyo counts), push:pull (silence band 0.6–1.6) and ham:quad (<0.4 with quad ≥6) — thresholds in exported constant tables, muscle→side map `PUSH_PULL_SIDE`.
- `StructureLintCard` renders the findings in the MesoEditor below the SetBudgetCard: collapsible, neutral surface-2 explanation rows, `{n} észrevétel`/`✓ rendben` header pill; never red, never force-opens, never blocks saving. Balance-rule copy flags its structural-balance-literature provenance.
- Spec pointer: `docs/superpowers/specs/2026-08-06-structure-lint-design.md`; bd `mezo-oyhy.2`.

Run: `node scripts/lint-docs.mjs` — train.md clean (pre-existing stale flags on other docs are known; report, don't fix).

- [ ] **Step 7: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, full suite green in BOTH modes. Unrelated red → stop and report, don't fix.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/train/components/StructureLintCard.tsx frontend/src/features/train/components/StructureLintCard.test.tsx frontend/src/features/train/components/MesoEditor.tsx frontend/src/features/train/components/MesoEditor.test.tsx docs/features/train.md
git commit -m "feat(train): StructureLintCard soft structural checks in the meso editor (mezo-oyhy.2)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```
