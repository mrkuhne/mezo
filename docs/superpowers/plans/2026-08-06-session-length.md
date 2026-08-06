# Session-Length Estimate Implementation Plan (mezo-oyhy.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client-side session-length estimator as the single duration source: `~X perc` on the MesoEditor hero, a 45–90 min band rule in the Struktúra lint, and the prep/TrainToday/Today duration reads switched from the data-provided `durationEst` to the estimator.

**Architecture:** New pure module `sessionLength.ts` (pacing constants in one table, rest times reused from `restTimer.ts`); `structureLint.ts` gains rule 8; `MesoEditorHero` gains a `dayMinutes` prop; three consumer UIs swap their `durationEst` read. API contract untouched (the field stays; UI stops reading it). Spec: `docs/superpowers/specs/2026-08-06-session-length-design.md`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library. All under `frontend/`.

## Global Constraints

- Read `docs/references/frontend_conventions.md` first.
- Imports deep + absolute `@/*`; no relative `../`; no new barrels.
- UI copy Hungarian EXACTLY as given; code/comments/commits English; commit subjects carry `(mezo-oyhy.3)`.
- Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2`, branch `feat/session-length` (already checked out — do NOT create branches).
- Focused tests only per task; NEVER `./mvnw`, never `pnpm dev`; full gate once in Task 3.
- Estimator model (all constants in `SESSION_TIME`): working rep 3.5 s (plyo 2 s), inter-set rest `restSecondsFor(type)` × (workingSets−1), warm-up set 20 s + 45 s rest, transition 90 s/exercise, +8 min session warm-up block when non-empty, empty list → 0, round once at the end.
- The repo pre-commit hook may force-add a root-level `issues.jsonl`. After every commit run `git show --stat HEAD`; if it appears, fix with `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify`.

---

### Task 1: `sessionLength.ts` — the estimator

**Files:**
- Create: `frontend/src/features/train/logic/sessionLength.ts`
- Test: `frontend/src/features/train/logic/sessionLength.test.ts`

**Interfaces:**
- Consumes: `restSecondsFor` from `@/features/train/logic/restTimer`; type `ExerciseKind` from `@/data/types`.
- Produces (Tasks 2–3 rely on these exact names):
  - `export interface SessionTimeExercise { type: ExerciseKind; workingSets: number; warmupSets: number; repMin: number; repMax: number }`
  - `export const SESSION_TIME` (shape below)
  - `export function estimateSessionMinutes(exercises: SessionTimeExercise[]): number`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/logic/sessionLength.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'

const ex = (over: { type?: 'compound' | 'isolation' | 'plyo'; workingSets?: number; warmupSets?: number; repMin?: number; repMax?: number } = {}) => ({
  type: over.type ?? 'compound' as const,
  workingSets: over.workingSets ?? 3,
  warmupSets: over.warmupSets ?? 2,
  repMin: over.repMin ?? 8,
  repMax: over.repMax ?? 10,
})

describe('estimateSessionMinutes', () => {
  it('returns 0 for an empty session', () => {
    expect(estimateSessionMinutes([])).toBe(0)
  })
  it('single compound: 3×(8-10) + 2 warmups → 18 min', () => {
    // exec 3×9×3.5 = 94.5 s · rests 2×150 = 300 s · warmups 2×(20+45) = 130 s ·
    // transition 90 s → 614.5 s = 10.24 → 10 min + 8 min block = 18
    expect(estimateSessionMinutes([ex()])).toBe(18)
  })
  it('plyo prices reps at 2 s and rests at 90 s', () => {
    // 3×5×2 = 30 s · rests 2×90 = 180 s · no warmups · transition 90 s → 300 s = 5 + 8 = 13
    expect(estimateSessionMinutes([ex({ type: 'plyo', workingSets: 3, warmupSets: 0, repMin: 5, repMax: 5 })])).toBe(13)
  })
  it('isolation: 2×(12-15) + 1 warmup → 14 min', () => {
    // exec 2×13.5×3.5 = 94.5 s · rest 1×90 = 90 s · warmup 65 s · transition 90 s → 339.5 s = 5.66 → 6 + 8 = 14
    expect(estimateSessionMinutes([ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })])).toBe(14)
  })
  it('rounds once on the session total, not per exercise', () => {
    // compound 614.5 s + isolation 339.5 s = 954 s = 15.9 → 16 + 8 = 24
    // (per-exercise rounding would give 10 + 6 + 8 = 24 here too — so also assert
    // the raw-sum case where they differ: two isolations 339.5×2 = 679 s = 11.32 → 11 + 8 = 19,
    // while per-exercise rounding would yield 6+6+8 = 20.)
    expect(estimateSessionMinutes([ex(), ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })])).toBe(24)
    const iso = ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })
    expect(estimateSessionMinutes([iso, iso])).toBe(19)
  })
  it('a single-set exercise has no inter-set rest', () => {
    // exec 1×9×3.5 = 31.5 s · rests 0 · no warmup · transition 90 s → 121.5 s = 2.03 → 2 + 8 = 10
    expect(estimateSessionMinutes([ex({ workingSets: 1, warmupSets: 0 })])).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/sessionLength.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `sessionLength.ts`**

```ts
// ============================================================
// Mezo · sessionLength — plan-recipe session-duration estimator
// (mezo-oyhy.3, spec 2026-08-06). The SINGLE duration source across the
// app: MesoEditor hero, structureLint session-length rule, prep pill,
// TrainToday chip, Today facts. Pure derivation from the exercise recipe;
// inter-set rests reuse the live rest engine's numbers (restSecondsFor).
// Pacing constants live in SESSION_TIME — one place to tune. The data
// layer's durationEst field still exists but no UI reads it.
// ============================================================
import type { ExerciseKind } from '@/data/types'
import { restSecondsFor } from '@/features/train/logic/restTimer'

