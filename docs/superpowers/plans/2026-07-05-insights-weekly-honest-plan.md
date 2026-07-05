# D′ — Insights Weekly real + honest surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Insights Weekly tab renders a real, deterministic weekly review in real mode (score formula + honest „tanulom" gate), Memoir/Predictions/Experiments become honest hidden/ghost surfaces, and one small Train read (`GET /api/train/workouts?from&to`) supplies the last-week gym count.

**Architecture:** Client-side composition (the `buildDayPlan`/`fuelWeekHooks` precedent): a new dual-mode `useWeekly()` hook in `data/insights/weeklyHooks.ts` composes existing reads (`GET /api/fuel/week/{start}` ×2, sleep log, weight EWMA, schedules, sport sessions) plus the one new Train list endpoint. All rollup logic is exported pure functions. Spec: `docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md`.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven (backend), OpenAPI contract-first (`api/`), React 19 + TanStack Query + Vitest + MSW (frontend).

**bd:** `mezo-t16y.1` · **Branch:** `feat/insights-weekly` (already created, spec committed).

## Global Constraints

- Read `docs/references/frontend_conventions.md` before ANY `frontend/src` code; `docs/references/{api_contract_conventions,spring_patterns,error_handling,testing_standards,integration_test_framework}.md` before the matching backend/contract work.
- Contract-first: edit `api/feature/train/train.yml` BEFORE Java/TS code; merge with `cd api/generate && npm run generate:api`; FE types with `cd frontend && pnpm generate:api`; backend Java types regenerate inside `./mvnw` runs.
- Backend tests: integration-first, AssertJ only, `test{Method}_should{Result}_when{Condition}` naming, populators, no mocks/H2. ALWAYS `./mvnw clean test` (never skip `clean`).
- FE: hooks called unconditionally in both modes (rules-of-hooks); features import data hooks from `@/data/hooks` only; NO mock seed as real-mode fallback (`useDualQuery`/`realEmpty` invariant); both test modes must pass: `pnpm test` AND `VITE_USE_MOCK=true pnpm test`.
- Hungarian UI copy, English code/comments/commits. Conventional commits carrying `(mezo-t16y.1)`.
- Backend run needs `docker compose up -d` under `backend/` (Postgres on :15432).

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `api/feature/train/train.yml` | modify | GET on `/api/train/workouts` + `WorkoutSummaryResponse` schema |
| `backend/.../feature/train/service/WorkoutService.java` | modify | `listWorkouts(createdBy, from, to)` — validate range, reuse `findDoneInstancesBetween`, map |
| `backend/.../feature/train/controller/TrainController.java` | modify | `@Override listWorkouts` delegation |
| `backend/.../feature/train/mapper/TrainMapper.java` | modify | `toWorkoutSummary` mapping |
| `backend/src/main/resources/messages.properties` | modify | `TRAIN_INVALID_DATE_RANGE` |
| `backend/.../feature/train/WorkoutContractIT.java` | modify | listWorkouts ITs (range/empty/validation/401/ownership) |
| `frontend/src/data/train/trainApi.ts` | modify | `listWorkouts` client + type re-export |
| `frontend/src/data/insights/weeklyHooks.ts` | create | pure rollup fns + `useWeekly()` dual-mode hook |
| `frontend/src/data/insights/weeklyHooks.test.tsx` | create | pure-fn units + dual-mode hook tests |
| `frontend/src/data/insights/insightsHooks.ts` | modify | drop `weekly`/`weeklySuggestion` from `useInsights` |
| `frontend/src/data/hooks.ts` | modify | export `useWeekly` |
| `frontend/src/test/msw/handlers.ts` | modify | default `GET /api/train/workouts` → `[]` |
| `frontend/src/features/insights/pages/WeeklyPage.tsx` | modify | consume `useWeekly`, tanulom state, suggestion placeholder |
| `frontend/src/features/insights/pages/WeeklyPage.test.tsx` | modify | mock + real describes |
| `frontend/src/features/insights/pages/tabs.ts` | modify | `visibleInsightsTabs()` |
| `frontend/src/features/insights/pages/InsightsSubNav.tsx` | modify | render visible tabs |
| `frontend/src/features/insights/pages/InsightsSubNav.test.tsx` | modify | 7-vs-4 tab describes |
| `frontend/src/features/insights/components/PhaseTeaserCard.tsx` | create | shared „hamarosan" ghost card |
| `frontend/src/features/insights/pages/{MemoirPage,PredictionsPage,ExperimentsPage}.tsx` | modify | real mode → PhaseTeaserCard |
| `frontend/src/features/insights/pages/{MemoirPage,PredictionsPage,ExperimentsPage}.test.tsx` | modify | mode-split describes |
| `frontend/src/features/insights/pages/insights.nav.test.tsx` | modify | real-mode nav (no Memoir link) + mock nav |
| `docs/features/insights.md`, `docs/features/train.md`, `docs/milestones/roadmap.md` | modify | living docs + milestone row |

No Liquibase change (no new table); `workout_session` is already in the `ResetDatabase` TRUNCATE list; no new populator needed (`TrainPopulator.createWorkoutInstance` + `createLoggedSet` exist).

---

### Task 1: Contract — `GET /api/train/workouts?from&to`

**Files:**
- Modify: `api/feature/train/train.yml` (path `/api/train/workouts:` at ~line 384; `components.schemas` at ~line 784)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: OpenAPI op `listWorkouts` → generated Java `TrainApi.listWorkouts(LocalDate from, LocalDate to)` and FE `components['schemas']['WorkoutSummaryResponse']`.

- [ ] **Step 1: Add the GET op** under the existing `/api/train/workouts:` path key (before its `post:`), copying the query-param style of `api/feature/checkin/checkin.yml`:

```yaml
    get:
      tags: [Train]
      operationId: listWorkouts
      summary: Workout instances with logged work (≥1 non-skipped set) in the inclusive date range — same "done" semantics as weekDoneDates
      parameters:
        - name: from
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          schema:
            type: string
            format: date
      responses:
        '200':
          description: Date-ascending workout summaries
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/WorkoutSummaryResponse'
        '400':
          description: Invalid range (from > to)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add the schema** in `components.schemas` (near `WorkoutInstanceResponse`):

```yaml
    WorkoutSummaryResponse:
      type: object
      required: [id, date, status]
      properties:
        id:
          type: string
          format: uuid
        date:
          type: string
          format: date
        status:
          type: string
          enum: [planned, active, completed, skipped]
