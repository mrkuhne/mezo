# Rutin Historical Read-Only View + Reusable DatePicker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/me/growth` „Rutin" tab date-navigable (read-only) — default today, step/jump between days — and ship the date picker as a reusable `shared/ui` primitive.

**Architecture:** Two new domain-free `shared/ui` primitives — a themed calendar `DatePicker` (popover) and a `DayNavigator` composite (prev/next + tappable date). `RoutinesTab` lifts a `date` state, feeds the already-date-parameterized `useHabitDay(date)`, and renders today (aggregates + strength, unchanged) vs. a past day (day-scoped summary + status-only rows) vs. empty (ghost). Pure FE — no backend/API-contract change.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, mezo `shared/ui` conventions (domain-free, inline styles + CSS vars).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-27-rutin-historical-view-datepicker-design.md`. bd: `mezo-mpd0`.
- Conventions: read `docs/references/frontend_conventions.md` FIRST. `shared/ui` is **domain-free** — NO `@/data/*` import in DatePicker/DayNavigator. Deep absolute `@/*` imports, no relative `../`, tests colocated.
- Dates: local `YYYY-MM-DD` via `@/shared/lib/dates` (`localDateString`); never UTC-slice.
- Tone (ADR 0010): missed = dim + silent, no red.
- Gate (final): `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Commit each task with the bd id: `... (mezo-mpd0)`. In the worktree, commit with `git -c core.hooksPath=/dev/null commit` (bd pre-commit hook pollutes worktree commits).
- Scope: VIEWING only. Retroactive yesterday-logging is deferred (`mezo-x9c2`) — do NOT add any check/log affordance.

---

## File Structure

- **Create** `frontend/src/shared/ui/DatePicker.tsx` — controlled themed calendar popover primitive.
- **Create** `frontend/src/shared/ui/DatePicker.test.tsx` — colocated test.
- **Create** `frontend/src/shared/ui/DayNavigator.tsx` — prev/next + tappable-date composite over DatePicker.
- **Create** `frontend/src/shared/ui/DayNavigator.test.tsx` — colocated test.
- **Modify** `frontend/src/shared/lib/dates.ts` — add `addDays(iso, n)`.
- **Modify** `frontend/src/features/me/components/RoutinesTab.tsx` — date state + DayNavigator + today/past/empty branches.
- **Modify** `frontend/src/features/me/components/RoutinesTab.test.tsx` (create if absent) — the three branches + nav.
- **Modify** `docs/features/habit.md` — §2 + §10.
- **Modify** `docs/features/_platform-design-system.md` — shared/ui inventory += the two primitives.

---

## Task 1: `addDays` date helper + `DatePicker` primitive

**Files:**
- Modify: `frontend/src/shared/lib/dates.ts` (append `addDays`)
- Create: `frontend/src/shared/ui/DatePicker.tsx`
- Test: `frontend/src/shared/ui/DatePicker.test.tsx`

**Interfaces:**
- Produces: `addDays(iso: string, n: number): string` (in `@/shared/lib/dates`).
- Produces: `DatePicker` component + `DatePickerProps`:
  ```ts
  export interface DatePickerProps {
    value: string                       // YYYY-MM-DD (selected day)
    onChange: (date: string) => void    // fires with the picked ISO date, then closes
    maxDate?: string                    // default localDateString(); days after are disabled
    minDate?: string                    // optional floor
    formatLabel?: (iso: string) => string  // trigger label; default huMonthDayDow
  }
  ```

- [ ] **Step 1: Write the failing test** — `frontend/src/shared/ui/DatePicker.test.tsx`

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from '@/shared/ui/DatePicker'
import { addDays } from '@/shared/lib/dates'

describe('addDays', () => {
  it('steps forward and back across month boundaries (local, DST-safe)', () => {
    expect(addDays('2026-07-20', 1)).toBe('2026-07-21')
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
    expect(addDays('2026-07-20', 7)).toBe('2026-07-27')
  })
})

describe('DatePicker', () => {
  it('shows the formatted trigger label and opens the calendar on click', () => {
    render(<DatePicker value="2026-07-20" onChange={() => {}} maxDate="2026-07-27" />)
    const trigger = screen.getByRole('button', { name: /dátum kiválasztása/i })
    expect(trigger).toHaveTextContent('Júl 20') // huMonthDayDow default
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fires onChange with the ISO date and closes when a day is picked', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    fireEvent.click(screen.getByRole('button', { name: '2026-07-15' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables days after maxDate (no future selection)', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    const future = screen.getByRole('button', { name: '2026-07-28' })
    expect(future).toBeDisabled()
    fireEvent.click(future)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on Escape without firing onChange', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test DatePicker`
Expected: FAIL — `addDays`/`DatePicker` not exported.

- [ ] **Step 3: Add `addDays` to `frontend/src/shared/lib/dates.ts`** (append after `localDateString`)

```ts
/** Local-date arithmetic: `addDays('2026-07-20', -1)` -> '2026-06-30'. DST-safe (local Date + local slice). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localDateString(new Date(y, m - 1, d + n))
}
```

- [ ] **Step 4: Implement `frontend/src/shared/ui/DatePicker.tsx`**

Mirror the popover pattern of `shared/ui/SubNavDropdown.tsx`: `open` state, a `window` `keydown` Escape listener (in a `useEffect` gated on `open`), and a full-screen backdrop button for outside-click-close (SubNavDropdown portals it to `.phone-screen`; a plain fixed-inset `<button className="dp-backdrop">` is sufficient here — no portal needed). Domain-free (no `@/data/*`). Requirements:

- Trigger: `<button type="button" aria-label="Dátum kiválasztása" aria-haspopup="dialog" aria-expanded={open}>{ (formatLabel ?? huMonthDayDow)(value) }</button>`.
- Popover: `<div role="dialog" aria-label="Naptár">` containing a month header (‹ › to change visible month, label via `HU_MONTHS`+year — export nothing new; compute inline from the visible year/month state) and a 7-col grid, **Monday-first**.
- Visible month state initialises from `value`'s year/month. Build the grid with a local helper:
  ```ts
  // Monday-first ISO day cells for the visible month, with leading/trailing nulls to fill weeks.
  function monthCells(year: number, month0: number): (string | null)[] {
    const first = new Date(year, month0, 1)
    const lead = (first.getDay() + 6) % 7            // Mon=0 … Sun=6
    const days = new Date(year, month0 + 1, 0).getDate()
    const cells: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) cells.push(localDateString(new Date(year, month0, d)))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }
  ```
- Each day cell: `<button type="button" aria-label={iso}>` with the day number as text. Disabled when `iso > maxDate` (default `localDateString()`) or (`minDate` && `iso < minDate`). On click: `onChange(iso)` then `setOpen(false)`. Style selected (`iso === value`), today (`iso === localDateString()`), disabled (dim) via inline styles + CSS vars (`--lav` selected fill, `--text-quaternary` dim, `--sage-deep`/border for today ring) — match the approved mockup; do NOT depend on an external CSS file.
- ISO string comparison is safe for `YYYY-MM-DD` (lexicographic == chronological).
- Import `localDateString`, `huMonthDayDow` from `@/shared/lib/dates`; `HU_MONTHS` is module-private in dates.ts — instead format the visible-month header locally with `['Jan',…]` or reuse `huMonthDay` on the 1st. Keep it self-contained.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm test DatePicker`
Expected: PASS (all DatePicker + addDays tests).

- [ ] **Step 6: Commit**

```bash
git -c core.hooksPath=/dev/null commit -am "feat(ui): reusable themed DatePicker calendar primitive + addDays (mezo-mpd0)"
```
(Stage only the 3 files: `git add frontend/src/shared/lib/dates.ts frontend/src/shared/ui/DatePicker.tsx frontend/src/shared/ui/DatePicker.test.tsx` then commit.)

---

## Task 2: `DayNavigator` composite

**Files:**
- Create: `frontend/src/shared/ui/DayNavigator.tsx`
- Test: `frontend/src/shared/ui/DayNavigator.test.tsx`

**Interfaces:**
- Consumes: `DatePicker` (Task 1), `addDays`, `localDateString`, `huMonthDayDow`.
- Produces:
  ```ts
  export interface DayNavigatorProps {
    date: string
    onChange: (date: string) => void
    maxDate?: string   // default localDateString(); `next` disabled at maxDate
    minDate?: string   // `prev` disabled at minDate
  }
  ```

- [ ] **Step 1: Write the failing test** — `frontend/src/shared/ui/DayNavigator.test.tsx`

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DayNavigator } from '@/shared/ui/DayNavigator'

describe('DayNavigator', () => {
  it('steps back and forward one day', () => {
    const onChange = vi.fn()
    render(<DayNavigator date="2026-07-20" maxDate="2026-07-27" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(onChange).toHaveBeenCalledWith('2026-07-19')
    fireEvent.click(screen.getByRole('button', { name: /következő nap/i }))
    expect(onChange).toHaveBeenCalledWith('2026-07-21')
  })

  it('disables "next" at maxDate (no future) and labels today as "Ma"', () => {
    render(<DayNavigator date="2026-07-27" maxDate="2026-07-27" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /következő nap/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /dátum kiválasztása/i })).toHaveTextContent('Ma')
  })

  it('opens the DatePicker calendar from the date label', () => {
    render(<DayNavigator date="2026-07-20" maxDate="2026-07-27" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test DayNavigator`
Expected: FAIL — `DayNavigator` not exported.

- [ ] **Step 3: Implement `frontend/src/shared/ui/DayNavigator.tsx`**

```tsx
import { DatePicker } from '@/shared/ui/DatePicker'
import { addDays, localDateString, huMonthDayDow } from '@/shared/lib/dates'

export interface DayNavigatorProps {
  date: string
  onChange: (date: string) => void
  maxDate?: string
  minDate?: string
}

export function DayNavigator({ date, onChange, maxDate = localDateString(), minDate }: DayNavigatorProps) {
  const canPrev = !minDate || date > minDate
  const canNext = date < maxDate
  const label = (iso: string) => (iso === maxDate ? 'Ma' : huMonthDayDow(iso))
  return (
    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" aria-label="Előző nap" disabled={!canPrev}
        onClick={() => onChange(addDays(date, -1))} style={{ /* arrow chip */ }}>‹</button>
      <DatePicker value={date} onChange={onChange} maxDate={maxDate} minDate={minDate} formatLabel={label} />
      <button type="button" aria-label="Következő nap" disabled={!canNext}
        onClick={() => onChange(addDays(date, 1))} style={{ /* arrow chip */ }}>›</button>
    </div>
  )
}
```
Style the arrow chips inline to match the mockup (bordered square, dim when disabled). No `@/data/*`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test DayNavigator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/ui/DayNavigator.tsx frontend/src/shared/ui/DayNavigator.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(ui): DayNavigator (prev/next + tappable calendar) over DatePicker (mezo-mpd0)"
```

---

## Task 3: `RoutinesTab` date navigation + today/past/empty branches

**Files:**
- Modify: `frontend/src/features/me/components/RoutinesTab.tsx`
- Test: `frontend/src/features/me/components/RoutinesTab.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `DayNavigator` (Task 2); `useHabitDay(date)` / `useHabitSummary()` (`@/data/hooks`); `localDateString`.

- [ ] **Step 1: Write the failing test** — `frontend/src/features/me/components/RoutinesTab.test.tsx`

Mirror existing `features/me` component tests (render under a QueryClient wrapper + mock the two hooks). Mock `@/data/hooks` so `useHabitDay(date)` returns a controllable day and `useHabitSummary()` returns aggregates:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { localDateString } from '@/shared/lib/dates'

const habitsToday = [
  { key: 'wake_on_time', chain: 'MORNING', title: 'Ébredés időben', status: 'done', xp: 5 },
  { key: 'morning_sunlight', chain: 'MORNING', title: 'Reggeli napfény', status: 'pending', xp: 5 },
  { key: 'bed_on_time', chain: 'EVENING', title: 'Időben ágyban', status: 'missed', xp: 5 },
]
const useHabitDay = vi.fn()
const useHabitSummary = vi.fn(() => ({ data: { perfectMorningDays30: 22, perfectEveningDays30: 18,
  habits: [{ key: 'wake_on_time', strengthPct: 71 }] } }))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
}))

beforeEach(() => { useHabitDay.mockReset(); useHabitDay.mockReturnValue({ habits: habitsToday }) })

describe('RoutinesTab', () => {
  it('today: shows the 30-day perfect-day counters (aggregate standing)', () => {
    render(<RoutinesTab />)
    expect(screen.getByText('Tökéletes reggelek')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('navigating to a past day queries that date and shows the day-summary chip (no counters)', () => {
    render(<RoutinesTab />)
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    const yesterday = screen.getByRole('button', { name: /dátum kiválasztása/i })
    expect(useHabitDay).toHaveBeenCalledWith(expect.not.stringMatching(localDateString()))
    expect(screen.queryByText('Tökéletes reggelek')).not.toBeInTheDocument()
    expect(screen.getByText(/Reggel/)).toBeInTheDocument()   // summary chip
    expect(yesterday).toBeInTheDocument()
  })

  it('empty past day: shows the quiet ghost', () => {
    render(<RoutinesTab />)
    useHabitDay.mockReturnValue({ habits: [] })
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.getByText(/Nincs rutinadat erre a napra/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test RoutinesTab`
Expected: FAIL — no DayNavigator / summary chip / ghost yet.

- [ ] **Step 3: Modify `RoutinesTab.tsx`**

- Add imports: `useState` from `react`; `DayNavigator` from `@/shared/ui/DayNavigator`; `GhostState` from `@/shared/ui/GhostState` (verify its prop shape first — grep a usage).
- Body head:
  ```tsx
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const morning = habits.filter(h => h.chain === 'MORNING')
  const evening = habits.filter(h => h.chain === 'EVENING')
  const doneOf = (l: HabitItem[]) => l.filter(h => h.status === 'done').length
  const earnedXp = habits.filter(h => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  ```
- Render `<DayNavigator date={date} maxDate={today} onChange={setDate} />` at the top of the returned `col`.
- **Today branch (`isToday`):** the existing `stat(...)` counters + `chainCard(...)` with the strength bars (current code, unchanged).
- **Past-day branch (`!isToday`):**
  - if `habits.length === 0`: render the ghost (`<GhostState .../>` „Nincs rutinadat erre a napra").
  - else: a summary chip element (`Reggel {doneOf(morning)}/{morning.length} · Este {doneOf(evening)}/{evening.length}` + `+{earnedXp} XP`), then both chains as **status-only** rows — reuse the `hab-srow`/`hab-stop`/`hab-sdot`/`hab-sname` markup but **omit** `hab-spct` + `hab-sbar` (no strength). Extract a small `dayRow(h)` or pass a `showStrength` flag into `chainCard`.
  - Recommended: give `chainCard` a `showStrength: boolean` param; when false, skip the `pct` lookup, the `hab-spct` span, and the `hab-sbar` div. Call `chainCard(..., isToday)`.
- Keep it read-only (no buttons).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test RoutinesTab`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/RoutinesTab.tsx frontend/src/features/me/components/RoutinesTab.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(me): date-navigable read-only history on the Rutin tab (mezo-mpd0)"
```

---

## Task 4: Docs + full gate

**Files:**
- Modify: `docs/features/habit.md`
- Modify: `docs/features/_platform-design-system.md`

- [ ] **Step 1: Update `docs/features/habit.md`**
  - §2 („Rutin" tab paragraph): note it is now **date-navigable** (default today, prev/next + tappable calendar via `DayNavigator`) and read-only, with a **day-focused past view** (per-day summary chip + status-only rows, no strength bars; empty days show a ghost). Retroactive logging deferred (`mezo-x9c2`).
  - §10 (Key files → FE UI): add `shared/ui/DatePicker.tsx` + `shared/ui/DayNavigator.tsx` (reusable date primitives consumed by `RoutinesTab`).
  - Bump frontmatter `updated:` to `2026-07-27`.

- [ ] **Step 2: Update `docs/features/_platform-design-system.md` §1a** — add `DatePicker` + `DayNavigator` to the `shared/ui` inventory (themed calendar popover + day-stepping composite; note they are the reusable replacement path for the ad-hoc `<input type="date">` sites).

- [ ] **Step 3: Run doc lint**

Run: `node scripts/lint-docs.mjs`
Expected: `docs/features/habit.md` shows ✅ (not stale). Pre-existing stale docs unrelated to this change are acceptable.

- [ ] **Step 4: Full gate — both modes + build**

Run:
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build succeeds; both test runs green (existing suite + the new DatePicker/DayNavigator/RoutinesTab tests).

- [ ] **Step 5: Commit**

```bash
git add docs/features/habit.md docs/features/_platform-design-system.md
git -c core.hooksPath=/dev/null commit -m "docs(habit): Rutin tab date-navigable history + shared date primitives (mezo-mpd0)"
```

---

## Self-Review (done at authoring)

- **Spec coverage:** DatePicker (§3a) → T1; DayNavigator (§3b) → T2; RoutinesTab today/past/empty (§4) → T3; data-flow pure-FE (§5) → T3 (mock caveat noted in T3 test via mocked hooks); testing (§6) → T1–T3; docs (§7) → T4; deferred (§8) → out of scope, no task. ✓
- **Placeholder scan:** test code + component signatures concrete; the DatePicker calendar body is specified via requirements + the `monthCells` helper + the SubNavDropdown popover pattern reference (no verbatim 150-line dump, but every behavior + signature is pinned). ✓
- **Type consistency:** `addDays(iso, n)`, `DatePickerProps` (value/onChange/maxDate/minDate/formatLabel), `DayNavigatorProps` (date/onChange/maxDate/minDate) used identically across T1→T2→T3. ✓
