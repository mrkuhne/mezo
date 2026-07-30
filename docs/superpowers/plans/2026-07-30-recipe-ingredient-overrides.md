# Recipe Ingredient Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user adjust individual ingredient amounts while logging a recipe, so the stored macros and the mezo score reflect the meal as actually eaten.

**Architecture:** A nullable `meal_item.recipe_overrides` jsonb carries only the changed lines, keyed by `lineOrder` with `pantryItemId` as a consistency check. One `meal_item` per recipe is preserved. The write path resolves the overrides into a `Map<Integer, BigDecimal>` that feeds **all three** derived values — the frozen macro snapshot, `recipeFacts()`, and `snapshotNova`. The macro arithmetic is never re-derived: `RecipeMapper` grows an override-aware rollup and the existing no-override path delegates to it.

**Tech Stack:** Java 21 / Spring Boot 4 / Hibernate / Liquibase / MapStruct · React 19 / TypeScript / Vitest · OpenAPI contract-first (`api/feature/*.yml`).

**Spec:** `docs/superpowers/specs/2026-07-30-recipe-ingredient-overrides-design.md`

## Global Constraints

- **Driving bd issue:** `mezo-ormb`. Every commit subject ends with `(mezo-ormb)`.
- **Base package:** `io.mrkuhne.mezo`. Primary keys are `UUID`.
- **Contract-first:** edit `api/feature/meal/meal.yml` BEFORE any Java or TS that uses the new fields. Never hand-write boundary DTOs.
- **No `git add -A`.** The beads pre-commit hook force-stages a stray root `issues.jsonl`. Always `git add <explicit paths>` then `git commit --no-verify`.
- **Never run the full backend suite** (`./mvnw clean test` with no `-Dtest`) — this machine OOMs. Always the focused form given in each task, always with `clean`, always as its own foreground Bash call with `timeout: 600000`.
- **Never run `pnpm test:visual`** and never regenerate Playwright goldens. No golden opens `LogMealSheet`; CI gates the linux baselines.
- **Frontend must be green in BOTH modes:** `pnpm test <pattern>` and `VITE_USE_MOCK=true pnpm test <pattern>`.
- **Rounding is load-bearing (mezo-8xy).** Per-line: `round(snapshot × amount / snapshotPer)` HALF_UP, rounded **per line then summed**. Per-serving: `whole ÷ servings` at **scale 6, UNROUNDED**. Reuse the existing helpers; do not re-derive.
- **`lineOrder` is a 0-based contiguous index** (`RecipeService.rebuildLines` sets it to the loop index; `@OrderBy("lineOrder")` keeps `recipe.getLines()` aligned). Resolve a line by **matching `getLineOrder()`**, not by list position.
- **Error contract:** every rejection is `SystemMessage.field("VALIDATION_INVALID_VALUE", "items")` + `HttpStatus.BAD_REQUEST` — reuse the existing private `invalidItems()` in `MealService`. Never a silent skip.
- **Do NOT write to the coordinator's ledger** (`.superpowers/sdd/**/progress.md`).
- **Working directory is the worktree** `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/pull-latest-app-version-fdf9f4`. Verify with `git rev-parse --show-toplevel` before committing; never touch `/Users/daniel.kuhne/MrKuhne/mezo`.

## File Structure

| File | Responsibility |
|---|---|
| `api/feature/meal/meal.yml` | +`MealIngredientOverrideRequest`, +`MealIngredientOverrideResponse`, +`ingredientOverrides` on `MealItemRequest`/`MealItemResponse` |
| `backend/.../db/changelog/1.0.0/script/202607301200_mezo-ormb_meal_item_recipe_overrides.sql` | additive `alter table meal_item add column recipe_overrides jsonb` |
| `backend/.../db/changelog/1.0.0/1.0.0_master.yml` | changeset entry |
| `backend/.../feature/meal/entity/MealItemRecipeOverrideJson.java` | **new** typed jsonb envelope record |
| `backend/.../feature/meal/entity/MealItemEntity.java` | +`recipeOverrides` field |
| `backend/.../feature/recipe/mapper/RecipeMapper.java` | +`contributionWithAmount`, +`rollupWithOverrides` — the single formula |
| `backend/.../feature/meal/service/MealService.java` | override validation, envelope build, snapshot from the overridden set, override-aware `recipeFacts` + NOVA |
| `backend/.../feature/meal/mapper/MealMapper.java` | project the envelope onto `MealItemResponse` |
| `frontend/src/data/types.ts` | +`MealIngredientOverrideInput`, +`ingredientOverrides` on `MealRefInputItem` |
| `frontend/src/data/fuel/mealApi.ts` | map overrides onto the request body |
| `frontend/src/data/fuel/recipeMacros.ts` | +`computeRecipeMacrosWithOverrides` — the FE single formula |
| `frontend/src/data/fuel/fuelHooks.ts` | mock-mode `buildLine` recipe arm honours overrides |
| `frontend/src/features/fuel/sheets/LogMealSheet.tsx` | the inline ingredient editor |
| `frontend/src/features/fuel/components/RecipeOverrideRow.tsx` | **new** one editable ingredient row |
| `docs/features/fuel.md` | §2 / §4 / §9 / §10 |

---

### Task 1: Contract — `ingredientOverrides` on the meal item

**Files:**
- Modify: `api/feature/meal/meal.yml` (schemas block, near `MealItemRequest` at :271)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: generated Java DTOs `MealIngredientOverrideRequest` (getters `getLineOrder(): Integer`, `getPantryItemId(): UUID`, `getAmount(): BigDecimal`) and `MealIngredientOverrideResponse` (adds `getName(): String`, `getUnit(): String`, `getOriginalAmount(): BigDecimal`); `MealItemRequest.getIngredientOverrides(): List<MealIngredientOverrideRequest>`; `MealItemResponse` builder method `.ingredientOverrides(List<MealIngredientOverrideResponse>)`. TS type `components['schemas']['MealItemRequest']` gains the optional array.

- [ ] **Step 1: Add the two schemas**

In `api/feature/meal/meal.yml`, in the `schemas:` block immediately **before** `MealItemRequest:`, add:

```yaml
    MealIngredientOverrideRequest:
      type: object
      description: >-
        One recipe ingredient logged at an amount other than the recipe's. Keyed by lineOrder;
        pantryItemId is a consistency check (recipe_ingredient has no unique (recipe_id,
        pantry_item_id), so pantryItemId alone is ambiguous, and lineOrder alone would silently
        mis-apply after a reorder). amount 0 means the line was left out.
      required: [lineOrder, pantryItemId, amount]
      properties:
        lineOrder:    { type: integer, minimum: 0 }
        pantryItemId: { type: string, format: uuid }
        amount:       { type: number, minimum: 0 }
    MealIngredientOverrideResponse:
      type: object
      required: [lineOrder, pantryItemId, name, unit, originalAmount, amount]
      properties:
        lineOrder:      { type: integer }
        pantryItemId:   { type: string, format: uuid }
        name:           { type: string }
        unit:           { type: string }
        originalAmount: { type: number }
        amount:         { type: number }
```

- [ ] **Step 2: Wire them onto the item schemas**

In `MealItemRequest.properties`, after the `nova:` line, add:

```yaml
        # recipe arm only (mezo-ormb): per-ingredient amount overrides. Absent/null == the recipe as written.
        ingredientOverrides:
          type: array
          nullable: true
          items: { $ref: '#/components/schemas/MealIngredientOverrideRequest' }
```

In `MealItemResponse.properties`, after the `contribution:` line, add:

```yaml
        ingredientOverrides:
          type: array
          nullable: true
          items: { $ref: '#/components/schemas/MealIngredientOverrideResponse' }
```

Do **not** add either field to the `required` list of `MealItemRequest`/`MealItemResponse`.

- [ ] **Step 3: Regenerate and verify no drift**

Run each as its own foreground call:

```bash
cd api/generate && npm run generate:api
```
```bash
cd frontend && pnpm generate:api
```
```bash
cd frontend && pnpm build
```
Expected: all three succeed; `git status` shows `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` modified.

- [ ] **Step 4: Confirm the generated Java DTO compiles**

```bash
cd backend && ./mvnw -q clean generate-sources
```
Expected: BUILD SUCCESS. Then confirm the class exists:
```bash
ls backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealIngredientOverrideRequest.java
```
Expected: the path prints (if the generated-sources root differs, locate it with `find backend/target -name 'MealIngredientOverrideRequest.java'` and report the actual path in your summary).

- [ ] **Step 5: Commit**

```bash
git add api/feature/meal/meal.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(api): ingredientOverrides on the meal item contract (mezo-ormb)"
```

---

