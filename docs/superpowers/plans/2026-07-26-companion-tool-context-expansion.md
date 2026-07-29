# Companion Tool & Context Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the companion AI chat entity-deep read-awareness of the whole app — a forward-resolving context snapshot plus a consolidated set of 15 parameterized hub read-tools — fixing the observed prod gaps (hallucinated upcoming training; invisible recipes/pantry).

**Architecture:** Backend-only (Spring AI 2 `@Tool` beans over existing domain services). "Now + next" lives in the deterministic `ContextSnapshotAssembler` (0 tool calls); "historical / entity-deep / browse" lives in hub-tools with `scope` enum params. Consolidate the current 9 tools + new coverage into **15** tools (research: accuracy degrades past ~15–20). Raise the per-turn call budget 6→15.

**Tech Stack:** Java 21, Spring Boot 4, Spring AI 2 (Gemini), Maven, PostgreSQL (pgvector), Liquibase, integration-first testing (`AbstractIntegrationTest` + fixed `mezo_test` DB / Testcontainers, AssertJ, `*Populator` factories).

**Driving bd:** `mezo-xixu`. **Spec:** [`docs/superpowers/specs/2026-07-26-companion-tool-context-expansion-design.md`](../specs/2026-07-26-companion-tool-context-expansion-design.md).

## Global Constraints

- **Read-only tools only.** No writes/mutations this phase.
- **No API-contract change, no frontend change.** `RefsEnvelope.Ref.kind` is a free string; `RefTag.tsx`/`ToolChip.tsx` render generically.
- Every tool bean carries `@Component @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` and constructor DI only (never `@Value`/field injection).
- Every `@Tool` **description** states a narrow responsibility + an explicit `Használd, amikor …` clause; `scope` params are enums documented in the `@ToolParam` description. **English code/comments; Hungarian user-facing tool text.**
- Honest absence: return `<header>: <ToolText.NO_DATA>` (`"nincs adat"`), never fabricated zeros.
- Tests: integration-first, `test{Method}_should{Result}_when{Condition}`, AssertJ only, data via `*Populator`. No mocks/`@MockBean`/H2. Run focused ITs locally; the full suite is the CI gate.
- Base package `io.mrkuhne.mezo`; tools live in `feature/companion/tools/`, registered ONLY in `CompanionToolRegistry` (ArchUnit `companion_tools_are_internal_sphere_only` guards it).
- After behavior changes, update [`docs/features/companion.md`](../../features/companion.md) and run `node scripts/lint-docs.mjs`.

---

## File Structure

**Modify:**
- `backend/src/main/resources/application.yml` — `mezo.companion.tools.max-calls-per-turn: 6 → 15`.
- `backend/.../feature/companion/service/ContextSnapshotAssembler.java` — enrich `[Edzés]` (today+tomorrow), add `[Növekedés]` + `[Napi gyakorlat]`.
- `backend/.../feature/companion/tools/TrainTools.java` — replace `get_recent_workouts`+`get_sport_sessions` with `get_training_log`; add `get_training_plan`, `get_exercise_records`.
- `backend/.../feature/companion/tools/FuelTools.java` — `get_recent_meals`→`get_fuel_log`; `get_protocol_adherence`→`get_protocol`; add `get_recipes`, `get_pantry`.
- `backend/.../feature/companion/tools/BiometricsTools.java` — merge `get_sleep`→`get_recovery` (sleep/sleep-goal/checkins); keep `get_weight_trend`.
- `backend/.../feature/companion/tools/GoalTools.java` — `get_goal_progress`→`get_goal` (scope).
- `backend/.../feature/companion/tools/MedicationTools.java` — `get_reta_cycle`→`get_medication` (scope reta|all).
- `backend/.../feature/companion/tools/CompanionToolRegistry.java` — register 3 new beans.
- `backend/.../feature/companion/service/<system-prompt assembler>` — add the tool-routing hint block.
- `backend/src/test/.../feature/companion/tools/CompanionToolsRenderIT.java` — update renamed-tool tests; add new-tool tests (may split into `CompanionToolsRenderIT2` if it grows past ~500 lines).
- `backend/src/test/.../feature/companion/service/ContextSnapshotAssemblerIT.java` — today/tomorrow + new blocks.

