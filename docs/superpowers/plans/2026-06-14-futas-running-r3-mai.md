# Futás R3 — Mai Integration + RunLogSheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface running in the **Mai** view (a blue `--run` hero card today + a third lane in the weekly timeline) and ship a `RunLogSheet` to log run-session actuals, wired from both Mai and the Futás *E heti edzés* session cards.

**Architecture:** Extend `useRunning()` with a `logRunSession` mutation (mock = append to the `['running','runSessions']` cache; real = POST then invalidate). Derive today's + the week's prescribed running sessions from the active block's current week (matched by `dayOfWeek`). `TrainTodayView` gains a running hero (stacked, time-ordered with gym + volleyball — the user-chosen "separate hero cards" approach). `WeeklyDayRow` gains a third stacked run row. `RunLogSheet` mirrors `SportLogSheet`.

**Tech Stack:** React 19, TanStack Query, TS, the prototype.css token system.

**Driving bd:** mezo-axi (under mezo-dy6). **Spec:** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` (§3 Mai integration; decision #6 = stacked hero cards). R0–R2 shipped the backend + read tab + builder + block mutations.

**Read before coding:**
- `frontend/src/features/train/views/TrainTodayView.tsx` (the Mai view: agenda model `WeeklyAgendaDay`, today's gym hero + volleyball hero, the weekly timeline, `SportLogSheet` wiring, `DAY_ORDER`)
- `frontend/src/features/train/components/WeeklyDayRow.tsx` (the per-day row with gym + volleyball lanes)
- `frontend/src/features/train/components/SportLogSheet.tsx` (the sheet + `NumberStep` + `ScaleRow` to mirror; the `Sheet` component usage)
- `frontend/src/data/runningHooks.ts` + `frontend/src/lib/runningApi.ts` (extend with logRunSession)
- `frontend/src/features/train/components/RunSessionCard.tsx` (R1 — add an optional `onLog` to wire the "Naplózás ▸" affordance)
- `frontend/src/features/train/views/RunningView.tsx` (R1/R2 — wire RunLogSheet on the *E heti edzés* cards)

**Pre-flight (real mode):** `cd backend && docker compose up -d && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`.

---

## File map
- Modify `frontend/src/lib/runningApi.ts` — add `logRunSession`
- Modify `frontend/src/data/runningHooks.ts` — add `logRunSession` mutation + `runSessions` invalidation
- Create `frontend/src/features/train/components/RunLogSheet.tsx`
- Modify `frontend/src/features/train/components/RunSessionCard.tsx` — optional `onLog`
- Modify `frontend/src/features/train/views/RunningView.tsx` — open RunLogSheet from E-heti cards
- Create `frontend/src/data/runningAgenda.ts` — pure: today's + weekly running sessions from the active block
- Modify `frontend/src/features/train/views/TrainTodayView.tsx` — running hero + pass running into the agenda
- Modify `frontend/src/features/train/components/WeeklyDayRow.tsx` — third run lane
- Tests: `runningAgenda.test.ts`, extend `RunningView.test.tsx` / add a Mai test

---

## Task 1: logRunSession (api + mutation)

**Files:** Modify `frontend/src/lib/runningApi.ts`, `frontend/src/data/runningHooks.ts`

- [ ] **Step 1: API call** — add to `runningApi`:
```ts
  logRunSession: (body: RunSessionLogRequest): Promise<RunSessionLogResponse> =>
    apiFetch<RunSessionLogResponse>('/api/train/run-sessions', { method: 'POST', body: JSON.stringify(body) }),
```
(`RunSessionLogRequest`/`RunSessionLogResponse` already type-exported.)

- [ ] **Step 2: Mutation on `useRunning()`** — add to `RunningData`:
```ts
  logRunSession: (body: RunSessionLogRequest, opts?: { onSuccess?: () => void }) => void
