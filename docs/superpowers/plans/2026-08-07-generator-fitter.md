# Generator Fitter Implementation Plan (mezo-oyhy.6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `generateProgram` output starts green: a deterministic fitter (`programFit.ts`) varies rep zones, fits every muscle group into `[MEV, ceiling)`, guards session length — proven by an invariant suite over every goal × split × day-count combination.

**Architecture:** New pure module `programFit.ts` (3 phases), applied by `generateProgram` on both return paths. The invariant suite in `planner.test.ts` is the referee: `structureLint === []`, `sets ≥ MEV`, `budget ≤ 1.0` (hard), `budget < 0.85` (soft, explicit `NEAR_ALLOWED` allowlist). Spec: `docs/superpowers/specs/2026-08-07-generator-fitter-design.md`.

**Tech Stack:** TypeScript + Vitest. All under `frontend/`.

## Global Constraints

- Imports deep + absolute `@/*`; code/comments/commits English; commits carry `(mezo-oyhy.6)`.
- Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2`, branch `feat/generator-fitter` (already checked out — do NOT create branches).
- Focused tests only per task; NEVER `./mvnw`, never `pnpm dev`; full gate once in Task 3.
- The fitter is DETERMINISTIC: no randomness, stable iteration orders (alphabetical group order; slot ties resolved by the rules below). It never mutates its input (deep-copy first), never touches plyo exercises, off/sport/exercise-less days, `warning` fields, or `warmupSets`.
- If the invariant suite reveals the provided fitter code violates a hard guarantee on some combination, FIX THE FITTER (that is the point of the referee), never weaken a hard assertion; soft-ceiling misses go to `NEAR_ALLOWED` ONLY with a comment deriving the floor arithmetic.
- The repo pre-commit hook may force-add a root-level `issues.jsonl`; after every commit check `git show --stat HEAD`, fix with `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify`.

---

### Task 1: `programFit.ts` + unit tests

**Files:**
- Create: `frontend/src/features/train/logic/programFit.ts`
- Test: `frontend/src/features/train/logic/programFit.test.ts`

**Interfaces:**
- Consumes: `GROUP_MEV`, `SESSION_MUSCLE_CAP`, `budgetGroup`, `budgetOf`, `setStyle` from `@/features/train/logic/setBudget`; `SETS_PER_EXERCISE`, `SESSION_LENGTH_BAND`, `repZoneOf`, type `RepZone` from `@/features/train/logic/structureLint`; `estimateSessionMinutes` from `@/features/train/logic/sessionLength`; types `MesoDay`, `GymExercise` from `@/data/types`; `isOffDay` from `@/features/train/logic/offDay`.
- Produces: `export const FIT_CEILING = 0.85`, `export function fitProgram(days: MesoDay[], goalId: string): MesoDay[]` (goalId currently unused by the algorithm but part of the contract for future goal-aware fitting — mark the parameter `_goalId`).

- [ ] **Step 1: Write the failing unit tests**

Create `frontend/src/features/train/logic/programFit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { GROUP_MEV, muscleBudgets } from '@/features/train/logic/setBudget'
import { repZoneOf } from '@/features/train/logic/structureLint'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { fitProgram, FIT_CEILING } from '@/features/train/logic/programFit'

let seq = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `e${seq++}`, name: over.name ?? `X${seq}`, muscle, warmupSets: 2, workingSets,
  repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', ...over,
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })

describe('phase 1 — rep-zone variation', () => {
  it('keeps slot 0, shifts slot 1 into a different zone', () => {
    const out = fitProgram([day('Hét', [
      ex('chest-mid', 3, { name: 'A' }), ex('chest-upper', 3, { name: 'B' }),
      ex('back-mid', 3), ex('quad', 3), ex('ham', 3), ex('biceps-long', 2, { type: 'isolation', repMin: 10, repMax: 12 }),
    ])], 'hypertrophy')
    const chest = out[0].exercises.filter((e) => e.muscle.startsWith('chest'))
    const z0 = repZoneOf(chest[0].repMin, chest[0].repMax)
    const z1 = repZoneOf(chest[1].repMin, chest[1].repMax)
    expect(chest[0]).toMatchObject({ repMin: 8, repMax: 10 }) // slot 0 untouched
    expect(z1).not.toBe(z0)
  })
  it('shoulder isolation slots ≥1 go light (20-25)', () => {
    const out = fitProgram([day('Hét', [
      ex('shoulder-front', 3), ex('shoulder-side', 3, { name: 'L', type: 'isolation', repMin: 10, repMax: 12 }),
      ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
    ])], 'hypertrophy')
    const lat = out[0].exercises.find((e) => e.name === 'L')!
    expect([lat.repMin, lat.repMax]).toEqual([20, 25])
  })
  it('plyo exercises are never touched', () => {
    const plyo = ex('quad', 3, { name: 'Box Jump', type: 'plyo', repMin: 5, repMax: 5, targetRIR: 0, warmupSets: 0 })
    const out = fitProgram([day('Hét', [plyo, ex('quad', 3), ex('ham', 3), ex('chest-mid', 3), ex('back-mid', 3)])], 'hypertrophy')
    expect(out[0].exercises.find((e) => e.name === 'Box Jump')).toMatchObject({ workingSets: 3, repMin: 5, repMax: 5 })
  })
})

describe('phase 2 — volume fit', () => {
  it('tops an under-MEV group up to its MEV', () => {
    // biceps MEV 8; two isolation slots at 2+2 = 4 → must reach 8 (3+3 caps at 6 → needs... see cap note below)
    // isolation cap is 3/exercise → two slots max 6 < 8: fitter saturates at caps; use THREE slots to make MEV reachable.
    const out = fitProgram([
      day('Hét', [ex('biceps-long', 2, { type: 'isolation', repMin: 10, repMax: 12 }), ex('biceps-short', 2, { name: 'C2', type: 'isolation', repMin: 10, repMax: 12 }), ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3)]),
      day('Csü', [ex('biceps-brachialis', 2, { name: 'C3', type: 'isolation', repMin: 10, repMax: 12 }), ex('chest-upper', 3), ex('back-wide', 3), ex('ham', 3), ex('glute', 3)]),
    ], 'hypertrophy')
    const bi = muscleBudgets(out).find((r) => r.group === 'biceps')!
    expect(bi.workingSets).toBeGreaterThanOrEqual(GROUP_MEV.biceps) // 8 via 3+3+2? no — 3+3+3 = 9 ≥ 8 (isolation cap 3)
    expect(bi.budget).toBeLessThan(FIT_CEILING)
  })
  it('trims an over-ceiling group down below the ceiling', () => {
    const out = fitProgram([
      day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4, { name: 'B' }), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)]),
      day('Csü', [ex('chest-mid', 4, { name: 'C' }), ex('chest-lower', 4, { name: 'D' }), ex('back-wide', 3), ex('glute', 3), ex('calf', 2, { type: 'isolation', repMin: 12, repMax: 15 })]),
    ], 'hypertrophy')
    const chest = muscleBudgets(out).find((r) => r.group === 'chest')!
    expect(chest.budget).toBeLessThan(FIT_CEILING)
    expect(chest.workingSets).toBeGreaterThanOrEqual(GROUP_MEV.chest)
    for (const d of out) for (const e of d.exercises) expect(e.workingSets).toBeGreaterThanOrEqual(2)
  })
  it('does not mutate the input', () => {
    const input = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4, { name: 'B' }), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)])]
    const before = JSON.stringify(input)
    fitProgram(input, 'hypertrophy')
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('phase 3 — session length', () => {
  it('pads a too-short day toward 45 minutes within caps', () => {
    const short = [day('Hét', [ex('chest-mid', 2), ex('back-mid', 2), ex('quad', 2), ex('ham', 2), ex('shoulder-side', 2, { type: 'isolation', repMin: 10, repMax: 12 })])]
    const out = fitProgram(short, 'hypertrophy')
    expect(estimateSessionMinutes(out[0].exercises)).toBeGreaterThanOrEqual(45)
  })
})