**Create:**
- `backend/.../feature/companion/tools/GrowthTools.java` — `get_growth`.
- `backend/.../feature/companion/tools/PracticeTools.java` — `get_daily_practice`.
- `backend/.../feature/companion/tools/InsightsTools.java` — `get_insights`.
- New `*Populator`s where a domain has none (quest, habit, intention, ritual, activity, checkin, recipe, pattern/prediction/experiment, gamification/progression) under `backend/src/test/.../support/populator/`.
- `docs/references/companion_tool_conventions.md` — the description house-rule.

---

## Recipe R1 — adding a hub-tool (the shared pattern)

Every tool task instantiates this. Reference implementation (already in the codebase) — `TrainTools.getRecentWorkouts`:

```java
@Tool(name = "get_recent_workouts", description = "Gym-edzések az elmúlt napokra: dátum, edzésnap "
        + "(pl. Pull A), sorozatszám, összvolumen kg-ban. Kérdés edzésekről, edzésmennyiségről, volumenről.")
public String getRecentWorkouts(
        @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
        ToolContext toolContext) {
    UUID userId = ToolContexts.userId(toolContext);
    int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
    // ... call service, build header + lines, ToolText.NO_DATA on empty ...
    ToolContexts.audit(toolContext).addRef("Workout", w.getDate().toString());
    return b.toString();
}
```

Steps for each tool: **(a)** write the failing IT (Recipe R2), **(b)** run it → FAIL, **(c)** implement the `@Tool` method per this idiom calling the task's named service, **(d)** for a NEW bean, add `@Component @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`, inject the services, and register it in `CompanionToolRegistry` (add a `private final XTools xTools;` field and add `xTools` to the `ToolCallbacks.from(...)` varargs), **(e)** run the IT → PASS, **(f)** `./mvnw -q clean test -Dtest=CompanionToolsRenderIT` (focused), **(g)** commit.

`scope` params are String `@ToolParam` with the allowed values enumerated in the description; branch on the value, default to the first. Use `ToolText.NO_DATA`, `ToolText.num`, `ToolText.clamp`. Cap refs at 3–5 per call.

## Recipe R2 — the tool IT (the shared test pattern)

Add to `CompanionToolsRenderIT` (idiom already in the file): `@Transactional @ActiveProfiles("companion-fake")`, extends `AbstractIntegrationTest`, autowire the tool bean + populators, use the `ctx(UUID)` helper. Each tool gets **two** tests minimum: a populated-render test (assert `startsWith(header)` + `.contains(...)` + the ref) and an empty test (assert the exact `nincs adat` string). Reference — `testGetRecentWorkouts_shouldRenderInstanceLinesWithVolume_whenLoggedSetsExist` and `testGetRecentWorkouts_shouldRenderNincsAdat_whenWindowEmpty`.

---

## Task 1: Raise the per-turn tool-call budget 6 → 15

**Files:** Modify `backend/src/main/resources/application.yml:280`; Test `backend/src/test/.../feature/companion/config/CompanionPropertiesIT.java` (create if absent).

**Interfaces:** Produces: the runtime value `CompanionProperties.tools().maxCallsPerTurn() == 15`.

- [ ] **Step 1: Write the failing test** — assert the bound property is 15.

```java
@ActiveProfiles("companion-fake")
class CompanionPropertiesIT extends AbstractIntegrationTest {
    @Autowired CompanionProperties properties;
    @Test
    void testMaxCallsPerTurn_shouldBe15_forDeepToolChains() {
        assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(15);
    }
}
```

