# Weekly Review (Én / Heti) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `Heti` tab under Én: per-day data + deterministic daily AI scores + weekly aggregates for any week, an auto-generated (Monday) LLM weekly analysis with a 10:00 push, a deterministic AI-discoveries digest, and per-day/per-week chat handoff with server-side week context — replacing the Insights `Heti` tab.

**Architecture:** Two layers. A live deterministic data layer in `feature.companion` (`DayScoreService` + `MeWeekService` + `GET /api/me/week/{start}`) composed from `MetricSeriesService` reads. A generated analysis layer in `feature.proactive` (`WeeklyReviewEntity` + `WeeklyReviewGenerator` on the `MemoirGenerator` idiom + REST + Monday cron + push). Chat handoff = anchored conversations: nullable `context_kind`/`context_date` on `ai_conversation`, a `[Heti adatok]` system-prompt block, and a server-generated opening assistant message.

**Spec:** `docs/superpowers/specs/2026-08-27-weekly-review-design.md` (approved). **bd:** mezo-p2tr.

**Tech Stack:** Spring Boot 3 + JPA + Liquibase + Testcontainers; contract-first OpenAPI (`api/feature/*` → `openapi-merge-cli` → generated DTOs both sides); React 18 + TanStack Query + hand-rolled SVG (no chart lib); Vitest + MSW dual-mode tests.

## Global Constraints

