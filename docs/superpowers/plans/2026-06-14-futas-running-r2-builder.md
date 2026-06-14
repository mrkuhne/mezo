# Futás R2 — Builder + Lifecycle Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make running blocks editable: a full-screen `RunningBlockBuilder` (`/train/futas/:id`) that edits the week→session→segment structure and runs the lifecycle (create / duplicate / activate / close / delete), persisting via the R0 endpoints. Wire the R1 *Tervek* segment to navigate into it.

**Architecture:** Mirror the mesocycle write path. Extend `runningApi` with the write calls; add mutations to `useRunning()` (mock = optimistic local cache update so the UI reacts; real = persist then invalidate). `RunningBlockBuilder` mirrors `MesocycleBuilder` (full-screen sibling route, sticky back, status-aware header, view switcher, status-dependent bottom actions). Structure editing: sprint `rounds`/rest via `CompactStepper`, pyramid work-segments via add/remove pills; "Mentés" PUTs the whole block. Create = POST a default-structure planned block, then open its builder.

**Tech Stack:** React 19, TanStack Query, react-router-dom, TS, the prototype.css token system.

**Driving bd:** mezo-wpb (under mezo-dy6). **Spec:** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md`. R1 shipped the read-only tab + `useRunning()` read hook + `runningApi` (GETs) + `RunningView` (3 segments) + `running.ts` mock.

**Read before coding:**
- `frontend/src/features/train/MesocycleBuilder.tsx` (the full-screen builder shell: sticky-top back, status eyebrow, view switcher, status-dependent CtaPrimary/CtaGhost actions, `useTrain` mutations + `mesoMutationPending`)
- `frontend/src/features/train/MesocyclePlanner.tsx` (create idiom; note it does NOT persist — for running we DO persist, simpler: POST a default block)
- `frontend/src/data/trainHooks.ts` (mutation idiom: mock no-op vs real persist+`invalidateQueries`; the `activate/close` mutations)
- `frontend/src/features/train/components/CompactStepper.tsx` (the ± stepper — reuse for `rounds`/rest)
- `frontend/src/features/train/views/RunningView.tsx` (R1 — the *Tervek* segment cards to wire navigation onto; the `RunActiveBlockCard`/`RunCompactBlockCard` locals)
- `.superpowers/brainstorm/31354-1781455249/content/futas-blocks-builder.html` (the builder mockup: weeks list, current week expanded, sprint rounds stepper, pyramid segment pills + "＋ szakasz", bottom Duplikál / Lezárás)
- `frontend/src/lib/runningApi.ts`, `frontend/src/data/runningHooks.ts`, `frontend/src/data/running.ts` (R1 outputs to extend)

---

## File map
- Modify `frontend/src/lib/runningApi.ts` — add create/update/activate/close/delete
- Modify `frontend/src/data/runningHooks.ts` — add mutations to `useRunning()` + `RunningData`
- Create `frontend/src/data/runningDraft.ts` — pure helpers: default new-block structure, duplicate, and structure-edit transforms (testable without React)
- Create `frontend/src/features/train/RunningBlockBuilder.tsx` — full-screen builder
- Create `frontend/src/features/train/components/RunWeekEditor.tsx` — one week's two sessions edited (stepper + pills)
- Modify `frontend/src/app/router.tsx` — add `/train/futas/:id` sibling route
- Modify `frontend/src/features/train/views/RunningView.tsx` — *Tervek*: add "＋ Új terv" CTA + navigate cards to the builder
- Create tests: `runningDraft.test.ts`, `RunningBlockBuilder.test.tsx`

---

## Task 1: Write API client methods

**Files:** Modify `frontend/src/lib/runningApi.ts`

- [ ] **Step 1: Add the write calls** to the `runningApi` object (mirror `trainApi`'s create/activate/close):
```ts
  create: (body: RunningBlockUpsertRequest): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>('/api/train/running-blocks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: RunningBlockUpsertRequest): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  activate: (id: string): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}/activate`, { method: 'POST' }),
  close: (id: string): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}/close`, { method: 'POST' }),
  remove: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/running-blocks/${id}`, { method: 'DELETE' }),
