# Equivalent reps on weight swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user changes the kg on the live workout card away from the prescribed target, the rep target follows at equivalent effort, for the rest of the exercise, and that adjusted target is what gets logged.

**Architecture:** One pure, table-tested helper (`features/train/logic/repEquivalence.ts`, Epley round-trip incl. RIR, ±20 % guard). `WorkoutCard` uses it for the cursor row (onChange + prefill + caption), the pending rows and the done-row verdict; `ActiveWorkoutPage.handleLogSet` uses it for the logged target snapshot. Frontend only, no API change.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, MSW (page tests).

**Spec:** `docs/superpowers/specs/2026-09-24-rep-equivalence-on-weight-swap-design.md` · **Issue:** `mezo-l95v4`

## Global Constraints

- Frontend only. No change to `api/feature/train/train.yml`, backend, or `data/_client`.
- Epley: `e1rm = w * (1 + rtf/30)`, `rtf = reps + (RIR ?? 0)`; result rounded, clamped to [1, 50].
- Guard: `|newW / targetW − 1| > 0.2` → no adjustment (reps untouched).
- Copy (Hungarian): caption `{w} kg-hoz igazítva · ajánlás {tw} × {tr}`, numbers via `toLocaleString('hu-HU')`.
- No prescription (hypertrophy-drive off, `targetWeightKg == null`) → behaviour unchanged.
- Frontend gate: `CI=true pnpm test` with `VITE_USE_MOCK=true` AND `VITE_USE_MOCK=false`, plus `pnpm build`.

---

### Task 1: `repEquivalence` helper

**Files:**
- Create: `frontend/src/features/train/logic/repEquivalence.ts`
- Test: `frontend/src/features/train/logic/repEquivalence.test.ts`

**Interfaces — Produces:**
- `equivalentReps(p: PrescribedSet | null, weightKg: number): number | null` — reps at `weightKg` for the same effort as `p`; `p.targetReps` when the weight equals the target; `null` when no target weight, `weightKg <= 0`, or the swing exceeds 20 %.
- `adjustedTarget(p: PrescribedSet | null, weightKg: number): { targetWeightKg: number; targetReps: number } | null` — `null` when the weight equals the target or `equivalentReps` is `null`.
- `adjustedRange(ex: { repMin: number; repMax: number }, p: PrescribedSet | null, weightKg: number): { repMin: number; repMax: number }` — range shifted by `adjusted.targetReps − p.targetReps`; the input range when no adjustment.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { PrescribedSet } from '@/data/types'
import { adjustedRange, adjustedTarget, equivalentReps } from '@/features/train/logic/repEquivalence'

const set = (w: number | null, reps: number, rir: number | null = 2): PrescribedSet =>
  ({ kind: 'working', targetWeightKg: w, targetReps: reps, targetRIR: rir })

describe('equivalentReps', () => {
  it.each([
    ['owner example: 98 × 10 @2 → 95 kg', set(98, 10), 95, 11],
    ['same weight keeps the target', set(98, 10), 98, 10],
    ['heavier weight → fewer reps', set(98, 10), 100, 9],
    ['a ~18 % drop is still allowed', set(98, 10), 80, 19],
    ['null RIR counts as 0', set(100, 10, null), 95, 12],
    ['clamped to at least 1', set(20, 1, 0), 24, 1],
  ])('%s', (_l, p, w, expected) => {
    expect(equivalentReps(p, w)).toBe(expected)
  })

  it.each([
    ['no prescription', null, 95],
    ['no target weight', set(null, 10), 95],
    ['zero weight', set(98, 10), 0],
    ['more than 20 % off', set(98, 10), 75],
  ])('%s → null', (_l, p, w) => {
    expect(equivalentReps(p, w)).toBeNull()
  })
})