- [ ] **Step 2: Run → FAIL** — `./mvnw -q clean test -Dtest=CompanionPropertiesIT` → expected 15 but was 6.
- [ ] **Step 3: Change config** — in `application.yml` under `mezo.companion.tools`: `max-calls-per-turn: 15` (was 6). Leave `max-refs-per-turn: 10`, `max-window-days: 30` unchanged.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(companion): raise per-turn tool-call budget 6→15 (mezo-xixu)"`.

---

## Task 2: Snapshot `[Edzés]` — forward, dated today + tomorrow resolution (the flagship fix)

**Files:** Modify `ContextSnapshotAssembler.java` (`trainBlock`, ~L162-205); Test `ContextSnapshotAssemblerIT.java`.

**Interfaces:** Consumes: `WorkoutService.getToday(userId, null) : WorkoutTodayResponse`, `WorkoutService.findPlannedTemplateForDate(userId, LocalDate) : Optional<WorkoutSessionEntity>`, `SportService.getSchedule(userId)`, the active `RunningBlockEntity.structure`. Produces: `[Edzés]` block text containing a `Ma:` line and a `Holnap:` line.

- [ ] **Step 1: Write the failing test** — extend `ContextSnapshotAssemblerIT`: seed an active meso with a template day whose HU `dayLabel` equals tomorrow's weekday + exercises, and a sport slot on tomorrow's weekday; render; assert the block contains `Holnap:` with the gym day-label, an exercise name, and the sport. (Mirror the existing assembler-IT seeding idiom; use `trainPopulator` + the gym/sport schedule populators — create a `GymScheduleSlotPopulator`/`SportSchedulePopulator` if absent.)

```java
@Test
void testTrainBlock_shouldResolveTomorrowGymAndSport_whenScheduledForTomorrowWeekday() {
    UUID owner = userPopulator.createUser().getId();
    LocalDate tomorrow = LocalDate.now().plusDays(1);
    // seed meso + a template day labelled with tomorrow's HU weekday + an exercise + a sport slot on that weekday
    // ... (populators) ...
    String out = assembler.render(owner, LocalDate.now());
    assertThat(out).contains("[Edzés]").contains("Holnap:");
    // assert the gym day-label + exercise name + sport appear on/after the Holnap: line
}
```

- [ ] **Step 2: Run → FAIL** (`-Dtest=ContextSnapshotAssemblerIT`).
- [ ] **Step 3: Implement** in `trainBlock`: after the meso line, append a `Ma:` line from `workoutService.getToday(userId, null)` (day-label + exercises `name + workingSets×repMin-repMax`, or `pihenőnap`), and a `Holnap:` line resolving `findPlannedTemplateForDate(today.plusDays(1))` (its exercises via the exercise repository) + tomorrow's weekday sport slots (from `sportService.getSchedule`, filter `dayOfWeek == tomorrow.getDayOfWeek()` in the 0=Mon..6=Sun convention — reuse the existing `huDay`/`DAY_ORDER` mapping) + the active running block's prescribed session for tomorrow. Keep the existing recurring `gym-rend`/`sport-rend` + digest as trailing context. Inject `WorkoutService`, `ExerciseRepository` as needed (constructor).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(companion): snapshot resolves today+tomorrow training, dated (mezo-xixu)"`.

---

## Task 3: Snapshot `[Növekedés]` + `[Napi gyakorlat]` blocks

**Files:** Modify `ContextSnapshotAssembler.java` (`render()` + two new private block methods); Test `ContextSnapshotAssemblerIT.java`.

**Interfaces:** Consumes: `GamificationService.getProfile`, `ProgressionService.getProfile`, `GrowthWeekService.growthWeek`; `QuestService.getDay`, `HabitService.getDay`/`summary`, `IntentionService.getDay`, `RitualService.getDay`. Produces: `[Növekedés]` and `[Napi gyakorlat]` lines in the snapshot.

