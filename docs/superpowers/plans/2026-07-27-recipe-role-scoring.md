# Recipe meal-role scoring + visible re-evaluation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a recipe an explicit meal role (`standard` / `pre_workout` / `post_workout`) that selects the same scoring-rubric overlay the logged-meal surface already uses, and make the AI re-evaluation of a recipe visible instead of silently serving stale prose.

**Architecture:** A new `recipe.role` column flows contract-first (`recipe.yml` → generated DTOs → entity → FE types). `MealScoringService` grows a single private `rubricFor(MealRole)` helper that BOTH `scoreMeal` and the (newly role-aware) `recipeTemplateBreakdown` / `recipeFit` call, so the logged and template surfaces can never drift. `standard` is the identity overlay, so every existing recipe's number is unchanged. On the frontend the editor gains a "Szerep" segmented row, the detail/list surfaces label a non-standard role, and `useRecipeBreakdown` exposes a `refreshing` flag that swaps the stale prose for the existing twinkle card.

**Tech Stack:** Java 21 / Spring Boot 4 / Maven / Liquibase / MapStruct / JUnit5+AssertJ (integration-first against the fixed `mezo_test` DB) · React 19 / Vite / TypeScript / TanStack Query / Vitest + RTL / MSW · OpenAPI contract-first (`api/feature/recipe/recipe.yml`).

## Global Constraints

- **Driving bd issue: `mezo-uavr`.** Every commit subject ends with `(mezo-uavr)`.
- **Spec:** `docs/superpowers/specs/2026-07-27-recipe-role-scoring-design.md` — read it before Task 1.
- **Language:** code/comments/commits in ENGLISH; all user-facing UI copy in HUNGARIAN.
- **Wire values are snake_case lowercase:** `standard` | `pre_workout` | `post_workout`. The Java enum is `io.mrkuhne.mezo.feature.nutrition.service.MealRole` (`STANDARD`, `PRE_WORKOUT`, `POST_WORKOUT`). Conversion happens ONLY in `RecipeMapper`.
- **Zero regression is a hard requirement:** `standard` must produce byte-identical numbers to today. Existing recipes have no role → default `standard`.
- **Contract-first:** never hand-write boundary DTOs. Edit `api/feature/recipe/recipe.yml`, then regenerate (Task 1).
- **House standards:** `docs/references/liquibase_conventions.md` (changeset naming `{YYYYMMDDHHMM}_{bd-id}_{desc}`, explicit constraint names, never modify a released changeset), `spring_patterns.md` (constructor DI, `@Transactional` on methods), `testing_standards.md` + `integration_test_framework.md` (integration-first, AssertJ only, no mocks/H2), `frontend_conventions.md` (deep `@/*` imports, no barrels except `data/hooks.ts`, colocated tests).
- **Commit style:** `git -c core.hooksPath=/dev/null commit` (the bd pre-commit hook otherwise stages `.beads/issues.jsonl` into every commit — this is a worktree).
- **Backend test runs are memory-hungry on this machine:** always run FOCUSED tests, e.g. `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`. Never run the whole suite locally — CI is the full-suite gate.
- **`./mvnw` always with `clean`** (Lombok+MapStruct incremental compile is flaky).
- **Frontend gate (both modes):** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `api/feature/recipe/recipe.yml` | `role` on `RecipeRequest` (optional, default `standard`) + `RecipeResponse` (required) | 1 |
| `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | generated — regenerated, never hand-edited | 1 |
| `backend/.../db/changelog/1.0.0/script/202607271200_mezo-uavr_recipe_role.sql` | `recipe.role` column + CHECK constraint | 2 |
| `backend/.../db/changelog/1.0.0/1.0.0_master.yml` | changeset include | 2 |
| `backend/.../feature/recipe/entity/RecipeEntity.java` | `role` field (`MealRole`, STRING enum, non-null) | 2 |
| `backend/.../feature/recipe/mapper/RecipeMapper.java` | wire ↔ `MealRole` conversion (the ONLY place) | 2 |
| `backend/.../feature/nutrition/service/MealScoringService.java` | `rubricFor(MealRole)` helper + role-aware `recipeTemplateBreakdown` / `recipeFit` | 3 |
| `backend/.../feature/recipe/service/RecipeService.java` | passes `e.getRole()` into the fit | 4 |
| `backend/.../feature/recipe/service/RecipeBreakdownService.java` | passes `recipe.getRole()` into the template breakdown | 4 |
| `backend/.../feature/recipe/service/RecipeBreakdownProseService.java` | role in the system prompt + user message | 5 |
| `frontend/src/data/types.ts` | `RecipeRole` union, `Recipe.role`, `RecipeInput.role` | 6 |
| `frontend/src/data/fuel/recipeApi.ts` | `toRequest` / `fromResponse` carry the role | 6 |
| `frontend/src/data/fuel/recipeHooks.ts` | `buildRecipe` carries the role; `useRecipeBreakdown` exposes `refreshing` | 6, 9 |
| `frontend/src/data/fuel/pantry.ts` | mock seed roles | 6 |
| `frontend/src/features/fuel/logic/recipeRole.ts` | shared HU label map + the three role options (single source of truth for copy) | 7 |
| `frontend/src/features/fuel/pages/RecipeEditorPage.tsx` | „Szerep" segmented row | 7 |
| `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` | `recipeToInput` role, hero role chip, PONTSZÁM rubric label, refreshing twinkle | 7, 8, 9 |
| `frontend/src/features/fuel/components/RecipeCard.tsx` | role tag in the library list | 8 |
| `docs/features/fuel.md` | living feature doc | 10 |

---

### Task 1: Contract — `role` on the recipe request/response

**Files:**
- Modify: `api/feature/recipe/recipe.yml:121-157` (the `RecipeRequest` + `RecipeResponse` schema blocks)
- Generated (do not hand-edit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RecipeRequest.role?: string` and `RecipeResponse.role: string` (wire values `standard` | `pre_workout` | `post_workout`) — every later task depends on these generated types.

- [ ] **Step 1: Add `role` to `RecipeRequest`**

In `api/feature/recipe/recipe.yml`, inside `RecipeRequest.properties`, directly after the `starred` line:

```yaml
        starred: { type: boolean, default: false }
        role: { type: string, pattern: '^(standard|pre_workout|post_workout)$', default: standard, description: 'Template meal role — selects the scoring rubric overlay (mezo-uavr). Absent ⇒ standard.' }
```

- [ ] **Step 2: Add `role` to `RecipeResponse`**

In the `RecipeResponse` block, add `role` to the `required` list (after `starred`) and to `properties` (after the `starred` line):

```yaml
      required: [id, name, category, servings, tags, starred, role, createdDate, novaDominant, macros, mezoFit, timesLogged, avgScore, lastLogged, ingredients]
```

```yaml
        starred: { type: boolean }
        role: { type: string, description: 'Template meal role: standard|pre_workout|post_workout (mezo-uavr)' }
```

- [ ] **Step 3: Regenerate the merged contract + FE types**

Run:
```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both now contain `role`.

- [ ] **Step 4: Verify the generated types**

Run: `grep -n "role" frontend/src/data/_client/api.gen.ts | head`
Expected: `role?: string` under `RecipeRequest` and `role: string` under `RecipeResponse`.

- [ ] **Step 5: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): recipe template role on the recipe contract (mezo-uavr)"
```

---

### Task 2: Persistence — migration, entity field, mapper conversion

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607271200_mezo-uavr_recipe_role.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeEntity.java` (after the `starred` field, ~`:85`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java` (`applyScalars`, `toResponse`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`

**Interfaces:**
- Consumes: `RecipeRequest.getRole()` / `RecipeResponse.role` (Task 1).
- Produces: `RecipeEntity.getRole(): MealRole` (never null) — Tasks 4 and 5 read it.

- [ ] **Step 1: Write the failing mapper test**

Append to `RecipeMapperTest` (match the file's existing style — it constructs the mapper via `Mappers.getMapper(RecipeMapper.class)` or `new RecipeMapperImpl()`; reuse whatever the file already does):

```java
    @Test
    void testApplyScalars_shouldDefaultRoleToStandard_whenRequestRoleIsNull() {
        RecipeEntity e = new RecipeEntity();
        RecipeRequest r = baseRequest();   // reuse the file's existing request factory
        r.setRole(null);

        mapper.applyScalars(e, r);

        assertThat(e.getRole()).isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testApplyScalars_shouldMapWireRole_whenRequestCarriesPreWorkout() {
        RecipeEntity e = new RecipeEntity();
        RecipeRequest r = baseRequest();
        r.setRole("pre_workout");

        mapper.applyScalars(e, r);

        assertThat(e.getRole()).isEqualTo(MealRole.PRE_WORKOUT);
    }

    @Test
    void testToResponse_shouldEmitSnakeCaseWireRole_whenEntityIsPostWorkout() {
        RecipeEntity e = new RecipeEntity();
        e.setRole(MealRole.POST_WORKOUT);
        e.setName("X");
        e.setCategory("lunch");
        e.setServings(1);

        assertThat(mapper.toResponse(e).getRole()).isEqualTo("post_workout");
    }
```

If `baseRequest()` does not exist in the file, build the `RecipeRequest` inline with `name`, `category`, `servings`, `ingredients` set — mirror whatever an existing test in that file does.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeMapperTest -DargLine=-Xmx3g`
Expected: compile failure — `setRole` / `getRole` do not exist yet.

- [ ] **Step 3: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202607271200_mezo-uavr_recipe_role.sql`:

```sql
-- Template meal role on a recipe (mezo-uavr): selects the scoring rubric overlay on the template
-- surface. Existing rows default to STANDARD = the identity overlay, so every current fit number is
-- unchanged. Values mirror the MealRole enum (@Enumerated(STRING)).
ALTER TABLE recipe
    ADD COLUMN role varchar(16) NOT NULL DEFAULT 'STANDARD';

ALTER TABLE recipe
    ADD CONSTRAINT ck_recipe_role
        CHECK (role IN ('STANDARD','PRE_WORKOUT','POST_WORKOUT'));
```

- [ ] **Step 4: Register the changeset**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (keep the existing indentation exactly):

```yaml
  - changeSet:
      id: "1.0.0:202607271200_mezo-uavr_recipe_role"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607271200_mezo-uavr_recipe_role.sql
```

- [ ] **Step 5: Add the entity field**

In `RecipeEntity.java`, directly after the `starred` field, add (and add the imports `io.mrkuhne.mezo.feature.nutrition.service.MealRole`, `jakarta.persistence.EnumType`, `jakarta.persistence.Enumerated`):

```java
    /** Template meal role (mezo-uavr) — selects the scoring rubric overlay; never null. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MealRole role = MealRole.STANDARD;
```

- [ ] **Step 6: Map both directions**

In `RecipeMapper.applyScalars`, after the `starred` line:

```java
        e.setRole(fromWireRole(r.getRole()));
```

In `toResponse`, after `.starred(e.isStarred())`:

```java
            .role(e.getRole() == null ? "standard" : e.getRole().name().toLowerCase())
```

And add these helpers to the interface:

```java
    /** Wire (snake_case) -> MealRole. Null/blank means the client omitted it: STANDARD.
     *  The contract pattern rejects anything else before it reaches here. */
    default MealRole fromWireRole(String wire) {
        return wire == null || wire.isBlank()
            ? MealRole.STANDARD
            : MealRole.valueOf(wire.trim().toUpperCase());
    }
```

Add the import `io.mrkuhne.mezo.feature.nutrition.service.MealRole`.

- [ ] **Step 7: Run the mapper test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeMapperTest -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 8: Write the API round-trip test**

Append to `RecipeApiIT` (reuse the file's `createFood` / `line` helpers and its existing recipe-request factory):

```java
    @Test
    void testCreateRecipe_shouldRoundTripRole_whenPreWorkoutRequested() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Zab", "370", "13", "60", "7");
        RecipeRequest req = new RecipeRequest();
        req.setName("Pre toast");
        req.setCategory("breakfast");
        req.setServings(1);
        req.setIngredients(List.of(line(food, "100")));
        req.setRole("pre_workout");

        RecipeResponse created =
            postForBody("/api/recipe", req, auth, HttpStatus.CREATED, RecipeResponse.class);

        assertThat(created.getRole()).isEqualTo("pre_workout");
    }

    @Test
    void testCreateRecipe_shouldDefaultToStandard_whenRoleOmitted() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Zab2", "370", "13", "60", "7");
        RecipeRequest req = new RecipeRequest();
        req.setName("Sima recept");
        req.setCategory("lunch");
        req.setServings(1);
        req.setIngredients(List.of(line(food, "100")));

        RecipeResponse created =
            postForBody("/api/recipe", req, auth, HttpStatus.CREATED, RecipeResponse.class);

        assertThat(created.getRole()).isEqualTo("standard");
    }