describe('adjustedTarget', () => {
  it('returns the swapped weight with the equivalent reps', () => {
    expect(adjustedTarget(set(98, 10), 95)).toEqual({ targetWeightKg: 95, targetReps: 11 })
  })
  it('is null at the target weight and outside the guard', () => {
    expect(adjustedTarget(set(98, 10), 98)).toBeNull()
    expect(adjustedTarget(set(98, 10), 60)).toBeNull()
  })
})

describe('adjustedRange', () => {
  it('shifts the rep range by the rep delta', () => {
    expect(adjustedRange({ repMin: 8, repMax: 10 }, set(98, 10), 95)).toEqual({ repMin: 9, repMax: 11 })
  })
  it('keeps the range when nothing is adjusted', () => {
    expect(adjustedRange({ repMin: 8, repMax: 10 }, set(98, 10), 98)).toEqual({ repMin: 8, repMax: 10 })
  })
})
```

- [ ] **Step 2:** `cd frontend && CI=true pnpm vitest run src/features/train/logic/repEquivalence.test.ts` → FAIL (module missing).

- [ ] **Step 3: implementation**

```ts
import type { PrescribedSet } from '@/data/types'

/** Beyond this relative swing the Epley round-trip is guesswork — the reps are left alone. */
const MAX_SWING = 0.2
const MIN_REPS = 1
const MAX_REPS = 50

/**
 * Reps at `weightKg` that cost the same effort as the prescribed set (mezo-l95v4): the
 * prescription's reps-to-failure (reps + RIR) → Epley e1RM (same formula as backend
 * `OneRepMax`) → reps-to-failure at the new weight → minus the same RIR. Null = do not
 * touch the reps (no target, nonsense weight, or too big a swing to trust).
 */
export function equivalentReps(p: PrescribedSet | null, weightKg: number): number | null {
  const tw = p?.targetWeightKg
  if (p == null || tw == null || tw <= 0 || !(weightKg > 0)) return null
  if (weightKg === tw) return p.targetReps
  if (Math.abs(weightKg / tw - 1) > MAX_SWING) return null
  const rir = p.targetRIR ?? 0
  const e1rm = tw * (1 + (p.targetReps + rir) / 30)
  const reps = Math.round(30 * (e1rm / weightKg - 1) - rir)
  return Math.min(MAX_REPS, Math.max(MIN_REPS, reps))
}

/** The target the set is judged and logged against after a weight swap; null = the prescription stands. */
export function adjustedTarget(
  p: PrescribedSet | null,
  weightKg: number,
): { targetWeightKg: number; targetReps: number } | null {
  if (p?.targetWeightKg == null || weightKg === p.targetWeightKg) return null
  const reps = equivalentReps(p, weightKg)
  return reps == null ? null : { targetWeightKg: weightKg, targetReps: reps }
}

/** The exercise's rep range moved by the same delta as the adjusted target. */
export function adjustedRange(
  ex: { repMin: number; repMax: number },
  p: PrescribedSet | null,
  weightKg: number,
): { repMin: number; repMax: number } {
  const a = adjustedTarget(p, weightKg)
  if (a == null || p == null) return { repMin: ex.repMin, repMax: ex.repMax }
  const d = a.targetReps - p.targetReps
  return { repMin: ex.repMin + d, repMax: ex.repMax + d }
}
```

- [ ] **Step 4:** rerun → PASS.
- [ ] **Step 5:** commit `feat(train): rep-equivalence helper for weight swaps (mezo-l95v4)`.

---

### Task 2: `WorkoutCard` follows the swapped weight

**Files:**
- Modify: `frontend/src/features/train/components/WorkoutCard.tsx` (prefill effect ~L134-151; kg input onChange ~L287-293; pending row ~L341-349; done-row `setStatus` call ~L239)
- Modify: `frontend/src/styles/prototype.css` (new `.wo-adjust` beside `.wo-cue`)
- Test: `frontend/src/features/train/components/WorkoutCard.test.tsx`

**Interfaces — Consumes:** `equivalentReps`, `adjustedTarget`, `adjustedRange` from Task 1.

Fixture numbers (PRESCRIBED working = 105 × 10 @ RIR 2): 100 kg → 12 reps; 102,5 kg → 11 reps.

- [ ] **Step 1: failing tests** (append)

```tsx
test('changing the kg recomputes the reps at equivalent effort and says so (mezo-l95v4)', async () => {
  const user = userEvent.setup()
  const { container } = renderCard()
  const kg = screen.getByLabelText(/súly$/)
  await user.clear(kg)
  await user.type(kg, '100')
  expect(screen.getByLabelText(/ismétlés$/)).toHaveValue(12)
  expect(container.querySelector('.wo-adjust')).toHaveTextContent('100 kg-hoz igazítva · ajánlás 105 × 10')
})

