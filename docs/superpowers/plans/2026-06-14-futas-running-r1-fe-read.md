# Futás R1 — Frontend Mock Hooks + Read-Only Futás Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the 6th Train tab **Futás** as a read-only view (3 segments: *E heti edzés · Napló · Tervek*), fed by a new `useRunning()` hook that works in both mock and real mode against the R0 backend.

**Architecture:** Mirror the existing Train data wiring. New `src/lib/runningApi.ts` (typed client over `api.gen.ts`), `src/data/running.ts` (mock data shaped exactly like the generated DTOs), `src/data/runningHooks.ts` (`useRunning()` — TanStack Query, `isMockMode()` branch, `initialData` for mock), re-exported from `src/data/hooks.ts`. The view mirrors `SportView` (own `.page-header`, hero card, 3-button switcher) using the real design tokens. Read-only: no writes, no Builder, no Mai, no cross-load (those are R2–R4).

**Tech Stack:** React 19, Vite, TypeScript, Tailwind v4 + the prototype.css token system, TanStack Query, react-router-dom, Vitest + Testing Library.

**Driving bd:** mezo-yqa (under mezo-dy6). **Spec:** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md`.

**Visual reference (local, gitignored — read from disk):** `.superpowers/brainstorm/31354-1781455249/content/futas-app-faithful.html` (the "E heti edzés" landing) and `futas-blocks-builder.html` (the "Tervek" library). These encode the exact tokens/classes/layout. The accent is `--info` (`#60A5FA`), aliased `--run`.

**Read before coding:**
- `frontend/src/data/trainHooks.ts` (the mock/real query pattern, `initialData`, date mapping idiom)
- `frontend/src/lib/trainApi.ts` (typed client idiom)
- `frontend/src/data/hooks.ts` (boundary re-export)
- `frontend/src/features/train/views/SportView.tsx` (view structure: page-header, hero, 3-button switcher, sub-views, ghost states)
- `frontend/src/features/train/tabs.ts` + `src/app/router.tsx` (tab + route wiring)
- `frontend/src/styles/prototype.css` (tokens/classes: `.card`, `.chip`, `.eyebrow`, `.page-title`, `.notch-*`, `.reta-bar`, `.subnav`)
- generated running types in `frontend/src/lib/api.gen.ts` (`components['schemas']['RunningBlockResponse']` etc.)

**Pre-flight (real-mode dev/test needs the backend + seed):**
```bash
cd backend && docker compose up -d && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # :8090, seeds 3 blocks
# (separate shell) frontend tests run against this; mock-mode tests need no backend
```

---

## File map
- Create `frontend/src/lib/runningApi.ts` — typed client (GET blocks, GET run-sessions) + DTO type re-exports
- Create `frontend/src/data/running.ts` — mock blocks (active 8-week + planned + archived) + mock run-session logs, shaped as the generated DTOs
- Create `frontend/src/data/runningHooks.ts` — `useRunning()`
- Modify `frontend/src/data/hooks.ts` — `export { useRunning } from './runningHooks'`
- Modify `frontend/src/features/train/tabs.ts` — add the Futás tab
- Modify `frontend/src/app/router.tsx` — add the `futas` child route
- Create `frontend/src/features/train/views/RunningView.tsx` — the 3-segment view
- Create `frontend/src/features/train/components/RunWeekStrip.tsx` — the 8-segment week strip (reta-bar style)
- Create `frontend/src/features/train/components/RunSessionCard.tsx` — one prescribed session card (interval pills + RPE tag)
- Create test files (below)

---

## Task 1: Typed running API client

**Files:** Create `frontend/src/lib/runningApi.ts`

