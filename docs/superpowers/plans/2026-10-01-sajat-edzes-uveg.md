# Saját edzés composer — Üveg port · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-dress `/train/custom/new` and `/train/custom/:id` in the Üveg kit. Each exercise becomes a summary row that expands in place.

**Architecture:**
- `ExerciseRecipeRow` becomes a controlled, collapsible row (`open` / `onToggle`). Its steppers are grouped in pairs.
- `CustomWorkoutBuilderPage` owns `openId`. It renders `MozaikPage` + `PageHead glass` + `PageHero art`, one glass name card, the flat rows and the CTAs, and adds loading and not-found ghosts.
- All styling lives in a new scoped CSS block. The old U5/U11 `.tv-custom` rules are retired.

**Tech Stack:** React + TS, Vitest + Testing Library, Playwright layout specs, `styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-10-01-sajat-edzes-uveg-design.md`
**Approved prototype:** `docs/design_2.0/prototypes/elo/edzes.html#sajat` (artifact https://claude.ai/artifact/DdTK5jJ6XTBuqnPSC3fpcC)
**bd:** `mezo-7ugb5`
**Branch:** `feat/sajat-edzes-uveg`

## Global Constraints

- **No data or behaviour change** beyond the spec: same hooks, the same `toUpsert` body, the same navigation targets, and the back fallback stays `/train/gym`.
- **Keep the stepper aria labels used by tests:**
  - `{name} · Bemelegítő|Working|Rep min|Rep max|RIR|Kiinduló súly csökkentése|növelése`
  - `{name} törlése`
  - `{name} · számít a volumenbe`
- **Visible labels (Hungarian):**
  - Szettek: Bemelegítő · Munka
  - Ismétlés: Tól · Ig
  - Nehézség és súly: Tartalék (RIR) · Kiinduló kg
  - Számít a heti volumenbe
  - Feljebb · Lejjebb · Kivesz
- **Ranges are unchanged:**
  - bem 0–10, work 1–10, repMin 1..repMax, repMax repMin..100, RIR 0–5
  - anchor kg: null = "auto", + from auto = 20, step 2.5, below 2.5 → auto, max 999
- **Icons only via `Icon3D`:** `t-dumbbell`, `t-addex`, `t-tick`, `t-play`, `t-up`, `t-down`, `t-trash`, `t-bandage`. No flat `Icon`, no emoji, no "←/→" text arrows.
- **CSS rules:**
  - Scope everything to `.uvx-cw` (the page root). Do not touch `SortableList` or `.card` globally.
  - No glass inside glass. Only the name card is `.glass`.
  - Only "Indítás ma" is lit. "Kivesz" uses the warn tone.
  - No `--faint` / `--text-disabled` on live copy.
  - Never quote a CSS block marker inside a comment.
- **Gates:**
  - `CI=true` FE tests in both modes: `VITE_USE_MOCK=true` and `=false`.
  - Run the `pnpm build` script.
  - Playwright layout spec.
  - `node scripts/gen-codemap.mjs`
  - `node scripts/lint-docs.mjs` → 0 errors / 0 stale.

---

### Task 1: Collapsible `ExerciseRecipeRow`

**Files:**
- Rewrite: `frontend/src/features/train/components/ExerciseRecipeRow.tsx`
- Create: `frontend/src/features/train/components/ExerciseRecipeRow.test.tsx`

**Interfaces — Produces:**
```ts
export function ExerciseRecipeRow(props: {
  ex: GymExercise
  open: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
  onMoveUp?: () => void      // undefined → button disabled (first row)
  onMoveDown?: () => void    // undefined → button disabled (last row)
}): JSX.Element
export function recipeSummary(ex: GymExercise): string
// → `${workingSets} szett · ${repMin}–${repMax} ism. · RIR ${targetRIR} · ${anchor==null?'auto':fmt(anchor)} kg`
```

- [ ] **Step 1: Write the failing tests** in `ExerciseRecipeRow.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseRecipeRow, recipeSummary } from './ExerciseRecipeRow'

const ex: GymExercise = { id: 'e1', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 0, workingSets: 3,
  repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation', anchorWeightKg: null } as GymExercise

const setup = (over: Partial<Parameters<typeof ExerciseRecipeRow>[0]> = {}) => {
  const p = { ex, open: false, onToggle: vi.fn(), onRemove: vi.fn(), onChange: vi.fn(), ...over }
  render(<ExerciseRecipeRow {...p} />)
  return p
}

test('summary line names sets, reps, RIR and auto kg', () => {
  expect(recipeSummary(ex)).toBe('3 szett · 12–15 ism. · RIR 1 · auto kg')
  expect(recipeSummary({ ...ex, anchorWeightKg: 22.5 })).toBe('3 szett · 12–15 ism. · RIR 1 · 22,5 kg')
})

test('collapsed: head toggles, steppers hidden', () => {
  const p = setup()
  const head = screen.getByRole('button', { name: /Lateral Raise/ })
  expect(head).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Lateral Raise · Working növelése' })).toBeNull()
  fireEvent.click(head)
  expect(p.onToggle).toHaveBeenCalled()
})

test('open: paired steppers clamp and patch', () => {
  const p = setup({ open: true })
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Working növelése' }))
  expect(p.onChange).toHaveBeenCalledWith({ workingSets: 4 })
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Bemelegítő csökkentése' }))
  expect(p.onChange).toHaveBeenLastCalledWith({ warmupSets: 0 }) // clamped at 0
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Kiinduló súly növelése' }))
  expect(p.onChange).toHaveBeenLastCalledWith({ anchorWeightKg: 20 })
  expect(screen.getByText('Szettek')).toBeInTheDocument()
  expect(screen.getByText('Tartalék (RIR)')).toBeInTheDocument()
})

test('open: volume switch, move and remove', () => {
  const onMoveDown = vi.fn()
  const p = setup({ open: true, onMoveDown })
  const sw = screen.getByRole('switch', { name: 'Lateral Raise · számít a volumenbe' })
  expect(sw).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(sw)
  expect(p.onChange).toHaveBeenCalledWith({ countsTowardVolume: false })
  expect(screen.getByRole('button', { name: /Feljebb/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Lejjebb/ }))
  expect(onMoveDown).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise törlése' }))
  expect(p.onRemove).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the test and expect it to fail:**
  `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/train/components/ExerciseRecipeRow.test.tsx`
  Expected: FAIL (`recipeSummary` not exported, no `aria-expanded`).

- [ ] **Step 3: Implement.** Rewrite `ExerciseRecipeRow.tsx`:

```tsx
// ============================================================
// Mezo · ExerciseRecipeRow — one exercise of the saját edzés composer (mezo-ws2x).
// Üveg port (mezo-7ugb5): a flat summary row (muscle chip, name, „3 szett · 8–10 ism. ·
// RIR 1 · auto kg") that expands in place; the parent keeps one row open. The steppers come
// in pairs — Szettek · Ismétlés · Nehézség és súly — plus the volume switch and
// Feljebb / Lejjebb / Kivesz. Stepper aria labels stay name-scoped (`${ex.name} · <field>`).
// ============================================================
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { countsForVolume } from '@/features/train/logic/setBudget'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D } from '@/shared/ui/clay'