```

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` gains the op; `frontend/src/data/_client/api.gen.ts` gains `WorkoutSummaryResponse`.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): contract for GET /api/train/workouts date-range summary list (mezo-t16y.1)"
```

---

### Task 2: Backend — listWorkouts (TDD)

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutContractIT.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java`
- Modify: `backend/src/main/resources/messages.properties`

**Interfaces:**
- Consumes: generated `io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse` + `io.mrkuhne.mezo.api.controller.TrainApi` (Task 1); existing `WorkoutSessionRepository.findDoneInstancesBetween(UUID, LocalDate, LocalDate)`; `TrainPopulator.createMesocycle/createWorkoutSession/createWorkoutInstance/createExercise/createLoggedSet`.
- Produces: `WorkoutService.listWorkouts(UUID createdBy, LocalDate from, LocalDate to): List<WorkoutSummaryResponse>`.

- [ ] **Step 1: Write the failing ITs** in `WorkoutContractIT` (mirror the class's existing helper usage — a template needs a mesocycle; a "logged" instance needs an exercise + one non-skipped set):

```java
@Test
void testListWorkouts_shouldReturnLoggedInstancesInRange_whenRangeCoversThem() {
    UUID owner = ownerId();
    MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
    WorkoutSessionEntity template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hét", "Pull Day", 0, "planned");
    ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);

    WorkoutSessionEntity inRange = trainPopulator.createWorkoutInstance(owner, template, LocalDate.of(2026, 6, 22), "completed");
    trainPopulator.createLoggedSet(owner, exercise.getId(), inRange.getId(), 0, "100", 8, 1);
    WorkoutSessionEntity outOfRange = trainPopulator.createWorkoutInstance(owner, template, LocalDate.of(2026, 6, 29), "completed");
    trainPopulator.createLoggedSet(owner, exercise.getId(), outOfRange.getId(), 0, "100", 8, 1);
    trainPopulator.createWorkoutInstance(owner, template, LocalDate.of(2026, 6, 23), "planned"); // no sets -> excluded

    List<WorkoutSummaryResponse> result = getForList(
        "/api/train/workouts?from=2026-06-22&to=2026-06-28",
        ownerAuthHeaders(), HttpStatus.OK, WorkoutSummaryResponse.class);

    assertThat(result).hasSize(1);
    assertThat(result.getFirst().getId()).isEqualTo(inRange.getId());
    assertThat(result.getFirst().getDate()).isEqualTo(LocalDate.of(2026, 6, 22));
    assertThat(result.getFirst().getStatus()).isEqualTo(WorkoutSummaryResponse.StatusEnum.COMPLETED);
}

@Test
void testListWorkouts_shouldReturnEmpty_whenNoLoggedWorkInRange() {
    List<WorkoutSummaryResponse> result = getForList(
        "/api/train/workouts?from=2026-06-22&to=2026-06-28",
        ownerAuthHeaders(), HttpStatus.OK, WorkoutSummaryResponse.class);
    assertThat(result).isEmpty();
}

@Test
void testListWorkouts_shouldRejectRange_whenFromAfterTo() {
    assertHasRequestError(
        getForError("/api/train/workouts?from=2026-06-29&to=2026-06-22", ownerAuthHeaders(), HttpStatus.BAD_REQUEST),
        "TRAIN_INVALID_DATE_RANGE");
}

@Test
void testListWorkouts_shouldReturn401_whenUnauthenticated() {
    getForBody("/api/train/workouts?from=2026-06-22&to=2026-06-28", new HttpHeaders(), HttpStatus.UNAUTHORIZED, Void.class);
}

@Test
void testListWorkouts_shouldIsolateOwners_whenOtherUserHasLoggedWork() {
    UUID other = UUID.randomUUID();
    MesocycleEntity meso = trainPopulator.createMesocycle(other, "Idegen", "active");
    WorkoutSessionEntity template = trainPopulator.createWorkoutSession(other, meso.getId(), "Hét", "Pull Day", 0, "planned");
    ExerciseEntity exercise = trainPopulator.createExercise(other, template.getId(), "Row", 0);
    WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(other, template, LocalDate.of(2026, 6, 22), "completed");
    trainPopulator.createLoggedSet(other, exercise.getId(), instance.getId(), 0, "100", 8, 1);

    List<WorkoutSummaryResponse> result = getForList(
        "/api/train/workouts?from=2026-06-22&to=2026-06-28",
        ownerAuthHeaders(), HttpStatus.OK, WorkoutSummaryResponse.class);
    assertThat(result).isEmpty();
}
```

Adapt helper names to the class's actual ones on sight (`ownerId()`, `getForList`, `getForError`/error-asserting helper — read `ApiIntegrationTest` for the exact error-fetch helper; if none returns a body on 4xx, follow the pattern the class's other validation tests use).

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutContractIT`
Expected: FAIL — compile error (`listWorkouts` not implemented → `TrainController` does not implement the new abstract/`TrainApi` default method) or 404s.

- [ ] **Step 3: Implement.** `messages.properties`:

```properties
TRAIN_INVALID_DATE_RANGE=The from date must not be after the to date.
```

`TrainMapper` (import `io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse`):

```java
@Mapping(target = "status", expression = "java(WorkoutSummaryResponse.StatusEnum.fromValue(entity.getStatus()))")
WorkoutSummaryResponse toWorkoutSummary(WorkoutSessionEntity entity);
```

`WorkoutService` (read method — no `@Transactional`, matching `getToday`):

```java
public List<WorkoutSummaryResponse> listWorkouts(UUID createdBy, LocalDate from, LocalDate to) {
    if (from.isAfter(to)) {
        throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
    }
    return workoutSessionRepository.findDoneInstancesBetween(createdBy, from, to).stream()
        .map(mapper::toWorkoutSummary)
        .toList();
}
```

`TrainController`:

```java
@Override
public List<WorkoutSummaryResponse> listWorkouts(LocalDate from, LocalDate to) {
    return workoutService.listWorkouts(currentUserId.get(), from, to);
}
```

- [ ] **Step 4: Run the IT class, then the full suite**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutContractIT` then `./mvnw clean test`
Expected: PASS (compose must be up: `docker compose up -d`).

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(train): GET /api/train/workouts date-range summary list (mezo-t16y.1)"
```

---

### Task 3: FE data — pure weekly rollup functions (TDD)

**Files:**
- Create: `frontend/src/data/insights/weeklyHooks.ts` (pure part)
- Create: `frontend/src/data/insights/weeklyHooks.test.tsx` (pure part)
- Modify: `frontend/src/data/train/trainApi.ts`
- Modify: `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: `FuelWeekDay` (`@/data/fuel/mealApi`), `SleepEntry`, `WeeklyItem`, `WeeklyTrend` (`@/data/types`), `mondayIso`/`deriveWeekTitle` (`@/data/fuel/fuelWeekHooks`).
- Produces (used by Task 4): `prevMondayIso(start)`, `weekEndIso(start)`, `isoWeekNumber(iso)`, `inWeek(dateIso, start)`, `WeekMetrics`, `deriveWeekMetrics(slice)`, `deriveItems(cur, prev, weightRate)`, `deriveScore(m)`, `trendOf(cur, prev, epsilon)`, `weightTrendOf(rate)`, constants `SLEEP_TARGET_H`, `KCAL_BAND`, `WEIGHT_RATE_EPSILON`. Also `trainApi.listWorkouts(from, to)` + `WorkoutSummaryResponse` re-export.