- [ ] **Step 1: Write the client** (mirror `trainApi.ts`; R1 needs only the two GETs — writes land in R2)

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type RunningBlockResponse = components['schemas']['RunningBlockResponse']
export type RunningBlockUpsertRequest = components['schemas']['RunningBlockUpsertRequest']
export type RunningBlockStructureDto = components['schemas']['RunningBlockStructureDto']
export type RunWeek = components['schemas']['RunWeek']
export type RunPrescribedSession = components['schemas']['RunPrescribedSession']
export type RunSegment = components['schemas']['RunSegment']
export type RpeTarget = components['schemas']['RpeTarget']
export type RunSessionLogResponse = components['schemas']['RunSessionLogResponse']
export type RunSessionLogRequest = components['schemas']['RunSessionLogRequest']

export const runningApi = {
  blocks: (): Promise<RunningBlockResponse[]> =>
    apiFetch<RunningBlockResponse[]>('/api/train/running-blocks'),
  runSessions: (): Promise<RunSessionLogResponse[]> =>
    apiFetch<RunSessionLogResponse[]>('/api/train/run-sessions'),
}
```

- [ ] **Step 2: Typecheck** — `cd frontend && pnpm tsc -b --noEmit` (or `pnpm build` later). Expect no errors. If `components['schemas']['RunningBlockResponse']` is missing, run `pnpm generate:api` first (the merged `api/openapi.yml` already has it from R0; the FE `api.gen.ts` was regenerated and committed in R0 — verify the types exist with `grep -n RunningBlockResponse src/lib/api.gen.ts`).

- [ ] **Step 3: Commit**
```bash
git add frontend/src/lib/runningApi.ts
git commit -m "feat(fe): running API client + DTO types (mezo-yqa)"
```

---

## Task 2: Mock running data

**Files:** Create `frontend/src/data/running.ts`

Mock objects shaped EXACTLY like the generated DTOs (so mock and real are interchangeable; dates are ISO strings like the backend, formatted in the view). Provide an active 8-week block (same progression as the R0 seed), a planned and an archived block, plus 2 run-session logs.

- [ ] **Step 1: Write the mock** (build the 8-week structure with helpers so it stays readable)

```ts
import type {
  RunningBlockResponse,
  RunSessionLogResponse,
  RunWeek,
  RunPrescribedSession,
} from '@/lib/runningApi'

// dayOfWeek: 0=Hét..6=Vas. Tue=1, Fri=4.
function sprintSession(rounds: number, restSec: number): RunPrescribedSession {
  return {
    key: 'tue-sprint', dayOfWeek: 1, label: 'Sprint-intervallum', kind: 'sprint',
    rpeTarget: { min: 9, max: 10 }, rounds,
    segments: [
      { type: 'warmup', durationSec: 300, label: null },
      { type: 'work', durationSec: 15, label: null },
      { type: 'rest', durationSec: restSec, label: null },
      { type: 'cooldown', durationSec: 300, label: null },
    ],
  }
}
function pyramidSession(workSecs: number[], restMul: number): RunPrescribedSession {
  const segments = [{ type: 'warmup', durationSec: 300, label: null as string | null }]
  for (const w of workSecs) {
    segments.push({ type: 'work', durationSec: w, label: null })
    segments.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null })
  }
  segments.push({ type: 'cooldown', durationSec: 300, label: null })
  return {
    key: 'fri-pyramid', dayOfWeek: 4, label: 'Piramis-intervallum', kind: 'pyramid',
    rpeTarget: { min: 8, max: 9 }, rounds: null, segments,
  }
}
function week(n: number, phase: string, sprintRounds: number, sprintRest: number, pyramid: number[], pyrMul: number): RunWeek {
  return { weekNumber: n, phaseLabel: phase, sessions: [sprintSession(sprintRounds, sprintRest), pyramidSession(pyramid, pyrMul)] }
}

