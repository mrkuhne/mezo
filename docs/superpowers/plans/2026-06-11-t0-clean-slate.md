# T0 · Tiszta lap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real mode shows ONLY real data — the Train demo seed becomes opt-in (`demofixtures` profile), `useTrain`'s real-mode static fallbacks are removed, every Train screen survives an empty database with ghost-style empty states, and the frontend defaults to real mode.

**Architecture:** Backend: one annotation move (`TrainSeedData` → `@Profile("demofixtures")`) + IT updates. Frontend: `useTrain` returns `null` for `activeMeso`/`workout`/`gymSchedule`/sport-statics in real mode (mock mode byte-identical — parity untouched); a shared `GhostState` component (design option C: skeleton + message + CTA) guards TrainToday/Gym/Sport/Library; `ActiveWorkoutScreen` redirects without data. `.env` default flips to `VITE_USE_MOCK=false`.

**Tech Stack:** Spring Boot 4 profiles, React 19 + TanStack Query + MSW/Vitest, Tailwind v4.

**Driving bd issue:** `mezo-ker` (epic `mezo-ogv`). **Spec:** `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md`.

**Mandatory reading:** CLAUDE.md trigger table → `docs/references/testing_standards.md`, `configuration_conventions.md` (backend task); existing patterns: `frontend/src/data/hooks.ts` (useTrain), `frontend/src/data/trainHooks.test.tsx`, `frontend/src/test/msw/handlers.ts`.

**KNOWN MID-BRANCH STATE:** Task 2 changes the `useTrain` return type (`X | null`), which makes `tsc -b` (`pnpm build`) fail until Tasks 3–5 add the guards. Run `pnpm test` (vitest, no typecheck) per task; the full build gate is Task 6. This is expected — do NOT "fix" it by weakening types.

## File structure

```
backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java   (MODIFY — profile)
backend/src/test/java/io/mrkuhne/mezo/feature/train/TrainSeedDataIT.java (MODIFY — profiles)
backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java  (MODIFY — bean-absence test; verify actual path)
frontend/src/data/hooks.ts                          (MODIFY — useTrain real-mode nulls)
frontend/src/data/trainHooks.test.tsx               (MODIFY — empty-real tests)
frontend/src/components/GhostState.tsx              (NEW — verify dir: where Fab.tsx/AppLayout.tsx live)
frontend/src/features/train/views/TrainTodayView.tsx        (MODIFY — ghost hero + weekly guard)
frontend/src/features/train/views/GymView.tsx               (MODIFY — ghost)
frontend/src/features/train/ActiveWorkoutScreen.tsx         (MODIFY — redirect guard)
frontend/src/features/train/views/SportView.tsx             (MODIFY — ghosts + empty log)
frontend/src/features/train/views/MesocycleLibraryView.tsx  (MODIFY — empty hint)
frontend/src/features/train/train.emptyStates.test.tsx      (NEW — real-mode empty tests)
frontend/.env.example + frontend/.env               (MODIFY — VITE_USE_MOCK=false)
CLAUDE.md                                           (MODIFY — run commands)
```

---

### Task 1: Backend — `demofixtures` profile split

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TrainSeedDataIT.java`
- Modify: the owner-seed IT (find it: `grep -rl "OwnerSeedData" backend/src/test`) — bean-absence assertion

- [ ] **Step 1: Branch + claim**

```bash
git checkout -b feat/t0-clean-slate && bd update mezo-ker --claim
```

- [ ] **Step 2: Failing tests first.** (a) In `TrainSeedDataIT` change the class annotation `@ActiveProfiles("demodata")` → `@ActiveProfiles({"demodata", "demofixtures"})` — this still passes (profiles are additive) but pins the NEW contract. (b) In the owner-seed IT add a bean-absence test (adapt field/class names to the actual file):

```java
@Autowired private org.springframework.context.ApplicationContext applicationContext;