const kg = (v: number) => String(v).replace('.', ',')

export function recipeSummary(ex: GymExercise): string {
  const anchor = ex.anchorWeightKg == null ? 'auto' : kg(ex.anchorWeightKg)
  return `${ex.workingSets} szett · ${ex.repMin}–${ex.repMax} ism. · RIR ${ex.targetRIR} · ${anchor} kg`
}

export function ExerciseRecipeRow({ ex, open, onToggle, onRemove, onChange, onMoveUp, onMoveDown }: {
  ex: GymExercise
  open: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const panelId = `cw-rec-${ex.id}`
  const volume = countsForVolume(ex)
  return (
    <div className={open ? 'uvx-cw-row is-open' : 'uvx-cw-row'}>
      <button type="button" className="uvx-cw-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <MuscleChip token={ex.muscle} size={28} />
        <span className="uvx-cw-nm">
          <strong>{ex.name}</strong>
          <small>{MUSCLE_LABELS[ex.muscle] ?? ex.muscle} · {recipeSummary(ex)}</small>
        </span>
        <b className="uvx-cw-chev" aria-hidden="true">›</b>
      </button>
      {ex.warning && (
        <p className="uvx-cw-warn"><Icon3D name="t-bandage" size={18} />{ex.warning}</p>
      )}
      {open && (
        <div className="uvx-cw-panel" id={panelId}>
          <Group label="Szettek">
            <Stepper label="Bemelegítő" aria={`${ex.name} · Bemelegítő`} value={ex.warmupSets} min={0} max={10}
              onChange={(v) => onChange({ warmupSets: v })} />
            <Stepper label="Munka" aria={`${ex.name} · Working`} value={ex.workingSets} min={1} max={10}
              onChange={(v) => onChange({ workingSets: v })} />
          </Group>
          <Group label="Ismétlés">
            <Stepper label="Tól" aria={`${ex.name} · Rep min`} value={ex.repMin} min={1} max={ex.repMax}
              onChange={(v) => onChange({ repMin: v })} />
            <Stepper label="Ig" aria={`${ex.name} · Rep max`} value={ex.repMax} min={ex.repMin} max={100}
              onChange={(v) => onChange({ repMax: v })} />
          </Group>
          <Group label="Nehézség és súly">
            <Stepper label="Tartalék (RIR)" aria={`${ex.name} · RIR`} value={ex.targetRIR} min={0} max={5}
              onChange={(v) => onChange({ targetRIR: v })} />
            <AnchorStepper aria={`${ex.name} · Kiinduló súly`} value={ex.anchorWeightKg}
              onChange={(v) => onChange({ anchorWeightKg: v })} />
          </Group>
          <button type="button" role="switch" aria-checked={volume} aria-label={`${ex.name} · számít a volumenbe`}
            className={volume ? 'uvx-cw-vol is-on' : 'uvx-cw-vol'}
            onClick={() => onChange({ countsTowardVolume: !volume })}>
            <span className="uvx-cw-sw" aria-hidden="true" />Számít a heti volumenbe
          </button>
          <div className="uvx-cw-foot">
            <button type="button" className="uvx-cw-act" disabled={!onMoveUp} onClick={onMoveUp}>
              <Icon3D name="t-up" size={20} />Feljebb</button>
            <button type="button" className="uvx-cw-act" disabled={!onMoveDown} onClick={onMoveDown}>
              <Icon3D name="t-down" size={20} />Lejjebb</button>
            <button type="button" className="uvx-cw-act is-warn" aria-label={`${ex.name} törlése`} onClick={onRemove}>
              <Icon3D name="t-trash" size={20} />Kivesz</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="uvx-cw-grp">
      <span className="uv-eyebrow">{label}</span>
      <div className="uvx-cw-pair">{children}</div>
    </div>
  )
}

// −/value/+ tile; clamps to [min, max] so the parent never receives an out-of-range value.
function Stepper({ label, aria, value, min, max, onChange }: {
  label: string; aria: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="uvx-cw-st">
      <button type="button" aria-label={`${aria} csökkentése`} onClick={() => onChange(clamp(value - 1))}>−</button>
      <span><b data-testid={`${aria} érték`}>{value}</b><small>{label}</small></span>
      <button type="button" aria-label={`${aria} növelése`} onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset. The
// recommendation engine uses it as the first-workout base (SetRecommendationService).
function AnchorStepper({ aria, value, onChange }: {
  aria: string; value: number | null | undefined; onChange: (v: number | null) => void
}) {
  const STEP = 2.5
  const START = 20
  const round = (n: number) => Math.round(n * 100) / 100
  const isAuto = value == null
  const dec = () => {
    if (isAuto) return
    const next = round(value - STEP)
    onChange(next < STEP ? null : next)
  }
  const inc = () => onChange(isAuto ? START : Math.min(999, round(value + STEP)))
  return (
    <div className="uvx-cw-st">
      <button type="button" aria-label={`${aria} csökkentése`} onClick={dec}>−</button>
      <span><b className={isAuto ? 'is-auto' : undefined} data-testid={`${aria} érték`}>{isAuto ? 'auto' : kg(value)}</b><small>Kiinduló kg</small></span>
      <button type="button" aria-label={`${aria} növelése`} onClick={inc}>+</button>
    </div>
  )
}
```

  Note: `MuscleChip` must render a sensible fallback for an unknown token. Check `MuscleChip.tsx`. If it renders nothing for a missing token, that is acceptable.

- [ ] **Step 4: Run the test from Step 2 and expect it to PASS.**
- [ ] **Step 5: Commit:** `feat(train): collapsible paired-stepper ExerciseRecipeRow (mezo-7ugb5)`

---

### Task 2: Port `CustomWorkoutBuilderPage`

**Files:**
- Rewrite: `frontend/src/features/train/pages/CustomWorkoutBuilderPage.tsx`
- Modify: `frontend/src/features/train/pages/CustomWorkoutBuilderPage.test.tsx`

**Interfaces:**
- Consumes `ExerciseRecipeRow` and `recipeSummary` from Task 1.
- Consumes `SortableList` with its `chevrons="focus"` prop. The visible move buttons live in the row panel.

- [ ] **Step 1: Update and add tests** in `CustomWorkoutBuilderPage.test.tsx`.
  - Replace the `stepperValue` helper:
    ```ts
    function stepperValue(exerciseName: string, field: string): string | null {
      return screen.getByTestId(`${exerciseName} · ${field} érték`).textContent
    }
    ```
  - The picker test now expects the freshly added row to be **open** (auto-open). Replace `getAllByText('Work')` with `expect(screen.getAllByText('Munka').length).toBeGreaterThan(0)`.
  - The existing plyo and compound tests need no extra click, because the added row auto-opens.
  - Add these tests:
    ```tsx
    test('edit: rows start collapsed with a summary; tapping one opens it and closes the other', () => {
      renderAt('/train/custom/custom-1')
      const lateral = screen.getByRole('button', { name: /Lateral Raise/ })
      expect(lateral).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(lateral)
      expect(lateral).toHaveAttribute('aria-expanded', 'true')
      const incline = screen.getByRole('button', { name: /Incline DB Press/ })
      fireEvent.click(incline)
      expect(incline).toHaveAttribute('aria-expanded', 'true')
      expect(lateral).toHaveAttribute('aria-expanded', 'false')
    })

    test('the hint names what is missing', () => {
      renderAt('/train/custom/new')
      expect(screen.getByText('Adj nevet az edzésnek.')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Edzés neve'), { target: { value: 'X' } })
      expect(screen.getByText('Adj hozzá legalább egy gyakorlatot.')).toBeInTheDocument()
    })

    test('an unknown id shows not-found instead of an empty new form', () => {
      renderAt('/train/custom/nincs-ilyen')
      expect(screen.getByText(/nem található/)).toBeInTheDocument()
      expect(screen.queryByLabelText('Edzés neve')).toBeNull()
    })

    test('new composer title and the empty lead', () => {
      renderAt('/train/custom/new')
      expect(screen.getByText('Új saját edzés')).toBeInTheDocument()
      expect(screen.getByText(/Még nincs gyakorlat/)).toBeInTheDocument()
    })
    ```
- [ ] **Step 2: Run the tests and expect the new ones to fail:**
  `CI=true VITE_USE_MOCK=true pnpm vitest run src/features/train/pages/CustomWorkoutBuilderPage.test.tsx`
- [ ] **Step 3: Implement the page.** Keep `toUpsert`, `addFromCatalog`, `save` and `startNow` exactly as they are today. Then:

```tsx
// header: keep the existing mezo-ws2x lines; add:
// Üveg port (mezo-7ugb5, living prototype edzes.html#sajat): MozaikPage + glass back pill, a
// coral halo hero with the dumbbell art, ONE glass card for the name (a form is not a poster),
// flat summary rows that expand in place (one open at a time; a fresh pick opens itself), the
// dashed „Gyakorlat hozzáadása", ghost Mentés + lit coral „Indítás ma", plus loading /
// not-found ghosts so an unknown id no longer opens an empty form that saves a duplicate.
import { useState, type CSSProperties } from 'react'
import { MozaikPage, PageHead, PageHero } from '@/shared/ui/mozaik'
import { Icon3D } from '@/shared/ui/clay'
// (drop: Icon import)

const CORAL = { '--c': 'var(--dv-coral)' } as CSSProperties

// inside the component, after existing state:
const { customWorkouts, customPending } = useCustomWorkouts()
const [openId, setOpenId] = useState<string | null>(null)

const addFromCatalog = (item: ExerciseLibraryItem) => {
  const next = { ...libraryToGymExercise(item, null), anchorWeightKg: null }
  setExercises((xs) => [...xs, next])
  setOpenId(next.id)
}
const move = (from: number, to: number) => setExercises((xs) => {
  const ys = [...xs]; const [m] = ys.splice(from, 1); ys.splice(to, 0, m); return ys
})
const hint = !name.trim() ? 'Adj nevet az edzésnek.' : exercises.length === 0 ? 'Adj hozzá legalább egy gyakorlatot.' : null

if (id && !existing) {
  return (
    <MozaikPage tone="coral" className="uvx-cw">
      <PageHead glass onBack={goBack} label="Vissza" />
      <p className="uvx-cw-ghost uv-empty" style={CORAL}>
        {customPending ? 'Betöltés…' : 'Ez a saját edzés nem található — lehet, hogy törölted.'}
      </p>
    </MozaikPage>
  )
}

return (
  <MozaikPage tone="coral" className="uvx-cw">
    <PageHead glass onBack={goBack} label="Vissza" />
    <PageHero art="t-dumbbell" accent="var(--dv-coral)" eyebrow="Saját edzés"
      name={existing ? 'Saját edzés' : 'Új saját edzés'}
      sub="Összerakod, amit ma csinálni akarsz. Elmentheted későbbre, vagy egyből elindíthatod." />

    <label className="uvx-cw-name glass" style={CORAL}>
      <span className="uv-eyebrow">Edzés neve</span>
      <input className="uvs-inp" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="pl. Pihenőnapi felső" maxLength={120} />
    </label>

    <div className="uvx-cw-h">
      <span className="uv-eyebrow">Gyakorlatok</span>
      <em>{exercises.length} gyakorlat · {totalSets} szett</em>
    </div>

    {exercises.length === 0 ? (
      <p className="uvx-cw-empty">Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.</p>
    ) : (
      <div className="uvx-cw-list">
        <SortableList
          chevrons="focus"
          items={exercises.map((e) => ({ ...e, label: e.name }))}
          onReorder={(ids) => setExercises((xs) => ids.flatMap((i) => xs.find((x) => x.id === i) ?? []))}
          renderItem={(e, i) => (
            <ExerciseRecipeRow
              ex={e}
              open={openId === e.id}
              onToggle={() => setOpenId((o) => (o === e.id ? null : e.id))}
              onRemove={() => { setExercises((xs) => xs.filter((x) => x.id !== e.id)); setOpenId(null) }}
              onChange={(patch) => setExercises((xs) => xs.map((x) => (x.id === e.id ? { ...x, ...patch } : x)))}
              onMoveUp={i > 0 ? () => move(i, i - 1) : undefined}
              onMoveDown={i < exercises.length - 1 ? () => move(i, i + 1) : undefined}
            />
          )}
        />
      </div>
    )}

    <button type="button" className="uvx-cw-add uv-empty" onClick={() => setPickerOpen(true)}>
      <Icon3D name="t-addex" size={24} />Gyakorlat hozzáadása
    </button>

    <div className="uvx-cw-cta">
      <button type="button" className="uvx-cw-save" disabled={!valid || savePending} onClick={() => save(() => goBack())}>
        <Icon3D name="t-tick" size={18} />Mentés
      </button>
      <button type="button" className="uvs-primary" style={CORAL} disabled={!valid || savePending} onClick={startNow}>
        <Icon3D name="t-play" size={18} />Indítás ma
      </button>
    </div>
    {hint && <p className="uvx-cw-hint">{hint}</p>}

    {pickerOpen && (
      <ExercisePickerSheet dayLabel="Saját edzés" onPick={addFromCatalog} onClose={() => setPickerOpen(false)} />
    )}
  </MozaikPage>
)
```

  Notes:
  - The `aria-label` on the name input must stay reachable via `getByLabelText('Edzés neve')`. Wrapping the input in a `<label>` together with the eyebrow text does this.
  - Check that `MozaikPage` accepts `tone="coral"`; `MesocycleBuilderPage` uses it.
  - If the "Indítás ma" button's accessible name changes, update any test that queried `Indítás ma →`. Run `grep -rn "Indítás ma" frontend/src` to find them.
- [ ] **Step 4: Run the page and row tests in both modes and expect PASS:**
  - `CI=true VITE_USE_MOCK=true pnpm vitest run src/features/train`
  - `CI=true VITE_USE_MOCK=false pnpm vitest run src/features/train`
- [ ] **Step 5: Commit:** `feat(train): saját edzés composer wears Üveg (mezo-7ugb5)`

---

### Task 3: CSS block + retire `.tv-custom` + 320px layout spec

**Files:**
- Modify: `frontend/src/styles/prototype.css`. Delete `.tv-custom { --c… }` (~:20869), `.tv-custom .card` / `.tv-custom .np-cta` and their comment (~:20931-20941), and `.tv-custom .eyebrow` (~:30067). Append a new block at the end of the file.
- Create: `frontend/tests/layout/train-custom.spec.ts`

- [ ] **Step 1: Write the layout spec**, modelled on `train-skip.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/** Saját edzés composer (mezo-7ugb5) at the narrowest phone: the hero, the glass name card,
 *  an OPEN recipe row (three stepper pairs + switch + foot actions) and the CTA pair stay
 *  horizontally contained. */
test.beforeEach(async ({ page }) => { await seedKalauzSeen(page); await seedSplashSkipped(page) })

const overflow = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector('.screen-content') as HTMLElement
  return sc.scrollWidth - sc.clientWidth
})

for (const path of ['/train/custom/new', '/train/custom/custom-1']) {
  test(`${path} stays contained @ 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    if (path.endsWith('custom-1')) await page.getByRole('button', { name: /Incline DB Press/ }).click()
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('.uvx-cw-st, .uvx-cw-cta button, .uvx-cw-name'))
      .map((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 0.5 && r.left >= -0.5 }))
    expect(boxes.every(Boolean)).toBe(true)
  })
}
```

- [ ] **Step 2: Run it and expect FAIL (unstyled overflow), or a vacuous pass:**
  `cd frontend && pnpm exec playwright test tests/layout/train-custom.spec.ts`. Use the config in `tests/layout/playwright.config.ts`, the same way the existing layout specs run.
- [ ] **Step 3: Write the CSS block.** Append it at the end of `prototype.css`. The values come from the approved prototype's `/* ── SAJÁT EDZÉS` CSS:

```css
/* ── uveg sajat edzes (mezo-7ugb5) ── /train/custom/new, /train/custom/:id ── */
/* The composer is a FORM: only the name card wears glass; the recipe rows are flat hairline
   cells that expand in place; the only lit control is Indítás ma (rule 29). */
.uvx-cw { --c: var(--dv-coral); overflow-x: clip; }
.uvx-cw-name { display: block; margin: 0 16px; padding: 13px 15px; border-radius: 20px; }
.uvx-cw-name .uv-eyebrow { color: color-mix(in srgb, var(--c) 70%, var(--text-primary)); }
.uvx-cw-name .uvs-inp { margin-top: 6px; font-size: 16px; font-weight: 600; }
.uvx-cw-h { display: flex; align-items: baseline; justify-content: space-between; padding: 22px 18px 10px; }
.uvx-cw-h em { font-style: normal; font-size: 11.5px; color: var(--text-muted); }
.uvx-cw-list { padding: 0 16px; }
.uvx-cw-list [data-sortable-row] > :last-child { flex: 1; min-width: 0; }
.uvx-cw-row { border-radius: 18px; background: rgba(245, 239, 230, 0.04); box-shadow: inset 0 0 0 1px var(--divider); min-width: 0; }
.uvx-cw-row.is-open { background: rgba(245, 239, 230, 0.06); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 38%, transparent); }
.uvx-cw-head { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%;
  padding: 11px 13px; text-align: left; background: none; border: 0; color: inherit; cursor: pointer; }
.uvx-cw-nm { min-width: 0; }
.uvx-cw-nm strong { display: block; font-size: 13.5px; font-weight: 600; color: var(--text-primary); overflow-wrap: anywhere; }
.uvx-cw-nm small { display: block; margin-top: 2px; font-size: 11px; color: var(--text-secondary); }
.uvx-cw-chev { font-size: 16px; color: var(--text-secondary); transition: transform 0.25s; }
.uvx-cw-row.is-open .uvx-cw-chev { transform: rotate(90deg); }
.uvx-cw-warn { display: flex; align-items: center; gap: 6px; margin: 0 13px 8px 51px; font-size: 11px; line-height: 1.35; color: #FFB39C; }
.uvx-cw-panel { display: grid; gap: 10px; padding: 2px 13px 13px; }
.uvx-cw-grp .uv-eyebrow { display: block; margin-bottom: 5px; font-size: 9.5px; color: var(--text-secondary); }
.uvx-cw-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.uvx-cw-st { display: grid; grid-template-columns: 28px minmax(0, 1fr) 28px; align-items: center; gap: 2px; padding: 5px;
  border-radius: 13px; background: rgba(245, 239, 230, 0.04); box-shadow: inset 0 0 0 1px var(--divider); }
.uvx-cw-st button { width: 28px; height: 28px; border-radius: 50%; border: 0; display: grid; place-items: center; font-size: 16px;
  color: color-mix(in srgb, var(--c) 75%, #fff); background: rgba(245, 239, 230, 0.06); cursor: pointer; }
.uvx-cw-st span { min-width: 0; text-align: center; }
.uvx-cw-st b { display: block; font-size: 16px; font-weight: 600; line-height: 1.1; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.uvx-cw-st b.is-auto { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.uvx-cw-st small { display: block; font-size: 9.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.uvx-cw-vol { display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: none; font-size: 12.5px; color: var(--text-secondary); cursor: pointer; text-align: left; }
.uvx-cw-sw { position: relative; flex: none; width: 38px; height: 22px; border-radius: 11px; background: rgba(245, 239, 230, 0.1); transition: background 0.2s; }
.uvx-cw-sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #F5EFE6; transition: transform 0.2s; }
.uvx-cw-vol.is-on { color: var(--text-primary); }
.uvx-cw-vol.is-on .uvx-cw-sw { background: var(--c); }
.uvx-cw-vol.is-on .uvx-cw-sw::after { transform: translateX(16px); }
.uvx-cw-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.uvx-cw-act { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 6px; border: 0; border-radius: 999px; font-size: 12px; font-weight: 600;
  color: var(--text-secondary); background: rgba(245, 239, 230, 0.05); box-shadow: inset 0 0 0 1px var(--divider); cursor: pointer; }
.uvx-cw-act:disabled { opacity: 0.35; cursor: default; }
.uvx-cw-act.is-warn { margin-left: auto; color: #FFB39C; background: rgba(255, 126, 92, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 126, 92, 0.35); }
.uvx-cw-empty { margin: 0 16px; padding: 14px; border-radius: 18px; font-size: 12.5px; text-align: center; color: var(--text-secondary);
  background: rgba(245, 239, 230, 0.02); box-shadow: inset 0 0 0 1px var(--divider); }
.uvx-cw-add { display: flex; align-items: center; justify-content: center; gap: 8px; width: calc(100% - 32px); margin: 12px 16px 0; padding: 14px;
  border-radius: 20px; border: 1.5px dashed color-mix(in srgb, var(--c) 45%, transparent); background: rgba(245, 239, 230, 0.02);
  font-size: 14px; font-weight: 600; color: color-mix(in srgb, var(--c) 70%, var(--text-primary)); cursor: pointer; }
.uvx-cw-cta { display: flex; gap: 9px; padding: 16px 16px 4px; }
.uvx-cw-cta > * { flex: 1; justify-content: center; height: 46px; }
.uvx-cw-save { flex: 0.8 !important; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; font-size: 14px; font-weight: 600;
  color: var(--text-secondary); background: rgba(245, 239, 230, 0.05); box-shadow: inset 0 0 0 1px var(--divider); cursor: pointer; }
.uvx-cw-save:disabled { opacity: 0.45; cursor: default; }
.uvx-cw-hint { margin: 6px 16px 0; font-size: 11.5px; text-align: center; color: var(--text-secondary); }
.uvx-cw-ghost { margin: 24px 16px; }
:is(.uvx-cw-head, .uvx-cw-st button, .uvx-cw-vol, .uvx-cw-act, .uvx-cw-add, .uvx-cw-save):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--c) 70%, var(--text-primary)); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .uvx-cw-chev, .uvx-cw-sw, .uvx-cw-sw::after { transition: none; } }
/* ── /uveg sajat edzes ── */
```

  Check the following:
  - The `.uvs-primary` rule (`prototype.css:19314`) applies outside `.uvs-page`. If it is page-scoped, add `.uvx-cw .uvs-primary` with the full colour restatement (rule 36): `color:#191614; background:var(--c); border:0; box-shadow:0 12px 26px -14px color-mix(in srgb,var(--c) 90%,transparent),0 0 18px -4px color-mix(in srgb,var(--c) 60%,transparent)`.
  - `.uvs-inp` is likewise unscoped. If it is not, restate its fill here.
- [ ] **Step 4: Run the guards and the layout spec, and expect PASS:**
  - `CI=true VITE_USE_MOCK=true pnpm vitest run src/shared/ui/mozaik/prototypeCssStructure.test.ts src/shared/ui/sheetGlassGuard.test.ts`
  - The layout spec from Step 2.
  - A screenshot at 320px compared against the prototype `#sajat`.
- [ ] **Step 5: Commit:** `style(train): uveg saját edzés block, retire .tv-custom (mezo-7ugb5)`

---

### Task 4: Docs, prototype sync, full gates

**Files:**
- `docs/features/train.md`:
  - §Saját edzés (~:325): describe the composer's new anatomy and the not-found ghost.
  - Fix the entry-point list: four Mai openers, including the "Gyors indítás · Egyedi edzés" glass tile, plus the Heti footer.
  - Update the U10 note (~:71).
- `frontend/src/features/train/sheets/CustomWorkoutSheet.tsx` header comment: drop the stale "GymPage's header chip".
- `docs/features/README.md`: the train row stays true (no status change).
- `docs/milestones/roadmap.md`: add a dated entry, `2026-10-01 — Saját edzés composer Üveg port (mezo-7ugb5)`.
- `docs/design_2.0/prototypes/elo/README.md`: update the Edzés row's date line.
- `docs/CODEMAP.md`: regenerate.

- [ ] Edit the docs above.
- [ ] Run the gates from `frontend/`:
  - `CI=true VITE_USE_MOCK=true pnpm test`
  - `CI=true VITE_USE_MOCK=false pnpm test`
  - `pnpm build`
- [ ] From the repo root, run `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs`. Expected: 0 errors, 0 stale.
- [ ] `node scripts/check-beads-backup.mjs --fix`
- [ ] Commit: `docs(train): saját edzés Üveg port docs + codemap (mezo-7ugb5)`

### Task 5: Ship

- [ ] `git fetch && git rebase origin/main`, then regenerate CODEMAP and re-run the FE gates if main moved.
- [ ] `git checkout --detach origin/main && git merge --no-ff feat/sajat-edzes-uveg && node scripts/gen-codemap.mjs` (commit if it changed) `&& git push origin HEAD:main`
- [ ] Watch the `deploy` workflow for that commit until it is green. Open `https://46.225.112.172.sslip.io/train/custom/new` in the browser and confirm the new look. No DB check is needed, because no data changes.
- [ ] `bd close mezo-7ugb5`, `bd dolt push`, delete the branch.

## Kész, ha… (acceptance — also in `bd show mezo-7ugb5`)

**What the owner sees**
- [ ] `/train/custom/new` matches prototype `#sajat/uj`: hero, glass name card, empty lead, dashed add, ghost Mentés + lit Indítás ma (disabled) and the hint line.
- [ ] `/train/custom/:id` matches `#sajat`: summary rows (muscle chip, name, summary, warning with the bandage icon), with one row open at a time.
- [ ] Open row: three stepper pairs, the volume switch, Feljebb/Lejjebb/Kivesz. A fresh pick auto-opens.
- [ ] Loading ghost and not-found ghost (`#sajat/betolt`, `#sajat/nincs`).
- [ ] Every icon is a Titanium 3D sprite. No flat glyph remains on the page.
- [ ] 320px contained (layout spec). The reduced-motion branch is respected.

**Parity**
- [ ] All six steppers keep their ranges and aria labels.
- [ ] Volume flag, remove, drag and keyboard reorder.
- [ ] Picker multi-add with the PLYO and compound schemes.
- [ ] Mentés goes back. Indítás ma saves and then opens the session (`?day=`).
- [ ] The disabled rules are unchanged. The back fallback stays `/train/gym`.

**Gates**
- [ ] FE tests in both modes pass.
- [ ] Layout spec passes.
- [ ] `pnpm build` passes.
- [ ] CSS structure + sheet-glass guards pass.
- [ ] gen-codemap is clean.
- [ ] lint-docs reports 0/0.

**Docs**
- [ ] train.md §Saját edzés and its entry points are current.
- [ ] The feature index row is true.
- [ ] Roadmap entry added.
- [ ] Living-prototype README row updated.

**Shipped**
- [ ] Merged to main, and deploy is green for that commit.
- [ ] The new composer is live on production (browser-checked).

**Living prototype**
- [ ] `edzes.html#sajat` matches production and is republished to the fixed URL.