const activeWeeks: RunWeek[] = [
  week(1, 'Alapozás', 5, 45, [15, 30, 45, 30, 15], 2),
  week(2, 'Alapozás', 5, 45, [15, 30, 45, 30, 15], 2),
  week(3, 'Alapozás', 6, 45, [15, 30, 45, 45, 30, 15], 2),
  week(4, 'Alapozás', 6, 45, [15, 30, 45, 45, 30, 15], 2),
  week(5, 'Röpi-specifikus', 8, 45, [15, 30, 45, 60, 45, 30, 15], 2),
  week(6, 'Röpi-specifikus', 8, 45, [15, 30, 45, 60, 45, 30, 15], 2),
  week(7, 'Röpi-specifikus', 8, 30, [15, 30, 45, 60, 45, 30, 15], 1.5),
  week(8, 'Röpi-specifikus', 8, 30, [15, 30, 45, 60, 45, 30, 15], 1.5),
]

export const runningBlocksMock: RunningBlockResponse[] = [
  {
    id: 'rb-archived-01', title: 'Téli base 02', goal: 'aerob bázis', kind: 'interval',
    status: 'archived', startDate: '2026-02-12', endDate: '2026-04-09', weeks: 8, currentWeek: 8,
    summary: '7/10 · pulzus-megnyugvás −18mp javult',
    structure: { weeks: [week(1, 'Bázis', 4, 60, [15, 30, 15], 2)] },
  },
  {
    id: 'rb-active-01', title: 'Robbanékonyság 01', goal: 'sprint-állóképesség röpihez', kind: 'interval',
    status: 'active', startDate: '2026-06-16', endDate: '2026-08-11', weeks: 8, currentWeek: 3,
    summary: null, structure: { weeks: activeWeeks },
  },
  {
    id: 'rb-planned-01', title: '5K-alapozó', goal: 'aerob bázis', kind: 'interval',
    status: 'planned', startDate: '2026-08-14', endDate: '2026-09-24', weeks: 6, currentWeek: 0,
    summary: null, structure: { weeks: [week(1, 'Bázis', 4, 60, [30, 45, 30], 2)] },
  },
]

export const runSessionsMock: RunSessionLogResponse[] = [
  { id: 'rs-01', blockId: 'rb-active-01', weekNumber: 3, sessionKey: 'tue-sprint', date: '2026-06-30',
    completedRounds: 6, rpeActual: 9, hrRecoverySec: 42, sprintLandmark: 'túl a 2. lámpaoszlopon', durationMin: 22, notes: null },
  { id: 'rs-02', blockId: 'rb-active-01', weekNumber: 2, sessionKey: 'fri-pyramid', date: '2026-06-26',
    completedRounds: null, rpeActual: 8, hrRecoverySec: 50, sprintLandmark: null, durationMin: 26, notes: 'jó tempó' },
]
```

> Note the `segments` array in `pyramidSession`/`sprintSession`: ensure the element type matches the generated `RunSegment` (`{ type: string; durationSec: number; label?: string | null }`). If TS complains about the `label: null` vs optional, cast the array `as RunSegment[]` or set `label: null` consistently — match whatever `api.gen.ts` declares (nullable vs optional).

- [ ] **Step 2: Typecheck** — `cd frontend && pnpm tsc -b --noEmit`. Fix any DTO-shape mismatch (the generated nullability is the source of truth).

- [ ] **Step 3: Commit**
```bash
git add frontend/src/data/running.ts
git commit -m "feat(fe): running mock data (active 8-week + planned + archived + logs) (mezo-yqa)"
```

---

## Task 3: `useRunning()` hook + boundary re-export

**Files:** Create `frontend/src/data/runningHooks.ts`; Modify `frontend/src/data/hooks.ts`

- [ ] **Step 1: Write the hook** (mirror the `useTrain` query idiom: `isMockMode()`, `initialData` for mock, `staleTime` not needed)

```ts
import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { runningApi, type RunningBlockResponse, type RunSessionLogResponse } from '@/lib/runningApi'
import { runningBlocksMock, runSessionsMock } from './running'

