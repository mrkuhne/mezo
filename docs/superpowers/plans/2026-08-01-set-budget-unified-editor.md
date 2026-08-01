# Set-budget warnings + unified mesocycle editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn the user when weekly/daily per-muscle set volume becomes pointless (failure ≤12/week, volume ≤20/week, ≤11/session), derive failure/volume style from the existing `targetRIR`, and merge the two mesocycle screens into one gradient-hero accordion editor used by both the builder and the (now 4-step) planner wizard.

**Architecture:** Pure FE change. A new pure-logic module (`setBudget.ts`) computes budget groups/levels client-side from the meso `days` template; new presentational components (`MesoEditorHero`, `SetBudgetCard`, `ExerciseAccordionRow`) compose into a controlled `MesoEditor` container that replaces `MesoDayTabsEditor` in the builder and the wizard; read-only budget mirrors go into `MuscleWeekSheet` and `GymPage`. No API/DB/contract change; the Failure/Volume toggle writes the existing `targetRIR` field (0 or 2) through the existing save paths.

**Tech Stack:** React 19 + Vite + Vitest + @testing-library/react, TypeScript, existing design tokens (`prototype.css` Napív palette), `muscleColors.ts` families.

**Spec:** `docs/superpowers/specs/2026-08-01-set-budget-unified-editor-design.md` (driving issue **mezo-7rdg**)

## Global Constraints

- **FE-only.** Do **NOT** run `./mvnw` or any backend command, ever. No file outside `frontend/` and `docs/` changes.
- **Read `docs/references/frontend_conventions.md` before writing any code.** Non-negotiables used here: imports deep+absolute via `@/*` (never `../`), no new barrels, tests colocated, data hooks only from `@/data/hooks`, no new `*Screen`/`*View` names, tokens only (no raw hex — use `var(--token)` / `color-mix(in srgb, var(--token) N%, transparent)`).
- **Thresholds (exact values):** failure weekly cap **12**, volume weekly cap **20**, per-session per-muscle cap **11** (warn strictly above, i.e. 12+), near-band **≥ 0.85** of budget. Style rule: `targetRIR ≤ 1` → `'failure'`, else `'volume'`. Toggle writes `targetRIR: 0` (Failure) / `targetRIR: 2` (Volume).
- **UI copy is Hungarian**; code/comments English.
- **Tests:** run every command in the **foreground** with `timeout: 600000`; never use `Monitor` or `run_in_background` to wait for a build. Mock mode is the **default** (`VITE_USE_MOCK` unset = mock; a gitignored `frontend/.env` may force real) — so always run BOTH: `pnpm test <pattern>` and `VITE_USE_MOCK=true pnpm test <pattern>`. Never run `pnpm test:visual` or regenerate Playwright goldens (per-platform; CI owns linux baselines).
- **Commits:** explicit `git add <paths>` + `git commit --no-verify` (the beads pre-commit hook force-stages a stray gitignored root `issues.jsonl` — never let it into a commit; verify with `git show --stat HEAD`). Conventional subject carrying the bd id, e.g. `feat(train): set-budget logic (mezo-7rdg)`. End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `ExerciseRecipeRow` is **kept** (still used by `CustomWorkoutBuilderPage`) — only its header comment changes. `MesoDayTabsEditor`, `Step4Recipe`, and `PlannerDaySection` are deleted once both consumers are migrated (Task 6).

---

### Task 1: setBudget logic module + shared exercise defaults

**Files:**
- Create: `frontend/src/features/train/logic/setBudget.ts`
- Create: `frontend/src/features/train/logic/exerciseDefaults.ts`
- Test: `frontend/src/features/train/logic/setBudget.test.ts`, `frontend/src/features/train/logic/exerciseDefaults.test.ts`

**Interfaces:**
- Consumes: `MesoDay`, `GymExercise`, `ExerciseLibraryItem` from `@/data/types`.
- Produces (later tasks rely on these exact names):
  - `type SetStyle = 'failure' | 'volume'`; `setStyle(targetRIR: number): SetStyle`
  - `const FAILURE_WEEKLY_CAP = 12`, `VOLUME_WEEKLY_CAP = 20`, `SESSION_MUSCLE_CAP = 11`, `NEAR_THRESHOLD = 0.85`
  - `type BudgetLevel = 'ok' | 'near' | 'over'`; `budgetOf(failureSets, volumeSets): number`; `budgetLevel(budget): BudgetLevel`
  - `budgetGroup(muscle: string): string | null`; `BUDGET_GROUP_LABELS: Record<string, string>`
  - `interface MuscleBudgetRow { group: string; label: string; colorMuscle: string; failureSets: number; volumeSets: number; workingSets: number; budget: number; level: BudgetLevel }`
  - `muscleBudgets(days: MesoDay[]): MuscleBudgetRow[]` (sorted by `budget` desc)
  - `interface SessionCapWarning { day: string; group: string; label: string; sets: number }`
  - `sessionCapWarnings(days: MesoDay[]): SessionCapWarning[]`
  - `libraryToGymExercise(item: ExerciseLibraryItem): GymExercise` (from `exerciseDefaults.ts`) — **default `targetRIR: 2`** (volume), `warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8`, id `` `${item.id}-${crypto.randomUUID()}` ``, carries `type` and optional `catalogId`.