### Task 2: Persistence — migration, jsonb record, entity field

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607301200_mezo-ormb_meal_item_recipe_overrides.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at the end)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemRecipeOverrideJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealItemRecipeOverridesIT.java` (new)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `MealItemRecipeOverrideJson(Integer lineOrder, UUID pantryItemId, String name, String unit, BigDecimal originalAmount, BigDecimal amount)`; `MealItemEntity.getRecipeOverrides(): List<MealItemRecipeOverrideJson>` / `setRecipeOverrides(List<…>)`. **`null` — not empty list — is the canonical "no overrides" value.**

- [ ] **Step 1: Write the failing round-trip test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealItemRecipeOverridesIT.java`:

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The typed jsonb envelope survives a flush/clear round-trip, and NULL stays NULL (mezo-ormb). */
@Transactional
class MealItemRecipeOverridesIT extends AbstractIntegrationTest {

    @Autowired private MealRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private MealPopulator mealPopulator;

    @PersistenceContext private EntityManager entityManager;

    private UUID owner;
    private RecipeEntity recipe;
    private PantryItemEntity food;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("overrides@test.local");
        food = pantryPopulator.createFood(owner, "Túró forrás", LocalDate.of(2026, 12, 31));
        recipe = recipePopulator.createRecipe(owner, food.getId());
    }

    @Test
    void testPersist_shouldRoundTripTheEnvelope_whenOverridesAreSet() {
        MealEntity meal = mealPopulator.createRecipeMeal(owner, recipe);
        meal.getItems().get(0).setRecipeOverrides(List.of(new MealItemRecipeOverrideJson(
            1, food.getId(), "Méz", "g", new BigDecimal("20"), new BigDecimal("0.5"))));
        repository.saveAndFlush(meal);

        entityManager.flush();
        entityManager.clear();

        List<MealItemRecipeOverrideJson> read =
            repository.findById(meal.getId()).orElseThrow().getItems().get(0).getRecipeOverrides();
        assertThat(read).singleElement().satisfies(o -> {
            assertThat(o.lineOrder()).isEqualTo(1);
            assertThat(o.pantryItemId()).isEqualTo(food.getId());
            assertThat(o.name()).isEqualTo("Méz");
            assertThat(o.unit()).isEqualTo("g");
            assertThat(o.originalAmount()).isEqualByComparingTo("20");
            assertThat(o.amount()).isEqualByComparingTo("0.5");
        });
    }

    @Test
    void testPersist_shouldKeepNull_whenNoOverridesAreSet() {
        MealEntity meal = mealPopulator.createRecipeMeal(owner, recipe);

        entityManager.flush();
        entityManager.clear();

        assertThat(repository.findById(meal.getId()).orElseThrow()
            .getItems().get(0).getRecipeOverrides()).isNull();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='MealItemRecipeOverridesIT'
```
Expected: FAIL — compilation error, `MealItemRecipeOverrideJson` and `setRecipeOverrides` do not exist.

- [ ] **Step 3: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202607301200_mezo-ormb_meal_item_recipe_overrides.sql`:

```sql
-- Per-ingredient amount overrides captured when a recipe is logged (mezo-ormb): only the lines the
-- user actually changed, self-describing (name/unit/original_amount) so the log renders without
-- resolving the live recipe, which may since have dropped that line. NULL = the recipe as written,
-- so every existing row keeps its exact current meaning — no backfill.
ALTER TABLE meal_item
    ADD COLUMN recipe_overrides jsonb;
```

- [ ] **Step 4: Register the changeset**

Append to the end of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, matching the existing indentation exactly:

```yaml
  - changeSet:
      id: "1.0.0:202607301200_mezo-ormb_meal_item_recipe_overrides"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607301200_mezo-ormb_meal_item_recipe_overrides.sql
```

- [ ] **Step 5: Create the typed envelope record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemRecipeOverrideJson.java`:

```java
package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One overridden recipe ingredient inside {@code meal_item.recipe_overrides} (jsonb) — ADR 0006
 * typed-envelope idiom, mirroring {@link MealProvenanceJson}.
 *
 * <p>Keyed by {@code lineOrder}; {@code pantryItemId} is a CONSISTENCY CHECK, not the key:
 * {@code recipe_ingredient} has no unique {@code (recipe_id, pantry_item_id)} — a recipe may list
 * the same pantry item twice — so {@code pantryItemId} alone is ambiguous, while {@code lineOrder}
 * alone would silently land on the wrong ingredient after a reorder.
 *
 * <p>{@code name}, {@code unit} and {@code originalAmount} are denormalised on purpose: they make
 * the row self-describing, so "Banán 1 db → 0,5 db" renders even after the recipe drops that line.
 * {@code amount} may be {@code 0} — the line was left out.
 */
public record MealItemRecipeOverrideJson(Integer lineOrder, UUID pantryItemId, String name,
                                         String unit, BigDecimal originalAmount, BigDecimal amount) {
}
```

- [ ] **Step 6: Add the entity field**

In `MealItemEntity.java`, add these imports alongside the existing ones:

```java
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
```

and add this field after `snapshotNova`:

```java
    /**
     * Typed jsonb envelope of the recipe-arm ingredient overrides (mezo-ormb) — only the lines the
     * user changed. NULL (not an empty list) means "the recipe as written"; the frozen
     * {@code snapshot*} macros already incorporate whatever is here, so this is the explanation of
     * the numbers, never their source at read time.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recipe_overrides", columnDefinition = "jsonb")
    private List<MealItemRecipeOverrideJson> recipeOverrides;
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd backend && ./mvnw clean test -Dtest='MealItemRecipeOverridesIT,ArchitectureTest'
```
Expected: PASS, both classes.

- [ ] **Step 8: Run the liquibase lint**

```bash
node scripts/lint-liquibase.mjs
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealItemRecipeOverridesIT.java
git commit --no-verify -m "feat(meal): meal_item.recipe_overrides jsonb + typed envelope (mezo-ormb)"
```

---

### Task 3: `RecipeMapper` — one override-aware rollup formula

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperOverrideRollupTest.java` (new, plain unit test — no Spring)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `RecipeContribution contributionWithAmount(RecipeIngredientEntity l, BigDecimal amount)` — the ONE per-line formula.
  - `RecipeMacros rollupWithOverrides(RecipeEntity e, Map<Integer, BigDecimal> overrides)` — Σ of per-line contributions with substituted amounts; an **empty map yields exactly today's whole-recipe rollup**.
  - The existing `contribution(RecipeIngredientEntity l)` now delegates to `contributionWithAmount(l, l.getAmount())`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperOverrideRollupTest.java`:

```java
package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapperImpl;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The override-aware rollup is the SINGLE macro formula (mezo-ormb): round per line, then sum
 * (mezo-8xy). Fixture mirrors RecipePopulator — two lines, snapshotPer 100, 110/13/4/4.5:
 * Túró 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
 * Méz   20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
 * whole = 297/36/11/12.
 */
class RecipeMapperOverrideRollupTest {

    private final RecipeMapper mapper = new RecipeMapperImpl();

    private RecipeIngredientEntity line(int order, String amount) {
        RecipeIngredientEntity l = new RecipeIngredientEntity();
        l.setLineOrder(order);
        l.setPantryItemId(UUID.randomUUID());
        l.setAmount(new BigDecimal(amount));
        l.setUnit("g");
        l.setSnapshotName("line" + order);
        l.setSnapshotPer(new BigDecimal("100"));
        l.setSnapshotBasisUnit("g");
        l.setSnapshotKcal(new BigDecimal("110"));
        l.setSnapshotProteinG(new BigDecimal("13.0"));
        l.setSnapshotCarbsG(new BigDecimal("4.0"));
        l.setSnapshotFatG(new BigDecimal("4.5"));
        return l;
    }

    private RecipeEntity recipe() {
        RecipeEntity r = new RecipeEntity();
        r.setServings(2);
        r.getLines().add(line(0, "250"));
        r.getLines().add(line(1, "20"));
        return r;
    }

    @Test
    void testRollupWithOverrides_shouldEqualTheStoredRollup_whenMapIsEmpty() {
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of());

        assertThat(m.getKcal()).isEqualByComparingTo("297");
        assertThat(m.getP()).isEqualByComparingTo("36");
        assertThat(m.getC()).isEqualByComparingTo("11");
        assertThat(m.getF()).isEqualByComparingTo("12");
    }

    @Test
    void testRollupWithOverrides_shouldDropTheLine_whenAmountIsZero() {
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of(1, BigDecimal.ZERO));

        // only Túró 250 g remains -> 275/33/10/11
        assertThat(m.getKcal()).isEqualByComparingTo("275");
        assertThat(m.getP()).isEqualByComparingTo("33");
        assertThat(m.getC()).isEqualByComparingTo("10");
        assertThat(m.getF()).isEqualByComparingTo("11");
    }

    @Test
    void testRollupWithOverrides_shouldRoundPerLineThenSum_whenAmountIsHalved() {
        // Túró 125 g -> factor 1.25 -> 137.5/16.25/5/5.625 -> round 138/16/5/6
        // Méz still 22/3/1/1 -> sum 160/19/6/7. Rounding the SUM instead would give 159 kcal.
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of(0, new BigDecimal("125")));

        assertThat(m.getKcal()).isEqualByComparingTo("160");
        assertThat(m.getP()).isEqualByComparingTo("19");
        assertThat(m.getC()).isEqualByComparingTo("6");
        assertThat(m.getF()).isEqualByComparingTo("7");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='RecipeMapperOverrideRollupTest'