- [ ] **Step 1: Write two failing tests** — seed a gamification/progression profile → assert `[Növekedés]` contains the account level; seed a creed + focus + quest → assert `[Napi gyakorlat]` contains the focus text and a quest-completion count, and honest-absence (`nincs adat`) when nothing seeded. (Create `GamificationPopulator`/`ProgressionPopulator`/`QuestPopulator`/`HabitPopulator`/`IntentionPopulator`/`RitualPopulator` where absent — minimal factories per `integration_test_framework.md`.)
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `growthBlock(userId)` (account level + top skills + weekly XP) and `practiceBlock(userId, today)` (quest count, habit streak, creed + foci + reflection, day-closed flag), append both in `render()` after `trainBlock`. One terse line each; `NO_DATA` on absence.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(companion): snapshot [Növekedés] + [Napi gyakorlat] blocks (mezo-xixu)"`.

---

## Task 4: `get_training_plan` (forward plan tool)

**Files:** Modify `TrainTools.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `WorkoutService.getToday`, `WorkoutService.findPlannedTemplateForDate`, `TrainService.listMesocycles`, `RunningService.listBlocks` (+ `RunningBlockStructure`). Produces: `@Tool get_training_plan(String scope, String date, ToolContext)`.

- [ ] **Step 1: Write failing ITs** — `scope=today` renders the resolved gym day + exercises; `scope=meso` renders the active meso's weeks/phases/day-templates; empty → `nincs adat`. Ref kind `TrainingPlan` (id = the date or meso title).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per R1. `scope ∈ {today, tomorrow, week, meso, date}` (default `today`); `date` param used only when `scope=date`. Description: `"Az ELŐRE ütemezett edzésterv adott ablakra: gym-nap + gyakorlatok, sport, futás; scope=meso a teljes aktív ciklus. Használd, amikor a user a MAI/HOLNAPI/heti/jövőbeli edzésről vagy a mezociklus tervéről kérdez."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): get_training_plan forward tool (mezo-xixu)`.

---

## Task 5: `get_training_log` (consolidates get_recent_workouts + get_sport_sessions)

**Files:** Modify `TrainTools.java` (remove the two old `@Tool`s, add one); Modify `CompanionToolsRenderIT` (rewrite the 4 old tests).

**Interfaces:** Produces: `@Tool get_training_log(String scope, Integer days, ToolContext)`, `scope ∈ {gym, sport, run}` (default `gym`).

- [ ] **Step 1: Rewrite the tests** — replace `testGetRecentWorkouts_*` / `testGetSportSessions_*` with `testGetTrainingLog_shouldRenderGymLines_whenScope gym` etc., asserting the same rendered substrings + `Workout`/`Sport`/`Run` refs, now behind the `scope` branch.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — move the existing `getRecentWorkouts` body under `scope=gym`, `getSportSessions` body split into `scope=sport` (sport rows) and `scope=run` (run rows). Delete the two old methods. Description enumerates the scopes + `Használd, amikor a user MÚLTBELI edzésekről/sportról/futásról kérdez.`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): merge recent-workouts+sport into get_training_log (mezo-xixu)`.

---

## Task 6: `get_exercise_records` (PR / e1RM)

**Files:** Modify `TrainTools.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `ExerciseRecordService.list(userId) : List<ExerciseRecordResponse>` (fields incl. `bestE1rm`, `bestSet`, `repRecords`, `recentTopSets`). Produces: `@Tool get_exercise_records(String exercise, ToolContext)`.

- [ ] **Step 1: Write failing ITs** — seed logged working sets for an exercise (reuse `trainPopulator.createLoggedSet`); no `exercise` arg → top records summary; with `exercise` name → that exercise's bestE1rm + bestSet. Ref kind `ExerciseRecord` (id = exercise name). Empty → `nincs adat`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per R1 over `exerciseRecordService.list(userId)`; when `exercise` given, filter by name (case-insensitive contains). Description: `"Egyéni csúcsok (PR) és becsült 1RM (e1RM, Epley) gyakorlatonként: legjobb szett, rep-rekordok, utóbbi top-szettek. Használd, amikor a user PR-ról, rekordról, 'meg tudom-e dönteni', vagy egy gyakorlat legjobbjairól kérdez."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): get_exercise_records PR/e1RM tool (mezo-xixu)`.

---

## Task 7: `get_recipes`

**Files:** Modify `FuelTools.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `RecipeService.list(userId) : RecipeListResponse`, `RecipeService.get(userId, id) : RecipeResponse`. Produces: `@Tool get_recipes(String filter, ToolContext)`.