**Design notes (read first):**
- Budget granularity is the **coarse muscle group** (the video's "muscle"), NOT the 6 color regions (Kar/Láb would over-merge biceps+triceps / quad+ham+glute+calf) and NOT the 21 catalog heads. Mapping below. `colorMuscle` is a representative catalog key so UI can call `muscleColor(colorMuscle)` for family colors.
- `muscleBudgets` traverses `days` itself — `muscleWeek.ts` stays **untouched** (spec §3.1 simplification, noted in the spec).
- Off-day exercises (`muscle === ''` or `'sport'`) are skipped; **working sets only** (warmups never counted) — same conventions as `muscleWeek.ts:21-42`.

- [ ] **Step 1: Write the failing tests** — `setBudget.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { MesoDay } from '@/data/types'
import {
  budgetGroup, budgetLevel, budgetOf, muscleBudgets, sessionCapWarnings, setStyle,
} from '@/features/train/logic/setBudget'

const ex = (muscle: string, workingSets: number, targetRIR: number) => ({
  id: `${muscle}-${workingSets}-${targetRIR}-${Math.random()}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const day = (dayKey: string, muscle: string, exercises: ReturnType<typeof ex>[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle, exerciseCount: exercises.length, exercises })

describe('setStyle', () => {
  it('classifies RIR 0 and 1 as failure, 2+ as volume', () => {
    expect(setStyle(0)).toBe('failure')
    expect(setStyle(1)).toBe('failure')
    expect(setStyle(2)).toBe('volume')
    expect(setStyle(5)).toBe('volume')
  })
})

describe('budgetOf + budgetLevel', () => {
  it('caps: 12 failure sets or 20 volume sets exactly fill the budget', () => {
    expect(budgetOf(12, 0)).toBeCloseTo(1)
    expect(budgetOf(0, 20)).toBeCloseTo(1)
    expect(budgetLevel(1)).toBe('near') // 100% is still allowed — over only past it
    expect(budgetLevel(1.01)).toBe('over')
    expect(budgetLevel(0.84)).toBe('ok')
    expect(budgetLevel(0.85)).toBe('near')
  })
  it('mixed: 8 failure + 6 volume = 0.9667; +2 volume tips over', () => {
    expect(budgetOf(8, 6)).toBeCloseTo(8 / 12 + 6 / 20)
    expect(budgetLevel(budgetOf(8, 6))).toBe('near')
    expect(budgetLevel(budgetOf(8, 8))).toBe('over')
  })
})

describe('budgetGroup', () => {
  it('maps heads to coarse groups and keeps arms/legs split', () => {
    expect(budgetGroup('chest-upper')).toBe('chest')
    expect(budgetGroup('lats')).toBe('back')
    expect(budgetGroup('biceps-long')).toBe('biceps')
    expect(budgetGroup('triceps-medial')).toBe('triceps')
    expect(budgetGroup('quad')).toBe('quad')
    expect(budgetGroup('sport')).toBeNull()
    expect(budgetGroup('')).toBeNull()
  })
})

describe('muscleBudgets', () => {
  it('aggregates across days into groups with style split and level', () => {
    const days = [
      day('H', 'chest', [ex('chest-mid', 4, 0), ex('chest-upper', 4, 0)]),
      day('Cs', 'chest', [ex('chest-mid', 4, 2), ex('chest-lower', 4, 2)]),
      day('K', '', []), // rest day ignored
    ]
    const rows = muscleBudgets(days)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      group: 'chest', label: 'Mell', failureSets: 8, volumeSets: 8, workingSets: 16, level: 'over',
    })
    expect(rows[0].budget).toBeCloseTo(8 / 12 + 8 / 20)
  })
  it('skips off-day and sport rows entirely', () => {
    const days = [day('Sze', 'sport', [ex('sport', 6, 0)]), day('H', '', [])]
    expect(muscleBudgets(days)).toHaveLength(0)
  })
})

describe('sessionCapWarnings', () => {
  it('warns strictly above 11 working sets per group per day', () => {
    const ok = [day('H', 'shoulder', [ex('shoulder-side', 6, 2), ex('shoulder-front', 5, 2)])]  // 11
    const bad = [day('H', 'shoulder', [ex('shoulder-side', 6, 2), ex('shoulder-front', 6, 2)])] // 12
    expect(sessionCapWarnings(ok)).toHaveLength(0)
    expect(sessionCapWarnings(bad)).toEqual([{ day: 'H', group: 'shoulder', label: 'Váll', sets: 12 }])
  })
})
```

And `exerciseDefaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'

describe('libraryToGymExercise', () => {
  it('defaults a new pick to volume style (RIR 2) with the standard recipe', () => {
    const gx = libraryToGymExercise({ id: 'lib1', name: 'Fekvenyomás', muscle: 'chest-mid', type: 'compound' } as never)
    expect(gx).toMatchObject({ name: 'Fekvenyomás', muscle: 'chest-mid', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 2, type: 'compound' })
    expect(gx.id.startsWith('lib1-')).toBe(true)
  })
  it('carries catalogId only when present', () => {
    expect('catalogId' in libraryToGymExercise({ id: 'a', name: 'X', muscle: 'quad', type: 'isolation' } as never)).toBe(false)
    expect(libraryToGymExercise({ id: 'a', name: 'X', muscle: 'quad', type: 'isolation', catalogId: 'c1' } as never).catalogId).toBe('c1')
  })
})
```

- [ ] **Step 2: Run to verify they fail** — `cd frontend && pnpm test setBudget exerciseDefaults` → FAIL (module not found).
- [ ] **Step 3: Implement `setBudget.ts`:**

```ts
// ============================================================
// Mezo · setBudget — planning-time weekly set-budget per muscle group
// (mezo-7rdg, spec 2026-08-01). Source: Built With Science video
// (yt ehQ_5TThkRI, Zourdos/Remmert): failure style (RIR≤1) is productive
// up to ~12 sets/muscle/week, volume style (RIR≥2) up to ~20; beyond ~11
// sets/muscle in ONE session extra sets don't add growth. Budget model:
// each failure set costs 1/12, each volume set 1/20 of the weekly budget.
// Pure client-side derivation from the meso days template — nothing persisted.
// Granularity is the coarse muscle group (chest/back/…): finer than the 6
// color regions (Kar/Láb would over-merge), coarser than the 21 heads.
// ============================================================
import type { MesoDay } from '@/data/types'