```
(`RunningBlockUpsertRequest` is already type-exported from R1.)

- [ ] **Step 2: Typecheck** `cd frontend && pnpm tsc -b` → exit 0.
- [ ] **Step 3: Commit** `git add frontend/src/lib/runningApi.ts && git commit -m "feat(fe): running write API (create/update/activate/close/delete) (mezo-wpb)"`

---

## Task 2: Draft helpers (pure, testable)

**Files:** Create `frontend/src/data/runningDraft.ts`

Pure functions that build/transform a `RunningBlockUpsertRequest` structure — no React, unit-testable.

- [ ] **Step 1: Write the helpers**
```ts
import type {
  RunningBlockResponse, RunningBlockUpsertRequest, RunningBlockStructureDto, RunWeek, RunPrescribedSession, RunSegment,
} from '@/lib/runningApi'

const warmup = (): RunSegment => ({ type: 'warmup', durationSec: 300, label: null })
const cooldown = (): RunSegment => ({ type: 'cooldown', durationSec: 300, label: null })

export function sprintSession(rounds: number, restSec: number): RunPrescribedSession {
  return { key: 'tue-sprint', dayOfWeek: 1, label: 'Sprint-intervallum', kind: 'sprint',
    rpeTarget: { min: 9, max: 10 }, rounds,
    segments: [warmup(), { type: 'work', durationSec: 15, label: null }, { type: 'rest', durationSec: restSec, label: null }, cooldown()] }
}
export function pyramidSession(workSecs: number[], restMul: number): RunPrescribedSession {
  const segs: RunSegment[] = [warmup()]
  for (const w of workSecs) { segs.push({ type: 'work', durationSec: w, label: null }); segs.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null }) }
  segs.push(cooldown())
  return { key: 'fri-pyramid', dayOfWeek: 4, label: 'Piramis-intervallum', kind: 'pyramid', rpeTarget: { min: 8, max: 9 }, rounds: null, segments: segs }
}
export function defaultWeek(n: number): RunWeek {
  return { weekNumber: n, phaseLabel: 'Alapozás', sessions: [sprintSession(5, 45), pyramidSession([15, 30, 45, 30, 15], 2)] }
}

/** A blank 4-week starter block (the "＋ Új terv" default). */
export function newDraft(startIso: string, endIso: string): RunningBlockUpsertRequest {
  return { title: 'Új futóterv', goal: '', kind: 'interval', startDate: startIso, endDate: endIso, weeks: 4, currentWeek: 0,
    summary: null, structure: { weeks: [defaultWeek(1), defaultWeek(2), defaultWeek(3), defaultWeek(4)] } }
}

/** Upsert payload from an existing block (for PUT / duplicate). */
export function toUpsert(b: RunningBlockResponse): RunningBlockUpsertRequest {
  return { title: b.title, goal: b.goal ?? '', kind: b.kind, startDate: b.startDate, endDate: b.endDate,
    weeks: b.weeks, currentWeek: b.currentWeek, summary: b.summary ?? null, structure: b.structure }
}
export function duplicateDraft(b: RunningBlockResponse): RunningBlockUpsertRequest {
  return { ...toUpsert(b), title: `${b.title} (másolat)`, currentWeek: 0 }
}

