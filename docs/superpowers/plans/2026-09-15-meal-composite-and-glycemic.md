# A logolt étkezés a hozzávalóiból ítélődjön meg + Vércukor-válasz kártya

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A meal logged from a recipe must be scored and described from its **ingredients**, not from one
opaque composite row — and the Minőség grid gains a fourth card, a **Vércukor-válasz** band that opens
the glycemic glass box.

**Architecture:** One backend change at the source (`MealService.applyScore` expands a `source='recipe'`
item into per-ingredient `ScoredLine`s, honouring the stored overrides), which repairs the `nova`,
`plant_diversity` and `energy_density` dimensions at once. The frontend then stops computing the three
Minőség tiles from the collapsed `mealItems` and reads the repaired breakdown instead — so ONE
arithmetic (the backend's) drives both the AI score and the tiles, and they cannot drift. The fourth
card is a pure frontend derivation over facts that already exist on the wire.

**Tech Stack:** Spring Boot 4 / Hibernate 7 backend, React 19 + TanStack Query frontend, Vitest,
JUnit 5 + Testcontainers, Playwright layout suite.

## Global Constraints

- **Driving issues:** `mezo-tm3sb` (the composite bug, P1) and the fourth card (file on start).
- **Owner-approved, explicitly:** existing meals' scores **will move** on re-score. This was put to the
  owner on 2026-09-15 and accepted. Do not add a compatibility shim to preserve old values.
- **No numeric glycemic index, ever.** The approved prototype's own note: mixed-meal GI math
  mispredicts by 22–50%, so the feature commits to **three bands**. Owner re-confirmed
  ("sáv legyen") on 2026-09-15. UI copy says **„vércukor-válasz"**, never „glikémiás index"
  (`mezo-6z0ai` issue text).
- **Honest-null is absolute.** A fact the source did not give prints „—", never a fabricated 0. Where
  the glycemic band has to assume a refined-sugar share because `sugarG` is null, the box must SAY so
  („becsült") — it may not present the assumption as a stored fact.
- **Adherence-neutral framing.** A „magas" band is never coloured or worded as failure.
- **Clay 3D SVG icons, never emojis.** New art lands in `docs/design_2.0/assets/clay-icons.svg`
  FIRST, then is copied verbatim to `frontend/src/shared/ui/clay/clay-icons.svg`; the two must
  `diff` clean. The gradient palette is CLOSED (`ig-titanium`, `ig-blue`, `ig-gold`, `ig-purple`,
  `ig-lime`, `ig-rose` + the `ig-shadow` filter) — do not add one. `Clay.test.tsx` pins the symbol
  count in **three** places (test name, assertion, header comment).
- **Reduced motion is mandatory** on anything that animates.
- **CSS fencing:** the Fuel blocks in `prototype.css` are fenced per page (`fmx-` = Mai/detail,
  `fkx-` = Konyha, …), all before the `titan-dark scope` fence. `prototypeCssStructure.test.ts`
  parses the whole file. One block per slice, one prefix per page.
- **Count-up:** use `useFuelCountUp` (exported from `FuelMacroRings.tsx`), never `useCountUp`.
- **Gates per slice:** focused backend ITs with `-Dmezo.test.use-testcontainers=true`; frontend
  vitest in BOTH modes with an explicit `VITE_USE_MOCK`; `pnpm test:layout` before pushing a UI
  slice; `node scripts/gen-codemap.mjs` after any `origin/main` merge.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/.../feature/meal/service/MealService.java` | **Modify.** `applyScore` builds the scorer's lines; new private expansion for the recipe arm. The persisted `MealItemEntity` is NOT touched. |
| `backend/.../feature/meal/service/MealCompositeLines.java` | **Create.** The expansion itself, as a pure static helper over `RecipeEntity` + overrides + logged amount, so it is unit-testable without Spring. |
| `backend/src/test/.../meal/service/MealCompositeLinesTest.java` | **Create.** Pure arithmetic rounds on the expansion. |
| `backend/src/test/.../meal/MealRecipeCompositeScoringIT.java` | **Create.** The end-to-end proof: log a meal from a recipe, assert the NOVA stack is ingredient-level. |
| `frontend/src/features/fuel/logic/mealQualityTruth.ts` | **Create.** Reads the three Minőség facts off `MealBreakdown` (nova stack, nova items, energy-density row), honest-null when a dimension is degraded/absent. |
| `frontend/src/features/fuel/logic/glycemicBand.ts` | **Create.** The three-band derivation + the copy it carries. Pure. |
| `frontend/src/features/fuel/components/FuelQualityBlocks.tsx` | **Modify.** `FuelQualitySection` takes the truth source; the grid gains the fourth card. |
| `frontend/src/features/fuel/components/GlycemicGlass.tsx` | **Create.** The glass box: band hero, curve, the plate's facts, one tip. Uses the existing `GlassBox`. |
| `frontend/src/styles/prototype.css` | **Modify.** The band card + curve + glass styles, inside the existing `fuel-mai titanium` fence. |

---

## Task 1 · The expansion, as pure arithmetic

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCompositeLines.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/MealCompositeLinesTest.java`

**Interfaces:**
- Consumes: `RecipeEntity` (with `getLines()`, `getServings()`), `MealItemRecipeOverrideJson`,
  `PantryItemEntity`, `MealScoringService.ScoredLine`.
- Produces:
  ```java
  static List<ScoredLine> expandRecipeItem(
      RecipeEntity recipe,
      Map<Integer, BigDecimal> overrides,
      BigDecimal loggedAmount,               // the meal item's amount, in servings ("adag")
      Map<UUID, PantryItemEntity> pantryById // live NOVA + category, same as RecipeService.fitLines
  )
  ```

**The arithmetic, stated once so no step has to re-derive it.** A recipe line's snapshot is
per-`snapshotPer` basis. For ONE serving the scale is `amount / snapshotPer / servings`; the meal
logged `loggedAmount` servings, so the macro factor is
`effectiveAmount / snapshotPer / servings × loggedAmount`, where
`effectiveAmount = overrides.getOrDefault(lineOrder, line.getAmount())` — the same override idiom as
`RecipeMapper.rollupWithOverrides` (`:144`). **Grams are an absolute mass and must NOT carry the
`amount/per` term** (the existing `RecipeService.fitLines` comment, `:117`) — the gram factor is
`gramAmount(effectiveAmount, unit) / servings × loggedAmount`. Getting this wrong skews
`energy_density` by exactly the `amount/per` factor, which is the trap `fitLines` already documents.
A line whose `effectiveAmount` is 0 was **left out** and contributes no line at all.

- [ ] **Step 1: Write the failing test.**

```java
package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The composite expansion's own arithmetic (mezo-tm3sb).
 *
 * <p>Why this file exists: a meal logged from a recipe stored ONE row for the whole recipe, so the
 * scorer judged five ingredients by a single dominant-NOVA stamp and saw no gram amount at all.
 * These are pure rounds — no Spring, no database — because the scaling is where this can silently
 * go wrong: grams must NOT carry the amount/per term that the macros do.
 */
class MealCompositeLinesTest {

    /** Two servings; the log took one. Zab 70 g @ 371 kcal/100 g, túró 200 g @ 130 kcal/100 g. */
    private static final BigDecimal ONE_SERVING = BigDecimal.ONE;

    @Test
    void oneServingOfATwoServingRecipeHalvesEveryIngredient() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines).hasSize(2);
        // zab: 70 g / 2 servings = 35 g of mass, and 371 kcal per 100 g → 129.85 kcal
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("35");
        assertThat(lines.get(0).kcal()).isEqualByComparingTo("129.85");
    }

    @Test
    void gramsDoNotCarryTheAmountPerTerm() {
        // THE trap: the macro factor is amount/per, the gram factor is not. A 100 g basis with a
        // 70 g line must yield 35 g of mass for a half serving — never 35 × (70/100) = 24.5 g.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("35");
    }

    @Test
    void eachIngredientCarriesItsOwnNovaAndCategory() {
        // This is the whole point: the stack can no longer be 100% of one group.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines).extracting(ScoredLine::nova).containsExactly((short) 1, (short) 3);
    }

    @Test
    void aLineDroppedToZeroContributesNoLineAtAll() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(1, BigDecimal.ZERO), ONE_SERVING,
            RecipeFixtures.pantry());
        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).nova()).isEqualTo((short) 1);
    }

    @Test
    void anOverriddenAmountScalesThatLineOnly() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(0, new BigDecimal("140")), ONE_SERVING,
            RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("70");  // 140 / 2 servings
        assertThat(lines.get(1).amountG()).isEqualByComparingTo("100"); // untouched: 200 / 2
    }

    @Test
    void twoServingsLoggedDoubleTheWholeExpansion() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), new BigDecimal("2"),
            RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("70");
    }

    @Test
    void aDiscreteUnitYieldsNoGramsButKeepsItsMacros() {
        // "2 db tojás": honest null mass, so energy_density degrades rather than lying.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.eggRecipe(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isNull();
        assertThat(lines.get(0).kcal()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void aMissingPantryRowLeavesNovaAndCategoryNullWithoutLosingTheLine() {
        // A since-deleted pantry row must lower coverage, not delete what was eaten.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, Map.of());
        assertThat(lines).hasSize(2);
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.nova()).isNull();
            assertThat(l.category()).isNull();
        });
    }
}
```

A `RecipeFixtures` helper builds the two `RecipeEntity` fixtures and the pantry map; put it beside the
test as a package-private class so Task 2's IT can reuse the shapes if it wants to.

- [ ] **Step 2: Run it and watch it fail.**

Run: `cd backend && ./mvnw -q test -Dtest=MealCompositeLinesTest`
Expected: FAIL — `MealCompositeLines` does not exist (compile error).

- [ ] **Step 3: Write `MealCompositeLines`.**

Mirror `RecipeService.fitLines` (`:114`) line by line — same snapshot fields, same `mul`/`mulOrNull`
null discipline, same `gramAmount` unit table (`g`/`ml` → as-is, `kg`/`l` → ×1000, anything else →
null) — with three differences: the amount comes from the override map, the whole expansion is
multiplied by `loggedAmount`, and a zero `effectiveAmount` skips the line. Copy the `amountLabel`
convention (`amount.stripTrailingZeros().toPlainString() + unit`) so the NOVA item rows still read
„Zabpehely 35g".

- [ ] **Step 4: Run the test to verify it passes.**

Run: `cd backend && ./mvnw -q test -Dtest=MealCompositeLinesTest`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCompositeLines.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/MealCompositeLinesTest.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/RecipeFixtures.java
git commit -m "feat(meal): expand a recipe composite into per-ingredient scored lines (mezo-tm3sb)"
```

---

## Task 2 · Wire it into the scorer

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`applyScore`, ~`:228`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRecipeCompositeScoringIT.java`

**Interfaces:**
- Consumes: `MealCompositeLines.expandRecipeItem` from Task 1.
- Produces: no new public signature. `applyScore` keeps its shape; only the `lines` it hands the
  scorer change.

**What `applyScore` must do.** For each `MealItemEntity`: if `source` is `"recipe"` **and** the recipe
still resolves **and** it has ingredient lines, emit the expansion; otherwise emit today's single
`toScoredLine(userId, item)`. The fallback is not a nicety — a recipe deleted after the log must still
score the meal from its frozen snapshot rather than dropping it to zero. The override map comes from
`item.getRecipeOverrides()` (`List<MealItemRecipeOverrideJson>` → `lineOrder → amount`), and the
pantry map is one `findAllById`-style batch read, like `RecipeService` does — **not** a per-line query
inside the loop.

`MealService` already reads `RecipeEntity` and `recipeMapper` in `buildItem`, so this adds **no new
feature-slice edge** (meal↔recipe is one of the two frozen tolerated cycles). Verify that claim, do not
assume it: run `ArchitectureTest` by name, since a focused `-Dtest=` sweep does not include it.

- [ ] **Step 1: Write the failing IT.**

```java
/**
 * The end-to-end proof for mezo-tm3sb: a meal logged from a recipe is scored on its INGREDIENTS.
 *
 * <p>Before this, MealService.applyScore built one ScoredLine per meal item, and a recipe item is a
 * single composite row carrying recipe.novaDominant and no gram amount. So the nova stack read 100%
 * of one group for every recipe-logged meal, plant diversity counted zero, and energy density
 * degraded for want of a mass — while the SAME recipe's own template breakdown, built per ingredient,
 * got all three right. That asymmetry is what this test pins shut.
 */
@Test
void aMealLoggedFromARecipeGetsAnIngredientLevelNovaStack() {
    // A recipe with a NOVA-1 majority and one NOVA-3 line.
    UUID recipeId = createOatmealRecipe();           // zab (N1) + túró (N3), 2 servings
    UUID mealId = logMealFromRecipe(recipeId, "1");  // one serving

    MealBreakdownJson b = mealRepository.findById(mealId).orElseThrow().getBreakdown();
    NovaDetail nova = b.dimensions().stream()
        .filter(d -> "nova".equals(d.id())).findFirst().orElseThrow().nova();

    // The stack is a real split, not 100% of the dominant group.
    assertThat(nova.stack()).filteredOn(r -> r.pct() > 0).hasSizeGreaterThan(1);
    // …and the item receipt names the INGREDIENTS, not the recipe.
    assertThat(nova.items()).extracting(NovaItemRow::name)
        .anySatisfy(n -> assertThat(n).contains("Zabpehely"))
        .noneSatisfy(n -> assertThat(n).contains("Túrós zabkása"));
}

@Test
void theEnergyDensityDimensionNoLongerDegradesForWantOfAMass() {
    UUID recipeId = createOatmealRecipe();
    UUID mealId = logMealFromRecipe(recipeId, "1");
    MealBreakdownJson b = mealRepository.findById(mealId).orElseThrow().getBreakdown();
    Dimension d = b.dimensions().stream()
        .filter(x -> "energy_density".equals(x.id())).findFirst().orElseThrow();
    assertThat(d.coverage()).isGreaterThan(0.0);
    assertThat(d.context()).extracting(ContextRow::label).contains("Sűrűség");
}

@Test
void aRecipeDeletedAfterTheLogStillScoresFromTheFrozenSnapshot() {
    UUID recipeId = createOatmealRecipe();
    UUID mealId = logMealFromRecipe(recipeId, "1");
    deleteRecipe(recipeId);
    assertThat(mealService.rescore(mealId)).isTrue();
    assertThat(mealRepository.findById(mealId).orElseThrow().getScore()).isNotNull();
}
```

Follow the house IT conventions: **no class-level `@Transactional`** (it deadlocks against
`ResetDatabase`'s TRUNCATE when an emitter runs `REQUIRES_NEW`), and truncate any seeded `Instant` to
`ChronoUnit.MICROS` if you assert equality on one (Linux nanos vs Postgres micros — CI-only).

- [ ] **Step 2: Run it and watch it fail.**

Run: `cd backend && ./mvnw -q test -Dtest=MealRecipeCompositeScoringIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — the stack has exactly one non-zero row (100% of the dominant group) and
`energy_density` coverage is 0.

- [ ] **Step 3: Change `applyScore` to expand.**

- [ ] **Step 4: Run the IT, then the focused meal/recipe/nutrition sweep, then ArchUnit by name.**

```bash
cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true \
  -Dtest='Meal*,Recipe*,*Scoring*,*Breakdown*,ArchitectureTest'
```
Expected: PASS. **Existing scoring assertions WILL fail here** — that is the owner-approved score
movement, not a regression. For each one: re-derive the expected value from the ingredient-level
inputs and update it, and say so in the commit. Never relax an assertion to a range to make it pass.

- [ ] **Step 5: Commit.**

---

## Task 3 · The frontend reads the repaired truth

**Files:**
- Create: `frontend/src/features/fuel/logic/mealQualityTruth.ts`
- Create: `frontend/src/features/fuel/logic/mealQualityTruth.test.ts`
- Modify: `frontend/src/features/fuel/components/FuelQualityBlocks.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMealDetailPage.tsx`

**Interfaces:**
- Consumes: `MealBreakdown` (`data/types.ts`), the `NovaDimension` narrowing guard (`'nova' in dim`).
- Produces:
  ```ts
  export interface MealQualityTruth {
    basePct: number | null      // kcal share of NOVA 1, from nova.stack
    ultraItems: number | null   // count of nova === 4 in nova.items
    densityKcalPer100g: number | null // parsed from the energy_density dimension's "Sűrűség" row
  }
  export function mealQualityTruth(breakdown: MealBreakdown | undefined): MealQualityTruth
  ```

**Why read the breakdown rather than compute.** After Task 2 the backend's own `nova`/`energy_density`
dimensions are ingredient-level, and they are what the AI score was computed from. Computing a second
time on the client would be a second arithmetic over the same facts — the exact drift the shared
`scoreArithmetic.ts` exists to prevent. `FuelQualitySection` keeps its per-line path for the
**recipe** and **workshop** callers, whose lines genuinely ARE ingredients; only the meal-detail caller
switches to the breakdown.

Honest-null rules, each needing its own test:
- no breakdown at all (a meal logged before scoring, or a fresh log) → all three `null`
- a `nova` dimension present but **degraded** (`coverage === 0`) → `basePct` and `ultraItems` `null`
- `energy_density` degraded → `densityKcalPer100g` `null` (do NOT fall back to the line computation:
  the backend already decided the mass is untrustworthy, e.g. under its minimum-mass floor)
- a `"Sűrűség"` row whose value does not parse → `null`, never `0`

- [ ] **Step 1: Write `mealQualityTruth.test.ts`** with one round per rule above plus the happy path
      (a stack of 57/6/37/0 → `basePct: 57`; two `nova: 4` items → `ultraItems: 2`;
      `"183 kcal/100g"` → `183`).
- [ ] **Step 2: Run it and watch it fail** (`CI=true VITE_USE_MOCK=true npx vitest run src/features/fuel/logic/mealQualityTruth.test.ts`).
- [ ] **Step 3: Write `mealQualityTruth.ts`.**
- [ ] **Step 4: Give `FuelQualitySection` an optional `truth` prop** that overrides the per-line
      computation tile by tile (a `null` in `truth` means „—", NOT „fall back to the lines").
      `FuelMealDetailPage` passes `mealQualityTruth(meal.breakdown)`.
- [ ] **Step 5: Update the mock seed** so the frontend's `nova` stack for `m1` agrees with the recipe
      it was logged from (today it says 78% while the recipe's ingredients give 57% — hand-written
      drift that made the mock lie about the very bug being fixed). Derive the seed from the seeded
      recipe rather than retyping a number.
- [ ] **Step 6: Run the fuel suite in both modes; commit.**

---

## Task 4 · The Vércukor-válasz band

**Files:**
- Create: `frontend/src/features/fuel/logic/glycemicBand.ts`
- Create: `frontend/src/features/fuel/logic/glycemicBand.test.ts`
- Create: `frontend/src/features/fuel/components/GlycemicGlass.tsx`
- Create: `frontend/src/features/fuel/components/GlycemicGlass.test.tsx`
- Modify: `frontend/src/features/fuel/components/FuelQualityBlocks.tsx` (the fourth card)
- Modify: `frontend/src/styles/prototype.css` (inside the `fuel-mai titanium` fence)
- Modify: `docs/design_2.0/assets/clay-icons.svg` **then** `frontend/src/shared/ui/clay/clay-icons.svg`
- Modify: `frontend/src/shared/ui/clay/Clay.test.tsx` (the count, in all three places)

**Interfaces:**
- Produces:
  ```ts
  export type GlycemicLevel = 'low' | 'mid' | 'high'
  export interface GlycemicBand {
    level: GlycemicLevel
    label: string                      // 'alacsony' | 'közepes' | 'magas'
    sugarEstimated: boolean            // true when sugarG was null and a share was assumed
    facts: { label: string; value: string }[]
    tip: { title: string; body: string }
    expect: { energy: string; back: string; hunger: string }
  }
  export function glycemicBand(input: {
    c: number | null; sugarG: number | null; fiberG: number | null
    p: number | null; f: number | null
  }): GlycemicBand | null            // null when carbs are unknown — no band, no guess
  ```

**The derivation** is the approved prototype's, verbatim
(`docs/design_2.0/prototypes/companion-titanium/food-state.js` `glycemicFor`, `:43`):
`load = c × (0.6 + 0.4 × min(1, sugar / max(1, c)))`, `brake = fiber×2 + p×0.25 + f×0.2`,
`index = load − brake`, then `< 12` → low, `< 24` → mid, else high. Port the numbers exactly; do not
re-tune them. The tip/expect copy is also in that file — carry it over rather than rewriting, so the
production surface says what the owner approved.

**The one honesty change from the prototype:** the prototype silently assumes
`sugar = c × 0.3` when sugar is unknown and labels the fact row „becsült". Keep the assumption (the
output is a band, not a number) but surface it **on the card and in the box**, via
`sugarEstimated` — so the band never presents an assumed input as a measured one.

- [ ] **Step 1: Write `glycemicBand.test.ts`** — the three band boundaries (an index of 11.9 / 12.0 /
      23.9 / 24.0 pins `<` vs `<=`), unknown carbs → `null`, `sugarEstimated` true exactly when
      `sugarG` is null, and the „öltöztesd fel" vs „egy séta" branch on a high band.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Write `glycemicBand.ts`.**
- [ ] **Step 4: Draw the clay symbol.** A glucose-curve pebble at `viewBox="0 0 64 64"`, from the
      closed gradient palette. Land it in `docs/design_2.0/assets/clay-icons.svg` first, `cp` it to
      the frontend sprite, `diff` the two, and bump the count in `Clay.test.tsx` (three places).
      **Render it at both 34 px and 15 px and LOOK at it** before keeping it — four icons in the
      last slice passed their tests and still missed the brief at tab size.
- [ ] **Step 5: Write `GlycemicGlass.tsx`** on the existing `GlassBox` (which portals into
      `.phone-screen`; a native `<dialog>` + `showModal()` sizes to the window and escapes the phone
      frame). The curve is an inline SVG whose shape follows the band. Honour reduced motion.
- [ ] **Step 6: Add the fourth card** to the Minőség grid. Its value is the **band word**, not a
      number, so `FuelNutriTiles` needs a string-value variant — it already takes
      `value: string | null`, so pass the label and an empty unit. The card is a `<button>` that
      opens the glass box; the other three stay non-interactive.
- [ ] **Step 7: Prove the absence of a number.** A test asserting the card and the box carry no
      „glikémiás index" wording and no GI numeral — this is the owner decision most likely to be
      „helpfully fixed" by a later session.
- [ ] **Step 8: Run the fuel suite both modes, `pnpm test:layout`, and LOOK at it in the running app**
      at 375 px and 430 px. Commit.

---

## Task 5 · Close out

- [ ] Re-run the full frontend suite in **both** modes, `vite build`, `pnpm test:layout`, and the
      focused backend sweep including `ArchitectureTest`.
- [ ] `node scripts/gen-codemap.mjs` (two new backend classes + five new frontend modules).
- [ ] `node scripts/check-beads-backup.mjs --fix`, commit.
- [ ] Update `docs/features/` for the meal/recipe scoring change — the composite expansion is a
      behaviour change in how every recipe-logged meal is scored, and the doc that describes the
      scoring dimensions must say so, including the score movement.
- [ ] Close `mezo-tm3sb` and the fourth-card issue; file the residual (an ingredient in a discrete
      unit still yields no mass, so `energy_density` stays degraded for such recipes — needs a
      per-catalog piece weight).