export type SetStyle = 'failure' | 'volume'
export const FAILURE_WEEKLY_CAP = 12
export const VOLUME_WEEKLY_CAP = 20
export const SESSION_MUSCLE_CAP = 11
export const NEAR_THRESHOLD = 0.85

export function setStyle(targetRIR: number): SetStyle {
  return targetRIR <= 1 ? 'failure' : 'volume'
}

export type BudgetLevel = 'ok' | 'near' | 'over'

export function budgetOf(failureSets: number, volumeSets: number): number {
  return failureSets / FAILURE_WEEKLY_CAP + volumeSets / VOLUME_WEEKLY_CAP
}

export function budgetLevel(budget: number): BudgetLevel {
  return budget > 1 ? 'over' : budget >= NEAR_THRESHOLD ? 'near' : 'ok'
}

// Catalog head / legacy key → coarse budget group. Off-day keys ('', 'sport') → null.
const BUDGET_GROUP: Record<string, string> = {
  'chest-upper': 'chest', 'chest-mid': 'chest', 'chest-lower': 'chest', chest: 'chest',
  'back-wide': 'back', 'back-mid': 'back', 'back-lower': 'back', lats: 'back', back: 'back',
  traps: 'traps',
  'shoulder-front': 'shoulder', 'shoulder-side': 'shoulder', 'shoulder-rear': 'shoulder',
  shoulder: 'shoulder', 'rear-delt': 'shoulder',
  'biceps-long': 'biceps', 'biceps-short': 'biceps', 'biceps-brachialis': 'biceps', biceps: 'biceps',
  'triceps-long': 'triceps', 'triceps-lateral': 'triceps', 'triceps-medial': 'triceps', triceps: 'triceps',
  quad: 'quad', ham: 'ham', glute: 'glute', calf: 'calf', core: 'core',
}

export const BUDGET_GROUP_LABELS: Record<string, string> = {
  chest: 'Mell', back: 'Hát', traps: 'Trapéz', shoulder: 'Váll', biceps: 'Bicepsz',
  triceps: 'Tricepsz', quad: 'Comb', ham: 'Hamstring', glute: 'Farizom', calf: 'Vádli', core: 'Core',
}

export function budgetGroup(muscle: string): string | null {
  return BUDGET_GROUP[muscle] ?? null
}

export interface MuscleBudgetRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor() for the family tokens. */
  colorMuscle: string
  failureSets: number
  volumeSets: number
  workingSets: number
  /** 1 = 100% of the weekly budget. */
  budget: number
  level: BudgetLevel
}

export function muscleBudgets(days: MesoDay[]): MuscleBudgetRow[] {
  const acc = new Map<string, MuscleBudgetRow>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      let row = acc.get(group)
      if (!row) {
        row = { group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle, failureSets: 0, volumeSets: 0, workingSets: 0, budget: 0, level: 'ok' }
        acc.set(group, row)
      }
      if (setStyle(ex.targetRIR) === 'failure') row.failureSets += ex.workingSets
      else row.volumeSets += ex.workingSets
      row.workingSets += ex.workingSets
    }
  }
  return [...acc.values()]
    .map((r) => { const budget = budgetOf(r.failureSets, r.volumeSets); return { ...r, budget, level: budgetLevel(budget) } })
    .sort((a, b) => b.budget - a.budget || a.group.localeCompare(b.group))
}

export interface SessionCapWarning { day: string; group: string; label: string; sets: number }

/** Days where one muscle group exceeds SESSION_MUSCLE_CAP working sets in a single session. */
export function sessionCapWarnings(days: MesoDay[]): SessionCapWarning[] {
  const out: SessionCapWarning[] = []
  for (const d of days) {
    const perGroup = new Map<string, number>()
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      perGroup.set(group, (perGroup.get(group) ?? 0) + ex.workingSets)
    }
    for (const [group, sets] of perGroup) {
      if (sets > SESSION_MUSCLE_CAP) out.push({ day: d.day, group, label: BUDGET_GROUP_LABELS[group] ?? group, sets })
    }
  }
  return out
}
```

And `exerciseDefaults.ts`:

```ts
// ============================================================
// Mezo · exerciseDefaults — library pick → planned GymExercise defaults,
// shared by the unified MesoEditor parents (builder MesoExercises + planner
// wizard). New exercises default to VOLUME style (targetRIR 2, mezo-7rdg) —
// the Failure/Volume toggle flips RIR to 0/2 afterwards.
// ============================================================
import type { ExerciseLibraryItem, GymExercise } from '@/data/types'