- [ ] **Step 1: trainApi client** — in `trainApi.ts` add the type re-export and method:

```ts
export type WorkoutSummaryResponse = components['schemas']['WorkoutSummaryResponse']
```

```ts
  listWorkouts: (from: string, to: string): Promise<WorkoutSummaryResponse[]> =>
    apiFetch<WorkoutSummaryResponse[]>(`/api/train/workouts?from=${from}&to=${to}`),
```

And in `frontend/src/test/msw/handlers.ts` (next to the other `/api/train/workouts*` handlers) a default:

```ts
  http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([])),
```

- [ ] **Step 2: Write the failing pure-fn tests** (`weeklyHooks.test.tsx`, `fuelWeekHooks.test.tsx` style — plain `test()`s, no wrapper):

```ts
import { prevMondayIso, weekEndIso, isoWeekNumber, inWeek, deriveWeekMetrics, deriveItems, deriveScore, trendOf, weightTrendOf } from '@/data/insights/weeklyHooks'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { SleepEntry } from '@/data/types'

const targets = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
const day = (date: string, kcal: number, p: number): FuelWeekDay =>
  ({ date, targets, consumed: { kcal, p, c: 0, f: 0, water: 0 } })
const sleep = (date: string, duration: number, quality: number): SleepEntry =>
  ({ date, bedtime: '23:00', wakeup: '06:30', duration, quality, awakenings: 1, mealToSleep: 100, notes: null })

test('week helpers: prev Monday, week end, ISO week number, membership', () => {
  expect(prevMondayIso('2026-06-29')).toBe('2026-06-22')
  expect(weekEndIso('2026-06-29')).toBe('2026-07-05')
  expect(isoWeekNumber('2026-06-29')).toBe(27)
  expect(inWeek('2026-06-29', '2026-06-29')).toBe(true)
  expect(inWeek('2026-07-05', '2026-06-29')).toBe(true)
  expect(inWeek('2026-07-06', '2026-06-29')).toBe(false)
  expect(inWeek('2026-06-28', '2026-06-29')).toBe(false)
})

test('deriveWeekMetrics: averages logged fuel days, protein hits, sleep avgs; null when unlogged', () => {
  const m = deriveWeekMetrics({
    fuelDays: [day('2026-06-29', 2800, 225), day('2026-06-30', 2635, 180)],
    sleepEntries: [sleep('2026-06-29', 7.5, 8), sleep('2026-06-30', 6.9, 6)],
    trainDone: 3, trainPlanned: 5,
  })
  expect(m.kcalFactor).toBeCloseTo(2717.5 / 3100, 4)
  expect(m.proteinHitDays).toBe(1)
  expect(m.sleepAvgH).toBeCloseTo(7.2, 4)
  expect(m.sleepQualityAvg).toBeCloseTo(7, 4)

  const empty = deriveWeekMetrics({ fuelDays: [day('2026-06-29', 0, 0)], sleepEntries: [], trainDone: null, trainPlanned: null })
  expect(empty.kcalFactor).toBeNull()
  expect(empty.proteinHitDays).toBeNull()
  expect(empty.sleepAvgH).toBeNull()
})

test('trendOf and weightTrendOf map deltas to arrows', () => {
  expect(trendOf(3, 2)).toBe('up')
  expect(trendOf(2, 3)).toBe('down')
  expect(trendOf(2, 2)).toBe('flat')
  expect(trendOf(7.25, 7.2, 0.1)).toBe('flat')
  expect(trendOf(null, 2)).toBe('flat')
  expect(weightTrendOf(-0.32)).toBe('up')     // goal-ward (cut): losing = good
  expect(weightTrendOf(0.05)).toBe('flat')
  expect(weightTrendOf(0.4)).toBe('down')
  expect(weightTrendOf(null)).toBe('flat')
})

test('deriveItems renders the five rows with honest em-dash for missing sources', () => {
  const cur = { kcalFactor: 0.94, proteinHitDays: 4, sleepAvgH: 7.2, sleepQualityAvg: 7.5, trainDone: 3, trainPlanned: 5 }
  const prev = { kcalFactor: 0.9, proteinHitDays: 5, sleepAvgH: 7.2, sleepQualityAvg: 7, trainDone: 2, trainPlanned: 5 }
  const items = deriveItems(cur, prev, -0.32)
  expect(items).toEqual([
    { label: 'Edzés', value: '3/5', trend: 'up' },
    { label: 'Alvás átlag', value: '7.2h · minőség 7.5', trend: 'flat' },
    { label: 'Kcal pacing', value: '94% target', trend: 'up' },
    { label: 'Fehérje-napok', value: '4/7', trend: 'down' },
    { label: 'Súly trend', value: '-0.32 kg/hét', trend: 'up' },
  ])

  const ghost = deriveItems(
    { kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null },
    { kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null },
    null,
  )
  expect(ghost.every((it) => it.value === '—' && it.trend === 'flat')).toBe(true)
})

test('deriveScore: mean of available sub-scores ×100; null when nothing is available', () => {
  expect(deriveScore({ kcalFactor: 1, proteinHitDays: 7, sleepAvgH: 8, sleepQualityAvg: 8, trainDone: 5, trainPlanned: 5 })).toBe(100)
  // kcal 1-0.06/0.25=0.76 · protein 4/7 · sleep 7.2/8=0.9 · train 3/5=0.6 → mean 0.7079 → 71
  expect(deriveScore({ kcalFactor: 0.94, proteinHitDays: 4, sleepAvgH: 7.2, sleepQualityAvg: 7.5, trainDone: 3, trainPlanned: 5 })).toBe(71)
  expect(deriveScore({ kcalFactor: 0.6, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null })).toBe(0)
  expect(deriveScore({ kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: 2, trainPlanned: 0 })).toBeNull()
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd frontend && pnpm vitest run src/data/insights/weeklyHooks.test.tsx`
Expected: FAIL — module has no exports.