/** Minimal structural input — GymExercise and LoggedWorkoutExercise both satisfy it. */
export interface SessionTimeExercise {
  type: ExerciseKind
  workingSets: number
  warmupSets: number
  repMin: number
  repMax: number
}

export const SESSION_TIME = {
  /** Working-rep execution seconds. */
  repSeconds: 3.5,
  /** Explosive (plyo) reps are faster. */
  plyoRepSeconds: 2,
  /** One warm-up set's execution. */
  warmupSetSeconds: 20,
  /** Rest after a warm-up set. */
  warmupRestSeconds: 45,
  /** Per-exercise setup/plate/move overhead. */
  transitionSeconds: 90,
  /** Session-level warm-up block (the prep screen's fixed 8-minute block). */
  warmupBlockMinutes: 8,
} as const

/** Whole-session estimate in whole minutes; 0 for an empty list. Rounds ONCE on the total. */
export function estimateSessionMinutes(exercises: SessionTimeExercise[]): number {
  if (exercises.length === 0) return 0
  let seconds = 0
  for (const ex of exercises) {
    const avgReps = (ex.repMin + ex.repMax) / 2
    const repSec = ex.type === 'plyo' ? SESSION_TIME.plyoRepSeconds : SESSION_TIME.repSeconds
    seconds += ex.workingSets * avgReps * repSec
    seconds += Math.max(0, ex.workingSets - 1) * restSecondsFor(ex.type)
    seconds += ex.warmupSets * (SESSION_TIME.warmupSetSeconds + SESSION_TIME.warmupRestSeconds)
    seconds += SESSION_TIME.transitionSeconds
  }
  return Math.round(seconds / 60) + SESSION_TIME.warmupBlockMinutes
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/sessionLength.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/sessionLength.ts frontend/src/features/train/logic/sessionLength.test.ts
git commit -m "feat(train): sessionLength recipe-based duration estimator (mezo-oyhy.3)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 2: lint rule 8 + MesoEditor hero stat

**Files:**
- Modify: `frontend/src/features/train/logic/structureLint.ts` (union + band constant + rule in the day loop)
- Modify: `frontend/src/features/train/logic/structureLint.test.ts` (new describe + ONE existing fixture rebalanced)
- Modify: `frontend/src/features/train/components/MesoEditorHero.tsx` (new prop + label fragment)
- Modify: `frontend/src/features/train/components/MesoEditorHero.test.tsx` (new cases)
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (compute + pass `dayMinutes`)

**Interfaces:**
- Consumes: `estimateSessionMinutes` (Task 1).
- Produces: `StructureRuleId` union includes `'session-length'`; `export const SESSION_LENGTH_BAND = { min: 45, max: 90 } as const`; `MesoEditorHeroProps` gains `dayMinutes: number`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/train/logic/structureLint.test.ts` (uses its existing `ex`/`day`/`cleanWeek` helpers):

```ts
describe('session-length (R8, mezo-oyhy.3)', () => {
  it('flags a too-short and a too-long day; the clean week stays silent', () => {
    expect(structureLint(cleanWeek()).filter((f) => f.rule === 'session-length')).toHaveLength(0)
    // Short: one 2-set exercise ≈ 13 min (< 45)
    const short = [day('Hét', [ex('chest-mid', 2)])]
    const shortFound = structureLint(short).filter((f) => f.rule === 'session-length')
    expect(shortFound).toHaveLength(1)
    expect(shortFound[0].day).toBe('Hét')
    expect(shortFound[0].label).toMatch(/^Hét: ~\d+ perc\.$/)
    // Long: pile sets past 90 min — 8 compounds × 4 sets ≈ 105 min
    const long = [day('Hét', Array.from({ length: 8 }, (_, i) => ex('chest-mid', 4, { name: `L${i}` })))]
    expect(structureLint(long).filter((f) => f.rule === 'session-length')).toHaveLength(1)
  })
})
```

**Rebalance one existing fixture** — the fix-wave test `unknown-muscle` appended `ex('sport', 10)` to a clean-week day; 10 extra sets push that day past 90 min and would now (correctly) trip R8, breaking its `toEqual([])`. Change `ex('sport', 10)` to `ex('sport', 2)` in that test (same null-skip semantics, day stays in band). Touch NOTHING else in the existing tests — every other fixture stays inside 45–90 (verified in plan review: R6 edge day ≈48 min, R7 day ≈57 min; the small fixtures in R4/R5 assert via per-rule `filter(...)`, so a new R8 finding cannot break them).

Append to `frontend/src/features/train/components/MesoEditorHero.test.tsx` (reuse its existing render idiom/props — read the file first):

```tsx
  it('shows the ~perc fragment when dayMinutes > 0 and omits it at 0 (mezo-oyhy.3)', () => {
    const { rerender } = render(<MesoEditorHero {...baseProps} dayMinutes={63} />)
    expect(screen.getByText(/gyakorlat · ~63 perc/)).toBeInTheDocument()
    rerender(<MesoEditorHero {...baseProps} dayMinutes={0} />)
    expect(screen.queryByText(/~0 perc|· ~/)).not.toBeInTheDocument()
  })
```

(`baseProps` = whatever complete prop object the file's existing tests use — extend it with `dayMinutes` where needed so ALL existing cases compile; keep their assertions unchanged.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts src/features/train/components/MesoEditorHero.test.tsx`
Expected: new cases FAIL (no rule, no prop — TS compile error for `dayMinutes` is the expected failure mode for the hero test); pre-existing cases PASS (except the compile-level fixture updates you make in the same edit).

- [ ] **Step 3: Implement**

3a. `structureLint.ts`:
- Union: `export type StructureRuleId = ... | 'session-length'` (append to the existing union).
- Import: `import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'`.
- Constant (with the other thresholds): 

```ts
// Estimated session-length band, minutes (research: 20 min too short, 3 h counterproductive).
export const SESSION_LENGTH_BAND = { min: 45, max: 90 } as const
```

- In the per-day loop, directly after the R5 session-size block:

```ts
    // R8 — session length (recipe estimator; GymExercise satisfies SessionTimeExercise)
    const minutes = estimateSessionMinutes(d.exercises)
    if (minutes < SESSION_LENGTH_BAND.min || minutes > SESSION_LENGTH_BAND.max) {
      session.push({
        rule: 'session-length', day: d.day,
        label: `${d.day}: ~${minutes} perc.`,
        detail: 'A produktív sáv 45–90 perc — 20 perc túl rövid az érdemi ingerhez, 3 óra már kontraproduktív.',
      })
    }
```

3b. `MesoEditorHero.tsx` — add `dayMinutes: number` to `MesoEditorHeroProps` and to the destructuring; replace the exercise-count label line with:

```tsx
          <span className="label-mono">{dayExerciseCount} gyakorlat{dayMinutes > 0 ? ` · ~${dayMinutes} perc` : ''}</span>
```

3c. `MesoEditor.tsx` — import `estimateSessionMinutes` from `@/features/train/logic/sessionLength`; next to the existing `daySets` derivation add:

```ts
  const dayMinutes = estimateSessionMinutes(day.exercises)
```

and pass `dayMinutes={dayMinutes}` to `<MesoEditorHero …/>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts src/features/train/components/MesoEditorHero.test.tsx src/features/train/components/MesoEditor.test.tsx src/features/train/components/StructureLintCard.test.tsx`
Expected: ALL PASS (MesoEditor's own suite must stay green — if a MesoEditor test asserted the old label text `N gyakorlat` exactly, verify whether the mock day now renders a `· ~X perc` suffix and update ONLY that assertion accordingly, noting it in your report).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/structureLint.ts frontend/src/features/train/logic/structureLint.test.ts frontend/src/features/train/components/MesoEditorHero.tsx frontend/src/features/train/components/MesoEditorHero.test.tsx frontend/src/features/train/components/MesoEditor.tsx
git commit -m "feat(train): session-length lint rule + hero minutes stat (mezo-oyhy.3)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 3: consumer switches (prep, TrainToday, Today) + docs + full gate

**Files:**
- Modify: `frontend/src/features/train/logic/prepBriefing.ts` (`prepStats` computes durationEst)
- Modify: `frontend/src/features/train/logic/prepBriefing.test.ts` (expected durationEst updated)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx:~322` (chip)
- Modify: `frontend/src/features/today/pages/TodayPage.tsx:~180` (facts entry)
- Modify: test files of the two pages IF their assertions reference the old values (check `TrainTodayPage.test.tsx` fixtures with `durationEst: 30` / `durationEst: 0`)
- Modify: `docs/features/train.md`

**Interfaces:**
- Consumes: `estimateSessionMinutes` (Task 1). No new exports.

- [ ] **Step 1: `prepBriefing.ts`**

Import `estimateSessionMinutes` from `@/features/train/logic/sessionLength`. In `prepStats`, replace `durationEst: W.durationEst` with:

```ts
    durationEst: estimateSessionMinutes(W.exercises),
```

(`LoggedWorkoutExercise` satisfies `SessionTimeExercise` structurally.) Update the JSDoc header note if it mentions durationEst passthrough.

Update `prepBriefing.test.ts`: the `prepStats` expectation currently asserts `durationEst: 45` (the fixture's field). Recompute the expected value BY HAND from the fixture's exercises using the model (rep 3.5 s / plyo 2 s, rests `restSecondsFor`, warm-ups 65 s, transition 90 s, +8 min, round once), write the arithmetic in a comment above the assertion, and assert that number. Do NOT assert `estimateSessionMinutes(fixture)` against itself — that would test nothing.

- [ ] **Step 2: `TrainTodayPage.tsx`**

Import the estimator. Where the workout chips render (~line 319-323), derive once above the JSX (inside the component, where `workout` is non-null scope):

```ts
  const workoutMinutes = workout ? estimateSessionMinutes(workout.exercises) : 0
```

and replace the chip line with:

```tsx
                  {workoutMinutes > 0 && <span className="chip-np">~{workoutMinutes} perc</span>}
```

Check `TrainTodayPage.test.tsx`: fixtures carry `durationEst: 30`/`durationEst: 0` — if any assertion expects `~30 perc` (or absence at 0), update it to the estimator's output for that fixture's `exercises` array (hand-computed, comment the math). A fixture with an empty `exercises` list now hides the chip — assert absence if the old test asserted absence for `durationEst: 0`.

- [ ] **Step 3: `TodayPage.tsx`**

Import the estimator. Above the `sessions` memo (or inside it, before the array literal), derive:

```ts
    const gymMinutes = workout ? estimateSessionMinutes(workout.exercises) : 0
```

and change the gym facts entry from `` `~${workout.durationEst} perc` `` to:

```ts
      facts: [`${workout.exercises.length} gyakorlat`, gymMinutes > 0 ? `~${gymMinutes} perc` : null, prediction?.label],
```

(The facts array already tolerates nullish members via `prediction?.label` — verify the downstream filter/render handles `null` the same way; if it filters only `undefined`, use `undefined` instead of `null`.)

- [ ] **Step 4: Run the focused tests**

Run: `cd frontend && pnpm vitest run src/features/train/logic/prepBriefing.test.ts src/features/train/pages/TrainTodayPage.test.tsx src/features/today/pages/TodayPage.test.tsx src/features/train/components/PrepHero.test.tsx`
(If `TodayPage.test.tsx` doesn't exist under that exact name, run the matching `TodayPage*` glob; report if none.)
Expected: ALL PASS after the fixture-expectation updates.

- [ ] **Step 5: Update `docs/features/train.md`**

Living doc, in place: in §4's guidance-layer passage add the session-length layer:
- `sessionLength.ts` — the recipe-based duration estimator (`SESSION_TIME` pacing table; inter-set rests from `restSecondsFor`; +8 min warm-up block) is the app's single duration source: MesoEditor hero `~X perc`, `structureLint` rule 8 (`session-length`, band `SESSION_LENGTH_BAND` 45–90), prep pill, TrainToday chip, Today facts. The data layer's `durationEst` remains in the contract but no UI reads it (conscious decision — one formula everywhere). Spec pointer + bd id.

Run: `node scripts/lint-docs.mjs` — train.md clean (other docs' pre-existing flags: report, don't fix).

- [ ] **Step 6: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, full suite green BOTH modes. Unrelated red → stop and report.
NOTE for the report: the visual goldens (`train`, `train-session`, possibly `today`) are EXPECTED to change on CI (chip/pill values now computed) — that is handled by the controller after push via the baseline-regen workflow; it is NOT your concern and NOT a local failure (visual tests don't run locally).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train/logic/prepBriefing.ts frontend/src/features/train/logic/prepBriefing.test.ts frontend/src/features/train/pages/TrainTodayPage.tsx frontend/src/features/train/pages/TrainTodayPage.test.tsx frontend/src/features/today/pages/TodayPage.tsx docs/features/train.md
git commit -m "feat(train): estimator becomes the single duration source across surfaces (mezo-oyhy.3)"
# add TodayPage test file too if you had to touch one
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```
