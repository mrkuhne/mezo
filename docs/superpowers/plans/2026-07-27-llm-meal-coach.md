# LLM meal-coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree note:** if you run this with subagent-driven-development, namespace the SDD ledger and task briefs per bd-id (`.superpowers/sdd/mezo-mr4n-progress.md`, `mezo-mr4n-task-N-brief.md`) — concurrent mezo sessions clobber the default filenames.

**Goal:** Add an LLM "coach" layer that turns the deterministic, training-aware meal score into a qualitative Hungarian verdict (card tagline + summary + suggestions), without ever changing a number.

**Architecture:** A consumer-owned `MealCoachLlm` port in `feature/meal` with a companion-side adapter (ADR 0012), driven by a new `MealCoachService` that assembles ONE batched prompt per day-view, parses the answer permissively, and persists the prose into the existing `meal.breakdown` jsonb. Two lazy read endpoints (day batch / single meal); the write path is untouched. Every failure mode degrades silently to the deterministic envelope.

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · PostgreSQL (jsonb) · OpenAPI contract-first · React 19 + Vite + TanStack Query.

**Spec:** [`docs/superpowers/specs/2026-07-27-llm-meal-coach-design.md`](../specs/2026-07-27-llm-meal-coach-design.md) — read §3–§8 before Task 5.

## Global Constraints

- **Driving bd issue: `mezo-mr4n`.** Every commit subject carries it: `feat(fuel): … (mezo-mr4n)`.
- **Branch:** `feat/meal-coach` (already created, spec already committed there).
- **Commit inside the worktree with hooks off:** `git -c core.hooksPath=/dev/null commit` — the bd pre-commit hook otherwise stages `.beads/issues.jsonl` into every commit. Run `bd` itself only from the main checkout `/Users/daniel.kuhne/MrKuhne/mezo`.
- **Contract-first** (`docs/references/api_contract_conventions.md`): edit `api/feature/meal/meal.yml` BEFORE any Java/TS that uses the types; regenerate; never hand-write boundary DTOs.
- **Backend conventions:** constructor DI via `@RequiredArgsConstructor` (never field injection) · `@Transactional` on methods only · package layout `feature/{name}/{controller,service,repository,entity,dto,mapper}` · no `@Value` — config goes under `mezo:` in `application.yml` · errors via `SystemRuntimeErrorException` + `SystemMessage`, never hardcoded user text.
- **Backend tests:** integration-first (`@SpringBootTest`), AssertJ only, data via `*Populator` factories, **no Mockito, no `@MockBean`, no H2**. LLM behaviour is scripted through the profile-gated `FakeCompanionLlm` (`@ActiveProfiles("companion-fake")`).
- **Backend test command (16 GB box — always focused, always `clean`-less after the first build):** `cd backend && ./mvnw test -Dtest=<Class> -DargLine=-Xmx3g`. The full suite is CI's job, not the laptop's. If a build acts strange, `rm -rf target` first (`clean` occasionally fails on the generated-sources dir).
- **Frontend conventions** (`docs/references/frontend_conventions.md`): four layers (`app/` · `features/<domain>/{pages,components,sheets,logic}/` · `shared/` · `data/`) · features import hooks from **`@/data/hooks` only** · dual-mode reads via `useDualQuery` · deep absolute `@/*` imports, no barrels except `data/hooks.ts` · tests colocated.
- **Frontend gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes must be green.
- **Never** let the LLM author a number: `value`, `confidence`, and every dimension `score`/`weight`/`detail` stay exactly as the deterministic scorer wrote them.

---

### Task 1: API contract — `tagline`, `MealCoachResponse`, two operations

