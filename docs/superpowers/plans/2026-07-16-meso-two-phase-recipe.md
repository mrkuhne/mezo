# Meso Two-Phase Editing (persistent picker + day-tabbed recipe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise picker stays open across picks (✓ flash + counter + Kész), and set/rep recipe tuning moves to a day-tabbed editor — a new 5th wizard step in the planner and the rebuilt Gyakorlatok view in the builder.

**Architecture:** One new shared controlled component (`MesoDayTabsEditor`) consumed by both surfaces; persistence semantics stay in the parents (wizard = in-memory draft saved by `createMesocycle`, builder = per-change `saveDayExercises` full-list PUT). The planner's program generation lifts to page level behind an input-signature guard so step round-trips never wipe edits. Frontend only — zero API-contract/backend change.

**Tech Stack:** React 19 + Vite + Vitest/RTL + MSW (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-meso-builder-two-phase-recipe-design.md` · **Driving bd issue:** `mezo-n46i` · **Branch:** `feat/meso-two-phase-recipe` (already checked out)

## Global Constraints

- Read `docs/references/frontend_conventions.md` before touching any `frontend/src` code; follow it exactly (deep `@/*` imports, no barrels, no relative `../`, colocated tests, components in `features/train/components/`).
- UI copy is Hungarian; code/comments/commit messages are English.
- Every commit subject is conventional and carries the driving id, e.g. `feat(train): … (mezo-n46i)`, and ends with the two trailer lines (Co-Authored-By + Claude-Session) used in this session.
- All frontend commands run from `frontend/`. Focused test runs: `pnpm test <path>`; the full gate (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`) runs in the final task — both modes must be green.
- The bd pre-commit hook auto-stages `.beads/issues.jsonl` into commits — expected, leave it.
- Do NOT stage the untracked QA screenshots/yml in the repo root (`s8-qa-*.jpeg`, `p7-*`).
- New client-generated exercise ids use `` `${item.id}-${crypto.randomUUID()}` `` (never `Date.now()` — double-tap collision).
- Off-day detection is muscle-based everywhere in new code: `muscle === '' || muscle === 'sport'` (builder fixtures carry types like `'Volleyball · meccs'`, so type matching breaks).

---

### Task 1: ExercisePickerSheet — persistent picker (stays open, ✓ flash, counter, Kész)

**Files:**
- Modify: `frontend/src/features/train/sheets/ExercisePickerSheet.tsx`
- Modify: `frontend/src/features/train/sheets/ExercisePickerSheet.test.tsx`
- Modify: `frontend/src/features/train/components/MesoExercises.test.tsx:47-57` (pick no longer auto-closes)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx:135-157` (same)

**Interfaces:**
- Consumes: existing `Sheet` render-fn child (`close` param), `ExerciseLibraryItem`.
- Produces: `ExercisePickerSheetProps` gains optional `dayLabel?: string`. `onPick(item)` may now fire **multiple times per mount**; the sheet only closes via Kész / ✕ / backdrop / Escape. Callers' existing `onClose`/`onPick` wiring keeps working unchanged.

- [ ] **Step 1: Write the failing tests** — append to `ExercisePickerSheet.test.tsx`:

```tsx
test('picking keeps the sheet open, counts adds, and flashes the row', async () => {
  const picks: string[] = []
  render(
    <ExercisePickerSheet onClose={() => {}} onPick={(i) => picks.push(i.name)} dayLabel="Csü · Pull" />,
    { wrapper: QueryWrapper },
  )
  expect(screen.getByText('Csü · Pull', { exact: false })).toBeInTheDocument()
  await userEvent.click(screen.getByText('Hip Thrust'))
  // sheet is still open, the pick registered, counter + flash feedback shown
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
  expect(picks).toEqual(['Hip Thrust'])
  expect(screen.getByText('1 hozzáadva')).toBeInTheDocument()
  expect(screen.getByText('Hozzáadva ✓')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Hip Thrust'))
  expect(picks).toEqual(['Hip Thrust', 'Hip Thrust']) // duplicates allowed
  expect(screen.getByText('2 hozzáadva')).toBeInTheDocument()
})

test('Kész closes the sheet and reflects the added count', async () => {
  const onClose = vi.fn()
  render(<ExercisePickerSheet onClose={onClose} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByRole('button', { name: 'Kész' })).toBeInTheDocument()
  await userEvent.click(screen.getByText('Hip Thrust'))
  await userEvent.click(screen.getByRole('button', { name: 'Kész · 1' }))
  // Sheet dismissal is animated → onClose fires async
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm test src/features/train/sheets/ExercisePickerSheet.test.tsx`
Expected: the 2 new tests FAIL (sheet auto-closes / no counter / no Kész button); the 4 existing tests PASS.

- [ ] **Step 3: Implement** — in `ExercisePickerSheet.tsx`:

3a. Props + state (replace the interface and the component head):

```tsx
interface ExercisePickerSheetProps {
  onClose: () => void
  onPick: (item: ExerciseLibraryItem) => void
  /** Context line for the header, e.g. "Csü · Pull" — which day receives the picks. */
  dayLabel?: string
}

