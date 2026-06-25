# Universal Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ~1 s real-mode loading flash (views render their EMPTY state before data lands) with an animated, layout-aware skeleton — without disturbing mock-mode/Playwright parity.

**Architecture:** A universal `Skeleton` primitive (light teal sweep via a new `mezo-shimmer` keyframe) + per-view layout-aware skeleton components, gated by the `isPending` flag that `useDualQuery` already produces but most feature hooks drop. Views early-return their skeleton *before* the empty-state check; mock mode keeps `isPending === false` (synchronous seed) so no skeleton ever renders there.

**Tech Stack:** React 19, Vite, Tailwind v4, TypeScript, TanStack Query, vitest + @testing-library/react + MSW.

## Global Constraints

- All paths under `frontend/`. Build/test from repo root: `pnpm -C frontend test` (**vitest run, REAL mode by default**) AND `VITE_USE_MOCK=true pnpm -C frontend test` (mock) — **BOTH modes must be green** (CLAUDE.md). `pnpm -C frontend build` before the final commit.
- **Pending idiom** (mirror `runningHooks.ts:103` `runningPending: !mock && isPending`): a hook computes `const { data, isPending } = useDualQuery(...)` (or `isPending: xPending` from a `useQuery`) and returns `pending: !mock && isPending`. **Mock mode → always `false`** (synchronous `initialData`), so the skeleton never renders in mock → Playwright/parity intact. `isMockMode()` = `import.meta.env.VITE_USE_MOCK !== 'false'` (default mock), read inside the hook body.
- **View branch** (mirror `RunningView.tsx:127` `RunWeekView`): `if (pending) return <XSkeleton />` placed **BEFORE** the empty-state / `!data` ghost branch.
- **Skeleton primitive** lives at `src/components/ui/Skeleton.tsx`. The shimmer keyframe + `.sk*` rules go in `src/styles/prototype.css`. `GhostState` (`src/components/ui/GhostState.tsx`) stays — it is the EMPTY-state affordance, not loading.
- **Accessibility + test hook:** each per-view skeleton's root is `<div role="status" aria-label="Betöltés…">`; the decorative `.sk` blocks inside are `aria-hidden`. Tests assert the skeleton via `await screen.findByRole('status')` (real, pending) and `expect(screen.queryByRole('status')).toBeNull()` (mock).
- **Test patterns** (verbatim from the codebase):
  - View render: `render(<QueryWrapper><MemoryRouter>{view}</MemoryRouter></QueryWrapper>)` — imports `{ render, screen } from '@testing-library/react'`, `{ QueryWrapper } from '@/test/queryWrapper'`, `{ MemoryRouter } from 'react-router-dom'`.
  - Mode per test: `beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'|'false'))` + `afterEach(() => vi.unstubAllEnvs())`.
  - Force pending (real): the endpoint's fetch must never resolve — MSW `server.use(http.get(`${API_BASE}/api/<x>`, () => new Promise(() => {})))` (imports `{ http } from 'msw'`, `{ server } from '@/test/msw/server'`, `{ API_BASE } from '@/test/msw/handlers'`) OR `vi.mock('@/lib/<x>Api', ...)` with `vi.fn().mockReturnValue(new Promise(() => {}))`. MSW uses `onUnhandledRequest: 'bypass'`, so always register a handler for the endpoint under test.
- **DRY/YAGNI:** build per-view skeletons from the `Skeleton`/`SkeletonText`/`SkeletonCard` primitives — do not hand-roll bars. Do not add skeletons to views outside this plan. Do not touch `useDualQuery` itself (it already returns `isPending`).

---

### Task 1: `Skeleton` primitive + shimmer CSS

**Files:**
- Create: `frontend/src/components/ui/Skeleton.tsx`
- Modify: `frontend/src/styles/prototype.css` (add the `mezo-shimmer` keyframe + `.sk*` rules)
- Test: `frontend/src/components/ui/Skeleton.test.tsx`

