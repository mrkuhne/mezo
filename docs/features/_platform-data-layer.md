---
title: Platform · Data Layer & Dual-Mode
type: feature-platform
status: done
updated: 2026-07-11
tags: [platform, data-layer, frontend]
key_files:
  - frontend/src/data/hooks.ts
  - frontend/src/data/train/trainHooks.ts
  - frontend/src/data/me/goalHooks.ts
  - frontend/src/data/me/biometricHooks.ts
  - frontend/src/data/fuel/pantryHooks.ts
  - frontend/src/data/_client/mode.ts
  - frontend/src/data/_client/api.ts
  - frontend/src/app/providers/QueryProvider.tsx
related: [_platform-api-backend, _platform-auth-security, train, me, goal-engine]
---

# Platform · Data Layer & Dual-Mode — Feature Documentation

> The single FE↔data boundary (`frontend/src/data/hooks.ts`) + the `isMockMode()` dual-mode switch + the TanStack Query wiring + the typed REST clients. **Status:** ✅ done (cross-cutting platform layer; some hooks 🔶 mock-only — see §2). Not a screen — it sits under **every** route/tab; the wired domains are Me (biometrics + goal), Train/Futás, and Fuel's **Pantry/Kamra** (slice C).

This is the cross-cutting plumbing every feature consumes, so this doc is named with a leading `_` (a platform doc, not a single user-facing slice). Read it before wiring any new domain to the backend.

## 1. Summary

`frontend/src/data/hooks.ts` is the **single integration boundary** between every React view and the data layer. Each feature imports its data exclusively as `useX()` hooks from `@/data/hooks` (~22 hooks). Every hook can run in one of two modes, switched **per call** by `isMockMode()` (`frontend/src/data/_client/mode.ts`, which reads `VITE_USE_MOCK`):

- **Mock mode**: returns the byte-identical Phase-1 static data, seeded *synchronously* via TanStack Query `initialData` (or plain `useState`), with write mutations that either no-op or emulate the server in-cache via `queryClient.setQueryData`. No backend needed — this is what the Playwright parity run and most component tests use.
- **Real mode** (`VITE_USE_MOCK=false`): the *same hook signature*, but `queryFn` calls a typed REST client (`data/me/biometricsApi.ts` / `data/train/trainApi.ts` / `data/train/runningApi.ts`) over `apiFetch` (`data/_client/api.ts`) against the Spring Boot backend; mutations persist then `invalidateQueries`. **There is no static fallback in real mode** — an empty backend resolves to `null`/`[]`, and views "ghost-guard" (render a `GhostState` skeleton) instead of silently showing demo data.

The **key invariant**: the public return shape of every hook is the contract. Swapping a hook from mock to real changes only the hook's internals — **no component changes** — so parity screenshots and component tests stay green through the swap.

Driving design: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (§1 "Key invariant", §3 frontend integration, §5 slice map; decision `mezo-gqi`). There is **no dedicated numbered ADR** for the dual-mode pattern — this doc is its durable home.

## 2. Status per domain (mock-vs-real — be precise)

Several API clients exist (biometrics · train · running · goal · goal-link · biometric-profile · **pantry**); only those domains are wired to a real backend. Everything else is **mock-only on the FE** (no API client, no backend table yet).