test('typed reps win until the kg changes again; back to target restores it', async () => {
  const user = userEvent.setup()
  const { container } = renderCard()
  const kg = screen.getByLabelText(/súly$/)
  const reps = screen.getByLabelText(/ismétlés$/)
  await user.clear(kg)
  await user.type(kg, '100')
  await user.clear(reps)
  await user.type(reps, '14')
  expect(reps).toHaveValue(14)
  await user.clear(kg)
  await user.type(kg, '105')
  expect(reps).toHaveValue(10)
  expect(container.querySelector('.wo-adjust')).toBeNull()
})

test('the later rows follow the swapped weight with the equivalent reps', async () => {
  const user = userEvent.setup()
  renderCard()
  const kg = screen.getByLabelText(/súly$/)
  await user.clear(kg)
  await user.type(kg, '102.5')
  const later = screen.getByLabelText('2. szett · terv')
  expect(later).toHaveTextContent('102,5')
  expect(later).toHaveTextContent('11')
  expect(later).not.toHaveTextContent('8–10')
})

test('the next set prefills the carried weight with equivalent reps, and the verdict shifts', () => {
  const exercise = makeExercise()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 100, reps: 11, rir: 2 })
  const { container } = renderCard({ exercise, session })
  expect(screen.getByLabelText(/súly$/)).toHaveValue(100)
  expect(screen.getByLabelText(/ismétlés$/)).toHaveValue(12)
  // 11 reps at 100 kg sits inside the shifted 10–12 range, not "above" 8–10.
  expect(container.querySelector('.wo-row.is-done .wo-verdict')).toHaveClass('is-ok')
})
```

(Check `setSlotLabel(1)` renders `2. szett` and `completeSet`'s signature in `workoutState.ts` before running; adapt only the label/signature, not the numbers.)

- [ ] **Step 2:** run the file → the four new tests FAIL.

- [ ] **Step 3: implementation**

In `WorkoutCard.tsx`:

```tsx
import { adjustedRange, adjustedTarget, equivalentReps } from '@/features/train/logic/repEquivalence'
// …
// The cursor slot's prescription — read by the prefill, the kg field and the caption.
const cursorTarget = prescribedAt(session, id, slotIndex(session, id, cursor))
```

Prefill effect body becomes:

```tsx
const t = cursorTarget
const prev = logged[cursor - 1]
const p = prefill(exercise)
const w = prev?.weight ?? t?.targetWeightKg ?? p.weight
setWeight(w)
// A weight carried over from a swapped set keeps its equivalent reps (mezo-l95v4).
setReps(equivalentReps(t, w) ?? t?.targetReps ?? prev?.reps ?? p.reps)
```

kg input onChange:

```tsx
onChange={(e) => {
  const w = Number(e.target.value)
  setWeight(w)
  // The reps follow the kg at equivalent effort; typed reps stand until the kg moves again.
  const r = equivalentReps(cursorTarget, w)
  if (r != null) setReps(r)
}}
```

Right after the cursor `<form>` (inside the same `if (i === cursor)` branch, wrap both in a fragment with the key on the fragment):

```tsx
const adj = weightless ? null : adjustedTarget(cursorTarget, weight)
// …
{adj && cursorTarget?.targetWeightKg != null && (
  <p className="wo-adjust">
    {`${adj.targetWeightKg.toLocaleString('hu-HU')} kg-hoz igazítva · ajánlás ${cursorTarget.targetWeightKg.toLocaleString('hu-HU')} × ${cursorTarget.targetReps}`}
  </p>
)}
```

Pending row:

```tsx
const later = weightless ? null : adjustedTarget(t, weight)
// kg cell:
{later ? later.targetWeightKg.toLocaleString('hu-HU') : t?.targetWeightKg != null ? t.targetWeightKg.toLocaleString('hu-HU') : '—'}
// reps cell:
{later ? String(later.targetReps) : `${exercise.repMin}–${exercise.repMax}`}
```

Done row verdict:

```tsx
const status = setStatus(adjustedRange(exercise, t, actual.weight), { reps: actual.reps, kind: 'working' })
```

In `prototype.css` after the `.wo-cue p` rule:

```css
/* The weight-swap note under the cursor row (mezo-l95v4): quiet, one line. */
.wo-adjust { margin: 2px 0 6px; padding-left: 4px; font-size: 11px; line-height: 1.4; color: var(--sub); }
```

- [ ] **Step 4:** run the WorkoutCard file → all PASS (existing ones too — the `60 kg` test is outside the guard so its typed reps stand).
- [ ] **Step 5:** commit `feat(train): the live card's reps follow a swapped weight (mezo-l95v4)`.