/** Immutable structure edits (return a NEW structure). weekNumber is 1-based, sessionKey selects the session. */
export function setSprintRounds(s: RunningBlockStructureDto, weekNumber: number, rounds: number): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'tue-sprint', (sess) => ({ ...sess, rounds: Math.max(1, rounds) }))
}
export function setSprintRest(s: RunningBlockStructureDto, weekNumber: number, restSec: number): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'tue-sprint', (sess) => ({
    ...sess, segments: sess.segments.map((g) => g.type === 'rest' ? { ...g, durationSec: Math.max(5, restSec) } : g) }))
}
export function setPyramidWork(s: RunningBlockStructureDto, weekNumber: number, workSecs: number[]): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'fri-pyramid', (sess) => {
    const restMul = 2 // keep rest = work×2 on edit (R2 default)
    const segs: RunSegment[] = [warmup()]
    for (const w of workSecs) { segs.push({ type: 'work', durationSec: w, label: null }); segs.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null }) }
    segs.push(cooldown())
    return { ...sess, segments: segs }
  })
}
function mapSession(s: RunningBlockStructureDto, weekNumber: number, key: string,
  fn: (sess: RunPrescribedSession) => RunPrescribedSession): RunningBlockStructureDto {
  return { weeks: s.weeks.map((w) => w.weekNumber !== weekNumber ? w
    : { ...w, sessions: w.sessions.map((sess) => sess.key === key ? fn(sess) : sess) }) }
}

/** Read helpers for the editor UI. */
export function sprintOf(w: RunWeek) { return w.sessions.find((s) => s.kind === 'sprint') ?? null }
export function pyramidOf(w: RunWeek) { return w.sessions.find((s) => s.kind === 'pyramid') ?? null }
export function workSecs(sess: RunPrescribedSession): number[] { return sess.segments.filter((g) => g.type === 'work').map((g) => g.durationSec) }
export function restSec(sess: RunPrescribedSession): number { return sess.segments.find((g) => g.type === 'rest')?.durationSec ?? 0 }
```
> Match the generated DTO nullability (`label?: string | null`, `rounds?: number | null`) — R1 confirmed `null` literals satisfy them.

- [ ] **Step 2: Typecheck** `pnpm tsc -b` → 0.
- [ ] **Step 3: Commit** `git add frontend/src/data/runningDraft.ts && git commit -m "feat(fe): running draft/structure-edit helpers (mezo-wpb)"`

---

## Task 3: Mutations on `useRunning()`

**Files:** Modify `frontend/src/data/runningHooks.ts`

Mirror `useTrain`'s mock-no-op / real-persist+invalidate idiom. Mock mode must update the local cache so the builder UI reacts (the read queries are seeded from `initialData`; use `queryClient.setQueryData`).

- [ ] **Step 1: Extend the hook**
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
// ...existing imports + RunningBlockUpsertRequest
```
Add to `RunningData`:
```ts
  saveRunningBlock: (id: string | null, body: RunningBlockUpsertRequest, opts?: { onSuccess?: (b: RunningBlockResponse) => void }) => void
  activateRunningBlock: (id: string) => void
  closeRunningBlock: (id: string) => void
  deleteRunningBlock: (id: string, opts?: { onSuccess?: () => void }) => void
  runningMutationPending: boolean
```
Implement inside `useRunning()` (after the queries):
```ts
  const qc = useQueryClient()
  const invalidate = () => { if (!mock) qc.invalidateQueries({ queryKey: ['running', 'blocks'] }) }

  // Mock: emulate the server so the UI reacts. id===null ⇒ create.
  const upsertMock = (id: string | null, body: RunningBlockUpsertRequest): RunningBlockResponse => {
    const block: RunningBlockResponse = {
      id: id ?? `rb-${Math.round(performance.now())}-${blockList.length}`,
      status: id ? (blockList.find(b => b.id === id)?.status ?? 'planned') : 'planned',
      ...body, goal: body.goal ?? null, summary: body.summary ?? null,
    }
    qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) =>
      id ? prev.map(b => b.id === id ? block : b) : [...prev, block])
    return block
  }
  const saveMutation = useMutation({
    mutationFn: (args: { id: string | null; body: RunningBlockUpsertRequest }) =>
      mock ? Promise.resolve(upsertMock(args.id, args.body))
           : (args.id ? runningApi.update(args.id, args.body) : runningApi.create(args.body)),
    onSuccess: invalidate,
  })
  const lifecycleMock = (id: string, status: 'active' | 'archived') => {
    qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) =>
      prev.map(b => b.id === id ? { ...b, status } : status === 'active' && b.status === 'active' ? { ...b, status: 'archived' } : b))
  }
  const activateMutation = useMutation({
    mutationFn: (id: string) => mock ? Promise.resolve(lifecycleMock(id, 'active')) : runningApi.activate(id), onSuccess: invalidate })
  const closeMutation = useMutation({
    mutationFn: (id: string) => mock ? Promise.resolve(lifecycleMock(id, 'archived')) : runningApi.close(id), onSuccess: invalidate })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => mock
      ? Promise.resolve(qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) => prev.filter(b => b.id !== id)) as unknown as void)
      : runningApi.remove(id),
    onSuccess: invalidate })

  const saveRunningBlock = useCallback((id: string | null, body: RunningBlockUpsertRequest, opts?: { onSuccess?: (b: RunningBlockResponse) => void }) =>
    saveMutation.mutate({ id, body }, { onSuccess: (b) => { if (b) opts?.onSuccess?.(b) } }), [saveMutation])
  const activateRunningBlock = useCallback((id: string) => activateMutation.mutate(id), [activateMutation])
  const closeRunningBlock = useCallback((id: string) => closeMutation.mutate(id), [closeMutation])
  const deleteRunningBlock = useCallback((id: string, opts?: { onSuccess?: () => void }) => deleteMutation.mutate(id, { onSuccess: () => opts?.onSuccess?.() }), [deleteMutation])
```
Name the queried list `blockList` (rename the existing `list` const) so the mock helpers can read it. Add the new fields to the returned object and set `runningMutationPending: saveMutation.isPending || activateMutation.isPending || closeMutation.isPending || deleteMutation.isPending`.
> `performance.now()` for mock ids avoids `Date.now()`/`Math.random()`. The `as unknown as void` on the delete mock is to satisfy the mutation's `Promise<void>` type — keep it localized.