```
Implement (mock appends to the run-sessions cache, real POSTs + invalidates):
```ts
  const logMock = (body: RunSessionLogRequest): RunSessionLogResponse =>
    ({ id: `rs-${Math.round(performance.now())}`, ...body,
       completedRounds: body.completedRounds ?? null, rpeActual: body.rpeActual ?? null,
       hrRecoverySec: body.hrRecoverySec ?? null, sprintLandmark: body.sprintLandmark ?? null,
       durationMin: body.durationMin ?? null, notes: body.notes ?? null })
  const logMutation = useMutation({
    mutationFn: (body: RunSessionLogRequest) => mock
      ? Promise.resolve(qc.setQueryData<RunSessionLogResponse[]>(['running', 'runSessions'], (prev = []) => [logMock(body), ...prev]) as unknown as void)
      : runningApi.logRunSession(body).then(() => undefined),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['running', 'runSessions'] }) },
  })
  const logRunSession = useCallback((body: RunSessionLogRequest, opts?: { onSuccess?: () => void }) =>
    logMutation.mutate(body, { onSuccess: () => opts?.onSuccess?.() }), [logMutation])
```
Add `logRunSession` to the returned object; fold `logMutation.isPending` into `runningMutationPending`. Import `RunSessionLogRequest`/`RunSessionLogResponse` from `@/lib/runningApi`.

- [ ] **Step 3: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/lib/runningApi.ts frontend/src/data/runningHooks.ts
git commit -m "feat(fe): logRunSession mutation (POST run-sessions, mock+real) (mezo-axi)"
```

---

## Task 2: Running agenda helpers (pure)

**Files:** Create `frontend/src/data/runningAgenda.ts`

Derive the prescribed running session(s) for a given weekday from the active block's current week.

- [ ] **Step 1: Write**
```ts
import type { RunningBlockResponse, RunPrescribedSession, RunWeek } from '@/lib/runningApi'

/** The active block's current-week RunWeek, or null. */
export function currentWeekOf(block: RunningBlockResponse | null): RunWeek | null {
  if (!block) return null
  return block.structure.weeks.find((w) => w.weekNumber === block.currentWeek) ?? null
}

/** Prescribed running sessions for one weekday index (0=Hét..6=Vas) in the active block's current week. */
export function runSessionsForDay(block: RunningBlockResponse | null, dayIdx: number): RunPrescribedSession[] {
  const w = currentWeekOf(block)
  return w ? w.sessions.filter((s) => s.dayOfWeek === dayIdx) : []
}

/** Today's weekday index, Monday=0 (matches DAY_ORDER). */
export function todayIdx(now = new Date()): number {
  return (now.getDay() + 6) % 7
}
```
> `todayIdx` takes an injectable `now` so tests are deterministic without `Date.now()` stubbing gymnastics (the default arg uses `new Date()` only at call time, never at module scope).

- [ ] **Step 2: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/data/runningAgenda.ts
git commit -m "feat(fe): running agenda derivation (today/weekly prescribed sessions) (mezo-axi)"
```

---

## Task 3: RunLogSheet

**Files:** Create `frontend/src/features/train/components/RunLogSheet.tsx`

Mirror `SportLogSheet` (reuse its exported `NumberStep` + `ScaleRow`). Captures actuals for a known prescribed session (the caller supplies `blockId`, `weekNumber`, `sessionKey`, and a display label + whether it's a sprint, to show/hide the rounds field).

- [ ] **Step 1: Write**
```tsx
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { NumberStep, ScaleRow } from './SportLogSheet'
import type { RunSessionLogRequest } from '@/lib/runningApi'