@Test
void testDemodataProfile_shouldNotRegisterTrainSeed_whenFixturesProfileAbsent() {
    assertThat(applicationContext.getBeanProvider(TrainSeedData.class).getIfAvailable()).isNull();
}
```
(The owner-seed IT runs under `@ActiveProfiles("demodata")` only — verify; if it has no profile annotation, add `@ActiveProfiles("demodata")`.)

- [ ] **Step 3: Run — the new test FAILS** (TrainSeedData is still on `demodata`, so the bean exists):

```bash
cd backend && ./mvnw clean test -Dtest='*SeedData*' 2>&1 | grep -E "Tests run|FAIL|BUILD"
```

- [ ] **Step 4: Move the profile.** In `TrainSeedData.java`: `@Profile("demodata")` → `@Profile("demofixtures")`. Update the class Javadoc line to say the fixtures are opt-in demo data (run with `--spring.profiles.active=demodata,demofixtures`); keep `@Order(100)` and the dual-`@Transactional` untouched.

- [ ] **Step 5: Full suite green:**

```bash
./mvnw clean test 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD"
```
Expected: 32 tests (31 prior + 1 new), 0 failures. ALWAYS `clean`.

- [ ] **Step 6: Commit**

```bash
git add backend/src && git commit -m "feat(seed): Train fixtures move to opt-in demofixtures profile (mezo-ker)"
```

---

### Task 2: Frontend hook — real-mode fallback removal

**Files:**
- Modify: `frontend/src/data/hooks.ts` (useTrain + return-type consequence)
- Modify: `frontend/src/data/trainHooks.test.tsx`

- [ ] **Step 1: Failing test** — append to `trainHooks.test.tsx` (it already stubs real mode via `vi.stubEnv('VITE_USE_MOCK','false')` in beforeEach — mirror the file's existing idiom). Per-test MSW override needs the server instance: find it with `grep -rn "setupServer" frontend/src/test/` and import accordingly.

```tsx
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server' // verify actual path/export

it('returns nulls (no static fallback) when the backend is empty', async () => {
  server.use(
    http.get('*/api/train/mesocycles', () => HttpResponse.json([])),
    http.get('*/api/train/sport-sessions', () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles).toEqual([]))
  expect(result.current.activeMeso).toBeNull()
  expect(result.current.workout).toBeNull()
  expect(result.current.gymSchedule).toBeNull()
  expect(result.current.sport.schedule).toBeNull()
  expect(result.current.sport.sessions).toEqual([])
})
```

- [ ] **Step 2: Run — FAILS** (fallbacks still return statics):

```bash
cd frontend && pnpm test -- trainHooks 2>&1 | tail -5
```

- [ ] **Step 3: Implement** — in `useTrain` (keep the two queries untouched; ONLY the return changes). Use the file's EXISTING import aliases for the statics (read the imports at the top of `hooks.ts` — names below are illustrative):

```ts
const mock = isMockMode()
// ...queries unchanged...
const mesos = mesoQuery.data ?? []
return {
  mesocycles: mesos,
  // real mode: no static fallback — empty backend means null, components ghost-guard (T0)
  activeMeso: mesos.find(m => m.status === 'active') ?? (mock ? activeMeso : null),
  workout: mock ? workout : null,          // real value arrives in T2 (/today endpoint)
  gymSchedule: mock ? gymSchedule : null,  // real derivation arrives in T2
  sport: mock
    ? { ...sport, sessions: sportQuery.data ?? [] }
    : { ...sport, schedule: null, week: null, crossLoad: null, sessions: sportQuery.data ?? [] },
  exerciseLibrary, // static catalog — content, not user data (spec decision)
}
```
Verify the actual keys of the `sport` static object in `frontend/src/data/train.ts` (`schedule`/`week`/`crossLoad` are from exploration — null out every non-`sessions` key it really has, keeping the object shape so `sport.X` accesses type as `X | null`, not missing).

- [ ] **Step 4: Tests pass; existing real-mode tests still green** (they use the non-empty global MSW fixtures):

```bash
pnpm test -- trainHooks 2>&1 | tail -5 && VITE_USE_MOCK=false pnpm test -- trainHooks 2>&1 | tail -5
```
NOTE: `pnpm build` is EXPECTED to fail from this commit until Task 5 — don't run it yet.

- [ ] **Step 5: Mock-mode byte-identity check** — run the full vitest suite in default (mock) mode; all existing component tests must stay green:

```bash
pnpm test 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src && git commit -m "feat(train): useTrain real mode drops static fallbacks — nulls until T2/T3 (mezo-ker)"
```

---

### Task 3: GhostState component + TrainTodayView ghost

**Files:**
- Create: `frontend/src/components/GhostState.tsx` (FIRST verify the shared-component dir: `ls frontend/src/components 2>/dev/null || grep -rl "export function Fab" frontend/src` — put GhostState next to Fab/AppLayout and match their code style)
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx`
- Create: `frontend/src/features/train/train.emptyStates.test.tsx`