- [ ] **Step 2: Typecheck** `pnpm tsc -b` → 0. (RunningView still compiles — it only reads the existing fields.)
- [ ] **Step 3: Commit** `git add frontend/src/data/runningHooks.ts && git commit -m "feat(fe): running block mutations on useRunning (mock+real) (mezo-wpb)"`

---

## Task 4: RunningBlockBuilder + week editor + route

**Files:** Create `RunningBlockBuilder.tsx`, `components/RunWeekEditor.tsx`; modify `router.tsx`

- [ ] **Step 1: `RunWeekEditor.tsx`** — edits one `RunWeek`'s two sessions. Props `{ week: RunWeek; onChange: (next: RunningBlockStructureDto) => void; structure: RunningBlockStructureDto }` — actually simpler: pass the whole structure + weekNumber + the edit callbacks. Concretely props `{ structure, weekNumber, onStructure }: { structure: RunningBlockStructureDto; weekNumber: number; onStructure: (s: RunningBlockStructureDto) => void }`. Render:
  - **Sprint** (`sprintOf(week)`): a `CompactStepper` for `rounds` (label "kör", step 1, integer) → `onStructure(setSprintRounds(structure, weekNumber, n))`; a second `CompactStepper` for `restSec(sprint)` (label "mp pihenő", step 5, integer) → `setSprintRest`.
  - **Pyramid** (`pyramidOf(week)`): the `workSecs(pyramid)` as a row of pills; an "＋ szakasz" pill appends a default `30` and a "−" affordance per pill removes it → `setPyramidWork(structure, weekNumber, nextWorkSecs)`. (Editing each value is optional for R2; add/remove + a couple of preset durations is enough — keep it simple, e.g. tapping a pill cycles 15→30→45→60→15.)
  Read the current `week` from `structure.weeks.find(w => w.weekNumber === weekNumber)`. Style mirrors the mockup `futas-blocks-builder.html` (seg-pills, stepboxes) with `--info` accent.