- [ ] **Step 4: Implement the pure part** of `weeklyHooks.ts`:

```ts
// D' (mezo-t16y.1) — dual-mode Insights Weekly review.
//
// MOCK: byte-parity with the Phase-1 seed (`insights.ts` weekly + weeklySuggestion).
// REAL: deterministic composition over the user's own reads — fuel 7-day rollups (×2 weeks,
//   the F-P4 aggregate), sleep log, weight EWMA, gym/sport schedules and logged sessions
//   (`GET /api/train/workouts` + sport-sessions). Score is a DOCUMENTED formula (constants
//   below), gated to the honest „tanulom" null-state when no sub-score has data — never a
//   fabricated number. Design: docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md.

import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { SleepEntry, WeeklyItem, WeeklyTrend } from '@/data/types'

/** Documented score constants (FE v0 — promote to backend config with the proactive epic). */
export const SLEEP_TARGET_H = 8
export const KCAL_BAND = 0.25
export const WEIGHT_RATE_EPSILON = 0.1

export function prevMondayIso(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const prev = new Date(y, m - 1, d - 7)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
}

export function weekEndIso(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

/** ISO-8601 week number of the given date (used for the real-mode 'Hét N' title). */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** ISO date within the Monday-based week starting at `start` (string compare — ISO sorts). */
export function inWeek(dateIso: string, start: string): boolean {
  return dateIso >= start && dateIso <= weekEndIso(start)
}

export interface WeekMetrics {
  kcalFactor: number | null
  proteinHitDays: number | null
  sleepAvgH: number | null
  sleepQualityAvg: number | null
  trainDone: number | null
  trainPlanned: number | null
}

export function deriveWeekMetrics(slice: {
  fuelDays: FuelWeekDay[]
  sleepEntries: SleepEntry[]
  trainDone: number | null
  trainPlanned: number | null
}): WeekMetrics {
  const logged = slice.fuelDays.filter((d) => d.consumed.kcal > 0)
  const kcalTarget = slice.fuelDays[0]?.targets.kcal ?? 0
  const kcalFactor = logged.length && kcalTarget > 0
    ? logged.reduce((a, d) => a + d.consumed.kcal, 0) / logged.length / kcalTarget
    : null
  const proteinHitDays = logged.length
    ? slice.fuelDays.filter((d) => d.targets.p > 0 && d.consumed.p >= d.targets.p).length
    : null
  const s = slice.sleepEntries
  return {
    kcalFactor,
    proteinHitDays,
    sleepAvgH: s.length ? s.reduce((a, e) => a + e.duration, 0) / s.length : null,
    sleepQualityAvg: s.length ? s.reduce((a, e) => a + e.quality, 0) / s.length : null,
    trainDone: slice.trainDone,
    trainPlanned: slice.trainPlanned,
  }
}

/** Higher-is-better comparison → arrow; missing data or a within-epsilon tie is honest 'flat'. */
export function trendOf(cur: number | null, prev: number | null, epsilon = 0): WeeklyTrend {
  if (cur == null || prev == null) return 'flat'
  const diff = cur - prev
  if (Math.abs(diff) <= epsilon) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

/** Goal-ward arrow for the EWMA weekly rate (single-user cut: losing = good = 'up'). */
export function weightTrendOf(rate: number | null): WeeklyTrend {
  if (rate == null) return 'flat'
  if (rate <= -WEIGHT_RATE_EPSILON) return 'up'
  if (rate >= WEIGHT_RATE_EPSILON) return 'down'
  return 'flat'
}

export function deriveItems(cur: WeekMetrics, prev: WeekMetrics, weightRateKgPerWeek: number | null): WeeklyItem[] {
  const closeness = (f: number | null) => (f == null ? null : -Math.abs(f - 1))
  return [
    {
      label: 'Edzés',
      value: cur.trainDone != null && cur.trainPlanned != null && (cur.trainPlanned > 0 || cur.trainDone > 0)
        ? `${cur.trainDone}/${cur.trainPlanned}` : '—',
      trend: trendOf(cur.trainDone, prev.trainDone),
    },
    {
      label: 'Alvás átlag',
      value: cur.sleepAvgH != null && cur.sleepQualityAvg != null
        ? `${cur.sleepAvgH.toFixed(1)}h · minőség ${cur.sleepQualityAvg.toFixed(1)}` : '—',
      trend: trendOf(cur.sleepAvgH, prev.sleepAvgH, 0.1),
    },
    {
      label: 'Kcal pacing',
      value: cur.kcalFactor != null ? `${Math.round(cur.kcalFactor * 100)}% target` : '—',
      trend: trendOf(closeness(cur.kcalFactor), closeness(prev.kcalFactor), 0.02),
    },
    {
      label: 'Fehérje-napok',
      value: cur.proteinHitDays != null ? `${cur.proteinHitDays}/7` : '—',
      trend: trendOf(cur.proteinHitDays, prev.proteinHitDays),
    },
    {
      label: 'Súly trend',
      value: weightRateKgPerWeek != null
        ? `${weightRateKgPerWeek > 0 ? '+' : ''}${weightRateKgPerWeek.toFixed(2)} kg/hét` : '—',
      trend: weightTrendOf(weightRateKgPerWeek),
    },
  ]
}

/**
 * score = round(100 × mean(available sub-scores)); weight is EXCLUDED (goal-direction-dependent).
 * kcal: closeness to target inside a ±KCAL_BAND linear band · protein: hit-days/7 ·
 * sleep: avg/SLEEP_TARGET_H capped · train: done/planned capped (skipped when planned=0).
 * No sub-score has data → null → the page renders the „tanulom" null-state.
 */
export function deriveScore(m: WeekMetrics): number | null {
  const subs: number[] = []
  if (m.kcalFactor != null) subs.push(Math.max(0, 1 - Math.abs(m.kcalFactor - 1) / KCAL_BAND))
  if (m.proteinHitDays != null) subs.push(m.proteinHitDays / 7)
  if (m.sleepAvgH != null) subs.push(Math.min(1, m.sleepAvgH / SLEEP_TARGET_H))
  if (m.trainDone != null && m.trainPlanned != null && m.trainPlanned > 0) subs.push(Math.min(1, m.trainDone / m.trainPlanned))
  if (!subs.length) return null
  return Math.round((subs.reduce((a, b) => a + b, 0) / subs.length) * 100)
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && pnpm vitest run src/data/insights/weeklyHooks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/insights/weeklyHooks.ts frontend/src/data/insights/weeklyHooks.test.tsx frontend/src/data/train/trainApi.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(insights): weekly rollup pure functions + trainApi.listWorkouts client (mezo-t16y.1)"
```