- [ ] **Step 1: Write failing ITs** — `recipePopulator.createRecipe(...)` (create populator if absent); no filter → list of names + macros + fitScore; empty → `nincs adat`. Ref kind `Recipe` (id = recipe name).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per R1. `filter` optional (slot/category/tag/starred/fitsFor substring); list names + kcal/protein + fitScore; on a single strong match, include ingredients. Description: `"A user receptjei: név, makrók, illeszkedés-pontszám, összetevők. Használd, amikor a user receptet keres, mit főzzön/egyen kérdez, vagy egy konkrét recept részleteire kíváncsi."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): get_recipes tool (mezo-xixu)`.

---

## Task 8: `get_pantry`

**Files:** Modify `FuelTools.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `PantryService.getPantry(userId) : PantryResponse` (+ optional `PantrySuggestionService.suggest`). Produces: `@Tool get_pantry(String kind, ToolContext)`.

- [ ] **Step 1: Write failing ITs** — `pantryItemPopulator.createFood/createSupplement`; `kind=food` lists in-stock food + qty/expiry; empty → `nincs adat`. Ref kind `Pantry` (id = item name, capped).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per R1. `kind ∈ {food, supplement, stim, med}` (default all); list name + stockQty/stockUnit + expiry. Description: `"A kamra készlete: mi van otthon, mennyi, meddig jó. Használd, amikor a user azt kérdezi mije van otthon, miből tud főzni, vagy mit kell pótolni."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): get_pantry tool (mezo-xixu)`.

---

## Task 9: `get_fuel_log` (consolidates get_recent_meals)

**Files:** Modify `FuelTools.java` (rename `get_recent_meals`); Modify `CompanionToolsRenderIT` (rewrite `testGetRecentMeals_*`).

**Interfaces:** Consumes: `FuelDayService.getDay`/`getWeek`, `WaterLogService.sumForDay`. Produces: `@Tool get_fuel_log(String range, String date, ToolContext)`, `range ∈ {day, week}`.

- [ ] **Step 1: Rewrite tests** — `testGetFuelLog_shouldRenderDayRollups_whenScope day` from the old meal test's assertions; add a `week` case; keep the `FuelDay` ref.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — old `getRecentMeals` body under `range=day` (default; keep the N-day rollup) + a `range=week` branch over `getWeek`; add water. Description enumerates scopes + `Használd, amikor a user a napi/heti kalória-, makró-, víz-bevitelről vagy étkezéseiről kérdez.`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): get_recent_meals→get_fuel_log with week scope (mezo-xixu)`.

---

## Task 10: `get_protocol` (consolidates get_protocol_adherence + intake)

**Files:** Modify `FuelTools.java` (rename `get_protocol_adherence`); Modify `CompanionToolsRenderIT` (rewrite `testGetProtocolAdherence_*`).

**Interfaces:** Consumes: `ProtocolService.getView`, `IntakeService.listForDay`. Produces: `@Tool get_protocol(String scope, Integer days, ToolContext)`, `scope ∈ {adherence, intake, supplements}`.