**Files:**
- Modify: `api/feature/meal/meal.yml` (schema `MealBreakdown` at `:150`; add two paths + two schemas)
- Generated (do not edit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, backend `io.mrkuhne.mezo.api.*`

**Interfaces:**
- Produces: `MealBreakdown.tagline` (nullable string) · `MealCoachResponse { verdicts: MealCoachVerdict[] }` · `MealCoachVerdict { mealId: UUID, tagline?: string, summary?: string, improve: MealImproveRow[] }` · generated API interface methods `getMealCoachForDay(LocalDate date)` and `getMealCoach(UUID id)`.

- [ ] **Step 1: Add the `tagline` field to `MealBreakdown`**

In `api/feature/meal/meal.yml`, inside `MealBreakdown.properties` (right after `summary`):

```yaml
        tagline: { type: string, nullable: true, description: 'Card-sized LLM cut (~60 chars) — null until the coach ran (mezo-mr4n)' }
```

- [ ] **Step 2: Add the two coach operations**

In the same file, under `paths:` (mirror the style of `/api/recipe/{id}/breakdown` in `api/feature/recipe/recipe.yml:58`):

```yaml
  /api/meal/coach:
    get:
      tags: [Meal]
      operationId: getMealCoachForDay
      summary: Day-batch coach verdicts; generates only for today, older days return what is cached (mezo-mr4n)
      parameters: [ { name: date, in: query, required: true, schema: { type: string, format: date } } ]
      responses:
        '200': { description: Verdicts for that day's meals (empty when the coach is off/unavailable), content: { application/json: { schema: { $ref: '#/components/schemas/MealCoachResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/meal/{id}/coach:
    get:
      tags: [Meal]
      operationId: getMealCoach
      summary: Coach verdict for one logged meal — generates on demand for any date (mezo-mr4n)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: 0..1 verdicts (empty when the coach is off/unavailable), content: { application/json: { schema: { $ref: '#/components/schemas/MealCoachResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 3: Add the two response schemas**

Under `components.schemas` in `meal.yml`:

```yaml
    MealCoachResponse:
      type: object
      description: Coach verdicts (mezo-mr4n). Empty list = nothing generated/cached; never an error.
      required: [verdicts]
      properties:
        verdicts: { type: array, items: { $ref: '#/components/schemas/MealCoachVerdict' } }
    MealCoachVerdict:
      type: object
      required: [mealId, improve]
      properties:
        mealId: { type: string, format: uuid }
        tagline: { type: string, nullable: true }
        summary: { type: string, nullable: true }
        improve: { type: array, items: { $ref: '#/components/schemas/MealImproveRow' } }
```

- [ ] **Step 4: Regenerate and verify both sides compile**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw test-compile -DskipTests
```
Expected: `api/openapi.yml` gains the paths/schemas, `frontend/src/data/_client/api.gen.ts` gains `MealCoachResponse`, backend compiles with a new `MealApi` interface carrying `getMealCoachForDay` + `getMealCoach`. Backend compile FAILS at this point only if `MealController` must implement them — if so, leave a temporary `throw new UnsupportedOperationException()` and delete it in Task 6.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): meal-coach contract — tagline + MealCoachResponse + two read endpoints (mezo-mr4n)"
```

---

### Task 2: Envelope — `tagline` on `MealBreakdownJson` + DTO mapping

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java:21-28`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` (both `new MealBreakdownJson(...)` call sites, `:115` and `:172`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/mapper/BreakdownDtoMapper.java:28-44`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java:144` (the `merge` constructor call)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: `MealBreakdown.tagline` from Task 1.
- Produces: `MealBreakdownJson(value, confidence, summary, tagline, dimensions, improve, tools)` — **note the parameter order: `tagline` goes right after `summary`**, matching the DTO. Every later task constructs it this way.

- [ ] **Step 1: Write the failing test**

Add to `MealScoringServiceTest`:

```java
    @Test
    void testScoreMeal_shouldLeaveTaglineNull_whenNoCoachRan() {
        MealBreakdownJson b = service.scoreMeal("breakfast", List.of(line()), LocalTime.of(8, 0));

        assertThat(b.tagline()).isNull();   // P8 prose socket — the scorer never fabricates it
    }
```
(`line()` — reuse whatever line factory the existing tests in that class already use.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`
Expected: COMPILE FAILURE — `cannot find symbol: method tagline()`.

- [ ] **Step 3: Add the field and thread it through**

In `MealBreakdownJson`:

```java
public record MealBreakdownJson(
    BigDecimal value,
    BigDecimal confidence,
    String summary,
    String tagline,
    List<Dimension> dimensions,
    List<ImproveRow> improve,
    List<ToolRow> tools
) {
```
Update the record's javadoc: `summary`, `tagline` and `improve` are the P8 prose sockets — null/empty until the coach (mezo-mr4n) fills them.

In `MealScoringService`, both constructor calls pass `null` for the new slot, e.g. `:115`:

```java
        return new MealBreakdownJson(round2(value), round2(confidence), null, null,
            dims.stream().map(Dim::toJson).toList(), List.of(),
            tools(slot, lines, dims, localTime));
```

In `BreakdownDtoMapper.toDto`, after `.summary(b.summary())`:

```java
            .tagline(b.tagline())
```

In `RecipeBreakdownProseService.merge`, keep the recipe behaviour unchanged (recipes have no tagline):

```java
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), null, dims,
            improve, tools);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest='MealScoringServiceTest,MealApiIT,MealServiceIT,RecipeBreakdownApiIT' -DargLine=-Xmx3g`
Expected: all PASS. Old rows deserialize with `tagline = null` — jsonb is schemaless, no migration.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git -c core.hooksPath=/dev/null commit -m "feat(nutrition): tagline socket on the breakdown envelope (mezo-mr4n)"
```

---

### Task 3: `Window.label` — the workout's name

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryService.java` (record at `:38`, all four `new Window(...)` sites)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java:167-170` (the mapper into the scorer's window — drops the label)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryServiceIT.java`

**Interfaces:**
- Produces: `WorkoutWindowQueryService.Window(LocalTime start, LocalTime end, String kind, boolean done, String label)` — Task 5 reads `label` for the prompt. `MealScoringService.WorkoutWindow` is NOT changed (classifyRole has no use for it).

- [ ] **Step 1: Write the failing tests**

Add to `WorkoutWindowQueryServiceIT`:

```java
    @Test
    void testWindowsFor_shouldLabelTheGymWindow_withThePlannedTemplateDay() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        var meso = train.createActiveMeso(owner);
        train.createTemplateDay(owner, meso.getId(), "Pull nap");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isEqualTo("Pull nap");
    }

    @Test
    void testWindowsFor_shouldLabelTheSportWindow_withTheSportName() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createSportSession(owner, wed);       // sport defaults to "volleyball"

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isEqualTo("volleyball");
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=WorkoutWindowQueryServiceIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE — `cannot find symbol: method label()`.

- [ ] **Step 3: Implement**

Record + javadoc:

```java
    /**
     * One workout on a date: schedule start, derived end, kind, whether it was actually done, and
     * a human label for the coach prose (mezo-mr4n) — the planned meso day for gym, the sport
     * name for sport, the prescribed session's label for run. Null when nothing names it.
     */
    public record Window(LocalTime start, LocalTime end, String kind, boolean done, String label) {
    }
```

Gym: resolve the day's planned template once, before the slot loop, and pass its label:

```java
        String gymLabel = workoutSessionRepository
            .findPlannedTemplateForDate(userId, date)          // existing companion-snapshot idiom
            .map(WorkoutSessionEntity::getDayLabel)
            .orElse(null);
```
If the repository method's name/signature differs, grep `ContextSnapshotAssembler` for how it resolves "today's planned training" and reuse that exact call — do not invent a new query.

Sport: inside `addSportWindows`, the session branch labels with `session.getSport()`, the unmatched-slot branch with `slot.getSport()`. Run: label with `s.label()` from the `RunPrescribedSession`.

Then fix the one call site that maps into the scorer (`MealService.java:167`) — it constructs `MealScoringService.WorkoutWindow(w.start(), w.end(), w.done())` and is unaffected by the new field; verify it still compiles.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest='WorkoutWindowQueryServiceIT,MealServiceIT' -DargLine=-Xmx3g`
Expected: all PASS (12 tests in the IT).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(train): label workout windows for the coach prose (mezo-mr4n)"
```

---

### Task 4: The LLM seam — port, companion adapter, feature switch

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MealCoachLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (next to `RECIPE_AI_SCORE_SWITCH:49`)
- Modify: `backend/src/main/resources/application.yml` (the `mezo.feature` block, ~`:136`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java` (already enforces the slice-cycle rule — just must stay green)

**Interfaces:**
- Produces: `MealCoachLlm.complete(String systemPrompt, String userMessage) → String`; switch constant `FeaturesConfiguration.MEAL_COACH_SWITCH = "mezo.feature.meal-coach.enabled"`.

- [ ] **Step 1: Write the port**

```java
package io.mrkuhne.mezo.feature.meal.service;

/**
 * Meal-owned LLM port (ADR 0012, mezo-mr4n): the coach layer's only LLM dependency. The companion
 * feature provides the adapter (cheap tier), so meal never imports {@code feature.companion}. An
 * absent bean (companion off) means no verdicts are produced and the deterministic envelope is
 * served as is — never an error.
 */
public interface MealCoachLlm {

    String complete(String systemPrompt, String userMessage);
}
```