- [ ] **Step 1: Failing test** — new file `train.emptyStates.test.tsx`; real mode + empty MSW + router context (mirror how existing train view tests render with router — read `train.nav.test.tsx` for the render helper):

```tsx
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/test/msw/server' // verify path

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const emptyTrain = () =>
  server.use(
    http.get('*/api/train/mesocycles', () => HttpResponse.json([])),
    http.get('*/api/train/sport-sessions', () => HttpResponse.json([])),
  )

describe('Train empty states (real mode, empty backend)', () => {
  it('TrainTodayView shows the ghost hero with a wizard CTA', async () => {
    emptyTrain()
    renderTrainRoute('/train') // use the same router-render helper the existing train tests use
    await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — FAILS** (TrainTodayView crashes on null activeMeso or renders the old content):

```bash
pnpm test -- emptyStates 2>&1 | tail -8
```

- [ ] **Step 3: GhostState component** (option C — skeleton + message + CTA; reuse the house CTA button component if one exists — `grep -rn "CtaPrimary" frontend/src/features/train` — otherwise the inline button below, with classes aligned to TrainTodayView's existing CTA styling):

```tsx
/** Clean-slate empty state (spec T0, design option C): faint skeleton of the future
 *  layout + one-line message + optional CTA. Used by Train views when real mode has no data. */