export function RunLogSheet({ ctx, onClose, onSave }: {
  ctx: { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }
  onClose: () => void
  onSave?: (input: RunSessionLogRequest) => void
}) {
  const [rounds, setRounds] = useState(ctx.defaultRounds ?? 6)
  const [rpe, setRpe] = useState(9)
  const [hr, setHr] = useState(45)
  const [notes, setNotes] = useState('')

  const isoToday = new Date().toISOString().slice(0, 10)

  return (
    <Sheet onClose={onClose} labelledBy="run-log-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--info)' }}>Futás log · {ctx.label}</span>
              <div id="run-log-title" style={{ marginTop: 4 }}><Display size="md">Hogy ment?</Display></div>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="col gap-md">
            {ctx.isSprint && <NumberStep label="Teljesített körök" val={rounds} step={1} min={0} max={30} onChange={setRounds} color="var(--info)" />}
            <ScaleRow label="RPE · érzékelt nehézség" val={rpe} onChange={setRpe} color="var(--info)" />
            <NumberStep label="Pulzus-megnyugvás · mp" val={hr} step={5} min={0} max={300} onChange={setHr} />
            <div className="col gap-sm">
              <span className="label-mono">Jegyzet</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcionális"
                style={{ background: 'var(--surface-2)', padding: '12px 14px', fontSize: 14, color: 'var(--text-primary)',
                         clipPath: 'polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)' }} />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="notch-4 flex-1" onClick={() => {
              onSave?.({
                blockId: ctx.blockId, weekNumber: ctx.weekNumber, sessionKey: ctx.sessionKey, date: isoToday,
                completedRounds: ctx.isSprint ? rounds : null, rpeActual: rpe, hrRecoverySec: hr,
                sprintLandmark: null, durationMin: null, notes: notes || null,
              })
              close()
            }}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
```
> Match the `Sheet` render-prop signature from `SportLogSheet` exactly. Clamp values via `NumberStep` min/max so the payload never violates the contract (rpe 1–10 is enforced by the backend CHECK).

- [ ] **Step 2: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/features/train/components/RunLogSheet.tsx
git commit -m "feat(fe): RunLogSheet — run-session actuals logger (mezo-axi)"
```

---

## Task 4: Wire RunLogSheet into the Futás E-heti cards

**Files:** Modify `RunSessionCard.tsx`, `RunningView.tsx`

- [ ] **Step 1: `RunSessionCard`** — add an optional `onLog?: () => void` prop; render the existing "Naplózás ▸" affordance as a `<button>` calling `onLog` when provided (otherwise plain text). Keep presentational.

- [ ] **Step 2: `RunningView`** — in the *E heti edzés* segment, manage `const [logCtx, setLogCtx] = useState<{...} | null>(null)`; pass `onLog={() => setLogCtx({ blockId: activeBlock.id, weekNumber: activeBlock.currentWeek, sessionKey: session.key, label: session.label, isSprint: session.kind === 'sprint', defaultRounds: session.rounds ?? undefined })}` to each `RunSessionCard`. Render `{logCtx && <RunLogSheet ctx={logCtx} onClose={() => setLogCtx(null)} onSave={logRunSession} />}` (pull `logRunSession` from `useRunning()`).

- [ ] **Step 3: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/features/train/components/RunSessionCard.tsx frontend/src/features/train/views/RunningView.tsx
git commit -m "feat(fe): log a run from the Futás E-heti session cards (mezo-axi)"
```

---

## Task 5: Mai integration (hero card + weekly run lane)

**Files:** Modify `TrainTodayView.tsx`, `WeeklyDayRow.tsx`

- [ ] **Step 1: `WeeklyDayRow`** — extend `WeeklyAgendaDay` with `running: RunPrescribedSession[]` (default `[]`). After the volleyball lane, render a run lane per prescribed run session that day: a `<button>` row (mirror the gym/volleyball lane markup) with a run icon (`Icon name="train"` or a suitable one) tinted `var(--info)`, the session `label`, a small meta (`Sprint`/`Piramis` + "futás"), and (when `isToday`) a `log` chip → calls a new `onLogRun?: (s: RunPrescribedSession) => void` prop. Update `hasContent` to include `running.length`.

- [ ] **Step 2: `TrainTodayView`** — call `useRunning()` (for `activeRunningBlock`, `logRunSession`). Build the running lane into the agenda:
  - import `runSessionsForDay`, `todayIdx`, `currentWeekOf` from `@/data/runningAgenda`, `DAY_ORDER`.
  - in the `agenda` map, add `running: runSessionsForDay(activeRunningBlock, <dayIndex>)` — the day index is `DAY_ORDER.indexOf(d)`.
  - `today` run sessions = `runSessionsForDay(activeRunningBlock, todayIdx())`.
  - **Today's running hero card(s):** after the volleyball hero block, for each of today's run sessions render a blue `--run` hero `.card.notch-12` (left accent strip `var(--info)`, mirror the volleyball hero's structure) with eyebrow "Futás · ma", `<Display size="md">{label}</Display>`, a meta line (RPE target / rounds), and a `CtaGhost` "＋ Naplózd a futást" (info-tinted) → opens the RunLogSheet for that session.
  - Manage `const [runLogCtx, setRunLogCtx] = useState<...|null>(null)`; render `{runLogCtx && <RunLogSheet ctx={runLogCtx} onClose={() => setRunLogCtx(null)} onSave={logRunSession} />}`.
  - Pass `onLogRun` into each `WeeklyDayRow` to open the sheet from the weekly timeline too. Update the "X session" count to include running.
  - Update the weekly section eyebrow to "Heti terv · gym + futás + sport".
  - **Mock vs real:** `useRunning()` already dual-modes; in real mode with no active block, `activeRunningBlock` is null → no run hero, no run lanes (ghost-safe). No special-casing needed.

- [ ] **Step 3: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/features/train/views/TrainTodayView.tsx frontend/src/features/train/components/WeeklyDayRow.tsx
git commit -m "feat(fe): Mai — running hero card + weekly run lane + RunLogSheet (mezo-axi)"
```

---

## Task 6: Tests (both modes) + build

**Files:** Create `frontend/src/data/runningAgenda.test.ts`; extend a Mai/RunningView test

- [ ] **Step 1: `runningAgenda.test.ts`** (pure): with `runningBlocksMock`'s active block (currentWeek 3), `runSessionsForDay(active, 1)` returns the Kedd sprint session; `runSessionsForDay(active, 4)` the Péntek pyramid; `runSessionsForDay(active, 0)` is empty; `runSessionsForDay(null, 1)` is empty; `currentWeekOf(active).weekNumber === 3`; `todayIdx(new Date('2026-06-16'))` (a Tuesday) === 1.

- [ ] **Step 2: Component test** — in MOCK mode, render `TrainTodayView` (mirror its existing test harness if one exists, else mount with router + query wrapper) and assert: the weekly timeline shows a run lane (e.g. "Sprint" text appears in the gym+sport timeline), and — if today happens to be Kedd/Pén the hero shows; to avoid date-flakiness, assert the **weekly** run lane (date-independent) rather than the "today" hero. OR add a focused test that opens the RunLogSheet from a `RunSessionCard` in `RunningView` (E-heti) and asserts the sheet title "Hogy ment?" appears, then Mentés calls the mutation (mock cache grows — switch to Napló and assert a new entry, or just assert no crash). Keep assertions robust to the current date.

- [ ] **Step 3: Full both modes + build**
```bash
cd frontend
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```
All green + build. Fix any pre-existing test broken by the agenda/`WeeklyDayRow` prop change (e.g. a TrainTodayView test that constructs `WeeklyAgendaDay` without `running` — add `running: []`). Note fixes.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/data/runningAgenda.test.ts frontend/src/features/train  # + any updated test
git commit -m "test(fe): running agenda + Mai/log wiring (mezo-axi)"
```

---

## Done-when (R3 acceptance)
- Both test modes green + `pnpm build` succeeds.
- Mock mode: on a Kedd/Pén the Mai view shows a blue running hero with "＋ Naplózd a futást"; the weekly timeline always shows the run lane on Kedd + Pén; logging from Mai or the Futás E-heti card adds a Napló entry. Stacked with gym + volleyball heroes (decision #6).
- Real mode (manual): same against the `demodata` active block; a logged run persists (refresh shows it in Napló).
- No cross-load yet (R4).
- `bd close mezo-axi`; next: R4 (cross-load + polish).

## Self-review notes (author)
- **Spec coverage:** Mai running hero (stacked) + weekly run lane (spec §3 Mai; decision #6) ✓; RunLogSheet wired from Mai + Futás (spec §3) ✓; logRunSession mutation (spec §2/§3) ✓. Cross-load is R4.
- **Date-flakiness guard:** the "today" hero depends on the real date; tests assert the date-independent weekly lane / sheet wiring instead (Task 6 note).
- **Grep-before-invent:** the `Sheet` render-prop signature (Task 3 — copy SportLogSheet); whether a `TrainTodayView.test.tsx` exists + its harness (Task 6); the exact `WeeklyDayRow` lane markup to mirror (Task 5).
