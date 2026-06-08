# Me Domain Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the five deferred Me domain sheets (WeightLog, EditGoal, SleepLog, PersonLog, PersonDetail) and wire their currently-inert triggers, with bubble-up local persistence for the three write sheets.

**Architecture:** Each write sheet bubbles its payload up via an `onSave` callback to a stateful data hook (`useGoals`/`useSleep`/`usePeople`) that holds the domain log in `useState` and exposes a mutator — exactly the existing `useCheckins` pattern. Sheets are built on the `Sheet` primitive (portal + slide-up + drag-to-dismiss) and ported faithfully from the prototype. The payload types (`WeightLogInput`/`SleepLogInput`/`MentionLogInput`) are the durable Phase 2 REST DTOs; only the hook internals change in Phase 2.

**Tech Stack:** React 19, TypeScript, react-router, Vitest + @testing-library/react + userEvent.

**Spec:** `docs/superpowers/specs/2026-06-08-me-domain-sheets-design.md`

**Prototype source (visual contract, port faithfully):**
- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/goals.jsx` — WeightLogSheet 369–435, EditGoalSheet 437–475, FieldRow 477–482
- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/sleep.jsx` — SleepLogSheet 358–492, TimePicker 494–517
- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/people.jsx` — PersonDetailSheet 486–584, DetailStat 586–596, PersonLogSheet 601–708

**Porting conventions (apply to every sheet task):**
- Replace the prototype's raw `<div className="sheet-backdrop"/>` + `<div className="sheet">` wrapper with `<Sheet onClose={onClose} labelledBy="…-title">{(close) => ( … )}</Sheet>`.
- The header X button and the `Mégse`/`Vissza` button call `close` (the render-prop arg), NOT `onClose` directly — this triggers the slide-down animation, then `Sheet` calls `onClose`.
- The primary action button calls a local `save(close)` helper that does `onSave(payload); close()` (see `src/features/today/CheckInSheet.tsx:271` for the precedent).
- `React.useState` → `useState` (import from `react`). `React.Fragment`/`<>…</>` wrappers around backdrop+sheet are dropped (the `Sheet` primitive renders them).
- Keep all inline `style={{…}}` objects and `className` strings verbatim — the design-system CSS (`chip`, `card notch-N`, `cta-primary`, `cta-ghost`, `flex-1`, `label-mono`, `eyebrow`, `h-display size-md`) is shared between prototype and app.
- `Icon` is `import { Icon } from '@/components/ui/Icon'` (same `name`/`size`/`color` API as the prototype).

**Run a single test file:** `npx vitest run <path>` · **Run all:** `npm test` · **Build:** `npm run build` · **Parity:** `npm run parity`

---

## Task 1: Goals bubble-up hook + WeightLogInput

**Files:**
- Modify: `src/data/types.ts` (add `WeightLogInput`)
- Modify: `src/data/hooks.ts:59-61` (`useGoals`)
- Create: `src/data/meHooks.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/data/meHooks.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { useGoals } from './hooks'