---

### Task 4: FE data — `useWeekly()` dual-mode hook (TDD)

**Files:**
- Modify: `frontend/src/data/insights/weeklyHooks.ts` (hook part)
- Modify: `frontend/src/data/insights/weeklyHooks.test.tsx` (hook describes)
- Modify: `frontend/src/data/insights/insightsHooks.ts`
- Modify: `frontend/src/data/hooks.ts`

**Interfaces:**
- Consumes: Task 3 pure fns; `mondayIso`, `deriveWeekTitle` from `@/data/fuel/fuelWeekHooks`; `mealApi.getWeek`; `trainApi.{listWorkouts,sportSessions,gymSchedule,sportSchedule}`; `useSleep()`; `useWeight()`; `isMockMode()`; seed `weekly`/`weeklySuggestion` from `@/data/insights/insights`.
- Produces: `useWeekly(): WeeklyView` where

```ts
export interface WeeklyView {
  weekly: { title: string; score: number | null; delta: number | null; items: WeeklyItem[] }
  deltaLabel: string
  weeklySuggestion: string | null
  mode: 'mock' | 'live'
}
```

`useInsights()` no longer returns `weekly`/`weeklySuggestion`.

- [ ] **Step 1: Write the failing hook tests** (append to `weeklyHooks.test.tsx`; `makeHookWrapper` + MSW idiom from `fuelWeekHooks.test.tsx` / `PatternsPage.test.tsx`):

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useWeekly } from '@/data/insights/weeklyHooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { weekly as mockWeekly, weeklySuggestion as mockSuggestion } from '@/data/insights/insights'

describe('useWeekly (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed verbatim with the demo delta label', () => {
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    expect(result.current.weekly).toEqual(mockWeekly)
    expect(result.current.deltaLabel).toBe('vs hét 20')
    expect(result.current.weeklySuggestion).toBe(mockSuggestion)
    expect(result.current.mode).toBe('mock')
  })
})

describe('useWeekly (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('composes the current week vs the previous week from the real reads', async () => {
    const start = mondayIso()
    const iso = (offset: number) => {
      const [y, m, d] = start.split('-').map(Number)
      const dd = new Date(y, m - 1, d + offset)
      return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    }
    server.use(
      http.get(`${API_BASE}/api/biometrics/sleep`, () =>
        HttpResponse.json([
          { date: iso(0), bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 100, notes: null },
          { date: iso(1), bedtime: '23:00', wakeup: '06:30', duration: 6.9, quality: 6, awakenings: 1, mealToSleep: 100, notes: null },
          { date: iso(-7), bedtime: '23:00', wakeup: '06:30', duration: 8.0, quality: 9, awakenings: 0, mealToSleep: 100, notes: null },
        ])),
      http.get(`${API_BASE}/api/train/workouts`, ({ request }) => {
        const from = new URL(request.url).searchParams.get('from')
        return HttpResponse.json(from === start
          ? [{ id: '11111111-0000-4000-8000-000000000001', date: iso(0), status: 'completed' }]
          : [])
      }),
      http.get(`${API_BASE}/api/train/sport-sessions`, () =>
        HttpResponse.json([
          { id: '22222222-0000-4000-8000-000000000001', sport: 'volleyball', date: iso(1), time: '19:00', duration: 90, rpe: 7 },
          { id: '22222222-0000-4000-8000-000000000002', sport: 'volleyball', date: iso(-6), time: '19:00', duration: 90, rpe: 7 },
        ])),
      http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
        HttpResponse.json({ latestTrendKg: 96.4, weeklyRateKgPerWeek: -0.32, last4wRateKgPerWeek: -0.4 })),
    )
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.weekly.score).not.toBeNull())

    expect(result.current.mode).toBe('live')
    expect(result.current.deltaLabel).toBe('vs előző hét')
    expect(result.current.weeklySuggestion).toBeNull()
    const byLabel = Object.fromEntries(result.current.weekly.items.map((i) => [i.label, i]))
    // default fuel-week MSW handler: 2 logged days, factor 2717.5/3100 → 88%, 1 protein hit
    expect(byLabel['Kcal pacing'].value).toBe('88% target')
    expect(byLabel['Fehérje-napok'].value).toBe('1/7')
    expect(byLabel['Alvás átlag'].value).toBe('7.2h · minőség 7.0')
    expect(byLabel['Súly trend']).toEqual({ label: 'Súly trend', value: '-0.32 kg/hét', trend: 'up' })
    // done: 1 gym + 1 volleyball this week; planned from the default schedule handlers
    expect(byLabel['Edzés'].value).toMatch(/^2\//)
    expect(result.current.weekly.title).toMatch(/^Hét \d+ áttekintés · /)
  })

  test('returns the tanulom null-state (score null, em-dash rows) when nothing is logged', async () => {
    server.use(
      http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) =>
        HttpResponse.json({ start: String(params.start), days: [] })),
      http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
        HttpResponse.json({ latestTrendKg: 0, weeklyRateKgPerWeek: 0, last4wRateKgPerWeek: 0 })),
    )
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.weekly.items.length).toBe(5))
    expect(result.current.weekly.score).toBeNull()
    expect(result.current.weekly.delta).toBeNull()
  })
})
```

Note: the weight-trend row asserts `'flat'`-safe values — `weeklyRateKgPerWeek: 0` maps to `'—'`? No: rate `0` is a real number → value `'0.00 kg/hét'`, trend `flat`. The em-dash assertion above therefore checks only `score`/`delta`; row-level `'—'` is already covered by the pure `deriveItems` test.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm vitest run src/data/insights/weeklyHooks.test.tsx`
Expected: new describes FAIL (`useWeekly` not exported).

