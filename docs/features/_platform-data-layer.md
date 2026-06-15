---
title: Platform · Data Layer & Dual-Mode
type: feature-platform
status: done
updated: 2026-06-15
tags: [platform, data-layer, frontend]
key_files:
  - frontend/src/data/hooks.ts
  - frontend/src/data/trainHooks.ts
  - frontend/src/data/runningHooks.ts
  - frontend/src/lib/mode.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/biometricsApi.ts
  - frontend/src/app/providers/QueryProvider.tsx
related: [_platform-api-backend, _platform-auth-security, train, me]
---

# Platform · Data Layer & Dual-Mode — Feature Documentation

> The single FE↔data boundary (`frontend/src/data/hooks.ts`) + the `isMockMode()` dual-mode switch + the TanStack Query wiring + the typed REST clients. **Status:** ✅ done (cross-cutting platform layer; some hooks 🔶 mock-only — see §2). Not a screen — it sits under **every** route/tab; the wired domains are Me (biometrics) and Train/Futás.

This is the cross-cutting plumbing every feature consumes, so this doc is named with a leading `_` (a platform doc, not a single user-facing slice). Read it before wiring any new domain to the backend.

## 1. Summary

`frontend/src/data/hooks.ts` is the **single integration boundary** between every React view and the data layer. Each feature imports its data exclusively as `useX()` hooks from `@/data/hooks` (~22 hooks). Every hook can run in one of two modes, switched **per call** by `isMockMode()` (`frontend/src/lib/mode.ts`, which reads `VITE_USE_MOCK`):

- **Mock mode**: returns the byte-identical Phase-1 static data, seeded *synchronously* via TanStack Query `initialData` (or plain `useState`), with write mutations that either no-op or emulate the server in-cache via `queryClient.setQueryData`. No backend needed — this is what the Playwright parity run and most component tests use.
- **Real mode** (`VITE_USE_MOCK=false`): the *same hook signature*, but `queryFn` calls a typed REST client (`lib/biometricsApi.ts` / `lib/trainApi.ts` / `lib/runningApi.ts`) over `apiFetch` (`lib/api.ts`) against the Spring Boot backend; mutations persist then `invalidateQueries`. **There is no static fallback in real mode** — an empty backend resolves to `null`/`[]`, and views "ghost-guard" (render a `GhostState` skeleton) instead of silently showing demo data.

The **key invariant**: the public return shape of every hook is the contract. Swapping a hook from mock to real changes only the hook's internals — **no component changes** — so parity screenshots and component tests stay green through the swap.

Driving design: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (§1 "Key invariant", §3 frontend integration, §5 slice map; decision `mezo-gqi`). There is **no dedicated numbered ADR** for the dual-mode pattern — this doc is its durable home.

## 2. Status per domain (mock-vs-real — be precise)

Three API clients exist; only those three domains are wired to a real backend. Everything else is **mock-only on the FE** (no API client, no backend table yet).

| Hook(s) | Domain | Status |
|---|---|---|
| `useGoals` (`logWeight`), `useSleep` (`logSleep`), `useCheckins` (`saveCheckIn`) | Biometrics (weight / sleep / check-in) | ✅ **dual-mode, real backend done** (Phase 2 Slice A). Client `lib/biometricsApi.ts`. |
| `useTrain` (mesocycles, workout-execution, sport, exercise catalog/records) | Train | ✅ **dual-mode, real backend done** (Slice B + T0–T3 + catalog/records). Hook `data/trainHooks.ts`, client `lib/trainApi.ts`. |
| `useRunning` ("Futás") | Running | ✅ **dual-mode, real backend done** (R0–R4). Hook `data/runningHooks.ts`, client `lib/runningApi.ts`. |
| `useToday`, `useProfile`, `useFuelPreview`, `useFuelDay`/`useFuelTimeline`/`useFuelWeek`, `usePantry`, `useRecipes`, `useStack`, `useProtocol`, `useReplanScenarios`, `useStackRecommendations`, `useInsights`, `useKnowledge`, `useChat`, `usePeople` (`logMention`) | Today, Me/Profile, **Fuel**, **Insights**, **People** | 🔶 **MOCK-ONLY.** Plain static returns or local `useState`; no API client, no `isMockMode` branch, no backend table. Slices C (Fuel) → D (Insights seed) → E (People) remain (`docs/milestones/roadmap.md`). |
| `useTodayScenario` | Today demo switch | 🔶 URL-param demo only (`?day=`/`retaDay=`/`niggle=`/`vulnerable=`), never backed. |