- Worktree branch `feat/weekly-review`; every commit subject carries `(mezo-p2tr)`, conventional-commit style, ending with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- **Contract-first:** never hand-write boundary DTOs. Edit `api/feature/<name>/<name>.yml` (+ `api/generate/merge.yml` for new files) → `cd api/generate && npm run generate:api` → backend implements the generated `<Tag>Api` with `io.mrkuhne.mezo.api.dto.*` → `cd frontend && pnpm generate:api`. CI has a contract-drift check.
- **Backend:** constructor DI via `@RequiredArgsConstructor`; `@Transactional` method-level only; feature switches via `@ConditionalOnProperty` on `FeaturesConfiguration` constants; tunables as `@Validated` `*Properties` records under `mezo:` in `application.yml` (never `@Value` literals in code); UUID PKs; `created_by` set server-side; soft delete via `@SQLDelete`/`@SQLRestriction`; jsonb via `@JdbcTypeCode(SqlTypes.JSON)` typed envelopes; Liquibase changesets `backend/src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-p2tr_{desc}.sql`; new tables registered in the test `ResetDatabase`.
- **Backend tests:** integration-first `@SpringBootTest` extending the existing `AbstractIntegrationTest`/`ApiIntegrationTest` base, `*Populator` factories. Locally run ONLY focused tests for what you changed (`./mvnw test -Dtest=...`) — the full suite runs in CI. If a full local run is ever needed: `-Dmezo.test.use-testcontainers=true`.
- **Frontend:** `features/<domain>/{pages,components,sheets,logic}/`; routed leafs are `*Page`; pure math in `logic/`; deep `@/*` imports, no `../`; `shared/ui` must not import `@/data/*`. Dual-mode rule: `isMockMode()` called inside hook bodies; reads via `useDualQuery` (honest `realEmpty`, never mock fallback in real mode) or the inert-in-mock `useRealQuery` idiom; every hook called unconditionally. Real-mode tests via MSW (`src/test/msw/handlers.ts`).
- **Frontend gates per task:** `cd frontend && pnpm test` **and** `VITE_USE_MOCK=true pnpm test` (both modes) + `pnpm build` before the task's final commit. (Bare `pnpm test` in a worktree = mock mode — the real-mode run needs `VITE_USE_MOCK=false pnpm test`. Run BOTH: `VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`.)
- **Copy is Hungarian**, matches existing tone („tanulom" null states, never fabricated numbers). Charts use `--dv-*`/domain token colors, never UI-role tokens.
- **Null discipline everywhere:** missing data is absent/null — never zero-filled, never invented. LLM answers are strict JSON; unusable answer ⇒ no row.
- All new backend beans in `feature.companion` condition on `COMPANION_SWITCH`; in `feature.proactive` on both `COMPANION_SWITCH` + `PROACTIVE_SWITCH` (job additionally on its own cron switch).
- `feature.companion` must NOT import `feature.proactive` (ArchUnit `feature_slices_are_cycle_free`); the reverse is allowed. Cross-direction reads go through an `ObjectProvider` port interface defined in companion, implemented in proactive (the `TodayActivitySource` precedent).

---

### Task 1: DayScoreService (deterministic daily score, backend)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/MeWeekProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java`
- Modify: `backend/src/main/resources/application.yml` (add `mezo.companion.me-week` block near the other companion tunables)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/DayScoreServiceIT.java`

**Interfaces:**
- Consumes: `MetricSeriesService.series(UUID userId, MetricKey metric, LocalDate from, LocalDate to): Map<LocalDate, Double>`; `CheckInRepository` (count per day); `FuelDayService` day rollup targets (via `MetricSeriesService` kcal/protein series + a targets read — see below).
- Produces (later tasks rely on these exact names):
  ```java
  public record DaySubscores(Integer sleep, Integer fuel, Integer checkin, Integer activity) {}
  public record DayScore(LocalDate date, Integer score, DaySubscores subscores) {}
  // score/subscore ints are 0–100; null = "tanulom" (insufficient data)
  public List<DayScore> scores(UUID userId, LocalDate from, LocalDate to)
  ```

**Score formula (the promoted `deriveScore`, per-day):** each subscore ∈ [0,1] then ×100, rounded:
- `sleep`: `d = min(1, durationH / sleepTargetH)`; if quality present → `0.7*d + 0.3*clamp01((quality-1)/4)` else `d`. Absent when no sleep row.
- `fuel`: `kcalCloseness = max(0, 1 - |kcal/kcalTarget - 1| / kcalBand)`; if protein target > 0 → `0.5*kcalCloseness + 0.5*min(1, protein/proteinTarget)` else `kcalCloseness`. Absent when no kcal logged that day or kcalTarget ≤ 0. Targets come from `FuelDayService`'s rollup for the day (same source `FuelWeekResponse` uses).
- `checkin`: `c = count/4` (canonical slots); if energy avg present → `0.6*c + 0.4*clamp01((energyAvg-1)/4)` else `c`. Absent when count = 0.
- `activity`: `max(workoutLogged ? 1 : 0, min(1, xp / xpBaseline))` where `workoutLogged` = the day appears in the `GYM_VOLUME_KG` or `SPORT_LOAD_MIN` or `TRAINING_RPE` series; `xp` from the `DAILY_XP` series. Absent when no workout AND no XP entry.
- Day `score` = `round(100 * mean(present subscores))`; **null when fewer than 2 subscores present**.
- Constants in `MeWeekProperties` record bound to `mezo.companion.me-week`: `sleepTargetH` (default 8.0), `kcalBand` (0.25), `xpBaseline` (150). `@Validated`, positive constraints.
- **Verify the 1–5 scales before implementing:** sleep `quality` and check-in `energy` columns are unconstrained ints — confirm the FE input range in `frontend/src/features/*/sheets` (sleep quality sheet, check-in sheet). If the range differs from 1–5, adjust `clamp01((v-1)/4)` to the actual span and note it in the javadoc.

- [ ] **Step 1: Write the failing integration test** — `DayScoreServiceIT` extending the house `AbstractIntegrationTest` idiom (copy the setup style of an existing companion IT, e.g. the MetricSeriesService or pattern tests). Cases, each on its own day, using the existing `*Populator` factories for sleep/meal/checkin/workout rows:

```java
@Test
void fullDayScoresAllFourSubscores() {
    // seed: sleep 8h quality 4; meals hitting kcal target ±0 and protein target; 4 checkins energy 4; one workout
    // expect: all four subscores non-null, score == round(mean); score between 0 and 100
}

@Test
void sparseDayWithOneDomainIsHonestNull() {
    // seed: only a sleep row
    // expect: subscores.sleep non-null, others null, score == null ("tanulom")
}

@Test
void emptyDayYieldsNullEverything() {
    // no rows: subscores all null, score null
}

@Test
void kcalOutsideBandScoresZeroFuelCloseness() {
    // kcal = 2× target (factor 2.0, way outside the 0.25 band) → fuel subscore == protein-only half or 0 when no protein target
}
```

- [ ] **Step 2: Run the test, verify it fails** — `./mvnw test -Dtest=DayScoreServiceIT` → compilation failure (class missing).
- [ ] **Step 3: Implement `MeWeekProperties` + `DayScoreService`** per the formula above; add the `application.yml` block:

```yaml
    # Weekly review (mezo-p2tr) — deterministic day-score constants (spec §2).
    me-week:
      sleep-target-h: 8.0
      kcal-band: 0.25
      xp-baseline: 150
```

Service skeleton (one pass over the range, series fetched once per metric — never per day):

```java
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayScoreService {
    private final MetricSeriesService metricSeriesService;
    private final CheckInRepository checkInRepository;
    private final FuelDayService fuelDayService;
    private final MeWeekProperties properties;

    @Transactional(readOnly = true)
    public List<DayScore> scores(UUID userId, LocalDate from, LocalDate to) { ... }
}
```

Check-in counts: add a derived method to `CheckInRepository` if a date-range read is missing (`findByCreatedByAndDateBetween...` — check what exists; the single-date read is `?date=` today). Fuel targets: reuse whatever `FuelDayService` method the `/api/fuel/week` rollup calls (read it first; do not duplicate its logic).

- [ ] **Step 4: Run the test, verify it passes** — `./mvnw test -Dtest=DayScoreServiceIT`.
- [ ] **Step 5: Commit** — `feat(companion): deterministic per-day score service (mezo-p2tr)`.

---

### Task 2: `GET /api/me/week/{start}` contract + MeWeekService + controller

**Files:**
- Create: `api/feature/me-week/me-week.yml`; Modify: `api/generate/merge.yml` (append input)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MeWeekService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/MeWeekController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/controller/MeWeekControllerIT.java`

**Interfaces:**
- Consumes: `DayScoreService.scores(userId, from, to)` (Task 1); `MetricSeriesService.series(...)`; `WeightTrendService` (existing — read its public API before wiring); sleep/checkin repos.
- Produces: generated `MeWeekApi` + DTOs `MeWeekResponse`, `MeWeekDay`, `MeWeekAggregates`; `MeWeekService.week(UUID userId, LocalDate start): MeWeekResponse` — later tasks (generator Task 5, renderer Task 9) call this exact method.

- [ ] **Step 1: Write the contract.** `api/feature/me-week/me-week.yml`, tag `MeWeek`, one path (mirror `proactive.yml` file structure incl. the 401 blocks with `SystemMessageList`):

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: MeWeek
    description: >-
      Weekly review data layer (mezo-p2tr) — live, deterministic per-day values + day scores +
      weekly aggregates for one ISO-Monday week. Scores are code-computed (spec §2); missing
      data is null ("tanulom"), never fabricated.
paths:
  /api/me/week/{start}:
    get:
      tags: [MeWeek]
      operationId: getMeWeek
      summary: The week's per-day data + deterministic day scores + weekly aggregates (live for the current week)
      parameters:
        - name: start
          in: path
          required: true
          description: The week's ISO Monday (400 when the date is not a Monday)
          schema: { type: string, format: date }
      responses:
        '200':
          description: The week (always exactly 7 day entries, start..start+6)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MeWeekResponse' }
        '400':
          description: start is not an ISO Monday
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    MeWeekSubscores:
      type: object
      properties:
        sleep:    { type: integer, nullable: true, description: 0–100; null = no sleep data }
        fuel:     { type: integer, nullable: true }
        checkin:  { type: integer, nullable: true }
        activity: { type: integer, nullable: true }
    MeWeekDay:
      type: object
      required: [date, subscores, checkinCount, workoutCount]
      properties:
        date: { type: string, format: date }
        score: { type: integer, nullable: true, description: 0–100; null = "tanulom" (<2 subscores) }
        subscores: { $ref: '#/components/schemas/MeWeekSubscores' }
        kcal: { type: number, nullable: true, description: consumed kcal; null when nothing logged }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
        kcalTarget: { type: number, nullable: true }
        proteinTargetG: { type: number, nullable: true }
        weightKg: { type: number, nullable: true }
        sleepMin: { type: integer, nullable: true }
        sleepQuality: { type: number, nullable: true }
        checkinCount: { type: integer }
        checkinEnergyAvg: { type: number, nullable: true }
        workoutCount: { type: integer, description: gym + sport + run sessions logged on the day }
        xp: { type: integer, nullable: true }
    MeWeekAggregates:
      type: object
      properties:
        score: { type: integer, nullable: true, description: round(mean of non-null day scores); null when <2 }
        prevWeekScore: { type: integer, nullable: true }
        avgKcal: { type: number, nullable: true, description: mean over days with logged kcal }
        avgProteinG: { type: number, nullable: true }
        avgSleepMin: { type: number, nullable: true }
        avgCheckinEnergy: { type: number, nullable: true }
        checkinRatio: { type: number, nullable: true, description: filled slots / (4 × elapsed days of the week) }
        latestWeightKg: { type: number, nullable: true }
        weightWeeklyRateKg: { type: number, nullable: true, description: EWMA weekly rate from the weight trend }
        totalXp: { type: integer, nullable: true }
    MeWeekResponse:
      type: object
      required: [start, days, weekly]
      properties:
        start: { type: string, format: date }
        days:
          type: array
          items: { $ref: '#/components/schemas/MeWeekDay' }
        weekly: { $ref: '#/components/schemas/MeWeekAggregates' }
```

Append `  - inputFile: ../feature/me-week/me-week.yml` to `api/generate/merge.yml`, run `cd api/generate && npm run generate:api`, then regenerate backend DTOs the way the build does (the backend picks up `api/openapi.yml` via its generator maven plugin — just compile) and `cd frontend && pnpm generate:api`.

- [ ] **Step 2: Write the failing controller IT** — `MeWeekControllerIT` extending the house `ApiIntegrationTest` base (copy an existing companion controller IT's auth/setup style):

```java
@Test
void weekReturnsSevenDaysWithScoresAndAggregates() {
    // seed 2 dense days (sleep+meals+checkins+workout) inside a fixed Monday week
    // GET /api/me/week/{monday} → 200; days.length == 7; the 2 seeded days have score != null,
    // the empty days have score == null and checkinCount == 0; weekly.score == null (<2 scored days is false here —
    // with exactly 2 scored days weekly.score != null); weekly.avgKcal averages ONLY logged days
}

@Test
void nonMondayIs400() { /* GET /api/me/week/2026-08-19 → 400 */ }