export function libraryToGymExercise(item: ExerciseLibraryItem): GymExercise {
  return {
    id: `${item.id}-${crypto.randomUUID()}`,
    name: item.name,
    muscle: item.muscle,
    warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 2,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
}
```

- [ ] **Step 4: Run to verify they pass** — `cd frontend && pnpm test setBudget exerciseDefaults && VITE_USE_MOCK=true pnpm test setBudget exerciseDefaults` → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/setBudget.ts frontend/src/features/train/logic/setBudget.test.ts frontend/src/features/train/logic/exerciseDefaults.ts frontend/src/features/train/logic/exerciseDefaults.test.ts
git commit --no-verify -m "feat(train): set-budget logic + volume-default exercise factory (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: ExerciseAccordionRow

**Files:**
- Create: `frontend/src/features/train/components/ExerciseAccordionRow.tsx`
- Test: `frontend/src/features/train/components/ExerciseAccordionRow.test.tsx`
- Modify: `frontend/src/features/train/components/ExerciseRecipeRow.tsx` (header comment only: now custom-workout-builder-only)

**Interfaces:**
- Consumes: `GymExercise` from `@/data/types`; `setStyle` from `@/features/train/logic/setBudget`; `muscleColor` from `@/features/train/logic/muscleColors`; `MUSCLE_LABELS` from `@/data/train/train`; `Icon` from `@/shared/ui/Icon`.
- Produces: `ExerciseAccordionRow({ ex, expanded, onToggle, onRemove, onChange }: { ex: GymExercise; expanded: boolean; onToggle: () => void; onRemove: () => void; onChange: (patch: Partial<GymExercise>) => void })`.

**Design (from the approved composite-v2 mockup):**
- Card with a 5px left rail in `muscleColor(ex.muscle).rail`, `borderRadius` via the `card` class.
- **Collapsed:** header button (whole row, `aria-expanded`) — name (`--ff-display`, 14.5px, 700), muscle pill (`fam.wash` bg / `fam.deep` text, uppercase `MUSCLE_LABELS[ex.muscle]`), style chip `🔥 4×8–10` (failure: `color-mix(in srgb, var(--coral) 10%, transparent)` bg + `var(--coral-deep)` text) or `🌿 4×12–15` (`var(--wash-sage)` bg + `var(--sage-deep)` text), caret `▾`.
- **Expanded:** same header (caret `▴`) + body:
  - Segmented toggle (two buttons in a `--surface-2` pill): `🔥 Failure` / `🌿 Volume`. Active = `setStyle(ex.targetRIR)`; active failure bg `linear-gradient(135deg, var(--coral), var(--coral-deep))` white text, active volume bg `var(--sage-deep)` white text. Click → `onChange({ targetRIR: 0 })` / `onChange({ targetRIR: 2 })`. `aria-pressed` on each.
  - 2×2 stepper grid (each tile: `--surface-2` bg, radius 12, label-mono caption, 28px −/+ buttons — noticeably bigger than the old 18px):
    - **Munkaszett** — `workingSets`, min 1 max 10 → `onChange({ workingSets: v })`
    - **Rep tartomány** — shows `${repMin}–${repMax}`; − shifts the window down (`{ repMin: repMin - 1, repMax: repMax - 1 }`, floor repMin 1), + shifts up (ceil repMax 100). Window size changes live in Finomhangolás.
    - **Kiinduló kg** — port `AnchorStepper` semantics verbatim from `ExerciseRecipeRow.tsx:92-121` (nullable, 2.5 steps, 'auto', +from-auto starts 20)
    - **Bemelegítő** — `warmupSets`, min 0 max 10
  - **Finomhangolás** disclosure (small `label-mono` button toggling a row of three small steppers): `RIR` 0–5 → `onChange({ targetRIR: v })` (manual values reclassify the style chip automatically), `Rep min` (1..repMax), `Rep max` (repMin..100).
  - Remove button (`✕`, `aria-label` `` `${ex.name} törlése` ``) in the expanded body footer.
  - If `ex.warning` exists, render it as in `ExerciseRecipeRow.tsx:28-33` (warning icon + text).
- All stepper `aria-label`s name-scoped as in `ExerciseRecipeRow` (`` `${ex.name} · <mező> növelése/csökkentése` ``).

- [ ] **Step 1: Write the failing test** — `ExerciseAccordionRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseAccordionRow } from '@/features/train/components/ExerciseAccordionRow'

const ex: GymExercise = {
  id: 'e1', name: 'Fekvenyomás', muscle: 'chest-mid',
  warmupSets: 1, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 0, type: 'compound',
}
const noop = () => {}

