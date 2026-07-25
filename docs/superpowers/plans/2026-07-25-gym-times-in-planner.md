# Gym times in the mesocycle planner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set gym times in the mesocycle planner (per selected day, prefilled from the standing schedule), keep the Gym-page "Időpontok" chip as the always-available editor, and make Fuel read-only — all writing the same Train-owned `PUT /api/train/gym-schedule`.

**Architecture:** Pure frontend. The data model is unchanged (Option Y — a standalone weekly `GymScheduleSlot` schedule that persists across mesocycles). The planner and the Gym chip both call `useTrain().saveGymSchedule`; Fuel drops its editor and only reads `useFuelWeek().gymSchedule` + feeds `useFuelTimeline`. No API contract, backend, or Liquibase change.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind v4, TanStack Query, Vitest + Testing Library + MSW. Hungarian UI.

## Global Constraints

- **Frontend conventions** (`docs/references/frontend_conventions.md`): deep absolute `@/*` imports (no relative `../`, no new barrels); every data hook imported from `@/data/hooks` only; colocate tests; `var(--token)` colors only.
- **Both test modes must stay green:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **No backend / API contract / Liquibase change.** Data model stays Option Y (standing schedule).
- **Gym `duration` stays out of scope** (no DB home; `DEFAULT_BLOCK_MIN` presentational default).
- **New-day default time = `18:00`**; existing standing slots prefill as-is; time is **not** a gate for "Tovább".
- Driving bd id on every commit subject: `(mezo-4t43)`.
- Spec: `docs/superpowers/specs/2026-07-25-gym-times-in-planner-design.md`.

---

### Task 1: Planner Step 2 — per-day time picker + prefill + save-through

**Files:**
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx`
- Test: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`

**Interfaces:**
- Consumes: `useTrain()` (already imported) — now also destructures `gymSlots: GymScheduleSlot[]` and `saveGymSchedule: (slots: GymScheduleSlotInput[], opts?) => void`; `DAY_ORDER` (already imported from `@/data/train/train`).
- Produces: nothing new for later tasks (self-contained). `GymScheduleSlotInput = { dayOfWeek: number; time: string }`.

- [ ] **Step 1: Write the failing tests**

Add these two tests to `MesocyclePlannerPage.test.tsx` (after the existing `step 2 weekday picker…` test). The mock standing slots are `gymScheduleMock` = Kedd (1) & Csü (3) at `18:30`; every other selected day defaults to `18:00`.

```tsx
test('step 2 shows a time input per selected day — standing slot prefills, others default 18:00', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  // Hypertrophy defaults: Hét..Pén selected -> one time input each
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('18:00') // no slot -> default
  expect((screen.getByLabelText('Kedd időpont') as HTMLInputElement).value).toBe('18:30') // gymScheduleMock slot
  expect((screen.getByLabelText('Csü időpont') as HTMLInputElement).value).toBe('18:30') // gymScheduleMock slot
  // an unselected day has no time row
  expect(screen.queryByLabelText('Szo időpont')).toBeNull()
  // toggling the day set updates the rows: Pén off, Szo on
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  expect(screen.queryByLabelText('Pén időpont')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  expect(screen.getByLabelText('Szo időpont')).toBeInTheDocument()
})

test('editing a day time does not gate Tovább (time is optional)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeEnabled() // still gated only on day-count
})
```

Add `fireEvent` to the Testing Library import at the top of the test file:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
```

Also extend the existing real-mode wizard test (`the wizard persists the mesocycle in real mode…`) to assert the schedule write-through. Add this import near the top:

```tsx
import { trainApi } from '@/data/train/trainApi'
```

and inside that test, right after `const user = userEvent.setup()`, add the spy, then assert after the save click:

```tsx
  const putSpy = vi.spyOn(trainApi, 'replaceGymSchedule')
  // …existing steps through the save click…
  await waitFor(() => expect(putSpy).toHaveBeenCalled())
  const savedSlots = putSpy.mock.calls[0][0]
  expect(savedSlots).toHaveLength(5) // Hypertrophy: 5 selected days, each carries a time
  expect(savedSlots.every((s) => /^\d{2}:\d{2}$/.test(s.time))).toBe(true)
  putSpy.mockRestore()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test MesocyclePlannerPage`
Expected: FAIL — `getByLabelText('Hét időpont')` finds nothing (no time inputs rendered yet).

- [ ] **Step 3: Add the gym-times state + save-through in `MesocyclePlannerPage`**

In the React import line, add `useMemo`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

Add `GymScheduleSlot` to the `@/data/types` type import already present:

```tsx
import type { ExerciseLibraryItem, GoalPreset, GymExercise, GymScheduleSlot, MesoPhase, SplitOption } from '@/data/types'
```

Extend the `useTrain()` destructure (currently `const { createMesocycle, mesoMutationPending } = useTrain()`):

```tsx
  const { createMesocycle, mesoMutationPending, gymSlots, saveGymSchedule } = useTrain()