- [ ] **Step 2: Write the companion adapter**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.meal.service.MealCoachLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the meal-owned {@link MealCoachLlm} port (mezo-mr4n) — the
 * {@link RecipeBreakdownLlmAdapter} shape. The only cross-feature edge is companion → meal, the
 * direction the graph already runs, so the ArchUnit slice-cycle rule stays closed. Gated on the
 * companion switch: with the companion off there is no bean and MealCoachService degrades
 * silently (the feature's core — the deterministic score — is already served).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MealCoachLlmAdapter implements MealCoachLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
```

- [ ] **Step 3: Add the switch constant and the config**

`FeaturesConfiguration`:

```java
    /** Meal coach prose (mezo-mr4n): gates ONLY the LLM verdicts — the deterministic meal score
     *  and its breakdown are unaffected. Additionally needs COMPANION_SWITCH (the port adapter
     *  lives there). */
    public static final String MEAL_COACH_SWITCH = "mezo.feature.meal-coach.enabled";
```

`application.yml`, in the `mezo.feature` block:

```yaml
    # Meal coach verdicts (mezo-mr4n) — LLM prose over the deterministic meal score; needs the
    # companion switch too (the MealCoachLlm adapter bean). Off -> empty verdicts, never an error.
    meal-coach:
      enabled: true
```

- [ ] **Step 4: Verify the architecture rules still hold**

Run: `cd backend && ./mvnw test -Dtest=ArchitectureTest -DargLine=-Xmx3g`
Expected: PASS — in particular the feature-slice cycle rule. If it fails, the adapter ended up in the wrong slice: it MUST live in `feature/companion/llm`, importing `feature.meal`, never the reverse.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/src/main/resources/application.yml
git -c core.hooksPath=/dev/null commit -m "feat(meal): consumer-owned MealCoachLlm port + companion adapter + switch (mezo-mr4n)"
```

---

### Task 5: `MealCoachService` — prompt, parse, persist

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (new sentinel, next to `RECIPE_FIT_SENTINEL:79`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealCoachServiceIT.java` (create)

**Interfaces:**
- Consumes: `MealCoachLlm` (Task 4) · `Window.label` (Task 3) · `MealBreakdownJson(..., tagline, ...)` (Task 2) · `WorkoutWindowQueryService.windowsFor(userId, date)` · `MealRepository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date)` (used by `FuelDayService.java:38`) · `NutritionTargetsProperties`.
- Produces: `MealCoachService.generateForDay(UUID userId, LocalDate date, boolean allowGenerate) → List<MealCoachVerdict>` and `MealCoachService.generateForMeal(UUID userId, UUID mealId) → List<MealCoachVerdict>` (0..1). Both return API DTOs; Task 6 only wires them.

- [ ] **Step 1: Add the fake-LLM sentinel**

In `FakeCompanionLlm`, next to the other sentinels:

```java
    /** Scripted meal-coach verdicts (mezo-mr4n): {@code [fake-meal-coach:{json}]} planted in a MEAL
     *  TITLE (it appears in the prompt's user message). GREEDY — the payload nests objects.
     *  No sentinel -> prompt echo -> unparseable -> the coach degrades, which is exactly the
     *  LLM-failure path the ITs assert. */
    public static final Pattern MEAL_COACH_SENTINEL =
            Pattern.compile("\\[fake-meal-coach:(\\{.*})]", Pattern.DOTALL);
```

and in the `complete(systemPrompt, userMessage, tools, toolContext)` body, alongside the existing `RECIPE_FIT_SENTINEL` match (around `:269`):

```java
        Matcher mealCoach = MEAL_COACH_SENTINEL.matcher(userMessage);
        if (mealCoach.find()) {
            return mealCoach.group(1);
        }
```

- [ ] **Step 2: Write the failing test**

Create `MealCoachServiceIT` (extends `AbstractIntegrationTest`, `@ActiveProfiles("companion-fake")`):

```java
    private static final String CANNED = """
        {"meals":[{"mealId":"%s","tagline":"Remek pre-workout üzemanyag",\
        "summary":"Gyors szénhidrát a Pull nap előtt — pont jó itt.",\
        "improve":[{"text":"Tegyél mellé 20g fehérjét","impact":"+fehérje"}]}]}""";

    @Test
    void testGenerateForDay_shouldPersistTheVerdictIntoTheBreakdown_whenTheLlmAnswers() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = mealPopulator.createScoredMeal(owner, today, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");

        List<MealCoachVerdict> verdicts = service.generateForDay(owner, today, true);

        assertThat(verdicts).hasSize(1);
        assertThat(verdicts.getFirst().getTagline()).isEqualTo("Remek pre-workout üzemanyag");
        assertThat(verdicts.getFirst().getImprove()).hasSize(1);
        // persisted into the SAME envelope, numbers untouched
        MealEntity reloaded = mealRepository.findById(meal.getId()).orElseThrow();
        assertThat(reloaded.getBreakdown().tagline()).isEqualTo("Remek pre-workout üzemanyag");
        assertThat(reloaded.getBreakdown().value()).isEqualByComparingTo(meal.getBreakdown().value());
    }

    @Test
    void testGenerateForDay_shouldReturnCachedVerdicts_withoutCallingTheLlmAgain() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = mealPopulator.createScoredMeal(owner, today, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");
        service.generateForDay(owner, today, true);

        // strip the sentinel: a second LLM call would now echo the prompt and parse to nothing
        meal.setTitle("Zabkása");
        List<MealCoachVerdict> second = service.generateForDay(owner, today, true);

        assertThat(second).hasSize(1);
        assertThat(second.getFirst().getTagline()).isEqualTo("Remek pre-workout üzemanyag");
    }

    @Test
    void testGenerateForDay_shouldNotGenerate_whenTheDayIsInThePast() {
        UUID owner = owner();
        LocalDate past = LocalDate.now().minusDays(3);
        MealEntity meal = mealPopulator.createScoredMeal(owner, past, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");

        assertThat(service.generateForDay(owner, past, false)).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }
```

If `MealPopulator` has no `createScoredMeal(owner, date, title)` factory, add one there (a meal with one pantry item, scored through `MealService` so the breakdown is real) — populators own test data, tests never build entities inline.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=MealCoachServiceIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE — `MealCoachService` does not exist.

- [ ] **Step 4: Implement the service**

Shape (fill in the prompt text from spec §3–§4; keep the Hungarian register of `RecipeBreakdownProseService.SYSTEM_PROMPT`):

```java
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_COACH_SWITCH, havingValue = "true")
public class MealCoachService {

    private static final String SYSTEM_PROMPT = """
        Egy logolt étkezésekről mondasz rövid, kontextusos szakvéleményt.
        Megkapod az étkezéseket, a determinisztikus pontszámukat dimenziónként, a szerepüket
        (standard / pre_workout / post_workout), az aznapi edzéseket és azt, hol tartott a napi
        keret az adott étkezés PILLANATÁBAN.
        Válaszolj EGY JSON objektummal, semmi mással:
        {"meals":[{"mealId":string,"tagline":string,"summary":string,
                   "improve":[{"text":string,"impact":string}]}]}
        Szabályok:
        - Magyarul, tegeződve, tömören.
        - tagline: MAX 60 karakter, kártyára való vágat (pl. "Remek pre-workout üzemanyag").
        - summary: 2-3 mondat — mire volt jó ez az étkezés EBBEN a helyzetben.
        - improve: 0-3 konkrét javaslat; impact rövid címke (pl. "+rost", "-NOVA4").
        - A megadott SZÁMOKAT soha ne mondd ellent és ne találj ki újakat — magyarázod őket.
        - Minden étkezésnél CSAK a saját pillanatáig ismert napi állapotot vedd figyelembe.
        - Minden kapott mealId-hoz pontosan egy objektum tartozzon.
        """;

    private final MealRepository mealRepository;
    private final WorkoutWindowQueryService workoutWindowQueryService;
    private final NutritionTargetsProperties targets;
    private final ObjectProvider<MealCoachLlm> llm;
    private final ObjectMapper objectMapper;

    /** Day batch: cached verdicts + (when allowGenerate) ONE call for the still-verdictless meals. */
    public List<MealCoachVerdict> generateForDay(UUID userId, LocalDate date, boolean allowGenerate) { … }

    /** Single meal — always allowed to generate (an explicit score-sheet open). */
    public List<MealCoachVerdict> generateForMeal(UUID userId, UUID mealId) { … }
}
```

Rules the implementation must honour (spec §4–§8):
1. **Read in a short read-only transaction, call the LLM OUTSIDE any transaction, persist in a second short write transaction.** Do not annotate the public methods `@Transactional`; use small private/`@Transactional`-annotated helper beans or `TransactionTemplate`, whichever fits the codebase — the LLM roundtrip must not hold a pooled connection.
2. **Day state as of each meal:** fold the day's meals (already `loggedAt`-ordered) accumulating kcal/P/C/F; each meal's prompt block gets the sums of the meals *before* it, its index (`n`-th meal of the day), and the remaining budget from `NutritionTargetsProperties`.
3. **Only verdictless meals go into the prompt**; a meal whose `breakdown.tagline` (or `summary`) is non-null is served from cache.
4. **Parse permissively** (the `RecipeBreakdownProseService:88-94` idiom): substring from the first `{` to the last `}`, `objectMapper.readValue`, unknown keys ignored; drop verdicts with an unknown `mealId` or a blank `summary`; cap `improve` at 3 non-blank rows; truncate `tagline` to 60 chars.
5. **Persist only prose:** re-read each meal by id and write a new `MealBreakdownJson` with the SAME value/confidence/dimensions/tools and the new summary/tagline/improve. Never touch numbers.
6. **Never throw:** wrap the whole LLM+parse leg in `try/catch (Exception)` → `log.warn` → return just the cached verdicts.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest=MealCoachServiceIT -DargLine=-Xmx3g`
Expected: all three PASS.

- [ ] **Step 6: Add the prompt-content test**

The fake echoes the prompt when no sentinel is present, so the assembled prompt is assertable. Add:

```java
    @Test
    void testGenerateForDay_shouldFeedTheCoach_withTheWorkoutLabelAndTheUpToThatPointDayState() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        train.createGymSlot(owner, today.getDayOfWeek().getValue() - 1, "18:00");
        var meso = train.createActiveMeso(owner);
        train.createTemplateDay(owner, meso.getId(), "Pull nap");
        mealPopulator.createScoredMeal(owner, today, "Reggeli");
        mealPopulator.createScoredMeal(owner, today, "Ebéd");

        // No sentinel -> the fake echoes the prompt -> unparseable -> degrades to empty…
        assertThat(service.generateForDay(owner, today, true)).isEmpty();
        // …but the echo is captured by the fake, so assert what we SENT:
        assertThat(FakeCompanionLlm.lastUserMessage()).contains("Pull nap").contains("Ebéd");
    }
```
If `FakeCompanionLlm` has no last-message accessor, add a static `volatile String lastUserMessage` set in `complete` and a getter — test-support state in a test-profile bean is fine; do NOT add it to a production class.

- [ ] **Step 7: Run and commit**

```bash
cd backend && ./mvnw test -Dtest=MealCoachServiceIT -DargLine=-Xmx3g
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(meal): MealCoachService — batched verdict generation with frozen inputs (mezo-mr4n)"
```

---

### Task 6: Endpoints — controller wiring + the today-only rule

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/controller/MealController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealCoachApiIT.java` (create)

**Interfaces:**
- Consumes: `MealCoachService.generateForDay/generateForMeal` (Task 5), the generated `MealApi` methods (Task 1).
- Produces: `GET /api/meal/coach?date=…` and `GET /api/meal/{id}/coach`, both returning `MealCoachResponse`.

- [ ] **Step 1: Write the failing API test**

Create `MealCoachApiIT` extending `ApiIntegrationTest`, `@ActiveProfiles("companion-fake")`, using the HTTP verb helpers + `ownerAuthHeaders()`:

```java
    @Test
    void testGetMealCoachForDay_shouldReturnTheVerdicts_whenTheDayIsToday() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = mealPopulator.createScoredMeal(owner, today, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");

        MealCoachResponse res = get("/api/meal/coach?date=" + today, MealCoachResponse.class);

        assertThat(res.getVerdicts()).hasSize(1);
        assertThat(res.getVerdicts().getFirst().getMealId()).isEqualTo(meal.getId());
    }

    @Test
    void testGetMealCoach_shouldGenerateForASingleMeal_evenOnAPastDate() {
        UUID owner = owner();
        LocalDate past = LocalDate.now().minusDays(5);
        MealEntity meal = mealPopulator.createScoredMeal(owner, past, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");

        MealCoachResponse res = get("/api/meal/" + meal.getId() + "/coach", MealCoachResponse.class);

        assertThat(res.getVerdicts()).hasSize(1);
    }

    @Test
    void testGetMealCoach_shouldReturn404_whenTheMealBelongsToSomeoneElse() {
        UUID stranger = databasePopulator.populateUser("stranger@example.com");
        MealEntity foreign = mealPopulator.createScoredMeal(stranger, LocalDate.now(), "Idegen");

        assertNotFound(get("/api/meal/" + foreign.getId() + "/coach"));   // use the base class's
    }                                                                     // SystemMessage assert helper
```
Match the exact helper names `ApiIntegrationTest` provides (grep an existing `*ApiIT` — e.g. `RecipeBreakdownApiIT` — rather than guessing).

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=MealCoachApiIT -DargLine=-Xmx3g`
Expected: FAIL — 404/501 or `UnsupportedOperationException` from the Task-1 placeholder.

- [ ] **Step 3: Implement the controller methods**

```java
    private final ObjectProvider<MealCoachService> coachService;

    @Override
    public MealCoachResponse getMealCoachForDay(LocalDate date) {
        MealCoachService svc = coachService.getIfAvailable();
        List<MealCoachVerdict> verdicts = svc == null ? List.of()
            : svc.generateForDay(currentUserId.get(), date, date.equals(LocalDate.now()));
        return MealCoachResponse.builder().verdicts(verdicts).build();
    }

    @Override
    public MealCoachResponse getMealCoach(UUID id) {
        MealCoachService svc = coachService.getIfAvailable();
        List<MealCoachVerdict> verdicts = svc == null ? List.of()
            : svc.generateForMeal(currentUserId.get(), id);
        return MealCoachResponse.builder().verdicts(verdicts).build();
    }
```
The ownership 404 lives in the service (it re-reads the meal `ByIdAndCreatedByAndDeletedFalse` and throws `SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND"), NOT_FOUND)` — the `RecipeBreakdownService:44-46` idiom). `LocalDate.now()` here is the server zone, per spec §5.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='MealCoachApiIT,MealCoachServiceIT,MealApiIT' -DargLine=-Xmx3g`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(meal): coach endpoints — day batch (today-only) + single meal (mezo-mr4n)"
```

---

### Task 7: Degradation paths

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealCoachDegradeApiIT.java` (create)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealCoachSwitchOffApiIT.java` (create)
- Possibly modify: `MealCoachService` if a path is found to throw

**Interfaces:** consumes Tasks 5–6; produces nothing new.

- [ ] **Step 1: Write the switch-off test**

`MealCoachSwitchOffApiIT` — `@SpringBootTest(properties = "mezo.feature.meal-coach.enabled=false")` (copy the exact style of `MealAiDraftSwitchOffApiIT`):

```java
    @Test
    void testGetMealCoachForDay_shouldReturnEmptyVerdicts_whenTheFeatureIsOff() {
        UUID owner = owner();
        MealEntity meal = mealPopulator.createScoredMeal(owner, LocalDate.now(), "Zabkása");

        MealCoachResponse res = get("/api/meal/coach?date=" + LocalDate.now(), MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();          // 200 with nothing, never 5xx
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }
```

- [ ] **Step 2: Write the LLM-failure tests**

`MealCoachDegradeApiIT`, `@ActiveProfiles("companion-fake")`:

```java
    @Test
    void testGetMealCoachForDay_shouldDegradeToEmpty_whenTheLlmThrows() {
        UUID owner = owner();
        MealEntity meal = mealPopulator.createScoredMeal(owner, LocalDate.now(), "Zabkása");
        meal.setTitle("Zabkása " + FakeCompanionLlm.FAIL_COMPLETE);   // forced failure sentinel

        MealCoachResponse res = get("/api/meal/coach?date=" + LocalDate.now(), MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();          // nothing persisted -> self-heals later
    }

    @Test
    void testGetMealCoachForDay_shouldDegradeToEmpty_whenTheAnswerIsNotParseable() {
        UUID owner = owner();
        MealEntity meal = mealPopulator.createScoredMeal(owner, LocalDate.now(), "Zabkása");
        // no sentinel at all -> the fake echoes the prompt -> not JSON

        MealCoachResponse res = get("/api/meal/coach?date=" + LocalDate.now(), MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().value()).isNotNull();          // the deterministic score is intact
    }

    @Test
    void testGetMealCoachForDay_shouldDropAVerdict_whenItsMealIdIsUnknown() {
        UUID owner = owner();
        MealEntity meal = mealPopulator.createScoredMeal(owner, LocalDate.now(), "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:{\"meals\":[{\"mealId\":\""
            + UUID.randomUUID() + "\",\"tagline\":\"Idegen\",\"summary\":\"Idegen\",\"improve\":[]}]}]");

        MealCoachResponse res = get("/api/meal/coach?date=" + LocalDate.now(), MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
    }
```

- [ ] **Step 3: Run them**

Run: `cd backend && ./mvnw test -Dtest='MealCoachDegradeApiIT,MealCoachSwitchOffApiIT' -DargLine=-Xmx3g`
Expected: PASS. Any 5xx means a leg of §8 is unguarded — fix `MealCoachService`, not the test.

- [ ] **Step 4: Add the edit-invalidation test**

Add to `MealCoachServiceIT`:

```java
    @Test
    void testGenerateForDay_shouldDropTheProse_whenTheMealIsEdited() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = mealPopulator.createScoredMeal(owner, today, "Zabkása");
        meal.setTitle("Zabkása [fake-meal-coach:" + CANNED.formatted(meal.getId()) + "]");
        service.generateForDay(owner, today, true);

        mealService.update(owner, meal.getId(), anEditedRequestFor(meal));   // re-runs applyScore

        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }
```
Build the edit request the way `MealServiceIT` already does for its update tests.

- [ ] **Step 5: Run and commit**

```bash
cd backend && ./mvnw test -Dtest='MealCoachServiceIT,MealCoachDegradeApiIT,MealCoachSwitchOffApiIT' -DargLine=-Xmx3g
git add backend/src
git -c core.hooksPath=/dev/null commit -m "test(meal): coach degradation + edit-invalidation coverage (mezo-mr4n)"
```

---

### Task 8: Frontend data layer

**Files:**
- Create: `frontend/src/data/fuel/coachApi.ts`
- Create: `frontend/src/data/fuel/coachHooks.ts`
- Create: `frontend/src/data/fuel/coachHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (the only barrel — re-export the new hooks)
- Modify: `frontend/src/data/fuel/mealApi.ts:85-95` (`fromBreakdown` — carry `tagline`)
- Modify: `frontend/src/data/types.ts` (the `MealBreakdown` FE type — add `tagline`)

**Interfaces:**
- Consumes: the generated `MealCoachResponse` (Task 1).
- Produces: `useMealCoach(date: string) → { verdicts: Record<string, MealCoachVerdict>, isPending }` (keyed by mealId for O(1) card lookup) and `useMealCoachFor(mealId: string | null) → { verdict: MealCoachVerdict | null, isPending }`. Type `MealCoachVerdict = { mealId: string; tagline: string | null; summary: string | null; improve: { text: string; impact: string }[] }`.

- [ ] **Step 1: Write the failing hook test**

`coachHooks.test.tsx` — follow the structure of `recipeHooks.test.tsx` (same wrapper/provider setup):

```tsx
  it('maps the day verdicts by mealId (real mode)', async () => {
    // arrange the fetch mock the way the sibling tests do
    const { result } = renderHook(() => useMealCoach('2026-07-27'), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.verdicts['11111111-1111-1111-1111-111111111111'].tagline)
      .toBe('Remek pre-workout üzemanyag')
  })

  it('returns canned mock verdicts in mock mode', async () => {
    // with VITE_USE_MOCK=true the hook must resolve without any fetch
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test coachHooks`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement api + hooks**

`coachApi.ts` — a thin typed client next to `mealApi.ts`, using the same generated-client helper the siblings use (`recipeApi.ts` is the closest template):

```ts
export const coachApi = {
  day: (date: string) => http.get<MealCoachResponse>(`/api/meal/coach?date=${date}`),
  meal: (id: string) => http.get<MealCoachResponse>(`/api/meal/${id}/coach`),
}
```

`coachHooks.ts` — `useDualQuery` for both, with a canned mock map so mock mode never fetches:

```ts
const COACH_KEY = (date: string) => ['meal-coach', date] as const
```

`fromBreakdown` gains `tagline: b.tagline ?? null`, and the FE `MealBreakdown` type gains `tagline: string | null`.

- [ ] **Step 4: Run tests in both modes**

```bash
cd frontend && pnpm test coachHooks && VITE_USE_MOCK=true pnpm test coachHooks
```
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): meal-coach data layer — dual-mode hooks + tagline mapping (mezo-mr4n)"
```

---

### Task 9: Frontend UI — card tagline + sheet verdict

**Files:**
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx:62` (title area)
- Modify: `frontend/src/features/fuel/sheets/MealScoreSheet.tsx:46-70` (summary card)
- Modify: whichever page composes the timeline and already passes `scoredMeal` into `SlotCard` (grep `scoredMeal=` under `features/fuel/pages`)
- Test: `frontend/src/features/fuel/components/SlotCard.test.tsx` (create if absent), `MealScoreSheet.test.tsx`

**Interfaces:** consumes `useMealCoach` / `useMealCoachFor` (Task 8) through `@/data/hooks`.

- [ ] **Step 1: Write the failing component tests**

```tsx
  it('renders the coach tagline under the title when a verdict exists', () => {
    render(<SlotCard slot={slotWithMeal} tagline="Remek pre-workout üzemanyag" … />)
    expect(screen.getByText('Remek pre-workout üzemanyag')).toBeInTheDocument()
  })

  it('renders no tagline row when there is no verdict', () => {
    render(<SlotCard slot={slotWithMeal} tagline={null} … />)
    expect(screen.queryByTestId('coach-tagline')).toBeNull()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm test SlotCard`
Expected: FAIL — unknown prop / element not found.

- [ ] **Step 3: Implement**

`SlotCard` takes an optional `tagline: string | null` prop and renders one muted line under the title (`data-testid="coach-tagline"`), never reserving space when absent. The timeline page passes `verdicts[meal.id]?.tagline ?? null` from `useMealCoach(date)`.

`MealScoreSheet` calls `useMealCoachFor(meal.id)`; while pending it shows a skeleton in the existing summary card slot; on arrival it renders `verdict.summary` (the card at `:47` already handles the markdown) and merges `verdict.improve` into the improve list. The deterministic body renders immediately either way.

- [ ] **Step 4: Run the full FE gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build clean, both modes green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): coach tagline on the timeline card + verdict in the score sheet (mezo-mr4n)"
```

---

### Task 10: Docs, runtime verification, landing

**Files:**
- Modify: `docs/features/fuel.md` (§4 endpoints, §5 integrations, §9 behaviour, §10 file map)
- Modify: `docs/features/companion.md` (the adapter list — a new consumer of `CompanionLlm`)

- [ ] **Step 1: Update the feature docs**

`fuel.md`: the coach is the **fourth** LLM-backed endpoint pair; record the consumer-owned `MealCoachLlm` port + companion adapter (ADR 0012), the `mezo.feature.meal-coach.enabled` switch, the lazy/batched today-only generation, the frozen-input rule (state as of `loggedAt`), the jsonb cache with free invalidation, and the silent degrade. Link the spec. Keep it to the sections that changed — the doc is living, not a changelog.

- [ ] **Step 2: Run the doc linter**

```bash
node scripts/lint-docs.mjs
```
Expected: `fuel.md` and `companion.md` not flagged stale (other pre-existing stale docs are fine — `me.md` is tracked by `mezo-t80p`).

- [ ] **Step 3: Verify in the running app**

```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata &
cd frontend && pnpm dev
```
Log a meal, open Mai, confirm: the timeline card shows a tagline shortly after load, the score sheet shows the summary + suggestions, and the numbers are identical to before. Then set `mezo.feature.meal-coach.enabled=false` and confirm the UI is exactly today's UI (no empty rows, no spinner stuck).

- [ ] **Step 4: Commit and open the CI PR**

```bash
git add docs/
git -c core.hooksPath=/dev/null commit -m "docs(fuel): meal-coach layer — port, switch, lazy batch, cache (mezo-mr4n)"
git push -u origin feat/meal-coach
gh pr create --title "feat(fuel): LLM meal-coach layer (mezo-mr4n)" --body "…"
```

- [ ] **Step 5: Land after CI is green**

CI is the authoritative full-suite gate. When all five checks pass: check whether `main` is checked out anywhere (`git worktree list`); if free, `git checkout main` here, `git -c core.hooksPath=/dev/null merge --no-ff feat/meal-coach`, **push immediately** (a post-merge `git pull --rebase` would flatten the merge commit), delete the branch. Then from the MAIN checkout: `bd close mezo-mr4n` + `bd update mezo-mr4n --notes "…"` + `bd dolt push`.

---

## Self-review notes

- **Spec coverage:** §3 → Tasks 1, 2, 5 · §4 → Task 5 (day-state fold, prompt) + Task 3 (label) · §5 → Tasks 1, 6 · §6 → Task 4 (port/adapter/switch) + Task 5 (tx shape) · §7 → Task 2 (field) + Task 7 (edit-invalidation test) · §8 → Task 7 · §9 → Tasks 1, 8, 9 · §10 → Tasks 5–9 · §11 out-of-scope items appear in no task, by design.
- **Type consistency:** `MealBreakdownJson`'s new parameter sits after `summary` in every construction site (Tasks 2, 5); `Window` gains `label` as its 5th component (Task 3) and is read only in Task 5; `MealCoachVerdict` is the same generated DTO from Task 1 through Task 9.
- **Open tunables from spec §12** are decided in-flight: `tagline` cap = 60 chars (Task 5 rule 4), no per-day meal cap (a pathological day is not a real case yet), and the system prompt in Task 5 is the first draft to be judged against real output in Task 10 step 3.