describe('ExerciseAccordionRow', () => {
  it('collapsed: shows name + style summary chip, no steppers', () => {
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} />)
    expect(screen.getByText('Fekvenyomás')).toBeInTheDocument()
    expect(screen.getByText(/4×8–10/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Fekvenyomás · Munkaszett növelése')).not.toBeInTheDocument()
  })

  it('expanded: failure toggle is active at RIR 0 and Volume writes targetRIR 2', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /Failure/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Volume/ }))
    expect(onChange).toHaveBeenCalledWith({ targetRIR: 2 })
  })

  it('expanded: Failure writes targetRIR 0 when currently volume', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={{ ...ex, targetRIR: 2 }} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Failure/ }))
    expect(onChange).toHaveBeenCalledWith({ targetRIR: 0 })
  })

  it('rep window shifts both ends together', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Rep tartomány növelése'))
    expect(onChange).toHaveBeenCalledWith({ repMin: 9, repMax: 11 })
  })

  it('header click toggles', () => {
    const onToggle = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={onToggle} onRemove={noop} onChange={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /Fekvenyomás/ }))
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend && pnpm test ExerciseAccordionRow` → FAIL.
- [ ] **Step 3: Implement the component** per the design above. Follow the visual vocabulary of `MuscleWeekSheet.tsx:73-103` (rail + wash/deep pills) and reuse the stepper-tile pattern (label + −/value/+ row) modeled on `ExerciseRecipeRow`'s `RecipeStepper` but with 28px buttons and `borderRadius: 10`.
- [ ] **Step 4: Run to verify it passes** — `pnpm test ExerciseAccordionRow && VITE_USE_MOCK=true pnpm test ExerciseAccordionRow` → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/ExerciseAccordionRow.tsx frontend/src/features/train/components/ExerciseAccordionRow.test.tsx frontend/src/features/train/components/ExerciseRecipeRow.tsx
git commit --no-verify -m "feat(train): accordion exercise row with failure/volume toggle (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: MesoEditorHero + SetBudgetCard

**Files:**
- Create: `frontend/src/features/train/components/MesoEditorHero.tsx`
- Create: `frontend/src/features/train/components/SetBudgetCard.tsx`
- Test: `frontend/src/features/train/components/MesoEditorHero.test.tsx`, `frontend/src/features/train/components/SetBudgetCard.test.tsx`

**Interfaces:**
- Consumes: `MuscleBudgetRow`, `SessionCapWarning` from `@/features/train/logic/setBudget`; `muscleColor` from `@/features/train/logic/muscleColors`.
- Produces:
  - `MesoEditorHero({ dayType, daySets, dayExerciseCount, weekSets, trainingDays, warningCount }: { dayType: string; daySets: number; dayExerciseCount: number; weekSets: number; trainingDays: number; warningCount: number })`
  - `SetBudgetCard({ budgets, capWarnings, defaultOpen }: { budgets: MuscleBudgetRow[]; capWarnings: SessionCapWarning[]; defaultOpen?: boolean })`

**Design (composite-v2 mockup):**
- **Hero:** card, `background: linear-gradient(180deg, var(--wash-gym) 0%, var(--surface-1) 100%)` normally; when `warningCount > 0` use `var(--wash-amber)` as the top stop. Absolutely-positioned radial glow circle top-right (`radial-gradient(circle, color-mix(in srgb, var(--coral) 18%, transparent), transparent 70%)`; error-tinted when warning). Content: eyebrow `dayType`, big number `daySets` (`--ff-display`, 40px, 800) + "szett ma", right-aligned `label-mono` `{dayExerciseCount} gyakorlat`; status line `Heti terhelés: **{weekSets} szett** · {trainingDays} edzésnap` with right-aligned `✓ kereten belül` (`var(--sage-deep)`) or `⚠ {warningCount} jelzés` (`var(--error)`).
- **SetBudgetCard:** card with a header row (`Heti szet-büdzsé` eyebrow + caret button, `aria-expanded`). `useState(open)` seeded from `defaultOpen ?? false`.
  - Collapsed: wrap of pills — `` `${label} ${Math.round(budget * 100)}%` `` — colors by level: `ok` → `fam.wash`/`fam.deep` (from `muscleColor(colorMuscle)`), `near` → `var(--wash-amber)`/`var(--amber-deep)`, `over` → `color-mix(in srgb, var(--error) 12%, transparent)`/`var(--error)`.
  - Expanded: one row per budget — 5px rail (`fam.rail`), bold label, right `label-mono` `` `${pct}% · ${failureSets}🔥+${volumeSets}🌿` `` (omit a zero side), then an 8-9px progress bar: fill `min(100, pct)%` wide in `fam.rail` (over: `linear-gradient(90deg, var(--coral), var(--error))`).
  - Warning lines under the rows: for every `over` budget — `⚠ **{label}: heti keret {pct}%.** A failure/volume kereten túl — a plusz szettek már alig hoznak növekedést.` (error-tinted box: `color-mix(in srgb, var(--error) 8%, transparent)` bg, `var(--error)` text); for every `capWarnings` entry — `⚠ **{label}: {sets} szett egy edzésen ({day}).** 11 fölött nincs kimutatható plusz — oszd el két napra!` (amber box: `var(--wash-amber)` bg, `var(--amber-deep)` text).

- [ ] **Step 1: Write the failing tests:**

```tsx
// MesoEditorHero.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'

describe('MesoEditorHero', () => {
  it('shows day + week numbers and the ok state', () => {
    render(<MesoEditorHero dayType="Push A" daySets={14} dayExerciseCount={5} weekSets={58} trainingDays={4} warningCount={0} />)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText(/58 szett/)).toBeInTheDocument()
    expect(screen.getByText(/kereten belül/)).toBeInTheDocument()
  })
  it('shows the warning count when over', () => {
    render(<MesoEditorHero dayType="Push A" daySets={18} dayExerciseCount={5} weekSets={64} trainingDays={4} warningCount={2} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
    expect(screen.queryByText(/kereten belül/)).not.toBeInTheDocument()
  })
})
```

```tsx
// SetBudgetCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'
import { SetBudgetCard } from '@/features/train/components/SetBudgetCard'