- [ ] **Step 3: Implement the hook** (append to `weeklyHooks.ts`):

```ts
import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { mealApi } from '@/data/fuel/mealApi'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { trainApi } from '@/data/train/trainApi'
import { useSleep } from '@/data/me/sleepHooks'
import { useWeight } from '@/data/me/weightHooks'
import { weekly as mockWeekly, weeklySuggestion as mockWeeklySuggestion } from '@/data/insights/insights'

export interface WeeklyView {
  weekly: { title: string; score: number | null; delta: number | null; items: WeeklyItem[] }
  deltaLabel: string
  /** Mock: the seed prose. Real: null — the card renders the honest placeholder (proactive epic). */
  weeklySuggestion: string | null
  mode: 'mock' | 'live'
}

/** Inert-in-mock query helper (the fuelWeekHooks idiom): real fetches, mock resolves null. */
function useRealQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>) {
  const mock = isMockMode()
  return useQuery({
    queryKey: key,
    queryFn: mock ? async () => null : fetcher,
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : 0,
  })
}

export function useWeekly(): WeeklyView {
  const mock = isMockMode()
  const start = mondayIso()
  const prevStart = prevMondayIso(start)

  // Fuel rollups share the F-P4 cache key/shape (['fuelWeek', start] ⇒ FuelWeekData).
  const { data: curFuel } = useRealQuery(['fuelWeek', start], () => mealApi.getWeek(start))
  const { data: prevFuel } = useRealQuery(['fuelWeek', prevStart], () => mealApi.getWeek(prevStart))
  // Raw train reads under an own namespace — trainHooks' keys cache MAPPED domain shapes,
  // sharing them would collide (key consolidation: mezo-ah18.10).
  const { data: curWorkouts } = useRealQuery(['insightsWeekly', 'workouts', start], () => trainApi.listWorkouts(start, weekEndIso(start)))
  const { data: prevWorkouts } = useRealQuery(['insightsWeekly', 'workouts', prevStart], () => trainApi.listWorkouts(prevStart, weekEndIso(prevStart)))
  const { data: sportSessions } = useRealQuery(['insightsWeekly', 'sportSessions'], () => trainApi.sportSessions())
  const { data: gymSlots } = useRealQuery(['insightsWeekly', 'gymSchedule'], () => trainApi.gymSchedule())
  const { data: sportSlots } = useRealQuery(['insightsWeekly', 'sportSchedule'], () => trainApi.sportSchedule())
  const { sleepLog } = useSleep()
  const { weightTrends } = useWeight()

  if (mock) {
    return { weekly: mockWeekly, deltaLabel: 'vs hét 20', weeklySuggestion: mockWeeklySuggestion, mode: 'mock' }
  }

  const planned = gymSlots != null && sportSlots != null ? gymSlots.length + sportSlots.length : null
  const doneOf = (workouts: { date: string }[] | null | undefined, weekStart: string) =>
    workouts == null || sportSessions == null
      ? null
      : workouts.length + sportSessions.filter((s) => inWeek(s.date, weekStart)).length

  const cur = deriveWeekMetrics({
    fuelDays: curFuel?.days ?? [],
    sleepEntries: sleepLog.filter((e) => inWeek(e.date, start)),
    trainDone: doneOf(curWorkouts, start),
    trainPlanned: planned,
  })
  const prev = deriveWeekMetrics({
    fuelDays: prevFuel?.days ?? [],
    sleepEntries: sleepLog.filter((e) => inWeek(e.date, prevStart)),
    trainDone: doneOf(prevWorkouts, prevStart),
    trainPlanned: planned,
  })
  // Real-mode EWMA rate; the useWeight ZERO_TRENDS load-window fallback renders a benign 0.00.
  const weightRate = weightTrends.last7d.weeklyRate
  const score = deriveScore(cur)
  const prevScore = deriveScore(prev)

  return {
    weekly: {
      title: `Hét ${isoWeekNumber(start)} áttekintés · ${deriveWeekTitle(start)}`,
      score,
      delta: score != null && prevScore != null ? score - prevScore : null,
      items: deriveItems(cur, prev, weightRate),
    },
    deltaLabel: 'vs előző hét',
    weeklySuggestion: null,
    mode: 'live',
  }
}
```

(Real-mode `sleepLog` in `useSleep` has no mock fallback — it loads from the API; empty while pending → honest nulls.)

- [ ] **Step 4: Split `useInsights`** — `insightsHooks.ts` becomes:

```ts
import { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments } from '@/data/insights/insights'

// Weekly went dual-mode (weeklyHooks.ts, D' mezo-t16y.1); the rest stays clearly-labelled
// Phase-1 mock copy until the proactive epic (memoir/predictions/experiments prose).
export function useInsights() {
  return { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }
}
```

And in `frontend/src/data/hooks.ts` line 9 area:

```ts
export { useInsights } from '@/data/insights/insightsHooks'
export { useWeekly } from '@/data/insights/weeklyHooks'
```

- [ ] **Step 5: Run the data-layer tests**

Run: `cd frontend && pnpm vitest run src/data/insights/`
Expected: PASS (including `insightsData.test.tsx` — it imports the seed module directly, untouched).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/insights/ frontend/src/data/hooks.ts
git commit -m "feat(insights): useWeekly dual-mode hook, useInsights weekly split (mezo-t16y.1)"
```

---

### Task 5: WeeklyPage — real review, tanulom state, honest suggestion card

**Files:**
- Modify: `frontend/src/features/insights/pages/WeeklyPage.tsx`
- Modify: `frontend/src/features/insights/pages/WeeklyPage.test.tsx`

**Interfaces:**
- Consumes: `useWeekly` from `@/data/hooks` (Task 4 shape).

- [ ] **Step 1: Rewrite the page tests** — wrap the existing assertions in a mock describe, add real describes:

```tsx
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeeklyPage } from '@/features/insights/pages/WeeklyPage'

const renderPage = () => render(<WeeklyPage />, { wrapper: QueryWrapper })

describe('WeeklyPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the score hero, the delta, every item and the plan suggestion', () => {
    renderPage()
    expect(screen.getByText('Hét 21 áttekintés · Máj 18-24')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('vs hét 20')).toBeInTheDocument()
    expect(screen.getByText('Edzés volumen')).toBeInTheDocument()
    expect(screen.getByText('Niggle-mentes napok')).toBeInTheDocument()
    expect(screen.getByText('Mezo · heti tervjavaslat')).toBeInTheDocument()
    expect(screen.getByText(/Hét 22: tartsd ezt a Pull\/Push/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elfogad' })).toBeInTheDocument()
  })
})