```

Add the gym-times state + resolver right after the `program` state (`const [program, setProgram] = useState<PlannerDay[] | null>(null)`):

```tsx
  // Gym times (mezo-4t43): each selected day prefills from the standing weekly schedule
  // (gymSlots, the Train-owned WHEN); a day with no slot defaults to 18:00. `dayTimes` holds
  // only the user's explicit edits — render + save fall back through the slot, then the default.
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({})
  const slotTimeByDay = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of gymSlots) {
      const label = DAY_ORDER[s.dayOfWeek]
      if (label) m[label] = s.time
    }
    return m
  }, [gymSlots])
  const timeForDay = (day: string) => dayTimes[day] ?? slotTimeByDay[day] ?? '18:00'
  const setTimeForDay = (day: string, time: string) =>
    setDayTimes((cur) => ({ ...cur, [day]: time }))
```

In `saveMesocycle`, immediately before the final `createMesocycle(request, { onSuccess: backToLibrary })` call, persist the standing schedule from the picks:

```tsx
    // Persist the standing weekly gym schedule from the planner picks (mezo-4t43): one slot
    // per selected training day (all carry a time — default 18:00), replace-all. Mock no-ops.
    saveGymSchedule(
      selectedDays
        .map((d) => ({ dayOfWeek: DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]), time: timeForDay(d) }))
        .filter((s) => s.dayOfWeek >= 0),
    )
```

- [ ] **Step 4: Render the time inputs in Step 2**

Pass the two new props where `<Step2Split … />` is rendered (add to the existing prop list):

```tsx
        <Step2Split
          goal={goal}
          split={split}
          setSplit={pickSplit}
          days={days}
          setDays={pickDays}
          selectedDays={selectedDays}
          toggleDay={toggleDay}
          timeForDay={timeForDay}
          onTimeChange={setTimeForDay}
        />
```

Extend the `Step2Split` prop type + destructure to accept them (add to the existing signature):

```tsx
  selectedDays: string[]
  toggleDay: (d: string) => void
  timeForDay: (d: string) => string
  onTimeChange: (d: string, t: string) => void
```
```tsx
  selectedDays,
  toggleDay,
  timeForDay,
  onTimeChange,