export type RunningData = {
  runningBlocks: RunningBlockResponse[]
  activeRunningBlock: RunningBlockResponse | null
  runSessions: RunSessionLogResponse[]
  /** True while the blocks query is still loading (real mode) — views ghost-guard. */
  runningPending: boolean
}

export function useRunning(): RunningData {
  const mock = isMockMode()
  const { data: blocks, isPending } = useQuery({
    queryKey: ['running', 'blocks'],
    queryFn: mock ? async () => runningBlocksMock : () => runningApi.blocks(),
    initialData: mock ? runningBlocksMock : undefined,
  })
  const { data: sessions } = useQuery({
    queryKey: ['running', 'runSessions'],
    queryFn: mock ? async () => runSessionsMock : () => runningApi.runSessions(),
    initialData: mock ? runSessionsMock : undefined,
  })
  const list = blocks ?? []
  return {
    runningBlocks: list,
    activeRunningBlock: list.find((b) => b.status === 'active') ?? null,
    runSessions: sessions ?? [],
    runningPending: !mock && isPending,
  }
}
```

- [ ] **Step 2: Re-export from the boundary** — in `frontend/src/data/hooks.ts`, after the `export { useTrain } from './trainHooks'` line add:
```ts
export { useRunning } from './runningHooks'
```

- [ ] **Step 3: Typecheck** — `pnpm tsc -b --noEmit`. Expect clean.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/data/runningHooks.ts frontend/src/data/hooks.ts
git commit -m "feat(fe): useRunning hook on the data boundary (mezo-yqa)"
```

---

## Task 4: Tab + route wiring

**Files:** Modify `frontend/src/features/train/tabs.ts`, `frontend/src/app/router.tsx`

- [ ] **Step 1: Add the Futás tab** — in `tabs.ts`, insert into `TRAIN_TABS` after the `sport` entry:
```ts
  { id: 'futas', to: '/train/futas', label: 'Futás' },
```
(Final order: Mai · GYM · Sport · Futás · Gyakorlatok · Mesociklusok.)

- [ ] **Step 2: Add the route** — in `router.tsx`, import the view at the top with the other train views:
```ts
import { RunningView } from '@/features/train/views/RunningView'
```
and add a child to the `train` route's `children` array (after the `sport` child):
```ts
          { path: 'futas', element: <RunningView /> },
```

- [ ] **Step 3: Build check deferred to Task 6** (RunningView doesn't exist yet — this task will not typecheck alone; that's fine, Task 5 creates the view, then Task 6 builds). Commit together with Task 5, OR create a minimal placeholder `RunningView` now. **Choose:** create the route in Task 5's commit instead to keep each commit compiling. → Move Steps 1–2 edits into Task 5's commit. (Do the edits now but commit in Task 5.)

---

## Task 5: RunningView + components (the 3 read-only segments)

**Files:** Create `frontend/src/features/train/views/RunningView.tsx`, `components/RunWeekStrip.tsx`, `components/RunSessionCard.tsx` (+ the Task 4 tab/route edits committed here)

**Visual contract:** read `.superpowers/brainstorm/31354-1781455249/content/futas-app-faithful.html` and `futas-blocks-builder.html` from disk for exact layout, and mirror `SportView.tsx` for component idioms (page-header with `Eyebrow brand` + `PageTitle` + a header chip; a hero `.card.notch-12` with left accent strip + radial glow; a 3-button view switcher; `GhostState` when empty). Use the running accent: define a local `const RUN = 'var(--info)'` and use it where SportView uses `--cat-tendency`.