describe('passthrough', () => {
  it('off/sport/empty days and warnings survive untouched', () => {
    const rest: MesoDay = { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] }
    const warned = day('Hét', [ex('shoulder-front', 3, { warning: 'Cable variánssal helyettesítve' }), ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)])
    const out = fitProgram([warned, rest], 'hypertrophy')
    expect(out[1]).toEqual(rest)
    expect(out[0].exercises[0].warning).toBe('Cable variánssal helyettesítve')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/programFit.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `programFit.ts`**

```ts
// ============================================================
// Mezo · programFit — deterministic rule-engine fitter for generated
// programs (mezo-oyhy.6, spec 2026-08-07). Three phases over a deep copy:
//   1 rep-zone variation — per group, slot 0 keeps the scheme range,
//     later slots shift into a different zone (shoulder isolation → light);
//   2 volume fit — every trained group into [GROUP_MEV, FIT_CEILING) by
//     ±1-set moves within the sets/exercise, session-cap and 90-min limits,
//     with a legality-checked last-resort duplicate removal;
//   3 session-length guard — pad/trim days toward the 45–90 band.
// Pure and deterministic (alphabetical groups, rule-defined tie-breaks);
// plyo exercises, off days, warnings and warmupSets pass through untouched.
// Applied by generateProgram as its final step on both return paths.
// ============================================================
import type { GymExercise, MesoDay } from '@/data/types'
import { GROUP_MEV, SESSION_MUSCLE_CAP, budgetGroup, budgetOf, setStyle } from '@/features/train/logic/setBudget'
import { SETS_PER_EXERCISE, repZoneOf, type RepZone } from '@/features/train/logic/structureLint'
import { SESSION_LENGTH_BAND } from '@/features/train/logic/structureLint'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { isOffDay } from '@/features/train/logic/offDay'

export const FIT_CEILING = 0.85

interface Slot { dayIdx: number; exIdx: number }

const kindCap = (t: GymExercise['type']) => (t === 'compound' ? SETS_PER_EXERCISE.compound.max : SETS_PER_EXERCISE.isolation.max)

function slotsOf(days: MesoDay[]): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>()
  days.forEach((d, dayIdx) => {
    if (isOffDay(d)) return
    d.exercises.forEach((e, exIdx) => {
      if (e.type === 'plyo') return
      const group = budgetGroup(e.muscle)
      if (!group) return
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push({ dayIdx, exIdx })
    })
  })
  return map
}

function groupStats(days: MesoDay[], slots: Slot[]): { sets: number; budget: number } {
  let failure = 0
  let volume = 0
  for (const s of slots) {
    const e = days[s.dayIdx].exercises[s.exIdx]
    if (setStyle(e.targetRIR) === 'failure') failure += e.workingSets
    else volume += e.workingSets
  }
  return { sets: failure + volume, budget: budgetOf(failure, volume) }
}

function daySetsForGroup(days: MesoDay[], group: string, dayIdx: number): number {
  return days[dayIdx].exercises.reduce((a, e) => (e.type !== 'plyo' && budgetGroup(e.muscle) === group ? a + e.workingSets : a), 0)
}

// --- phase 1 -------------------------------------------------------------
const SHIFT: Record<RepZone, { compound: [number, number]; isolation: [number, number] }> = {
  heavy: { compound: [12, 15], isolation: [12, 15] },
  moderate: { compound: [6, 9], isolation: [20, 25] },
  light: { compound: [12, 15], isolation: [12, 15] },
}

function varyRepZones(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  for (const [group, slots] of [...slotMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (slots.length < 2) continue
    const first = days[slots[0].dayIdx].exercises[slots[0].exIdx]
    const baseZone = repZoneOf(first.repMin, first.repMax)
    const shift = SHIFT[baseZone]
    slots.forEach((s, i) => {
      if (i === 0) return
      const e = days[s.dayIdx].exercises[s.exIdx]
      // Palette cycle: odd slots shifted, even slots (2,4,…) back to the base range.
      if (i % 2 === 0) { e.repMin = first.repMin; e.repMax = first.repMax; return }
      const [lo, hi] = group === 'shoulder' && e.type === 'isolation' ? [20, 25] : shift[e.type === 'compound' ? 'compound' : 'isolation']
      e.repMin = lo
      e.repMax = hi
    })
  }
}

// --- phase 2 -------------------------------------------------------------
function fitVolume(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  const groups = [...slotMap.keys()].sort()
  for (const group of groups) {
    const mev = GROUP_MEV[group]
    if (mev === undefined) continue
    const slots = slotMap.get(group)!

    // Top up to MEV.
    for (let guard = 0; guard < 64; guard++) {
      if (groupStats(days, slots).sets >= mev) break
      const candidates = slots
        .map((s) => ({ s, e: days[s.dayIdx].exercises[s.exIdx] }))
        .filter(({ s, e }) =>
          e.workingSets < kindCap(e.type)
          && daySetsForGroup(days, group, s.dayIdx) + 1 <= SESSION_MUSCLE_CAP
          && estimateSessionMinutes(days[s.dayIdx].exercises.map((x, i) => (i === s.exIdx ? { ...x, workingSets: x.workingSets + 1 } : x))) <= SESSION_LENGTH_BAND.max)
        .sort((a, b) => a.e.workingSets - b.e.workingSets || a.s.dayIdx - b.s.dayIdx || a.s.exIdx - b.s.exIdx)
      if (candidates.length === 0) break
      candidates[0].e.workingSets++
    }

    // Trim below the ceiling.
    for (let guard = 0; guard < 64; guard++) {
      if (groupStats(days, slots).budget < FIT_CEILING) break
      const candidates = slots
        .map((s) => ({ s, e: days[s.dayIdx].exercises[s.exIdx] }))
        .filter(({ e }) => e.workingSets > 2)
        .sort((a, b) => b.e.workingSets - a.e.workingSets || b.s.dayIdx - a.s.dayIdx || b.s.exIdx - a.s.exIdx)
      if (candidates.length === 0) { tryRemoveDuplicate(days, slotMap, group); break }
      candidates[0].e.workingSets--
    }
  }
}

/** Last resort at floors: remove ONE duplicate slot when legal (frequency, variety, session-size). */
function tryRemoveDuplicate(days: MesoDay[], slotMap: Map<string, Slot[]>, group: string): void {
  const slots = slotMap.get(group)!
  if (groupStats(days, slots).budget < FIT_CEILING) return
  // Candidates: later days first, later slots first.
  const ordered = [...slots].sort((a, b) => b.dayIdx - a.dayIdx || b.exIdx - a.exIdx)
  for (const cand of ordered) {
    const sameDay = slots.filter((s) => s.dayIdx === cand.dayIdx).length
    if (sameDay < 2) continue // frequency: keep ≥1 group slot on each of its days
    const names = new Set(slots.filter((s) => s !== cand).map((s) => days[s.dayIdx].exercises[s.exIdx].name))
    if (names.size < 2) continue // variety
    if (days[cand.dayIdx].exercises.length - 1 < 5) continue // session size
    const mev = GROUP_MEV[group]
    if (mev !== undefined && groupStats(days, slots.filter((s) => s !== cand)).sets < mev) continue // MEV floor
    const d = days[cand.dayIdx]
    d.exercises = d.exercises.filter((_, i) => i !== cand.exIdx)
    d.exerciseCount = d.exercises.length
    // Rebuild the slot map after a structural change and stop (single removal).
    const rebuilt = slotsOf(days)
    slotMap.clear()
    for (const [g, s] of rebuilt) slotMap.set(g, s)
    return
  }
}

// --- phase 3 -------------------------------------------------------------
function guardSessionLength(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  days.forEach((d, dayIdx) => {
    if (isOffDay(d) || d.exercises.length === 0) return
    for (let guard = 0; guard < 32; guard++) {
      const est = estimateSessionMinutes(d.exercises)
      if (est > SESSION_LENGTH_BAND.max) {
        const victims = d.exercises
          .map((e, exIdx) => ({ e, exIdx, group: e.type !== 'plyo' ? budgetGroup(e.muscle) : null }))
          .filter(({ e, group }) => group !== null && e.workingSets > 2)
          .filter(({ group }) => {
            const mev = GROUP_MEV[group!]
            return mev === undefined || groupStats(days, slotMap.get(group!) ?? []).sets - 1 >= mev
          })
          .sort((a, b) => b.e.workingSets - a.e.workingSets || b.exIdx - a.exIdx)
        if (victims.length === 0) break
        victims[0].e.workingSets--
      } else if (est < SESSION_LENGTH_BAND.min) {
        const candidates = d.exercises
          .map((e, exIdx) => ({ e, exIdx, group: e.type !== 'plyo' ? budgetGroup(e.muscle) : null }))
          .filter(({ e, group }) => group !== null && e.workingSets < kindCap(e.type)
            && daySetsForGroup(days, group!, dayIdx) + 1 <= SESSION_MUSCLE_CAP)
          .map((c) => {
            const slots = slotMap.get(c.group!) ?? []
            const cur = groupStats(days, slots)
            const style = setStyle(c.e.targetRIR)
            const nextBudget = cur.budget + (style === 'failure' ? 1 / 12 : 1 / 20)
            return { ...c, nextBudget }
          })
          .filter((c) => c.nextBudget < FIT_CEILING)
          .sort((a, b) => a.nextBudget - b.nextBudget || a.exIdx - b.exIdx)
        if (candidates.length === 0) break
        candidates[0].e.workingSets++
      } else break
    }
  })
}

/** Deterministic rule-engine fit; see module header. `_goalId` reserved for goal-aware fitting. */
export function fitProgram(days: MesoDay[], _goalId: string): MesoDay[] {
  const copy: MesoDay[] = days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
  const slotMap = slotsOf(copy)
  varyRepZones(copy, slotMap)
  fitVolume(copy, slotMap)
  guardSessionLength(copy, slotMap)
  copy.forEach((d) => { d.exerciseCount = d.exercises.length })
  return copy
}
```

(Import note: `budgetOf`/`setStyle` uses above assume the exact exports from `setBudget.ts`; `SESSION_LENGTH_BAND`/`SETS_PER_EXERCISE`/`repZoneOf`/`RepZone` from `structureLint.ts` — both verified present. The double import line from structureLint must be merged into one.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/programFit.test.ts`
Expected: ALL PASS. If a case fails, debug the FITTER (bounded loops, tie-breaks), not the test — the test cases were hand-derived.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/programFit.ts frontend/src/features/train/logic/programFit.test.ts
git commit -m "feat(train): programFit deterministic rule-engine fitter (mezo-oyhy.6)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 2: wire into `generateProgram` + the invariant suite

**Files:**
- Modify: `frontend/src/features/train/logic/planner.ts` (apply `fitProgram` on both return paths)
- Modify: `frontend/src/features/train/logic/planner.test.ts` (invariant suite + update the exact-value expectations the fitter changes)

**Interfaces:**
- Consumes: `fitProgram` (Task 1); `GOAL_PRESETS`, `SPLITS` from `@/data/train/train`; `structureLint` from `@/features/train/logic/structureLint`; `GROUP_MEV`, `muscleBudgets` from `@/features/train/logic/setBudget`; `FIT_CEILING`.

- [ ] **Step 1: Wire the fitter**

In `planner.ts`: `import { fitProgram } from '@/features/train/logic/programFit'`. In `generateProgram`, wrap BOTH return values:

- the no-weekdays path: `return fitProgram(template.map(...), goal?.id ?? 'hypertrophy')`
- the weekday-placement path: `return fitProgram(DAY_ORDER.map(...), goal?.id ?? 'hypertrophy')`

Nothing else in the file changes.

- [ ] **Step 2: Write the invariant suite**

Append to `planner.test.ts`:

```ts
import { GOAL_PRESETS, SPLITS } from '@/data/train/train'
import { structureLint } from '@/features/train/logic/structureLint'
import { GROUP_MEV, muscleBudgets } from '@/features/train/logic/setBudget'
import { FIT_CEILING } from '@/features/train/logic/programFit'

// Combos whose template floor structure cannot reach the soft ceiling — each entry
// must carry a derivation comment. Key: `${goalId}|${splitLabel}|${days}|${group}`.
const NEAR_ALLOWED = new Set<string>([
  // 6-day PPL back: 6 slots (3/Pull day × 2), floors 2 each, failure style at RIR≤1
  // → 12/12 = 100%; duplicate removal illegal (each Pull day has exactly 5 exercises,
  // removal would break session-size ≥5). Amber "near" is truthful on a maximal split.
  // Add goal-specific keys here ONLY with this kind of arithmetic comment.
])

describe('generator invariants (mezo-oyhy.6)', () => {
  for (const goal of GOAL_PRESETS) {
    for (const split of SPLITS) {
      for (const d of split.days) {
        const label = `${goal.id} · ${split.label} · ${d}d`
        if (split.label === 'Custom split') {
          test(`${label}: custom days pass through empty`, () => {
            const prog = generateProgram({ goal, split, days: d })
            for (const pd of prog) expect(pd.exercises).toHaveLength(0)
          })
          continue
        }
        test(`${label}: lint-clean, zone-fit, never over`, () => {
          const prog = generateProgram({ goal, split, days: d })
          expect(structureLint(prog)).toEqual([])
          for (const row of muscleBudgets(prog)) {
            expect(row.budget).toBeLessThanOrEqual(1)
            const mev = GROUP_MEV[row.group]
            if (mev !== undefined) {
              expect(row.workingSets).toBeGreaterThanOrEqual(mev)
              if (!NEAR_ALLOWED.has(`${goal.id}|${split.label}|${d}|${row.group}`)) {
                expect(row.budget).toBeLessThan(FIT_CEILING)
              }
            }
          }
        })
      }
    }
  }

  test('niggle warnings survive fitting', () => {
    const goal = GOAL_PRESETS.find((g) => g.id === 'hypertrophy')!
    const prog = generateProgram({ goal, split: 'Pull / Push / Legs', days: 5, niggle: 'shoulder' })
    const warned = prog.flatMap((pd) => pd.exercises).filter((e) => e.warning)
    expect(warned.length).toBeGreaterThan(0)
  })
})
```

Populating `NEAR_ALLOWED`: run the suite; for every soft-ceiling failure, DERIVE the floor arithmetic by hand (slots × floor 2 priced by the scheme's RIR style vs the 12/20 caps). If the floors genuinely sit ≥ 0.85 and the duplicate removal is illegal per its three legality rules, add the key with the derivation comment. If the floors COULD fit, the fitter has a bug — fix it instead. Report every allowlisted key in your report with its arithmetic.

- [ ] **Step 3: Update the pre-existing exact-value expectations**

The existing `generateProgram` describes assert scheme-stamped sets/reps (e.g. compound `sets: 4`, reps `8-10`). After fitting these change. For each broken assertion: re-derive the expected value BY HAND from the three phases (write the derivation in a comment) or relax the assertion to the invariant it actually guards (e.g. "compound slot 0 keeps the scheme range" instead of a full-day literal). At least ONE full day must keep a hand-derived exact expectation (recommend: hypertrophy PPL 5-day Push day) so the fitter's arithmetic stays pinned. Never paste observed output as the expectation without derivation.

- [ ] **Step 4: Run the suites**

Run: `cd frontend && pnpm vitest run src/features/train/logic/planner.test.ts src/features/train/logic/programFit.test.ts src/features/train/logic/structureLint.test.ts`
Expected: ALL PASS with `NEAR_ALLOWED` containing only derived-and-commented keys.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/planner.ts frontend/src/features/train/logic/planner.test.ts
git commit -m "feat(train): generateProgram applies the rule-engine fitter + invariant suite (mezo-oyhy.6)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 3: docs + full gate

**Files:**
- Modify: `docs/features/train.md`

- [ ] **Step 1: Update `docs/features/train.md`**

In the planner/generator passage (§ where `generateProgram` is described) state: generated programs now pass through `programFit.ts` (three deterministic phases — rep-zone variation, `[MEV, 85%)` volume fit with legality-checked last-resort removal, 45–90 min session guard) so a fresh plan starts lint-clean and zone-fit; the invariant suite in `planner.test.ts` enforces this for every goal × split × day combination (`NEAR_ALLOWED` documents the floor-bound exceptions). Spec pointer + bd `mezo-oyhy.6`. Living doc, in place.

Run: `node scripts/lint-docs.mjs` — train.md clean.

- [ ] **Step 2: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, BOTH modes green. `MesocyclePlannerPage.test.tsx` renders generated output — if one of its assertions pinned a now-fitted number, update it with a derivation comment and report it. Unrelated red → stop and report.

- [ ] **Step 3: Commit**

```bash
git add docs/features/train.md
git commit -m "docs(train): generator fitter in train.md (mezo-oyhy.6)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```