**Interfaces:**
- Produces: `Skeleton({ variant?, width?, height?, radius?, className?, style? })`, `SkeletonText({ lines?, widths? })`, `SkeletonCard({ children, className?, style? })`. All decorative (`aria-hidden`). Later tasks compose these inside per-view skeletons whose ROOT carries `role="status"`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ui/Skeleton.test.tsx
import { render } from '@testing-library/react'
import { Skeleton, SkeletonText } from './Skeleton'

describe('Skeleton', () => {
  it('renders a .sk block with the variant class', () => {
    const { container } = render(<Skeleton variant="circle" width={40} height={40} />)
    const el = container.querySelector('.sk')
    expect(el).not.toBeNull()
    expect(el).toHaveClass('sk--circle')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies width/height/radius inline', () => {
    const { container } = render(<Skeleton width="60%" height={12} radius={4} />)
    const el = container.querySelector('.sk') as HTMLElement
    expect(el.style.width).toBe('60%')
    expect(el.style.height).toBe('12px')
    expect(el.style.borderRadius).toBe('4px')
  })

  it('SkeletonText renders the requested number of lines', () => {
    const { container } = render(<SkeletonText lines={4} />)
    expect(container.querySelectorAll('.sk')).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -C frontend test src/components/ui/Skeleton.test.tsx`
Expected: FAIL — `Skeleton`/`SkeletonText` not exported.

- [ ] **Step 3: Write `Skeleton.tsx`**

```tsx
// frontend/src/components/ui/Skeleton.tsx
import type { CSSProperties, ReactNode } from 'react'

export type SkeletonVariant = 'line' | 'block' | 'card' | 'circle' | 'stat'

const VARIANT_DEFAULTS: Record<SkeletonVariant, CSSProperties> = {
  line: { height: 11, borderRadius: 7 },
  block: { borderRadius: 7 },
  card: { borderRadius: 11 },
  circle: { borderRadius: '50%' },
  stat: { width: 30, height: 30, borderRadius: 8 },
}

export function Skeleton({
  variant = 'line', width, height, radius, className, style,
}: {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  radius?: string | number
  className?: string
  style?: CSSProperties
}) {
  const base = VARIANT_DEFAULTS[variant]
  return (
    <div
      aria-hidden="true"
      className={`sk sk--${variant}${className ? ` ${className}` : ''}`}
      style={{
        ...base,
        ...(width !== undefined ? { width } : null),
        ...(height !== undefined ? { height } : null),
        ...(radius !== undefined ? { borderRadius: radius } : null),
        ...style,
      }}
    />
  )
}

/** Vertical stack of line skeletons with tapering widths (animated GhostState shape). */
export function SkeletonText({ lines = 3, widths }: { lines?: number; widths?: string[] }) {
  return (
    <div className="col gap-sm" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="line" width={widths?.[i] ?? `${Math.max(70 - i * 15, 25)}%`} />
      ))}
    </div>
  )
}

/** A surface-1 card container wrapping skeleton children (the card-list building block). */
export function SkeletonCard({ children, className, style }: {
  children: ReactNode; className?: string; style?: CSSProperties
}) {
  return (
    <div className={`card notch-12${className ? ` ${className}` : ''}`} style={{ padding: 14, ...style }}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Add the shimmer CSS**

Append to `frontend/src/styles/prototype.css` (near the other keyframes, e.g. after `pulse-soft`):

```css
/* Loading skeleton — light teal sweep over a surface-2 block. */
.sk {
  position: relative;
  overflow: hidden;
  border-radius: 7px;
  background: var(--surface-2);
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(94, 234, 212, 0.10), transparent);
  animation: mezo-shimmer 1.5s infinite;
}
@keyframes mezo-shimmer { 100% { transform: translateX(100%); } }
.sk--circle { border-radius: 50%; }
@media (prefers-reduced-motion: reduce) { .sk::after { display: none; } }
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -C frontend test src/components/ui/Skeleton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/Skeleton.tsx frontend/src/components/ui/Skeleton.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(ui): universal Skeleton primitive + mezo-shimmer keyframe (mezo-f2z)"
```

---

### Task 2: Fuel slice — surface `isPending` + Kamra/Receptek skeletons

**Files:**
- Modify: `frontend/src/data/pantryHooks.ts` (usePantry), `frontend/src/data/recipeHooks.ts` (useRecipes)
- Modify: `frontend/src/data/pantryHooks.test.tsx`, `frontend/src/data/recipeHooks.test.tsx` (the `Object.keys` assertions)
- Create: `frontend/src/features/fuel/views/KamraSkeleton.tsx`, `frontend/src/features/fuel/views/RecipesSkeleton.tsx`
- Modify: `frontend/src/features/fuel/views/FuelKamraView.tsx`, `frontend/src/features/fuel/views/FuelRecipesView.tsx`
- Test: `frontend/src/features/fuel/views/FuelKamraView.test.tsx`, `frontend/src/features/fuel/views/FuelRecipesView.test.tsx` (add real-pending + mock cases; create the file if absent)

**Interfaces:**
- Consumes: `Skeleton`, `SkeletonText`, `SkeletonCard` (Task 1).
- Produces: `usePantry()` and `useRecipes()` gain a `pending: boolean` key (`!mock && isPending`). `KamraSkeleton`/`RecipesSkeleton` are default-exported components with a `role="status"` root.

- [ ] **Step 1: Update the hook tests first (they assert the exact key set — make them expect `pending`)**

In `frontend/src/data/pantryHooks.test.tsx`, the assertion `expect(Object.keys(result.current).sort()).toEqual([...])` must add `'pending'`:
```tsx
expect(Object.keys(result.current).sort()).toEqual(
  ['categoryMeta', 'imports', 'ingredients', 'pending', 'sources', 'stash', 'suggestions'],
)
```
And add a pending-state test:
```tsx
it('exposes pending=true in real mode while the query is unresolved', () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/pantry`, () => new Promise(() => {}))) // never resolves
  const { Wrapper } = sharedWrapper()
  const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
  expect(result.current.pending).toBe(true)
})
it('exposes pending=false in mock mode', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { Wrapper } = sharedWrapper()
  const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
  expect(result.current.pending).toBe(false)
})
```
Do the same in `recipeHooks.test.tsx` (expected keys become `['categoryMeta', 'pending', 'recipes', 'sources']`, endpoint `${API_BASE}/api/recipes`).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -C frontend test src/data/pantryHooks.test.tsx src/data/recipeHooks.test.tsx`
Expected: FAIL — `pending` not in the return / key-set mismatch.