@Test
void prevWeekScoreComesFromThePriorWeek() {
    // seed 2 dense days in week W-1 as well → weekly.prevWeekScore != null
}
```

- [ ] **Step 3: Run it, verify failure** — `./mvnw test -Dtest=MeWeekControllerIT` (missing controller).
- [ ] **Step 4: Implement `MeWeekService` + `MeWeekController implements MeWeekApi`.** Service composes: `DayScoreService.scores` (this week + prev week for `prevWeekScore`), kcal/protein/carb/fat + targets from the fuel rollup source, weight from `WeightLogRepository` (latest entry per day), sleep min/quality from `SleepLogRepository`, checkin count + energy avg from `CheckInRepository`, workout count from the three train series' day-presence, XP from `DAILY_XP`. `checkinRatio` divides by elapsed days only (`min(7, today - start + 1)` clamped ≥1, full 7 for past weeks). Controller validates Monday: `if (start.getDayOfWeek() != DayOfWeek.MONDAY) throw` the house 400 (`SystemRuntimeErrorException` + `SystemMessage` — copy an existing 400 pattern). Carbs/fat: extend the fuel rollup read the same way kcal/protein come out of `MacroSet` (`getC()`, `getF()`).
- [ ] **Step 5: Run the IT, verify pass; commit** — `feat(api,companion): /api/me/week live weekly data endpoint (mezo-p2tr)` (include the regenerated `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`).

---

### Task 3: FE data layer — `useMeWeek` dual-mode hook + mock seed

**Files:**
- Create: `frontend/src/data/me/meWeekApi.ts`, `frontend/src/data/me/meWeek.ts` (mock seed), `frontend/src/data/me/meWeekHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel export), `frontend/src/test/msw/handlers.ts` (real-mode handler)
- Test: `frontend/src/data/me/meWeekHooks.test.ts` (colocated, both modes)

**Interfaces:**
- Consumes: generated `components['schemas']['MeWeekResponse']` from `api.gen.ts` (Task 2); `mondayIso`, `deriveWeekTitle` from `@/data/fuel/fuelWeekHooks`.
- Produces:
  ```ts
  export type MeWeek = components['schemas']['MeWeekResponse']
  export type MeWeekDay = components['schemas']['MeWeekDay']
  export const meWeekApi = { get: (startIso: string) => Promise<MeWeek> }
  export function useMeWeek(startIso: string): { week: MeWeek | null, mode: 'mock' | 'live' }
  ```