- [ ] **Step 1: Rewrite tests** — `adherence` reproduces the old per-day coverage assertions; add an `intake` case (today's supplement intakes). Keep the `Protocol` ref.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — old adherence body under `scope=adherence` (default); `scope=intake` over `intakeService.listForDay`; `scope=supplements` = the active protocol's items. Description enumerates scopes + trigger clause.
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): get_protocol_adherence→get_protocol with intake scope (mezo-xixu)`.

---

## Task 11: `get_recovery` (consolidates get_sleep + sleep-goal + checkins)

**Files:** Modify `BiometricsTools.java` (rename `get_sleep`); Modify `CompanionToolsRenderIT` (rewrite `testGetSleep_*`).

**Interfaces:** Consumes: `SleepLogService.list`, `SleepGoalService.getGoal`, `SleepAnchorResolver.resolve`, `CheckInService.listForDay`. Produces: `@Tool get_recovery(String scope, Integer days, ToolContext)`, `scope ∈ {sleep, sleep-goal, checkins}`.

- [ ] **Step 1: Rewrite tests** — `sleep` reproduces the old windowed-rows assertions; add `sleep-goal` (target + anchor + regularity) and `checkins` (states) cases. Refs: `Sleep`, `SleepGoal`, `CheckIn`. (Create `CheckInPopulator`/`SleepGoalPopulator` if absent.)
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — old `getSleep` body under `scope=sleep` (default); `scope=sleep-goal` over `getGoal`+`resolve` (target hours, bed/wake anchor, regularity band); `scope=checkins` over `listForDay` across the window (energy/stress/body/mental). Description enumerates scopes + `Használd, amikor a user alvásról, alvás-céljáról/ritmusáról, vagy közérzetéről (energia/stressz) kérdez.`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): get_sleep→get_recovery (sleep-goal+checkins) (mezo-xixu)`.

---

## Task 12: `get_goal` (consolidates get_goal_progress + engine detail)

**Files:** Modify `GoalTools.java` (rename `get_goal_progress`); Modify `CompanionToolsRenderIT` (rewrite `testGetGoalProgress_*`).

**Interfaces:** Consumes: `GoalService.getGoal`/`listGoals`, `GoalTimelineService.getTimeline`, `GoalFeasibilityService`, `GuardEvaluationService`, the goal's `prescription`/`tdeeBootstrap` json. Produces: `@Tool get_goal(String scope, ToolContext)`, `scope ∈ {progress, recept, timeline, guards, feasibility}`.

- [ ] **Step 1: Rewrite tests** — `progress` reproduces the old goal/trend/segment assertions; add a `guards` case (strength e1RM trend + muscle floor). Keep the `Goal` ref.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — old `getGoalProgress` body under `scope=progress` (default); other scopes read the engine surfaces. Description enumerates scopes + trigger clause.
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): get_goal_progress→get_goal with engine detail (mezo-xixu)`.

---

## Task 13: `get_growth` (new `GrowthTools` bean)

**Files:** Create `GrowthTools.java`; Modify `CompanionToolRegistry.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `GamificationService.getProfile`, `ProgressionService.getProfile`, `GrowthWeekService.growthWeek`, `AchievementService.achievements`. Produces: `@Tool get_growth(String scope, ToolContext)`, `scope ∈ {skills, week, achievements, titles}`; new bean registered in `CompanionToolRegistry.from(...)`.

- [ ] **Step 1: Write failing ITs** — seed a progression/gamification profile (populators); `scope=skills` lists skill levels + XP; empty → `nincs adat`. Ref kind `Growth`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the new bean per R1 step (d) (annotations + DI + registry field + `from(...)` entry). Description enumerates scopes + `Használd, amikor a user XP-ről, szintekről, skillekről, streakről, címekről vagy eredményekről kérdez.`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): GrowthTools get_growth (mezo-xixu)`.

---

## Task 14: `get_daily_practice` (new `PracticeTools` bean)

**Files:** Create `PracticeTools.java`; Modify `CompanionToolRegistry.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: `QuestService.getDay`, `HabitService.getDay`/`summary`, `IntentionService.getDay`, `RitualService.getDay`, `ChallengeService.getChallenges`, `ActivityService.getDay`. Produces: `@Tool get_daily_practice(String date, ToolContext)`; new bean registered.

