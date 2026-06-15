# Run Builder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the running-block builder so each prescribed session has a user-editable weekday + a new time-of-day, plans are 1–8 weeks, editing is auto-saved with a single status action, and the new-plan `weeks` crash is fixed.

**Architecture:** One new nullable `timeOfDay` (HH:mm) field on `RunPrescribedSession` flows OpenAPI → generated FE+Java types → the `structure` jsonb (no DB migration). Weekday (`dayOfWeek`, already present) becomes editable. Day+time are **plan-level**: new key-based draft updaters write to every week's same-key session; the session `key` stays stable so the `run_session_log` join never desyncs. The builder gets 1–8 week add/remove, a debounced auto-save, a single status CTA, and a `⋯` overflow menu.

**Tech Stack:** React 19 + TanStack Query + Vitest/RTL (frontend), Spring Boot 4 + JUnit5/AssertJ + Testcontainers (backend), OpenAPI codegen (contract).

**Spec:** `docs/superpowers/specs/2026-06-15-run-builder-redesign-design.md`
**bd:** `mezo-9pv` (redesign) · `mezo-11m` (weeks-crash) · `mezo-eq9` (deferred). Claim `mezo-9pv` + `mezo-11m` before starting.

**Conventions:** All commits use Conventional Commit subjects carrying the bd id, e.g. `feat(train): … (mezo-9pv)`. Frontend tests must pass in BOTH modes: `pnpm test` and `VITE_USE_MOCK=true pnpm test`. Always `./mvnw clean test` (Lombok/MapStruct incremental compile is flaky).

---

### Task 1: Contract — add `timeOfDay` to `RunPrescribedSession`, regenerate types

**Files:**
- Modify: `api/feature/train/train.yml:1440-1452` (RunPrescribedSession schema)
- Regenerate: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`

- [ ] **Step 1: Add the field to the OpenAPI fragment**

In `api/feature/train/train.yml`, the `RunPrescribedSession` schema currently is:

```yaml
    RunPrescribedSession:
      type: object
      required: [key, dayOfWeek, label, kind, rpeTarget, segments]
      properties:
        key: { type: string }
        dayOfWeek: { type: integer, description: '0=Hét..6=Vas' }
        label: { type: string }
        kind: { type: string, description: 'sprint|pyramid|steady' }
        rpeTarget: { $ref: '#/components/schemas/RpeTarget' }
        rounds: { type: integer, nullable: true }
        segments:
          type: array
          items: { $ref: '#/components/schemas/RunSegment' }
```

Add a `timeOfDay` property right after `dayOfWeek` (leave `required` unchanged — it is nullable):

```yaml
        dayOfWeek: { type: integer, description: '0=Hét..6=Vas' }
        timeOfDay: { type: string, nullable: true, pattern: '^\d{2}:\d{2}$', example: '18:00', description: 'HH:mm, plan-level start time' }
```

- [ ] **Step 2: Merge the fragment into the bundled contract**

Run: `cd api/generate && npm run generate:api`
Expected: completes without error; `git diff api/openapi.yml` shows the new `timeOfDay` under `RunPrescribedSession`.

- [ ] **Step 3: Regenerate the frontend types**

Run: `cd frontend && pnpm generate:api`
Expected: `git diff src/lib/api.gen.ts` shows `timeOfDay?: string | null` added to the `RunPrescribedSession` interface. No other interface changes.

- [ ] **Step 4: Verify frontend still type-checks**

Run: `cd frontend && pnpm build`
Expected: `tsc -b` passes (the new optional field breaks nothing; existing factories don't set it yet — optional).

- [ ] **Step 5: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): add nullable timeOfDay to RunPrescribedSession (mezo-9pv)"
```

---

### Task 2: Backend — `timeOfDay` on the record, populator/fixtures, round-trip IT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunningBlockStructure.java:14-21`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java:57-62`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/RunningContractIT.java:31-44, 90-112`
- Possibly modify: any `@Profile("demofixtures")` seed that constructs `RunPrescribedSession`

- [ ] **Step 1: Write the failing IT assertion**

In `RunningContractIT.java`, add `timeOfDay` to the `sampleStructure()` sprint builder (line ~32-40):

```java
        RunPrescribedSession sprint = RunPrescribedSession.builder()
            .key("tue-sprint").dayOfWeek(1).timeOfDay("18:00").label("Sprint-intervallum").kind("sprint")
            .rpeTarget(RpeTarget.builder().min(9).max(10).build()).rounds(6)
            .segments(List.of(
                RunSegment.builder().type("warmup").durationSec(300).build(),
                RunSegment.builder().type("work").durationSec(15).build(),
                RunSegment.builder().type("rest").durationSec(45).build(),
                RunSegment.builder().type("cooldown").durationSec(300).build()))
            .build();
```

And extend the assertion block in `testCreateRunningBlock_shouldPersistAsPlanned_whenValid()` (line ~102-107):