test('useGoals.logWeight appends a mapped WeightEntry to the log', () => {
  const { result } = renderHook(() => useGoals())
  const before = result.current.weightLog.length
  act(() => {
    result.current.logWeight({ date: '2026-06-08', weightKg: 71.9, note: 'teszt' })
  })
  expect(result.current.weightLog.length).toBe(before + 1)
  const last = result.current.weightLog[result.current.weightLog.length - 1]
  expect(last).toMatchObject({ date: '2026-06-08', value: 71.9, note: 'teszt' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: FAIL — `result.current.logWeight is not a function`.

- [ ] **Step 3: Add the WeightLogInput type**

In `src/data/types.ts`, directly after `export interface WeightEntry { … }` (line 178), add:

```ts
/** Phase 2 REST DTO — POST /weight-log. `date` is stamped to today by the caller (no UI date picker). */
export interface WeightLogInput { date: string; weightKg: number; note?: string }
```

- [ ] **Step 4: Make useGoals stateful with a mutator**

In `src/data/hooks.ts`: change the import on line 6 from

```ts
import { goal, weightLog, weightTrends, linkedMesocycles } from './goals'
```

to

```ts
import { goal, weightLog as initialWeightLog, weightTrends, linkedMesocycles } from './goals'
```

Add `WeightEntry, WeightLogInput` to the type import on line 16 (the `import type { … } from './types'` line). Replace `useGoals` (lines 59-61) with:

```ts
export function useGoals() {
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(initialWeightLog)
  const logWeight = useCallback((input: WeightLogInput) => {
    setWeightLog(prev => [...prev, { date: input.date, value: input.weightKg, note: input.note }])
  }, [])
  return { goal, weightLog, weightTrends, linkedMesocycles, logWeight }
}
```

(`useState`/`useCallback` are already imported on line 1.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/hooks.ts src/data/meHooks.test.tsx
git commit -m "feat(me): useGoals bubble-up + WeightLogInput contract"
```

---

## Task 2: WeightLogSheet + wire the +Súly trigger

**Files:**
- Create: `src/features/me/WeightLogSheet.tsx`
- Create: `src/features/me/WeightLogSheet.test.tsx`
- Modify: `src/features/me/views/GoalsView.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/me/WeightLogSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeightLogSheet } from './WeightLogSheet'

test('prefills the current weight readout', () => {
  render(<WeightLogSheet onClose={() => {}} onSave={() => {}} currentWeight={72.4} />)
  expect(screen.getByText('72.4')).toBeInTheDocument()
})

test('Save bubbles up a WeightLogInput then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<WeightLogSheet onClose={onClose} onSave={onSave} currentWeight={72.4} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 72.4, note: undefined }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/me/WeightLogSheet.test.tsx`
Expected: FAIL — cannot find module `./WeightLogSheet`.

- [ ] **Step 3: Implement WeightLogSheet**

Create `src/features/me/WeightLogSheet.tsx`. Port the body of `goals.jsx` 369–435 into this skeleton (keep the ±0.1/±0.5 stepper card, the big `val.toFixed(1)` kg readout, the note `<textarea>` capped at 200 chars, and the mezo-observation card verbatim — convert inline styles as-is):

```tsx
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import type { WeightLogInput } from '@/data/types'

export function WeightLogSheet({
  onClose,
  onSave,
  currentWeight,
}: {
  onClose: () => void
  onSave: (input: WeightLogInput) => void
  currentWeight: number
}) {
  const [val, setVal] = useState(currentWeight)
  const [note, setNote] = useState('')

  const save = (close: () => void) => {
    onSave({ date: new Date().toISOString().slice(0, 10), weightKg: val, note: note || undefined })
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="weight-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          {/* Header: eyebrow "Súly log · reggel" + title "Mi a számunk ma?" (id="weight-log-title")
              + X button → close. Port goals.jsx 374-385. */}
          {/* Stepper card: big {val.toFixed(1)} kg readout + four chips
              −0.1 / −0.5 / +0.5 / +0.1 calling setVal(v => +(v ± d).toFixed(1)). Port goals.jsx 387-403. */}
          {/* Note: label-mono "Egy mondat · opcionális" + textarea
              value={note} onChange={e => setNote(e.target.value.slice(0, 200))}. Port goals.jsx 405-417. */}
          {/* Mezo observation card (the val<currentWeight-0.5 / >+0.5 / else ternary). Port goals.jsx 419-428. */}
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

Anchor the title text in a `<div id="weight-log-title">` so `aria-labelledby` resolves (see `SettingsSheet.tsx:26`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/me/WeightLogSheet.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the +Súly trigger in GoalsView**

In `src/features/me/views/GoalsView.tsx`:

Add import after line 15: `import { WeightLogSheet } from '../WeightLogSheet'`

Change line 34 to pull the mutator:
```tsx
const { goal, weightLog, weightTrends, linkedMesocycles, logWeight } = useGoals()
```

Add sheet state after line 35 (`const [period, …]`):
```tsx
const [sheet, setSheet] = useState<'weight' | 'goal' | null>(null)
```

Replace the inert `+Súly` chip (lines 50-53) with a button:
```tsx
<button className="chip" style={{ padding: '8px 10px' }} onClick={() => setSheet('weight')}>
  <Icon name="plus" size={12} /> Súly
</button>
```

Immediately before the closing `</>` (line 270), render the sheet:
```tsx
{sheet === 'weight' && (
  <WeightLogSheet
    onClose={() => setSheet(null)}
    onSave={logWeight}
    currentWeight={goal.currentWeight}
  />
)}
```

- [ ] **Step 6: Verify GoalsView still compiles & tests pass**

Run: `npx vitest run src/features/me/views/GoalsView.test.tsx src/features/me/WeightLogSheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/me/WeightLogSheet.tsx src/features/me/WeightLogSheet.test.tsx src/features/me/views/GoalsView.tsx
git commit -m "feat(me): WeightLogSheet + wire +Súly trigger"
```

---

## Task 3: EditGoalSheet (display-only) + FieldRow + wire hero tap

**Files:**
- Create: `src/features/me/components/FieldRow.tsx`
- Create: `src/features/me/EditGoalSheet.tsx`
- Create: `src/features/me/EditGoalSheet.test.tsx`
- Modify: `src/features/me/views/GoalsView.tsx`

- [ ] **Step 1: Create FieldRow (no test — trivial presentational, covered via EditGoalSheet)**

Create `src/features/me/components/FieldRow.tsx` (port of `goals.jsx` 477–482):

```tsx
export function FieldRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)' }}>
      <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)' }}>{val}</span>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/me/EditGoalSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditGoalSheet } from './EditGoalSheet'
import { goal } from '@/data/goals'

test('shows the goal fields read-only', () => {
  render(<EditGoalSheet onClose={() => {}} goal={goal} />)
  expect(screen.getByText('Cél súly')).toBeInTheDocument()
  expect(screen.getByText(`${goal.targetWeight} kg`)).toBeInTheDocument()
})

test('closes on Mégse', async () => {
  const onClose = vi.fn()
  render(<EditGoalSheet onClose={onClose} goal={goal} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/me/EditGoalSheet.test.tsx`
Expected: FAIL — cannot find module `./EditGoalSheet`.

- [ ] **Step 4: Implement EditGoalSheet (display-only — no onSave)**

Create `src/features/me/EditGoalSheet.tsx`. Port `goals.jsx` 437–475. Both buttons call `close` (there is no mutation — parity-faithful):

```tsx
import { Sheet } from '@/components/ui/Sheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { LabelMono } from '@/components/ui/LabelMono'
import { Icon } from '@/components/ui/Icon'
import { FieldRow } from './components/FieldRow'
import type { Goal } from '@/data/types'

export function EditGoalSheet({ onClose, goal }: { onClose: () => void; goal: Goal }) {
  return (
    <Sheet onClose={onClose} labelledBy="edit-goal-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>Cél szerkesztés</Eyebrow>
              <div id="edit-goal-title"><Display size="md">{goal.title}</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close}><Icon name="x" size={12} /></button>
          </div>

          <div className="col gap-md">
            <FieldRow label="Típus" val="Fogyás · cut" />
            <FieldRow label="Start súly" val={`${goal.startWeight} kg`} />
            <FieldRow label="Cél súly" val={`${goal.targetWeight} kg`} />
            <FieldRow label="Heti tempó" val={`${goal.rateTarget.value} ${goal.rateTarget.unit}`} />
            <FieldRow label="Határidő" val={goal.targetDate} />

            <div className="col gap-sm mt-md">
              <LabelMono>Identity frame</LabelMono>
              <div className="card notch-4" style={{ padding: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{goal.identityFrame}"
                </p>
              </div>
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={close}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/me/EditGoalSheet.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the goal hero tap in GoalsView**

In `src/features/me/views/GoalsView.tsx`:

Add import after the WeightLogSheet import: `import { EditGoalSheet } from '../EditGoalSheet'`

On the goal hero card `<div className="card notch-12"` (line 59), add an `onClick` and pointer cursor so a tap opens the edit sheet (the settings icon at line 91 already signals this affordance):
```tsx
<div
  className="card notch-12"
  onClick={() => setSheet('goal')}
  style={{
    padding: 20,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(94, 234, 212, 0.06) 0%, var(--surface-1) 100%)',
    borderColor: 'var(--border-brand)',
    position: 'relative',
    overflow: 'hidden',
  }}
>
```

Add the render block next to the WeightLogSheet block (before `</>`):
```tsx
{sheet === 'goal' && <EditGoalSheet onClose={() => setSheet(null)} goal={goal} />}
```

> Note: making the hero a clickable `div` (not a `<button>`) keeps the prototype's visual structure; full keyboard a11y for the hero is tracked separately in `mezo-1cs`/`mezo-d6x`. The `+Súly` button remains a fully accessible path to logging.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/features/me/EditGoalSheet.test.tsx src/features/me/views/GoalsView.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/me/components/FieldRow.tsx src/features/me/EditGoalSheet.tsx src/features/me/EditGoalSheet.test.tsx src/features/me/views/GoalsView.tsx
git commit -m "feat(me): EditGoalSheet (display-only) + wire goal hero tap"
```

---

## Task 4: Sleep bubble-up hook + SleepLogInput

**Files:**
- Modify: `src/data/types.ts` (add `SleepLogInput`)
- Modify: `src/data/hooks.ts:63-65` (`useSleep`)
- Modify: `src/data/meHooks.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/data/meHooks.test.tsx`:

```tsx
import { useSleep } from './hooks'

test('useSleep.logSleep appends a mapped SleepEntry', () => {
  const { result } = renderHook(() => useSleep())
  const before = result.current.sleepLog.length
  act(() => {
    result.current.logSleep({
      date: '2026-06-08', bedtime: '23:00', wakeup: '06:30',
      durationH: 7.5, quality: 8, awakenings: 1, note: 'jó',
    })
  })
  expect(result.current.sleepLog.length).toBe(before + 1)
  expect(result.current.lastNight).toMatchObject({ duration: 7.5, quality: 8, awakenings: 1, notes: 'jó' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: FAIL — `result.current.logSleep is not a function`.

- [ ] **Step 3: Add the SleepLogInput type**

In `src/data/types.ts`, directly after `export interface SleepEntry { … }` (ends line 205), add:

```ts
/** Phase 2 REST DTO — POST /sleep-log. `durationH` is computed in the sheet from bedtime+wakeup. */
export interface SleepLogInput {
  date: string; bedtime: string; wakeup: string
  durationH: number; quality: number; awakenings: number; note?: string
}
```

- [ ] **Step 4: Make useSleep stateful with a mutator**

In `src/data/hooks.ts`: change the import on line 7 from

```ts
import { sleepLog, sleepTrends } from './sleep'
```

to

```ts
import { sleepLog as initialSleepLog, sleepTrends } from './sleep'
```

Add `SleepEntry, SleepLogInput` to the `import type … from './types'` line (16). Replace `useSleep` (lines 63-65) with:

```ts
export function useSleep() {
  const [sleepLog, setSleepLog] = useState<SleepEntry[]>(initialSleepLog)
  const logSleep = useCallback((input: SleepLogInput) => {
    setSleepLog(prev => [...prev, {
      date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
      duration: input.durationH, quality: input.quality, awakenings: input.awakenings,
      mealToSleep: 0, notes: input.note ?? null,
    }])
  }, [])
  return { sleepLog, sleepTrends, lastNight: sleepLog[sleepLog.length - 1], logSleep }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: PASS (Goals + Sleep tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/hooks.ts src/data/meHooks.test.tsx
git commit -m "feat(me): useSleep bubble-up + SleepLogInput contract"
```

---

## Task 5: TimePicker component

**Files:**
- Create: `src/features/me/components/TimePicker.tsx`
- Create: `src/features/me/components/TimePicker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/me/components/TimePicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimePicker } from './TimePicker'

test('changing the hour select emits HH:MM', async () => {
  const onChange = vi.fn()
  render(<TimePicker label="Lefekvés" val="23:00" onChange={onChange} hours={[22, 23, 0, 1]} />)
  await userEvent.selectOptions(screen.getByLabelText('Lefekvés óra'), '22')
  expect(onChange).toHaveBeenCalledWith('22:00')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/me/components/TimePicker.test.tsx`
Expected: FAIL — cannot find module `./TimePicker`.

- [ ] **Step 3: Implement TimePicker**

Create `src/features/me/components/TimePicker.tsx` (port of `sleep.jsx` 494–517; minute select is fixed `:00`/`:30` like the prototype, with `aria-label`s added for testability):

```tsx
const SELECT_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  padding: '6px 8px',
  fontFamily: 'var(--ff-display)',
  fontSize: 16,
} as const

export function TimePicker({
  label,
  val,
  onChange,
  hours,
}: {
  label: string
  val: string
  onChange: (next: string) => void
  hours: number[]
}) {
  const [h, m] = val.split(':')
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
      <div className="row gap-xs mt-sm">
        <select
          aria-label={`${label} óra`}
          value={parseInt(h)}
          onChange={e => onChange(String(e.target.value).padStart(2, '0') + ':' + m)}
          style={SELECT_STYLE}
        >
          {hours.map(hh => <option key={hh} value={hh}>{String(hh).padStart(2, '0')}</option>)}
        </select>
        <span style={{ color: 'var(--text-tertiary)', lineHeight: '32px' }}>:</span>
        <select
          aria-label={`${label} perc`}
          value={parseInt(m)}
          onChange={e => onChange(h + ':' + String(e.target.value).padStart(2, '0'))}
          style={SELECT_STYLE}
        >
          {[0, 30].map(mm => <option key={mm} value={mm}>{String(mm).padStart(2, '0')}</option>)}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/me/components/TimePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/me/components/TimePicker.tsx src/features/me/components/TimePicker.test.tsx
git commit -m "feat(me): TimePicker component"
```

---

## Task 6: SleepLogSheet + wire the +Log trigger

**Files:**
- Create: `src/features/me/SleepLogSheet.tsx`
- Create: `src/features/me/SleepLogSheet.test.tsx`
- Modify: `src/features/me/views/SleepView.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/me/SleepLogSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SleepLogSheet } from './SleepLogSheet'

test('Save bubbles up a SleepLogInput with computed duration then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<SleepLogSheet onClose={onClose} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ bedtime: '23:00', wakeup: '06:30', durationH: 7.5, quality: 7, awakenings: 1 }),
  )
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/me/SleepLogSheet.test.tsx`
Expected: FAIL — cannot find module `./SleepLogSheet`.

- [ ] **Step 3: Implement SleepLogSheet**

Create `src/features/me/SleepLogSheet.tsx`. Port the body of `sleep.jsx` 358–492 into this skeleton — keep the duration display card with the two `TimePicker`s, the 1–10 quality grid, the awakenings `0/1/2/3/4+` chip row, the note textarea (≤200), and the mezo-observation ternary verbatim. The duration is computed exactly as the prototype's `computeDuration`:

```tsx
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { TimePicker } from './components/TimePicker'
import type { SleepLogInput } from '@/data/types'

function computeDuration(bedtime: string, wakeup: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeup.split(':').map(Number)
  let bedMins = bh * 60 + bm
  let wakeMins = wh * 60 + wm
  if (wakeMins < bedMins) wakeMins += 24 * 60
  return +((wakeMins - bedMins) / 60).toFixed(1)
}

export function SleepLogSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: SleepLogInput) => void
}) {
  const [bedtime, setBedtime] = useState('23:00')
  const [wakeup, setWakeup] = useState('06:30')
  const [quality, setQuality] = useState(7)
  const [awakenings, setAwakenings] = useState(1)
  const [note, setNote] = useState('')
  const duration = computeDuration(bedtime, wakeup)

  const save = (close: () => void) => {
    onSave({
      date: new Date().toISOString().slice(0, 10),
      bedtime, wakeup, durationH: duration, quality, awakenings,
      note: note || undefined,
    })
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="sleep-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          {/* Header: eyebrow (var(--cat-preference)) "Reggeli sleep log" + title "Hogyan aludtunk?"
              (id="sleep-log-title") + X → close. Port sleep.jsx 379-390. */}
          {/* Duration card: big {duration} h readout + two TimePickers
              <TimePicker label="Lefekvés" val={bedtime} onChange={setBedtime} hours={[22,23,0,1]} />
              <TimePicker label="Ébredés" val={wakeup} onChange={setWakeup} hours={[5,6,7,8]} />. Port sleep.jsx 392-406. */}
          {/* Quality: 10-button grid, setQuality(n). Port sleep.jsx 408-431. */}
          {/* Awakenings: [0,1,2,3,'4+'] chips, setAwakenings(n==='4+'?4:n). Port sleep.jsx 433-455. */}
          {/* Note textarea: onChange={e => setNote(e.target.value.slice(0, 200))}. Port sleep.jsx 457-469. */}
          {/* Mezo observation ternary (duration<7 / quality<=5 / >=7.5&&>=8 / else). Port sleep.jsx 471-484. */}
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/me/SleepLogSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the +Log trigger in SleepView**

In `src/features/me/views/SleepView.tsx`:

Add import (next to the other component imports): `import { SleepLogSheet } from '../SleepLogSheet'`

Pull the mutator from the hook (line 28):
```tsx
const { sleepLog, sleepTrends, lastNight, logSleep } = useSleep()
```

Add state after the `period` state (line 29):
```tsx
const [logOpen, setLogOpen] = useState(false)
```

Replace the inert `+Log` chip (the `<span className="chip" …>` at lines 44-46) with:
```tsx
<button className="chip" style={{ padding: '8px 10px' }} onClick={() => setLogOpen(true)}>
  <Icon name="plus" size={12} /> Log
</button>
```

Render the sheet just before the view's closing `</>`:
```tsx
{logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/features/me/SleepLogSheet.test.tsx src/features/me/views/SleepView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/me/SleepLogSheet.tsx src/features/me/SleepLogSheet.test.tsx src/features/me/views/SleepView.tsx
git commit -m "feat(me): SleepLogSheet + wire +Log trigger"
```

---

## Task 7: People bubble-up hook + MentionLogInput

**Files:**
- Modify: `src/data/types.ts` (add `MentionLogInput`)
- Modify: `src/data/hooks.ts:67-69` (`usePeople`)
- Modify: `src/data/meHooks.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/data/meHooks.test.tsx`:

```tsx
import { usePeople } from './hooks'
import { people } from './people'

test('usePeople.logMention prepends an enriched Mention', () => {
  const { result } = renderHook(() => usePeople())
  const before = result.current.mentions.length
  const target = people[0]
  act(() => {
    result.current.logMention({ personId: target.id, tone: 'positive', text: 'jó beszélgetés' })
  })
  expect(result.current.mentions.length).toBe(before + 1)
  expect(result.current.mentions[0]).toMatchObject({
    person_id: target.id, personName: target.name, tone: 'positive',
    excerpt: 'jó beszélgetés', source: 'chip',
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: FAIL — `result.current.logMention is not a function`.

- [ ] **Step 3: Add the MentionLogInput type**

In `src/data/types.ts`, directly after `export interface Mention { … }` (ends line 266), add:

```ts
/** Phase 2 REST DTO — POST /mentions. Hook enriches id/ts/labels/personName/source server-side in Phase 2. */
export interface MentionLogInput {
  personId: string
  tone: Affect
  text?: string
}
```

- [ ] **Step 4: Make usePeople stateful with a mutator**

In `src/data/hooks.ts`: change the import on line 8 from

```ts
import { peopleSummary, people, mentions, relationPatterns } from './people'
```

to

```ts
import { peopleSummary, people, mentions as initialMentions, relationPatterns } from './people'
```

Add `Mention, MentionLogInput` to the `import type … from './types'` line (16). Replace `usePeople` (lines 67-69) with:

```ts
export function usePeople() {
  const [mentions, setMentions] = useState<Mention[]>(initialMentions)
  const logMention = useCallback((input: MentionLogInput) => {
    const now = new Date()
    const person = people.find(p => p.id === input.personId)
    const newMention: Mention = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      dayLabel: 'Ma',
      timeLabel: now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
      person_id: input.personId,
      personName: person?.name ?? '',
      source: 'chip',
      excerpt: input.text ?? '',
      tone: input.tone,
    }
    setMentions(prev => [newMention, ...prev])
  }, [])
  return { summary: peopleSummary, people, mentions, patterns: relationPatterns, logMention }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/meHooks.test.tsx`
Expected: PASS (Goals + Sleep + People).

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/hooks.ts src/data/meHooks.test.tsx
git commit -m "feat(me): usePeople bubble-up + MentionLogInput contract"
```

---

## Task 8: PersonLogSheet + wire the +Log trigger

**Files:**
- Create: `src/features/me/PersonLogSheet.tsx`
- Create: `src/features/me/PersonLogSheet.test.tsx`
- Modify: `src/features/me/views/PeopleView.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/me/PersonLogSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonLogSheet } from './PersonLogSheet'
import { people } from '@/data/people'

test('preselects initialPersonId and saves a MentionLogInput', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(
    <PersonLogSheet onClose={onClose} onSave={onSave} people={people} initialPersonId={people[0].id} />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ personId: people[0].id, tone: 'positive' }),
  )
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('does not save when no person is chosen', async () => {
  const onSave = vi.fn()
  render(<PersonLogSheet onClose={() => {}} onSave={onSave} people={people} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/me/PersonLogSheet.test.tsx`
Expected: FAIL — cannot find module `./PersonLogSheet`.

- [ ] **Step 3: Implement PersonLogSheet**

Create `src/features/me/PersonLogSheet.tsx`. Port `people.jsx` 601–708 — keep the decorative voice CTA card, the "vagy gyors chip" divider, the person chip row, the tone chip row, and the text textarea (≤240). `affectColor` comes from `@/data/people`. Save is a no-op unless a person is chosen:

```tsx
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { affectColor } from '@/data/people'
import type { Affect, MentionLogInput, PersonEntry } from '@/data/types'

const TONES: [Affect, string][] = [
  ['positive', 'Jó'],
  ['neutral', 'OK'],
  ['mixed', 'Vegyes'],
  ['negative', 'Nehéz'],
]

export function PersonLogSheet({
  onClose,
  onSave,
  people,
  initialPersonId,
}: {
  onClose: () => void
  onSave: (input: MentionLogInput) => void
  people: PersonEntry[]
  initialPersonId?: string
}) {
  const [chosen, setChosen] = useState<string | null>(initialPersonId ?? null)
  const [tone, setTone] = useState<Affect>('positive')
  const [text, setText] = useState('')

  const save = (close: () => void) => {
    if (!chosen) return
    onSave({ personId: chosen, tone, text: text || undefined })
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="person-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          {/* Header: eyebrow (var(--cat-tendency)) "People · gyors log" + title "Mit jegyzünk meg?"
              (id="person-log-title") + X → close. Port people.jsx 606-617. */}
          {/* Voice CTA card (decorative — no handler). Port people.jsx 619-642. */}
          {/* "vagy gyors chip" divider. Port people.jsx 644-648. */}
          {/* Person chips: people.map → button setChosen(p.id), highlighted via affectColor(p.affect_baseline). Port people.jsx 650-666. */}
          {/* Tone chips: TONES.map → button setTone(k), highlighted via affectColor(k). Port people.jsx 668-687. */}
          {/* Text textarea: onChange={e => setText(e.target.value.slice(0, 240))}. Port people.jsx 689-697. */}
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/me/PersonLogSheet.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the +Log trigger in PeopleView**

In `src/features/me/views/PeopleView.tsx`:

Add import (next to the other imports): `import { PersonLogSheet } from '../PersonLogSheet'`

Pull the mutator from the hook (line 30):
```tsx
const { summary, people, mentions, patterns, logMention } = usePeople()
```

Add state after the `filter` state (line 31):
```tsx
const [logOpen, setLogOpen] = useState(false)
const [prechosen, setPrechosen] = useState<string | undefined>(undefined)
```

Replace the inert `Log` chip (the `<span className="chip" …>` at lines 49-51) with:
```tsx
<button
  className="chip"
  style={{ padding: '8px 10px' }}
  onClick={() => { setPrechosen(undefined); setLogOpen(true) }}
>
  <Icon name="mic" size={12} /> Log
</button>
```

Render the sheet just before the view's closing `</>`:
```tsx
{logOpen && (
  <PersonLogSheet
    onClose={() => setLogOpen(false)}
    onSave={logMention}
    people={people}
    initialPersonId={prechosen}
  />
)}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/features/me/PersonLogSheet.test.tsx src/features/me/views/PeopleView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/me/PersonLogSheet.tsx src/features/me/PersonLogSheet.test.tsx src/features/me/views/PeopleView.tsx
git commit -m "feat(me): PersonLogSheet + wire +Log trigger"
```

---

## Task 9: PersonDetailSheet + DetailStat + wire PersonCard tap & Log-most nesting

**Files:**
- Create: `src/features/me/components/DetailStat.tsx`
- Create: `src/features/me/PersonDetailSheet.tsx`
- Create: `src/features/me/PersonDetailSheet.test.tsx`
- Modify: `src/features/me/views/PeopleView.tsx`

- [ ] **Step 1: Create DetailStat (covered via PersonDetailSheet test)**

Create `src/features/me/components/DetailStat.tsx` (port of `people.jsx` 586–596):

```tsx
export function DetailStat({ label, val, color }: { label: string; val: string | number; color?: string }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 10 }}>
      <span className="label-mono" style={{ fontSize: 8 }}>{label}</span>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)', marginTop: 4, lineHeight: 1.1 }}>
        {val}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/me/PersonDetailSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonDetailSheet } from './PersonDetailSheet'
import { people, mentions } from '@/data/people'

const person = people[0]
const personMentions = mentions.filter(m => m.person_id === person.id)

test('renders the person name and notes', () => {
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={() => {}} />)
  expect(screen.getByText(person.name)).toBeInTheDocument()
})

test('"Log most" fires onLog (to open PersonLogSheet)', async () => {
  const onLog = vi.fn()
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={onLog} />)
  await userEvent.click(screen.getByRole('button', { name: /Log most/ }))
  expect(onLog).toHaveBeenCalled()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/me/PersonDetailSheet.test.tsx`
Expected: FAIL — cannot find module `./PersonDetailSheet`.

- [ ] **Step 4: Implement PersonDetailSheet (read-only)**

Create `src/features/me/PersonDetailSheet.tsx`. Port `people.jsx` 486–584 — avatar + eyebrow(relationshipHu) + name (id="person-detail-title"); the three `DetailStat`s (Affect/Cadence/Mentions); the notes card; the "Amit Mezo tud" knownFacts list; the conditional "Kapcsolt patternek" ties; the "Friss említések" feed (first 5 of `mentions`). The footer "Vissza" calls `close`; "Log most" calls `onLog`:

```tsx
import { Sheet } from '@/components/ui/Sheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { DetailStat } from './components/DetailStat'
import { affectColor, affectLabel } from '@/data/people'
import type { Mention, PersonEntry } from '@/data/types'

export function PersonDetailSheet({
  person,
  mentions,
  onClose,
  onLog,
}: {
  person: PersonEntry
  mentions: Mention[]
  onClose: () => void
  onLog: () => void
}) {
  const color = affectColor(person.affect_baseline)
  return (
    <Sheet onClose={onClose} labelledBy="person-detail-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          {/* Header: avatar circle (person.initial, border color) + eyebrow(color, relationshipHu)
              + name in <div id="person-detail-title"><Display size="md">{person.name}</Display></div>
              + X → close. Port people.jsx 492-512. */}
          <div className="row gap-sm">
            <DetailStat label="Affect" val={affectLabel(person.affect_baseline)} color={color} />
            <DetailStat label="Cadence" val={person.contactCadenceLabel} />
            <DetailStat label="Mentions" val={person.mentionCount} />
          </div>
          {/* Notes card. Port people.jsx 520-524. */}
          {/* "Amit Mezo tud" → person.knownFacts.map. Port people.jsx 526-540. */}
          {/* person.ties.length > 0 → "Kapcsolt patternek". Port people.jsx 542-555. */}
          {/* "Friss említések · {mentions.length}" → mentions.slice(0,5).map (source icon, dayLabel·timeLabel,
              italic excerpt, affectColor(m.tone) accent). Port people.jsx 557-578. */}
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Vissza</button>
            <button className="cta-primary notch-4 flex-1" onClick={onLog}>
              <Icon name="mic" size={14} /> Log most
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/me/PersonDetailSheet.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire PersonCard tap + Log-most nesting in PeopleView**

In `src/features/me/views/PeopleView.tsx`:

Add import: `import { PersonDetailSheet } from '../PersonDetailSheet'` and add `PersonEntry` to the `@/data/types` import.

Add detail state next to the `logOpen`/`prechosen` state:
```tsx
const [detailPerson, setDetailPerson] = useState<PersonEntry | null>(null)
```

Pass `onTap` to the `PersonCard` (currently rendered without it at line 85):
```tsx
<PersonCard key={p.id} person={p} onTap={() => setDetailPerson(p)} />
```

Render the detail sheet just before `</>` (alongside the PersonLogSheet block). The "Log most" button closes detail and opens the log sheet preselected to that person:
```tsx
{detailPerson && (
  <PersonDetailSheet
    person={detailPerson}
    mentions={mentions.filter(m => m.person_id === detailPerson.id)}
    onClose={() => setDetailPerson(null)}
    onLog={() => {
      setPrechosen(detailPerson.id)
      setDetailPerson(null)
      setLogOpen(true)
    }}
  />
)}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/features/me/PersonDetailSheet.test.tsx src/features/me/views/PeopleView.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/me/components/DetailStat.tsx src/features/me/PersonDetailSheet.tsx src/features/me/PersonDetailSheet.test.tsx src/features/me/views/PeopleView.tsx
git commit -m "feat(me): PersonDetailSheet + wire card tap & Log-most nesting"
```

---

## Task 10: Full verification + parity + close issue

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green, including the new `meHooks`, the five sheet tests, `TimePicker`, and the three view tests.

- [ ] **Step 2: Type-check + build**

Run: `npm run build`
Expected: `tsc -b` clean (no type errors), Vite build succeeds.

- [ ] **Step 3: Parity harness**

Run: `npm run parity`
Expected: PASS. If a Me-screen snapshot differs because the triggers are now interactive `<button>`s instead of inert `<span>`s, review the diff; update the baseline only if the visual rendering matches the prototype (the prototype triggers are also buttons). Document any intentional baseline update in the commit message.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the Me tab, and verify: `+Súly` → WeightLogSheet logs to the chart; goal hero tap → EditGoalSheet; Sleep `+Log` → SleepLogSheet adds a row; People `+Log` → PersonLogSheet prepends a mention; PersonCard tap → PersonDetailSheet → "Log most" opens the log preselected.

- [ ] **Step 5: Close the bd issue**

```bash
bd close mezo-k0i --reason "Built all 5 Me domain sheets (WeightLog/EditGoal/SleepLog/PersonLog/PersonDetail) with bubble-up persistence; triggers wired; tests + parity green"
```

- [ ] **Step 6: Commit any parity-baseline updates**

```bash
git add -A
git commit -m "test(me): parity baselines for live Me domain sheet triggers"
```

(Skip if Step 3 required no baseline changes.)

---

## Self-Review notes (addressed)

- **Spec coverage:** all five sheets (Tasks 2, 3, 6, 8, 9), all three mutators + contract types (Tasks 1, 4, 7), all three trigger wirings + PersonCard tap + Log-most nesting (Tasks 2, 3, 6, 8, 9), TimePicker (Task 5), tests + parity (every task + Task 10). EditGoal is display-only (no mutator) per the approved decision; voice CTA is decorative.
- **Type consistency:** `WeightLogInput`/`SleepLogInput`/`MentionLogInput` are defined in Tasks 1/4/7 and consumed unchanged by the sheets in Tasks 2/6/8 and the wirings; mutator field mappings (`weightKg→value`, `durationH→duration`, `note→notes`) are shown explicitly in the hook code.
- **Date stamping:** write sheets stamp `date` to `new Date().toISOString().slice(0,10)` at submit (no UI date picker) — a concrete realization of the spec's "date = today, not user-collected".