const over: MuscleBudgetRow = { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', failureSets: 8, volumeSets: 8, workingSets: 16, budget: 8 / 12 + 8 / 20, level: 'over' }
const ok: MuscleBudgetRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', failureSets: 0, volumeSets: 8, workingSets: 8, budget: 0.4, level: 'ok' }
const cap: SessionCapWarning = { day: 'H', group: 'shoulder', label: 'Váll', sets: 13 }

describe('SetBudgetCard', () => {
  it('collapsed by default: pills with percentages, no warning text', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} />)
    expect(screen.getByText(/Mell 107%/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument()
  })
  it('expanded: renders budget rows, over-budget and session-cap warning lines', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} defaultOpen />)
    expect(screen.getByText(/8🔥\+8🌿/)).toBeInTheDocument()
    expect(screen.getByText(/Mell: heti keret 107%/)).toBeInTheDocument()
    expect(screen.getByText(/Váll: 13 szett egy edzésen/)).toBeInTheDocument()
  })
  it('caret toggles open state', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /szet-büdzsé/i }))
    expect(screen.getByText(/0🔥\+8🌿|8🌿/)).toBeInTheDocument()
  })
})
```

(Percent rendering: `Math.round(budget * 100)` → `over.budget = 1.0667` → `107%`. Keep the assertion and the implementation consistent.)

- [ ] **Step 2: Run to verify they fail** — `cd frontend && pnpm test MesoEditorHero SetBudgetCard` → FAIL.
- [ ] **Step 3: Implement both components** per the design.
- [ ] **Step 4: Run to verify they pass** — `pnpm test MesoEditorHero SetBudgetCard && VITE_USE_MOCK=true pnpm test MesoEditorHero SetBudgetCard` → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/MesoEditorHero.tsx frontend/src/features/train/components/MesoEditorHero.test.tsx frontend/src/features/train/components/SetBudgetCard.tsx frontend/src/features/train/components/SetBudgetCard.test.tsx
git commit --no-verify -m "feat(train): editor hero + collapsible set-budget card (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: MesoEditor container

**Files:**
- Create: `frontend/src/features/train/components/MesoEditor.tsx`
- Create: `frontend/src/features/train/logic/offDay.ts`
- Test: `frontend/src/features/train/components/MesoEditor.test.tsx`

**Interfaces:**
- Consumes: `MesoEditorHero`, `SetBudgetCard`, `ExerciseAccordionRow` (Tasks 2-3), `muscleBudgets`, `sessionCapWarnings` (Task 1), `SortableList` from `@/shared/ui/SortableList`, `Icon` from `@/shared/ui/Icon`.
- Produces:
  - `logic/offDay.ts`: `isOffDay(d: Pick<MesoDay, 'muscle'>): boolean` — moved verbatim from `MesoDayTabsEditor.tsx:16-18` (`d.muscle === '' || d.muscle === 'sport'`).
  - `MesoEditor(props: { days: MesoDay[]; onAddClick: (dayKey: string) => void; onRemove: (dayKey: string, exId: string) => void; onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void; onReorder: (dayKey: string, ids: string[]) => void; onRenameDay?: (dayKey: string, name: string) => void })` — a **drop-in replacement** for `MesoDayTabsEditor`'s props plus optional `onRenameDay`.

**Behavior:**
- Day-tab strip: port `MesoDayTabsEditor.tsx:40-75` (same active-day seeding: `current` day → first non-off → first). Add a red warning dot (6px, `var(--error)`, absolute top-right) on any tab whose day appears in `sessionCapWarnings(days)`.
- Hero: `<MesoEditorHero dayType={day.type} daySets={Σ workingSets of active day} dayExerciseCount={day.exercises.length} weekSets={Σ all days} trainingDays={days.filter(d => d.exercises.length > 0).length} warningCount={overBudgets.length + capWarnings.length} />`.
- When `onRenameDay` is provided and `day.muscle === 'custom'`: the hero's `dayType` line is replaced by an inline text input (`aria-label` `` `${day.day} nap átnevezése` ``) calling `onRenameDay(day.day, value)` on change — capability parity with `PlannerDaySection`'s rename.
- Budget card: `<SetBudgetCard budgets={budgets} capWarnings={capWarnings} defaultOpen={warningCount > 0} />` where `budgets = muscleBudgets(days)`, `capWarnings = sessionCapWarnings(days)`.
- Off-day: port the off-day card from `MesoDayTabsEditor.tsx:87-97` unchanged.
- Exercise list: `SortableList` (as `MesoDayTabsEditor.tsx:100-110`, keeping `label: e.name` for the drag-handle aria-labels) rendering `ExerciseAccordionRow` with `expanded={expandedId === e.id}` / `onToggle={() => setExpandedId(cur => cur === e.id ? null : e.id)}`. Single-expand state `useState<string | null>(null)`. The accordion header button carries `aria-label` `` `${ex.name} · szerkesztés` `` so its accessible name never collides with the sortable-row buttons (`… áthelyezése/feljebb/lejjebb`).
- **Auto-expand new exercise:** keep a `useRef<Set<string>>` of known exercise ids; on `days` change, if the active day contains an id not in the set, `setExpandedId(newId)`; refresh the set every render pass.
- Add button: port `MesoDayTabsEditor.tsx:111-132` (dashed "Gyakorlat hozzáadása" → `onAddClick(day.day)`).

- [ ] **Step 1: Write the failing test** — `MesoEditor.test.tsx` (model provider-less render on `MesoDayTabsEditor.test.tsx` — read it first and mirror its setup):

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MesoDay } from '@/data/types'
import { MesoEditor } from '@/features/train/components/MesoEditor'

const ex = (id: string, muscle: string, workingSets: number, targetRIR: number) => ({
  id, name: `Gyak ${id}`, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const days: MesoDay[] = [
  { day: 'H', type: 'Push A', muscle: 'chest', exerciseCount: 2, exercises: [ex('a', 'chest-mid', 6, 0), ex('b', 'chest-upper', 6, 0)], current: true },
  { day: 'K', type: 'Pihenő', muscle: '', exerciseCount: 0, exercises: [] },
  { day: 'Cs', type: 'Pull A', muscle: 'back', exerciseCount: 1, exercises: [ex('c', 'back-wide', 13, 2)] },
]
const noop = () => {}
const props = { onAddClick: noop, onRemove: noop, onChange: noop, onReorder: noop }

describe('MesoEditor', () => {
  it('renders hero with active-day sets and week totals', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText('12')).toBeInTheDocument()          // active day H: 6+6
    expect(screen.getByText(/25 szett/)).toBeInTheDocument()    // week: 12+13
  })
  it('flags warnings: chest budget is 100% (near, not over), but H chest 12 sets AND Cs back 13 sets both break the session cap', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
  })
  it('collapsed rows expand one at a time', () => {
    render(<MesoEditor days={days} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyak a · szerkesztés/ }))
    expect(screen.getByRole('button', { name: /Volume/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gyak b · szerkesztés/ }))
    expect(screen.getAllByRole('button', { name: /Volume/ })).toHaveLength(1)
  })
  it('add button forwards the active day key', () => {
    const onAddClick = vi.fn()
    render(<MesoEditor days={days} {...props} onAddClick={onAddClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(onAddClick).toHaveBeenCalledWith('H')
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend && pnpm test "MesoEditor\.test"` → FAIL.
- [ ] **Step 3: Implement `logic/offDay.ts` + `MesoEditor.tsx`** per the behavior spec. (Do NOT delete `MesoDayTabsEditor` yet — the wizard still uses it until Task 6. `MesoDayTabsEditor` keeps its local `isOffDay` export for now; consumers migrate in Task 6.)
- [ ] **Step 4: Run to verify it passes** — `pnpm test "MesoEditor\.test" && VITE_USE_MOCK=true pnpm test "MesoEditor\.test"` → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/MesoEditor.tsx frontend/src/features/train/components/MesoEditor.test.tsx frontend/src/features/train/logic/offDay.ts
git commit --no-verify -m "feat(train): unified MesoEditor container (tabs + hero + budget + accordion) (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Builder integration (MesoExercises → MesoEditor)