```java
        assertThat(created.getStructure().getWeeks().get(0).getSessions()).singleElement()
            .satisfies(s -> {
                assertThat(s.getKey()).isEqualTo("tue-sprint");
                assertThat(s.getTimeOfDay()).isEqualTo("18:00");
                assertThat(s.getRpeTarget().getMin()).isEqualTo(9);
                assertThat(s.getSegments()).hasSize(4);
            });
```

- [ ] **Step 2: Run the IT to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=RunningContractIT#testCreateRunningBlock_shouldPersistAsPlanned_whenValid`
Expected: FAIL — `expected "18:00" but was null` (the DTO carries `timeOfDay`, but the jsonb record drops it because the record has no such field).

- [ ] **Step 3: Add the field to the Java record**

In `RunningBlockStructure.java`, add `String timeOfDay` to the `RunPrescribedSession` record, right after `dayOfWeek`:

```java
    public record RunPrescribedSession(
        String key,
        Integer dayOfWeek,            // 0=Hét..6=Vas
        String timeOfDay,             // HH:mm, plan-level start time; nullable
        String label,
        String kind,                  // sprint|pyramid|steady
        RpeTarget rpeTarget,
        Integer rounds,               // sprint kind only; null otherwise
        List<RunSegment> segments) {}
```

- [ ] **Step 4: Fix the positional constructor in RunningPopulator**

The record's canonical constructor is positional, so `RunningPopulator.sampleStructure()` (line 57-62) no longer compiles. Update it to insert the time after `dayOfWeek`:

```java
        RunPrescribedSession sprint = new RunPrescribedSession(
            "tue-sprint", 1, "18:00", "Sprint-intervallum", "sprint", new RpeTarget(9, 10), 6,
            List.of(new RunSegment("warmup", 300, null),
                    new RunSegment("work", 15, null),
                    new RunSegment("rest", 45, null),
                    new RunSegment("cooldown", 300, null)));
```

- [ ] **Step 5: Find and fix any other positional constructors**

Run: `cd backend && grep -rn "new RunPrescribedSession(" src`
For EACH hit besides the one above (e.g. a `@Profile("demofixtures")` Train seed), insert a time-of-day string argument after the `dayOfWeek` integer (use `"18:00"` for sprint-like, `"17:30"` for pyramid-like). If there are no other hits, this step is a no-op.

- [ ] **Step 6: Run the IT to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RunningContractIT`
Expected: PASS — all RunningContractIT tests green (jsonb now round-trips `timeOfDay` via MapStruct + Hibernate `@JdbcTypeCode(JSON)`; no mapper/migration change needed).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunningBlockStructure.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/train/RunningContractIT.java
git commit -m "feat(train): persist timeOfDay on prescribed sessions in structure jsonb (mezo-9pv)"
```

---

### Task 3: Frontend draft helpers — plan-level `setSessionDay` / `setSessionTime` + factory defaults

**Files:**
- Modify: `frontend/src/data/runningDraft.ts`
- Modify: `frontend/src/data/running.ts:10-33` (mock factory defaults)
- Test: `frontend/src/data/runningDraft.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `runningDraft.test.ts` (add `setSessionDay, setSessionTime` to the import on line 3-5):

```ts
describe('setSessionDay (plan-level)', () => {
  test('sets dayOfWeek on the same-key session in EVERY week, keeps key stable, is immutable', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setSessionDay(struct, 'tue-sprint', 2) // Tue(1) -> Wed(2)

    for (const w of next.weeks) {
      const sprint = w.sessions.find((s) => s.key === 'tue-sprint')!
      expect(sprint.dayOfWeek).toBe(2)
      expect(sprint.key).toBe('tue-sprint') // key never derived from weekday
    }
    // pyramid sessions untouched
    expect(next.weeks[0].sessions.find((s) => s.key === 'fri-pyramid')!.dayOfWeek).toBe(4)
    // immutability
    expect(struct.weeks[0].sessions.find((s) => s.key === 'tue-sprint')!.dayOfWeek).toBe(1)
  })
})

describe('setSessionTime (plan-level)', () => {
  test('sets timeOfDay on the same-key session in EVERY week', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setSessionTime(struct, 'fri-pyramid', '17:45')
    for (const w of next.weeks) {
      expect(w.sessions.find((s) => s.key === 'fri-pyramid')!.timeOfDay).toBe('17:45')
    }
  })
})