```

Inside `Step2Split`, immediately AFTER the "Melyik napokon?" weekday block (the `<div className="col gap-sm mt-xl">` that ends with the `{selectedDays.length !== days && (…)}` hint) and BEFORE the "Exercise auto-fill option" card, insert the time sub-section:

```tsx
      {/* Gym times — one time per selected day; prefilled from the standing schedule (mezo-4t43) */}
      {selectedDays.length > 0 && (
        <div className="col gap-sm mt-xl">
          <span className="label-mono">Időpontok · mikor mész</span>
          <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5 }}>
            Ebből számolja a Fuel a pre/post-workout étkezést és supplement-timing-ot.
          </p>
          <div className="col gap-sm">
            {DAY_ORDER.filter((d) => selectedDays.includes(d)).map((d) => (
              <div key={d} className="card" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label-mono" style={{ width: 36, color: 'var(--coral)' }}>
                    {d}
                  </span>
                  <input
                    type="time"
                    aria-label={`${d} időpont`}
                    value={timeForDay(d)}
                    onChange={(e) => onTimeChange(d, e.target.value)}
                    style={{
                      background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontSize: 16,
                      padding: '8px 10px', width: 130,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test MesocyclePlannerPage && pnpm test MesocyclePlannerPage`
Expected: PASS (both modes). The real-mode wizard test now also asserts the `replaceGymSchedule` write-through.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/pages/MesocyclePlannerPage.tsx frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx
git commit -m "feat(train): set gym times per day in the mesocycle planner (mezo-4t43)"
```

---

### Task 2: Gym page — un-gate the "Időpontok" chip + mock optimistic override

**Files:**
- Modify: `frontend/src/features/train/pages/GymPage.tsx`
- Test: `frontend/src/features/train/pages/GymPage.test.tsx`

**Interfaces:**
- Consumes: `useTrain()` → `gymSlots: GymScheduleSlot[]`, `saveGymSchedule`. `train/GymScheduleSheet` props: `{ slots: GymScheduleSlot[]; onSave: (slots: GymScheduleSlotInput[]) => void; onClose: () => void }`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('GymPage (mock mode)', …)` block in `GymPage.test.tsx`:

```tsx
  it('shows the "Időpontok" chip in mock mode and reflects a save via local override', () => {
    renderView()
    const chip = screen.getByRole('button', { name: /Időpontok/ })
    expect(chip).toBeInTheDocument()
    fireEvent.click(chip)
    expect(screen.getByRole('heading', { name: 'Heti gym-időpontok' })).toBeInTheDocument()
    // edit Hét + save
    fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
    fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(screen.queryByRole('heading', { name: 'Heti gym-időpontok' })).toBeNull()
    // reopen -> the in-session override kept the edit
    fireEvent.click(screen.getByRole('button', { name: /Időpontok/ }))
    expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test GymPage`
Expected: FAIL — the chip is currently gated behind `!isMockMode()`, so `getByRole('button', { name: /Időpontok/ })` throws.

- [ ] **Step 3: Un-gate the chip + add the mock override**

Remove the now-unused mode import (line 12):

```tsx
import { isMockMode } from '@/data/_client/mode'   // DELETE this line
```

Add a `GymScheduleSlot` type import next to the other type imports:

```tsx
import type { GymScheduleSlot } from '@/data/types'
```

Add the override state next to the other `useState` calls (after `const [muscleOpen, setMuscleOpen] = useState(false)`):

```tsx
  // Optimistic local copy of a schedule save; null = render the hook's (query-backed) slots.
  // Real mode also invalidates + refetches; the override keeps mock edits visible in-session.
  const [gymOverride, setGymOverride] = useState<GymScheduleSlot[] | null>(null)
```

Replace the mock-gated chip block (the whole `{!isMockMode() && ( … )}` wrapper) with an always-rendered button:

```tsx
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="pgact-np np-press"
            style={{ background: 'var(--wash-gym)', color: 'var(--tag-gym)' }}
          >
            <Icon name="today" size={12} /> Időpontok
          </button>
```

Update the sheet render to use the override and set it on save:

```tsx
      {scheduleOpen && (
        <GymScheduleSheet
          slots={gymOverride ?? gymSlots}
          onSave={(next) => {
            setGymOverride(next)
            saveGymSchedule(next)
          }}
          onClose={() => setScheduleOpen(false)}
        />
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test GymPage && pnpm test GymPage`
Expected: PASS (both modes). The pre-existing real-mode GymPage behavior is unchanged (override starts null → renders `gymSlots`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/GymPage.tsx frontend/src/features/train/pages/GymPage.test.tsx
git commit -m "feat(train): show gym-time editor chip in mock too, add optimistic override (mezo-4t43)"
```

---

### Task 3: Fuel read-only — remove the editor + dead write-through code

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelPlanPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelPlanPage.test.tsx`
- Modify: `frontend/src/data/fuel/fuelWeekHooks.ts`
- Modify: `frontend/src/data/fuel/fuelWeekHooks.test.tsx`
- Delete: `frontend/src/features/fuel/sheets/GymScheduleSheet.tsx`
- Delete: `frontend/src/features/fuel/sheets/GymScheduleSheet.test.tsx`

**Interfaces:**
- Consumes: `useFuelWeek()` → `gymSchedule` (read only). No longer uses `useFuelWeekActions`.
- Produces: `useFuelWeekActions` and `gymDaysToSlots` are removed from `fuelWeekHooks.ts`; `useFuelWeek`, `withDefaultDuration`, `deriveWeeklyStats`, `mondayIso`, `deriveWeekTitle`, `toRetaCells` remain exported.

- [ ] **Step 1: Update the failing tests first (FuelPlanPage + fuelWeekHooks)**

In `FuelPlanPage.test.tsx`:
- Delete the test `it('Idők opens the gym schedule sheet', …)` (whole block).
- Delete the real-mode test `it('saving the sheet writes through to Train (PUT /api/train/gym-schedule)', …)` (whole block).
- Replace the header test with a read-only version (no `Idők` button):

```tsx
  it('own header: pghead-np sage over + h1 (read-only, no gym-time editor)', () => {
    const { container } = renderView()
    expect(container.querySelector('.pghead-np.sage')).toBeInTheDocument()
    expect(screen.getByText('Fuel · Heti terv')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Idők' })).toBeNull()
    expect(screen.queryByText('Heti gym idők')).toBeNull()
  })
```

- Remove the now-unused imports at the top: delete `import userEvent from '@testing-library/user-event'` and `import { trainApi } from '@/data/train/trainApi'` (both were only used by the deleted tests). Keep `waitFor` (still used by the surviving real-mode test).

In `fuelWeekHooks.test.tsx`:
- Change the import line to drop `useFuelWeekActions` and `gymDaysToSlots`:

```tsx
import { useFuelWeek, mondayIso, deriveWeekTitle, toRetaCells, withDefaultDuration, deriveWeeklyStats } from '@/data/fuel/fuelWeekHooks'
```

- Delete the `import { trainApi } from '@/data/train/trainApi'` line (only used by the removed save tests).
- Delete the pure-helper test `test('gymDaysToSlots keeps only active days with a time, …')`.
- Delete the mock-mode test `it('saveGymSchedule does not hit the API (Train mock no-op)', …)`.
- Delete the real-mode test `it('saveGymSchedule writes through to PUT /api/train/gym-schedule with mapped slots', …)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test FuelPlanPage fuelWeekHooks`
Expected: FAIL — the source still renders the `Idők` button / still exports the removed symbols (import mismatch or leftover button).

- [ ] **Step 3: Make Fuel read-only in `FuelPlanPage.tsx`**

- Delete the import `import { useState } from 'react'` (no `useState` remains after this task).
- Delete the import `import type { GymScheduleDay } from '@/data/types'`.
- Delete the import `import { GymScheduleSheet } from '@/features/fuel/sheets/GymScheduleSheet'`.
- Change the hooks import to drop `useFuelWeekActions`:

```tsx
import { useFuelWeek, useTodayScenario } from '@/data/hooks'
```

- Delete these lines from the component body:

```tsx
  const { saveGymSchedule } = useFuelWeekActions()
  const [gymOverride, setGymOverride] = useState<GymScheduleDay[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const schedule = gymOverride ?? gymSchedule
```

- Replace the two remaining `schedule` references with `gymSchedule`:
  - `const activeGymDays = schedule.filter(d => d.active).length` → `const activeGymDays = gymSchedule.filter(d => d.active).length`
  - `<WeekRhythmGrid gymSchedule={schedule} volleyball={volleyball} />` → `<WeekRhythmGrid gymSchedule={gymSchedule} volleyball={volleyball} />`

- Delete the header edit button (the `<button … onClick={() => setEditOpen(true)} …>` … `Idők` … `</button>`).
- Delete the trailing sheet block:

```tsx
      {editOpen && (
        <GymScheduleSheet
          schedule={schedule}
          onSave={(next) => {
            setGymOverride(next)
            saveGymSchedule(next)
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
```

- [ ] **Step 4: Remove the dead write-through code in `fuelWeekHooks.ts`**

- Delete the import `import { useCallback } from 'react'`.
- Delete the import `import { DAY_ORDER } from '@/data/train/train'`.
- Delete the import `import type { GymScheduleSlotInput } from '@/data/train/trainApi'`.
- Delete the `gymDaysToSlots` function (its whole JSDoc + body).
- Delete the `useFuelWeekActions` function (its whole JSDoc + body).
- Keep `useTrain` import (still used by `useFuelWeek`), `withDefaultDuration`, and everything else.

- [ ] **Step 5: Delete the Fuel gym-schedule sheet + its test**

```bash
git rm frontend/src/features/fuel/sheets/GymScheduleSheet.tsx frontend/src/features/fuel/sheets/GymScheduleSheet.test.tsx
```

- [ ] **Step 6: Run the tests + typecheck to verify green**

Run: `cd frontend && pnpm build && VITE_USE_MOCK=true pnpm test FuelPlanPage fuelWeekHooks && pnpm test FuelPlanPage fuelWeekHooks`
Expected: `tsc -b` clean (no dangling imports of the removed sheet/exports), tests PASS both modes.

- [ ] **Step 7: Verify nothing else imports the removed symbols**

Run: `cd frontend && grep -rn "useFuelWeekActions\|gymDaysToSlots\|fuel/sheets/GymScheduleSheet" src`
Expected: no matches. If any appear, fix them (there should be none outside the files above).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelPlanPage.tsx frontend/src/features/fuel/pages/FuelPlanPage.test.tsx frontend/src/data/fuel/fuelWeekHooks.ts frontend/src/data/fuel/fuelWeekHooks.test.tsx
git commit -m "feat(fuel): make Terv gym times read-only, remove duplicate editor (mezo-4t43)"
```

---

### Task 4: Docs, full gate, close

**Files:**
- Modify: `docs/features/train.md`
- Modify: `docs/features/fuel.md`

- [ ] **Step 1: Update `docs/features/train.md`**

- In the GymPage section: the **"Időpontok" chip is no longer mock-gated** — it is now visible in mock mode too (with a local optimistic override for the demo). Remove/rewrite the sentence that says it "is **mock-gated** — hidden in mock mode where `saveGymSchedule` no-ops".
- In §4 (gym schedule / `GymScheduleSlot`): note the **mesocycle planner Step 2 is now a schedule editor** — it prefills each selected day from the standing slots and writes the schedule (replace-all) on meso save; the Gym chip remains the always-available mid-cycle editor. The standalone/persists-across-mesocycles model (Option Y) is unchanged; link the Y+ refinement spec `docs/superpowers/specs/2026-07-25-gym-times-in-planner-design.md`.

- [ ] **Step 2: Update `docs/features/fuel.md`**

- Terv (`FuelPlanPage`): gym times are now **read-only** in Fuel — the `GymScheduleSheet` editor and the `useFuelWeekActions().saveGymSchedule` write-through path are **removed**; `WeekRhythmGrid` still renders the derived schedule. Update the paragraphs describing the write-through (the "Gym times are editable via `GymScheduleSheet`…" sentence and the `useFuelWeek`/`useFuelWeekActions` exception paragraph and the "Train → Fuel — two REAL paths" integration bullet) to reflect read-only.
- The Mai Timeline consumption (`useFuelTimeline` → `buildDayPlan`/`buildProtocol`, pre −75m / post +45m / supplement −40m) is **unchanged** — the times now originate from the planner/Gym-chip single source.

- [ ] **Step 3: Clear staleness + full gate**

```bash
node scripts/lint-docs.mjs
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: lint-docs reports no stale flag for train.md/fuel.md; build + both test modes green.

- [ ] **Step 4: Commit docs**

```bash
git add docs/features/train.md docs/features/fuel.md
git commit -m "docs(train,fuel): gym times set in planner, Fuel read-only (mezo-4t43)"
```

- [ ] **Step 5: Close the bd issue**

```bash
bd close mezo-4t43
```

---

## Self-Review

**1. Spec coverage:**
- Decision 1 (data model unchanged, pure FE) → no contract/backend task exists ✓ (constraint stated).
- Decision 2 (planner primary editor, prefilled) → Task 1 ✓.
- Decision 3 (Gym chip stays, visible in mock) → Task 2 ✓.
- Decision 4 (Fuel read-only) → Task 3 ✓.
- Decision 5 (default 18:00) → Task 1 Step 3 `timeForDay` fallback + Step 1 test ✓.
- Decision 6 (time optional, no gate) → Task 1 Step 1 second test (`Tovább` stays enabled) ✓.
- Decision 7 (mock override on the chip) → Task 2 `gymOverride` ✓.
- Docs update → Task 4 ✓.

**2. Placeholder scan:** No TBD/TODO; every code step shows the actual code; deletions name the exact symbol/block. ✓

**3. Type consistency:** `timeForDay`/`setTimeForDay` names match between Task 1 Step 3 (definition) and Step 4 (Step2Split props `timeForDay`/`onTimeChange`). `gymOverride`/`setGymOverride` consistent in Task 2. `GymScheduleSlot` (state) vs `GymScheduleSlotInput` (sheet `onSave` param) are structurally identical `{dayOfWeek, time}` and assignable. `saveGymSchedule(slots: GymScheduleSlotInput[])` signature matches the mapped `{dayOfWeek, time}[]` in Task 1. ✓