| Hook(s) | Domain | Status |
|---|---|---|
| `useWeight` (`logWeight`), `useSleep` (`logSleep`), `useCheckins` (`saveCheckIn`) | Biometrics (weight / sleep / check-in) | ✅ **dual-mode, real backend done** (Phase 2 Slice A). Client `data/me/biometricsApi.ts`. `useWeight` (`data/me/weightHooks.ts`) is the weight half of the former `useGoals`. **G5 (`mezo-g1u`) made the weight *trend* real too:** real mode now runs a second `['weightTrend']` query (`weightApi.trend` → `GET /api/biometrics/weight/trend`) and folds the backend's EWMA weekly rates into the `weightTrends` shape; mock mode keeps the static `mockWeightTrends`. The qualitative legs the engine does not yet produce (factors/insights/projection) stay mock as a fallback. |
| `useGoal` (read-only) | Goal (`Cél`) | ✅ **dual-mode read, real backend done** (goal-system G1 `mezo-2hp` + G3 `mezo-3sc` + G4b `mezo-tji`). Hook `data/me/goalHooks.ts:57`, clients `data/me/goalApi.ts` + `data/me/goalLinkApi.ts`. Reads the active goal **and its real linked plans** (G3 timeline). **Since G4b the return shape is additively wider** — `{ goal, goalResponse, linkedMesocycles, timeline, goalId }`: the raw `goalResponse` (so the command-center hero reads trajectory/guards/window/weights straight off the contract — Decision C), the raw `timeline` (the `<GoalTimeline>` lane consumes `timeline.links[]` for lane positions), and `goalId` (the attach/detach target). Goal **management** (archive/delete/attach/detach) ships as a separate mutation hook ↓; goal **creation** ships as another ↓. Since the X audit (`mezo-t16y.4`) its internal `['weightLog']` read carries `weightApi.list` as queryFn (deduped with `useWeight`) — the old fn-less cache subscription logged a TanStack missing-queryFn error on every mount and stayed empty unless `useWeight` happened to be mounted too. |
| `useGoalActions` (`archive`/`remove`/`activate`/`attachPlan`/`detachPlan`/**`evaluate`**/`pending`/`evaluating`) | Goal management + **engine** (`Cél`) | ✅ **dual-mode write, real backend done** (goal-system G4b `mezo-tji`; **`evaluate` added G5 `mezo-g1u`**). Hook `data/me/goalHooks.ts:114`, clients `data/me/goalApi.ts` + `data/me/goalLinkApi.ts`. The command-center's goal mutations — `archive`/`remove`/`activate` (→ `goalApi.*`), `attachPlan`/`detachPlan` (→ `goalLinkApi.attach`/`detach`), and **`evaluate(goalId)`** (→ `goalApi.evaluate` → `POST /api/goals/{id}/evaluate`, runs the G5 TDEE/recept engine). Real mode invalidates `['goals']` after every action **and additionally `['goal', goalId, 'timeline']` for attach/detach/evaluate** (so the lane + the fresh `prescription` re-render); **mock no-ops** (resolves so the UI fire-and-forgets). Each action returns the mutation promise (callers `await`/chain navigation); `pending` ORs all six mutations' `isPending`, plus a dedicated `evaluating` flag for the evaluate-CTA spinner. The prescription itself is **read** via `useGoal().goalResponse.prescription` (no separate hook). |
| `useGoalCreation` (`submit`/`pending`) | Goal creation (`Cél`) | ✅ **dual-mode write, real backend done** (goal-system G4a `mezo-pqt`; biometrics dropped G6 `mezo-06n`). Hook `data/me/goalHooks.ts`. The first goal **write** path: `submit` runs a `useMutation` that (real) `goalApi.create` → optional `goalApi.activate`, then invalidates `['goals']` — **the `biometricProfileApi.upsert` step was removed in G6** (biometrics are a Profile precondition now); **mock no-ops** (resolves `null` so the wizard navigates back). Drives the `GoalPlannerPage` wizard. |
| `useFeasibilityPreview` (`draft` → preview) | Goal creation cél step (`Cél`) | ✅ **dual-mode read, real backend done** (goal-system G6 `mezo-06n`). Hook `data/me/goalHooks.ts:229`, client `data/me/goalApi.ts` (`feasibilityPreview` → `POST /api/goals/feasibility-preview`). Debounces the draft window internally (~400ms) into a `useState`, then keys a `useQuery` on it — real mode POSTs the draft, **mock returns the static `feasibilityPreview`** (`data/me/goals.ts`). Powers the wizard's live rate/verdict panel; `enabled:false` (maintain / no target / inverted window) → `undefined`. Stateless, no persistence. |
| `useBiometricProfile` (`{ profile, isComplete, isLoading }`) | Biometric profile (`Profil` → Me) | ✅ **dual-mode read, real backend done** (goal-system G6 `mezo-06n`). Hook `data/me/biometricHooks.ts:19`, client `data/me/biometricProfileApi.ts` (`get` → `GET /api/biometrics/profile`). Reads `['biometricProfile']`; **a `404` is a normal "not set up" state, caught → `null`** (any other status rethrows). `isComplete` is the gate predicate (`sex && heightCm && birthDate` all present). **Mock returns a static complete profile** (`data/me/goals.ts` `biometricProfile`). The Profil "Biometria" card + the goal-creation hard gate (`GoalGate`) both read it; the card shows the derived base-TDEE (`tdeeBootstrap`). |
| `useBiometricActions` (`upsert`/`pending`) | Biometric profile write (`Profil` → Me) | ✅ **dual-mode write, real backend done** (goal-system G6 `mezo-06n`). Hook `data/me/biometricHooks.ts:51`, client `data/me/biometricProfileApi.ts` (`upsert` → `PUT /api/biometrics/profile`). Real mode PUTs then invalidates **both `['biometricProfile']`** (card/gate re-read) **and `['goals']`** (the backend recomputes the active goal's `tdeeBootstrap`/`prescription` on profile change — the 5th recompute trigger). **Mock no-ops** (resolves `null` so the `BiometricSheet` editor `.then(close)`s). Returns the mutation promise. |
| `useTrain` (mesocycles, workout-execution, sport, exercise catalog/records) | Train | ✅ **dual-mode, real backend done** (Slice B + T0–T3 + catalog/records). Hook `data/train/trainHooks.ts`, client `data/train/trainApi.ts`. |
| `useRunning` ("Futás") | Running | ✅ **dual-mode, real backend done** (R0–R4). Hook `data/train/runningHooks.ts`, client `data/train/runningApi.ts`. |
| `usePantry` (`{ ingredients, stash, sources, categoryMeta, imports, suggestions }`) + `usePantryActions` (`addItem`/`updateItem`/`deleteItem`) | Pantry / Kamra (**Fuel** slice C) | ✅ **dual-mode, real backend done** (Fuel slice C · Pantry `mezo-9xu`). Hooks `data/fuel/pantryHooks.ts` (re-exported from `hooks.ts`), client `data/fuel/pantryApi.ts` (`GET/POST/PUT/DELETE /api/pantry`). `usePantry` keeps its exact pre-existing return shape: mock mode returns the static seed via `initialData` (`staleTime: Infinity` so mock-cache edits survive), real mode reads `ingredients`/`stash` **and — since Fuel P6 (`mezo-bka`) — the REAL `imports`/`suggestions`** from `pantryApi.list()` (they ride the same `PantryResponse`; honest-empty arrays), `sources`/`categoryMeta` stay static config. `usePantryActions` mutates the `['pantry']` cache in mock mode, calls `pantryApi.create/update/remove` + invalidates in real mode (the `useWeight` dual-mode pattern), and since P6 adds `importItem` (mutateAsync — `POST /api/pantry-import` / mock cache-append) + `lookupItems` (uncached OFF lookup — `GET /api/pantry-import/lookup` / mock `pantryLookupFixture`). |
| `useFuelTimeline` (`{ plan, getScoredMeal }`) + `useFuelPreview` (`{ visible, nextStack }`) | **Fuel** "Mai" timeline + Today preview | ✅ **dual-mode, client-composed** (Fuel P5 · `mezo-9ys`). Hook `data/fuel/timelineHooks.ts` (re-exported from `hooks.ts`); `useFuelPreview` (`data/today/todayHooks.ts`) slices the same plan. Mock returns the hand-authored `fuelPlan.today` seed; real **composes** the live day from the already-real reads (`useFuelDay`/`useRecipes`/`useGoal`/`useProtocol`/`useStack`/`useIntakes`/`useTrain`/`useRunning`) through the pure `buildDayPlan` — no new endpoint (the only P5 backend work is the goal's three day-planner settings). |
| `useToday` + `useQuickStats` + `useInsightsTeaser` + `useBriefing` (+ `useCheckins` read) | **Today** | ✅ **dual-mode, deterministic composition** (Slice T · `mezo-t16y.3`). Hooks `data/today/todayHooks.ts` + `checkinHooks.ts` — real mode composes EXISTING real reads (`useTrain` today session/meso/schedules, `useSleep`/`useWeight`, `usePatterns`) + the real date; mock returns the Phase-1 statics byte-identically. Demo-only copy (`prediction`, `volleyballNote`) is `null` in real mode. **Since proactive B1.2 (`mezo-h4wp.2`) the briefing is real too** — `useBriefing` (`data/today/briefingHooks.ts`, real `GET /api/proactive/briefing?date=`; mock null synchronously) threads through `useToday`, `briefingDemo = serverBriefing == null`, and the static „Demo tartalom" card is only the honest fallback (loading / 404 / switch off). See `today.md` §3 / `proactive.md`. |
| `useFuelWeek` (`fuelWeekHooks.ts`) | **Fuel** Terv | ✅ **dual-mode** (Fuel P4 · `mezo-kpo`) — Train-derived week + `GET /api/fuel/week/{start}` rollup stats; see `fuel.md`. |
| `useProfile`, `useReplanScenarios`, `useStackRecommendations`, `useInsights` | Me/Profile, **Fuel**, **Insights** | 🔶 **MOCK-ONLY.** (`usePeople` graduated in Slice E `mezo-t16y.2` — dual-mode `data/me/peopleHooks.ts`, real `logMention` POST; `useProfile` is a RECORDED static — see `me.md` §9.) Plain static returns or local `useState`; no API client, no `isMockMode` branch, no backend table. (The Fuel **meal / water / recipe / medication / stack / protocol / timeline** hooks — `useFuelDay`/`useMealActions`/`useWaterActions`/`useRecipeLogs`/`useRecipes`/`useMedication`/**`useStack`/`useProtocol`** + `useStackActions`/`useProtocolActions` + **`useFuelTimeline`/`useFuelPreview`** — are already **dual-mode / real** since mezo-arb/lns/d94/0z5/09g/9ys; see `fuel.md`. `useStackRecommendations` above is **mode-aware** — `[]` in real mode until Fuel P8. The **Insights chat + knowledge + patterns + weekly** hooks are dual-mode/real too: `useChat`/`useChatActions` since companion V0.4, `useKnowledge`/`useKnowledgeActions` since V1.2, `usePatterns`/`usePatternActions` since V3.1 — see `companion.md` §5 — and **`useWeekly` since D′ (`mezo-t16y.1`)**, dual-mode by **client-side composition** over existing Fuel/Train/biometrics reads, no Insights backend (`data/insights/weeklyHooks.ts`; split out of `useInsights`, which no longer returns `weekly` — see `insights.md` §2.2/§3), and **`useMemoir` since proactive W2 (`mezo-h4wp.4`)**, dual-mode over the proactive `GET /api/proactive/memoir` (`data/insights/memoirHooks.ts`; 404→null→honest „készül" state; also split out of `useInsights`). `usePredictions` since proactive P1 (`mezo-h4wp.7`) over the LIST `GET /api/proactive/prediction`, and **`useExperiments`/`useExperimentActions` since P2 (`mezo-h4wp.8`)** over `GET /api/proactive/experiment` + the L2 decision/propose write mutations (`data/insights/experimentsHooks.ts`; `[]`→honest null-state) — both split out of `useInsights`. **`useInsights` now has NO live consumers** (every Insights tab has its own dual-mode hook; memoir W2, predictions P1, experiments P2 — the proactive epic is complete).) **All D′/E/T Phase-2 completion slices shipped; remaining Phase-2 work is Fuel P6/P7 (`mezo-6r1`)** (`docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md`). |
| `useTodayScenario` | Today demo switch | 🔶 URL-param demo (`?day=`/`retaDay=`/`niggle=`/`vulnerable=`) — the params survive real mode by design (dev affordance); the `retaDay` base is real (`useMedication().cycle`) since mezo-d94. |

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
            ├─ const mock = isMockMode()          ← data/_client/mode.ts (VITE_USE_MOCK !== 'false')
            ├─ useQuery({ queryFn: mock ? async()=>STATIC : xApi.list,
            │             initialData: mock ? STATIC : undefined })
            └─ useMutation({ mutationFn: mock ? (no-op | setQueryData) : xApi.write,
                             onSuccess: mock ? setQueryData : invalidateQueries })
                 └─ xApi.*  [data/me/biometricsApi.ts | trainApi.ts | runningApi.ts]
                      └─ apiFetch<T>(path, init)   ← data/_client/api.ts
                           ├─ fetch(`${API_BASE}${path}`)  API_BASE = VITE_API_URL ?? :8090
                           ├─ Authorization: Bearer <token>  (module-level token, setToken())
                           └─ !res.ok → throw ApiError(SystemMessage[], status)
                                └─ Spring @RestController → @Service → JPA Repository → Postgres
```

**`apiFetch` contract** (`frontend/src/data/_client/api.ts:22`): prepends `API_BASE` (`VITE_API_URL ?? 'http://localhost:8090'`), sets JSON + Bearer headers, returns `undefined` for `204`, otherwise parses JSON. On `!res.ok` it throws `ApiError(messages: SystemMessage[], status)` where `SystemMessage = { code, message, fieldName?, exceptionTraceId? }` — mirroring the backend's `@RestControllerAdvice` contract (see `docs/references/error_handling.md`).

**`apiSse` — the streaming sibling (companion V0.4, same file):** an async generator over `fetch` + `ReadableStream` that yields `{ event, data }` SSE frames (POST-capable and Bearer-capable, which `EventSource` is not; dual `Accept: text/event-stream, application/json` so pre-stream failures throw the same `ApiError` as `apiFetch`). Sole consumer today: `data/insights/chatApi.streamMessage` (the streamed chat turn — [`companion.md`](companion.md) §3). Streaming reads sit **outside** `useDualQuery` by design — the mutation-plus-incremental-append lives in the hook layer (`useChatActions`).

**Provider / bootstrap** (`frontend/src/app/providers/QueryProvider.tsx`, mounted above the router in `frontend/src/main.tsx`):

- One app-wide `QueryClient` with `defaultOptions.queries: { staleTime: 30_000, retry: 1 }`.
- **Global write-error feedback (mezo-ah18.8):** the client carries a `MutationCache.onError` that
  `console.error`s the failure and emits a Hungarian error toast (short `exceptionTraceId` appended
  when the failure is an `ApiError`) through `shared/lib/toastBus` → the `ToastProvider` host in
  `AppLayout`. Every failed mutation is surfaced; per-mutation `onError` handlers still run on top
  for richer handling. Mock-mode mutations no-op successfully, so mock never toasts errors.
- In **real mode** the provider gates rendering on `bootstrapOwnerToken()` (`frontend/src/data/_client/auth.ts`): POSTs `VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD` to `/api/auth/login`, then `setToken(token)` so `apiFetch` injects the Bearer header. `ready` starts `false` and renders `null` until the token lands — *or* until login fails, in which case it renders anyway so the app degrades gracefully. In **mock mode** `ready` starts `true` and no login is attempted.
- `setToken` stores the JWT in a **module-level `let token`** in `data/_client/api.ts:19` (not `localStorage`) — there is no login UI; ownership is single-user.

### The dual-mode pattern (the load-bearing recipe)

Canonical read+write example, `useWeight` (`frontend/src/data/me/weightHooks.ts:33`):

```ts
const mock = isMockMode()
const { data: weightLog = [] } = useQuery({
  queryKey: ['weightLog'],
  queryFn: mock ? async () => initialWeightLog : weightApi.list,
  // Mock seeds SYNCHRONOUSLY so the first render matches Phase-1 useState (parity + tests).
  initialData: mock ? initialWeightLog : undefined,
})
// G5 (mezo-g1u): the trend is now REAL in real mode — a SECOND query on its own key.
// NOTE: uses the useDualQuery helper, NOT a `= mockWeightTrends` destructuring default —
// see "The 'no static fallback in real mode' rule" + useDualQuery below (mezo-0xl).
const { data: weightTrends } = useDualQuery({
  queryKey: ['weightTrend'],
  mockData: mockWeightTrends,
  realFetch: async () => foldTrend(await weightApi.trend()),   // GET /api/biometrics/weight/trend
  realEmpty: { last7d: { avg: 0, weeklyRate: 0 }, last4w: { weeklyRate: 0 } },  // real load: zeros, never the seed
})
const mutation = useMutation({
  mutationFn: mock
    ? async (input: WeightLogInput): Promise<WeightEntry> =>          // emulate server response
        ({ date: input.date, value: input.weightKg, note: input.note })
    : weightApi.log,                                                  // real POST
  onSuccess: (entry) => {
    if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])  // patch cache
    else {
      qc.invalidateQueries({ queryKey: ['weightLog'] })    // refetch the log
      qc.invalidateQueries({ queryKey: ['weightTrend'] })  // a weigh-in shifts the EWMA → refetch the trend too
    }
  },
})
```

`initialData` in mock mode means the query is never "pending" — the first render already has data, matching the old Phase-1 synchronous `useState`. This is what keeps parity screenshots and component tests green. In real mode `initialData` is `undefined`, so the query loads and the view must ghost-guard.

**`useDualQuery` (`frontend/src/data/useDualQuery.ts`) — the sanctioned dual-mode read recipe (mezo-0xl).** It bakes the whole pattern AND the "no static fallback in real mode" rule into one helper: `useDualQuery({ queryKey, mockData, realFetch, realEmpty, realStaleTime? })` does `initialData: mock ? mockData : undefined`, `queryFn: mock ? () => mockData : realFetch`, `staleTime: mock ? Infinity : realStaleTime`, and returns `data: q.data ?? (mock ? mockData : realEmpty)`. The load-bearing detail is the `realEmpty` fallback: in real mode, while the query is unresolved, the hook returns `realEmpty` — **never the mock seed.** This closes the `const { data = mockSeed } = useQuery(...)` footgun (the destructuring default fires for the entire real-mode loading window, flashing the Phase-1 demo seed onto a live user's screen — the mezo-yew / mezo-0xl bug class). All four formerly-leaking dual-mode reads (`usePantry` → `realEmpty {ingredients:[],stash:[]}`, `useRecipes` → `[]`, `useFuelDay` → a zero `FuelDay`, `useWeight`'s `weightTrends` arm → a zero trend) now go through it; the already-safe hooks (`= []`, `?? null`, `isPending`) were left as-is. A guard test (`frontend/src/data/dualMode.guard.test.ts`) fails the build if the leaky `{ data = seed } = useQuery` default reappears in any `src/data` hook — so new dual-mode hooks must use `useDualQuery` (or an empty-literal default), not the seed-default. (Consumer corollary: a zero `realEmpty` can momentarily divide by zero, so percent math uses the shared `pct(a,b)` helper (`frontend/src/shared/lib/pct.ts`) that guards `b===0 → 0`; `MacroHero` and the `LogMealSheet` daily-context bar both use it instead of a raw `a/b*100` that would render `NaN%`.)

**The trend fold (G5, `mezo-g1u`)** is the one place a hook reconciles a *real partial backend* with a *static remainder*: `foldTrend` (`weightHooks.ts:15`) overwrites only the fields the backend `WeightTrendResponse` actually computes — `last7d.avg ← latestTrendKg`, `last7d.weeklyRate ← weeklyRateKgPerWeek`, `last4w.weeklyRate ← last4wRateKgPerWeek` — and spreads the static `mockWeightTrends` for the legs the engine doesn't yet produce (factors/insights/`sinceStart.projected*`). So the goal hero's "Tempó" + the Súly rate cells are real in real mode, while the qualitative copy stays mock until Fuel intake + the Insights pipeline land. The hook's return signature is unchanged — consumers read the same `WeightTrends` field names.

**Three mutation flavors across the codebase:**

- **Optimistic cache emulation** (mock) → `setQueryData`: `useWeight.logWeight`, `useSleep.logSleep`, `useTrain.logSportSession` (appends a synthesized `SportSession` stamped with today's date to `['train','sportSessions']` so the `Mai` done-state flips offline — mezo-pyc; **real mode still POSTs to `/api/train/sport-sessions` + invalidates**, the DB is the source of truth), and all of `useRunning`'s mock mutations (`upsertMock`/`lifecycleMock`/`logMock` in `data/train/runningHooks.ts:38`) which fully re-implement create/update/activate/close/delete/log in-cache so mock interactions behave like a server — including **server-derived fields**: `upsertMock` computes `currentWeek` via `currentWeekOf` (`shared/lib/dates.ts`) exactly as the backend's `clampWeek` does, so a mock-created block isn't stuck on week 0 (mezo-478).
  - **Exception — real-mode *create* also `setQueryData`s** (mezo-11m, `runningHooks.ts:52`): `useRunning`'s save mutation's `onSuccess` branches — for a real-mode *create* (`!mock && !args.id`) it inserts the returned block into `['running','blocks']` **synchronously** and skips the invalidate, because the server response is authoritative for the just-created row and an async refetch races a navigate-into-the-builder (read-after-write could transiently drop it). Real-mode *updates* and all mock paths still `invalidate()`. This is the one place a real-mode mutation patches the cache directly instead of refetching truth.
- **Pure no-op** (mock) → `async () => undefined`, real → persist + `invalidateQueries`: `useTrain`'s remaining **sixteen** write mutations (all except `logSportSession`, which now does a mock cache-append — see above; incl. `gymScheduleMutation` → PUT `/gym-schedule`, invalidates `['train','gymSchedule']`; the active-workout-v2 writes `skipExercise` → POST `/workouts/{id}/skip` and `saveExerciseNote` → PUT `/exercises/{id}/note`, both invalidating `['train','workoutToday']`; and the **catalog-authoring** writes `createCatalogExercise`/`updateCatalogExercise`/`deleteCatalogExercise`/`setExerciseVideo` → POST/PUT/DELETE `/exercises` + PUT `/exercises/{id}/video`, all invalidating `['train','exerciseCatalog']` — mezo-52zg); rationale in-code — "mock mode no-ops (Phase-1 local behavior stays untouched)".
- **Local `useState` (no query at all)**: none left — `usePeople` graduated in Slice E (`mezo-t16y.2`) to a dual-mode bootstrap (`data/me/peopleHooks.ts`, key `['people']`; `logMention` real-POSTs + invalidates, mock cache-prepends the client-minted `Mention`). (`useCheckins` graduated in Slice T: real mode reads `['checkins', date]` and overlays a local optimistic layer; the save invalidates the day query — see `today.md` §3.)
- **Read-only, with a derived/mapped result** (no mutation): `useGoal` (`data/me/goalHooks.ts:57`, G1+G3+G4b) reads `['goals']` (`queryFn = mock ? () => null : goalApi.list`), picks the active goal, and maps `GoalResponse → Goal` via `toGoal` so the legacy consumers (`WeightPage`/`FuelStackPage`/`EditGoalSheet`) keep the flattened domain shape. It **also reads `['weightLog']` with no `queryFn`** — deliberately sharing the cache `useWeight` owns — to derive `currentWeight` from the latest weight entry without a second fetch. Two queries on one cache key (one owns the fetch, the other rides it) is the idiom G1 introduces. **G3 adds a third query** `['goal', goalId, 'timeline']` (`queryFn = goalLinkApi.timeline`, `enabled: !mock && !!goalId`) — its `links` are mapped to the legacy `linkedMesocycles` (`Record<planId, LinkedMeso>`) and `goal.mesocycles` (`toLinkedMesocycles`, `data/me/goalHooks.ts:42`). **G4b widened the return shape additively** (`data/me/goalHooks.ts:106`): it now also exposes the **raw `goalResponse`** (the command-center hero reads trajectory/guards/window/weights straight off the contract, so `toGoal` could retire its `startDate`/`targetDate`/`unit` fields — Decision C), the **raw `timeline`** (the `<GoalTimeline>` lane needs `timeline.links[]` for lane positions, which `LinkedMeso` can't carry), and **`goalId`** (the attach/detach target). Mock mode (`data/me/goalHooks.ts:79`) returns the static `mockGoal`/`mockGoalResponse`/`linkedMesocycles` **plus a static `goalTimeline`** (`data/me/goals.ts:84` — Decision A: a real `GoalTimelineResponse`, not `null`, so the lane renders the same lanes/gaps offline) and `goalId = mockGoal.id`.
- **Sibling mutation hook to a read hook** (G4b + G5): `useGoalActions` (`data/me/goalHooks.ts:114`) carries the command-center's **six** goal mutations — `archive`/`remove`/`activate` (→ `goalApi.archive`/`remove`/`activate`), `attachPlan`/`detachPlan` (→ `goalLinkApi.attach`/`detach`), and **`evaluate`** (G5 `mezo-g1u`, → `goalApi.evaluate` → `POST /api/goals/{id}/evaluate`, runs the backend TDEE/recept engine). The split mirrors the read/write separation of `useGoal` vs `useGoalCreation`: `useGoal` stays a pure read, mutations live in their own hook so a view subscribes to only what it needs. **Real-mode invalidation is two-tier** — every action's `onSuccess` invalidates `['goals']`; attach/detach **and `evaluate`** additionally invalidate `['goal', goalId, 'timeline']` (the lane's source + so the fresh `prescription` reappears) — while **mock no-ops** (each `mutationFn` early-returns under `isMockMode()`, since `mockGoalResponse.prescription` already renders the static recept). Every action wraps `mutateAsync` (returns the promise, so callers `await`/chain a navigate); `pending` ORs all six `isPending` flags, plus a dedicated `evaluating` flag drives the evaluate-CTA spinner. **The prescription/tdeeBootstrap the engine produces are not a separate query** — they ride `useGoal().goalResponse` (the engine persists them onto the goal, so the `['goals']` refetch surfaces them).
- **Sequential multi-write mutation** (G4a; biometrics dropped G6 `mezo-06n`): `useGoalCreation` (`data/me/goalHooks.ts:199`) is the goal-creation save chain — its `mutationFn` awaits `goalApi.create` → optional `goalApi.activate` before `onSuccess` invalidates `['goals']`. **The `biometricProfileApi.upsert` step was removed in G6** — biometrics are now a Profile precondition (the `useBiometricProfile` hard gate), not a wizard payload — so the input narrowed to `GoalCreationInput = { goal: GoalUpsertRequest; activate: boolean }` (`goalHooks.ts:194`). Mock mode returns `null` (no-op). Exposes `{ submit, pending }` and takes a per-call `{ onSuccess }` so the `GoalPlannerPage` wizard can navigate back.

### The "no static fallback in real mode → ghost-guard" rule

Real mode must surface an empty backend as `null`/`[]`, never as Phase-1 demo data. **For a query whose mock seed is a static literal, use `useDualQuery` (above) — its `realEmpty` enforces this rule and the `dualMode.guard.test.ts` guard fails the build if a hook regresses to a `{ data = seed } = useQuery` default.** For hooks that derive/join their result, branch the *return value*, not just the query (`data/train/trainHooks.ts:355`):

```ts
activeMeso: realActiveMeso ?? (mock ? activeMeso : null),   // mock falls back to static, real stays null
workout:    mock ? trainWorkout : toWorkoutPlan(todayData),
gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso, gymSlots),  // joins meso gym-days × standalone gym-time slots
```

Hooks also expose a **`*Pending` flag** (`workoutPending` = `!mock && (mesoPending || todayPending)` at `trainHooks.ts:364`; `runningPending` = `!mock && isPending` at `runningHooks.ts:90`), so route guards/views can wait instead of flashing the empty ghost before data lands.

**Ghost-guard consumption** — `frontend/src/shared/ui/GhostState.tsx` (a faint skeleton + a one-line Hungarian message + optional CTA, "T0 clean-slate option C"). Views render it when a real-mode hook returns null/empty, e.g. `MesocycleLibraryPage.tsx` → `"Még nincs mesociklusod — itt fognak élni a blokkjaid."`, `RunningPage.tsx` → `"Nincs aktív futóterved — a Tervek fülön aktiválj egyet."` and `"Betöltés…"` while pending. `SportPage.tsx` is one of the rare places a *view* calls `isMockMode()` directly — to hide the schedule-edit affordance in mock mode (`onEdit={isMockMode() ? undefined : …}`).

## 5. Data model & API

The FE↔BE boundary types are **generated, never hand-written** (see `docs/references/api_contract_conventions.md`): `api/feature/<x>/<x>.yml` → merged `api/openapi.yml` → `openapi-typescript` → `frontend/src/data/_client/api.gen.ts` (`pnpm generate:api`). Clients pull types as `components['schemas'][...]`.

**Endpoints by client:**

- `biometricsApi` (`data/me/biometricsApi.ts`): `GET/POST /api/biometrics/weight`, **`GET /api/biometrics/weight/trend`** (the EWMA trend, G5 `mezo-g1u` — `weightApi.trend` → `WeightTrendResponse`), `GET/POST /api/biometrics/sleep`, `GET ?date= / POST /api/biometrics/checkin`. Types `WeightLogResponse`/`LogWeightRequest`, `WeightTrendResponse`, `SleepLogResponse`/`LogSleepRequest`, `CheckInResponse`/`SaveCheckInRequest`.
- `goalApi` (`data/me/goalApi.ts`, G1; `evaluate` G5; `feasibilityPreview` G6): `GET/POST /api/goals`, `GET/PUT/DELETE /api/goals/:id`, `POST /api/goals/:id/activate`, `POST /api/goals/:id/archive`, **`POST /api/goals/:id/evaluate`** (G5 `mezo-g1u` — runs the engine, returns the goal carrying the fresh `prescription`/`tdeeBootstrap`), **`POST /api/goals/feasibility-preview`** (G6 `mezo-06n` — stateless; derived %BW/wk pace + verdict + cap-paced realistic date). Types `GoalResponse`/`GoalUpsertRequest` (the latter no longer carries `rateTargetPctPerWeek` — server-derived since G6), `FeasibilityPreviewRequest`/`FeasibilityPreviewResponse`. (`useGoal` consumes `list`; `useGoalActions` consumes `archive`/`remove`/`activate`/`evaluate`; `useFeasibilityPreview` consumes `feasibilityPreview`.)
- `goalLinkApi` (`data/me/goalLinkApi.ts`, G3): `GET /api/goals/:id/timeline`, `POST /api/goals/:id/plans`, `DELETE /api/goals/:id/plans/:linkId`. Types `GoalTimelineResponse`/`GoalPlanLinkResponse`/`GoalPlanAttachRequest`. (`useGoal` consumes only `timeline` today; attach/detach are wired but unused until the G4 UI.)
- `biometricProfileApi` (`data/me/biometricProfileApi.ts`, G1; **consumed G6** `mezo-06n`): `GET/PUT /api/biometrics/profile` (`get`/`upsert`). Types `BiometricProfileResponse` (now carries a derived `tdeeBootstrap`)/`BiometricProfileUpsertRequest`. Consumed by `useBiometricProfile` (`get`, 404→null) + `useBiometricActions` (`upsert`).
- `questApi` (`data/quest/questApi.ts`, gamified growth E1 `mezo-df7q`): `GET /api/quest/day/{date}` (`day` — quests + `levelUps` + `rerollsLeft`), `POST /api/quest/{id}/reroll` (`reroll`). Consumed by `useDailyQuests`/`useQuestActions` (`data/quest/questHooks.ts`) — manual dual-mode shape (not `useDualQuery`: the read carries side-channel fields beside the list), real mode returns the empty day while unresolved. See [`growth.md`](growth.md).
- `activityApi` (`data/activity/activityApi.ts`, gamified growth E2 `mezo-jzca`): `GET /api/activity/day/{date}` (`day`), `POST /api/activity` (`create`), `POST /api/activity/{id}/category` (`categorize`) — each write returns `ActivityWriteResult{entry, completedQuest?, levelUps[]}`. Consumed by `useActivities` (`useDualQuery`, `['activities', date]`) + `useActivityActions` (`data/activity/activityHooks.ts`); the write invalidates `['activities', date]` + `['dailyQuests', date]` + `['progressionProfile']`. Mock mode has a deterministic classifier. See [`growth.md`](growth.md).
- `trainApi` (`data/train/trainApi.ts`): `mesocycles` (GET), `sport-sessions` (GET), mesocycle `create`/`:id/activate`/`:id/close`, `:mesoId/days/:dayId/exercises` (PUT), `workouts/today` (GET), `workouts` (start), `workouts/:id/sets` (logSet), `workouts/:id/skip` (skipExercise, F3), `workouts/:id/feedback`, `workouts/:id/finish`, `exercises/:exerciseId/note` (saveExerciseNote PUT, F4), `sport-schedule` (GET/PUT), `gym-schedule` (GET/PUT — `gymSchedule`/`replaceGymSchedule`), `exercises` (catalog GET **+ POST create / PUT update / DELETE** a user exercise + `exercises/:id/video` PUT — catalog authoring, mezo-52zg), `exercise-records` (GET). 24 endpoints.
- `runningApi` (`data/train/runningApi.ts`): `running-blocks` (GET/POST), `running-blocks/:id` (PUT/DELETE), `:id/activate`, `:id/close`, `run-sessions` (GET/POST).
- `pantryApi` (`data/fuel/pantryApi.ts`, Fuel slice C `mezo-9xu`): `GET /api/pantry` (the kind-split `PantryResponse` → `{ ingredients, stash }`), `POST /api/pantry`, `PUT/DELETE /api/pantry/:id`, + since Fuel P6 (`mezo-bka`) `GET /api/pantry-import/lookup` and `POST /api/pantry-import`. Types `PantryResponse`/`PantryItemRequest`/`PantryItemResponse`/`IngredientResponse`/`SupplementStashResponse` + `PantryLookupResponse`/`PantryImportRequest`/`PantryImportEntryResponse`/`PantrySuggestionResponse`. (`usePantry` consumes `list`; `usePantryActions` consumes `create`/`update`/`remove`/`importItem`/`lookup`.)
- `auth` (`data/_client/auth.ts`): `POST /api/auth/login` → `TokenResponse`.

Backend entities/conventions for the wired domains follow `docs/references/*.md`: UUID PKs (`gen_random_uuid()`), soft delete (`@SQLDelete`/`@SQLRestriction`), single-user ownership (`created_by` from the security principal, app-level filtering), typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`, Liquibase changesets `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, seed data in Java `@Profile("demodata")`. The per-feature design specs hold the table-level detail; see `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` and `2026-06-14-train-running-slice-design.md`.

### Domain↔contract type seam (a documented gotcha)

The FE keeps its own *domain* types in `frontend/src/data/types.ts` (`WeightEntry`, `SleepEntry`, `Mesocycle`, `SportSession`, …). Generated response DTOs are reconciled to these at the client or hook boundary, three ways:

- **Structural assignability cast** when shapes line up: `weightApi.list` declares `Promise<WeightEntry[]>` but fetches `WeightLogResponse[]` — "structurally assignable, checked by tsc" (`biometricsApi.ts:14`).
- **Explicit cast for nullability mismatch**: `sleepApi` casts `SleepLogResponse[] as SleepEntry[]` because the contract allows nulls the domain type claims are present — flagged in-code "explicit cast until normalized (see mezo bd issue)" (`biometricsApi.ts:27`).
- **Mapper functions** in `trainHooks.ts:43-162` (`toWorkoutPlan`, `deriveGymSchedule`, `toMesocycle`, `toSportSession`, `toSportSchedule`, `toLibraryItem`, `deriveSportWeek`) translate ISO dates → Hungarian display strings (via `shared/lib/dates.ts` `huMonthDay`/`huMonthDayDow`) and reshape DTOs into Phase-1 view shapes. **Week stats derive from the raw ISO-dated responses inside the `queryFn`**, before mapping (`trainHooks.ts:210`). Since Hypertrophy Drive (`mezo-dhdr`) `toWorkoutPlan` also folds the prescribed-sets recipe fields off `WorkoutTodayResponse` — `warmupSets`/`workingSets`/`repMin`/`repMax`/`prescribedSets`/`rationale` (the server-computed double-progression recommendation) — and is now `export`ed for the active-workout pre-population; see `train.md`.

**Running is the newest, cleanest idiom**: `runningHooks.ts` returns the generated types *directly* as the view model (`RunningBlockResponse[]`, `RunSessionLogResponse[]` — no separate domain type), and the mock data file `data/train/running.ts` is shaped *exactly* like the generated DTOs (imports `RunningBlockResponse` etc. from `runningApi.ts`). Copy this when wiring a new domain.

For mock-only features (Fuel/Insights/People) there is no contract fragment yet — the "data model" is the static shape returned by the hook (`data/fuel/fuel.ts`, `data/insights/insights.ts`, `data/me/people.ts`, …). The backend plugs in by adding `api/feature/<x>/<x>.yml` → client → hook branch (see §7).

## 6. Integrations

This layer is the hub; every feature is a spoke. Concrete, bidirectional seams:

- **Today ← biometrics / Train / Insights**: `TodayPage` consumes `useToday` (real: composes `useTrain()` + the real date), `useQuickStats` (real: `useSleep`+`useWeight`), `useInsightsTeaser` (real: `usePatterns`), and `useFuelPreview` — all sharing the source hooks' TanStack cache keys with their owning tabs. `useTodayScenario` (`data/today/todayHooks.ts`) reads `?day=/retaDay=/niggle=/vulnerable=` URL params to drive the day-state demo (survives real mode by design). **Contract crossing the seam:** the `TodayScenario` type (`{ dayState, retaDay, niggle, vulnerable, anchorMode }`).
- **Me ← biometrics / goal**: `GoalsPage` (the goal command-center — `useGoal` for the hero/timeline + `useGoalActions` for archive/delete/attach/detach + `useWeight` for `weightTrends`; it calls all three, since G1 split `useGoals` and G4b split the goal mutations into `useGoalActions`), `SleepPage` (`useSleep`/`logSleep`), `WeightPage` (`useWeight` + `useGoal` chart reference lines), `FuelStackPage` (`useGoal().linkedMesocycles`), `GoalPlannerPage` (`useGoalCreation`), `ProfilePage`/`PeoplePage` (`useProfile` static / `usePeople` dual-mode since Slice E), `KnowledgePage` (`useKnowledge` — dual-mode since companion V1.2, mock-mode graph). **Contract:** `WeightEntry[]`, `SleepEntry[]`, `CheckinSlot[]`, the `Goal` domain shape **plus the raw `GoalResponse`/`GoalTimelineResponse`** (G4b — the command-center reads the contract directly) from `data/types.ts` / the generated DTOs.
- **Train ↔ Train sub-views**: `useTrain` feeds `GymPage`, `SportPage`, `TrainTodayPage`, `MesocycleLibraryPage`, `ExercisesPage`, `ActiveWorkoutPage`; `useRunning` feeds `RunningPage`. The `todaySession` field (`{ templateSessionId, openWorkout }`) lets a mid-workout reload resume from the open instance (`trainHooks.ts:361`).
- **Train → Today**: `useTrain().workout` derives the Today workout card; `gymSchedule`/`sport.schedule` derive the weekly rows. The gym schedule is *derived client-side* by `deriveGymSchedule(meso, slots)` (`trainHooks.ts:67`), joining the active meso's template gym days (WHAT) with the standalone weekly gym-time slots (WHEN — the new `['train','gymSchedule']` query, persists across mesocycles, edited via `saveGymSchedule`). Only per-day gym `duration` stays out of scope.
- **Cross-feature mock fixtures**: `data/today/today.ts` re-exports `volleyballSessions`, `fuelToday`; `useFuelWeek` pulls `volleyball: volleyballSessions` from `today.ts` (`data/fuel/fuelReadHooks.ts`) — mock-only cross-references between domains that the real backend will eventually own.
- **Auth seam**: `QueryProvider` → `bootstrapOwnerToken` → `setToken` → `apiFetch` Bearer header. Every real-mode request depends on this completing first; the provider blocks render until then. **Contract:** `TokenResponse.token` → module-level `token` in `data/_client/api.ts`.
- **MSW ↔ `API_BASE` seam**: tests import `API_BASE` from `data/_client/api.ts` (re-exported via `test/msw/handlers.ts`) so handler URLs always match the real client target.

## 7. How to extend it

### Consume an existing hook (view author)

1. `import { useX } from '@/data/hooks'` — *always* this path, even for Train/Running (re-exported from `trainHooks`/`runningHooks` at `hooks.ts:202-203` precisely so consumers' import path stays stable).
2. Destructure the documented return shape. For wired domains, **ghost-guard**: render `GhostState` when the relevant field is `null`/empty, and check the `*Pending` flag before deciding "empty" (real mode loads async).
3. Call the returned mutators (`logWeight`, `startWorkout`, `saveRunningBlock`, …); several accept an `opts?: { onSuccess }` callback for post-write navigation. **Never call `apiFetch` or a `*Api` client directly from a view** — the hook is the only boundary. Don't call `isMockMode()` in views except for the rare affordance-gating case (`SportPage`).

### Wire a currently-mock domain to real (the recipe — mirror the Running slice)

Cleanest reference: `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` + the R1 plan.

1. **Contract first** (`docs/references/api_contract_conventions.md`): write/extend `api/feature/<x>/<x>.yml`; `cd api/generate && npm run generate:api`; then `cd frontend && pnpm generate:api` (updates `src/data/_client/api.gen.ts`).
2. **Typed client**: add `frontend/src/data/<domain>/<x>Api.ts` — re-export the `components['schemas'][...]` types, write thin functions over `apiFetch` (request bodies with `satisfies <Request>`, see `trainApi.ts`/`auth.ts`).
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
- **Representative tests**: `data/me/weightHooks.test.tsx` (renamed from `goalsHooks.test.tsx` — real GET + POST→invalidate→list-grows round-trip), `data/me/goalHooks.test.tsx` (G1 — real `GET /api/goals` via MSW, picks the active goal, asserts the `toGoal` mapping; G3 — real `GET /api/goals/:id/timeline` builds `linkedMesocycles` + `goal.mesocycles` from the links), `data/today/checkinHooks.test.tsx` (real: server-row hydration + local update + exactly-one POST, `buildDaySlots` wall-clock derivation; mock: local update + zero fetches), `data/today/todayHooks.test.tsx` (mock byte-parity + real Train-fixture composition), `data/train/trainHooks.test.tsx` (real-mode meso/sport/catalog/records via MSW + mock no-op assertions), `data/hooks.test.tsx` (`useTodayScenario` param parsing + `useCheckins` local update). Train/Running view tests under `features/train/pages/*.test.tsx` exercise both modes incl. ghost states.

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
- **Gotcha — token in module scope**: the JWT lives in a `let` in `data/_client/api.ts`, lost on reload; `QueryProvider` re-bootstraps on every mount. No refresh/expiry handling (single-user, fine for now).
- **Gotcha — `useCheckins` real-mode write has no rollback of the optimistic layer**: a failed save toasts (global mutation cache) + `console.error`s but the slot stays optimistically "done" until the next `['checkins', date]` refetch reconciles it.
- **Deferred / Phase 3 (null in real mode by design)**: Train `challenges` (`toWorkoutPlan` returns `[]`) and `niggleWarning`, `sport.crossLoad` (always null), the sport-week trend (`shoulderLoadTrend: 'stabil'` constant, not rendered), schedule `team`/`season`, gym schedule `time`/`duration` (no schedule-template table in Phase 2). Insights/Knowledge/Chat will be seed-only even when their backend lands (Slice D) — AI populates them in Phase 3.
- **Deferred infra**: offline-queue / PWA cache is noted as "later" in the design spec §3 — not built.

## 10. Key files

- `frontend/src/data/hooks.ts` — **THE single FE↔data boundary**; ~22 hooks, re-exports `useTrain`/`useRunning`/`useWeight`/`useGoal`.
- `frontend/src/data/train/trainHooks.ts` — `useTrain` (richest dual-mode hook: 7 queries, 13 mutations, DTO→display mappers).
- `frontend/src/data/train/runningHooks.ts` — `useRunning` (cleanest idiom: full `setQueryData` mock emulation, generated types as view model).
- `frontend/src/data/me/weightHooks.ts` — `useWeight` (weight log+trend; the weight half of the former `useGoals`). G5 (`mezo-g1u`) added the real `['weightTrend']` query + `foldTrend` (:15) folding the backend EWMA rates into `weightTrends`.
- `frontend/src/data/me/goalHooks.ts` — `useGoal` (G1+G3+G4b; real active-goal read at :57, `toGoal` back-compat adapter at :18, shares the `['weightLog']` cache; G3 `toLinkedMesocycles` at :42 builds real `linkedMesocycles` from the `goalLinkApi.timeline` query; G4b additively exposes raw `goalResponse`/`timeline`/`goalId` — the latter now also carries the engine's `prescription`/`tdeeBootstrap`) + `useGoalActions` (G4b+G5; the **six** command-center mutations at :114 — archive/remove/activate + attach/detach + **evaluate** (:153, runs the engine) — two-tier `['goals']`/timeline invalidation, `evaluating` flag, mock no-ops) + `useGoalCreation` (G4a; create→activate write at :199, `GoalCreationInput` at :194 — the G6 profile-upsert step is gone) + `useFeasibilityPreview` (G6; debounced live preview at :229 → `goalApi.feasibilityPreview`).
- `frontend/src/data/me/biometricHooks.ts` — **`useBiometricProfile`** (G6; `['biometricProfile']` read at :19, 404→null, `isComplete` gate predicate at :41) + **`useBiometricActions`** (G6; `upsert` at :51 → PUT, invalidates `['biometricProfile']`+`['goals']`).
- `frontend/src/data/fuel/pantryHooks.ts` — **`usePantry`** (Fuel slice C · Pantry `mezo-9xu`; dual-mode read with the exact pre-existing `{ ingredients, stash, sources, categoryMeta, imports, suggestions }` shape — mock `initialData` + `staleTime: Infinity`, real `ingredients`/`stash`/`imports`/`suggestions` from `pantryApi.list()` — imports/suggestions REAL since Fuel P6 `mezo-bka` — and `sources`/`categoryMeta` stay static config) + **`usePantryActions`** (`addItem`/`updateItem`/`deleteItem`/`importItem`/`lookupItems` — mock `setQueryData` on `['pantry']`, real `pantryApi` calls + invalidate; the `useWeight` dual-mode pattern). Both re-exported from `hooks.ts`.
- `frontend/src/data/fuel/pantryApi.ts` — typed REST client for the Pantry slice: `list`/`create`/`update`/`remove` over `GET/POST/PUT/DELETE /api/pantry` (request bodies via `toRequest` → `PantryItemRequest`, `satisfies`); consumed only by `pantryHooks.ts`.
- `frontend/src/data/_client/mode.ts` — `isMockMode()`, the per-call mode switch.
- `frontend/src/data/_client/api.ts` — `apiFetch`, `API_BASE`, `setToken`, `ApiError`, `SystemMessage`.
- `frontend/src/data/_client/auth.ts` — `bootstrapOwnerToken` (silent owner login).
- `frontend/src/data/me/biometricsApi.ts` / `trainApi.ts` / `runningApi.ts` / `goalApi.ts` / `goalLinkApi.ts` (G3) / `biometricProfileApi.ts` / `pantryApi.ts` (Fuel slice C) — typed REST clients over `apiFetch`.
- `frontend/src/data/_client/api.gen.ts` — generated contract types (openapi-typescript; do not edit).
- `frontend/src/shared/lib/dates.ts` — ISO→Hungarian display formatting used by Train mappers.
- `frontend/src/app/providers/QueryProvider.tsx` — app-wide `QueryClient` + real-mode token bootstrap gate.
- `frontend/src/main.tsx` — mounts `QueryProvider` above the router.
- `frontend/src/shared/ui/GhostState.tsx` — clean-slate empty-state skeleton (the no-fallback rule).
- `frontend/src/test/queryWrapper.tsx` — `QueryWrapper` + `makeHookWrapper()`.
- `frontend/src/test/setup.ts` — storage shim + MSW lifecycle.
- `frontend/src/test/msw/handlers.ts` / `server.ts` — MSW handlers (keyed off `API_BASE`).
- `frontend/src/data/types.ts` — FE domain types (`WeightEntry`, `SleepEntry`, `Mesocycle`, …) DTOs map to.
- `frontend/.env.example` — `VITE_API_URL`, `VITE_OWNER_EMAIL/PASSWORD`, `VITE_USE_MOCK`.

**Related docs (link, don't duplicate):** `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (the foundational decision — §1 invariant, §3 FE integration, §5 slice map); `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` (cleanest hook-wiring reference); `docs/references/api_contract_conventions.md` (contract-first FE↔BE type flow); `docs/references/error_handling.md` (the `SystemMessage` contract `apiFetch` mirrors); `docs/milestones/roadmap.md` (Phase-2 slice status — Slices C/D/E remaining).