🟣 Phase 3 (AI brain: Spring AI, pgvector, RAG) is later and out of scope here — anything labeled "Phase 3" in §9 is intentionally empty/null in real mode by design.

## 3. User-facing behavior

There are **no UI screens for this layer itself** — it is invisible plumbing. The user-facing flow it *enables*, for every wired feature, is the read/write round-trip:

1. A view mounts → calls `useX()` → in real mode TanStack Query fetches via `apiFetch` (with a silently-bootstrapped owner JWT) → renders the data, or a `GhostState` skeleton while pending / when the backend is empty.
2. The user logs something (weight, sleep, a check-in, a set, a run session) → the hook's mutator fires → real mode POSTs and `invalidateQueries` (UI refetches server truth); mock mode patches the cache optimistically.

The one developer-facing "flow" is the **mode toggle**: run with `VITE_USE_MOCK=true` for a backend-free app (parity/demo), or `false` (the configured default in `frontend/.env.example`) to hit the real API on `:8090`.

## 4. Architecture & data flow

```
React view (features/**/*.tsx)
  └─ import { useX } from '@/data/hooks'          ← THE single boundary
       └─ useX()  [data/hooks.ts | trainHooks.ts | runningHooks.ts]
            ├─ const mock = isMockMode()          ← lib/mode.ts (VITE_USE_MOCK !== 'false')
            ├─ useQuery({ queryFn: mock ? async()=>STATIC : xApi.list,
            │             initialData: mock ? STATIC : undefined })
            └─ useMutation({ mutationFn: mock ? (no-op | setQueryData) : xApi.write,
                             onSuccess: mock ? setQueryData : invalidateQueries })
                 └─ xApi.*  [lib/biometricsApi.ts | trainApi.ts | runningApi.ts]
                      └─ apiFetch<T>(path, init)   ← lib/api.ts
                           ├─ fetch(`${API_BASE}${path}`)  API_BASE = VITE_API_URL ?? :8090
                           ├─ Authorization: Bearer <token>  (module-level token, setToken())
                           └─ !res.ok → throw ApiError(SystemMessage[], status)
                                └─ Spring @RestController → @Service → JPA Repository → Postgres
```

**`apiFetch` contract** (`frontend/src/lib/api.ts:22`): prepends `API_BASE` (`VITE_API_URL ?? 'http://localhost:8090'`), sets JSON + Bearer headers, returns `undefined` for `204`, otherwise parses JSON. On `!res.ok` it throws `ApiError(messages: SystemMessage[], status)` where `SystemMessage = { code, message, fieldName?, exceptionTraceId? }` — mirroring the backend's `@RestControllerAdvice` contract (see `docs/references/error_handling.md`).

**Provider / bootstrap** (`frontend/src/app/providers/QueryProvider.tsx`, mounted above the router in `frontend/src/main.tsx`):

- One app-wide `QueryClient` with `defaultOptions.queries: { staleTime: 30_000, retry: 1 }`.
- In **real mode** the provider gates rendering on `bootstrapOwnerToken()` (`frontend/src/lib/auth.ts`): POSTs `VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD` to `/api/auth/login`, then `setToken(token)` so `apiFetch` injects the Bearer header. `ready` starts `false` and renders `null` until the token lands — *or* until login fails, in which case it renders anyway so the app degrades gracefully. In **mock mode** `ready` starts `true` and no login is attempted.
- `setToken` stores the JWT in a **module-level `let token`** in `lib/api.ts:19` (not `localStorage`) — there is no login UI; ownership is single-user.

### The dual-mode pattern (the load-bearing recipe)

Canonical read+write example, `useGoals` (`frontend/src/data/hooks.ts:80`):

```ts
const mock = isMockMode()
const { data: weightLog = [] } = useQuery({
  queryKey: ['weightLog'],
  queryFn: mock ? async () => initialWeightLog : weightApi.list,
  // Mock seeds SYNCHRONOUSLY so the first render matches Phase-1 useState (parity + tests).
  initialData: mock ? initialWeightLog : undefined,
})
const mutation = useMutation({
  mutationFn: mock
    ? async (input: WeightLogInput): Promise<WeightEntry> =>          // emulate server response
        ({ date: input.date, value: input.weightKg, note: input.note })
    : weightApi.log,                                                  // real POST
  onSuccess: (entry) => {
    if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])  // patch cache
    else qc.invalidateQueries({ queryKey: ['weightLog'] })                                     // refetch truth
  },
})
```