**Files:**
- Modify: `frontend/src/features/train/components/MesoExercises.tsx`
- Test: `frontend/src/features/train/components/MesoExercises.test.tsx` (update existing)

**Interfaces:**
- Consumes: `MesoEditor` (Task 4), `libraryToGymExercise` from `@/features/train/logic/exerciseDefaults` (Task 1).
- Produces: `MesoExercises({ meso })` — public signature unchanged (builder page untouched).

**Changes to `MesoExercises.tsx`:**
1. Delete the local `libraryToGymExercise` (lines 27-37) — import from `@/features/train/logic/exerciseDefaults` instead (this flips the add-default to `targetRIR: 2`).
2. Delete the intro card (lines 120-135) and the footer "Heti szet-volumen" card (lines 147-160) — the hero + `SetBudgetCard` replace both.
3. Replace `<MesoDayTabsEditor …>` with `<MesoEditor days={days} onAddClick={setPickerDay} onRemove={removeExercise} onChange={updateExercise} onReorder={reorderExercises} />` (no `onRenameDay` in the builder).
4. Everything else (seedDays, persistDay, mutation helpers, picker sheet block at lines 162-171, the empty-days guard) stays byte-identical.

- [ ] **Step 1: Update the existing test file.** Read `MesoExercises.test.tsx` first. Keep its provider/mocking setup; update assertions that referenced the intro card / footer summary ("Heti szet-volumen", intro copy) to instead assert: (a) the hero renders (`/szett ma|Heti terhelés/`), (b) the budget card renders (`/Heti szet-büdzsé/`), (c) add→persist still fires (existing behavior tests stay).
- [ ] **Step 2: Run to verify current state fails** — `cd frontend && pnpm test MesoExercises` → FAIL (new assertions).
- [ ] **Step 3: Apply the four changes above.**
- [ ] **Step 4: Verify** — `pnpm test MesoExercises MesocycleBuilderPage && VITE_USE_MOCK=true pnpm test MesoExercises MesocycleBuilderPage` → PASS (builder page test exercises the view switch).
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/MesoExercises.tsx frontend/src/features/train/components/MesoExercises.test.tsx
git commit --no-verify -m "feat(train): builder Gyakorlatok view on the unified MesoEditor (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Wizard merge (5 → 4 steps) + dead-code removal

**Files:**
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx`
- Modify: `frontend/src/features/train/logic/planner.ts` (`stepLabels`)
- Delete: `frontend/src/features/train/components/MesoDayTabsEditor.tsx` + `MesoDayTabsEditor.test.tsx`, `frontend/src/features/train/components/PlannerDaySection.tsx` + its test if one exists
- Test: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`, `frontend/src/features/train/logic/planner.test.ts` (update existing)