describe('WeeklyPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the composed review with real rows and the honest suggestion placeholder', async () => {
    renderPage()
    // default MSW fuel-week handler: factor 2717.5/3100 → 88% target
    expect(await screen.findByText('88% target')).toBeInTheDocument()
    expect(screen.getByText('vs előző hét')).toBeInTheDocument()
    expect(screen.getByText('Fehérje-napok')).toBeInTheDocument()
    expect(screen.getByText('A társ heti tervjavaslata hamarosan.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elfogad' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Hét 22: tartsd ezt a Pull\/Push/)).not.toBeInTheDocument()
  })

  test('renders the tanulom null-state when nothing is logged', async () => {
    server.use(
      http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) =>
        HttpResponse.json({ start: String(params.start), days: [] })),
      http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    )
    renderPage()
    expect(await screen.findByText('tanulom')).toBeInTheDocument()
    expect(screen.queryByText('/100')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify the real describes fail**

Run: `cd frontend && pnpm vitest run src/features/insights/pages/WeeklyPage.test.tsx`
Expected: mock describe PASSES against the current page; real describes FAIL.

- [ ] **Step 3: Rewrite `WeeklyPage.tsx`:**

```tsx
import { useWeekly } from '@/data/hooks'
import type { WeeklyTrend } from '@/data/types'

function trendArrow(t: WeeklyTrend): string {
  return t === 'up' ? '↗' : t === 'down' ? '↘' : '→'
}

function trendColor(t: WeeklyTrend): string {
  return t === 'up' ? 'var(--success)' : t === 'down' ? 'var(--error)' : 'var(--text-tertiary)'
}

export function WeeklyPage() {
  const { weekly, deltaLabel, weeklySuggestion } = useWeekly()

  return (
    <div className="col gap-md">
      <div className="card notch-12" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <span className="eyebrow brand">{weekly.title}</span>
            {weekly.score != null ? (
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 1, marginTop: 8 }}>
                {weekly.score}
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 6 }}>/100</span>
              </div>
            ) : (
              // The patterns-precedent honest null-state: no data yet, never a fabricated score.
              <div className="col" style={{ marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 34, fontWeight: 600, lineHeight: 1, color: 'var(--text-tertiary)' }}>
                  tanulom
                </span>
                <span className="text-tertiary" style={{ fontSize: 11, marginTop: 6 }}>
                  még gyűjtöm az adatokat a heti értékeléshez
                </span>
              </div>
            )}
          </div>
          {weekly.delta != null && (
            <div className="col" style={{ alignItems: 'flex-end' }}>
              <span className="label-mono" style={{ color: weekly.delta >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {weekly.delta > 0 ? '+' : ''}{weekly.delta}
              </span>
              <span className="text-tertiary" style={{ fontSize: 10, marginTop: 4 }}>{deltaLabel}</span>
            </div>
          )}
        </div>

        <div className="col gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          {weekly.items.map((it, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="text-secondary" style={{ fontSize: 13 }}>{it.label}</span>
              <div className="row gap-sm">
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{it.value}</span>
                <span style={{ fontSize: 12, color: trendColor(it.trend) }}>{trendArrow(it.trend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card notch-4" style={{ padding: 14 }}>
        <span className="eyebrow brand">Mezo · heti tervjavaslat</span>
        {weeklySuggestion != null ? (
          <>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{weeklySuggestion}</p>
            <div className="row gap-sm mt-md">
              <button type="button" className="cta-ghost notch-4" style={{ fontSize: 10 }}>Elfogad</button>
              <button type="button" className="chip" style={{ fontSize: 9 }}>Hangoljuk</button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            A társ heti tervjavaslata hamarosan.
          </p>
        )}
      </div>
    </div>
  )
}
```

Mock-mode note: the seed `delta` is `4` (`+4` renders via the same `delta != null` branch — the mock describe stays green; `>= 0` keeps `+0` green rather than red).

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm vitest run src/features/insights/pages/WeeklyPage.test.tsx`
Expected: PASS (both describes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/pages/WeeklyPage.tsx frontend/src/features/insights/pages/WeeklyPage.test.tsx
git commit -m "feat(insights): WeeklyPage real review + tanulom null-state + honest suggestion (mezo-t16y.1)"
```

---

### Task 6: Honest surface — tab visibility + ghost pages

**Files:**
- Modify: `frontend/src/features/insights/pages/tabs.ts`
- Modify: `frontend/src/features/insights/pages/InsightsSubNav.tsx`
- Modify: `frontend/src/features/insights/pages/InsightsSubNav.test.tsx`
- Create: `frontend/src/features/insights/components/PhaseTeaserCard.tsx`
- Modify: `frontend/src/features/insights/pages/MemoirPage.tsx`, `PredictionsPage.tsx`, `ExperimentsPage.tsx` (+ their `.test.tsx`)
- Modify: `frontend/src/features/insights/pages/insights.nav.test.tsx`

**Interfaces:**
- Produces: `visibleInsightsTabs(): InsightsTab[]` (tabs.ts); `PhaseTeaserCard({ text }: { text: string })`.

- [ ] **Step 1: Write the failing tests.** `InsightsSubNav.test.tsx` — restructure into mode describes (keep the render helper):

```tsx
describe('InsightsSubNav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders all seven sub-nav items with verbatim labels', () => {
    renderAt('/insights')
    for (const label of ['Patterns', 'Weekly', 'Memoir', 'Knowledge', 'Chat', 'Predictions', 'Experiments']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  test('marks the active sub-view from the URL', () => {
    const { container } = renderAt('/insights/memoir')
    expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Memoir')
  })
})

describe('InsightsSubNav (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('hides the Phase-3+ tabs (Memoir/Predictions/Experiments)', () => {
    renderAt('/insights')
    for (const label of ['Patterns', 'Weekly', 'Knowledge', 'Chat']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Memoir', 'Predictions', 'Experiments']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  test('Patterns (index) is active only on exact /insights', () => {
    const { container } = renderAt('/insights/chat')
    expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Chat')
  })
})
```

Page tests — same pattern for all three; Memoir example (Predictions asserts its own seed lines + ghost copy `'A predikciókat a minta-motor adja majd — a proaktív réteggel érkezik.'`; Experiments: `'Az N=1 kísérletek a proaktív réteggel érkeznek.'`):

```tsx
describe('MemoirPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  // ... the file's existing tests move here unchanged ...
})

describe('MemoirPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the honest hamarosan ghost instead of the demo memoir', () => {
    render(<MemoirPage />)
    expect(screen.getByText('hamarosan')).toBeInTheDocument()
    expect(screen.getByText('A heti memoirt a társ írja majd — a proaktív réteggel érkezik.')).toBeInTheDocument()
    expect(screen.queryByText('Egy hét amikor a tested megtanult várni')).not.toBeInTheDocument()
  })
})
```

`insights.nav.test.tsx` — the app renders in the suite's ambient mode, so split:

```tsx
describe('insights nav (real mode default)', () => {
  test('Insights opens on Patterns; Weekly link works; Memoir is hidden', async () => {
    renderApp('/insights')
    expect(screen.getByRole('heading', { level: 1, name: 'Patterns' })).toBeInTheDocument()
    expect(await screen.findByText(/Új minták ·/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Memoir' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Weekly' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Weekly' })).toBeInTheDocument()
  })
})

describe('insights nav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('Memoir navigation renders the demo memoir', async () => {
    renderApp('/insights')
    await userEvent.click(screen.getByRole('link', { name: 'Memoir' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Memoir' })).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })
})
```

(The old real-mode expectation `'Új minták · 3'` becomes the looser `/Új minták ·/` — the count depends on the ambient default MSW patterns fixture, and this test must pass in BOTH suite runs.)

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm vitest run src/features/insights/pages/`
Expected: new real-mode expectations FAIL.

- [ ] **Step 3: Implement.** `tabs.ts` — append:

```ts
import { isMockMode } from '@/data/_client/mode'

/** Phase-3+ demo surfaces (mezo-t16y.1): hidden in real mode until the proactive epic ships them. */
const PHASE3_TAB_IDS = new Set(['memoir', 'predictions', 'experiments'])

export function visibleInsightsTabs(): InsightsTab[] {
  return isMockMode() ? INSIGHTS_TABS : INSIGHTS_TABS.filter((t) => !PHASE3_TAB_IDS.has(t.id))
}
```

`InsightsSubNav.tsx`: `INSIGHTS_TABS.map(...)` → `visibleInsightsTabs().map(...)` (import updated).

`components/PhaseTeaserCard.tsx`:

```tsx
/** Honest real-mode ghost for Phase-3+ demo tabs — a direct URL never shows fiction. */
export function PhaseTeaserCard({ text }: { text: string }) {
  return (
    <div className="card notch-12" style={{ padding: 18, textAlign: 'center' }}>
      <span className="eyebrow text-tertiary">hamarosan</span>
      <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}
```

Each page gets an early return (Memoir shown; same two lines on the other two with their copy):

```tsx
import { isMockMode } from '@/data/_client/mode'
import { PhaseTeaserCard } from '@/features/insights/components/PhaseTeaserCard'
// first line of the component body:
  if (!isMockMode()) return <PhaseTeaserCard text="A heti memoirt a társ írja majd — a proaktív réteggel érkezik." />
```

(`MemoirPage`'s `useState` sits AFTER this return — move the early return above the hook call is a rules-of-hooks violation; instead place the guard BEFORE `useState` is fine only if no hooks precede… `useState` IS a hook. So in `MemoirPage` put the guard AFTER the `useState`/`useInsights` calls — hooks run, then return the teaser. In the two hook-less pages the guard can be first.)

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm vitest run src/features/insights/ && VITE_USE_MOCK=true pnpm vitest run src/features/insights/`
Expected: PASS in both modes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/
git commit -m "feat(insights): hide Phase-3 tabs in real mode + hamarosan ghost pages (mezo-t16y.1)"
```

---

### Task 7: Full gates + living docs

**Files:**
- Modify: `docs/features/insights.md` (§1 status table, §2.2/2.3/2.6/2.7 behavior, §3 data flow, §4 endpoints, §6 consume snippet, §9 decisions, §10 key files)
- Modify: `docs/features/train.md` (§4: `GET /api/train/workouts` + `WorkoutSummaryResponse`; §10 if it lists contract ops)
- Modify: `docs/milestones/roadmap.md` (D′ milestone row)

- [ ] **Step 1: Run every gate**

```bash
cd backend && ./mvnw clean test
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: all green. Fix regressions before proceeding (grep for other tests asserting the seven tabs or weekly seed copy: `git grep -l "Memoir" frontend/src | grep test`).

- [ ] **Step 2: Update the docs** listed above. Key content: Weekly is REAL dual-mode (client-composed, score formula + constants, tanulom gate, deltaLabel); Memoir/Predictions/Experiments = honest-hidden (mock keeps demo); `useInsights` no longer returns `weekly`; new Train endpoint documented with its "logged work" semantics; note the score constants as future backend config. Check `docs/features/_platform-api-backend.md` — if it carries an endpoint inventory, add the new op there too.

- [ ] **Step 3: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: clean (staleness flags for insights.md/train.md cleared).

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs(insights,train): D' Weekly real + honest surface + listWorkouts endpoint (mezo-t16y.1)"
```

---

### Task 8: Merge, push, close

- [ ] **Step 1:** `git checkout main && git pull --rebase` (BEFORE the merge — never after, it flattens the `--no-ff` merge; see memory `git-noff-merge-flatten-trap`).
- [ ] **Step 2:** `git merge --no-ff feat/insights-weekly -m "Merge feat/insights-weekly — D' Insights Weekly real + honest surface (mezo-t16y.1)"`
- [ ] **Step 3:** `git branch -d feat/insights-weekly`
- [ ] **Step 4:** `bd close mezo-t16y.1` then `bd update mezo-t16y.1 --notes "<ship summary>"` (close takes no reason arg — memory `bd-close-reason-arg`).
- [ ] **Step 5:** `bd dolt push && git push && git status` — must be "up to date with origin".

## Self-review notes

- Spec §3.1–§3.5 all map to Tasks 1–6; §5 gates → Task 7; docs §6 → Task 7.
- Type names consistent: `WorkoutSummaryResponse` (contract/Java/TS), `WeekMetrics`, `WeeklyView`, `visibleInsightsTabs`, `PhaseTeaserCard`.
- The `'2/…'` Edzés assertion in Task 4 tolerates the default schedule fixtures' planned count; exact planned counts are pinned only in the pure-fn tests — deliberate, the MSW schedule fixtures are shared.