export function ExercisePickerSheet({ onClose, onPick, dayLabel }: ExercisePickerSheetProps) {
  const { exerciseLibrary } = useTrain()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Multi-add: the sheet stays open across picks; count + a short per-row flash
  // give the feedback the auto-close used to provide.
  const [addedCount, setAddedCount] = useState(0)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])
```

(adjust imports: `import { useEffect, useRef, useState } from 'react'`)

3b. Header (inside the render-fn, replace the current header block): eyebrow gets the day context, a live counter appears under the title, and a **Kész** chip joins the ✕:

```tsx
<div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
  <div className="col">
    <span className="eyebrow brand">Gyakorlat választás{dayLabel ? ` · ${dayLabel}` : ''}</span>
    <div id="exercise-picker-title" style={{ /* unchanged title styles */ }}>
      Mit pakolunk be?
    </div>
    {addedCount > 0 && (
      <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', marginTop: 4 }}>
        {addedCount} hozzáadva
      </span>
    )}
  </div>
  <div className="row gap-xs">
    <button className="chip brand notch-4" onClick={close} style={{ fontSize: 9, padding: '6px 10px' }}>
      Kész{addedCount > 0 ? ` · ${addedCount}` : ''}
    </button>
    <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
      <Icon name="x" size={12} />
    </button>
  </div>
</div>
```

3c. Row pick handler (replace the current `onClick` that calls `onPick(e); close()`), border tint + icon swap while flashing:

```tsx
<button
  onClick={() => {
    onPick(e)
    setAddedCount((c) => c + 1)
    setFlashId(e.id)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 900)
  }}
  className="card notch-4 row"
  style={{
    padding: 12, alignItems: 'center', textAlign: 'left', width: '100%',
    borderColor: flashId === e.id ? 'var(--border-brand)' : undefined,
  }}
>
```

and the trailing `+` icon becomes:

```tsx
{flashId === e.id ? (
  <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', flexShrink: 0 }}>
    Hozzáadva ✓
  </span>
) : (
  <Icon name="plus" size={16} color="var(--brand-glow)" />
)}
```

Update the file-head comment block (it currently says "Picking calls onPick(item) and closes").

- [ ] **Step 4: Fix the two dependent test flows** (they assert the old auto-close):

In `MesoExercises.test.tsx` `'picking an exercise appends it to the open day'` (line ~47): after picking, close explicitly —

```tsx
await userEvent.click(within(dialog).getByText('Hip Thrust'))
await userEvent.click(within(dialog).getByRole('button', { name: /^Kész/ }))
await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
```

In `MesocyclePlannerPage.test.tsx` `'custom split: …'` (line ~152): same pattern —

```tsx
await user.click(screen.getByText('Hip Thrust'))
await user.click(screen.getByRole('button', { name: /^Kész/ }))
await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
```

- [ ] **Step 5: Run the touched test files**

Run: `cd frontend && pnpm test src/features/train/sheets/ExercisePickerSheet.test.tsx src/features/train/components/MesoExercises.test.tsx src/features/train/pages/MesocyclePlannerPage.test.tsx`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/sheets/ExercisePickerSheet.tsx frontend/src/features/train/sheets/ExercisePickerSheet.test.tsx frontend/src/features/train/components/MesoExercises.test.tsx frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx
git commit -m "feat(train): exercise picker stays open across picks — flash, counter, Kész (mezo-n46i)"
```

---

### Task 2: New shared component `MesoDayTabsEditor`

**Files:**
- Create: `frontend/src/features/train/components/MesoDayTabsEditor.tsx`
- Create: `frontend/src/features/train/components/MesoDayTabsEditor.test.tsx`

**Interfaces:**
- Consumes: `MesoDay`, `GymExercise` from `@/data/types`; `SortableList` from `@/shared/ui/SortableList`; `MUSCLE_LABELS` from `@/data/train/train`; `Icon`.
- Produces (used by Tasks 3 & 5):

```tsx
export function isOffDay(d: Pick<MesoDay, 'muscle'>): boolean
export function MesoDayTabsEditor(props: {
  days: MesoDay[]                        // PlannerDay is a type alias of MesoDay (logic/planner.ts:84)
  onAddClick: (dayKey: string) => void   // parent owns the picker sheet
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
}): JSX.Element | null
```

Key aria contract (tests + later tasks rely on these): day tab = `aria-pressed` button named `` `${day.day} · ${day.type}` ``; row toggle = `aria-expanded` button named `` `${ex.name} · recept` ``; remove = `` `${ex.name} törlése` ``; steppers keep `` `${label} növelése/csökkentése` `` (e.g. `Working növelése`) and the anchor keeps `Kiinduló súly növelése/csökkentése`; add CTA text `Gyakorlat hozzáadása`.

- [ ] **Step 1: Write the failing test** — `MesoDayTabsEditor.test.tsx` (pure presentational: no QueryWrapper, no env stubbing needed):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { MesoDay } from '@/data/types'
import { MesoDayTabsEditor, isOffDay } from '@/features/train/components/MesoDayTabsEditor'