- [ ] **Step 2: `RunningBlockBuilder.tsx`** — mirror `MesocycleBuilder`:
  - `const { id } = useParams()`; `useRunning()` for `runningBlocks`, `saveRunningBlock`, `activateRunningBlock`, `closeRunningBlock`, `deleteRunningBlock`, `runningMutationPending`; `useNavigate()`.
  - Find `block = runningBlocks.find(b => b.id === id)`. If none → not-found card with `← Futás` back (to `/train/futas`).
  - Local draft state: `const [draft, setDraft] = useState<RunningBlockUpsertRequest>(() => toUpsert(block))` — seed from the block; reset via `useEffect` when `block.id` changes. Edits mutate `draft.structure` through the Task-2 helpers (`onStructure: (s) => setDraft(d => ({ ...d, structure: s }))`), plus title/goal text inputs bound to `draft`.
  - Sticky-top back (`← Futás` → `/train/futas`), status eyebrow (Aktív · Hét x/y · / Tervezett / Archív), `PageTitle` = an editable title input styled as the title (or a plain input above), goal input.
  - A **week selector** (chips 1..weeks, default = `currentWeek` or 1) + the `<RunWeekEditor>` for the selected week.
  - Bottom actions (status-dependent, mirror MesocycleBuilder):
    - always: **Mentés** `CtaPrimary` → `saveRunningBlock(block.id, draft, { onSuccess: () => navigate('/train/futas') })`, disabled while `runningMutationPending`.
    - **Duplikál** `CtaGhost` → `saveRunningBlock(null, duplicateDraft(block), { onSuccess: () => navigate('/train/futas') })`.
    - `planned` → **Aktiválás** `CtaPrimary` → `activateRunningBlock(block.id)` then navigate back.
    - `active` → **Blokk lezárása** `CtaGhost` (error-tinted) → `closeRunningBlock(block.id)` then back.
    - **Törlés** `CtaGhost` (error-tinted) → `deleteRunningBlock(block.id, { onSuccess: () => navigate('/train/futas') })`.
  - Keep the file focused; extract the actions block into a local component if it grows.

- [ ] **Step 3: Route** — `router.tsx`: add a sibling route (next to the existing `train/session`, `train/mesocycles/:id`):
```tsx
import { RunningBlockBuilder } from '@/features/train/RunningBlockBuilder'
// ...
      { path: 'train/futas/:id', element: <RunningBlockBuilder /> },
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b   # exit 0
git add frontend/src/features/train/RunningBlockBuilder.tsx frontend/src/features/train/components/RunWeekEditor.tsx frontend/src/app/router.tsx
git commit -m "feat(fe): RunningBlockBuilder — structure edit + lifecycle (mezo-wpb)"
```

---

## Task 5: Wire the Tervek segment to the builder

**Files:** Modify `frontend/src/features/train/views/RunningView.tsx`

- [ ] **Step 1: Add navigation + create** — `useNavigate()` in RunningView; in the **Tervek** (`blocks`) segment:
  - add a header **`＋ Új terv`** chip (in the `page-header`, like Sport/Mesocycle libraries) → creates a default block and opens its builder:
    ```tsx
    const { saveRunningBlock } = useRunning()
    const navigate = useNavigate()
    const onNew = () => {
      const start = new Date().toISOString().slice(0, 10)
      const end = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10)
      saveRunningBlock(null, newDraft(start, end), { onSuccess: (b) => navigate(`/train/futas/${b.id}`) })
    }
    ```
    (import `newDraft` from `@/data/runningDraft`.)
  - make each block card (active hero + planned/compact rows) navigate to `/train/futas/${block.id}` on click (wrap in a button or add onClick). The active hero gets a "Builder ▸" affordance like the mockup.
  - **Only show the `＋ Új terv` chip when `view === 'blocks'`** (or always in the header — match MesocycleLibraryView which always shows `+ Új`). Keep it on the blocks segment for clarity.