**Interfaces:**
- Consumes: `MesoEditor` (Task 4), `libraryToGymExercise` from `@/features/train/logic/exerciseDefaults`, `isOffDay` from `@/features/train/logic/offDay` (update any other importer of `MesoDayTabsEditor`'s `isOffDay` — `grep -rn "isOffDay" frontend/src` first).
- Produces: 4-step wizard; step 3 ("Program") is terminal and hosts the save buttons.

**Changes:**
1. `planner.ts`: `stepLabels` loses its last entry; entry index 3 becomes `'Program'`. Update `planner.test.ts` accordingly (read it first — it may assert the array).
2. `MesocyclePlannerPage.tsx`:
   - `STEP_COUNT = 4`; `PAGE_TITLES` → 4 entries, index 3: `'A programod · gyakorlatok + set & rep'`.
   - The inline `addExercise` (lines 127-142) now uses the imported `libraryToGymExercise` (delete the inlined object literal).
   - `canNext`: `(step === 0 && !!goal) || (step === 1 && weeks > 0) || (step === 2 && selectedDays.length === days) || step === 3`.
   - Footer nav: `step < 3` → Vissza/Tovább; `step === 3` → the two save buttons (move the existing `step === 4` block).
   - Delete `Step4Recipe` (lines 1000-1045) entirely.
   - Rewrite `Step3Program`: keep its loading state (lines 878-901), the summary header card (lines 908-937), and the AI-hint card (lines 939-952); **replace** the `PlannerDaySection` day list (lines 954-968) and toolchips with `<MesoEditor days={program} onAddClick={setPickerDay} onRemove={onRemove} onChange={onChange} onReorder={onReorder} onRenameDay={onRename} />`; add `onChange` to `Step3Program`'s props (`onChange: (dayName: string, exId: string, patch: Partial<GymExercise>) => void`, wired to the page-level `updateExercise`); keep the pickerDay/`ExercisePickerSheet` block (986-995). Note `PlannerDay` is structurally a `MesoDay` — if TS complains about missing optional fields, map `program` through `(d) => ({ ...d })` and satisfy the type per `MesoDay` in `@/data/types`.
   - Rename: pass `onRenameDay={onRename}` unconditionally — `MesoEditor`'s own `day.muscle === 'custom'` gate (Task 4 behavior) decides when the inline rename input shows, which is capability-equivalent to the old `Step3Program` gating (`d.muscle === 'custom'`, line 965).
   - Remove now-unused imports (`MesoDayTabsEditor`, `PlannerDaySection`, `MiniStat` stays — the summary card uses it).
3. Delete `MesoDayTabsEditor.tsx`, its test, and `PlannerDaySection.tsx` (+test). Before deleting run `grep -rn "MesoDayTabsEditor\|PlannerDaySection" frontend/src` — the only hits must be the files being deleted. If any other importer of `isOffDay` pointed at `MesoDayTabsEditor`, repoint to `@/features/train/logic/offDay`.

- [ ] **Step 1: Update tests first.** Read `MesocyclePlannerPage.test.tsx`; update step-walk assertions from 5 to 4 steps (the save buttons now appear on the "Program" step; assertions about "Set & rep" step text go away; add an assertion that the Program step renders the budget card `/Heti szet-büdzsé/`). Update `planner.test.ts` for the 4-entry `stepLabels`.
- [ ] **Step 2: Run to verify they fail** — `cd frontend && pnpm test MesocyclePlannerPage planner` → FAIL.
- [ ] **Step 3: Apply changes 1-3.**
- [ ] **Step 4: Verify** — `pnpm test MesocyclePlannerPage planner && VITE_USE_MOCK=true pnpm test MesocyclePlannerPage planner && pnpm build` → PASS + clean build (`tsc -b` catches any survivor import of the deleted files).
- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/train
git commit --no-verify -m "feat(train): 4-step planner wizard on the unified editor; drop MesoDayTabsEditor/PlannerDaySection (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(`git add -A` scoped to `frontend/src/features/train` is safe — verify `git show --stat HEAD` lists no `issues.jsonl`.)

---

### Task 7: Read-only budget mirrors (MuscleWeekSheet + GymPage)

**Files:**
- Modify: `frontend/src/features/train/sheets/MuscleWeekSheet.tsx`
- Modify: `frontend/src/features/train/pages/GymPage.tsx`
- Test: `frontend/src/features/train/sheets/MuscleWeekSheet.test.tsx`, `frontend/src/features/train/pages/GymPage.test.tsx` (update existing)

**Interfaces:**
- Consumes: `muscleBudgets`, `sessionCapWarnings`, `budgetGroup` from `@/features/train/logic/setBudget`; `SetBudgetCard` (Task 3).

**Changes:**
1. `MuscleWeekSheet.tsx`: after section ① (below the `▲ = sport…` caption, line 107-109), insert `SectionHead color="var(--amber-deep)" title="Set-büdzsé" sub="failure ≤12 · volume ≤20 szett/hét · max 11 szett/edzés"` + `<SetBudgetCard budgets={muscleBudgets(days)} capWarnings={sessionCapWarnings(days)} defaultOpen />`.
2. `GymPage.tsx`: compute `const overGroups = new Set(muscleBudgets(days).filter((b) => b.level === 'over').map((b) => b.group))` next to `muscleGroups` (line 73). In the muscle pill render (lines 145-154): `const over = overGroups.has(budgetGroup(r.muscle) ?? '')`; when `over`, color the pill text `var(--error)` (background stays `fam.wash`) and append `' ⚠'` to the label.

- [ ] **Step 1: Update tests first.** Read both test files, keep their setup. `MuscleWeekSheet.test.tsx`: add a case asserting `/Set-büdzsé/` renders and, with an over-budget fixture (e.g. a meso whose days give chest 8 failure + 8 volume sets), `/Mell: heti keret/` appears. `GymPage.test.tsx`: with the same style of fixture, the chest pill text ends with `⚠`.
- [ ] **Step 2: Run to verify they fail** — `cd frontend && pnpm test MuscleWeekSheet GymPage` → FAIL.
- [ ] **Step 3: Apply changes.**
- [ ] **Step 4: Verify** — `pnpm test MuscleWeekSheet GymPage && VITE_USE_MOCK=true pnpm test MuscleWeekSheet GymPage` → PASS.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/sheets/MuscleWeekSheet.tsx frontend/src/features/train/sheets/MuscleWeekSheet.test.tsx frontend/src/features/train/pages/GymPage.tsx frontend/src/features/train/pages/GymPage.test.tsx
git commit --no-verify -m "feat(train): read-only set-budget mirrors on MuscleWeekSheet + GymPage pills (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Full-suite gate + docs

**Files:**
- Modify: `docs/features/train.md` (§2 page inventory: two screens → one, 4-step wizard; §4: new setBudget planning layer + thresholds + video source; §10/file-map: new/deleted files)
- Modify: `docs/superpowers/specs/2026-08-01-set-budget-unified-editor-design.md` (two reality notes: `ExerciseRecipeRow` retained for `CustomWorkoutBuilderPage`; `muscleWeek.ts` untouched — `setBudget.ts` traverses days itself)

**Steps:**
- [ ] **Step 1: Full FE gate (this is the one task that runs the whole suite):**

```bash
cd frontend && pnpm build          # timeout 600000, foreground
pnpm test                          # full suite, default mode
VITE_USE_MOCK=true pnpm test      # full suite, mock-forced
```

All three must be green. Fix anything that fails (other suites may reference deleted components or changed copy).
- [ ] **Step 2: Update `docs/features/train.md`** per the file list above (overwrite in place, no changelog; keep `file:line` pointers accurate) and add the two spec notes.
- [ ] **Step 3: Run the doc lint** — `node scripts/lint-docs.mjs` from the repo root → no staleness flag for train.md.
- [ ] **Step 4: Commit**

```bash
git add docs/features/train.md docs/superpowers/specs/2026-08-01-set-budget-unified-editor-design.md
git commit --no-verify -m "docs(train): unified meso editor + set-budget layer; spec reality notes (mezo-7rdg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(The video-transcript research ingest into `docs/research/` is done by the controller session with the `knowledge-base` skill — not part of this task.)

---

## Ship checklist (controller, after all tasks)

Per CLAUDE.md + ship-flow memory: research ingest (knowledge-base skill) → push branch → self-PR → CI green (watch `test-visual`: UI change may need linux golden regen via `gh workflow run update-visual-baselines.yml -r <branch>` + run-approve) → worktree-safe `--no-ff` merge → push main (auto-deploys via deploy.yml) → close mezo-7rdg → bd sync.