```

- [ ] **Step 9: Run the API test**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeApiIT -DargLine=-Xmx3g`
Expected: PASS (docker compose must be up: `cd backend && docker compose up -d`).

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java backend/src/test/java
git -c core.hooksPath=/dev/null commit -m "feat(recipe): persist the template meal role (mezo-uavr)"
```

---

### Task 3: Scoring — one `rubricFor` helper, role-aware template surface

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` (`scoreMeal` `:91-124`, `recipeFit` `:135`, `recipeTemplateBreakdown` `:149`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: `MealRole`, `MealScoringProperties.Roles` (already exist).
- Produces:
  - `public MealBreakdownJson recipeTemplateBreakdown(String slot, List<ScoredLine> lines, MealRole role)`
  - `public BigDecimal recipeFit(String slot, List<ScoredLine> lines, MealRole role)`
  - Both keep their existing 2-arg overloads, delegating with `MealRole.STANDARD`. Tasks 4 call the 3-arg forms.

- [ ] **Step 1: Write the failing unit tests**

Append to `MealScoringServiceTest` (the file already builds `props` with the `Roles` bundle and has a `bd(...)` helper):

```java
    /** Carb/sugar-heavy pre-workout profile: white toast + honey + banana, one serving. */
    private List<ScoredLine> preWorkoutLines() {
        return List.of(
            new ScoredLine("Fehér toast", "80g",
                bd(210), bd(7), bd(40), bd(2), (short) 4,
                bd(2), bd(4), bd(1), bd(0.5), true, "grains", bd(80)),
            new ScoredLine("Méz", "30g",
                bd(90), bd(0), bd(24), bd(0), (short) 3,
                bd(0), bd(23), bd(0), bd(0), true, null, bd(30)),
            new ScoredLine("Banán", "120g",
                bd(107), bd(1), bd(27), bd(0), (short) 1,
                bd(3), bd(14), bd(0), bd(0), true, "fruits", bd(120)));
    }

    @Test
    void testRecipeTemplateBreakdown_shouldEqualLegacyOutput_whenRoleIsStandard() {
        MealBreakdownJson legacy = service.recipeTemplateBreakdown("breakfast", preWorkoutLines());
        MealBreakdownJson explicit =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);

        assertThat(explicit.value()).isEqualByComparingTo(legacy.value());
        assertThat(explicit.confidence()).isEqualByComparingTo(legacy.confidence());
        assertThat(explicit.dimensions()).usingRecursiveComparison().isEqualTo(legacy.dimensions());
    }

    @Test
    void testRecipeTemplateBreakdown_shouldLiftRoleSensitiveDimensions_whenRolePreWorkout() {
        MealBreakdownJson std =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT);

        assertThat(dim(pre, "who").score()).isGreaterThan(dim(std, "who").score());
        assertThat(dim(pre, "nova").score()).isGreaterThan(dim(std, "nova").score());
        assertThat(dim(pre, "macro").score()).isGreaterThan(dim(std, "macro").score());
        assertThat(pre.value()).isGreaterThan(std.value());
    }

    @Test
    void testRecipeTemplateBreakdown_shouldKeepRoleIndependentDimensions_whenRolePreWorkout() {
        MealBreakdownJson std =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT);

        for (String id : List.of("micro", "fat_quality", "plant_diversity", "energy_density", "portion")) {
            assertThat(dim(pre, id).score())
                .as("dimension %s must be role-independent", id)
                .isEqualByComparingTo(dim(std, id).score());
        }
    }

    @Test
    void testRecipeFit_shouldMatchTemplateValue_whenRoleGiven() {
        assertThat(service.recipeFit("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT))
            .isEqualByComparingTo(
                service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT).value());
    }

    private static MealBreakdownJson.Dimension dim(MealBreakdownJson b, String id) {
        return b.dimensions().stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }
```

If the file already has a `dim(...)` helper, reuse it instead of adding a second one.

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`
Expected: compile failure — no 3-arg `recipeTemplateBreakdown` / `recipeFit`.

- [ ] **Step 3: Extract the rubric overlay**

In `MealScoringService`, add a private carrier record and helper (place them right after the `WorkoutWindow` record):

```java
    /** The role-sensitive tunables a rubric overlay swaps (mezo-ta8p/mezo-uavr). */
    private record Rubric(int p, int c, int f, MealScoringProperties.WhoRefs who,
                          MealScoringProperties.NovaGroupScores nova) {
    }

    /**
     * The rubric a role scores under. STANDARD = the base targets/who/nova (identity overlay);
     * PRE/POST_WORKOUT take their fully-specified bundle from {@code mezo.fuel.scoring.roles}.
     * ONE helper for both the logged-meal and the recipe-template surface, so the two can never
     * drift apart (mezo-uavr).
     */
    private Rubric rubricFor(MealRole role) {
        if (role == MealRole.PRE_WORKOUT || role == MealRole.POST_WORKOUT) {
            MealScoringProperties.RoleRubric r =
                role == MealRole.PRE_WORKOUT ? props.roles().pre() : props.roles().post();
            return new Rubric(r.p(), r.c(), r.f(), r.who(), r.nova());
        }
        return new Rubric(targets.p(), targets.c(), targets.f(), props.who(), props.nova());
    }
```

- [ ] **Step 4: Use it in `scoreMeal`**

Replace the local `tp/tc/tf/who/nova` block in `scoreMeal` (`:95-108`) with:

```java
        Rubric rubric = rubricFor(role);
        int tp = rubric.p();
        int tc = rubric.c();
        int tf = rubric.f();
        MealScoringProperties.WhoRefs who = rubric.who();
        MealScoringProperties.NovaGroupScores nova = rubric.nova();
```

Leave the rest of `scoreMeal` untouched.

- [ ] **Step 5: Make the template surface role-aware**

Replace the `recipeFit` / `recipeTemplateBreakdown` signatures and their target/who/nova usage:

```java
    /** Backward-compatible entry: the context-free template fit under the STANDARD rubric. */
    public BigDecimal recipeFit(String slot, List<ScoredLine> perServingLines) {
        return recipeFit(slot, perServingLines, MealRole.STANDARD);
    }

    public BigDecimal recipeFit(String slot, List<ScoredLine> perServingLines, MealRole role) {
        MealBreakdownJson breakdown = recipeTemplateBreakdown(slot, perServingLines, role);
        return breakdown == null ? null : breakdown.value();
    }

    /** Backward-compatible entry: the template envelope under the STANDARD rubric. */
    public MealBreakdownJson recipeTemplateBreakdown(String slot, List<ScoredLine> perServingLines) {
        return recipeTemplateBreakdown(slot, perServingLines, MealRole.STANDARD);
    }
```

and in the 3-arg body (the existing method, now taking `MealRole role`) replace the `live` list's rubric arguments:

```java
        Rubric rubric = rubricFor(role);
        List<Dim> live = List.of(
            macroDim(perServingLines, kcal, rubric.p(), rubric.c(), rubric.f()),
            microDim(perServingLines, kcal), whoDim(perServingLines, kcal, rubric.who()),
            fatQualityDim(perServingLines, kcal),
            novaDim(perServingLines, kcal, rubric.nova()), plantDiversityDim(perServingLines, kcal),
            energyDensityDim(perServingLines, kcal), portionDim(slot, kcal));
```

Keep `portionDim(slot, kcal)` role-independent (spec §4). Update the method's javadoc to say the role selects the rubric overlay and that portion stays role-independent.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`
Expected: PASS, all tests in the class (the pre-existing `scoreMeal` role tests must stay green — they prove the extraction changed nothing).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git -c core.hooksPath=/dev/null commit -m "feat(nutrition): role-aware recipe template scoring via one shared rubric overlay (mezo-uavr)"
```

---

### Task 4: Wire the recipe's role into both read paths

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java:81` (`withFit`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownService.java:49-50`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`

**Interfaces:**
- Consumes: `RecipeEntity.getRole()` (Task 2), the 3-arg scorer entries (Task 3).
- Produces: `mezoFit.score` and `GET /api/recipe/{id}/breakdown` now reflect the recipe's role.

- [ ] **Step 1: Write the failing test**

Append to `RecipeApiIT`:

```java
    @Test
    void testListRecipes_shouldScorePreWorkoutHigher_whenSameFoodStoredWithDifferentRoles() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID honey = createFood(auth, "Méz", "300", "0", "80", "0");

        RecipeRequest std = new RecipeRequest();
        std.setName("Mézes standard");
        std.setCategory("breakfast");
        std.setServings(1);
        std.setIngredients(List.of(line(honey, "60")));
        RecipeResponse standard =
            postForBody("/api/recipe", std, auth, HttpStatus.CREATED, RecipeResponse.class);

        RecipeRequest pre = new RecipeRequest();
        pre.setName("Mézes pre");
        pre.setCategory("breakfast");
        pre.setServings(1);
        pre.setIngredients(List.of(line(honey, "60")));
        pre.setRole("pre_workout");
        RecipeResponse preWorkout =
            postForBody("/api/recipe", pre, auth, HttpStatus.CREATED, RecipeResponse.class);

        RecipeListResponse list =
            getForBody("/api/recipe", auth, HttpStatus.OK, RecipeListResponse.class);
        BigDecimal stdScore = fitOf(list, standard.getId());
        BigDecimal preScore = fitOf(list, preWorkout.getId());

        assertThat(preScore).isGreaterThan(stdScore);
    }

    private static BigDecimal fitOf(RecipeListResponse list, UUID id) {
        return list.getRecipes().stream()
            .filter(r -> r.getId().equals(id))
            .findFirst().orElseThrow()
            .getMezoFit().getScore();
    }
```

Use whatever GET helper `ApiIntegrationTest` exposes (`getForBody` or the file's existing idiom — check the class before writing).

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeApiIT -DargLine=-Xmx3g`
Expected: FAIL — the two scores are equal (the role is ignored by the fit).

- [ ] **Step 3: Pass the role into the fit**

`RecipeService.withFit`, replace the `setScore` line:

```java
        resp.getMezoFit().setScore(
            scoringService.recipeFit(e.getCategory(), fitLines(e, pantryById), e.getRole()));
```

- [ ] **Step 4: Pass the role into the breakdown**

`RecipeBreakdownService.getOrGenerate`, replace the `fresh` assignment:

```java
        MealBreakdownJson fresh = scoringService.recipeTemplateBreakdown(recipe.getCategory(),
            recipeService.fitLines(recipe, recipeService.pantryByIdFor(List.of(recipe))),
            recipe.getRole());
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeApiIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Add the cache-invalidation test**

Append to `RecipeBreakdownApiIT` (it already has the fake-LLM sentinel setup and a `RecipeRepository` autowired):

```java
    @Test
    void testGetBreakdown_shouldRegenerateEnvelope_whenOnlyTheRoleChanged() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Méz", "300");
        RecipeRequest req = recipeReq(SENTINEL_NAME, food);
        RecipeResponse created =
            postForBody("/api/recipe", req, auth, HttpStatus.CREATED, RecipeResponse.class);

        RecipeBreakdownResponse first = getForBody("/api/recipe/" + created.getId() + "/breakdown",
            auth, HttpStatus.OK, RecipeBreakdownResponse.class);
        assertThat(recipeRepository.findById(created.getId()).orElseThrow().getBreakdown()).isNotNull();

        req.setRole("pre_workout");
        put("/api/recipe/" + created.getId(), req, auth, HttpStatus.NO_CONTENT);

        assertThat(recipeRepository.findById(created.getId()).orElseThrow().getBreakdown()).isNull();

        RecipeBreakdownResponse second = getForBody("/api/recipe/" + created.getId() + "/breakdown",
            auth, HttpStatus.OK, RecipeBreakdownResponse.class);
        assertThat(second.getBreakdown().getValue())
            .isGreaterThan(first.getBreakdown().getValue());
    }
```

Adapt the HTTP helper names to whatever `ApiIntegrationTest` actually exposes (read `backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java` first) and `recipeReq(...)` to the file's existing factory signature.

- [ ] **Step 7: Run it**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeBreakdownApiIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git -c core.hooksPath=/dev/null commit -m "feat(recipe): score the template under the recipe's own role (mezo-uavr)"
```

---

### Task 5: The AI prose must know the role

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java` (`SYSTEM_PROMPT` `:33-59`, `userMessage` `:108-126`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownProseServiceTest.java`

**Interfaces:**
- Consumes: `RecipeEntity.getRole()` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing unit test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownProseServiceTest.java`:

```java
package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.service.RecipeBreakdownProseService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Pure prompt-assembly test (no Spring, no LLM): the role must reach the model. */
class RecipeBreakdownProseServiceTest {

    private final RecipeBreakdownProseService service = new RecipeBreakdownProseService(null, null);

    private RecipeEntity recipe(MealRole role) {
        RecipeEntity e = new RecipeEntity();
        e.setName("PB Banana Toast");
        e.setCategory("breakfast");
        e.setServings(1);
        e.setRole(role);
        e.setLines(List.of());
        return e;
    }

    private MealBreakdownJson envelope() {
        return new MealBreakdownJson(new BigDecimal("0.60"), new BigDecimal("0.80"), null, null,
            List.of(), List.of(), List.of());
    }

    @Test
    void testUserMessage_shouldNameTheFuelRole_whenRecipeIsPreWorkout() {
        String msg = service.userMessage(recipe(MealRole.PRE_WORKOUT), envelope());

        assertThat(msg).contains("edzés előtti");
    }

    @Test
    void testUserMessage_shouldNameTheRecoveryRole_whenRecipeIsPostWorkout() {
        assertThat(service.userMessage(recipe(MealRole.POST_WORKOUT), envelope()))
            .contains("edzés utáni");
    }

    @Test
    void testUserMessage_shouldNotClaimATrainingRole_whenRecipeIsStandard() {
        String msg = service.userMessage(recipe(MealRole.STANDARD), envelope());

        assertThat(msg).doesNotContain("edzés előtti").doesNotContain("edzés utáni");
    }
}
```

If `RecipeEntity.setLines(List.of())` rejects an immutable list, use `new ArrayList<>()`.

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeBreakdownProseServiceTest -DargLine=-Xmx3g`
Expected: FAIL — `userMessage` is private.

- [ ] **Step 3: Make the prompt role-aware**

In `RecipeBreakdownProseService`, change `private String userMessage(...)` to package-private `String userMessage(...)` (add a comment: *"package-private for the prompt-assembly unit test"*), and insert the role line right after the `RECEPT:` header block:

```java
        String roleNote = switch (recipe.getRole() == null ? MealRole.STANDARD : recipe.getRole()) {
            case PRE_WORKOUT -> "SZEREP: edzés előtti üzemanyag. A gyors szénhidrát és a cukor itt "
                + "CÉL, nem hiba — a pontozás már ezzel a rubrikával számolt. Ne ródd fel a cukrot "
                + "vagy a feldolgozottságot, magyarázd, miért jó üzemanyag.\n";
            case POST_WORKOUT -> "SZEREP: edzés utáni regeneráció. A fehérje + gyors szénhidrát itt "
                + "CÉL (glikogén-pótlás) — a pontozás már ezzel a rubrikával számolt. A magasabb "
                + "cukrot ne ródd fel hibaként.\n";
            case STANDARD -> "SZEREP: általános étkezés — a standard (WHO-igazodó) rubrika szerint "
                + "pontozva.\n";
        };
        sb.append(roleNote);
```

Add the import `io.mrkuhne.mezo.feature.nutrition.service.MealRole`.

Also append one line to `SYSTEM_PROMPT`, directly before the closing `"""`:

```
        - A SZEREP sor megmondja, milyen rubrikával pontozott a motor. Ha edzés előtti/utáni
          szerep van megadva, a gyors szénhidrát és a magasabb cukor SZÁNDÉKOS — sose írd hibának.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RecipeBreakdownProseServiceTest -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 5: Re-run the breakdown ITs (no prompt regression)**

Run: `cd backend && ./mvnw clean test -Dtest='RecipeBreakdown*IT' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git -c core.hooksPath=/dev/null commit -m "feat(recipe): the template prose prompt knows the meal role (mezo-uavr)"
```

---

### Task 6: Frontend data layer — types, API mapping, mock seed

**Files:**
- Modify: `frontend/src/data/types.ts:257-280` (`Recipe`, `RecipeInput`)
- Modify: `frontend/src/data/fuel/recipeApi.ts` (`toRequest`, `fromResponse`)
- Modify: `frontend/src/data/fuel/recipeHooks.ts` (`buildRecipe`)
- Modify: `frontend/src/data/fuel/pantry.ts` (the `recipesBase` seed entries)
- Test: `frontend/src/data/fuel/recipeApi.test.ts`, `frontend/src/data/fuel/recipeHooks.test.tsx`

**Interfaces:**
- Consumes: the generated `RecipeRequest.role` / `RecipeResponse.role` (Task 1).
- Produces:
  - `export type RecipeRole = 'standard' | 'pre_workout' | 'post_workout'` in `data/types.ts`
  - `Recipe.role: RecipeRole` (always present) and `RecipeInput.role: RecipeRole` (required — the editor always sends one).

- [ ] **Step 1: Write the failing API-mapping tests**

In `frontend/src/data/fuel/recipeApi.test.ts`, add `role: 'pre_workout'` to the `input` fixture and to `apiRecipe`, then append:

```ts
describe('role mapping', () => {
  it('carries the role into the request', () => {
    expect(toRequest({ ...input, role: 'pre_workout' }).role).toBe('pre_workout')
  })

  it('reads the role off the response', () => {
    expect(fromResponse({ ...apiRecipe, role: 'post_workout' } as never).role).toBe('post_workout')
  })

  it('falls back to standard when the response omits the role', () => {
    const { role: _role, ...withoutRole } = apiRecipe as Record<string, unknown>
    expect(fromResponse(withoutRole as never).role).toBe('standard')
  })
})
```

Import `fromResponse` alongside the existing `toRequest` import.

- [ ] **Step 2: Run and watch it fail**

Run: `cd frontend && pnpm test recipeApi`
Expected: FAIL (type error / `undefined` role).

- [ ] **Step 3: Add the types**

In `frontend/src/data/types.ts`, above `export interface Recipe`:

```ts
/** Template meal role (mezo-uavr) — selects the scoring rubric overlay on the recipe surface. */
export type RecipeRole = 'standard' | 'pre_workout' | 'post_workout'
```

Add `role: RecipeRole` to `Recipe` (after `starred`) and `role: RecipeRole` to `RecipeInput` (after `starred`).

- [ ] **Step 4: Map both directions**

In `recipeApi.ts` `toRequest`, after `starred: input.starred,`:

```ts
    role: input.role,
```

In `fromResponse`, after `starred: r.starred,`:

```ts
    // `standard` fallback keeps a pre-role backend response (or a hand-written fixture) valid.
    role: (r.role as Recipe['role']) ?? 'standard',
```

- [ ] **Step 5: Carry the role through the mock write path**

In `recipeHooks.ts` `buildRecipe`, after `starred: input.starred,`:

```ts
    role: input.role,
```

- [ ] **Step 6: Seed the mock recipes**

In `frontend/src/data/fuel/pantry.ts`, give every entry of the recipe seed array (`recipesBase`) an explicit `role`. Set `role: 'standard'` on all of them EXCEPT one clearly pre-workout-shaped recipe, which gets `role: 'pre_workout'` — pick the first breakfast/snack entry whose macros are carb-dominant, so mock mode exercises the non-standard chip. If TypeScript complains that `recipesBase` is typed as something other than `Recipe[]`, add the field where the type demands it and let `pnpm build` be the judge.

- [ ] **Step 7: Run the tests**

Run: `cd frontend && pnpm test recipeApi recipeHooks && VITE_USE_MOCK=true pnpm test recipeApi recipeHooks`
Expected: PASS in both modes.

- [ ] **Step 8: Typecheck**

Run: `cd frontend && pnpm build`
Expected: PASS (this catches every remaining place that constructs a `Recipe` or `RecipeInput` without `role` — fix each by threading the real value, never by casting).

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): recipe role in the FE data layer (mezo-uavr)"
```

---

### Task 7: Editor — the „Szerep" control, and `recipeToInput` must preserve it

**Files:**
- Create: `frontend/src/features/fuel/logic/recipeRole.ts`
- Create: `frontend/src/features/fuel/logic/recipeRole.test.ts`
- Modify: `frontend/src/features/fuel/pages/RecipeEditorPage.tsx` (SLOT card block ~`:222-236`, `save()` ~`:167-179`, state ~`:110`)
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` (`recipeToInput` `:38-50`)
- Test: `frontend/src/features/fuel/pages/RecipeEditorPage.test.tsx`, `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`

**Interfaces:**
- Consumes: `RecipeRole`, `RecipeInput.role` (Task 6).
- Produces: `ROLE_OPTIONS: { id: RecipeRole; label: string }[]` and `roleLabel(role: RecipeRole): string` from `@/features/fuel/logic/recipeRole` — Task 8 renders these labels.

- [ ] **Step 1: Write the failing label-module test**

Create `frontend/src/features/fuel/logic/recipeRole.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ROLE_OPTIONS, roleLabel } from '@/features/fuel/logic/recipeRole'

describe('recipeRole', () => {
  it('labels every role in Hungarian', () => {
    expect(roleLabel('standard')).toBe('Általános')
    expect(roleLabel('pre_workout')).toBe('Edzés előtt')
    expect(roleLabel('post_workout')).toBe('Edzés után')
  })

  it('offers the three roles in order', () => {
    expect(ROLE_OPTIONS.map(o => o.id)).toEqual(['standard', 'pre_workout', 'post_workout'])
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd frontend && pnpm test recipeRole`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `frontend/src/features/fuel/logic/recipeRole.ts`:

```ts
import type { RecipeRole } from '@/data/types'

/** HU copy for the recipe's template meal role (mezo-uavr) — the single source of truth for the
 *  editor segments, the detail chip and the library card tag. */
const LABELS: Record<RecipeRole, string> = {
  standard: 'Általános',
  pre_workout: 'Edzés előtt',
  post_workout: 'Edzés után',
}

export const ROLE_OPTIONS: { id: RecipeRole; label: string }[] = [
  { id: 'standard', label: LABELS.standard },
  { id: 'pre_workout', label: LABELS.pre_workout },
  { id: 'post_workout', label: LABELS.post_workout },
]

export function roleLabel(role: RecipeRole): string {
  return LABELS[role] ?? LABELS.standard
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && pnpm test recipeRole`
Expected: PASS.

- [ ] **Step 5: Write the failing editor + recipeToInput tests**

In `RecipeEditorPage.test.tsx`, append (adapt the render helper to the file's existing one):

```tsx
  it('saves the picked role', async () => {
    renderEditor()   // the file's existing new-recipe render helper
    // fill the minimum required fields exactly as the file's existing save test does
    await userEvent.click(screen.getByRole('button', { name: 'Edzés előtt' }))
    // ...trigger save the same way the existing test does...
    // then assert the captured input:
    expect(savedInput.role).toBe('pre_workout')
  })
```

Follow the file's established mocking/capture idiom for `useRecipeActions` — do NOT invent a new one; read the existing save test first and mirror it.

In `RecipeDetailPage.test.tsx`, append:

```tsx
  it('preserves the role through recipeToInput', () => {
    const r = { ...someRecipeFixture, role: 'pre_workout' as const }
    expect(recipeToInput(r).role).toBe('pre_workout')
  })
```

Import `recipeToInput` from `@/features/fuel/pages/RecipeDetailPage`, and build the fixture from whatever the file already has (or from `mockRecipes[0]`).

- [ ] **Step 6: Run and watch them fail**

Run: `cd frontend && pnpm test RecipeEditorPage RecipeDetailPage`
Expected: FAIL.

- [ ] **Step 7: Add the role to `recipeToInput`**

In `RecipeDetailPage.tsx`, inside `recipeToInput`, after `starred: r.starred,`:

```ts
    // MUST be carried: the star toggle round-trips this input, and a missing role would
    // silently reset a pre-workout recipe to Általános (mezo-uavr).
    role: r.role,
```

- [ ] **Step 8: Add the editor control**

In `RecipeEditorPage.tsx`:

1. Import: `import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'` and add `RecipeRole` to the `@/data/types` type import.
2. State, next to the `slot`/`starred` state (~`:110`):

```tsx
  const [role, setRole] = useState<RecipeRole>(() => editing?.role ?? 'standard')
```

3. In `save()`, add `role,` to the `input` object (after `starred,`).
4. Render a new card directly BELOW the existing SLOT card (mirroring its markup exactly):

```tsx
        <div className="card" style={{ padding: '10px 12px', marginBottom: 9 }}>
          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>SZEREP</span>
          <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
            {ROLE_OPTIONS.map(o => (
              <button key={o.id} onClick={() => setRole(o.id)} className={'chip' + (role === o.id ? ' brand' : '')} style={{ fontSize: 9, padding: '6px 10px' }}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-tertiary" style={{ fontSize: 10, marginTop: 7, lineHeight: 1.4 }}>
            A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors szénhidrát üzemanyag, nem hiba.
          </p>
        </div>
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd frontend && pnpm test RecipeEditorPage RecipeDetailPage && VITE_USE_MOCK=true pnpm test RecipeEditorPage RecipeDetailPage`
Expected: PASS in both modes.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): pick a recipe's meal role in the editor (mezo-uavr)"
```

---

### Task 8: Surface the role — detail hero chip, score-section rubric label, library card tag

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` (meta line `:170`, PONTSZÁM header `:228-232`)
- Modify: `frontend/src/features/fuel/components/RecipeCard.tsx` (the top-left slot tag block ~`:29-35`)
- Test: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`, `frontend/src/features/fuel/pages/FuelRecipesPage.test.tsx`

**Interfaces:**
- Consumes: `roleLabel` (Task 7), `Recipe.role` (Task 6).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

In `RecipeDetailPage.test.tsx`:

```tsx
  it('shows the role chip for a non-standard recipe', async () => {
    renderDetail({ ...someRecipeFixture, role: 'pre_workout' })   // the file's render helper
    expect(await screen.findByText('Edzés előtt')).toBeInTheDocument()
  })

  it('shows no role chip for a standard recipe', async () => {
    renderDetail({ ...someRecipeFixture, role: 'standard' })
    expect(screen.queryByText('Edzés előtt')).not.toBeInTheDocument()
    expect(screen.queryByText('Általános')).not.toBeInTheDocument()
  })
```

Mirror the file's existing render/fixture idiom instead of inventing one.

- [ ] **Step 2: Run and watch them fail**

Run: `cd frontend && pnpm test RecipeDetailPage`
Expected: FAIL.

- [ ] **Step 3: Add the hero chip**

In `RecipeDetailPage.tsx`, import `roleLabel` from `@/features/fuel/logic/recipeRole`, and extend the meta line (`:170`) so a non-standard role is appended as a colored segment:

```tsx
            {recipe.servings} adag · {totalMins} perc · <span style={{ color: NOVA_COLOR[recipe.novaDominant], fontWeight: 600 }}>NOVA {recipe.novaDominant}</span>
            {recipe.role !== 'standard' && (
              <> · <span style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>{roleLabel(recipe.role)}</span></>
            )} · létrehozva {recipe.createdDate}
```

- [ ] **Step 4: Name the rubric in the score section**

Directly under the `PONTSZÁM` label row (`:228-232`), inside the same header block, add:

```tsx
                {recipe.role !== 'standard' && (
                  <span className="text-tertiary" style={{ fontSize: 10 }}>
                    {roleLabel(recipe.role).toLowerCase()} mérce szerint
                  </span>
                )}
```

Place it so it reads as part of the existing `{n} szempont · megbízh. {c}%` meta row (append to that row's content rather than creating a new block if that is how the markup is shaped).

- [ ] **Step 5: Add the library card tag**

In `RecipeCard.tsx`, next to the existing slot tag, render the role tag only when non-standard:

```tsx
          {recipe.role !== 'standard' && (
            <span className="chip" style={{ fontSize: 8, padding: '3px 6px', color: 'var(--coral-deep)' }}>
              {roleLabel(recipe.role)}
            </span>
          )}
```

Import `roleLabel` from `@/features/fuel/logic/recipeRole`. Match the surrounding tag's class/style conventions rather than copying blindly if they differ.

- [ ] **Step 6: Run the tests**

Run: `cd frontend && pnpm test RecipeDetailPage FuelRecipesPage && VITE_USE_MOCK=true pnpm test RecipeDetailPage FuelRecipesPage`
Expected: PASS in both modes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): label a recipe's meal role on the detail + library surfaces (mezo-uavr)"
```

---

### Task 9: Visible re-evaluation — `refreshing` flag + honest twinkle copy

**Files:**
- Modify: `frontend/src/data/fuel/recipeHooks.ts:57-81` (`useRecipeBreakdown`)
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx:105` + the twinkle block `:197-204` and the three `!breakdownPending &&` guards (`:205`, `:225`, `:239`)
- Test: `frontend/src/data/fuel/recipeHooks.test.tsx`, `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useRecipeBreakdown(id)` now returns `{ breakdown, fitsFor, pending, refreshing }`.

- [ ] **Step 1: Write the failing hook test**

In `frontend/src/data/fuel/recipeHooks.test.tsx`, inside the existing `useRecipeBreakdown (mock mode)` describe:

```tsx
  it('never reports refreshing in mock mode', async () => {
    const { result } = renderHook(() => useRecipeBreakdown('rec-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.breakdown).toBeTruthy())
    expect(result.current.refreshing).toBe(false)
  })
```

And in the real-mode describe, a test that the flag exists and settles false once resolved:

```tsx
  it('settles refreshing to false once the breakdown resolves', async () => {
    const { result } = renderHook(() => useRecipeBreakdown('r1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.refreshing).toBe(false)
  })
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd frontend && pnpm test recipeHooks`
Expected: FAIL — `refreshing` is `undefined`.

- [ ] **Step 3: Expose `refreshing`**

In `useRecipeBreakdown`, extend the destructure and the return type/value:

```ts
  const { data, isPending, isFetching } = useQuery({ /* unchanged */ })
  return {
    breakdown: data?.breakdown ?? null,
    fitsFor: data?.fitsFor ?? [],
    pending: !mock && isPending,
    // A background regeneration (edit / role change / pantry macro drift invalidated the query):
    // data is still the PRE-edit envelope, so the page must not render it as current (mezo-uavr).
    refreshing: !mock && isFetching && !isPending,
  }
```

Update the declared return type accordingly and extend the doc comment.

- [ ] **Step 4: Run the hook tests**

Run: `cd frontend && pnpm test recipeHooks && VITE_USE_MOCK=true pnpm test recipeHooks`
Expected: PASS.

- [ ] **Step 5: Write the failing page test**

In `RecipeDetailPage.test.tsx`, add a real-mode test that a slow breakdown refetch renders the re-evaluating copy. Use the file's MSW idiom; if the file has no real-mode harness, assert the simpler contract instead: with the msw handler delayed, `Mezo értékeli a receptet…` appears on first load. Then add:

```tsx
  it('renders the re-evaluating copy instead of stale prose while refetching', async () => {
    // arrange: resolve the breakdown once, then invalidate ['recipeBreakdown'] with a delayed handler
    // assert: screen.getByText('Mezo újraértékeli a receptet…') is present
    //         and the previously rendered summary text is gone
  })
```

Write it concretely against the file's existing helpers — a test whose body is a comment is not acceptable; if the harness genuinely cannot drive a refetch, cover it at the hook level instead (a `qc.invalidateQueries` + `waitFor(() => expect(result.current.refreshing).toBe(true))` in `recipeHooks.test.tsx`) and state that in the commit body.

- [ ] **Step 6: Wire the page**

In `RecipeDetailPage.tsx`:

```tsx
  const { breakdown, fitsFor, pending: breakdownPending, refreshing: breakdownRefreshing } = useRecipeBreakdown(id ?? '')
  // One gate for both: a first generate and a background regeneration must both hide the
  // (stale-or-absent) prose rather than render a pre-edit reading as current (mezo-uavr).
  const breakdownBusy = breakdownPending || breakdownRefreshing
```

Replace every `breakdownPending` usage in the JSX with `breakdownBusy`, and make the twinkle copy conditional:

```tsx
              <span className="text-tertiary" style={{ fontSize: 11.5 }}>
                {breakdownRefreshing ? 'Mezo újraértékeli a receptet…' : 'Mezo értékeli a receptet…'}
              </span>
```

- [ ] **Step 7: Run the tests**

Run: `cd frontend && pnpm test RecipeDetailPage recipeHooks && VITE_USE_MOCK=true pnpm test RecipeDetailPage recipeHooks`
Expected: PASS in both modes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): show that Mezo is re-evaluating a recipe instead of stale prose (mezo-uavr)"
```

---

### Task 10: Full gate + living docs

**Files:**
- Modify: `docs/features/fuel.md` (the intro paragraph's recipe-breakdown sentence, §2 `RecipeDetailPage` + `RecipeEditorPage` + `"Receptek"` paragraphs, and the `updated:` frontmatter date)
- Test: the whole frontend suite in both modes + the touched backend tests

**Interfaces:**
- Consumes: everything.
- Produces: a green, documented branch ready for the PR.

- [ ] **Step 1: Run the full frontend gate**

Run:
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build + both test modes PASS. Fix anything red before continuing.

- [ ] **Step 2: Run the touched backend tests**

Run:
```bash
cd backend && ./mvnw clean test -Dtest='MealScoringServiceTest,RecipeMapperTest,RecipeBreakdownProseServiceTest,RecipeApiIT,RecipeBreakdownApiIT,RecipeBreakdownFallbackApiIT,RecipeServiceIT' -DargLine=-Xmx3g
```
Expected: PASS. (The full suite is CI's job — do not run it locally.)

- [ ] **Step 3: Update the feature doc**

In `docs/features/fuel.md`:
- Set `updated: 2026-07-27` in the frontmatter.
- In the intro paragraph, extend the recipe AI-breakdown sentence: the template surface is now scored under the recipe's own **meal role** (`role`, mezo-uavr) — the same `mezo.fuel.scoring.roles` overlay the logged surface uses (`standard` = identity ⇒ zero regression); the prose prompt carries the role; the logged-meal surface is untouched (its role still comes from the training windows).
- In the `"Receptek"` / `RecipeDetailPage` / `RecipeEditorPage` paragraphs, describe: the editor's SZEREP segmented row, the non-standard role chip on the detail meta line + the library card tag, the rubric note in the PONTSZÁM header, and the new „Mezo újraértékeli a receptet…" state (`refreshing = isFetching && !isPending`) that replaces stale prose after an edit/role change/pantry drift.
- Add `role` to the key-files-adjacent prose where the recipe contract is described.

Overwrite in place — no changelog, no dated snapshot (the docs policy in CLAUDE.md).

- [ ] **Step 4: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: no errors for `docs/features/fuel.md` (staleness flag cleared).

- [ ] **Step 5: Commit**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(fuel): recipe meal role + visible re-evaluation (mezo-uavr)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §3 role field on the recipe (default standard) | 1, 2 |
| §4 rubric overlay reuse + `rubricFor` extraction + portion stays role-independent | 3 |
| §4 both read paths use the role | 4 |
| §5 prose knows the role | 5 |
| §6 cache invalidation on role change | 4 (Step 6 test — the mechanism already exists) |
| §7 contract shape + snake_case wire + mapper-only conversion | 1, 2 |
| §8 editor control, `recipeToInput`, detail chip, card tag, mock seed | 6, 7, 8 |
| §9 `refreshing` + twinkle copy | 9 |
| §10 testing (unit + IT + FE both modes) | 3, 4, 5, 6, 7, 8, 9, 10 |
| §11 out of scope | nothing implements them — no task adds a force param, a filter, or touches the logged surface |

**Type consistency:** `RecipeRole` (FE union, snake_case values) ↔ `MealRole` (Java enum) ↔ wire string — converted only in `RecipeMapper` (Task 2) and `recipeApi` (Task 6). `roleLabel` / `ROLE_OPTIONS` are defined in Task 7 and consumed in Task 8 under those exact names. `recipeTemplateBreakdown` / `recipeFit` keep their names in every task that calls them. `refreshing` is the flag name in both the hook (Task 9 Step 3) and the page (Step 6).