- [ ] **Step 1: Write failing ITs** — seed a creed + focus + a quest for a date; render includes the focus text, quest status, and the day-closed flag; empty → `nincs adat`. Ref kind `Practice` (id = date).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the new bean; `date` defaults to today. Compose quests + habits + intention + ritual close + active challenge + activities into one text. Description: `"Egy nap 'fegyelme': küldetések, szokások, napi szándék (vezérelv + fókuszok + esti reflexió), nap lezárva-e, aktív kihívás, tevékenységek. Használd, amikor a user a napi rutinjáról, küldetéseiről, szokásairól, szándékáról vagy a nap lezárásáról kérdez."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): PracticeTools get_daily_practice (mezo-xixu)`.

---

## Task 15: `get_medication` (consolidates get_reta_cycle)

**Files:** Modify `MedicationTools.java` (rename `get_reta_cycle`); Modify `CompanionToolsRenderIT` (rewrite `testGetRetaCycle_*`).

**Interfaces:** Consumes: `MedicationService.getDay(userId) : MedicationDayResponse` + the existing reta-cycle computation. Produces: `@Tool get_medication(String scope, ToolContext)`, `scope ∈ {reta, all}`.

- [ ] **Step 1: Rewrite tests** — `reta` reproduces the old cycle/dose assertions; add an `all` case (general meds/doses). Keep the `Medication` ref.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — old `getRetaCycle` body under `scope=reta` (default); `scope=all` over `medicationService.getDay`. Description enumerates scopes + trigger clause.
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `refactor(companion): get_reta_cycle→get_medication (mezo-xixu)`.

---

## Task 16: `get_insights` (new `InsightsTools` bean — the "Minták")

**Files:** Create `InsightsTools.java`; Modify `CompanionToolRegistry.java`; Test `CompanionToolsRenderIT`.

**Interfaces:** Consumes: the companion pattern read (`PatternResponse list(userId)`), proactive `getPredictions(userId)`, `getExperiments(userId)`. Produces: `@Tool get_insights(String scope, ToolContext)`, `scope ∈ {patterns, predictions, experiments}`; new bean registered.

- [ ] **Step 1: Write failing ITs** — seed a confirmed `pattern` row (create `PatternPopulator` if absent); `scope=patterns` renders the pattern statement; empty → `nincs adat`. Ref kind `Insight`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the new bean; `scope=patterns` (default) lists confirmed patterns, `predictions`/`experiments` read the proactive surfaces. Description: `"Amit a rendszer ÉSZREVETT rólad: statisztikai minták, előrejelzések, N=1 kísérletek. Használd, amikor a user azt kérdezi 'mit vettél észre rólam', mik a mintáim/összefüggéseim, vagy mit jósolsz."`
- [ ] **Step 4: Run → PASS.** — [ ] **Step 5: Commit** `feat(companion): InsightsTools get_insights (mezo-xixu)`.

---

## Task 17: Description house-rule + system-prompt tool-routing hint

**Files:** Create `docs/references/companion_tool_conventions.md`; Modify the system-prompt assembler (the class that builds the chat system prompt — locate via `grep -rl "system prompt\|systemPrompt\|SystemMessage" backend/.../feature/companion/service`); Test the existing companion chat IT (assert the hint text is present in the assembled prompt, LLM-free).

**Interfaces:** Produces: a `[Eszköz-útmutató]` block in the system prompt mapping question-type → tool name.

- [ ] **Step 1: Write the house-rule doc** — the `Használd, amikor …` + enum-scope rule, with a good/bad example; link from `docs/references/` index.
- [ ] **Step 2: Write the failing test** — assert the assembled system prompt contains the `[Eszköz-útmutató]` header and at least one mapping line (e.g. `PR → get_exercise_records`).
- [ ] **Step 3: Run → FAIL.**
- [ ] **Step 4: Implement** — append a terse routing-hint block to the system prompt (question-type → tool). Keep it short (~10 lines).
- [ ] **Step 5: Run → PASS.**
- [ ] **Step 6: Commit** — `feat(companion): tool-routing hint + tool-description house-rule (mezo-xixu)`.

---

## Task 18: Measurement harness — tool-selection eval