```
Expected: FAIL — `rollupWithOverrides` does not exist.

- [ ] **Step 3: Implement in `RecipeMapper`**

Add `import java.util.Map;` and `import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;` if not already present. Replace the existing `contribution(RecipeIngredientEntity l)` method with these three:

```java
    /** Per-line contribution at the line's own stored amount. */
    default RecipeContribution contribution(RecipeIngredientEntity l) {
        return contributionWithAmount(l, l.getAmount());
    }

    /**
     * THE per-line macro formula — {@code factor = amount / snapshotPer}; {@code round(snapshot × factor)}
     * whole-number HALF_UP. Every caller (stored rollup, meal-log override rollup) goes through here so
     * the arithmetic exists exactly once (mezo-8xy single-round rule).
     */
    default RecipeContribution contributionWithAmount(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal per = l.getSnapshotPer() == null || l.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : l.getSnapshotPer();
        BigDecimal effective = amount == null ? BigDecimal.ZERO : amount;
        BigDecimal factor = effective.divide(per, 6, RoundingMode.HALF_UP);
        return RecipeContribution.builder()
            .kcal(scaled(l.getSnapshotKcal(), factor))
            .p(scaled(l.getSnapshotProteinG(), factor))
            .c(scaled(l.getSnapshotCarbsG(), factor))
            .f(scaled(l.getSnapshotFatG(), factor))
            .build();
    }

    /**
     * Whole-recipe rollup with per-line amount substitutions ({@code lineOrder → amount}, mezo-ormb).
     * An EMPTY map reproduces the stored rollup exactly — that identity is the regression guard for
     * every un-overridden meal.
     */
    default RecipeMacros rollupWithOverrides(RecipeEntity e, Map<Integer, BigDecimal> overrides) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (RecipeIngredientEntity l : e.getLines()) {
            BigDecimal amount = overrides.getOrDefault(l.getLineOrder(), l.getAmount());
            RecipeContribution x = contributionWithAmount(l, amount);
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return RecipeMacros.builder().kcal(kcal).p(p).c(c).f(f).build();
    }
```

Leave the existing private `rollup(List<RecipeIngredientResponse>)` and `scaled(...)` untouched.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='RecipeMapperOverrideRollupTest,RecipeApiIT,RecipeServiceIT'
```
Expected: PASS. The two recipe ITs are the proof that delegating `contribution` changed nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperOverrideRollupTest.java
git commit --no-verify -m "feat(recipe): override-aware whole-recipe rollup as the single macro formula (mezo-ormb)"
```

---

### Task 4: `MealService` write path — validate, freeze, expose

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/mapper/MealMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesIT.java` (new)

**Interfaces:**
- Consumes: `RecipeMapper.rollupWithOverrides(RecipeEntity, Map<Integer, BigDecimal>)` (Task 3); `MealItemRecipeOverrideJson` + `MealItemEntity.setRecipeOverrides` (Task 2); `MealIngredientOverrideRequest` (Task 1).
- Produces: `static Map<Integer, BigDecimal> MealService.overrideMap(List<MealItemRecipeOverrideJson>)` — package-private, consumed by Task 5's scoring path. Returns `Map.of()` for `null`/empty.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesIT.java`:

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * Per-ingredient overrides on the recipe arm (mezo-ormb).
 *
 * <p>Fixture arithmetic (per-100g source 110 kcal / 13 p / 4 c / 4.5 f, 2-serving recipe with TWO
 * lines pointing at the SAME pantry item — which is legal, there is no unique
 * (recipe_id, pantry_item_id), and is exactly why lineOrder is the key):
 * <pre>
 * line 0: 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
 * line 1:  20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
 * whole = 297/36/11/12 ; per serving (÷2, unrounded) = 148.5/18/5.5/6 ; 1 adag -> 149/18/6/6
 * line 1 overridden to 0 -> whole 275/33/10/11 ; per serving 137.5/16.5/5/5.5 -> 1 adag -> 138/17/5/6
 * </pre>
 */
class MealOverridesIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);

    private UUID createFood(HttpHeaders auth, String name, Integer nova) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("4"));
        r.setFatG(new BigDecimal("4.5"));
        r.setNova(nova);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeIngredientRequest ingredient(UUID foodId, String amount) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit("g");
        return line;
    }

    /** 2-serving recipe; both lines reference the SAME pantry item (250 g then 20 g). */
    private RecipeResponse createRecipe(HttpHeaders auth, RecipeIngredientRequest... lines) {
        RecipeRequest r = new RecipeRequest();
        r.setName("Túrós tál");
        r.setCategory("breakfast");
        r.setServings(2);
        r.setStarred(false);
        r.setTags(List.of("magas-fehérje"));
        r.setIngredients(List.of(lines));
        return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class);
    }

    private MealIngredientOverrideRequest override(int lineOrder, UUID pantryItemId, String amount) {
        MealIngredientOverrideRequest o = new MealIngredientOverrideRequest();
        o.setLineOrder(lineOrder);
        o.setPantryItemId(pantryItemId);
        o.setAmount(new BigDecimal(amount));
        return o;
    }

    private MealItemRequest recipeItem(UUID recipeId, String servings,
                                       List<MealIngredientOverrideRequest> overrides) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(new BigDecimal(servings));
        i.setUnit("adag");
        i.setIngredientOverrides(overrides);
        return i;
    }

    private MealRequest mealReq(MealItemRequest... items) {
        MealRequest r = new MealRequest();
        r.setSlot("breakfast");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Reggeli");
        r.setItems(List.of(items));
        return r;
    }

    private String postBadMeal(HttpHeaders auth, MealRequest req) {
        return exchangeForBody(HttpMethod.POST, "/api/meal", req, auth, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testCreate_shouldStayBitIdentical_whenNoOverridesAreSent() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        MealResponse created = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("149");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("18");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("6");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("6");
        assertThat(item.getIngredientOverrides()).isNull();
    }

    @Test
    void testCreate_shouldRecomputeSnapshot_whenOneLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        MealResponse created = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("138");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("17");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("5");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("6");
        // self-describing envelope: only the changed line, carrying its original amount
        assertThat(item.getIngredientOverrides()).singleElement().satisfies(o -> {
            assertThat(o.getLineOrder()).isEqualTo(1);
            assertThat(o.getPantryItemId()).isEqualTo(food);
            assertThat(o.getName()).isEqualTo("Túró");
            assertThat(o.getUnit()).isEqualTo("g");
            assertThat(o.getOriginalAmount()).isEqualByComparingTo("20");
            assertThat(o.getAmount()).isEqualByComparingTo("0");
        });
    }

    @Test
    void testCreate_shouldOnlyTouchTheAddressedLine_whenBothLinesShareAPantryItem() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));

        // halve line 0 only: 125 g -> 137.5/16.25/5/5.625 -> round 138/16/5/6 ; line 1 stays 22/3/1/1
        // whole 160/19/6/7 ; per serving 80/9.5/3/3.5 -> 1 adag -> 80/10/3/4
        MealResponse created = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(0, food, "125")))),
            auth, HttpStatus.CREATED, MealResponse.class);

        MealItemResponse item = created.getItems().get(0);
        assertThat(item.getContribution().getKcal()).isEqualByComparingTo("80");
        assertThat(item.getContribution().getP()).isEqualByComparingTo("10");
        assertThat(item.getContribution().getC()).isEqualByComparingTo("3");
        assertThat(item.getContribution().getF()).isEqualByComparingTo("4");
        assertThat(item.getIngredientOverrides()).singleElement()
            .satisfies(o -> assertThat(o.getOriginalAmount()).isEqualByComparingTo("250"));
    }

    @Test
    void testCreate_shouldFallBackToTheNextHighestNova_whenTheTopNovaLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID clean = createFood(auth, "Túró", 1);
        UUID processed = createFood(auth, "Szirup", 4);
        RecipeResponse recipe = createRecipe(auth, ingredient(clean, "250"), ingredient(processed, "20"));

        MealResponse asWritten = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(asWritten.getItems().get(0).getNova()).isEqualTo(4);

        MealResponse zeroed = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, processed, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(zeroed.getItems().get(0).getNova()).isEqualTo(1);
    }

    @Test
    void testCreate_shouldReject_whenLineOrderIsOutOfRange() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth,
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(7, food, "10")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenPantryItemIdDoesNotMatchThatLine() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        UUID other = createFood(auth, "Méz", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth,
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(0, other, "10")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenTheSameLineIsOverriddenTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"));

        String body = postBadMeal(auth, mealReq(recipeItem(recipe.getId(), "1",
            List.of(override(0, food, "10"), override(0, food, "20")))));

        assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreate_shouldReject_whenOverridesRideOnAPantryItem() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);

        MealItemRequest pantry = new MealItemRequest();
        pantry.setSource("pantry");
        pantry.setPantryItemId(food);
        pantry.setAmount(new BigDecimal("100"));
        pantry.setUnit("g");
        pantry.setIngredientOverrides(List.of(override(0, food, "10")));

        assertHasFieldError(postBadMeal(auth, mealReq(pantry)), "items", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldRoundTripTheOverrides_whenTheMealIsEdited() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));
        MealResponse created = postForBody("/api/meal", mealReq(recipeItem(recipe.getId(), "1", null)),
            auth, HttpStatus.CREATED, MealResponse.class);

        exchangeForBody(HttpMethod.PUT, "/api/meal/" + created.getId(),
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.NO_CONTENT, String.class);

        // there is no GET /api/meal/{id} (meal.yml exposes only put/delete there) — re-read the day
        MealResponse reread = getForBody("/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK,
            FuelDayResponse.class).getMeals().stream()
            .filter(m -> m.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(reread.getItems().get(0).getIngredientOverrides()).hasSize(1);
        assertThat(reread.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");
    }

    @Test
    void testCreate_shouldNotRewriteHistory_whenTheRecipeIsEditedAfterwards() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Túró", 1);
        RecipeResponse recipe = createRecipe(auth, ingredient(food, "250"), ingredient(food, "20"));
        MealResponse logged = postForBody("/api/meal",
            mealReq(recipeItem(recipe.getId(), "1", List.of(override(1, food, "0")))),
            auth, HttpStatus.CREATED, MealResponse.class);
        assertThat(logged.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");

        // rewrite the recipe entirely — a single, much smaller line
        RecipeRequest edited = new RecipeRequest();
        edited.setName("Túrós tál v2");
        edited.setCategory("breakfast");
        edited.setServings(2);
        edited.setStarred(false);
        edited.setTags(List.of());
        edited.setIngredients(List.of(ingredient(food, "10")));
        exchangeForBody(HttpMethod.PUT, "/api/recipe/" + recipe.getId(), edited,
            auth, HttpStatus.NO_CONTENT, String.class);

        MealResponse reread = getForBody("/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK,
            FuelDayResponse.class).getMeals().stream()
            .filter(m -> m.getId().equals(logged.getId())).findFirst().orElseThrow();
        // frozen: macros, the snapshot name, and the self-describing envelope all survive the edit
        assertThat(reread.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("138");
        assertThat(reread.getItems().get(0).getName()).isEqualTo("Túrós tál");
        assertThat(reread.getItems().get(0).getIngredientOverrides()).singleElement()
            .satisfies(o -> assertThat(o.getOriginalAmount()).isEqualByComparingTo("20"));
    }
}
```

The class needs two more members for those tests — add to the imports and the constants:

```java
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import java.time.LocalDate;
```
```java
    private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='MealOverridesIT'
```
Expected: FAIL — `setIngredientOverrides` compiles (Task 1) but the service ignores it: the zeroed-line test still reports 149 kcal, the envelope is null, and no request is rejected.

- [ ] **Step 3: Add the override resolution to `MealService`**

Add imports: `io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest`, `io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson`, `java.util.LinkedHashMap`, `java.util.Objects`.

Add these four methods (place them next to `resolveRecipe`):

```java
    /**
     * Request overrides → {@code lineOrder → amount}, fully validated (mezo-ormb). {@code lineOrder}
     * is the key; {@code pantryItemId} is a CONSISTENCY CHECK — {@code recipe_ingredient} has no
     * unique {@code (recipe_id, pantry_item_id)}, so a recipe may list the same item twice, and a
     * reorder between the client's read and this write would otherwise land on the wrong line.
     * Every anomaly is a 400 on "items"; nothing is silently skipped.
     */
    private Map<Integer, BigDecimal> resolveOverrides(RecipeEntity recipe, MealItemRequest req) {
        List<MealIngredientOverrideRequest> reqs = req.getIngredientOverrides();
        if (reqs == null || reqs.isEmpty()) {
            return Map.of();
        }
        Map<Integer, RecipeIngredientEntity> byOrder = recipe.getLines().stream()
            .collect(Collectors.toMap(RecipeIngredientEntity::getLineOrder, Function.identity()));
        Map<Integer, BigDecimal> resolved = new LinkedHashMap<>();
        for (MealIngredientOverrideRequest o : reqs) {
            if (o.getLineOrder() == null || o.getAmount() == null || o.getAmount().signum() < 0) {
                throw invalidItems();
            }
            RecipeIngredientEntity line = byOrder.get(o.getLineOrder());
            if (line == null || !line.getPantryItemId().equals(o.getPantryItemId())) {
                throw invalidItems(); // unknown line, or a different ingredient sits there now
            }
            if (resolved.put(o.getLineOrder(), o.getAmount()) != null) {
                throw invalidItems(); // the same line overridden twice
            }
        }
        return resolved;
    }

    /**
     * The persisted envelope: ONLY the changed lines, self-describing (snapshot name + unit +
     * the recipe's original amount) so the log renders without resolving the live recipe.
     * Empty → NULL, never {@code []}, so an un-overridden row keeps its exact current shape.
     */
    private static List<MealItemRecipeOverrideJson> toOverrideEnvelope(
            RecipeEntity recipe, Map<Integer, BigDecimal> overrides) {
        if (overrides.isEmpty()) {
            return null;
        }
        return recipe.getLines().stream()
            .filter(l -> overrides.containsKey(l.getLineOrder()))
            .map(l -> new MealItemRecipeOverrideJson(l.getLineOrder(), l.getPantryItemId(),
                l.getSnapshotName(), l.getUnit(), l.getAmount(), overrides.get(l.getLineOrder())))
            .toList();
    }

    /** Persisted envelope → the same {@code lineOrder → amount} map, for the scoring read path. */
    static Map<Integer, BigDecimal> overrideMap(List<MealItemRecipeOverrideJson> envelope) {
        if (envelope == null || envelope.isEmpty()) {
            return Map.of();
        }
        return envelope.stream().collect(Collectors.toMap(
            MealItemRecipeOverrideJson::lineOrder, MealItemRecipeOverrideJson::amount));
    }

    /**
     * Dominant NOVA over the lines that ACTUALLY went in (effective amount &gt; 0), read from the live
     * pantry rows. The recipe's stored {@code novaDominant} would still claim a zeroed-out
     * highest-NOVA ingredient, freezing a NOVA the meal never contained.
     */
    private Short dominantNova(RecipeEntity recipe, Map<Integer, BigDecimal> overrides) {
        // ids come from the OWNED recipe's lines; @SQLRestriction filters soft-deleted rows
        List<UUID> ids = recipe.getLines().stream()
            .filter(l -> overrides.getOrDefault(l.getLineOrder(), l.getAmount()).signum() > 0)
            .map(RecipeIngredientEntity::getPantryItemId)
            .toList();
        if (ids.isEmpty()) {
            return null;
        }
        return pantryItemRepository.findAllById(ids).stream()
            .map(PantryItemEntity::getNova)
            .filter(Objects::nonNull)
            .max(Short::compareTo)
            .orElse(null);
    }
```

- [ ] **Step 4: Wire them into `buildItem`**

At the very top of `buildItem`, immediately after `item.setUnit(req.getUnit());`, add the non-recipe guard:

```java
        // ingredientOverrides is a recipe-arm concept only — never silently ignored on another arm
        if (!"recipe".equals(req.getSource())
            && req.getIngredientOverrides() != null && !req.getIngredientOverrides().isEmpty()) {
            throw invalidItems();
        }
```

Then replace the body of the `if ("recipe".equals(req.getSource()))` branch's first four statements. It currently reads:

```java
            RecipeEntity recipe = resolveRecipe(userId, req.getRecipeId());
            item.setRecipeId(recipe.getId());
            RecipeMacros whole = recipeMapper.toResponse(recipe).getMacros(); // reuse the recipe rollup
```

Replace those three lines with:

```java
            RecipeEntity recipe = resolveRecipe(userId, req.getRecipeId());
            item.setRecipeId(recipe.getId());
            Map<Integer, BigDecimal> overrides = resolveOverrides(recipe, req);
            item.setRecipeOverrides(toOverrideEnvelope(recipe, overrides));
            // the frozen snapshot is computed from the OVERRIDDEN set; an empty map reproduces the
            // stored rollup exactly, so an un-overridden log stays bit-identical
            RecipeMacros whole = recipeMapper.rollupWithOverrides(recipe, overrides);
```

and replace the existing `item.setSnapshotNova(recipe.getNovaDominant());` with:

```java
            item.setSnapshotNova(overrides.isEmpty()
                ? recipe.getNovaDominant() : dominantNova(recipe, overrides));
```

- [ ] **Step 5: Project the envelope in `MealMapper`**

Add imports `io.mrkuhne.mezo.api.dto.MealIngredientOverrideResponse` and `io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson`. In `toItemResponse`, add before `.build()`:

```java
            .ingredientOverrides(i.getRecipeOverrides() == null ? null
                : i.getRecipeOverrides().stream().map(MealMapper::toOverrideResponse).toList())
```

and add this static helper at the bottom of the interface:

```java
    /** Persisted override envelope → contract response (1:1, already self-describing). */
    private static MealIngredientOverrideResponse toOverrideResponse(MealItemRecipeOverrideJson o) {
        return MealIngredientOverrideResponse.builder()
            .lineOrder(o.lineOrder())
            .pantryItemId(o.pantryItemId())
            .name(o.name())
            .unit(o.unit())
            .originalAmount(o.originalAmount())
            .amount(o.amount())
            .build();
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='MealOverridesIT,MealApiIT,MealServiceIT,ArchitectureTest'
```
Expected: PASS. `MealApiIT` + `MealServiceIT` green is the proof that the un-overridden path did not move.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesIT.java
git commit --no-verify -m "feat(meal): freeze the recipe snapshot from the overridden ingredient set (mezo-ormb)"
```

---

### Task 5: Scoring — `recipeFacts` honours the overrides

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`toScoredLine` :180, `recipeFacts` :236)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesScoringIT.java` (new)

**Interfaces:**
- Consumes: `MealService.overrideMap(List<MealItemRecipeOverrideJson>)` (Task 4); `MealItemEntity.getRecipeOverrides()` (Task 2).
- Produces: nothing consumed by later tasks.

**Why a separate task:** Task 4 froze the *macros* from the overridden set. The nutrition-quality facts (fiber / sugar / salt / saturated fat) are read on a **different** path — `applyScore` → `toScoredLine` → `recipeFacts`, which walks the LIVE recipe lines — and would still score the recipe as written. The test isolates this precisely: the overridden line is **macro-neutral** (0 kcal/p/c/f) but fact-rich, so the two meals have byte-identical macros and can only differ if the facts path saw the override.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesScoringIT.java`:

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * The mezo score must reflect the meal AS EATEN, not the recipe as written (mezo-ormb).
 *
 * <p>Isolation trick: the overridden line is a pure salt source — 0 kcal / 0 p / 0 c / 0 f, 40 g
 * salt per 100 g. Zeroing it therefore leaves the macro snapshot BYTE-IDENTICAL, so the only way
 * the two meals can score differently is if {@code recipeFacts()} consumed the override. If the
 * facts path ignores overrides, both scores come out exactly equal and this test fails.
 */
class MealOverridesScoringIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);

    private UUID createMacroFood(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setCategory("dairy");
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("4"));
        r.setFatG(new BigDecimal("4.5"));
        r.setNova(1);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    /** Macro-neutral, fact-rich: zero macros, heavy salt. */
    private UUID createSalt(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Só");
        r.setCategory("condiments");
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(BigDecimal.ZERO);
        r.setProteinG(BigDecimal.ZERO);
        r.setCarbsG(BigDecimal.ZERO);
        r.setFatG(BigDecimal.ZERO);
        r.setSaltG(new BigDecimal("40"));
        r.setSugarG(BigDecimal.ZERO);
        r.setFiberG(BigDecimal.ZERO);
        r.setSaturatedFatG(BigDecimal.ZERO);
        r.setNova(1);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeIngredientRequest ingredient(UUID foodId, String amount) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit("g");
        return line;
    }

    private MealResponse log(HttpHeaders auth, UUID recipeId, List<MealIngredientOverrideRequest> ov) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(BigDecimal.ONE);
        i.setUnit("adag");
        i.setIngredientOverrides(ov);
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Ebéd");
        r.setItems(List.of(i));
        return postForBody("/api/meal", r, auth, HttpStatus.CREATED, MealResponse.class);
    }

    @Test
    void testScore_shouldReflectTheOverriddenSet_whenAMacroNeutralFactRichLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID turo = createMacroFood(auth);
        UUID salt = createSalt(auth);

        RecipeRequest rr = new RecipeRequest();
        rr.setName("Sós túró");
        rr.setCategory("lunch");
        rr.setServings(2);
        rr.setStarred(false);
        rr.setTags(List.of());
        rr.setIngredients(List.of(ingredient(turo, "250"), ingredient(salt, "20")));
        RecipeResponse recipe = postForBody("/api/recipe", rr, auth, HttpStatus.CREATED, RecipeResponse.class);

        MealIngredientOverrideRequest zeroSalt = new MealIngredientOverrideRequest();
        zeroSalt.setLineOrder(1);
        zeroSalt.setPantryItemId(salt);
        zeroSalt.setAmount(BigDecimal.ZERO);

        MealResponse asWritten = log(auth, recipe.getId(), null);
        MealResponse withoutSalt = log(auth, recipe.getId(), List.of(zeroSalt));

        // the salt line is macro-neutral: the frozen macros MUST be identical
        assertThat(withoutSalt.getMacros().getKcal())
            .isEqualByComparingTo(asWritten.getMacros().getKcal());
        assertThat(withoutSalt.getMacros().getP()).isEqualByComparingTo(asWritten.getMacros().getP());
        assertThat(withoutSalt.getMacros().getC()).isEqualByComparingTo(asWritten.getMacros().getC());
        assertThat(withoutSalt.getMacros().getF()).isEqualByComparingTo(asWritten.getMacros().getF());

        // …so any score difference can ONLY come from recipeFacts() honouring the override
        assertThat(asWritten.getScore().getValue()).isNotNull();
        assertThat(withoutSalt.getScore().getValue()).isNotNull();
        assertThat(withoutSalt.getScore().getValue())
            .isNotEqualByComparingTo(asWritten.getScore().getValue());
        // and removing salt can only help
        assertThat(withoutSalt.getScore().getValue().doubleValue())
            .isGreaterThan(asWritten.getScore().getValue().doubleValue());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='MealOverridesScoringIT'