export function GhostState({ message, ctaLabel, onCta, lines = 3 }: {
  message: string
  ctaLabel?: string
  onCta?: () => void
  lines?: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-2.5 rounded bg-white/5" style={{ width: `${70 - i * 15}%` }} />
        ))}
      </div>
      <div className="mt-4 text-center">
        <p className="text-xs text-white/60">{message}</p>
        {ctaLabel && onCta && (
          <button type="button" onClick={onCta}
            className="mt-3 rounded-lg bg-pink-500 px-4 py-2 text-[11px] font-semibold tracking-wide text-white">
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: TrainTodayView guard.** At the top of the component, after the `useTrain()` destructure: when `!activeMeso || !workout`, render the page chrome (subnav + header) with a `GhostState` hero instead of the workout hero, and guard the weekly-plan section on `gymSchedule`:

```tsx
const navigate = useNavigate() // already imported in this file (startWorkout uses it)
// T0 clean slate: no active meso in real mode -> ghost hero, CTA to the wizard
if (!activeMeso || !workout) {
  return (
    <PageShell> {/* whatever wrapper/JSX the file uses for subnav+header — reuse it */}
      <GhostState
        lines={4}
        message="Itt fog élni a mai edzésed — előbb tervezz egy mesociklust."
        ctaLabel="+ TERVEZZ MESOCIKLUST"
        onCta={() => navigate('/train/mesocycles/new')}
      />
      {/* keep the sport weekly section IF sport.schedule exists; else a 2-line GhostState
          with message "A heti rended itt jelenik majd meg" and no CTA (editor comes in T3) */}
    </PageShell>
  )
}
```
This is a STRUCTURAL sketch — adapt to the file's real JSX (header markup, section components). Everything below the guard keeps using `activeMeso`/`workout` non-null (TypeScript narrows after the early return).

- [ ] **Step 5: Tests pass** (`pnpm test -- emptyStates`), full mock-mode suite still green (`pnpm test 2>&1 | tail -3`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src && git commit -m "feat(train): GhostState component + TrainTodayView clean-slate ghost (mezo-ker)"
```

---

### Task 4: GymView ghost + ActiveWorkoutScreen guard

**Files:**
- Modify: `frontend/src/features/train/views/GymView.tsx`
- Modify: `frontend/src/features/train/ActiveWorkoutScreen.tsx`
- Modify: `frontend/src/features/train/train.emptyStates.test.tsx`

- [ ] **Step 1: Failing tests** — append to `train.emptyStates.test.tsx`:

```tsx
it('GymView shows a ghost when there is no active meso', async () => {
  emptyTrain()
  renderTrainRoute('/train/gym')
  await waitFor(() => expect(screen.getByText(/Nincs aktív mesociklus/i)).toBeInTheDocument())
})

it('ActiveWorkoutScreen redirects to /train when there is no workout', async () => {
  emptyTrain()
  renderTrainRoute('/train/session')
  // lands back on the Train Today ghost instead of crashing
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run — FAILS** (`pnpm test -- emptyStates 2>&1 | tail -8`).

- [ ] **Step 3: GymView** — same early-return pattern as TrainTodayView: `if (!activeMeso)` → page chrome + `GhostState(message: "Nincs aktív mesociklus — a volumen- és fázisadatok itt jelennek majd meg.", ctaLabel: "+ TERVEZZ MESOCIKLUST", onCta → /train/mesocycles/new)`.

- [ ] **Step 4: ActiveWorkoutScreen** — guard BEFORE any `workout.`/`activeMeso.` access:

```tsx
import { Navigate } from 'react-router' // match the router import the file already uses (react-router vs react-router-dom)
// T0: no real workout data until T2 -> never render the session screen without it
if (!workout || !activeMeso) return <Navigate to="/train" replace />
```

- [ ] **Step 5: Tests pass; full mock suite green** (`pnpm test 2>&1 | tail -3`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src && git commit -m "feat(train): GymView ghost + ActiveWorkoutScreen null-guard redirect (mezo-ker)"
```

---

### Task 5: SportView ghosts + MesocycleLibraryView empty hint

**Files:**
- Modify: `frontend/src/features/train/views/SportView.tsx`
- Modify: `frontend/src/features/train/views/MesocycleLibraryView.tsx`
- Modify: `frontend/src/features/train/train.emptyStates.test.tsx`

- [ ] **Step 1: Failing tests** — append:

```tsx
it('SportView ghosts the weekly plan and shows an empty log message', async () => {
  emptyTrain()
  renderTrainRoute('/train/sport')
  await waitFor(() => expect(screen.getByText(/A heti rended itt jelenik majd meg/i)).toBeInTheDocument())
  // switch to the NAPLÓ tab the way the existing SportView test does (fireEvent/userEvent on the tab button)
  // then:
  expect(await screen.findByText(/Még nincs logolt session/i)).toBeInTheDocument()
})

it('MesocycleLibraryView shows the empty hint when there are no mesocycles', async () => {
  emptyTrain()
  renderTrainRoute('/train/mesocycles')
  await waitFor(() => expect(screen.getByText(/Még nincs mesociklusod/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run — FAILS.**

- [ ] **Step 3: SportView** — three guards, adapting to the file's real JSX:
  - header stat block (`sport.week`-driven): if `sport.week == null` → replace the stat row with a 2-line `GhostState` (`message: "A statisztikáid az első logolt session után jelennek meg."`, no CTA);
  - HETI TERV tab: if `sport.schedule == null` → `GhostState(message: "A heti rended itt jelenik majd meg", no CTA)` (editor lands in T3);
  - NAPLÓ tab: if `sport.sessions.length === 0` → simple line `Még nincs logolt session.` styled like the existing "nincs session" italic (SportView already has that idiom for empty weekdays).

- [ ] **Step 4: MesocycleLibraryView** — when `mesocycles.length === 0`, render above the existing "+ ÚJ MESOCIKLUS TERVEZÉSE" CTA a `GhostState(lines: 2, message: "Még nincs mesociklusod — itt fognak élni a blokkjaid.")` (no CTA — the view's existing CTA button stays the single action).

- [ ] **Step 5: Tests pass; full mock suite green; NOW the build must compile again** (all null-consumers guarded):

```bash
pnpm test 2>&1 | tail -3 && VITE_USE_MOCK=false pnpm test 2>&1 | tail -3 && pnpm build 2>&1 | tail -3
```
Expected: both suites green, BUILD CLEAN. If tsc still reports null-access errors, those are REAL missed guards — fix the component, never the type.

- [ ] **Step 6: Commit**

```bash
git add frontend/src && git commit -m "feat(train): SportView + MesocycleLibraryView clean-slate empty states (mezo-ker)"
```

---

### Task 6: Defaults, docs, gates, merge

**Files:**
- Modify: `frontend/.env.example`, `frontend/.env` (local), `CLAUDE.md`

- [ ] **Step 1: Flip the default** — in BOTH `frontend/.env.example` and the local `frontend/.env`: `VITE_USE_MOCK=true` → `VITE_USE_MOCK=false`.

- [ ] **Step 2: CLAUDE.md** — Build & Test section:
  - `pnpm dev` line: real mode is now the default (needs the backend on :8090); mock: `VITE_USE_MOCK=true pnpm dev`.
  - backend run line: `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` seeds the owner ONLY; demo fixtures: `-Dspring-boot.run.profiles=demodata,demofixtures`.

- [ ] **Step 3: Full gates**

```bash
cd backend && ./mvnw clean test 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD" \
  && ./mvnw clean test -Dmezo.test.use-testcontainers=true 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD"
cd ../frontend && pnpm test 2>&1 | tail -3 && VITE_USE_MOCK=false pnpm test 2>&1 | tail -3 \
  && pnpm build 2>&1 | tail -3 && pnpm parity 2>&1 | tail -5
```
Expected: backend 32/32 both modes; FE green both modes; build clean; **parity 45/45** (mock fixtures untouched).

- [ ] **Step 4: Live browser smoke** (the T0 acceptance moment):

```bash
# clean Train rows in the dev DB (single-dev environment; biometrics data untouched)
docker exec backend-postgres-1 psql -U mezo -d mezo -c \
  "TRUNCATE exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, sport_session CASCADE"
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata > /tmp/t0-smoke.log 2>&1 &
cd frontend && pnpm dev > /tmp/t0-vite.log 2>&1 &
```
In the browser (localhost:5180): `/train` shows the ghost hero ("Itt fog élni a mai edzésed" + CTA); `/train/gym` ghost; `/train/sport` ghost weekly + empty napló; `/train/mesocycles` empty hint. NO demo data anywhere, no console errors except none.
Then restart the backend with `demodata,demofixtures` → reload → the 4 mesocycles/5 sport sessions appear again. Kill both dev processes when done (identify by cwd, port 8090/5180).

- [ ] **Step 5: Close + merge per Git Workflow**

```bash
bd close mezo-ker --reason="T0 shipped: demofixtures split, real-mode fallbacks removed, ghost empty states, real-mode default; all gates green incl. live smoke"
git add frontend/.env.example CLAUDE.md && git commit -m "docs+config: real mode is the default, demofixtures documented (mezo-ker)"
git checkout main && git pull --rebase
git merge --no-ff feat/t0-clean-slate -m "Merge feat/t0-clean-slate: clean slate — opt-in demo fixtures + ghost empty states (mezo-ker)"
git branch -d feat/t0-clean-slate
bd dolt push && git push && git status
```

---

## Self-review notes (done at plan time)

- **Spec coverage (T0 row):** profile split (Task 1), fallback removal (Task 2), ghost empty states C-style on all four affected views + redirect guard (Tasks 3–5), `.env` default + docs (Task 6), parity untouched (gates).
- **Type consistency:** `GhostState({message, ctaLabel?, onCta?, lines?})` used identically in Tasks 3–5; hook returns `activeMeso/workout/gymSchedule: X | null` and `sport` keeps its key shape with nulls.
- **Verify-at-execution points:** MSW server import path; `sport` static's real key names; shared-component directory; router import flavor (`react-router` vs `react-router-dom`); the router-render helper used by existing train tests; owner-seed IT class name/profile.