**Files:** Create `backend/src/test/.../feature/companion/eval/ToolSelectionEvalIT.java` + a `tool-selection-cases.json` resource (~30–50 HU questions → expected tool(s)).

**Interfaces:** Consumes: the `companion-fake` scripted-tool path + `RecordingToolCallback` audit. Produces: a printed selection-accuracy number (the Tool-RAG trigger gate: < ~85%).

- [ ] **Step 1: Author the case set** — ~30–50 representative HU questions covering every tool, each with the expected tool name(s). (This is an eval, not a pass/fail gate — it reports accuracy; mark `@Tag("eval")` so it is opt-in, not on the CI critical path.)
- [ ] **Step 2: Implement** — for each case, run the real cheap-tier turn (or a recorded fixture) and read which tools the audit recorded; compute matched/total; assert the harness runs and prints the number; log misses.
- [ ] **Step 3: Run** `./mvnw -q clean test -Dtest=ToolSelectionEvalIT -Dgroups=eval` — record the baseline number.
- [ ] **Step 4: Commit** — `test(companion): tool-selection eval harness (mezo-xixu)`.

---

## Task 19: Docs + full-suite gate + PR

**Files:** Modify `docs/features/companion.md`; run gates.

- [ ] **Step 1** — Update `companion.md`: the tool table (15 tools, scopes), the enriched snapshot blocks, the Tool-RAG escape-hatch note, the raised budget. Run `node scripts/lint-docs.mjs` → clear the staleness flag.
- [ ] **Step 2** — `cd backend && ./mvnw clean test` (full backend IT suite) → green. (16 GB machine: if the full suite OOMs, push and let CI run it — the authoritative gate.)
- [ ] **Step 3** — `git commit -am "docs(companion): tool & context expansion — companion.md (mezo-xixu)"`.
- [ ] **Step 4** — Push the branch, open the self-PR, wait for **CI green**, then merge locally `--no-ff` per the git workflow, push main, delete the branch. `bd close mezo-xixu`.

---

## Self-Review

**Spec coverage:** §3 budget → Task 1; §4 snapshot (Edzés today+tomorrow, Növekedés, Napi gyakorlat) → Tasks 2–3; §5 all 15 tools → Tasks 4–16 (1 `get_training_plan`, 2 `get_training_log`, 3 `get_exercise_records`, 4 `get_fuel_log`, 5 `get_recipes`, 6 `get_pantry`, 7 `get_protocol`, 8 `get_weight_trend` unchanged, 9 `get_recovery`, 10 `get_goal`, 11 `get_growth`, 12 `get_daily_practice`, 13 `get_medication`, 14 `get_insights`, 15 `find_similar_past_days` unchanged); §6 registry/config/no-FE → Tasks 1 + 13/14/16 (registration) + Global Constraints; §7 hardening (descriptions, routing hint, measurement, Tool-RAG seam) → Tasks 17–18 (Tool-RAG stays a documented inactive seam — no task, by design); §8 testing → every task's ITs + Task 19 gate; §9 hero-chain → validated by Tasks 2 (snapshot tomorrow) + 6 (records) + 7/8 (food).

**Placeholder scan:** each tool task names its exact backing service method (from the spec §5 table) + ref kind + IT populator + assertion shape; boilerplate is in Recipes R1/R2 (shown once, completely, from real code). Where a `*Populator` doesn't exist, the task says to create it (per `integration_test_framework.md`).

**Type consistency:** tool method/scope names match the spec §5 table verbatim; renamed tools (Tasks 5, 9, 10, 11, 12, 15) explicitly delete the old `@Tool` and rewrite the old ITs so no dangling references remain; new beans (13, 14, 16) are each registered in `CompanionToolRegistry.from(...)`.

**Note on PR size:** 19 tasks is a large single branch. Phases are independently green (each task ends compiling + tests passing), so the branch MAY be split into per-phase PRs (config+snapshot; training; fuel; recovery/goal; new beans; hardening+eval) if a single PR is unwieldy — an execution-time call.