- [ ] **Step 1: Write the mock seed** `meWeek.ts` — one deterministic demo week (Monday `2026-05-18`) with 5 dense days + 2 sparse (one `score: null` „tanulom" day), realistic HU-plausible values; export `mockMeWeekStart` and a `mockMeWeek(startIso)` helper returning the seed re-dated to the requested Monday (shift each day's `date`), so the mock page can browse weeks.
- [ ] **Step 2: Write the failing hook tests** — mock mode returns the seed for any Monday (`vi.stubEnv('VITE_USE_MOCK', 'true')` per the house test pattern — copy the setup of an existing dual-mode hook test, e.g. a `fuelWeekHooks` or `weeklyHooks` test); real mode (MSW handler for `/api/me/week/:start`) returns the fetched week and `null` (not the seed!) while unresolved — assert the `realEmpty` invariant.
- [ ] **Step 3: Run tests, verify fail** — `VITE_USE_MOCK=false pnpm test meWeekHooks && VITE_USE_MOCK=true pnpm test meWeekHooks`.
- [ ] **Step 4: Implement** `meWeekApi` (`apiFetch<MeWeek>(`/api/me/week/${startIso}`)`) + `useMeWeek` with `useDualQuery`:

```ts
export function useMeWeek(startIso: string) {
  return useDualQuery<{ week: MeWeek | null; mode: 'mock' | 'live' }>({
    queryKey: ['meWeek', startIso],
    mockData: { week: mockMeWeek(startIso), mode: 'mock' },
    realFetch: async () => ({ week: await meWeekApi.get(startIso), mode: 'live' }),
    realEmpty: { week: null, mode: 'live' },
  })
}
```

Export from `data/hooks.ts` (the only allowed barrel).
- [ ] **Step 5: Run both modes green + commit** — `feat(me): dual-mode useMeWeek hook + seed (mezo-p2tr)`.

---

### Task 4: WeekPage UI — tab, route, hero, stat strip, day grid

**Files:**
- Create: `frontend/src/features/me/pages/WeekPage.tsx`, `frontend/src/features/me/components/WeekDayCard.tsx`, `frontend/src/features/me/components/WeekScoreBars.tsx`, `frontend/src/features/me/logic/weekNav.ts`
- Modify: `frontend/src/features/me/pages/tabs.ts` (insert `{ id: 'week', to: '/me/week', label: 'Heti' }` after `journal`), `frontend/src/app/router.tsx` (child route `{ path: 'week', element: <WeekPage /> }` under `me`)
- Test: `frontend/src/features/me/pages/WeekPage.test.tsx`, `frontend/src/features/me/logic/weekNav.test.ts`

**Interfaces:**
- Consumes: `useMeWeek(startIso)` (Task 3); `ScoreRing`, `StatStrip`/`StatCell`, `Icon` from `@/shared/ui`; `deriveWeekTitle`, `mondayIso` from `@/data/fuel/fuelWeekHooks`; `huMonthDayDow` from `@/shared/lib/dates`.
- Produces: `WeekPage` (route leaf) reading `?start=` (invalid/absent → current `mondayIso()`); `weekNav.ts` exports `prevMonday(startIso)`, `nextMonday(startIso)`, `isCurrentWeek(startIso)` (pure, tested). Tasks 8 & 10 add cards/buttons into this page — keep the section order of spec §1 and render sections from small components so later tasks only append.

- [ ] **Step 1: Write failing logic tests** for `weekNav.ts` (±7 days across month/year boundaries; `isCurrentWeek` true only for `mondayIso()` of today).
- [ ] **Step 2: Implement `weekNav.ts`; tests green.**
- [ ] **Step 3: Write failing page test** (mock mode): renders week title, 7 `WeekDayCard`s, hero score (or „tanulom" for a null-score seed week), stepper: next-week button disabled on the current week; clicking a day card expands it (subscore rows visible).
- [ ] **Step 4: Implement the page.** Structure (`pghead-np lav` header idiom from `WeightPage.tsx`; padding `'0 24px 24px'`):
  - Header: eyebrow `Én · heti áttekintés`, `<h1>{deriveWeekTitle(start)}</h1>`, stepper row: `‹` chip → `?start=prevMonday`, `›` chip disabled when `isCurrentWeek(start)` (write via `setParams`, `replace: true`).
  - Hero card: `score != null` → the `WeeklyPage` big-number treatment (56px display font, `/100`) + delta chip vs `weekly.prevWeekScore`; null → the exact „tanulom / még gyűjtöm az adatokat a heti értékeléshez" null-state copied from the old `WeeklyPage.tsx:36-46`.
  - `StatStrip` of `StatCell`s: `Kcal átlag`, `Fehérje`, `Alvás`, `Check-in`, `Súly trend` (`weightWeeklyRateKg` formatted `±x.xx kg/hét`), `XP` — each `—` when null.
  - `WeekScoreBars`: 7-bar inline SVG (viewBox `0 0 300 60`), bar height ∝ score, color `var(--dv-1)` (fallback `var(--lav-deep)` if no `--dv-*` band exists — check `_platform-design-system.md` tokens first), null-score day renders a 2px baseline stub; `H K Sz Cs P Sz V` axis row (the `WeeklyWeightCard` footer idiom).
  - `WeekDayCard` (one per day, the `WeeklyWeightCard` expand idiom): collapsed row = `huMonthDayDow(date)` + score badge (or `—`) + compact `kcal · alvás · súly · check-in` values; expanded = macro row vs targets (`P/C/F` with targets), sleep detail (`sleepMin` as `7ó 20p` + quality), `workoutCount`, XP, subscore breakdown rows (`Alvás 82 · Táplálkozás 61 · Check-in 100 · Aktivitás 75`, null → `—`), and a placeholder slot `dayNote?: string | null` + `onChat?: () => void` props (wired in Tasks 8/10 — render nothing when absent). Current-week future days render dimmed with no expand.
- [ ] **Step 5: Both test modes + build green; commit** — `feat(me): Heti tab — week page with day grid and score hero (mezo-p2tr)`.

---

### Task 5: `weekly_review` table + WeeklyReviewGenerator (proactive)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/{now}_mezo-p2tr_create_weekly_review.sql` (+ register in `1.0.0_master.yml` the way the neighbors are)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/WeeklyReviewEntity.java`, `.../entity/WeeklyReviewDayNotesEnvelope.java`, `.../entity/WeeklyReviewHighlightsEnvelope.java`, `.../repository/WeeklyReviewRepository.java`, `.../service/WeeklyReviewGenerator.java`
- Modify: the test `FakeCompanionLlm` (find it: `grep -rn "MEMOIR_MARKER" backend/src/test`) to dispatch on the new marker; test `ResetDatabase` (add `weekly_review`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGeneratorIT.java`

**Interfaces:**
- Consumes: `MeWeekService.week(userId, start)` (Task 2); `PatternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(...)` (existing); `KnowledgeFactRepository` created-in-week read (reuse/extend the existing `createdAt >=` derived method); `GraphNodeRepository` (add derived method `findByCreatedByAndKindAndStatusAndOccurredOnBetweenAndDeletedFalse` for LIFE_EVENT); `MemoirRepository.findByCreatedByAndWeekStart`; `PredictionRepository` weekStart read; `CompanionLlm.completeSmart`; `LlmCallContextHolder`; `AppNotificationEmitter`.
- Produces: `WeeklyReviewGenerator.generate(UUID userId, LocalDate weekStart): WeeklyReviewEntity` (null on empty week/unusable answer; existing row returned untouched — the `MemoirGenerator.generate` contract, mirrored) and `WeeklyReviewGenerator.WEEKLY_REVIEW_MARKER = "HETI-ELEMZES-FELADAT"`. Entity fields: `weekStart, summary (text), dayNotes (jsonb), highlights (jsonb), generatedAt` + partial unique `(created_by, week_start) where is_deleted = false`.

- [ ] **Step 1: Changeset + entity + envelopes + repository.** SQL mirrors the `memoir` table's changeset (find it in `1.0.0/script/`, copy structure: uuid pk, created_by, is_deleted, created_at, week_start date not null, summary text not null, day_notes jsonb not null, highlights jsonb not null, generated_at timestamptz not null, partial unique index). Envelopes:

```java
public record WeeklyReviewDayNotesEnvelope(List<DayNote> notes) {
    public record DayNote(LocalDate date, String note) {}
}
public record WeeklyReviewHighlightsEnvelope(List<Highlight> highlights) {
    public record Highlight(String kind, String label) {} // kind: Pattern|Fact|LifeEvent|Memory
}
```

Repository: `Optional<WeeklyReviewEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);`. Register the table in `ResetDatabase`.
- [ ] **Step 2: Write the failing generator IT** (FakeCompanionLlm-driven, mirror `MemoirGeneratorIT` if one exists — find and copy its structure):

```java
@Test
void generatesRowFromWeekData() {
    // seed a dense prior week (reuse Task 2's populator recipe) + one confirmed pattern_event in-week
    // fake answers {"summary":"…","dayNotes":[{"date":"<mon>","note":"…"}],"highlightIndexes":[0]}
    // expect: row persisted, summary/dayNotes stored, highlights resolved BY INDEX from candidates,
    // AppNotification emitted with kind weekly_review_ready and dedup "weekly_review_ready:<weekStart>"
}
@Test
void emptyWeekProducesNoRow() { /* no data days → generate returns null, no row, no notification */ }
@Test
void unusableAnswerProducesNoRow() { /* fake returns garbage → null, no row */ }
@Test
void existingRowReturnedUntouched() { /* second call returns the same row, no second LLM call */ }
@Test
void invalidHighlightIndexesAreDropped() { /* fake returns [0, 99] → only candidate 0 resolved */ }
```

- [ ] **Step 3: Run, verify fail; implement the generator** on the `MemoirGenerator` skeleton (same annotations/switches, same `gather → completeSmart → parse → persist → emit` flow, `LlmCallContext("proactive_weekly_review", "generate", null, null)`). Gather payload sections, all pure code: (1) the week's day rows + scores from `MeWeekService.week` rendered as compact HU lines (`- 2026-08-18 (H): score 74 [alvás 82 · fuel 61 · checkin 100 · aktivitás –], 2140 kcal / cél 2200, fehérje 168g, súly 87.9, alvás 7ó12p (4), 3 check-in, 1 edzés, 120 XP` — null → `–`); (2) `MINTA-ESEMÉNYEK A HÉTEN:` confirmed/reinforced/promoted pattern events (candidate kind `Pattern`, label = pattern title via `PatternRepository`); (3) `ÚJ TÉNYEK:` facts created in-week (kind `Fact`, label = factText truncated 80); (4) `ÉLETESEMÉNYEK:` active LIFE_EVENT nodes with `occurredOn` in-week (kind `LifeEvent`, label = title); (5) memoir title if present (kind `Memory`, label = weekStart ISO); (6) predictions for the week + status lines; (7) the numbered `HORGONY-JELÖLTEK` list (memoir idiom, verbatim). Empty-week gate: **no day in `MeWeekResponse` has any logged data** (all kcal/sleep/checkinCount/workoutCount empty) ⇒ return null before any LLM call. Prompt:

```java
public static final String WEEKLY_REVIEW_MARKER = "HETI-ELEMZES-FELADAT";
private static final String PROMPT = WEEKLY_REVIEW_MARKER + "\n"
        + "Elemezd Daniel hetét KIZÁRÓLAG a megadott adatokból: mi ment jól, mi tört meg, milyen "
        + "összefüggés látszik a napok között. Társ-hangnem, nem jelentés; számot kitalálni tilos; "
        + "gyógyszer-adagolást érintő javaslat tilos. Minden adatot tartalmazó naphoz írj 1-2 mondatos "
        + "megjegyzést. Válaszolj KIZÁRÓLAG szigorú JSON-nal: {\"summary\": \"a heti elemzés szövege\", "
        + "\"dayNotes\": [{\"date\": \"YYYY-MM-DD\", \"note\": \"...\"}], "
        + "\"anchorIndexes\": [a felhasznált HORGONY-JELÖLTEK sorszámai]}";
```

Parse record `ParsedReview(String summary, List<ParsedDayNote> dayNotes, List<Integer> anchorIndexes)`; blank summary ⇒ null; dayNotes filtered to dates inside the week. Notification emit (memoir idiom): kind `WEEKLY_REVIEW_READY` (added in Task 7 — for THIS task emit is behind the same call but the enum entry lands here to keep the task self-contained: add the enum entry `WEEKLY_REVIEW_READY("weekly_review_ready", null, "/me/week")` to `AppNotificationKind` now; familyKey null — the Task 7 push category reads the row itself, the memoir precedent), title `"Elkészült a heti elemzés"`, body = first sentence of summary, deeplink `AppNotificationKind.WEEKLY_REVIEW_READY.deeplink() + "?start=" + weekStart`, dedup `"weekly_review_ready:" + weekStart`. Extend `FakeCompanionLlm` to dispatch on `WEEKLY_REVIEW_MARKER`.
- [ ] **Step 4: Run the IT green** — `./mvnw test -Dtest=WeeklyReviewGeneratorIT`.
- [ ] **Step 5: Commit** — `feat(proactive): weekly review entity + generator (mezo-p2tr)`.

---

### Task 6: Weekly-review REST — get + regenerate + digest (contract + service)

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (three paths + schemas), regen both clients
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewService.java`, `.../service/WeeklyReviewDigestService.java`; Modify: the existing proactive controller (find: `grep -rn "getMemoir" backend/src/main/java` — add the three operations there or a sibling controller if the class is per-tag)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/controller/WeeklyReviewControllerIT.java`

**Interfaces:**
- Consumes: `WeeklyReviewGenerator.generate` (Task 5), `WeeklyReviewRepository`, pattern/fact/graph/memoir/prediction repos (Task 5's reads — extract shared week-window reads into package-private helpers if both need them).
- Produces contract (append to `proactive.yml`, same response-block style as its neighbors):
  - `GET /api/proactive/weekly-review/{start}` → `WeeklyReviewResponse { id, weekStart, summary, dayNotes: [{date, note}], highlights: [{kind,label}], generatedAt, stale: boolean }`; 404 when absent; 400 when `{start}` not Monday.
  - `POST /api/proactive/weekly-review/{start}/regenerate` → `WeeklyReviewResponse`; 409 when the week is not completed (`start.plusDays(7)` is after today); 404 when regeneration yields no row (empty week).
  - `GET /api/proactive/weekly-review/{start}/digest` → `WeeklyReviewDigestResponse { patterns: [{pairKey, title, event}], newFacts: [{id, text}], lifeEvents: [{id, title, occurredOn}], memoir: boolean, predictions: [{id, title, status}] }` — always 200, empty lists are the honest empty.
- Produces service API (Task 8's FE + Task 7's anchor need these): `WeeklyReviewService.find(userId, weekStart): Optional<WeeklyReviewEntity>`, `.getResponse(userId, weekStart)` (adds `stale`), `.regenerate(userId, weekStart)`.

- [ ] **Step 1: Contract edits + regenerate clients** (`npm run generate:api`, `pnpm generate:api`).
- [ ] **Step 2: Failing controller IT:** get-404-before-generation; get-200-after-generator-ran (seed via Task 5's fake-LLM path); `stale:false` right after generation and `stale:true` after inserting a newer weight log into the week; regenerate-409 for the current week; regenerate-200 replaces the row (new `generatedAt`, old row soft-deleted); digest lists the seeded pattern event + fact + LIFE_EVENT node and returns empty lists otherwise; non-Monday 400.
- [ ] **Step 3: Implement.** `stale` probe (best-effort, false on failure): max `createdAt` among the week's weight/sleep/checkin/meal rows via 4 derived `max`-style reads — implement as `findTop1ByCreatedByAndDateBetweenOrderByCreatedAtDesc`-shaped derived methods on the four repos (check each repo's existing naming; meal's day field may be `mealDate`-like — read the entity first) and compare to `generatedAt`. Regenerate: guard completed week → soft-delete existing (`repository.delete(row)` triggers `@SQLDelete`) → `generator.generate` (its existing-row check now finds nothing) → 404 if null. Digest service: the Task 5 week-window reads, mapped; pattern events joined to `PatternEntity` for `pairKey`/`title`, event = the event kind string.
- [ ] **Step 4: IT green; commit** — `feat(proactive,api): weekly-review read/regenerate/digest endpoints (mezo-p2tr)`.

---

### Task 7: Monday cron job + push category (Monday 10:00)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewJob.java`
- Modify: `FeaturesConfiguration` (add `WEEKLY_REVIEW_JOB_SWITCH = "mezo.techcore.cron.weekly-review-job.enabled"`), `application.yml` (cron `mezo.proactive.weekly-review.cron: "0 50 6 * * MON"` + the job switch `true` next to its siblings), `NotificationCategory` (add `WEEKLY_REVIEW("weekly_review", true, 0, false)`), `AnchorResolver` (new branch; retire the old `WEEKLY` branch), `frontend` notification-category labels (find: `grep -rn "'weekly'" frontend/src/features/me` — the Értesítés page's category list; add the new key's HU label `Heti elemzés`, keep/remove the old per what the list renders)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolverWeeklyReviewIT.java` (or extend the existing AnchorResolver test class — read it first and follow its style)

**Interfaces:**
- Consumes: `WeeklyReviewGenerator.generate` (Task 5); `WeeklyReviewRepository.findByCreatedByAndWeekStart`.
- Produces: Monday 06:50 generation for the **just-finished** week (`weekStart = previous Monday`, i.e. `LocalDate.now().with(TemporalAdjusters.previousOrSame(MONDAY)).minusWeeks(1)` — the review looks BACK, unlike the forward-looking suggestion job); push category `weekly_review` anchored Monday 10:00.

- [ ] **Step 1: Job** — copy `WeeklySuggestionJob` verbatim shape (same triple `@ConditionalOnProperty` + new job switch, `@Scheduled(cron = "${mezo.proactive.weekly-review.cron}")`, per-user try/catch), with the `minusWeeks(1)` weekStart.
- [ ] **Step 2: Failing anchor test:** on a Monday with a persisted `weekly_review` row → an `AnchoredEvent(NotificationCategory.WEEKLY_REVIEW, 600 /* 10:00 */, "10:00", "Mezo · heti elemzés", <summary excerpt>, "/me/week?start=<ws>")`; no row → no event; **the old WEEKLY category no longer emits** (assert absent even with a weekly_suggestion row present).
- [ ] **Step 3: Implement the AnchorResolver branch** (copy the `WEEKLY` branch at `AnchorResolver.java:497` structurally: fixed minute constant `WEEKLY_REVIEW_MINUTE = 10 * 60`, row lookup for the Monday's `weekStart = date.minusWeeks(... )` — on Monday itself the finished week is `date.minusWeeks(1)`? No: the job generated the row keyed by the finished week's Monday = `date.minusWeeks(1)` when `date` IS Monday; resolve accordingly and cover it in the test), body via the existing `excerptProse` helper, URL `"/me/week?start=" + weekStart`. Delete the old `WEEKLY` emission branch + its `URL_INSIGHTS_WEEKLY` constant; keep the `WEEKLY` enum entry itself (persisted `notification_pref` rows reference the key — removing the enum breaks `fromKey`), but javadoc it as retired.
- [ ] **Step 4: Tests green (`./mvnw test -Dtest='*AnchorResolver*'`); commit** — `feat(proactive,notification): Monday weekly-review job + 10:00 push, WEEKLY push retired (mezo-p2tr)`.

---

### Task 8: FE — analysis card, discoveries, next-week card on WeekPage

**Files:**
- Create: `frontend/src/data/me/weeklyReviewApi.ts`, `frontend/src/data/me/weeklyReviewHooks.ts`, `frontend/src/features/me/components/WeekReviewCard.tsx`, `frontend/src/features/me/components/WeekDiscoveries.tsx`, `frontend/src/features/me/components/WeekNextCard.tsx`
- Modify: `frontend/src/features/me/pages/WeekPage.tsx` (mount the three sections + pass `dayNote` into `WeekDayCard`), `frontend/src/data/me/meWeek.ts` (mock seeds for review/digest), `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`; check the feedback artifact-kind registry (`grep -rn "weekly_suggestion" api/feature/companion-feedback backend/src/main/java frontend/src/data/feedback` — register `weekly_review` wherever kinds are enumerated/validated, contract first if it's in the yml)
- Test: `frontend/src/data/me/weeklyReviewHooks.test.ts`, extend `WeekPage.test.tsx`

**Interfaces:**
- Consumes: Task 6's generated types (`WeeklyReviewResponse`, `WeeklyReviewDigestResponse`); `useFeedback` from `@/data/hooks`; `FeedbackChips` from `@/features/insights/components/FeedbackChips`; `weeklySuggestionApi` from `@/data/insights/weeklySuggestionApi` (the next-week card's source, unchanged endpoint).
- Produces:
  ```ts
  export function useWeeklyReview(startIso: string): {
    review: WeeklyReviewResponse | null   // null = not generated (404) or unresolved
    digest: WeeklyReviewDigestResponse | null
    regenerate: () => Promise<void>
    regenerating: boolean
    mode: 'mock' | 'live'
  }
  ```
  `WeekDayCard` gets its `dayNote` from `review.dayNotes` by date.

- [ ] **Step 1: Mock seeds** — a review (summary + 5 dayNotes + 2 highlights) and a digest (1 pattern, 1 fact, 1 life event, memoir true, 1 prediction) for the seed week; past mock weeks reuse it re-dated, the current mock week returns `null` review (so the ghost state is demoable).
- [ ] **Step 2: Failing hook tests** both modes: mock returns seeds; real: 404 → `review: null` honest (copy the `isSwitchedOff`-style 404-tolerant fetch from `weeklyHooks.ts:198-210`); digest fetched alongside; `regenerate` POSTs then invalidates `['weeklyReview', start]`.
- [ ] **Step 3: Implement hooks** (`useDualQuery` for the pair read; `regenerate` a plain async + `queryClient.invalidateQueries`; keys `['weeklyReview', start]`, `['weeklyReviewDigest', start]`).
- [ ] **Step 4: Failing page tests:** generated week → summary prose + FeedbackChips (kind `weekly_review`, keyed by review id) + day cards show their notes; ungenerated current week → ghost card `Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg.`; `stale: true` → `Frissítsd az elemzést` button visible, click calls regenerate (spinner while `regenerating`); discoveries: only non-empty subsections render, pattern rows link `/insights/patterns/{pairKey}`, fact rows link `/insights/knowledge`, memoir row links `/insights/memoir`; next-week card shows the weekly-suggestion prose under eyebrow `Mezo · a következő heted` (honest placeholder copy from `WeeklyPage.tsx:97-99` when null).
- [ ] **Step 5: Implement the three components + mount** (order per spec §1: hero → score bars → day grid → `WeekReviewCard` → `WeekDiscoveries` → `WeekNextCard`). Register the `weekly_review` feedback artifact kind end-to-end (contract → backend validation → regen).
- [ ] **Step 6: Both modes + build green; commit** — `feat(me): weekly analysis card, AI discoveries, next-week card (mezo-p2tr)`.

---

### Task 9: Anchored conversations — context columns, `[Heti adatok]` block, Mezo opening

**Files:**
- Modify: `api/feature/companion/companion.yml` (`createConversation` gains an optional requestBody), regen clients
- Create: changeset `{now}_mezo-p2tr_ai_conversation_context.sql` (`alter table ai_conversation add column context_kind varchar(10), add column context_date date`)
- Modify: `AiConversationEntity` (two nullable fields), `ConversationService.create` (signature gains the request), the companion controller's create operation
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/WeekContextRenderer.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/companion/WeekReviewSource.java` (port), `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeekReviewSourceAdapter.java`
- Modify: `ChatService` (anchored block in `assembleSystemPrompt` path + opening turn), `ChatStreamService`/`prepareTurn` path (same block — it flows through `assembleSystemPrompt`, so thread the conversation through)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/AnchoredConversationIT.java`

**Interfaces:**
- Consumes: `MeWeekService.week` (Task 2); `WeeklyReviewService.find` via the port (Task 6).
- Produces:
  - Contract: `CreateConversationRequest { context?: { kind: string /* 'week'|'day' pattern-validated */, date: string(date) } }` — optional body, existing no-body calls stay valid.
  - Port (in companion): `public interface WeekReviewSource { Optional<ReviewText> find(UUID userId, LocalDate weekStart); record ReviewText(String summary, List<DayNote> dayNotes) { public record DayNote(LocalDate date, String note) {} } }` — implemented by `WeekReviewSourceAdapter` in proactive (maps the entity), injected `ObjectProvider<WeekReviewSource>` (empty ⇒ block renders without the review section).
  - `WeekContextRenderer.render(UUID userId, String contextKind, LocalDate contextDate): String` — `"\n\n[Heti adatok]\n..."`; degrades to `""` on any failure (never throws — the graph-assembler precedent).
  - `ConversationService.create(UUID userId, CreateConversationRequest request): ConversationResponse` — persists context; when context present, invokes `ChatService.openingTurn(userId, conversationId)` after the save.
  - `ChatService.openingTurn(UUID userId, UUID conversationId): void` — assembles the anchored system prompt, calls `companionLlm.complete` with empty history, no tools, userContent = the internal `KICKOFF_PROMPT`; persists ONLY the assistant row; swallow-and-log on failure (conversation stays empty). `KICKOFF_PROMPT` (constant): `"Nyisd meg a beszélgetést te: rövid, 3-5 mondatos reflexió a [Heti adatok] blokk kiemelt napjáról (ha van kijelölt nap) vagy a hétről — mi tűnt fel, mi az egy dolog, amiről érdemes beszélni. Kérdéssel zárj."` — never persisted as a user message.

- [ ] **Step 1: Contract + changeset + entity fields + regen.** Anchored `assembleSystemPrompt`: extend the private method with a `conversationBlock` param — `prepareTurn`/`sendMessage` already load the conversation entity; when `contextKind != null`, insert `weekContextRenderer.render(...)` **after** the context snapshot, before the facts block. `kind='day'` → the renderer anchors the week `mondayIso(contextDate)` and appends `A KIJELÖLT NAP: <date> — erről beszélgetünk.` plus that day's expanded line; `kind='week'` → the week only. Block content: the Task 5 gather's day-line rendering (extract that formatting into a shared package-private formatter used by both — one source of truth) + weekly aggregates + review summary/dayNotes when the port finds one.
- [ ] **Step 2: Failing IT:**

```java
@Test
void anchoredConversationGetsWeekBlockEveryTurn() {
    // create conversation with context {kind: 'day', date: <a seeded day>}; capture the fake LLM's
    // received system prompt on a normal sendMessage turn → contains "[Heti adatok]" and the date line
}
@Test
void openingTurnPersistsAssistantOnlyMessage() {
    // create with context → exactly ONE message row, role=assistant, non-blank; conversation title still null
}
@Test
void openingTurnFailureLeavesEmptyConversation() { /* fake throws → create still 200, zero messages */ }
@Test
void plainConversationUnchanged() { /* create without body → no context columns, no [Heti adatok] on turns */ }
```

(Fake prompt capture: check how existing ITs assert on `FakeCompanionLlm` inputs — it records calls; follow that pattern.)
- [ ] **Step 3: Implement; IT green** — `./mvnw test -Dtest=AnchoredConversationIT`.
- [ ] **Step 4: Commit** — `feat(companion): anchored conversations — week context block + Mezo opening turn (mezo-p2tr)`.

---

### Task 10: FE chat handoff — „Beszélgess róla" buttons

**Files:**
- Modify: `frontend/src/data/insights/chatApi.ts` (`createConversation` gains optional context arg), `frontend/src/features/me/components/WeekDayCard.tsx` + `WeekReviewCard.tsx` (wire the buttons), `frontend/src/features/me/pages/WeekPage.tsx`
- Create: `frontend/src/features/me/logic/useChatHandoff.ts`
- Test: `frontend/src/features/me/logic/useChatHandoff.test.ts`, extend `WeekPage.test.tsx`

**Interfaces:**
- Consumes: `chatApi.createConversation`, `useNavigate`; generated `CreateConversationRequest` type.
- Produces:
  ```ts
  export function useChatHandoff(): {
    open: (context: { kind: 'week' | 'day'; date: string }) => void
    pending: boolean   // the create round-trip runs the opening LLM turn — button shows a spinner
  }
  ```
  Real mode: `POST` create with context → `navigate('/insights/chat?c=' + id)`. Mock mode: create a mock conversation id (the `sendMock` seeding idiom from `chatHooks.ts:181-199` — seed the conversations cache + a canned Mezo opening message into `chatKey(id)`), then navigate. Failure → toast (`useToast` from shared ui) `Nem sikerült elindítani a beszélgetést`, stay on the page.

- [ ] **Step 1: Failing hook test** (mock mode: navigates to `/insights/chat?c=<id>` and the target thread cache holds one assistant message; real mode via MSW: posts the context body, navigates on 200, `pending` true during flight, toast + no navigation on 500).
- [ ] **Step 2: Implement** `chatApi.createConversation(context?: CreateConversationRequest['context'])` (body only when present — existing callers unchanged) + the hook.
- [ ] **Step 3: Wire the buttons:** `WeekDayCard` expanded footer → `Beszélgess a napról` chip (`onChat` prop now provided by the page: `open({kind:'day', date})`); `WeekReviewCard` footer → `Beszélgess a hétről` (`open({kind:'week', date: startIso})`). Disabled for future days.
- [ ] **Step 4: Both modes + build green; commit** — `feat(me): chat handoff from week/day into anchored conversation (mezo-p2tr)`.

---

### Task 11: Migration — remove Insights/Heti, redirect, prune dead weekly code

**Files:**
- Delete: `frontend/src/features/insights/pages/WeeklyPage.tsx`
- Modify: `frontend/src/features/insights/pages/tabs.ts` (drop the `weekly` entry), `frontend/src/app/router.tsx` (replace the weekly child with `{ path: 'weekly', element: <Navigate to="/me/week" replace /> }` — the `motor` precedent at router.tsx:145; remove the `WeeklyPage` import)
- Modify/prune: `frontend/src/data/insights/weeklyHooks.ts` — delete `useWeekly`, `deriveScore`, `deriveWeekMetrics`, `deriveItems`, `trendOf`, `weightTrendOf`, `WeekMetrics`, `WeeklyView` and the now-unused mock weekly seeds in `data/insights/insights.ts`; **keep** `mondayIso` consumers working (it lives in fuelWeekHooks) and keep `prevMondayIso`/`isoWeekNumber`/`weekEndIso`/`inWeek` ONLY if still imported elsewhere (`grep` first; delete if orphaned). Check `GrowthWeekCard` usage — if `WeeklyPage` was its only consumer, delete it + its mock seed too.
- Test: update/delete the affected test files (`weeklyHooks` tests, any WeeklyPage test), add a router test asserting `/insights/weekly` lands on WeekPage.

- [ ] **Step 1: Grep-driven deletion list** (`grep -rn "useWeekly\|WeeklyPage\|GrowthWeekCard\|deriveScore\|deriveWeekMetrics" frontend/src`) — delete/adjust every hit; `WeeklyItem`/`WeeklyTrend`/`WeeklyGrowth` types in `data/types.ts` go too if orphaned.
- [ ] **Step 2: Redirect test green; full FE gates** (`VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`) — the build catches any dangling import.
- [ ] **Step 3: Commit** — `refactor(insights): retire Heti tab — /insights/weekly redirects to /me/week (mezo-p2tr)`.

---

### Task 12: Docs, lint, gates, ship

**Files:**
- Modify: `docs/features/me.md` (new „Heti" section: page anatomy, `/api/me/week` contract, the score formula constants + null discipline, chat handoff), `docs/features/insights.md` (Heti removal + redirect note), `docs/features/proactive.md` (weekly_review entity/generator/job/push, WEEKLY retirement), `docs/features/companion.md` (DayScoreService, MeWeekService, `[Heti adatok]`, anchored conversations + opening turn, WeekReviewSource port), `docs/CODEMAP.md` if the repo convention regenerates it (check `focused ITs miss ArchUnit + codemap` memory: regenerate in-change)
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Write the four doc updates** (follow each file's existing section structure; the `knowledge-base` skill is the operating manual — invoke it in the executing session).
- [ ] **Step 2: `node scripts/lint-docs.mjs` green; regenerate CODEMAP if applicable.**
- [ ] **Step 3: Focused backend tests for all touched features** (`./mvnw test -Dtest='DayScoreServiceIT,MeWeekControllerIT,WeeklyReviewGeneratorIT,WeeklyReviewControllerIT,*AnchorResolver*,AnchoredConversationIT'`) + the ArchUnit test (`./mvnw test -Dtest=ArchitectureTest`) + FE both modes + build.
- [ ] **Step 4: Commit docs** — `docs(features): weekly review across me/insights/proactive/companion (mezo-p2tr)`.
- [ ] **Step 5: Ship per house flow:** `git push -u origin feat/weekly-review` → open self-PR (`gh pr create`) → wait CI green (`gh pr checks --watch`) → `git checkout main && git pull --rebase` → `git merge --no-ff feat/weekly-review` → `bd dolt push && git push` → delete branch → `bd close mezo-p2tr`. (In this worktree: do the merge from the worktree's branch context per the worktree rules — never `cd` to the primary checkout; if the merge needs the main branch, use `git fetch origin main` + a temporary state or perform the merge via a fresh clone-free flow the session's finishing skill prescribes.)

---

## Self-review notes (already applied)

- Spec coverage: §1→T4/T8/T10, §2→T1/T2/T3, §3→T5/T6/T7, §4→T9/T10, §5→T11/T12. Non-goals honored (no backfill: the job only generates the just-finished week; past weeks get analysis only via manual regenerate — T6 allows any completed week).
- Type consistency: `DayScore`/`DaySubscores` (T1) feed `MeWeekService` (T2); `MeWeekResponse` feeds T3/T5/T9; `WeeklyReviewResponse.stale` feeds T8's refresh button; `WEEKLY_REVIEW_READY` enum lands in T5 (emit site), category in T7 (push).
- Known judgment calls executors may adjust with evidence: exact repo derived-method names (follow each repo's existing naming), the fuel-targets read (reuse the rollup source), the 1–5 scale verification (T1 step 0), controller placement for T6 (per-tag generated interface decides).