---

### Task 3: log the adjusted target snapshot

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (`handleLogSet`, ~L446-470)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (next to "real mode: only working sets reach the wire")

- [ ] **Step 1: failing test** — copy the "real mode: only working sets reach the wire" test as `real mode: a swapped weight logs the adjusted target snapshot (mezo-l95v4)`; before clicking submit, change the kg:

```tsx
const kg = screen.getByLabelText(new RegExp(`${EX1}.*súly$`))
await user.clear(kg)
await user.type(kg, '100')
await user.click(submitOf(EX1))
await waitFor(() => expect(bodies).toHaveLength(1))
// 105 × 10 @ RIR 1 → 100 kg: rtf 11 → e1rm 143,5 → 13,05 − 1 → 12.
expect(bodies[0].weightKg).toBe(100)
expect(bodies[0].reps).toBe(12)
expect(bodies[0].targetWeightKg).toBe(100)
expect(bodies[0].targetReps).toBe(12)
```

(Use whatever label helper the file already uses for the kg input; `EX1` is the exercise name constant.)

- [ ] **Step 2:** run → FAIL (`targetWeightKg` is 105).

- [ ] **Step 3: implementation** in `handleLogSet`, after `const target = …`:

```ts
// A swapped weight is judged against its equivalent target, so the medal and the
// adherence detector see the effort that was actually asked for (mezo-l95v4).
const snapshot = (weightless ? null : adjustedTarget(target, weight)) ?? target
```

and the payload lines become:

```ts
...(snapshot?.targetWeightKg != null ? { targetWeightKg: snapshot.targetWeightKg } : {}),
...(snapshot?.targetReps != null ? { targetReps: snapshot.targetReps } : {}),
```

- [ ] **Step 4:** rerun → PASS.
- [ ] **Step 5:** commit `feat(train): log the adjusted target after a weight swap (mezo-l95v4)`.

---

### Task 4: docs, gates, merge

- [ ] Update `docs/features/train.md` §2 (Active workout): one paragraph on the weight-swap rep equivalence (helper, 20 % guard, carried to later rows, logged snapshot = adjusted). Refresh its verification stamp per the knowledge-base skill.
- [ ] `node scripts/gen-codemap.mjs` (new file) and commit.
- [ ] Gates: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`.
- [ ] Merge per AGENTS.md: `git fetch && git checkout --detach origin/main && git merge --no-ff <branch> && node scripts/gen-codemap.mjs --check && git push origin HEAD:main`; close `mezo-l95v4`; beads backup.