```
Expected: FAIL on `isNotEqualByComparingTo` — the two scores are identical because `recipeFacts` still walks the recipe as written.

- [ ] **Step 3: Thread the override map into the facts path**

In `toScoredLine`, replace the `facts` assignment:

```java
        Facts facts = "pantry".equals(item.getSource())
            ? pantryFacts(userId, item.getPantryItemId(), factor)
            : recipeFacts(userId, item.getRecipeId(), item.getAmount());
```

with:

```java
        Facts facts = "pantry".equals(item.getSource())
            ? pantryFacts(userId, item.getPantryItemId(), factor)
            // the frozen envelope IS the record of what went in — score what was eaten (mezo-ormb)
            : recipeFacts(userId, item.getRecipeId(), item.getAmount(),
                overrideMap(item.getRecipeOverrides()));
```

- [ ] **Step 4: Make `recipeFacts` override-aware**

Change the signature and the per-line factor. The method becomes:

```java
    private Facts recipeFacts(UUID userId, UUID recipeId, BigDecimal servingsLogged,
                              Map<Integer, BigDecimal> overrides) {
```

and inside the `for (RecipeIngredientEntity line : recipe.getLines())` loop, replace:

```java
            BigDecimal factor = line.getAmount().divide(
                livePer.signum() == 0 ? BigDecimal.ONE : livePer, 6, RoundingMode.HALF_UP);
```

with:

```java
            // effective amount = the override for this line, else the recipe's own amount; a
            // zeroed line yields factor 0 and contributes nothing, while `any` stays true —
            // we DID resolve the pantry row, so coverage is honestly reported
            BigDecimal effective = overrides.getOrDefault(line.getLineOrder(), line.getAmount());
            BigDecimal factor = effective.divide(
                livePer.signum() == 0 ? BigDecimal.ONE : livePer, 6, RoundingMode.HALF_UP);
```

Also update the method javadoc's first line to note the override substitution.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='MealOverridesScoringIT,MealOverridesIT,MealApiIT,MealServiceIT,ArchitectureTest'
```
Expected: PASS, all five.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealOverridesScoringIT.java
git commit --no-verify -m "fix(meal): score the meal as eaten — recipeFacts honours ingredient overrides (mezo-ormb)"
```

---

### Task 6: Frontend data layer — types, request mapping, macro helper, mock parity

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/fuel/mealApi.ts`
- Modify: `frontend/src/data/fuel/recipeMacros.ts`
- Modify: `frontend/src/data/fuel/fuelHooks.ts`
- Test: `frontend/src/data/fuel/recipeMacros.test.ts` (extend), `frontend/src/data/fuel/mealApi.test.ts` (extend or create)

**Interfaces:**
- Consumes: the generated TS types from Task 1.
- Produces:
  - `export interface MealIngredientOverrideInput { lineOrder: number; pantryItemId: string; amount: number }`
  - `MealRefInputItem` gains `ingredientOverrides?: MealIngredientOverrideInput[]`.
  - `export function computeRecipeMacrosWithOverrides(lines: RecipeIngredientLine[], ingredients: Ingredient[], overrides: Record<number, number>): { kcal: number; p: number; c: number; f: number }` — **`lineOrder` is the array index** of `lines`. Consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/data/fuel/recipeMacros.test.ts`:

```ts
import { computeRecipeMacrosWithOverrides } from '@/data/fuel/recipeMacros'
import type { Ingredient, RecipeIngredientLine } from '@/data/types'

describe('computeRecipeMacrosWithOverrides', () => {
  // Mirrors the backend fixture: per-100g 110/13/4/4.5, lines 250 g and 20 g.
  const src = {
    id: 'ing-x', name: 'Túró', per: 100, unit: 'g',
    macros: { kcal: 110, p: 13, c: 4, f: 4.5 },
  } as unknown as Ingredient
  const lines: RecipeIngredientLine[] = [
    { refId: 'ing-x', amount: 250, unit: 'g' },
    { refId: 'ing-x', amount: 20, unit: 'g' },
  ]

  it('reproduces the stored rollup when there are no overrides', () => {
    // 250 g -> 275/33/10/11 ; 20 g -> 22/3/1/1 ; sum 297/36/11/12
    expect(computeRecipeMacrosWithOverrides(lines, [src], {})).toEqual(
      { kcal: 297, p: 36, c: 11, f: 12 })
  })

  it('drops a line overridden to 0', () => {
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 1: 0 })).toEqual(
      { kcal: 275, p: 33, c: 10, f: 11 })
  })

  it('rounds per line then sums, matching the backend', () => {
    // 125 g -> 137.5/16.25/5/5.625 -> 138/16/5/6 ; plus 22/3/1/1 -> 160/19/6/7
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 0: 125 })).toEqual(
      { kcal: 160, p: 19, c: 6, f: 7 })
  })

  it('keys by array index so a repeated ingredient is disambiguated', () => {
    // both lines share refId 'ing-x'; overriding index 1 must not touch index 0
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 1: 40 }).kcal).toBe(275 + 44)
  })
})
```

Append to `frontend/src/data/fuel/mealApi.test.ts` (create the file with the same import style as its siblings if it does not exist):

```ts
import { toRequest } from '@/data/fuel/mealApi'
import type { MealInput } from '@/data/types'