- [ ] **Step 3: Surface `pending` from both hooks**

`pantryHooks.ts` — change the destructure + add the key:
```tsx
export function usePantry() {
  const mock = isMockMode()
  const { data, isPending } = useDualQuery({
    queryKey: PANTRY_KEY, mockData, realFetch: pantryApi.list, realEmpty: PANTRY_EMPTY, realStaleTime: 0,
  })
  return {
    ingredients: data.ingredients,
    stash: data.stash,
    sources: pantrySources,
    categoryMeta: pantryCategoryMeta,
    imports: mock ? pantryImports : [],
    suggestions: mock ? pantrySuggestions : [],
    pending: !mock && isPending,
  }
}
```
`recipeHooks.ts`:
```tsx
export function useRecipes() {
  const mock = isMockMode()
  const { data: recipes, isPending } = useDualQuery({
    queryKey: RECIPES_KEY, mockData: mockRecipes, realFetch: recipeApi.list, realEmpty: RECIPES_EMPTY, realStaleTime: 0,
  })
  return { recipes, sources: pantrySources, categoryMeta: pantryCategoryMeta, pending: !mock && isPending }
}
```
(`recipeHooks` currently has no `isMockMode()` call — add `const mock = isMockMode()` and the `import { isMockMode } from '@/lib/mode'` if missing.)

- [ ] **Step 4: Run to verify the hook tests pass**