- [ ] **Step 1: `RunWeekStrip.tsx`** — the 8-segment progress strip (reta-bar style), props `{ weeks: number; currentWeek: number }`:
```tsx
export function RunWeekStrip({ weeks, currentWeek }: { weeks: number; currentWeek: number }) {
  return (
    <div className="row" style={{ gap: 3, height: 6, marginTop: 12 }}>
      {Array.from({ length: weeks }, (_, i) => {
        const n = i + 1
        const state = n < currentWeek ? 'past' : n === currentWeek ? 'now' : 'future'
        return (
          <span key={n} style={{
            flex: 1, borderRadius: 1,
            background: state === 'now' ? 'var(--info)' : state === 'past' ? 'color-mix(in srgb, var(--info) 50%, var(--surface-2))' : 'var(--surface-2)',
            opacity: state === 'future' ? 0.5 : 1,
            boxShadow: state === 'now' ? '0 0 8px var(--info)' : 'none',
          }} />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: `RunSessionCard.tsx`** — one prescribed session as a card with interval pills + RPE tag. Props `{ session: RunPrescribedSession }`. Render: label-mono day (derive from `dayOfWeek` via `DAY_ORDER` from `@/data/train`), the session `label`, an RPE tag (`RPE {min}–{max}`), and interval "pills" summarising the segments. For a `sprint` session show `{rounds}× · {workSec}mp` + `{restSec}mp séta` + warmup/cooldown pills; for `pyramid` show the work-second sequence joined by `／`. Mirror the pill styling from the mockup (`.seg-pill`, `.seg-pill.work`, `.seg-pill.warm`) — inline the styles using tokens (`--info` for work, `--warning` for warmup, `--surface-2` for rest). Keep it a pure presentational component.

- [ ] **Step 3: `RunningView.tsx`** — the shell:
  - `page-header`: `<Eyebrow brand>Train · Futás</Eyebrow>` + `<PageTitle>Intervallum</PageTitle>`. (No `+ Új` chip in R1 — that's R2's Builder. Optionally a disabled-looking placeholder is NOT needed; omit.)
  - `useRunning()` for data; ghost-guard with `GhostState` when `activeRunningBlock == null` (E heti edzés) / empty lists.
  - 3-button switcher (state `view: 'week' | 'log' | 'blocks'`, default `'week'`), labels **E heti edzés / Napló / Tervek**, styled like SportView's switcher but with `--info` accent.
  - **`week` view:** hero card for the active block (eyebrow = block.title's style label or "Sprint-alapozó blokk", `Display` "Hét {currentWeek} / {weeks}", phase label, `<RunWeekStrip>`, a small stat row). Below it: the current week's sessions (`structure.weeks.find(w => w.weekNumber === currentWeek)?.sessions ?? []`) each in a `<RunSessionCard>`. If no active block → `GhostState` ("Nincs aktív futóterved — a Tervek fülön aktiválj egyet.").
  - **`log` view:** list `runSessions` newest-first; each row shows date (format ISO via `huMonthDayDow` from `@/lib/dates`), session label (map `sessionKey` → "Sprint"/"Piramis"), `RPE {rpeActual}`, `{completedRounds} kör` when present, `{hrRecoverySec}mp pulzus` when present. Empty → italic "Még nincs logolt futás." (mirror SportLogView).
  - **`blocks` view (Tervek):** three sections **Aktív / Tervezett / Archív** (filter by status), each a card list. Active uses the same hero treatment (week strip + `aktív` status chip); planned/archived are compact rows (title, date range `huMonthDay(start)–huMonthDay(end)`, weeks, status chip; archived shows `summary`). Mirror `MesocycleLibraryView`'s active/planned/archived sectioning. **No "＋ Új terv" CTA and no navigation to a Builder in R1** (R2) — these are static read-only cards.

  Keep `RunningView.tsx` focused; if it grows past ~250 lines, extract the three sub-views into local components within the file (like SportView does with `SportWeekView`/`SportLogView`/`SportCrossloadView`).

- [ ] **Step 4: Commit** (including the Task 4 tab + route edits)
```bash
cd frontend && pnpm tsc -b --noEmit   # must be clean
git add frontend/src/features/train/views/RunningView.tsx \
        frontend/src/features/train/components/RunWeekStrip.tsx \
        frontend/src/features/train/components/RunSessionCard.tsx \
        frontend/src/features/train/tabs.ts frontend/src/app/router.tsx