const ex = (id: string, name: string) => ({
  id, name, muscle: 'chest', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8,
  targetRIR: 0, type: 'compound' as const,
})
const DAYS: MesoDay[] = [
  { day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 2, exercises: [ex('a', 'Bench Press'), ex('b', 'Lateral Raise')] },
  { day: 'Kedd', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [], note: 'Pihenőnap' },
  { day: 'Sze', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true, exercises: [ex('c', 'Row')] },
  { day: 'Csü', type: 'Volleyball · meccs', muscle: 'sport', exerciseCount: 0, exercises: [] },
]
const noop = { onAddClick: vi.fn(), onRemove: vi.fn(), onChange: vi.fn(), onReorder: vi.fn() }

test('isOffDay is muscle-based', () => {
  expect(isOffDay({ muscle: '' })).toBe(true)
  expect(isOffDay({ muscle: 'sport' })).toBe(true)
  expect(isOffDay({ muscle: 'chest' })).toBe(false)
  expect(isOffDay({ muscle: 'custom' })).toBe(false)
})

test('defaults to the current day and switches on tab tap', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  // current day (Sze · Pull) is active → its exercise shows
  expect(screen.getByText('Row')).toBeInTheDocument()
  expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  expect(screen.getByText('Bench Press')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hét · Push' })).toHaveAttribute('aria-pressed', 'true')
})

test('off-day tab shows the rest note, no add CTA', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd · Rest' }))
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gyakorlat hozzáadása/ })).not.toBeInTheDocument()
})