Run: `pnpm -C frontend test src/data/pantryHooks.test.tsx src/data/recipeHooks.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the two per-view skeletons**

`KamraSkeleton.tsx` mirrors the real Kamra layout (page-header → 4-segment switcher card → stats strip → a few cards). Build from the primitives:
```tsx
// frontend/src/features/fuel/views/KamraSkeleton.tsx
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function KamraSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header"><Skeleton width={120} height={16} /><Skeleton width={54} height={11} /></div>
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="60%" height={9} /><Skeleton width="40%" height={14} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <div style={{ padding: '0 24px 12px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} style={{ marginBottom: 10 }}>
            <div className="row gap-md">
              <Skeleton variant="circle" width={34} height={34} />
              <div className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="66%" height={11} /><Skeleton width="38%" height={9} />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
```
`RecipesSkeleton.tsx` mirrors header → segmented typebar → a few RecipeCard placeholders — same approach (header row + a `row` of 5 `Skeleton` chips for the typebar + 3 `SkeletonCard`s each with a title line + a meta line). Root `<div role="status" aria-label="Betöltés…">`.

> **Implementer note:** match the real layout shapes from the views (Kamra: header + switcher + stats + cards; Receptek: header + 5-segment typebar + recipe cards). Reuse the existing layout class names you see in `FuelKamraView`/`FuelRecipesView` (`page-header`, `card`, `notch-*`, `row`, `col`, `gap-*`) so spacing matches. Keep them lean — a few placeholders, not the full list.

- [ ] **Step 6: Branch the views on `pending`**

`FuelKamraView.tsx` — destructure `pending` and early-return before the `isEmpty` ternary:
```tsx
const { ingredients, stash, categoryMeta, pending } = usePantry()
// ... (existing derived values)
if (pending) return <KamraSkeleton />
```
Place the `if (pending)` line right before the `return (` of the main render (after the hooks, so hook order stays stable). Import `KamraSkeleton`. Do the same in `FuelRecipesView.tsx` (`const { recipes, pending } = useRecipes()` → `if (pending) return <RecipesSkeleton />` before the main `return`).

- [ ] **Step 7: Write the view tests**

```tsx
// FuelKamraView.test.tsx (add or create)
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { FuelKamraView } from './FuelKamraView'

const renderView = () =>
  render(<QueryWrapper><MemoryRouter><FuelKamraView /></MemoryRouter></QueryWrapper>)

describe('FuelKamraView (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the pantry query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/pantry`, () => new Promise(() => {})))
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('FuelKamraView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
```
Mirror for `FuelRecipesView.test.tsx` (endpoint `${API_BASE}/api/recipes`, view `FuelRecipesView`).

> **Implementer note:** confirm the real API endpoint paths from `@/test/msw/handlers` / the `*Api` modules (`/api/pantry`, `/api/recipes` are the expected paths but verify). If a view imports children that need more providers, follow the existing `*View.test.tsx` files in the repo for the exact wrapper.

- [ ] **Step 8: Run both view tests + both modes**

Run: `pnpm -C frontend test src/features/fuel` then `VITE_USE_MOCK=true pnpm -C frontend test src/features/fuel`
Expected: PASS in both.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/pantryHooks.ts frontend/src/data/recipeHooks.ts frontend/src/data/pantryHooks.test.tsx frontend/src/data/recipeHooks.test.tsx frontend/src/features/fuel/views/KamraSkeleton.tsx frontend/src/features/fuel/views/RecipesSkeleton.tsx frontend/src/features/fuel/views/FuelKamraView.tsx frontend/src/features/fuel/views/FuelRecipesView.tsx frontend/src/features/fuel/views/FuelKamraView.test.tsx frontend/src/features/fuel/views/FuelRecipesView.test.tsx
git commit -m "feat(ui): loading skeletons for Fuel Kamra + Receptek (mezo-f2z)"
```

---

### Task 3: Train hero views — `useTrain` pending flags + Today/Gym/Sport skeletons

**Files:**
- Modify: `frontend/src/data/trainHooks.ts` (add `sportPending` + `exercisesPending` to the `TrainData` type + return)
- Create: `frontend/src/features/train/views/TrainTodaySkeleton.tsx`, `GymSkeleton.tsx`, `SportSkeleton.tsx` (in `features/train/views/`)
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx`, `GymView.tsx`, `SportView.tsx`
- Test: `TrainTodayView.test.tsx`, `GymView.test.tsx`, `SportView.test.tsx` (real-pending + mock; create if absent)

**Interfaces:**
- Consumes: `Skeleton`/`SkeletonCard` (Task 1).
- Produces: `useTrain()` gains `sportPending: boolean` and `exercisesPending: boolean` (both `!mock && <queryPending>`), declared on the `TrainData` type. `workoutPending` already exists (used by Today + Gym). `exercisesPending` is consumed in Task 4. Three skeleton components with `role="status"` roots.

- [ ] **Step 1: Add `sportPending` + `exercisesPending` to `useTrain`**

In `trainHooks.ts`: destructure `isPending` from the sport + exerciseCatalog/records `useQuery` calls (name them `sportPending`, `exercisesPending`), add both fields to the `TrainData` type declaration, and add to the returned object:
```tsx
sportPending: !mock && sportQueryPending,        // from the sport/sportSessions query
exercisesPending: !mock && (catalogPending || recordsPending),
```

> **Implementer note:** read `trainHooks.ts` to find the exact `useQuery` calls for sport (`['train','sportSessions']` / `sportSchedule`) and exercises (`exerciseCatalog`, `exerciseRecords`); destructure `isPending: <name>Pending` on each (mirroring how `mesoPending`/`todayPending` are already destructured for `workoutPending`). The `TrainData` type is explicitly declared — add both new boolean fields there too or the TS build fails. `workoutPending` is reused as-is for Today + Gym (both branch on `activeMeso` from the meso query).

- [ ] **Step 2: Write the three skeletons**

Each mirrors its view (per the spec §4 / the real layouts) and uses a `role="status"` root. E.g. `TrainTodaySkeleton` = page-header + one hero `SkeletonCard` (eyebrow line + title line + a `row` of 3 chip skeletons + a CTA-height block) + a `col` of 5 `Skeleton` "day rows". `GymSkeleton` = page-header + meta `SkeletonCard` (row of 4 stat skeletons) + 3 day-card placeholders. `SportSkeleton` = page-header + hero `SkeletonCard` (4 stat skeletons) + a 3-chip view-switcher row. Build all from `Skeleton`/`SkeletonCard`, root `<div role="status" aria-label="Betöltés…">`.

> **Implementer note:** the real layouts to mirror (from the views): **Today** — header + gym hero card (eyebrow Week·phase, title, chip row gyakorlat/szet/perc, CTA) + 7 WeeklyDayRows; **Gym** — header + meta card (4 GymStats + phase dots) + per-day GymDayCards; **Sport** — header + hero card (4 SportStats) + 3-button switcher. Keep each lean.

- [ ] **Step 3: Branch the three views**

- `TrainTodayView.tsx`: `const { ..., workoutPending } = useTrain()` (add `workoutPending` to the existing destructure) + `const { ..., runningPending } = useRunning()`; `if (workoutPending || runningPending) return <TrainTodaySkeleton />` before `if (!activeMeso)`.
- `GymView.tsx`: add `workoutPending` to the `useTrain()` destructure; `if (workoutPending) return <GymSkeleton />` before `if (!activeMeso)`.
- `SportView.tsx`: add `sportPending` to the `useTrain()` destructure; `if (sportPending) return <SportSkeleton />` before the first render (before the hero ghost-guard).

- [ ] **Step 4: Write the view tests (real-pending + mock) for all three**

Same shape as Task 2 Step 7. For each: real mode + a never-resolving handler for that view's endpoint → `findByRole('status')`; mock mode → `queryByRole('status')` is null. Use MSW `server.use(...)` for the relevant `/api/train/...` endpoint (workout-today/mesocycles for Today+Gym; sport-sessions for Sport).

> **Implementer note:** verify the exact `/api/train/...` endpoint paths from the handlers/`trainApi`. Today + Gym depend on the mesocycles + workout-today queries (make BOTH never-resolve to force `workoutPending`); Sport depends on the sport query. If a view needs a route param or extra provider, follow the existing train `*View.test.tsx` files.

- [ ] **Step 5: Run all three + both modes**

Run: `pnpm -C frontend test src/features/train/views/TrainTodayView.test.tsx src/features/train/views/GymView.test.tsx src/features/train/views/SportView.test.tsx` then the same with `VITE_USE_MOCK=true`.
Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/trainHooks.ts frontend/src/features/train/views/TrainTodaySkeleton.tsx frontend/src/features/train/views/GymSkeleton.tsx frontend/src/features/train/views/SportSkeleton.tsx frontend/src/features/train/views/TrainTodayView.tsx frontend/src/features/train/views/GymView.tsx frontend/src/features/train/views/SportView.tsx frontend/src/features/train/views/TrainTodayView.test.tsx frontend/src/features/train/views/GymView.test.tsx frontend/src/features/train/views/SportView.test.tsx
git commit -m "feat(ui): loading skeletons for Train Today/Gym/Sport (mezo-f2z)"
```

---

### Task 4: Train list views — Exercises + Mesocycle skeletons

**Files:**
- Create: `frontend/src/features/train/views/ExercisesSkeleton.tsx`, `MesocycleSkeleton.tsx`
- Modify: `frontend/src/features/train/views/ExercisesView.tsx`, `MesocycleLibraryView.tsx`
- Test: `ExercisesView.test.tsx`, `MesocycleLibraryView.test.tsx`

**Interfaces:**
- Consumes: `useTrain()` `exercisesPending` (Task 3) + `workoutPending` (existing, for Mesocycle which branches on `mesocycles` from the meso query); `Skeleton`/`SkeletonCard`.

- [ ] **Step 1: Write the two skeletons**

`ExercisesSkeleton` = page-header + a search-bar `SkeletonCard` + a `row` of muscle-filter chip skeletons + a `col` of 4 RecordRow placeholders (each: rank circle + name line + a small e1RM chip). `MesocycleSkeleton` = page-header + a section eyebrow line + 2 meso-card placeholders. Root `role="status"`.

- [ ] **Step 2: Branch the views**

- `ExercisesView.tsx`: `const { exerciseRecords, exerciseLibrary, exercisesPending } = useTrain()`; `if (exercisesPending) return <ExercisesSkeleton />` before the main `return`.
- `MesocycleLibraryView.tsx`: `const { mesocycles, workoutPending } = useTrain()`; `if (workoutPending) return <MesocycleSkeleton />` before the main `return` (the `mesocycles` list comes from the meso query that drives `workoutPending`).

- [ ] **Step 3: Write the view tests (real-pending + mock)**

Same shape as Task 3 Step 4 — never-resolving handler for the exercises (catalog/records) endpoint and the mesocycles endpoint respectively → `findByRole('status')`; mock → null.

- [ ] **Step 4: Run + both modes**

Run: `pnpm -C frontend test src/features/train/views/ExercisesView.test.tsx src/features/train/views/MesocycleLibraryView.test.tsx` then with `VITE_USE_MOCK=true`.
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/views/ExercisesSkeleton.tsx frontend/src/features/train/views/MesocycleSkeleton.tsx frontend/src/features/train/views/ExercisesView.tsx frontend/src/features/train/views/MesocycleLibraryView.tsx frontend/src/features/train/views/ExercisesView.test.tsx frontend/src/features/train/views/MesocycleLibraryView.test.tsx
git commit -m "feat(ui): loading skeletons for Train Exercises + Mesocycle library (mezo-f2z)"
```

---

### Task 5: Goals — `useGoal` pending + GoalsView skeleton

**Files:**
- Modify: `frontend/src/data/goalHooks.ts` (add `pending` to all THREE return paths)
- Create: `frontend/src/features/me/views/GoalsSkeleton.tsx`
- Modify: `frontend/src/features/me/views/GoalsView.tsx`
- Test: `frontend/src/features/me/views/GoalsView.test.tsx` (or extend) + update any `useGoal` hook test asserting its key set

**Interfaces:**
- Produces: `useGoal()` gains `pending: boolean` (`!mock && isPending` from the active-goal query) on all three return branches (mock branch, no-active-goal branch, final branch). `GoalsSkeleton` with a `role="status"` root.

- [ ] **Step 1: Surface `pending` from `useGoal`**

In `goalHooks.ts`: destructure `isPending` from the active-goal `useQuery` (currently `const { data: goalData } = useQuery(...)` → add `isPending: goalPending`), compute `const mock = isMockMode()`, and add `pending: !mock && goalPending` to ALL THREE return objects (the mock branch ~L94, the no-active-goal branch ~L107, and the final branch). If a `goalHooks.test` asserts the key set, add `'pending'` to its expected array.

> **Implementer note:** read `goalHooks.ts` to confirm the three return sites + the active-goal query. In mock mode `pending` must be `false` (so the `!mock` gate is required). Keep the three return shapes identical (all gain `pending`).

- [ ] **Step 2: Write `GoalsSkeleton`**

Mirrors the Goals layout: page-header + a hero `SkeletonCard` (eyebrow + title + a wide "weight track" block + a `row` of 2 stat skeletons) + a timeline-row placeholder. Root `role="status"`.

- [ ] **Step 3: Branch the view**

`GoalsView.tsx`: `const { goal, goalResponse, timeline, goalId, pending } = useGoal()`; `if (pending) return <GoalsSkeleton />` before `if (!goal || !goalResponse)`.

- [ ] **Step 4: Write the view test (real-pending + mock)**

Same shape — never-resolving handler for the goal endpoint → `findByRole('status')`; mock → null.

> **Implementer note:** verify the goal endpoint path (e.g. `/api/goals/active` or similar) from the handlers/`goalApi`. GoalsView also calls `useGoalActions`, `useWeight`, `useBiometricProfile` — in real-pending those resolve to empty; only the goal query must never-resolve to force the skeleton. Provide MSW handlers (resolving) for the other endpoints so they don't bypass.

- [ ] **Step 5: Run + both modes**

Run: `pnpm -C frontend test src/features/me/views/GoalsView.test.tsx src/data/goalHooks.test.tsx` then with `VITE_USE_MOCK=true`.
Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/goalHooks.ts frontend/src/features/me/views/GoalsSkeleton.tsx frontend/src/features/me/views/GoalsView.tsx frontend/src/features/me/views/GoalsView.test.tsx
git commit -m "feat(ui): loading skeleton for Me Goals (mezo-f2z)"
```

---

### Task 6: Blank-flash views — GoalPlanner + ActiveWorkout generic skeletons

**Files:**
- Modify: `frontend/src/features/me/GoalPlanner.tsx`, `frontend/src/features/train/ActiveWorkoutScreen.tsx`
- Create: `frontend/src/components/ui/ScreenSkeleton.tsx` (a generic full-screen skeleton stack)
- Test: `frontend/src/features/me/GoalPlanner.test.tsx`, `frontend/src/features/train/ActiveWorkoutScreen.test.tsx` (or extend)

**Interfaces:**
- Consumes: `SkeletonText`/`SkeletonCard` (Task 1).
- Produces: `ScreenSkeleton` — a generic `role="status"` page skeleton (header line + a couple of `SkeletonCard`s) for views with no distinctive loadable layout.

- [ ] **Step 1: Write `ScreenSkeleton`**

```tsx
// frontend/src/components/ui/ScreenSkeleton.tsx
import { Skeleton, SkeletonCard, SkeletonText } from './Skeleton'

export function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header"><Skeleton width={120} height={16} /></div>
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard style={{ marginBottom: 10 }}><SkeletonText lines={3} /></SkeletonCard>
        <SkeletonCard><SkeletonText lines={2} /></SkeletonCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace the `return null` loading lines**

- `GoalPlanner.tsx`: `if (isLoading) return <ScreenSkeleton />` (was `return null`); keep the `if (!isComplete) return <Navigate ... />` line after it.
- `ActiveWorkoutScreen.tsx`: `if (workoutPending) return <ScreenSkeleton />` (was `return null`); keep the `if (!workout ...) return <Navigate ... />` after it.

- [ ] **Step 3: Write the tests (real-pending + mock)**

For each: real mode + never-resolving handler for the relevant endpoint (biometric profile for GoalPlanner; mesocycles+workout-today for ActiveWorkout) → `findByRole('status')`; mock → the screen renders its real content/redirect, `queryByRole('status')` null.

> **Implementer note:** GoalPlanner's loading is driven by `useBiometricProfile().isLoading` (not a `!mock` flag) — in mock mode the profile resolves synchronously so `isLoading` is false; verify this holds (if `useBiometricProfile` flashes in mock, gate the skeleton like the others). ActiveWorkout uses `workoutPending` (already `!mock`-gated). Confirm the endpoints from the handlers.

- [ ] **Step 4: Run + both modes + full suite + build**

```bash
pnpm -C frontend test src/features/me/GoalPlanner.test.tsx src/features/train/ActiveWorkoutScreen.test.tsx
VITE_USE_MOCK=true pnpm -C frontend test src/features/me/GoalPlanner.test.tsx src/features/train/ActiveWorkoutScreen.test.tsx
pnpm -C frontend test                          # full suite, REAL mode
VITE_USE_MOCK=true pnpm -C frontend test       # full suite, MOCK mode
pnpm -C frontend build
```
Expected: ALL green (the skeleton additions are inert in mock; the `dualMode.guard.test.ts` invariant is untouched).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/ScreenSkeleton.tsx frontend/src/features/me/GoalPlanner.tsx frontend/src/features/train/ActiveWorkoutScreen.tsx frontend/src/features/me/GoalPlanner.test.tsx frontend/src/features/train/ActiveWorkoutScreen.test.tsx
git commit -m "feat(ui): generic loading skeleton for GoalPlanner + ActiveWorkout (mezo-f2z)"
```

---

## Documentation

After the last task, update the living docs (mandatory per CLAUDE.md): note the `Skeleton` primitive + the loading-skeleton pattern in the relevant `docs/features/` doc (the design-system / platform-frontend doc, wherever `GhostState` is documented), and run `node scripts/lint-docs.mjs`. Fold this into Task 6 or a final docs commit.

## Self-Review notes

- **Spec coverage:** primitive + shimmer + reduced-motion (T1, §3); Fuel layout-aware + isPending surface (T2, §4/§5); Train hero + list (T3/T4); Goals (T5); blank-flash generic (T6, §4); dual-mode correctness via `!mock` gate everywhere (Global Constraints, §6); both-modes tests (every view task, §7). The `Object.keys` test breakage (gotcha) is handled in T2/T5.
- **Type consistency:** `pending` key on usePantry/useRecipes/useGoal; `sportPending`/`exercisesPending` on `useTrain` (declared on `TrainData`); `workoutPending` reused (existing). Skeleton components default/named-exported with `role="status"` roots; tests assert `findByRole('status')`.
- **Known verify-before-coding points (flagged inline):** exact MSW endpoint paths per view; the precise `useQuery` calls in `trainHooks.ts`/`goalHooks.ts` to destructure `isPending` from; whether `useBiometricProfile().isLoading` is already mock-safe; the real layout class names to reuse in each skeleton.
- **YAGNI:** no skeletons outside the 10 listed views; `GhostState` untouched (empty-state); `useDualQuery` untouched (already returns `isPending`); no mock-mode skeletons.