git commit -m "feat(fe): Futás tab — read-only RunningView (E heti edzés / Napló / Tervek) (mezo-yqa)"
```

---

## Task 6: Tests (both modes) + build

**Files:** Create `frontend/src/features/train/views/RunningView.test.tsx`; optionally `frontend/src/data/runningHooks.test.tsx`

Mirror the existing train tests (e.g. `src/features/train/views/TrainTodayView.test.tsx`, `src/data/trainHooks.test.tsx`) for the render harness (QueryClientProvider + MemoryRouter + `vi.stubEnv('VITE_USE_MOCK', ...)`). Look at one before writing to copy the exact harness/util (there is likely a test render helper).

- [ ] **Step 1: Write `RunningView.test.tsx`** covering (in MOCK mode — `vi.stubEnv('VITE_USE_MOCK', 'true')`):
  - default `week` view renders the active block hero ("Hét 3 / 8") and the 2 current-week session cards (asserts both "Sprint-intervallum" and "Piramis-intervallum" present).
  - switching to **Napló** lists the mock run sessions (asserts a date / "RPE 9" appears).
  - switching to **Tervek** shows Aktív/Tervezett/Archív with the three mock block titles ("Robbanékonyság 01", "5K-alapozó", "Téli base 02").
  And one REAL-mode-empty test (`vi.stubEnv('VITE_USE_MOCK', 'false')` with the running queries returning `[]`, mocking `runningApi` via `vi.mock('@/lib/runningApi', ...)`) asserting the ghost state renders (no crash on empty). Match how `trainHooks.test.tsx` mocks the api module.

- [ ] **Step 2: Run mock-mode tests** — `cd frontend && pnpm test -- RunningView` (default real mode) AND `VITE_USE_MOCK=true pnpm test -- RunningView`. Iterate until green in both.

- [ ] **Step 3: Full test both modes + build**
```bash
cd frontend
pnpm test            # REAL mode default — all green (running real-mode tests use mocked api)
VITE_USE_MOCK=true pnpm test   # MOCK mode — all green
pnpm build           # tsc -b && vite build — must succeed
```
Paste the final pass counts + build result. If a pre-existing test depends on tab count / nav (e.g. `train.nav.test.tsx`), update it to include the new Futás tab (navigation chrome, not data) — note it in the commit.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/features/train/views/RunningView.test.tsx frontend/src/data/runningHooks.test.tsx
# plus any nav test updated for the 6th tab
git commit -m "test(fe): Futás tab read views — mock + real-empty (mezo-yqa)"
```

---

## Done-when (R1 acceptance)
- `pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` (mock) both green; `pnpm build` succeeds.
- In mock mode the Futás tab renders all three segments with the mock plan (active "Robbanékonyság 01", week 3 sessions, log, library).
- In real mode against the `demodata` backend, the tab shows the seeded 3 blocks + the active block's week-3 sessions (manual check: `VITE_USE_MOCK=false pnpm dev`, open `/train/futas`).
- No writes, no Builder, no Mai, no cross-load (R2–R4).
- `bd close mezo-yqa`; next: R2 (Builder + lifecycle write).

## Self-review notes (author)
- **Spec coverage:** Futás tab + 3 read segments (spec §3 RunningView read part) ✓; `useRunning` boundary hook (spec §3) ✓; mock+real (spec §9, Phase-2 dual-mode) ✓. Builder/write, Mai, cross-load are explicitly R2–R4.
- **Grep-before-invent flags** (lookups, not placeholders): exact `api.gen.ts` nullability for `RunSegment.label`/`rounds` (Tasks 2); the existing test render harness/util (Task 6); whether `train.nav.test.tsx` asserts tab count (Task 6). The data-layer code is complete; the view components are specified structurally against `SportView` + the saved mockups because they are presentational and must match the established visual idiom rather than invented markup.