describe('newDraft factory defaults', () => {
  test('seeds a default weekday and time on each session', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const w1 = struct.weeks[0]
    const sprint = w1.sessions.find((s) => s.key === 'tue-sprint')!
    const pyramid = w1.sessions.find((s) => s.key === 'fri-pyramid')!
    expect(sprint.dayOfWeek).toBe(1)
    expect(sprint.timeOfDay).toBe('18:00')
    expect(pyramid.dayOfWeek).toBe(4)
    expect(pyramid.timeOfDay).toBe('17:30')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- runningDraft`
Expected: FAIL — `setSessionDay is not a function` / `timeOfDay` is `undefined`.

- [ ] **Step 3: Add the factory defaults**

In `runningDraft.ts`, the `sprintSession` / `pyramidSession` factories (lines 8-18) currently return objects without `timeOfDay`. Add it:

```ts
export function sprintSession(rounds: number, restSec: number): RunPrescribedSession {
  return { key: 'tue-sprint', dayOfWeek: 1, timeOfDay: '18:00', label: 'Sprint-intervallum', kind: 'sprint',
    rpeTarget: { min: 9, max: 10 }, rounds,
    segments: [warmup(), { type: 'work', durationSec: 15, label: null }, { type: 'rest', durationSec: restSec, label: null }, cooldown()] }
}
export function pyramidSession(workSecs: number[], restMul: number): RunPrescribedSession {
  const segs: RunSegment[] = [warmup()]
  for (const w of workSecs) { segs.push({ type: 'work', durationSec: w, label: null }); segs.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null }) }
  segs.push(cooldown())
  return { key: 'fri-pyramid', dayOfWeek: 4, timeOfDay: '17:30', label: 'Piramis-intervallum', kind: 'pyramid', rpeTarget: { min: 8, max: 9 }, rounds: null, segments: segs }
}
```

- [ ] **Step 4: Add the plan-level updaters**

Add to `runningDraft.ts` (next to the existing `mapSession`):

```ts
// Plan-level: apply fn to the same-key session in EVERY week (day/time are constant across weeks).
function mapSessionAllWeeks(s: RunningBlockStructureDto, key: string,
  fn: (sess: RunPrescribedSession) => RunPrescribedSession): RunningBlockStructureDto {
  return { weeks: s.weeks.map((w) => ({ ...w, sessions: w.sessions.map((sess) => sess.key === key ? fn(sess) : sess) })) }
}
export function setSessionDay(s: RunningBlockStructureDto, key: string, dayOfWeek: number): RunningBlockStructureDto {
  return mapSessionAllWeeks(s, key, (sess) => ({ ...sess, dayOfWeek }))
}
export function setSessionTime(s: RunningBlockStructureDto, key: string, timeOfDay: string): RunningBlockStructureDto {
  return mapSessionAllWeeks(s, key, (sess) => ({ ...sess, timeOfDay }))
}
```

- [ ] **Step 5: Mirror the defaults in the mock fixtures**

In `running.ts`, the `sprintSession` / `pyramidSession` factories (lines 10-33) must also carry `timeOfDay` so mock-mode data matches. Add `timeOfDay: '18:00',` after `dayOfWeek: 1,` in `sprintSession`, and `timeOfDay: '17:30',` after `dayOfWeek: 4,` in `pyramidSession`.

- [ ] **Step 6: Run to verify it passes (both modes)**

Run: `cd frontend && pnpm test -- runningDraft && VITE_USE_MOCK=true pnpm test -- runningDraft`
Expected: PASS in both.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/runningDraft.ts frontend/src/data/running.ts frontend/src/data/runningDraft.test.ts
git commit -m "feat(train): plan-level setSessionDay/setSessionTime + timeOfDay defaults (mezo-9pv)"
```

---

### Task 4: Frontend draft helpers — `addWeek` / `removeLastWeek` (1–8 bounds)

**Files:**
- Modify: `frontend/src/data/runningDraft.ts`
- Test: `frontend/src/data/runningDraft.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `runningDraft.test.ts` (add `addWeek, removeLastWeek` to the import):

```ts
describe('addWeek / removeLastWeek', () => {
  test('addWeek clones the last week with the next weekNumber, capped at 8', () => {
    let s = newDraft('2026-06-16', '2026-07-14').structure // 4 weeks
    s = addWeek(s)
    expect(s.weeks).toHaveLength(5)
    expect(s.weeks[4].weekNumber).toBe(5)
    // cloned load from week 4
    expect(workSecs(pyramidOf(s.weeks[4])!)).toEqual(workSecs(pyramidOf(s.weeks[3])!))
    // cap at 8
    while (s.weeks.length < 8) s = addWeek(s)
    expect(s.weeks).toHaveLength(8)
    s = addWeek(s)
    expect(s.weeks).toHaveLength(8) // no-op at 8
  })

  test('removeLastWeek drops the last week, floored at 1', () => {
    let s = newDraft('2026-06-16', '2026-07-14').structure
    s = removeLastWeek(s)
    expect(s.weeks).toHaveLength(3)
    expect(s.weeks.at(-1)!.weekNumber).toBe(3)
    s = removeLastWeek(removeLastWeek(s)) // -> 1
    expect(s.weeks).toHaveLength(1)
    s = removeLastWeek(s)
    expect(s.weeks).toHaveLength(1) // no-op at 1
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- runningDraft`
Expected: FAIL — `addWeek is not a function`.

- [ ] **Step 3: Implement**

Add to `runningDraft.ts`:

```ts
export function addWeek(s: RunningBlockStructureDto): RunningBlockStructureDto {
  if (s.weeks.length >= 8) return s
  const last = s.weeks[s.weeks.length - 1]
  const n = s.weeks.length + 1
  return { weeks: [...s.weeks, { ...last, weekNumber: n, sessions: last.sessions.map((sess) => ({ ...sess, segments: sess.segments.map((g) => ({ ...g })) })) }] }
}
export function removeLastWeek(s: RunningBlockStructureDto): RunningBlockStructureDto {
  if (s.weeks.length <= 1) return s
  return { weeks: s.weeks.slice(0, -1) }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm test -- runningDraft && VITE_USE_MOCK=true pnpm test -- runningDraft`
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/runningDraft.ts frontend/src/data/runningDraft.test.ts
git commit -m "feat(train): addWeek/removeLastWeek with 1-8 bounds (mezo-9pv)"
```

---

### Task 5: Fix the `weeks` crash — synchronous create cache + structure guards (mezo-11m)

**Files:**
- Modify: `frontend/src/data/runningHooks.ts:48-53` (create success path)
- Modify: `frontend/src/features/train/components/RunWeekEditor.tsx:30` (guard)
- Test: `frontend/src/data/runningHooks.test.ts` (new)

- [ ] **Step 1: Write the failing hook test**

Create `frontend/src/data/runningHooks.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useRunning } from './runningHooks'
import { runningApi } from '@/lib/runningApi'
import { newDraft } from './runningDraft'

// REAL mode: the create path must populate the blocks cache SYNCHRONOUSLY so the
// builder, navigated to immediately on success, finds the new block (mezo-11m).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

test('real-mode create inserts the returned block into the cache on success', async () => {
  const created = { id: 'rb-new-1', status: 'planned', ...newDraft('2026-06-16', '2026-07-14'), goal: null, summary: null, currentWeek: 0 }
  vi.spyOn(runningApi, 'blocks').mockResolvedValue([])
  vi.spyOn(runningApi, 'create').mockResolvedValue(created as never)

  const { wrapper } = wrap()
  const { result } = renderHook(() => useRunning(), { wrapper })
  await waitFor(() => expect(result.current.runningPending).toBe(false))

  let got: { id: string } | undefined
  result.current.saveRunningBlock(null, newDraft('2026-06-16', '2026-07-14'), { onSuccess: (b) => { got = b } })

  await waitFor(() => expect(got?.id).toBe('rb-new-1'))
  // The cache already holds the block at the moment onSuccess runs (synchronous insert).
  await waitFor(() => expect(result.current.runningBlocks.find((b) => b.id === 'rb-new-1')).toBeDefined())
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- runningHooks`
Expected: FAIL — the block is not found in `runningBlocks` (real-mode `onSuccess` only invalidates; with `runningApi.blocks` mocked to `[]` the refetch never adds it).

- [ ] **Step 3: Insert into the cache on create success**

In `runningHooks.ts`, replace the `saveMutation` definition (lines 48-53) so the create result is written into the cache synchronously in real mode too:

```ts
  const saveMutation = useMutation({
    mutationFn: (args: { id: string | null; body: RunningBlockUpsertRequest }) =>
      mock ? Promise.resolve(upsertMock(args.id, args.body))
           : (args.id ? runningApi.update(args.id, args.body) : runningApi.create(args.body)),
    onSuccess: (block, args) => {
      // Real-mode create: insert synchronously so an immediate navigate to the
      // builder finds the block (mezo-11m). Updates + mock mode keep invalidate.
      if (!mock && !args.id && block) {
        qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) => [...prev, block])
      }
      invalidate()
    },
  })
```

- [ ] **Step 4: Guard the editor against a not-yet-seeded structure**

In `RunWeekEditor.tsx`, line 30 reads `structure.weeks.find(...)`. Make it null-safe:

```ts
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
```

(The builder also guards — Task 7 — but defense in depth: `RunWeekEditor` must never throw on an undefined structure.)

- [ ] **Step 5: Run to verify it passes (both modes)**

Run: `cd frontend && pnpm test -- runningHooks && VITE_USE_MOCK=true pnpm test -- runningHooks runningDraft`
Expected: PASS.

- [ ] **Step 6: Commit + close the bug**

```bash
git add frontend/src/data/runningHooks.ts frontend/src/data/runningHooks.test.ts frontend/src/features/train/components/RunWeekEditor.tsx
git commit -m "fix(train): synchronous cache insert on run-block create + editor structure guard (mezo-11m)"
bd close mezo-11m "Root cause: real-mode create only invalidated (async) then navigated; builder mounted on stale list -> undefined structure. Fixed with synchronous setQueryData on create + RunWeekEditor structure guard + regression test."
```

---

### Task 6: WeekdayGrid component + editor UI (weekday grid + time, two zones)

**Files:**
- Create: `frontend/src/features/train/components/WeekdayGrid.tsx`
- Create: `frontend/src/features/train/components/WeekdayGrid.test.tsx`
- Modify: `frontend/src/features/train/components/RunWeekEditor.tsx`
- Modify: `frontend/src/features/train/components/RunSessionCard.tsx:82-87` (render time)

- [ ] **Step 1: Write the failing WeekdayGrid test**

Create `WeekdayGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WeekdayGrid } from './WeekdayGrid'

test('marks the selected weekday pressed and emits the clicked index', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<WeekdayGrid value={1} onChange={onChange} />)

  // DAY_ORDER index = dayOfWeek (Monday=0). Kedd(1) is selected.
  expect(screen.getByRole('button', { name: 'Kedd' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Pén' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(screen.getByRole('button', { name: 'Pén' }))
  expect(onChange).toHaveBeenCalledWith(4)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- WeekdayGrid`
Expected: FAIL — cannot resolve `./WeekdayGrid`.

- [ ] **Step 3: Implement WeekdayGrid**

Create `WeekdayGrid.tsx` (single-select; mirrors the `MesocyclePlanner` day grid look, run accent `--info`):

```tsx
// ============================================================
// Mezo · WeekdayGrid — single-select 7-day picker (Hét..Vas). value/onChange
// is a dayOfWeek index (0=Hét..6=Vas, = DAY_ORDER index). Run accent --info.
// ============================================================
import { DAY_ORDER } from '@/data/train'

const RUN = 'var(--info)'

export function WeekdayGrid({ value, onChange }: { value: number; onChange: (dayOfWeek: number) => void }) {
  return (
    <div className="row gap-xs">
      {DAY_ORDER.map((d, i) => {
        const active = i === value
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(i)}
            className="flex-1 notch-4"
            style={{
              padding: '9px 0',
              background: active ? 'color-mix(in srgb, var(--info) 12%, transparent)' : 'var(--surface-1)',
              border: `1px solid ${active ? RUN : 'var(--border-subtle)'}`,
              color: active ? RUN : 'var(--text-tertiary)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm test -- WeekdayGrid`
Expected: PASS.

- [ ] **Step 5: Rework RunWeekEditor — per-session Menetrend (day+time) zone + Terhelés zone**

Rewrite `RunWeekEditor.tsx`. Each session card renders, in order: the existing label/RPE-free mono header, a **Menetrend** zone (WeekdayGrid bound to `setSessionDay` + a native time input bound to `setSessionTime`, both plan-level via `session.key`), a divider, then the existing **Terhelés** controls (sprint steppers / pyramid pills). Replace the hardcoded `Kedd · Sprint` / `Péntek · Piramis` labels with the session's own `label`.

```tsx
import { CompactStepper } from './CompactStepper'
import { WeekdayGrid } from './WeekdayGrid'
import {
  sprintOf, pyramidOf, workSecs, restSec,
  setSprintRounds, setSprintRest, setPyramidWork,
  setSessionDay, setSessionTime,
} from '@/data/runningDraft'
import type { RunningBlockStructureDto, RunPrescribedSession } from '@/lib/runningApi'

const RUN = 'var(--info)'
const WORK_CYCLE = [15, 30, 45, 60]
const nextWork = (v: number) => WORK_CYCLE[(WORK_CYCLE.indexOf(v) + 1) % WORK_CYCLE.length] ?? 15

const hintStyle: React.CSSProperties = { fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }

export function RunWeekEditor({ structure, weekNumber, onStructure }: {
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
}) {
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
  if (!week) {
    return <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>Ez a hét nincs a tervben.</span>
  }
  const sprint = sprintOf(week)
  const pyramid = pyramidOf(week)

  return (
    <div className="col gap-md">
      {sprint && (
        <SessionCard session={sprint} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <div className="row gap-sm">
            <CompactStepper label="kör" value={sprint.rounds ?? 0} step={1} integer
              onChange={(n) => onStructure(setSprintRounds(structure, weekNumber, n))} />
            <CompactStepper label="mp pihenő" value={restSec(sprint)} step={5} integer
              onChange={(n) => onStructure(setSprintRest(structure, weekNumber, n))} />
          </div>
        </SessionCard>
      )}
      {pyramid && (
        <SessionCard session={pyramid} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <PyramidPills values={workSecs(pyramid)} onChange={(arr) => onStructure(setPyramidWork(structure, weekNumber, arr))} />
          <span style={{ ...hintStyle, marginTop: 4 }}>pihenő = szakasz × 2 · automatikus</span>
        </SessionCard>
      )}
    </div>
  )
}

function SessionCard({ session, structure, weekNumber, onStructure, children }: {
  session: RunPrescribedSession
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
  children: React.ReactNode
}) {
  return (
    <div className="card notch-4 col" style={{ padding: 12, gap: 9, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: RUN }} />
      <span className="label-mono" style={{ color: RUN }}>{session.label}</span>

      {/* Menetrend — plan-level day + time */}
      <span style={hintStyle}>Nap · minden héten</span>
      <WeekdayGrid value={session.dayOfWeek} onChange={(d) => onStructure(setSessionDay(structure, session.key, d))} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <span style={hintStyle}>Időpont · minden héten</span>
        <input
          type="time"
          aria-label={`${session.label} időpont`}
          value={session.timeOfDay ?? ''}
          onChange={(e) => onStructure(setSessionTime(structure, session.key, e.target.value))}
          style={{ background: 'var(--surface-2)', border: '1px solid rgba(96,165,250,.3)', color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 600, padding: '6px 10px' }}
        />
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />

      {/* Terhelés — week-level */}
      <span style={hintStyle}>Terhelés · {weekNumber}. hét</span>
      {children}
    </div>
  )
}

function PyramidPills({ values, onChange }: { values: number[]; onChange: (next: number[]) => void }) {
  const cycle = (i: number) => onChange(values.map((v, idx) => (idx === i ? nextWork(v) : v)))
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  const append = () => onChange([...values, 30])
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {values.map((v, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 2, color: RUN, border: '1px solid color-mix(in srgb, var(--info) 35%, transparent)', background: 'color-mix(in srgb, var(--info) 8%, transparent)' }}>
          <button type="button" aria-label={`${v} mp szakasz váltása`} onClick={() => cycle(i)} style={{ color: 'inherit' }}>{v}</button>
          <button type="button" aria-label={`${v} mp szakasz törlése`} onClick={() => remove(i)} style={{ color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <button type="button" onClick={append} style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 2, color: RUN, border: '1px dashed color-mix(in srgb, var(--info) 45%, transparent)', background: 'transparent' }}>＋ szakasz</button>
    </div>
  )
}
```

- [ ] **Step 6: Render time on the read-only RunSessionCard**

In `RunSessionCard.tsx`, the day label renders at line 85: `<span className="label-mono" ...>{dayLabel}</span>`. Append the time when present, right after that span:

```tsx
            <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{dayLabel}</span>
            {session.timeOfDay && (
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: RUN }}>{session.timeOfDay}</span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{session.label}</span>
```

- [ ] **Step 7: Run editor + card tests (both modes)**

Run: `cd frontend && pnpm test -- WeekdayGrid RunSessionCard && VITE_USE_MOCK=true pnpm test -- WeekdayGrid`
Expected: PASS (existing RunSessionCard tests still green; the time only renders when present).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/train/components/WeekdayGrid.tsx frontend/src/features/train/components/WeekdayGrid.test.tsx frontend/src/features/train/components/RunWeekEditor.tsx frontend/src/features/train/components/RunSessionCard.tsx
git commit -m "feat(train): per-session weekday grid + time-of-day editor, two-zone card (mezo-9pv)"
```

---

### Task 7: Builder shell — 1–8 weeks, auto-save, single CTA, `⋯` menu

**Files:**
- Modify: `frontend/src/features/train/RunningBlockBuilder.tsx`
- Modify: `frontend/src/features/train/RunningBlockBuilder.test.tsx` (rewrite for the new UI)

- [ ] **Step 1: Rewrite the builder test for the new UI**

The old test asserts a `Mentés` button and `Blokk lezárása`. The redesign removes the Save button (auto-save) and keeps a single status CTA. Replace `RunningBlockBuilder.test.tsx` body (keep the imports + `setup()` from lines 1-26):

```tsx
test('renders the active block title and its single lifecycle action (no Save button)', () => {
  setup()
  expect(screen.getByDisplayValue('Robbanékonyság 01')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mentés/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lezárás' })).toBeInTheDocument()
})

test('the sprint kör stepper shows the week value and increments on +', async () => {
  const user = userEvent.setup()
  setup()
  // rb-active-01 currentWeek=3 -> week 3 sprint rounds = 6 selected initially.
  const stepper = screen.getByText('kör').closest('div')!
  expect(stepper).toHaveTextContent('6')
  await user.click(screen.getByRole('button', { name: 'kör növelése' }))
  expect(stepper).toHaveTextContent('7')
})

test('editing the sprint weekday updates it across the plan', async () => {
  const user = userEvent.setup()
  setup()
  // Sprint defaults to Kedd; pick Szerda. The grid is single-select per session.
  const grids = screen.getAllByRole('button', { name: 'Sze' })
  await user.click(grids[0])
  expect(grids[0]).toHaveAttribute('aria-pressed', 'true')
})

test('a planned block exposes Aktiválás, an 8-week cap on the week adder', async () => {
  // rb-planned-01 is 6 weeks; add up to 8 then the ＋ disappears.
  render(
    <QueryWrapper><ThemeProvider>
      <MemoryRouter initialEntries={['/train/futas/rb-planned-01']}>
        <Routes><Route path="/train/futas/:id" element={<RunningBlockBuilder />} /></Routes>
      </MemoryRouter>
    </ThemeProvider></QueryWrapper>,
  )
  expect(screen.getByRole('button', { name: /Aktiválás/ })).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  expect(screen.queryByRole('button', { name: 'Hét hozzáadása' })).not.toBeInTheDocument() // at 8
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- RunningBlockBuilder`
Expected: FAIL — `Mentés` still present / no `Hét hozzáadása` button / no `Lezárás`.

- [ ] **Step 3: Rewrite the builder**

Rewrite `RunningBlockBuilder.tsx`. Key changes vs. the current file:
1. Import the new helpers: `import { toUpsert, duplicateDraft, addWeek, removeLastWeek } from '@/data/runningDraft'`.
2. Guard structure: if `block` exists but `draft.structure` is undefined, render a loading state (don't pass undefined down).
3. Replace the week chip row with a 1–8 add/remove row.
4. Add a debounced auto-save effect + a `✓ Mentve` / `Mentés…` indicator.
5. Replace `BuilderActions` with a single status CTA + a `⋯` overflow menu (Duplikálás / Törlés).

Header save indicator + `⋯` menu (place in the header eyebrow row, replacing the `Builder · {status}` single-span row):

```tsx
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="eyebrow" style={{ color: RUN }}>Builder · {statusEyebrow}</span>
          <div className="row gap-md">
            <span className="label-mono" style={{ fontSize: 9, color: dirty ? 'var(--text-tertiary)' : 'var(--success)' }}>
              {runningMutationPending ? 'Mentés…' : dirty ? 'Nem mentve' : '✓ Mentve'}
            </span>
            <OverflowMenu
              onDuplicate={() => saveRunningBlock(null, duplicateDraft(block), { onSuccess: backToList })}
              onDelete={() => deleteRunningBlock(block.id, { onSuccess: backToList })}
            />
          </div>
        </div>
```

Auto-save (`dirty` = draft differs from the loaded block; flush on back):

```tsx
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(toUpsert(block!)), [draft, block])

  useEffect(() => {
    if (!block || !dirty) return
    const t = setTimeout(() => saveRunningBlock(block.id, draft), 600)
    return () => clearTimeout(t)
  }, [draft, dirty, block, saveRunningBlock])

  const backToList = () => {
    if (block && dirty) saveRunningBlock(block.id, draft) // flush pending edit
    navigate('/train/futas')
  }
```

Week add/remove row (replaces the existing `{/* Week selector */}` block):

```tsx
      <div style={{ padding: '16px 24px 4px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="label-mono">Hetek · 1–8</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: draft.weeks || 1 }, (_, i) => i + 1).map((w) => {
            const active = w === clampedWeek
            return (
              <button key={w} type="button" aria-pressed={active} onClick={() => setSelectedWeek(w)} className="notch-4"
                style={{ minWidth: 38, padding: '8px 10px', background: active ? 'color-mix(in srgb, var(--info) 8%, transparent)' : 'var(--surface-1)', border: `1px solid ${active ? 'color-mix(in srgb, var(--info) 40%, transparent)' : 'var(--border-subtle)'}`, color: active ? RUN : 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}>
                {w}
              </button>
            )
          })}
          {(draft.weeks || 1) > 1 && (
            <button type="button" aria-label="Utolsó hét eltávolítása" onClick={removeWeek} className="notch-4"
              style={{ minWidth: 38, padding: '8px 10px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>−</button>
          )}
          {(draft.weeks || 1) < 8 && (
            <button type="button" aria-label="Hét hozzáadása" onClick={addWeekToDraft} className="notch-4"
              style={{ minWidth: 38, padding: '8px 10px', background: 'transparent', border: '1px dashed color-mix(in srgb, var(--info) 45%, transparent)', color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 14 }}>＋</button>
          )}
        </div>
      </div>
```

Week add/remove handlers + clamp:

```tsx
  const addWeekToDraft = () => setDraft((d) => ({ ...d, weeks: Math.min(8, (d.weeks || 1) + 1), structure: addWeek(d.structure) }))
  const removeWeek = () => {
    setDraft((d) => ({ ...d, weeks: Math.max(1, (d.weeks || 1) - 1), structure: removeLastWeek(d.structure) }))
    setSelectedWeek((w) => Math.min(w, Math.max(1, (draft.weeks || 1) - 1)))
  }
```

Bottom single CTA (replaces `<BuilderActions … />`):

```tsx
      <div className="col gap-sm" style={{ padding: '16px 24px 32px' }}>
        {block.status === 'planned' && (
          <CtaPrimary className="notch-8" onClick={() => { activateRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            <Icon name="check" size={16} /> Aktiválás · {block.startDate}
          </CtaPrimary>
        )}
        {block.status === 'active' && (
          <CtaGhost className="notch-4" style={{ padding: 12, borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
            onClick={() => { closeRunningBlock(block.id); backToList() }} disabled={runningMutationPending}>
            Lezárás
          </CtaGhost>
        )}
      </div>
```

`OverflowMenu` (small local component — `⋯` toggles a popover with Duplikálás / Törlés):

```tsx
function OverflowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-label="További műveletek" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="notch-4" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 16 }}>⋯</button>
      {open && (
        <div className="card notch-4" style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, minWidth: 150, background: 'var(--surface-3)', border: '1px solid var(--border-strong)' }}>
          <button type="button" onClick={() => { setOpen(false); onDuplicate() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>Duplikálás</button>
          <button type="button" onClick={() => { setOpen(false); onDelete() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, color: 'var(--error)' }}>Törlés</button>
        </div>
      )}
    </div>
  )
}
```

Add the missing imports at the top of the file: `useEffect, useMemo, useState` from `react`. Remove the now-unused `BuilderActions` component and its `CtaPrimary/CtaGhost`-only usage is replaced by the inline CTA above. Keep the structure guard: after `const block = …`, before the `draft.structure` is consumed:

```tsx
  if (block && !draft.structure) {
    return <div style={{ padding: 24 }}><span className="text-secondary" style={{ fontSize: 13 }}>Betöltés…</span></div>
  }
```

- [ ] **Step 4: Run the builder test (both modes)**

Run: `cd frontend && pnpm test -- RunningBlockBuilder && VITE_USE_MOCK=true pnpm test -- RunningBlockBuilder`
Expected: PASS.

- [ ] **Step 5: Run the full frontend suite (both modes)**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS. If `RunningView.test.tsx` asserts the old builder copy, update only the assertions that changed (no behavior change there).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/RunningBlockBuilder.tsx frontend/src/features/train/RunningBlockBuilder.test.tsx frontend/src/features/train/views/RunningView.test.tsx
git commit -m "feat(train): run builder 1-8 weeks, auto-save, single CTA, overflow menu (mezo-9pv)"
```

---

### Task 8: Docs, full gates, close issues

**Files:**
- Modify: the running feature doc under `docs/features/` (find it: `grep -rl -i "futás\|running" docs/features`)
- Run: doc lint, both frontend modes, frontend build, backend tests

- [ ] **Step 1: Update the feature doc**

Run: `grep -rl -i "futás\|running\|RunningBlock" docs/features` to locate the train/running feature doc. Update the sections that changed: the builder now edits weekday + time-of-day (plan-level) and 1–8 weeks with auto-save + single CTA; the data model gained `timeOfDay` on `RunPrescribedSession` (jsonb, no migration); note the `mezo-11m` create-crash fix. Keep it lean — edit only the affected sections, link with `file:line` pointers.

- [ ] **Step 2: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: no errors; the running feature doc's staleness flag is cleared.

- [ ] **Step 3: Full frontend gates (both modes + build)**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Expected: all green; `tsc -b && vite build` succeeds.

- [ ] **Step 4: Full backend gates**

Run: `cd backend && ./mvnw clean test`
Expected: all green (compose Postgres up, or add `-Dmezo.test.use-testcontainers=true`).

- [ ] **Step 5: Commit docs**

```bash
git add docs/features
git commit -m "docs(train): run builder weekday+time, 1-8 weeks, auto-save; timeOfDay model (mezo-9pv)"
```

- [ ] **Step 6: Close the feature issue**

```bash
bd close mezo-9pv "Run builder redesigned: per-session weekday grid + plan-level timeOfDay (HH:mm, no migration), 1-8 weeks, auto-save + single status CTA + overflow menu. mezo-11m fixed alongside. Free-form sessions remain in mezo-eq9."
```

- [ ] **Step 7: Manual smoke (real mode) — confirm the original bug is gone**

Start backend (`./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`) + frontend (`pnpm dev`). On Futás → Tervek → `＋ Új terv`: the builder opens WITHOUT the `weeks` crash; set weekdays/times, add a week to 8, change a stepper, go back — edits persisted (`✓ Mentve`).

---

## Self-Review

**Spec coverage:**
- Layout B / two-zone card → Task 6 (SessionCard). ✓
- Editable weekday → Task 6 (WeekdayGrid + setSessionDay). ✓
- New `timeOfDay` field, OpenAPI→FE→Java, no migration → Tasks 1, 2. ✓
- Plan-level day+time propagation, stable key → Task 3 (`mapSessionAllWeeks`). ✓
- 1–8 weeks add/remove → Task 4 + Task 7. ✓
- Auto-save + `✓ Mentve` → Task 7. ✓
- Single status CTA + `⋯` menu → Task 7. ✓
- `weeks`-crash fix (mezo-11m) → Task 5. ✓
- Native `<input type="time">` → Task 6. ✓
- Read display renders time → Task 6 Step 6. ✓
- Both-mode tests + backend IT → Tasks 2, 3, 4, 5, 6, 7, 8. ✓
- Out of scope (mezo-eq9) → not implemented. ✓
- Docs → Task 8. ✓

**Type consistency:** `setSessionDay`/`setSessionTime` (key + value) and `addWeek`/`removeLastWeek` (structure → structure) are used identically in Tasks 3/4/6/7. `RunPrescribedSession.timeOfDay` (`string | null` FE, `String` Java DTO/record) consistent across Tasks 1/2/3/6. Builder helpers `addWeekToDraft`/`removeWeek` defined and referenced in Task 7. No mismatches.

**Placeholder scan:** every code step shows complete code; Task 2 Step 5 and Task 8 Step 1 use a `grep` to locate variable hits, then give the exact edit — not a placeholder.