describe('toRequest ingredientOverrides', () => {
  const base: MealInput = {
    slot: 'lunch', loggedAt: null, title: 'Ebéd',
    items: [{ source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag' }],
  }

  it('omits the field entirely when nothing was overridden', () => {
    const item = toRequest(base).items[0] as Record<string, unknown>
    expect(item.ingredientOverrides).toBeUndefined()
  })

  it('passes the overrides through untouched', () => {
    const withOv: MealInput = {
      ...base,
      items: [{ source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag',
        ingredientOverrides: [{ lineOrder: 1, pantryItemId: 'p-9', amount: 0.5 }] }],
    }
    expect(toRequest(withOv).items[0].ingredientOverrides).toEqual(
      [{ lineOrder: 1, pantryItemId: 'p-9', amount: 0.5 }])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test recipeMacros mealApi
```
Expected: FAIL — `computeRecipeMacrosWithOverrides` is not exported; `ingredientOverrides` is not a valid `MealRefInputItem` property.

- [ ] **Step 3: Add the types**

In `frontend/src/data/types.ts`, immediately before `MealRefInputItem`, add:

```ts
/** One recipe ingredient logged at a different amount (mezo-ormb). `lineOrder` is the recipe's
 *  ingredient array index; `pantryItemId` is the server-side consistency check, not the key.
 *  `amount` 0 means the line was left out. */
export interface MealIngredientOverrideInput { lineOrder: number; pantryItemId: string; amount: number }
```

and extend `MealRefInputItem`:

```ts
export interface MealRefInputItem {
  source: 'recipe' | 'pantry'
  refId: string
  amount: number
  unit: string
  /** recipe arm only — absent means "the recipe as written" */
  ingredientOverrides?: MealIngredientOverrideInput[]
}
```

- [ ] **Step 4: Map them in `mealApi.toRequest`**

In the non-estimate arm of `toRequest`, extend the object so the key is present only when there is something to send:

```ts
        : ({ source: it.source,
            recipeId: it.source === 'recipe' ? it.refId : null,
            pantryItemId: it.source === 'pantry' ? it.refId : null,
            amount: it.amount, unit: it.unit,
            // absent (not null, not []) when untouched — an un-overridden log keeps today's exact body
            ...(it.source === 'recipe' && it.ingredientOverrides?.length
              ? { ingredientOverrides: it.ingredientOverrides }
              : {}) } satisfies MealItemRequest)),
```

- [ ] **Step 5: Add the macro helper**

Append to `frontend/src/data/fuel/recipeMacros.ts`:

```ts
/**
 * Whole-recipe macros with per-line amount substitutions (mezo-ormb). The key is the line's ARRAY
 * INDEX, which equals the backend's `lineOrder` (RecipeService assigns it from the loop index and
 * `@OrderBy("lineOrder")` preserves it) — so a recipe listing the same pantry item twice is
 * disambiguated. Round per line, then sum: identical to `RecipeMapper.rollupWithOverrides`.
 * An empty `overrides` reproduces `computeRecipeMacros` exactly.
 */
export function computeRecipeMacrosWithOverrides(
  lines: RecipeIngredientLine[],
  ingredients: Ingredient[],
  overrides: Record<number, number>,
): Macros {
  const sum = lines.reduce<Macros>(
    (acc, line, i) => {
      const ing = ingredients.find(x => x.id === line.refId)
      // No resolvable live source (e.g. the pantry row was deleted): an UNTOUCHED line keeps the
      // server-computed contribution it already carries, so the preview stays as accurate as it is
      // today; an OVERRIDDEN one contributes 0 rather than inventing a rate we cannot know.
      const c = ing
        ? lineContribution(overrides[i] ?? line.amount, ing.per, ing.macros)
        : (overrides[i] !== undefined
            ? { kcal: 0, p: 0, c: 0, f: 0 }
            : (line.contribution ?? { kcal: 0, p: 0, c: 0, f: 0 }))
      return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  return { kcal: roundMacro(sum.kcal), p: roundMacro(sum.p), c: roundMacro(sum.c), f: roundMacro(sum.f) }
}
```

- [ ] **Step 6: Honour overrides in the mock-mode cache mutator**

In `frontend/src/data/fuel/fuelHooks.ts`, the `buildLine` recipe arm currently reads `const m = r?.macros ?? { kcal: 0, p: 0, c: 0, f: 0 }`. Replace that single line with:

```ts
    // mock parity with the backend: overrides re-roll the WHOLE recipe, then ÷ servings × adag
    const m = r
      ? (item.ingredientOverrides?.length
          ? computeRecipeMacrosWithOverrides(r.ingredients, ingredients,
              Object.fromEntries(item.ingredientOverrides.map(o => [o.lineOrder, o.amount])))
          : r.macros)
      : { kcal: 0, p: 0, c: 0, f: 0 }
```

Add `computeRecipeMacrosWithOverrides` to the existing import from `@/data/fuel/recipeMacros` (create the import if the file does not already import from there), and make sure `ingredients` (the mock pantry seed) is in scope — it already is, the pantry arm below uses it.

- [ ] **Step 7: Run the tests in both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test recipeMacros mealApi fuelHooks
```
```bash
cd frontend && pnpm test recipeMacros mealApi fuelHooks
```
```bash
cd frontend && pnpm build
```
Expected: PASS, PASS, build clean.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/fuel/mealApi.ts frontend/src/data/fuel/recipeMacros.ts frontend/src/data/fuel/fuelHooks.ts frontend/src/data/fuel/recipeMacros.test.ts frontend/src/data/fuel/mealApi.test.ts
git commit --no-verify -m "feat(fuel): ingredient-override plumbing in the meal data layer + mock parity (mezo-ormb)"
```

---

### Task 7: The inline ingredient editor in `LogMealSheet`

**Files:**
- Create: `frontend/src/features/fuel/components/RecipeOverrideRow.tsx`
- Create: `frontend/src/features/fuel/components/RecipeOverrideRow.test.tsx`
- Modify: `frontend/src/features/fuel/sheets/LogMealSheet.tsx`
- Create: `frontend/src/features/fuel/sheets/LogMealSheet.overrides.test.tsx`

**Interfaces:**
- Consumes: `computeRecipeMacrosWithOverrides` and `MealIngredientOverrideInput` (Task 6).
- Produces: nothing consumed by later tasks.

**Read first:** `docs/references/frontend_conventions.md`, then the existing `LogMealSheet.tsx` in full. Match its inline-style idiom (this file styles with `style={{…}}` + a few utility classes; do **not** introduce Tailwind classes or a CSS module here).

- [ ] **Step 1: Write the failing row test**

Create `frontend/src/features/fuel/components/RecipeOverrideRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'

function row(over: Partial<React.ComponentProps<typeof RecipeOverrideRow>> = {}) {
  const onChange = vi.fn()
  const onReset = vi.fn()
  render(
    <RecipeOverrideRow
      name="Banán" unit="db" originalAmount={1} amount={1} kcal={105}
      onChange={onChange} onReset={onReset} {...over}
    />,
  )
  return { onChange, onReset }
}

describe('RecipeOverrideRow', () => {
  it('steps by 0.5 for a discrete unit', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán csökkentés/i }))
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('steps by 10 for a gram unit', () => {
    const { onChange } = row({ unit: 'g', originalAmount: 60, amount: 60 })
    fireEvent.click(screen.getByRole('button', { name: /banán növelés/i }))
    expect(onChange).toHaveBeenCalledWith(70)
  })

  it('never steps below zero', () => {
    const { onChange } = row({ amount: 0.5 })
    fireEvent.click(screen.getByRole('button', { name: /banán csökkentés/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('accepts a typed decimal with a Hungarian comma', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: '0,25' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(0.25)
  })

  it('ignores an unparseable entry and keeps the current amount', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: 'kb. egy' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores a negative entry', () => {
    const { onChange } = row()
    fireEvent.click(screen.getByRole('button', { name: /banán mennyiség szerkesztése/i }))
    const input = screen.getByRole('textbox', { name: /banán mennyiség/i })
    fireEvent.change(input, { target: { value: '-2' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks a changed line and offers a reset', () => {
    const { onReset } = row({ amount: 0.5 })
    expect(screen.getByText(/mód/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /banán visszaállítás/i }))
    expect(onReset).toHaveBeenCalled()
  })

  it('shows no MÓD chip when the amount is unchanged', () => {
    row()
    expect(screen.queryByText(/mód/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test RecipeOverrideRow
```
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/fuel/components/RecipeOverrideRow.tsx`:

```tsx
// ============================================================
// Mezo · RecipeOverrideRow (one editable recipe-ingredient line — mezo-ormb)
// Presentational: name + MÓD chip + struck-through original + stepper with a tap-to-type
// amount + this line's kcal + a per-row reset. Amounts are in the RECIPE's own unit, with
// decimals (a half banana is 0,5 db); 0 means "left it out". The parent owns the value.
// ============================================================
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'

/** ±10 for mass/volume (matching the pantry stepper), ±0,5 for discrete units. */
export function stepFor(unit: string): number {
  return ['g', 'ml'].includes(unit.trim().toLowerCase()) ? 10 : 0.5
}

/** Hungarian decimal comma → number; null when the text is not a non-negative number. */
export function parseAmount(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 0.5 → "0,5", 60 → "60" — no trailing zeros, Hungarian separator. */
export function formatAmount(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace('.', ',')
}

interface Props {
  name: string
  unit: string
  originalAmount: number
  amount: number
  kcal: number
  onChange: (amount: number) => void
  onReset: () => void
}

export function RecipeOverrideRow({ name, unit, originalAmount, amount, kcal, onChange, onReset }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const changed = amount !== originalAmount
  const step = stepFor(unit)

  const commit = () => {
    const parsed = parseAmount(draft)
    setEditing(false)
    if (parsed !== null && parsed !== amount) onChange(parsed)
  }

  return (
    <div className="row" style={{ alignItems: 'center', gap: 7, padding: '7px 0',
      borderTop: '1px solid var(--border-subtle)',
      background: changed ? 'color-mix(in srgb, var(--coral) 9%, transparent)' : undefined }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5,
        color: changed ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: changed ? 600 : 400 }}>
        {name}
        {changed && (
          <>
            <span className="label-mono" style={{ fontSize: 7, marginLeft: 5, padding: '2px 4px',
              color: 'var(--coral)', background: 'color-mix(in srgb, var(--coral) 14%, transparent)' }}>MÓD</span>
            <span style={{ fontSize: 9.5, marginLeft: 5, color: 'var(--text-tertiary)',
              textDecoration: 'line-through' }}>{formatAmount(originalAmount)} {unit}</span>
          </>
        )}
      </span>

      <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
        <button onClick={() => onChange(Math.max(0, Math.round((amount - step) * 1000) / 1000))}
          aria-label={`${name} csökkentés`}
          style={{ width: 19, height: 22, display: 'grid', placeItems: 'center', color: 'var(--coral)' }}>−</button>
        {editing ? (
          <input
            autoFocus type="text" inputMode="decimal" value={draft}
            aria-label={`${name} mennyiség`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
            style={{ width: 40, textAlign: 'center', fontSize: 10.5, fontWeight: 600,
              background: 'var(--surface-1)', border: '1px solid var(--coral)',
              color: 'var(--text-primary)' }}
          />
        ) : (
          <button
            onClick={() => { setDraft(formatAmount(amount)); setEditing(true) }}
            aria-label={`${name} mennyiség szerkesztése`}
            style={{ minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatAmount(amount)}
          </button>
        )}
        <button onClick={() => onChange(Math.round((amount + step) * 1000) / 1000)}
          aria-label={`${name} növelés`}
          style={{ width: 19, height: 22, display: 'grid', placeItems: 'center', color: 'var(--coral)' }}>+</button>
        <span className="label-mono" style={{ fontSize: 7.5, color: 'var(--text-tertiary)', padding: '0 5px 0 1px' }}>{unit}</span>
      </div>

      <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)',
        minWidth: 34, textAlign: 'right' }}>{kcal}</span>

      {changed && (
        <button onClick={onReset} aria-label={`${name} visszaállítás`}
          style={{ padding: 2, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <Icon name="x" size={10} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the row test to verify it passes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test RecipeOverrideRow
```
Expected: PASS.

- [ ] **Step 5: Write the failing sheet test**

Create `frontend/src/features/fuel/sheets/LogMealSheet.overrides.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MealInput } from '@/data/types'

// Single-hook override (the LogMealSheet.timestamp.test idiom): every hook stays real (mock mode),
// only logMeal becomes a spy so we can read the outgoing payload.
const hoisted = vi.hoisted(() => ({ logMeal: null as null | ((input: MealInput) => void) }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => ({
      ...actual.useMealActions(date),
      ...(hoisted.logMeal ? { logMeal: hoisted.logMeal } : {}),
    }),
  }
})

import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { hoisted.logMeal = null; vi.unstubAllEnvs() })

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

function openSheetWithRecipe() {
  const { qc, wrapper } = setup()
  const recipes = renderHook(() => useRecipes(), { wrapper })
  const recipe = recipes.result.current.recipes.find(r => r.ingredients.length >= 2)!
  render(
    <QueryClientProvider client={qc}>
      <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  return recipe
}

describe('LogMealSheet ingredient overrides', () => {
  it('keeps the ingredient list collapsed until asked', () => {
    const recipe = openSheetWithRecipe()
    expect(screen.queryByRole('button', { name: new RegExp(`${recipe.ingredients[0].name} növelés`, 'i') }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hozzávalók finomhangolása/i })).toBeInTheDocument()
  })

  it('expands to one editable row per ingredient', () => {
    const recipe = openSheetWithRecipe()
    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    for (const line of recipe.ingredients) {
      expect(screen.getByRole('button', { name: new RegExp(`${line.name} növelés`, 'i') })).toBeInTheDocument()
    }
  })

  it('sends the changed line as an ingredientOverride and leaves the rest alone', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    const recipe = openSheetWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${recipe.ingredients[1].name} csökkentés`, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))

    const payload = logSpy.mock.calls[0][0] as MealInput
    const item = payload.items[0]
    expect(item.source).toBe('recipe')
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toHaveLength(1)
    expect(item.ingredientOverrides![0].lineOrder).toBe(1)
    expect(item.ingredientOverrides![0].pantryItemId).toBe(recipe.ingredients[1].refId)
    expect(item.ingredientOverrides![0].amount).toBeLessThan(recipe.ingredients[1].amount)
  })

  it('sends no overrides when nothing was touched', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    openSheetWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))

    const item = (logSpy.mock.calls[0][0] as MealInput).items[0]
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toBeUndefined()
  })

  it('reverts every change with Alaphelyzet', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    const recipe = openSheetWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${recipe.ingredients[0].name} csökkentés`, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /alaphelyzet/i }))
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))

    const item = (logSpy.mock.calls[0][0] as MealInput).items[0]
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test LogMealSheet.overrides
```
Expected: FAIL — there is no "hozzávalók finomhangolása" control.

- [ ] **Step 7: Wire the editor into `LogMealSheet`**

Make these edits to `frontend/src/features/fuel/sheets/LogMealSheet.tsx`:

**(a)** Add imports:
```tsx
import { computeRecipeMacrosWithOverrides } from '@/data/fuel/recipeMacros'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'
```

**(b)** Extend `DraftLine` (currently at :41):
```tsx
interface DraftLine {
  key: string; source: 'recipe' | 'pantry'; refId: string; amount: number; unit: string
  /** recipe arm only — ingredient array index → amount, in the recipe's own unit (mezo-ormb) */
  overrides?: Record<number, number>
}
```

**(c)** Add expansion state next to the other `useState` calls:
```tsx
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
```

**(d)** In `lineMeta`, replace the recipe arm's macro source. It currently reads
`kcal: round((r?.macros.kcal ?? 0) / s * factor)` etc. Compute the whole-recipe macros first:

```tsx
    if (l.source === 'recipe') {
      const r = resolveRecipe(l.refId)
      const s = Math.max(1, r?.servings ?? 1)
      const factor = l.amount
      // With overrides the whole-recipe rollup is re-rolled from the substituted amounts, then
      // ÷ servings × adag — the SAME order as the backend (round per line, divide unrounded,
      // round once at the end). Without overrides this is r.macros verbatim, so the un-overridden
      // path is bit-identical to before.
      const whole = r && l.overrides && Object.keys(l.overrides).length
        ? computeRecipeMacrosWithOverrides(r.ingredients, ingredients, l.overrides)
        : (r?.macros ?? zero)
      return {
        name: r?.name ?? 'Recept', tag: 'recept' as const, step: 1, min: 1,
        contribution: {
          kcal: round(whole.kcal / s * factor),
          p: round(whole.p / s * factor),
          c: round(whole.c / s * factor),
          f: round(whole.f / s * factor),
        },
      }
    }
```

**(e)** Add the mutators next to `bump`/`removeLine`:
```tsx
  const setOverride = (key: string, index: number, amount: number) =>
    setLines(prev => prev.map(p => p.key === key ? { ...p, overrides: { ...p.overrides, [index]: amount } } : p))
  const clearOverride = (key: string, index: number) =>
    setLines(prev => prev.map(p => {
      if (p.key !== key) return p
      const next = { ...p.overrides }
      delete next[index]
      return { ...p, overrides: next }
    }))
  const resetOverrides = (key: string) =>
    setLines(prev => prev.map(p => p.key === key ? { ...p, overrides: undefined } : p))
```

**(f)** Inside the item card's `<div style={{ marginTop: 9 }}><MacroCells …/></div>`, immediately **after** that block, add the disclosure + rows (only for the recipe arm):

```tsx
                  {l.source === 'recipe' && (() => {
                    const r = resolveRecipe(l.refId)
                    if (!r || r.ingredients.length === 0) return null
                    const open = !!expanded[l.key]
                    const touched = Object.keys(l.overrides ?? {}).length
                    return (
                      <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [l.key]: !p[l.key] }))}
                          aria-label="Hozzávalók finomhangolása" aria-expanded={open}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                            HOZZÁVALÓK · {r.ingredients.length}{touched ? ` · ${touched} MÓDOSÍTVA` : ''}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--coral)' }}>
                            {open ? 'összecsuk ▴' : 'finomhangolás ▾'}
                          </span>
                        </button>
                        {open && (
                          <>
                            {r.servings > 1 && (
                              <div style={{ marginTop: 5, fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                                a teljes recepthez ({r.servings} adag)
                              </div>
                            )}
                            {r.ingredients.map((ing, i) => {
                              const src = ingredients.find(x => x.id === ing.refId)
                              const amount = l.overrides?.[i] ?? ing.amount
                              return (
                                <RecipeOverrideRow
                                  key={`${l.key}-${i}`}
                                  name={ing.name ?? src?.name ?? ing.refId}
                                  unit={ing.unit}
                                  originalAmount={ing.amount}
                                  amount={amount}
                                  kcal={src ? round(src.macros.kcal * (amount / (src.per || 1))) : 0}
                                  onChange={(v) => setOverride(l.key, i, v)}
                                  onReset={() => clearOverride(l.key, i)}
                                />
                              )
                            })}
                            {touched > 0 && (
                              <button onClick={() => resetOverrides(l.key)} aria-label="Alaphelyzet"
                                style={{ marginTop: 7, fontSize: 10, fontWeight: 600, color: 'var(--coral)' }}>
                                Alaphelyzet
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })()}
```

**(g)** In `save()`, map the overrides onto the payload. Replace the `items:` line with:

```tsx
      items: lines.map(l => {
        const entries = Object.entries(l.overrides ?? {})
          .filter(([i, v]) => {
            const r = l.source === 'recipe' ? resolveRecipe(l.refId) : undefined
            return r ? v !== r.ingredients[Number(i)]?.amount : false
          })
        return {
          source: l.source, refId: l.refId, amount: l.amount, unit: l.unit,
          // only genuinely-changed lines ride along; an untouched recipe keeps today's exact body
          ...(l.source === 'recipe' && entries.length
            ? { ingredientOverrides: entries.map(([i, v]) => ({
                lineOrder: Number(i),
                pantryItemId: resolveRecipe(l.refId)!.ingredients[Number(i)].refId,
                amount: v,
              })) }
            : {}),
        }
      }),
```

- [ ] **Step 8: Run the sheet tests in both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test LogMealSheet RecipeOverrideRow
```
```bash
cd frontend && pnpm test LogMealSheet RecipeOverrideRow
```
Expected: PASS both — including the pre-existing `LogMealSheet.test.tsx` and `LogMealSheet.timestamp.test.tsx`.

- [ ] **Step 9: Full frontend gate**

```bash
cd frontend && pnpm build
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```
```bash
cd frontend && VITE_USE_MOCK=false pnpm test
```
Expected: build clean, both suites green. (`LogMealSheet` is touched by many screens' snapshots of the fuel page — if anything unrelated fails, report it rather than editing unrelated tests.)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/fuel/components/RecipeOverrideRow.tsx frontend/src/features/fuel/components/RecipeOverrideRow.test.tsx frontend/src/features/fuel/sheets/LogMealSheet.tsx frontend/src/features/fuel/sheets/LogMealSheet.overrides.test.tsx
git commit --no-verify -m "feat(fuel): inline ingredient fine-tuning when logging a recipe (mezo-ormb)"
```

---

### Task 8: Documentation

**Files:**
- Modify: `docs/features/fuel.md` (§2 user-facing behavior, §4 data model & API, §9 decisions/gotchas, §10 key files; bump `updated:` in the frontmatter to `2026-07-30`)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

**Read first:** `docs/features/fuel.md` in full, and the `knowledge-base` skill's rules — **overwrite in place, no changelog section, no dated snapshots**; link with `file:line` pointers rather than pasting code.

- [ ] **Step 1: Update §2 — user-facing behavior**

In the meal-logging paragraph, document that a recipe line in the log sheet can be expanded to its ingredient list and each amount adjusted in the recipe's own unit with decimals (`0` = left out), that the values describe **the whole recipe as made** while the `adag` stepper stays "how much of it I ate", and that changed lines are marked and individually revertible.

- [ ] **Step 2: Update §4 — data model & API**

Add `meal_item.recipe_overrides` (nullable jsonb, `MealItemRecipeOverrideJson`) to the data-model table with a one-line note that `null` means "the recipe as written" and that the frozen `snapshot*` macros already incorporate the overrides. Add `ingredientOverrides` to the `MealItemRequest`/`MealItemResponse` description.

- [ ] **Step 3: Update §9 — decisions & gotchas**

Add three entries:
- **The override key is `lineOrder` + a `pantryItemId` consistency check.** `recipe_ingredient` has no unique `(recipe_id, pantry_item_id)` — a recipe may list the same item twice — so `pantryItemId` alone is ambiguous, while `lineOrder` alone would silently land on the wrong ingredient after a reorder. Mismatch → 400, never a wrong number.
- **All three derived values consume the same map.** Macros (`RecipeMapper.rollupWithOverrides`), nutrition facts (`MealService.recipeFacts`) and `snapshotNova` — the last because zeroing the highest-NOVA ingredient would otherwise freeze a NOVA the meal never contained.
- **One formula, two places.** `RecipeMapper.contributionWithAmount` (backend) and `recipeMacros.computeRecipeMacrosWithOverrides` (frontend) must stay in lock-step: round per line, then sum; divide by servings **unrounded**; round once at the contribution boundary (mezo-8xy).

- [ ] **Step 4: Update §10 — key files**

Add `frontend/src/features/fuel/components/RecipeOverrideRow.tsx`, `backend/.../feature/meal/entity/MealItemRecipeOverrideJson.java`, and note the new `RecipeMapper` methods.

- [ ] **Step 5: Run the docs lint**

```bash
node scripts/lint-docs.mjs
```
Expected: no errors for `fuel.md`, and its staleness flag cleared.

- [ ] **Step 6: Commit**

```bash
git add docs/features/fuel.md
git commit --no-verify -m "docs(fuel): ingredient overrides at log time (mezo-ormb)"
```