test('row tap expands the recipe panel and steppers fire patches', async () => {
  const onChange = vi.fn()
  render(<MesoDayTabsEditor days={DAYS} {...noop} onChange={onChange} />)
  expect(screen.queryByRole('button', { name: 'Working növelése' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Row · recept' }))
  await userEvent.click(screen.getByRole('button', { name: 'Working növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { workingSets: 4 })
  await userEvent.click(screen.getByRole('button', { name: 'RIR növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { targetRIR: 1 })
  // anchor: from auto, + starts at 20
  await userEvent.click(screen.getByRole('button', { name: 'Kiinduló súly növelése' }))
  expect(onChange).toHaveBeenCalledWith('Sze', 'c', { anchorWeightKg: 20 })
})

test('remove, add and reorder callbacks carry the day key', async () => {
  render(<MesoDayTabsEditor days={DAYS} {...noop} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  await userEvent.click(screen.getByRole('button', { name: 'Bench Press törlése' }))
  expect(noop.onRemove).toHaveBeenCalledWith('Hét', 'a')
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  expect(noop.onAddClick).toHaveBeenCalledWith('Hét')
  await userEvent.click(screen.getByRole('button', { name: 'Bench Press lejjebb' }))
  expect(noop.onReorder).toHaveBeenCalledWith('Hét', ['b', 'a'])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test src/features/train/components/MesoDayTabsEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MesoDayTabsEditor.tsx`** (complete file; `RecipeStepper`/`AnchorStepper` are copied VERBATIM from `ExerciseEditRow.tsx:96-151` as private sub-components — they get deleted from there in Task 3):

```tsx
// ============================================================
// Mezo · MesoDayTabsEditor — day-tabbed weekly exercise + recipe editor,
// shared by the planner wizard's Set & rep step and the builder's
// Gyakorlatok view. Fully controlled: receives the week's days plus
// add/remove/change/reorder callbacks; persistence stays in the parents
// (wizard = in-memory draft, builder = per-change full-list PUT).
// Off-days are detected by muscle ('' = rest, 'sport' = sport day), NOT by
// type — builder fixtures carry types like 'Volleyball · meccs'.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise, MesoDay } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'

export function isOffDay(d: Pick<MesoDay, 'muscle'>): boolean {
  return d.muscle === '' || d.muscle === 'sport'
}

interface MesoDayTabsEditorProps {
  days: MesoDay[]
  onAddClick: (dayKey: string) => void
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
}

export function MesoDayTabsEditor({ days, onAddClick, onRemove, onChange, onReorder }: MesoDayTabsEditorProps) {
  const [activeDay, setActiveDay] = useState<string | null>(
    () => days.find((d) => d.current)?.day ?? days.find((d) => !isOffDay(d))?.day ?? days[0]?.day ?? null,
  )
  const day = days.find((d) => d.day === activeDay) ?? days[0]
  if (!day) return null
  const off = isOffDay(day)
  const setCount = day.exercises.reduce((a, e) => a + e.workingSets, 0)

  return (
    <div className="col gap-md">
      {/* Day tabs */}
      <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {days.map((d) => {
          const active = d.day === day.day
          const dayOff = isOffDay(d)
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={active}
              aria-label={`${d.day} · ${d.type}`}
              onClick={() => setActiveDay(d.day)}
              className="notch-4"
              style={{
                flex: '1 0 auto',
                minWidth: 44,
                padding: '8px 10px',
                background: active ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
                color: active ? 'var(--brand-glow)' : dayOff ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                opacity: dayOff && !active ? 0.6 : 1,
                fontFamily: 'var(--ff-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {d.day}
              {!dayOff && (
                <span style={{ marginLeft: 4, color: active ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}>
                  {d.exercises.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active day header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{day.type}</span>
        {!off && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {day.exercises.length} gyakorlat · {setCount} szet
          </span>
        )}
      </div>

      {off ? (
        <div className="card notch-4 row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
          <Icon name="anchor" size={12} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
            {day.note || 'Pihenőnap'}
          </span>
          {/* Edzéssé alakít — inert visual affordance, parity with the old day cards */}
          <button type="button" className="chip notch-4" style={{ fontSize: 9, padding: '4px 8px' }}>
            <Icon name="plus" size={10} /> Edzéssé alakít
          </button>
        </div>
      ) : (
        <>
          <SortableList
            items={day.exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => onReorder(day.day, ids)}
            renderItem={(e) => (
              <RecipeRow
                ex={e}
                onRemove={() => onRemove(day.day, e.id)}
                onChange={(patch) => onChange(day.day, e.id, patch)}
              />
            )}
          />
          <button
            type="button"
            onClick={() => onAddClick(day.day)}
            className="card notch-4"
            style={{
              padding: 12,
              width: '100%',
              background: 'transparent',
              borderStyle: 'dashed',
              borderColor: 'var(--border-brand)',
              color: 'var(--brand-glow)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </>
      )}
    </div>
  )
}

// One exercise line: the whole row header toggles the inline recipe panel
// (better discoverability than the old tiny settings chip); ✕ removes.
function RecipeRow({ ex, onRemove, onChange }: {
  ex: GymExercise
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card notch-4" style={{ padding: 0, background: 'var(--surface-2)' }}>
      <div className="row gap-sm" style={{ padding: '10px 12px', alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${ex.name} · recept`}
          style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', padding: 0 }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
          <div className="row gap-sm mt-xs flex-wrap" style={{ alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--brand-glow)' }}>
              {ex.warmupSets} bem · {ex.workingSets} work · {ex.repMin}-{ex.repMax} · RIR {ex.targetRIR}
              {ex.anchorWeightKg != null ? ` · ${ex.anchorWeightKg} kg` : ' · auto'}
            </span>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
          </div>
          {ex.warning && (
            <div className="row gap-xs mt-xs" style={{ alignItems: 'center' }}>
              <Icon name="warning" size={10} color="var(--warning)" />
              <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${ex.name} törlése`}
          className="chip notch-4"
          style={{ padding: '5px 7px', flexShrink: 0 }}
        >
          <Icon name="x" size={10} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
          <div className="row gap-sm flex-wrap">
            <RecipeStepper label="Bemelegítő" value={ex.warmupSets} min={0} max={10}
              onChange={(v) => onChange({ warmupSets: v })} />
            <RecipeStepper label="Working" value={ex.workingSets} min={1} max={10}
              onChange={(v) => onChange({ workingSets: v })} />
            <RecipeStepper label="Rep min" value={ex.repMin} min={1} max={ex.repMax}
              onChange={(v) => onChange({ repMin: v })} />
            <RecipeStepper label="Rep max" value={ex.repMax} min={ex.repMin} max={100}
              onChange={(v) => onChange({ repMax: v })} />
            <RecipeStepper label="RIR" value={ex.targetRIR} min={0} max={5}
              onChange={(v) => onChange({ targetRIR: v })} />
            <AnchorStepper value={ex.anchorWeightKg} onChange={(v) => onChange({ anchorWeightKg: v })} />
          </div>
        </div>
      )}
    </div>
  )
}
```

…followed by `RecipeStepper` and `AnchorStepper` copied verbatim (including their comments) from `ExerciseEditRow.tsx:96-151`.

- [ ] **Step 4: Run the test**

Run: `cd frontend && pnpm test src/features/train/components/MesoDayTabsEditor.test.tsx`
Expected: ALL PASS. (Reorder ▲▼ buttons come from `SortableList` — `'Bench Press lejjebb'` works out of the box.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/MesoDayTabsEditor.tsx frontend/src/features/train/components/MesoDayTabsEditor.test.tsx
git commit -m "feat(train): MesoDayTabsEditor — shared day-tabbed exercise + recipe editor (mezo-n46i)"
```

---

### Task 3: Builder Gyakorlatok view on MesoDayTabsEditor; delete the old day cards

**Files:**
- Modify: `frontend/src/features/train/components/MesoExercises.tsx`
- Modify: `frontend/src/features/train/components/MesoExercises.test.tsx`
- Delete: `frontend/src/features/train/components/DayExerciseSection.tsx`
- Delete: `frontend/src/features/train/components/ExerciseEditRow.tsx`
- Delete: `frontend/src/features/train/components/ExerciseEditRow.test.tsx`

**Interfaces:**
- Consumes: `MesoDayTabsEditor` + its aria contract (Task 2); `ExercisePickerSheet` with `dayLabel` (Task 1).
- Produces: `MesoExercises` external API unchanged (`{ meso: Mesocycle }`); `saveDayExercises` PUT semantics unchanged.

- [ ] **Step 1: Update `MesoExercises.test.tsx` to the tabbed UI (failing first).** Keep the file's setup/beforeEach as is. Rewrite/extend the mock-mode tests:

```tsx
test('Gyakorlatok view shows the intro, day tabs and the current day content', async () => {
  await renderExercisesView()
  expect(screen.getByText('Heti gyakorlat-terv')).toBeInTheDocument()
  expect(screen.getByText('Heti szet-volumen')).toBeInTheDocument()
  // current day (Csü · Pull) is the default active tab → its content shows
  expect(screen.getByRole('button', { name: 'Csü · Pull' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})

test('tab switch shows another day', async () => {
  await renderExercisesView()
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
})
```

The existing add-flow test (updated in Task 1) keeps working — the add CTA lives on the active tab. The two real-mode PUT tests stay as they are (their single `current: true` day is the default tab). Add a recipe-PUT test next to them:

```tsx
test('recipe stepper change persists the day list (PUT) in real mode', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { body: { name: string; workingSets: number }[] }[] = []
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([{
      id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
      startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
      split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
      days: [{ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
        exercises: [{ id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2,
          workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' }] }],
    }])),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request }) => {
      puts.push({ body: (await request.json()) as { name: string; workingSets: number }[] })
      return HttpResponse.json({ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, exercises: [] })
    }),
  )
  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · recept' }))
  await userEvent.click(screen.getByRole('button', { name: 'Working növelése' }))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].body[0].workingSets).toBe(5)
})
```

Run: `cd frontend && pnpm test src/features/train/components/MesoExercises.test.tsx`
Expected: new/updated tests FAIL (no tabs yet).

- [ ] **Step 2: Rewrite `MesoExercises.tsx` render.** Keep `seedDays`, `persistDay`, all four handlers (`removeExercise`, `updateExercise`, `addExercise`, `reorderExercises`), the totals, the empty-guard and the volume footer EXACTLY as they are. Changes only:

2a. Drop the `expandedDay` state; keep `pickerDay`.
2b. In `libraryToGymExercise`, change the id line to `` id: `${item.id}-${crypto.randomUUID()}`, ``.
2c. Intro copy:

```tsx
const introBody =
  `**${totalExercises} gyakorlat · ${trainingDays} edzésnap.** ` +
  'Válts napot a tabokkal · tap a gyakorlaton a recepthez · plusz/törlés/drag-rendezés.'
```

2d. Replace the `{/* Per-day sections */}` block with:

```tsx
<MesoDayTabsEditor
  days={days}
  onAddClick={setPickerDay}
  onRemove={removeExercise}
  onChange={updateExercise}
  onReorder={reorderExercises}
/>
```

2e. Pass the day context to the picker:

```tsx
{pickerDay && (
  <ExercisePickerSheet
    dayLabel={(() => {
      const d = days.find((x) => x.day === pickerDay)
      return d ? `${d.day} · ${d.type}` : undefined
    })()}
    onClose={() => setPickerDay(null)}
    onPick={(item) => addExercise(pickerDay, item)}
  />
)}
```

2f. Imports: swap `DayExerciseSection` for `MesoDayTabsEditor`; update the file-head comment (tabs instead of collapsible sections).

- [ ] **Step 3: Delete the orphaned components**

```bash
git rm frontend/src/features/train/components/DayExerciseSection.tsx frontend/src/features/train/components/ExerciseEditRow.tsx frontend/src/features/train/components/ExerciseEditRow.test.tsx
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && pnpm test src/features/train/components/MesoExercises.test.tsx src/features/train/pages/MesocycleBuilderPage.test.tsx && pnpm build`
Expected: ALL PASS; build green (proves nothing else imported the deleted files).

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/train/components
git commit -m "feat(train): builder Gyakorlatok view on day tabs, retire DayExerciseSection/ExerciseEditRow (mezo-n46i)"
```

---

### Task 4: Planner — lift program generation + mutations to page level with a regeneration guard

**Files:**
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx`
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`

**Interfaces:**
- Consumes: existing `generateProgram`, `PlannerDay`.
- Produces (Task 5 relies on these page-level helpers, all defined in `MesocyclePlannerPage`):
  - `addExercise(dayName: string, item: ExerciseLibraryItem): void`
  - `removeExercise(dayName: string, exId: string): void`
  - `reorderExercises(dayName: string, ids: string[]): void`
  - `renameDay(dayName: string, name: string): void`
  - `updateExercise(dayName: string, exId: string, patch: Partial<GymExercise>): void` (new)
  - `Step3Program` prop shape: `{ goal, name, weeks, split, days, program, onAdd, onRemove, onReorder, onRename }` — no more `setProgram`/`weekdays` props.

Still a 4-step wizard after this task — pure lift + guard, observable behavior change: **edits survive a 3→2→3 round-trip**.

- [ ] **Step 1: Write the failing tests** — append to `MesocyclePlannerPage.test.tsx`:

```tsx
test('program edits survive a step round-trip when inputs are unchanged', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> program review
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  // remove the first exercise of the auto-expanded day
  const removeButtons = screen.getAllByRole('button', { name: 'Eltávolítás' })
  const countBefore = removeButtons.length
  await user.click(removeButtons[0])
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(countBefore - 1)
  // back to step 2 (the review step has no Vissza button — use the tappable
  // progress segment) and forward again — NO regeneration, edit preserved
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.queryByText('A Mezo összerakja a programot…')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(countBefore - 1)
})

test('changing an input regenerates the program', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  // swap a weekday: Pén off, Szo on → signature changes
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getByText('A Mezo összerakja a programot…')).toBeInTheDocument()
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
})
```

Run: `cd frontend && pnpm test src/features/train/pages/MesocyclePlannerPage.test.tsx`
Expected: first new test FAILS (today the round-trip regenerates → count restored); second may already pass — keep it as a regression pin.

- [ ] **Step 2: Lift generation into `MesocyclePlannerPage`.** Add imports (`useRef`, `GymExercise` type) and, below the `program` state (line ~61):

```tsx
// Program generation lives at page level behind an input-signature guard so
// step round-trips never wipe user edits; only real input changes regenerate.
const generatedFor = useRef<string | null>(null)
const programSignature = `${goal?.id ?? ''}|${split?.label ?? ''}|${days}|${selectedDays.join(',')}`
useEffect(() => {
  if (step < 3) return
  if (generatedFor.current === programSignature) return
  setProgram(null)
  const timer = setTimeout(() => {
    generatedFor.current = programSignature
    setProgram(generateProgram({ goal, split, days, weekdays: selectedDays, niggle: 'shoulder' }))
  }, 600)
  return () => clearTimeout(timer)
}, [step, programSignature, goal, split, days, selectedDays])
```

- [ ] **Step 3: Lift the mutation helpers.** Move `removeExercise`, `reorderExercises`, `renameDay`, `addExercise` OUT of `Step3Program` (current lines ~759-804) into the page component, unchanged except: they read the page's `setProgram` directly, and `addExercise`'s id line becomes `` id: `${item.id}-${crypto.randomUUID()}` ``. Add the new recipe patcher next to them:

```tsx
// Applies a recipe patch (warmup/working/rep-range/RIR/anchor) to one exercise.
const updateExercise = (dayName: string, exId: string, patch: Partial<GymExercise>) => {
  setProgram((prev) =>
    (prev ?? []).map((d) =>
      d.day === dayName
        ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }
        : d,
    ),
  )
}
```

- [ ] **Step 4: Slim `Step3Program`.** New props: `{ goal, name, weeks, split, days, program, onAdd, onRemove, onReorder, onRename }`. Delete its generation `useEffect` and the lifted helpers; `pickerDay` + `expandedDay` stay local. Replace the old expand-on-generate logic with the expand-once pattern (the old effect died with the generation lift):

```tsx
const firstTrainingDay = (p: PlannerDay[] | null) =>
  p?.find((d) => d.type !== 'Rest' && d.type !== 'Volleyball')?.day ?? null
const [expandedDay, setExpandedDay] = useState<string | null>(() => firstTrainingDay(program))
// Auto-expand exactly once per generation: when program arrives (null → data)
// while mounted. Edits change array identity but never re-open a collapsed day.
const hadProgram = useRef(program !== null)
useEffect(() => {
  if (program && !hadProgram.current) {
    hadProgram.current = true
    setExpandedDay(firstTrainingDay(program))
  }
  if (!program) hadProgram.current = false
}, [program])
```

Call sites inside `Step3Program` swap to the props: `onRemove(d.day → exId)`, `onReorder`, `onRename`, `onAdd(pickerDay, item)`. The page's `<Step3Program …>` invocation passes the lifted helpers. Also pass the picker context now that Task 1 supports it:

```tsx
{pickerDay && (
  <ExercisePickerSheet
    dayLabel={(() => {
      const d = program?.find((x) => x.day === pickerDay)
      return d ? `${d.day} · ${d.type}` : undefined
    })()}
    onClose={() => setPickerDay(null)}
    onPick={(item) => onAdd(pickerDay, item)}
  />
)}
```

- [ ] **Step 5: Run the full planner test file**

Run: `cd frontend && pnpm test src/features/train/pages/MesocyclePlannerPage.test.tsx`
Expected: ALL PASS (existing walkthroughs + both new tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/pages/MesocyclePlannerPage.tsx frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx
git commit -m "refactor(train): lift planner program generation + mutations to page, guard regeneration (mezo-n46i)"
```

---

### Task 5: Planner — 5th step `Set & rep` on MesoDayTabsEditor

**Files:**
- Modify: `frontend/src/features/train/logic/planner.ts:16` (stepLabels)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx`
- Modify: `frontend/src/features/train/components/PlannerExerciseRow.tsx` (drop the inert settings chip)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`
- Modify: `frontend/src/features/train/logic/planner.test.ts` (only if it asserts stepLabels length/content — check first)

**Interfaces:**
- Consumes: `MesoDayTabsEditor` (Task 2), page-level helpers incl. `updateExercise` (Task 4), persistent picker (Task 1).
- Produces: user-visible 5-step wizard; `saveMesocycle` payload unchanged.

- [ ] **Step 1: Write/adjust the failing tests.**

1a. Update the real-mode POST walkthrough (`'the wizard persists the mesocycle…'`): after `await screen.findByText(/A te blokkod/i …)` insert one more `await user.click(screen.getByRole('button', { name: 'Tovább →' }))` before clicking `Hozzáad mint tervezett`. Same one-extra-step insertion anywhere else a test clicks the save buttons.

1b. Append the new step test:

```tsx
test('Set & rep step: day tabs, recipe editing, edits survive the 4↔5 round-trip', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Gyakorlatok
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Set & rep
  expect(screen.getByText('Mennyit és hányszor?')).toBeInTheDocument()
  // save buttons live here now
  expect(screen.getByRole('button', { name: /Hozzáad mint tervezett/i })).toBeInTheDocument()
  // a day tab is preselected; expand the first exercise row and bump Working
  const row = screen.getAllByRole('button', { name: / · recept$/ })[0]
  const summaryBefore = row.textContent
  await user.click(row)
  await user.click(screen.getByRole('button', { name: 'Working növelése' }))
  expect(screen.getAllByRole('button', { name: / · recept$/ })[0].textContent).not.toBe(summaryBefore)
  // round-trip back to Gyakorlatok (via the progress segment — the terminal
  // step has no Vissza button) and forward: no regeneration, edit kept
  await user.click(screen.getByRole('button', { name: '4. lépés · Gyakorlatok' }))
  expect(screen.getByText(/A te blokkod/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getAllByRole('button', { name: / · recept$/ })[0].textContent).not.toBe(summaryBefore)
})
```

Run: `cd frontend && pnpm test src/features/train/pages/MesocyclePlannerPage.test.tsx`
Expected: updated walkthrough + new test FAIL (no 5th step yet).

- [ ] **Step 2: `planner.ts`** — update line 16 (and the file-head comment "4-step"):

```ts
export const stepLabels = ['Cél', 'Hossz + fázisok', 'Split + napok', 'Gyakorlatok', 'Set & rep'] as const
```

- [ ] **Step 3: `MesocyclePlannerPage.tsx` wizard shell:**

```tsx
const STEP_COUNT = 5

const PAGE_TITLES = [
  'Mit szeretnénk építeni?',
  'Mennyi időnk van?',
  'Hogyan osszuk be?',
  'AI program · gyakorlatok',
  'Mennyit és hányszor?',
] as const
```

`canNext` gains the review gate and the terminal index moves:

```tsx
const canNext =
  (step === 0 && !!goal) || (step === 1 && weeks > 0)
  || (step === 2 && selectedDays.length === days) || (step === 3 && !!program) || step === 4
```

Footer blocks: `{step < 3 && …}` → `{step < 4 && …}` (Vissza/Tovább), `{step === 3 && …}` → `{step === 4 && …}` (the two save buttons, unchanged inside). Render the new step:

```tsx
{step === 4 && (
  <Step4Recipe
    program={program}
    onAdd={addExercise}
    onRemove={removeExercise}
    onChange={updateExercise}
    onReorder={reorderExercises}
  />
)}
```

- [ ] **Step 4: Add `Step4Recipe`** (new step component at the bottom of the page file, next to the other steps):

```tsx
// === Step 4 (index): Set & rep tuning on the day-tabbed recipe editor ===
function Step4Recipe({ program, onAdd, onRemove, onChange, onReorder }: {
  program: PlannerDay[] | null
  onAdd: (dayName: string, item: ExerciseLibraryItem) => void
  onRemove: (dayName: string, exId: string) => void
  onChange: (dayName: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayName: string, ids: string[]) => void
}) {
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  if (!program) return null // canNext gates entry on a generated program

  return (
    <div style={{ padding: '8px 24px' }}>
      <div className="card notch-4" style={{ padding: 12, background: 'color-mix(in srgb, var(--brand-glow) 3%, transparent)', marginBottom: 14 }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Set & rep · hangolás</span>
            <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              <SafeMarkdown text="Válts napot a tabokkal, tappolj a gyakorlaton a recepthez. **A Mezo defaultjai csak kiindulópont — bármit átírhatsz.**" />
            </p>
          </div>
        </div>
      </div>

      <MesoDayTabsEditor
        days={program}
        onAddClick={setPickerDay}
        onRemove={onRemove}
        onChange={onChange}
        onReorder={onReorder}
      />

      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={(() => {
            const d = program.find((x) => x.day === pickerDay)
            return d ? `${d.day} · ${d.type}` : undefined
          })()}
          onClose={() => setPickerDay(null)}
          onPick={(item) => onAdd(pickerDay, item)}
        />
      )}
    </div>
  )
}
```

Add the `MesoDayTabsEditor` import; update the page's file-head comment (5 steps + the new step line).

- [ ] **Step 5: `PlannerExerciseRow.tsx`** — delete the inert settings button (lines 33-35, the `aria-label="Beállítások"` chip) and the now-unused part of the header comment ("settings + remove" → "remove").

- [ ] **Step 6: Update `planner.test.ts:27`** — the stepLabels assertion becomes:

```ts
expect(stepLabels).toEqual(['Cél', 'Hossz + fázisok', 'Split + napok', 'Gyakorlatok', 'Set & rep'])
```

- [ ] **Step 7: Run the planner suites**

Run: `cd frontend && pnpm test src/features/train/pages/MesocyclePlannerPage.test.tsx src/features/train/logic/planner.test.ts`
Expected: ALL PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/train/logic/planner.ts frontend/src/features/train/logic/planner.test.ts frontend/src/features/train/pages/MesocyclePlannerPage.tsx frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx frontend/src/features/train/components/PlannerExerciseRow.tsx
git commit -m "feat(train): 5-step planner wizard — Set & rep day-tab step, save moves to step 5 (mezo-n46i)"
```

---

### Task 6: Full gate, visual verification, docs, ship

**Files:**
- Modify: `docs/features/train.md` (§2 planner+builder bullets at lines ~56-57, §8 test list line ~272, §9 line ~303, §10 component list line ~356)
- No code changes expected.

- [ ] **Step 1: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build green, BOTH test modes fully green. Fix anything that surfaces before proceeding.

- [ ] **Step 2: Visual verification in the running app** (project practice: layout changes are verified by eye — memory `mezo-verify-ui-by-running-app`). Start `VITE_USE_MOCK=true pnpm dev` and with the browser MCP walk through: (a) builder → Gyakorlatok: day tabs, tab switch, row expand → 6 stepper tiles, add flow with the picker staying open (✓ flash + counter + Kész); (b) planner: steps 1-4, program review, Tovább → Set & rep tabs, save buttons present. Screenshot the three key screens (picker mid-multi-add, builder tabs, wizard Set & rep) into the scratchpad and show them to the user for a design checkpoint before shipping.

- [ ] **Step 3: Update `docs/features/train.md`** in the same change:
  - §2 planner bullet (~line 56): 4-step → **5-step** wizard (`Cél → Hossz + fázisok → Split + napok → Gyakorlatok → Set & rep`); the review step is exercise selection only (settings chip gone), the new `Set & rep` step hosts `MesoDayTabsEditor` + the save buttons; program generation is page-level behind an input-signature guard (step round-trips keep edits).
  - §2 builder bullet (~line 57): `Gyakorlatok` view is now the day-tabbed `MesoDayTabsEditor` (tabs + whole-row recipe toggle with the six stepper tiles incl. `Kiinduló kg`); `ExerciseEditRow`/`DayExerciseSection` retired; off-day detection is muscle-based (`'' | 'sport'`), fixing the emptied-day-loses-add-CTA quirk.
  - §2 (either bullet): `ExercisePickerSheet` is multi-add — stays open across picks, ✓ flash + counter + `Kész`, `dayLabel` context; new ids use `crypto.randomUUID()`.
  - §8 (~line 272): add `MesoDayTabsEditor.test.tsx`, drop `ExerciseEditRow` from any test mention.
  - §9 (~line 303): planner reorder note — step reference updates ("step 3" → "the Gyakorlatok step"), draft-only semantics unchanged.
  - §10 (~line 356): component list — remove `ExerciseEditRow` + `DayExerciseSection` entries, add `MesoDayTabsEditor` (shared day-tabbed recipe editor, `RecipeStepper`/`AnchorStepper` live here now).

- [ ] **Step 4: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: no errors, no staleness flag for `train.md`.

- [ ] **Step 5: Commit docs + push branch + self-PR (CI gate)**

```bash
git add docs/features/train.md
git commit -m "docs(train): two-phase meso editing — persistent picker + day-tabbed recipe (mezo-n46i)"
git push -u origin feat/meso-two-phase-recipe
gh pr create --title "feat(train): two-phase meso editing — persistent picker + day-tabbed set/rep (mezo-n46i)" --body "$(cat <<'EOF'
Exercise picker stays open across picks (flash ✓ + counter + Kész); recipe tuning moves to the shared day-tabbed MesoDayTabsEditor — new 5th planner step (Set & rep) and the rebuilt builder Gyakorlatok view. Includes the program-regeneration guard (step round-trips keep edits) and crypto.randomUUID exercise ids. Frontend only — no contract/backend change.

- Spec: docs/superpowers/specs/2026-07-16-meso-builder-two-phase-recipe-design.md
- Plan: docs/superpowers/plans/2026-07-16-meso-two-phase-recipe.md
- bd: mezo-n46i

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```

Expected: CI green (full suite incl. backend ITs on clean runner).

- [ ] **Step 6: Merge per house flow** (local `--no-ff`, direct push — NO post-merge rebase, memory `git-noff-merge-flatten-trap`):

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/meso-two-phase-recipe -m "Merge branch 'feat/meso-two-phase-recipe' — persistent picker + day-tabbed set/rep recipe editor (mezo-n46i)"
git push
git branch -d feat/meso-two-phase-recipe && git push origin --delete feat/meso-two-phase-recipe
```

- [ ] **Step 7: Close out**

```bash
bd close mezo-n46i
bd update mezo-n46i --notes "Shipped: persistent multi-add picker (flash/counter/Kész), shared MesoDayTabsEditor, 5-step planner (Set & rep step), builder Gyakorlatok on day tabs, regen guard + crypto.randomUUID ids. Spec: docs/superpowers/specs/2026-07-16-meso-builder-two-phase-recipe-design.md"
bd dolt push
git status   # MUST show "up to date with origin"
```

(`bd close` takes only the id — the reason goes via `--notes`, memory `bd-close-reason-arg`.)