`initialData` in mock mode means the query is never "pending" — the first render already has data, matching the old Phase-1 synchronous `useState`. This is what keeps parity screenshots and component tests green. In real mode `initialData` is `undefined`, so the query loads and the view must ghost-guard.

**Three mutation flavors across the codebase:**

- **Optimistic cache emulation** (mock) → `setQueryData`: `useGoals.logWeight`, `useSleep.logSleep`, `useTrain.logSportSession` (appends a synthesized `SportSession` stamped with today's date to `['train','sportSessions']` so the `Mai` done-state flips offline — mezo-pyc; **real mode still POSTs to `/api/train/sport-sessions` + invalidates**, the DB is the source of truth), and all of `useRunning`'s mock mutations (`upsertMock`/`lifecycleMock`/`logMock` in `data/runningHooks.ts:38`) which fully re-implement create/update/activate/close/delete/log in-cache so mock interactions behave like a server — including **server-derived fields**: `upsertMock` computes `currentWeek` via `currentWeekOf` (`lib/dates.ts`) exactly as the backend's `clampWeek` does, so a mock-created block isn't stuck on week 0 (mezo-478).
  - **Exception — real-mode *create* also `setQueryData`s** (mezo-11m, `runningHooks.ts:52`): `useRunning`'s save mutation's `onSuccess` branches — for a real-mode *create* (`!mock && !args.id`) it inserts the returned block into `['running','blocks']` **synchronously** and skips the invalidate, because the server response is authoritative for the just-created row and an async refetch races a navigate-into-the-builder (read-after-write could transiently drop it). Real-mode *updates* and all mock paths still `invalidate()`. This is the one place a real-mode mutation patches the cache directly instead of refetching truth.
- **Pure no-op** (mock) → `async () => undefined`, real → persist + `invalidateQueries`: `useTrain`'s remaining **ten** write mutations (all except `logSportSession`, which now does a mock cache-append — see above; incl. `gymScheduleMutation` → PUT `/gym-schedule`, invalidates `['train','gymSchedule']`, `data/trainHooks.ts:331`); rationale in-code — "mock mode no-ops (Phase-1 local behavior stays untouched)".
- **Local `useState` (no query at all)**: `useCheckins` (`hooks.ts:41`) and `usePeople` (`hooks.ts:131`). `useCheckins` is a hybrid — it always updates local state synchronously and, **only in real mode**, additionally fires `checkinApi.save` as a fire-and-forget mutation (errors just `console.error`, no rollback). `usePeople.logMention` is mock-only (mints a `Mention` with `crypto.randomUUID()` and prepends it).

### The "no static fallback in real mode → ghost-guard" rule

Real mode must surface an empty backend as `null`/`[]`, never as Phase-1 demo data. Hooks branch the *return value*, not just the query (`data/trainHooks.ts:355`):

```ts
activeMeso: realActiveMeso ?? (mock ? activeMeso : null),   // mock falls back to static, real stays null
workout:    mock ? trainWorkout : toWorkoutPlan(todayData),
gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso, gymSlots),  // joins meso gym-days × standalone gym-time slots
```

Hooks also expose a **`*Pending` flag** (`workoutPending` = `!mock && (mesoPending || todayPending)` at `trainHooks.ts:364`; `runningPending` = `!mock && isPending` at `runningHooks.ts:90`), so route guards/views can wait instead of flashing the empty ghost before data lands.

**Ghost-guard consumption** — `frontend/src/components/ui/GhostState.tsx` (a faint skeleton + a one-line Hungarian message + optional CTA, "T0 clean-slate option C"). Views render it when a real-mode hook returns null/empty, e.g. `MesocycleLibraryView.tsx` → `"Még nincs mesociklusod — itt fognak élni a blokkjaid."`, `RunningView.tsx` → `"Nincs aktív futóterved — a Tervek fülön aktiválj egyet."` and `"Betöltés…"` while pending. `SportView.tsx` is one of the rare places a *view* calls `isMockMode()` directly — to hide the schedule-edit affordance in mock mode (`onEdit={isMockMode() ? undefined : …}`).

## 5. Data model & API

The FE↔BE boundary types are **generated, never hand-written** (see `docs/references/api_contract_conventions.md`): `api/feature/<x>/<x>.yml` → merged `api/openapi.yml` → `openapi-typescript` → `frontend/src/lib/api.gen.ts` (`pnpm generate:api`). Clients pull types as `components['schemas'][...]`.

**Endpoints by client:**

- `biometricsApi` (`lib/biometricsApi.ts`): `GET/POST /api/biometrics/weight`, `GET/POST /api/biometrics/sleep`, `GET ?date= / POST /api/biometrics/checkin`. Types `WeightLogResponse`/`LogWeightRequest`, `SleepLogResponse`/`LogSleepRequest`, `CheckInResponse`/`SaveCheckInRequest`.
- `trainApi` (`lib/trainApi.ts`): `mesocycles` (GET), `sport-sessions` (GET), mesocycle `create`/`:id/activate`/`:id/close`, `:mesoId/days/:dayId/exercises` (PUT), `workouts/today` (GET), `workouts` (start), `workouts/:id/sets` (logSet), `workouts/:id/feedback`, `workouts/:id/finish`, `sport-schedule` (GET/PUT), `gym-schedule` (GET/PUT — `gymSchedule`/`replaceGymSchedule`), `exercises` (catalog GET), `exercise-records` (GET). 18 endpoints.
- `runningApi` (`lib/runningApi.ts`): `running-blocks` (GET/POST), `running-blocks/:id` (PUT/DELETE), `:id/activate`, `:id/close`, `run-sessions` (GET/POST).
- `auth` (`lib/auth.ts`): `POST /api/auth/login` → `TokenResponse`.

Backend entities/conventions for the wired domains follow `docs/references/*.md`: UUID PKs (`gen_random_uuid()`), soft delete (`@SQLDelete`/`@SQLRestriction`), single-user ownership (`created_by` from the security principal, app-level filtering), typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`, Liquibase changesets `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, seed data in Java `@Profile("demodata")`. The per-feature design specs hold the table-level detail; see `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` and `2026-06-14-train-running-slice-design.md`.

### Domain↔contract type seam (a documented gotcha)

The FE keeps its own *domain* types in `frontend/src/data/types.ts` (`WeightEntry`, `SleepEntry`, `Mesocycle`, `SportSession`, …). Generated response DTOs are reconciled to these at the client or hook boundary, three ways:

- **Structural assignability cast** when shapes line up: `weightApi.list` declares `Promise<WeightEntry[]>` but fetches `WeightLogResponse[]` — "structurally assignable, checked by tsc" (`biometricsApi.ts:14`).
- **Explicit cast for nullability mismatch**: `sleepApi` casts `SleepLogResponse[] as SleepEntry[]` because the contract allows nulls the domain type claims are present — flagged in-code "explicit cast until normalized (see mezo bd issue)" (`biometricsApi.ts:27`).
- **Mapper functions** in `trainHooks.ts:43-162` (`toWorkoutPlan`, `deriveGymSchedule`, `toMesocycle`, `toSportSession`, `toSportSchedule`, `toLibraryItem`, `deriveSportWeek`) translate ISO dates → Hungarian display strings (via `lib/dates.ts` `huMonthDay`/`huMonthDayDow`) and reshape DTOs into Phase-1 view shapes. **Week stats derive from the raw ISO-dated responses inside the `queryFn`**, before mapping (`trainHooks.ts:210`).

**Running is the newest, cleanest idiom**: `runningHooks.ts` returns the generated types *directly* as the view model (`RunningBlockResponse[]`, `RunSessionLogResponse[]` — no separate domain type), and the mock data file `data/running.ts` is shaped *exactly* like the generated DTOs (imports `RunningBlockResponse` etc. from `runningApi.ts`). Copy this when wiring a new domain.

For mock-only features (Fuel/Insights/People) there is no contract fragment yet — the "data model" is the static shape returned by the hook (`data/fuel.ts`, `data/insights.ts`, `data/people.ts`, …). The backend plugs in by adding `api/feature/<x>/<x>.yml` → client → hook branch (see §7).

## 6. Integrations

This layer is the hub; every feature is a spoke. Concrete, bidirectional seams:

- **Today ← biometrics / Train**: `TodayScreen`, `FuelTimelinePreview` consume `useToday`/`useFuelPreview` (mock) and the Train hooks. `useTodayScenario` (`hooks.ts:21`) reads `?day=/retaDay=/niggle=/vulnerable=` URL params to drive the mock day-state demo (parsed in `hooks.test.tsx`). **Contract crossing the seam:** the `TodayScenario` type (`{ dayState, retaDay, niggle, vulnerable, anchorMode }`).
- **Me ← biometrics**: `GoalsView` (`useGoals`/`logWeight`), `SleepView` (`useSleep`/`logSleep`), `ProfileView`/`PeopleView`/`KnowledgeView` (`useProfile`/`usePeople`/`useKnowledge`, all mock). **Contract:** `WeightEntry[]`, `SleepEntry[]`, `CheckinSlot[]` from `data/types.ts`.
- **Train ↔ Train sub-views**: `useTrain` feeds `GymView`, `SportView`, `TrainTodayView`, `MesocycleLibraryView`, `ExercisesView`, `ActiveWorkoutScreen`; `useRunning` feeds `RunningView`. The `todaySession` field (`{ templateSessionId, openWorkout }`) lets a mid-workout reload resume from the open instance (`trainHooks.ts:361`).
- **Train → Today**: `useTrain().workout` derives the Today workout card; `gymSchedule`/`sport.schedule` derive the weekly rows. The gym schedule is *derived client-side* by `deriveGymSchedule(meso, slots)` (`trainHooks.ts:67`), joining the active meso's template gym days (WHAT) with the standalone weekly gym-time slots (WHEN — the new `['train','gymSchedule']` query, persists across mesocycles, edited via `saveGymSchedule`). Only per-day gym `duration` stays out of scope.
- **Cross-feature mock fixtures**: `data/today.ts` re-exports `volleyballSessions`, `fuelToday`; `useFuelWeek` pulls `volleyball: volleyballSessions` from `today.ts` (`hooks.ts:189`) — mock-only cross-references between domains that the real backend will eventually own.
- **Auth seam**: `QueryProvider` → `bootstrapOwnerToken` → `setToken` → `apiFetch` Bearer header. Every real-mode request depends on this completing first; the provider blocks render until then. **Contract:** `TokenResponse.token` → module-level `token` in `lib/api.ts`.
- **MSW ↔ `API_BASE` seam**: tests import `API_BASE` from `lib/api.ts` (re-exported via `test/msw/handlers.ts`) so handler URLs always match the real client target.

## 7. How to extend it

### Consume an existing hook (view author)

1. `import { useX } from '@/data/hooks'` — *always* this path, even for Train/Running (re-exported from `trainHooks`/`runningHooks` at `hooks.ts:202-203` precisely so consumers' import path stays stable).
2. Destructure the documented return shape. For wired domains, **ghost-guard**: render `GhostState` when the relevant field is `null`/empty, and check the `*Pending` flag before deciding "empty" (real mode loads async).
3. Call the returned mutators (`logWeight`, `startWorkout`, `saveRunningBlock`, …); several accept an `opts?: { onSuccess }` callback for post-write navigation. **Never call `apiFetch` or a `*Api` client directly from a view** — the hook is the only boundary. Don't call `isMockMode()` in views except for the rare affordance-gating case (`SportView`).

### Wire a currently-mock domain to real (the recipe — mirror the Running slice)

Cleanest reference: `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` + the R1 plan.

1. **Contract first** (`docs/references/api_contract_conventions.md`): write/extend `api/feature/<x>/<x>.yml`; `cd api/generate && npm run generate:api`; then `cd frontend && pnpm generate:api` (updates `src/lib/api.gen.ts`).
2. **Typed client**: add `frontend/src/lib/<x>Api.ts` — re-export the `components['schemas'][...]` types, write thin functions over `apiFetch` (request bodies with `satisfies <Request>`, see `trainApi.ts`/`auth.ts`).
3. **Mock data shaped like the DTOs**: put statics in `frontend/src/data/<x>.ts`, ideally typed *as the generated response types* (the Running idiom) so mock and real are interchangeable.
4. **The hook**: in `data/hooks.ts` (or a dedicated `<x>Hooks.ts` re-exported from `hooks.ts`, like Train/Running, if large). `const mock = isMockMode()`; `useQuery` with `queryFn: mock ? async()=>STATIC : xApi.list` and `initialData: mock ? STATIC : undefined`; mutations with `mutationFn: mock ? (no-op | setQueryData emulation) : xApi.write` and `onSuccess: mock ? setQueryData : invalidateQueries`. **Preserve the existing return shape exactly** — that is the contract. Return `null`/`[]` (no static fallback) in real mode; add a `*Pending` flag if views need it; map DTOs→domain/display via helper functions.
5. **MSW handlers**: add request handlers to `src/test/msw/handlers.ts` (keyed off `API_BASE`) mirroring the demodata seed.
6. **Tests**: real-mode hook tests with `vi.stubEnv('VITE_USE_MOCK','false')` + `makeHookWrapper()` (MSW serves the response); mock-mode tests with `'true'`. Run **both** `pnpm test` and `VITE_USE_MOCK=true pnpm test` green, plus `pnpm build`.
7. **Backend**: follow the house standards in `docs/references/*.md` (java_package_structure, spring_patterns, error_handling, liquibase_conventions, testing_standards, configuration_conventions) — UUID PKs, soft delete, `created_by` ownership, Liquibase changeset `{ts}_{bd-id}_{desc}.sql`, seed in `@Profile("demodata")`, integration-first tests.

**Non-negotiable obligations**: contract-first (never hand-write boundary DTOs), dual-mode (every wired hook keeps its mock branch so the app runs end-to-end between slices), both-test-modes green.

## 8. Testing

- **Harness** (`frontend/src/test/`): `setup.ts` installs a spec-compliant in-memory `localStorage`/`sessionStorage` (Node 25 workaround) and starts MSW with `server.listen({ onUnhandledRequest: 'bypass' })` — so mock-mode hooks, which never fetch, are untouched; `resetHandlers` per test. `queryWrapper.tsx` exports `QueryWrapper` (fresh `QueryClient`, retry off) and `makeHookWrapper()` (a fresh client per `renderHook` for isolated caches).
- **MSW** (`src/test/msw/handlers.ts` + `server.ts`): handlers for all wired endpoints (auth, biometrics, train, running) keyed off `API_BASE`. Defaults mirror the demodata seed; running endpoints default to `[]` so a real-mode Mai stays clean. Tests override per-case with `server.use(...)`.
- **Mode in tests**: real-mode tests use `vi.stubEnv('VITE_USE_MOCK','false')` (NOT `vi.mock` of the api module — "so the real `apiFetch`/MSW path is exercised", `trainHooks.test.tsx`); mock-mode tests stub `'true'`. `mode.ts` is deliberately a function called *inside* hook bodies (never at module scope) so `vi.stubEnv` works per-case.
- **Representative tests**: `data/goalsHooks.test.tsx` (real GET + POST→invalidate→list-grows round-trip), `data/checkinHooks.test.tsx` (real: local update + exactly-one POST; mock: local update + zero fetches), `data/trainHooks.test.tsx` (real-mode meso/sport/catalog/records via MSW + mock no-op assertions), `data/hooks.test.tsx` (`useTodayScenario` param parsing + `useCheckins` local update). Train/Running view tests under `features/train/views/*.test.tsx` exercise both modes incl. ghost states.

**The dual-test mandate** (`CLAUDE.md` Build & Test): every change must be green in **both** `pnpm test` (real default) and `VITE_USE_MOCK=true pnpm test` (mock); parity screenshots run mock-mode.

```bash
cd frontend
pnpm test                       # real mode (default)
VITE_USE_MOCK=true pnpm test    # mock mode
pnpm build                      # tsc -b && vite build
```

## 9. Decisions, gotchas & deferred

- **Decision (spec, not a numbered ADR)**: TanStack Query as the FE data layer with hook signatures unchanged; `VITE_USE_MOCK` keeps not-yet-wired hooks on mock so the app runs end-to-end between slices (`docs/superpowers/specs/2026-06-10-phase2-backend-design.md` §3, decision `mezo-gqi`). The only numbered ADR is `docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md` (unrelated). **This doc is the durable home for the dual-mode rationale.**
- **Code default = mock, configured default = real**: `mode.ts` reads `VITE_USE_MOCK !== 'false'` so a *missing* env var never breaks parity/dev. **But** `frontend/.env.example` ships `VITE_USE_MOCK=false`, and `CLAUDE.md` says dev runs REAL by default (backend on `:8090`). The code default and the configured default diverge — the example env makes real mode the working default; mock is the deliberate fallback for parity/demos.
- **Gotcha — synchronous `initialData` parity**: mock mode must use `initialData` (not just `queryFn`) so the first render is synchronous and matches Phase-1 `useState`; otherwise parity/component tests would catch a loading frame.
- **Gotcha — domain vs contract type drift**: `sleepApi` `as SleepEntry[]` papers over nullability (open bd issue to normalize). New hooks should prefer the Running idiom (generated types as the view model) to avoid this entirely.
- **Gotcha — token in module scope**: the JWT lives in a `let` in `lib/api.ts`, lost on reload; `QueryProvider` re-bootstraps on every mount. No refresh/expiry handling (single-user, fine for now).
- **Gotcha — `useCheckins` real-mode write has no rollback**: it updates local `useState` and fires a fire-and-forget POST; a failed save only `console.error`s, leaving the UI optimistically "done".
- **Deferred / Phase 3 (null in real mode by design)**: Train `challenges` (`toWorkoutPlan` returns `[]`) and `niggleWarning`, `sport.crossLoad` (always null), the sport-week trend (`shoulderLoadTrend: 'stabil'` constant, not rendered), schedule `team`/`season`, gym schedule `time`/`duration` (no schedule-template table in Phase 2). Insights/Knowledge/Chat will be seed-only even when their backend lands (Slice D) — AI populates them in Phase 3.
- **Deferred infra**: offline-queue / PWA cache is noted as "later" in the design spec §3 — not built.

## 10. Key files

- `frontend/src/data/hooks.ts` — **THE single FE↔data boundary**; ~22 hooks, re-exports `useTrain`/`useRunning`.
- `frontend/src/data/trainHooks.ts` — `useTrain` (richest dual-mode hook: 7 queries, 11 mutations, DTO→display mappers).
- `frontend/src/data/runningHooks.ts` — `useRunning` (cleanest idiom: full `setQueryData` mock emulation, generated types as view model).
- `frontend/src/lib/mode.ts` — `isMockMode()`, the per-call mode switch.
- `frontend/src/lib/api.ts` — `apiFetch`, `API_BASE`, `setToken`, `ApiError`, `SystemMessage`.
- `frontend/src/lib/auth.ts` — `bootstrapOwnerToken` (silent owner login).
- `frontend/src/lib/biometricsApi.ts` / `trainApi.ts` / `runningApi.ts` — typed REST clients over `apiFetch`.
- `frontend/src/lib/api.gen.ts` — generated contract types (openapi-typescript; do not edit).
- `frontend/src/lib/dates.ts` — ISO→Hungarian display formatting used by Train mappers.
- `frontend/src/app/providers/QueryProvider.tsx` — app-wide `QueryClient` + real-mode token bootstrap gate.
- `frontend/src/main.tsx` — mounts `QueryProvider` above the router.
- `frontend/src/components/ui/GhostState.tsx` — clean-slate empty-state skeleton (the no-fallback rule).
- `frontend/src/test/queryWrapper.tsx` — `QueryWrapper` + `makeHookWrapper()`.
- `frontend/src/test/setup.ts` — storage shim + MSW lifecycle.
- `frontend/src/test/msw/handlers.ts` / `server.ts` — MSW handlers (keyed off `API_BASE`).
- `frontend/src/data/types.ts` — FE domain types (`WeightEntry`, `SleepEntry`, `Mesocycle`, …) DTOs map to.
- `frontend/.env.example` — `VITE_API_URL`, `VITE_OWNER_EMAIL/PASSWORD`, `VITE_USE_MOCK`.

**Related docs (link, don't duplicate):** `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (the foundational decision — §1 invariant, §3 FE integration, §5 slice map); `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` (cleanest hook-wiring reference); `docs/references/api_contract_conventions.md` (contract-first FE↔BE type flow); `docs/references/error_handling.md` (the `SystemMessage` contract `apiFetch` mirrors); `docs/milestones/roadmap.md` (Phase-2 slice status — Slices C/D/E remaining).