- [ ] **Step 2: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/features/train/views/RunningView.tsx
git commit -m "feat(fe): wire Tervek cards + Új terv to RunningBlockBuilder (mezo-wpb)"
```

---

## Task 6: Tests (both modes) + build

**Files:** Create `frontend/src/data/runningDraft.test.ts`, `frontend/src/features/train/RunningBlockBuilder.test.tsx`

- [ ] **Step 1: `runningDraft.test.ts`** (pure unit — no React, no mode): assert `newDraft` yields 4 weeks each with a sprint+pyramid session; `setSprintRounds` changes only the targeted week's sprint rounds and is immutable (input unchanged); `setPyramidWork` rebuilds segments with rest=work×2 and a warmup+cooldown; `duplicateDraft` appends "(másolat)" and resets currentWeek to 0; `workSecs`/`restSec`/`sprintOf`/`pyramidOf` read correctly.

- [ ] **Step 2: `RunningBlockBuilder.test.tsx`** (MOCK mode — `vi.stubEnv('VITE_USE_MOCK','true')`): render the builder for the active mock block id (`rb-active-01`) inside a `MemoryRouter` with `initialEntries={['/train/futas/rb-active-01']}` + the route definition (or render `<RunningBlockBuilder>` directly with a `Routes`/`Route path="/train/futas/:id"` wrapper + the QueryWrapper). Assert: the block title "Robbanékonyság 01" renders; the sprint `rounds` stepper shows the week's value; clicking the stepper "+" updates the displayed value; the **Mentés** + **Blokk lezárása** (active) actions are present. (You don't need to assert persistence across navigation — that's the mutation's job; assert the buttons exist and clicking Mentés calls navigate, which you can check by spying on a mock navigate or asserting no crash.) Match the render harness used by `MesocyclePlanner.test.tsx` / `MesoExercises.test.tsx` (read one first for the router+query mounting pattern).

- [ ] **Step 3: Full both modes + build**
```bash
cd frontend
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```
All green + build success. If a pre-existing test broke, fix minimally and note it.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/data/runningDraft.test.ts frontend/src/features/train/RunningBlockBuilder.test.tsx
git commit -m "test(fe): running draft helpers + builder (mock) (mezo-wpb)"
```

---

## Done-when (R2 acceptance)
- Both test modes green + `pnpm build` succeeds.
- Mock mode: from *Tervek*, `＋ Új terv` creates a draft and opens the builder; editing sprint rounds / pyramid segments + **Mentés** updates the block (visible back in *Tervek* / *E heti edzés*); Aktiválás/Lezárás/Duplikál/Törlés work against the mock cache.
- Real mode (manual, `demodata` backend): the same against persisted data — refresh shows the saved structure; activate archives the prior active block.
- No Mai changes, no cross-load (R3–R4).
- `bd close mezo-wpb`; next: R3 (Mai integration).

## Self-review notes (author)
- **Spec coverage:** Builder full-screen route + structure edit + lifecycle (spec §3 Builder) ✓; create via builder-first default block (spec decision #4) ✓; mock+real mutations with unchanged read signatures (spec §3/§9) ✓. Mai/cross-load are R3–R4.
- **Scope guard:** R2 edits sprint rounds/rest + pyramid work-segments + block title/goal — a deliberately bounded structure editor (not a free per-segment editor); the spec's builder is "edit the weeks → sessions → segments", satisfied at a practical granularity. Per-week phase-label editing and arbitrary session add/remove are out (YAGNI; the seeded/duplicated shape has the 2 canonical sessions).
- **Grep-before-invent flags:** the test render/mount harness for a `:id` route (Task 6 — copy from `MesocyclePlanner.test.tsx`); `CtaPrimary`/`CtaGhost` props (Task 4 — read `@/components/ui/Cta`); the exact `RunningView` Tervek-card locals to attach onClick to (Task 5).
