# 8-Dimension Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the deterministic scoring engine from 4 to 8 dimensions (Rost-only Mikro, new WHO / Zsírminőség / Növényi diverzitás / Energia-sűrűség, template-side Adag-arány) on both the meal-score and recipe-template surfaces.

**Architecture:** Clean fact redistribution (1 fact = 1 dimension) inside `MealScoringService` (pure math, config-driven); `ScoredLine` carrier gains `category` + `amountG`; new dimensions reuse the existing generic label/value row payload (`ContextRow`), so the contract delta is only the id pattern; FE extends the discriminated union + color map + a generic rows panel. Old envelopes stay valid (additive change); the recipe cache self-invalidates via dimension-count mismatch.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven (backend), OpenAPI contract-first (`api/`), React 19 + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-07-25-recipe-scoring-dimensions-design.md` · **Driving issue:** `mezo-7797` · **Branch:** `feat/recipe-scoring-dimensions`

## Global Constraints

- Read `docs/references/frontend_conventions.md` before any `frontend/src` change; backend work follows `docs/references/` (`spring_patterns.md`, `configuration_conventions.md`, `testing_standards.md`, `api_contract_conventions.md`).
- UI copy Hungarian; code/comments/commits English; commit subjects carry `(mezo-7797)`.
- **Worktree commit rule:** `git -c core.hooksPath=/dev/null commit …`; never stage `.beads/issues.jsonl`. Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`.
- **16 GB box:** run backend tests FOCUSED (`./mvnw clean test -Dtest=<Class> -DargLine=-Xmx3g`); the FULL suite is CI's job (self-PR gate). Local Postgres compose must be up for ITs (`cd backend && docker compose up -d`).
- Config values live in `application.yml` under `mezo.fuel.scoring.*` — never hardcoded; `@Validated` records, no `@Value`.
- All colors `var(--token)` — no raw hex.
- Every dimension follows the honesty rules: zero coverage → `Dim.degraded` (weight 0) + "Nincs …-adat" detail; coverage drives confidence.

---

### Task 1: Contract — widen the dimension id pattern

**Files:**
- Modify: `api/feature/meal/meal.yml` (schema `MealScoreDimension`, ~line 161; `MealBreakdown` description ~line 150)
- Regenerate: `api/openapi.yml` (via `cd api/generate && npm run generate:api`), `frontend/src/data/_client/api.gen.ts` (via `cd frontend && pnpm generate:api`)

**Interfaces:**
- Produces: contract dimension `id` accepts `who|fat_quality|plant_diversity|energy_density|portion`; the generic rows payload stays the `context` field (reused by the new ids). Backend Java DTOs regenerate automatically inside `./mvnw generate-sources`/`test` (Task 2 picks that up).

- [ ] **Step 1: Edit the fragment**

In `api/feature/meal/meal.yml`:

(a) `MealScoreDimension.id` line becomes:
```yaml
        id: { type: string, pattern: '^(macro|micro|nova|context|who|fat_quality|plant_diversity|energy_density|portion)$' }
```

(b) `MealScoreDimension.description` becomes:
```yaml
      description: One weighted dimension; exactly one payload field is populated, matching id — macro/micros/nova for their ids, `context` carries the generic label/value rows for context, who, fat_quality, plant_diversity, energy_density and portion.
```

(c) `MealBreakdown.description` becomes:
```yaml
      description: Typed weighted score envelope (deterministic engine, mezo-yta / ADR 0006; 8-dimension set since mezo-7797). summary/improve are LLM prose — null/empty until enriched.
```

- [ ] **Step 2: Merge + regenerate both sides**

Run: `cd api/generate && npm run generate:api` → expect `api/openapi.yml` regenerated without errors.
Run: `cd frontend && pnpm generate:api` → expect `src/data/_client/api.gen.ts` regenerated.

- [ ] **Step 3: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): widen meal-score dimension ids for the 8-dim scoring set (mezo-7797)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend engine — config, carrier, composers, 8 dimensions (TDD)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.fuel.scoring` block, ~line 456)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java` (`fitLines` composer ~line 95–129 + the `recipeFit`/`recipeTemplateBreakdown` call sites)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownService.java` (call site gains the recipe slot argument)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (line composer ~line 174–185 + `Facts` record + both facts arms ~186–255)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: Task 1's contract (id strings only — DTO mapping is untyped `String id`).
- Produces: `ScoredLine(name, amountLabel, kcal, p, c, f, nova, fiberG, sugarG, saltG, saturatedFatG, hasMicroFacts, category, amountG)` — two NEW trailing fields `String category` (nullable), `BigDecimal amountG` (nullable). `scoreMeal(slot, lines, localTime)` unchanged signature, returns the 8-dim envelope. `recipeTemplateBreakdown(String slot, List<ScoredLine>)` and `recipeFit(String slot, List<ScoredLine>)` — both GAIN the leading nullable `slot` parameter. Dimension ids exactly: `macro`, `micro`, `who`, `fat_quality`, `nova`, `plant_diversity`, `energy_density`, `context` (meal) / `portion` (template).

- [ ] **Step 1: Extend `MealScoringProperties`**

Replace the `Weights` record and the `MicroRefs` record, add five new nested records; keep everything else:

```java
    /** Dimension weights. Meal surface = all except portion; template = all except context; BOTH must sum to 1.0. */
    public record Weights(
        @DecimalMin("0.0") @DecimalMax("1.0") double macro,
        @DecimalMin("0.0") @DecimalMax("1.0") double micro,
        @DecimalMin("0.0") @DecimalMax("1.0") double who,
        @DecimalMin("0.0") @DecimalMax("1.0") double fatQuality,
        @DecimalMin("0.0") @DecimalMax("1.0") double nova,
        @DecimalMin("0.0") @DecimalMax("1.0") double plantDiversity,
        @DecimalMin("0.0") @DecimalMax("1.0") double energyDensity,
        @DecimalMin("0.0") @DecimalMax("1.0") double context,
        @DecimalMin("0.0") @DecimalMax("1.0") double portion
    ) {
        @AssertTrue(message = "mezo.fuel.scoring.weights: the meal surface (all except portion) must sum to 1.0")
        public boolean isMealNormalized() {
            return Math.abs(macro + micro + who + fatQuality + nova + plantDiversity + energyDensity + context - 1.0) < 1e-6;
        }

        @AssertTrue(message = "mezo.fuel.scoring.weights: the template surface (all except context) must sum to 1.0")
        public boolean isTemplateNormalized() {
            return Math.abs(macro + micro + who + fatQuality + nova + plantDiversity + energyDensity + portion - 1.0) < 1e-6;
        }
    }

    /** Daily fiber TARGET (g); the per-meal allotment scales by the meal's kcal-share. Sugar/salt/satFat moved to who/fat-quality (mezo-7797). */
    public record MicroRefs(
        @DecimalMin("1.0") double fiberG
    ) {
    }

    /** WHO guideline references: free-sugar energy-share limit (0..1) + daily salt limit (g, scaled per kcal-share). */
    public record WhoRefs(
        @DecimalMin("0.01") @DecimalMax("0.5") double sugarEnergyShareLimit,
        @DecimalMin("0.5") double saltLimitG
    ) {
    }

    /** Fat quality: saturated-fat energy-share limit (WHO ≤10 E%) + saturated share of total fat reference. */
    public record FatQualityRefs(
        @DecimalMin("0.01") @DecimalMax("0.5") double satFatEnergyShareLimit,
        @DecimalMin("0.05") @DecimalMax("1.0") double satFatShareRef
    ) {
    }

    /** Plant diversity: distinct plant categories for a full score + the category values counted as plants. */
    public record PlantDiversityRefs(
        @Min(1) @Max(10) int targetCategories,
        @NotNull List<String> plantCategories
    ) {
    }

    /** Energy density band: kcal/100g at (or below) which the score is 1.0, and at (or above) which it is 0. */
    public record EnergyDensityRefs(
        @DecimalMin("50.0") double goodKcalPer100g,
        @DecimalMin("100.0") double badKcalPer100g
    ) {
        @AssertTrue(message = "mezo.fuel.scoring.energy-density: bad must exceed good")
        public boolean isOrdered() {
            return badKcalPer100g > goodKcalPer100g;
        }
    }

    /** Portion (template-only): fallback kcal-share of the day for a slot-less recipe. */
    public record PortionRefs(
        @DecimalMin("0.05") @DecimalMax("1.0") double defaultShare
    ) {
    }
```

Add the five new components to the top-level record (after `micro`): `@NotNull @Valid WhoRefs who, @NotNull @Valid FatQualityRefs fatQuality, @NotNull @Valid PlantDiversityRefs plantDiversity, @NotNull @Valid EnergyDensityRefs energyDensity, @NotNull @Valid PortionRefs portion`. Add `import java.util.List;`. Update the class javadoc: "The 8-dimension weighted model (mezo-7797): Macro · Rost · WHO · Zsírminőség · NOVA · Növényi diverzitás · Energia-sűrűség · Context/Portion."

- [ ] **Step 2: Update `application.yml`**

Replace the `weights:` and `micro:` blocks under `mezo.fuel.scoring` and append the new blocks (keep `nova:`, `macro-deviation-slope`, `slot-shares`, `slot-windows`, `slot-share-tolerance` unchanged):

```yaml
      # 8-dimension weighted model (mezo-7797) — meal uses all except portion, template all except
      # context; BOTH subsets must sum to 1.0 (validated at startup).
      weights:
        macro: 0.22
        micro: 0.10
        who: 0.14
        fat-quality: 0.10
        nova: 0.18
        plant-diversity: 0.08
        energy-density: 0.06
        context: 0.12
        portion: 0.12
      micro:                      # fiber TARGET only since mezo-7797 (sugar/salt/satFat → who/fat-quality)
        fiber-g: 38
      who:                        # WHO guideline dimension
        sugar-energy-share-limit: 0.10   # free sugar ≤10% of energy (WHO strong recommendation)
        salt-limit-g: 5                  # WHO 5 g/day, scaled by the meal's kcal-share
      fat-quality:
        sat-fat-energy-share-limit: 0.10 # saturated fat ≤10% of energy (WHO)
        sat-fat-share-ref: 0.33          # saturated share of total fat reference (balanced thirds)
      plant-diversity:
        target-categories: 3             # distinct plant categories for a full score
        plant-categories: [vegetables, fruits, grains, legumes, nuts_seeds]
      energy-density:
        good-kcal-per-100g: 150          # at/below → score 1.0
        bad-kcal-per-100g: 400           # at/above → score 0 (linear between)
      portion:
        default-share: 0.30              # slot-less recipe: assumed kcal-share of the day
```

**Verify the plant category spellings** against the pantry category value set before committing: `grep -n "category" api/feature/pantry/pantry.yml | head` (the response enum/pattern lists the 18 values). Use the exact contract spellings in `plant-categories` (expected: `vegetables`, `fruits`, `grains`, `legumes`, `nuts_seeds` — adjust to what the contract actually says, e.g. `nuts-seeds`/`nuts`).

- [ ] **Step 3: Write the failing engine tests**

Open `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`, read its existing builder/helpers (it constructs `MealScoringProperties` + `NutritionTargetsProperties` by hand and calls the engine directly — extend the property-builder helper with the new records mirroring the yml values above; every existing `new ScoredLine(...)` call gains `, null, null` for the two new fields unless the test targets them). Add — following the file's `test{Method}_should{Result}_when{Condition}` naming and AssertJ style:

```java
    @Test
    void scoreMeal_shouldScoreWhoDimension_whenSugarAndSaltWithinLimits() {
        // one 620-kcal line (20% of 3100): sugar 8g → 8*4/620 = 5.2 E% (≤10% → sub 1.0);
        // salt allotment 5g*0.2 = 1.0g, salt 0.5g → ratio 0.5 → sub 1.0; score = 1.0
        var lines = List.of(line("Zab", 620, 20, 80, 20, 1, 5.0, 8.0, 0.5, 3.0));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "who");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
        assertThat(dim.label()).isEqualTo("Ajánlások · WHO");
    }

    @Test
    void scoreMeal_shouldPenalizeWhoDimension_whenSugarExceedsEnergyShareLimit() {
        // sugar 31g → 31*4/620 = 20 E% → ratio 2.0 → limitSub 0; salt fine → sub 1.0; score 0.5
        var lines = List.of(line("Édes", 620, 10, 100, 10, 2, 2.0, 31.0, 0.5, 2.0));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "who");
        assertThat(dim.score()).isEqualByComparingTo("0.50");
    }

    @Test
    void scoreMeal_shouldScoreFatQuality_whenSaturatedShareLow() {
        // satFat 3g of f=20g → share 0.15 (≤0.33 → sub 1.0); satFat E% = 27/620 = 4.4% → sub 1.0
        var lines = List.of(line("Hal", 620, 40, 20, 20, 1, 2.0, 3.0, 0.5, 3.0));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "fat_quality");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void scoreMeal_shouldDegradeFatQuality_whenNoFatFacts() {
        var lines = List.of(lineNoFacts("Rejtély", 620, 40, 20, 20, 1));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "fat_quality");
        assertThat(dim.weight()).isEqualByComparingTo("0.00");
    }

    @Test
    void scoreMeal_shouldCountDistinctPlantCategories_forPlantDiversity() {
        var lines = List.of(
            lineWithCategory("Zab", 300, "grains"), lineWithCategory("Áfonya", 100, "fruits"),
            lineWithCategory("Mandula", 120, "nuts_seeds"), lineWithCategory("Túró", 200, "dairy"));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "plant_diversity");
        assertThat(dim.score()).isEqualByComparingTo("1.00"); // 3 distinct plant cats / target 3
    }

    @Test
    void scoreMeal_shouldScorePartialPlantDiversity_whenBelowTarget() {
        var lines = List.of(lineWithCategory("Zab", 300, "grains"), lineWithCategory("Túró", 200, "dairy"));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "plant_diversity");
        assertThat(dim.score()).isEqualByComparingTo("0.33"); // 1/3
    }

    @Test
    void scoreMeal_shouldScoreEnergyDensity_fromGramLinesOnly() {
        // 300 kcal over 200 g → 150 kcal/100g → score 1.0; a db-unit line is excluded from density
        var lines = List.of(lineWithGrams("Saláta", 300, new BigDecimal("200")),
            lineNoGrams("Tojás db", 150));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "energy_density");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void scoreMeal_shouldDegradeEnergyDensity_whenNoGramLines() {
        var lines = List.of(lineNoGrams("Tojás db", 150));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "energy_density");
        assertThat(dim.weight()).isEqualByComparingTo("0.00");
    }

    @Test
    void recipeTemplateBreakdown_shouldEmitPortionDimension_withSlotBudget() {
        // per-serving 775 kcal vs breakfast budget 3100*0.25 = 775 → rel 1.0 → score 1.0
        var lines = List.of(line("Reggeli", 775, 40, 90, 25, 1, 5.0, 8.0, 0.8, 4.0));
        var breakdown = service().recipeTemplateBreakdown("breakfast", lines);
        var dim = dimension(breakdown, "portion");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
        assertThat(breakdown.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .doesNotContain("context");
    }

    @Test
    void recipeTemplateBreakdown_shouldUseDefaultShare_whenRecipeHasNoSlot() {
        // slot null → defaultShare 0.30 → budget 930; 930 kcal → rel 1.0 → score 1.0
        var lines = List.of(line("Főétel", 930, 50, 100, 30, 1, 6.0, 9.0, 1.0, 5.0));
        var dim = dimension(service().recipeTemplateBreakdown(null, lines), "portion");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void microDim_shouldScoreFiberOnly_afterRedistribution() {
        // fiber-only micro: rows contain exactly one "Rost" row, no Cukor/Só/Telített zsír rows
        var lines = List.of(line("Zab", 620, 20, 80, 20, 1, 7.6, 8.0, 0.5, 3.0));
        var dim = dimension(service().scoreMeal("lunch", lines, LocalTime.NOON), "micro");
        assertThat(dim.micros()).hasSize(1);
        assertThat(dim.micros().get(0).name()).isEqualTo("Rost");
    }
```

Add the small line-builder helpers the tests need (mirroring the file's existing helper style; `line(...)` fills category/amountG with a gram amount so who/fat/micro tests have full coverage; `lineWithCategory` sets kcal + category; `lineWithGrams`/`lineNoGrams` control `amountG`; `lineNoFacts` passes `hasMicroFacts=false` and null facts; `dimension(envelope, id)` finds a dimension by id or fails).

- [ ] **Step 4: Run the tests — new ones must FAIL (compile error is the expected first failure: `ScoredLine` lacks the new fields)**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`
Expected: compilation failure (new `ScoredLine` fields / `recipeTemplateBreakdown(String, List)` signature missing).

- [ ] **Step 5: Implement the engine**

In `MealScoringService.java`:

(a) `ScoredLine` gains two trailing fields:
```java
    public record ScoredLine(
        String name,
        String amountLabel,
        BigDecimal kcal, BigDecimal p, BigDecimal c, BigDecimal f,
        Short nova,
        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        boolean hasMicroFacts,
        String category,      // pantry category (plant-diversity input); null on estimate lines
        BigDecimal amountG    // line amount in grams (g/ml≈g); null for discrete units
    ) {
    }
```

(b) `scoreMeal` assembles 8 dims; confidence generalizes to the weighted-coverage sum over the live set (replacing the hand-written 4-term expression):
```java
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime) {
        double kcal = sum(lines, ScoredLine::kcal);

        List<Dim> dims = List.of(
            macroDim(lines, kcal), microDim(lines, kcal), whoDim(lines, kcal),
            fatQualityDim(lines, kcal), novaDim(lines, kcal), plantDiversityDim(lines, kcal),
            energyDensityDim(lines, kcal), contextDim(slot, lines, kcal, localTime));

        double weightSum = dims.stream().mapToDouble(d -> d.effectiveWeight).sum();
        double value = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;

        return new MealBreakdownJson(round2(value), round2(confidence), null,
            dims.stream().map(Dim::toJson).toList(), List.of(),
            tools(slot, lines, dims, localTime));
    }
```
(The old `props.weights().x() * x.coverage` confidence formula is replaced by the weight-normalized coverage sum — same semantics generalized to N dims; update the javadoc accordingly.)

(c) `recipeFit` + `recipeTemplateBreakdown` gain the slot parameter; the template assembles 8 live dims (portion instead of context) and DROPS the degraded-context placeholder block entirely:
```java
    public BigDecimal recipeFit(String slot, List<ScoredLine> perServingLines) {
        MealBreakdownJson breakdown = recipeTemplateBreakdown(slot, perServingLines);
        return breakdown == null ? null : breakdown.value();
    }

    public MealBreakdownJson recipeTemplateBreakdown(String slot, List<ScoredLine> perServingLines) {
        double kcal = sum(perServingLines, ScoredLine::kcal);
        if (kcal <= 0) {
            return null;
        }
        List<Dim> live = List.of(
            macroDim(perServingLines, kcal), microDim(perServingLines, kcal),
            whoDim(perServingLines, kcal), fatQualityDim(perServingLines, kcal),
            novaDim(perServingLines, kcal), plantDiversityDim(perServingLines, kcal),
            energyDensityDim(perServingLines, kcal), portionDim(slot, kcal));
        double weightSum = live.stream().mapToDouble(d -> d.effectiveWeight).sum();
        if (weightSum == 0) {
            return null;
        }
        double value = live.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = live.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;

        List<Dimension> dims = new ArrayList<>();
        for (Dim d : live) {
            dims.add(d.renormalized(weightSum).toJson());
        }

        List<ToolRow> tools = new ArrayList<>();
        tools.add(new ToolRow("read", "recipe.line_snapshots(n=" + perServingLines.size() + ")"));
        tools.add(new ToolRow("compute", "macroFit(mezo.nutrition)"));
        tools.add(new ToolRow("compute", "guidelineFit(who, fat_quality)"));
        tools.add(new ToolRow("compute", "templateFit(weights_renormalized)"));

        return new MealBreakdownJson(round2(value), round2(confidence), null, dims, List.of(), tools);
    }
```

(d) `microDim` shrinks to fiber-only (label stays computed the same way; new label string `"Rost & mikro"`):
```java
    private Dim microDim(List<ScoredLine> lines, double kcal) {
        double coveredKcal = lines.stream().filter(ScoredLine::hasMicroFacts)
            .mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("micro", "Rost & mikro", props.weights().micro(),
                "Nincs rost-adat a tételekhez.");
        }
        double kcalShare = kcal / targets.kcal();
        double fiber = sum(lines, ScoredLine::fiberG);
        double fiberRatio = fiber / (props.micro().fiberG() * kcalShare);
        double score = Math.min(1, fiberRatio);
        List<MicroRow> rows = List.of(
            new MicroRow("Rost", grams(fiber), pct(fiberRatio), fiberStatus(fiberRatio)));
        String text = String.format("Rost %s a(z) %s allotmenthez (%d%%).",
            grams(fiber), grams(props.micro().fiberG() * kcalShare), pct(fiberRatio));
        return new Dim("micro", "Rost & mikro", props.weights().micro(), score, coverage, text,
            null, rows, null, null);
    }
```

(e) The four new dimension methods + portion (place after `microDim`; all reuse `limitSub`, `Dim.degraded`, `ContextRow` rows):
```java
    // --- WHO (.14): free-sugar energy-share + salt allotment (mezo-7797) -----------------------

    private Dim whoDim(List<ScoredLine> lines, double kcal) {
        double coveredKcal = lines.stream().filter(ScoredLine::hasMicroFacts)
            .mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("who", "Ajánlások · WHO", props.weights().who(),
                "Nincs cukor/só-adat a tételekhez.");
        }
        double sugar = sum(lines, ScoredLine::sugarG);
        double salt = sum(lines, ScoredLine::saltG);
        double sugarShare = sugar * 4 / kcal;
        double sugarRatio = sugarShare / props.who().sugarEnergyShareLimit();
        double saltRatio = salt / (props.who().saltLimitG() * (kcal / targets.kcal()));
        double score = (limitSub(sugarRatio) + limitSub(saltRatio)) / 2;
        List<ContextRow> rows = List.of(
            new ContextRow("Cukor", String.format("%.0f E%% / %.0f E%% limit", sugarShare * 100,
                props.who().sugarEnergyShareLimit() * 100)),
            new ContextRow("Só", String.format("%s / %s keret", grams(salt),
                grams(props.who().saltLimitG() * (kcal / targets.kcal())))));
        String text = String.format("Cukor az energia %.0f%%-a (WHO ≤%.0f%%) · só a keret %d%%-án.",
            sugarShare * 100, props.who().sugarEnergyShareLimit() * 100, pct(saltRatio));
        return new Dim("who", "Ajánlások · WHO", props.weights().who(), score, coverage, text,
            null, null, null, rows);
    }

    // --- Fat quality (.10): satFat energy-share + saturated share of total fat -----------------

    private Dim fatQualityDim(List<ScoredLine> lines, double kcal) {
        double coveredKcal = lines.stream().filter(ScoredLine::hasMicroFacts)
            .mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        double fat = sum(lines, ScoredLine::f);
        if (kcal <= 0 || coverage == 0 || fat <= 0) {
            return Dim.degraded("fat_quality", "Zsírminőség", props.weights().fatQuality(),
                "Nincs zsír-összetétel adat a tételekhez.");
        }
        double satFat = sum(lines, ScoredLine::saturatedFatG);
        double satShare = Math.min(1, satFat / fat);
        double satEnergyShare = satFat * 9 / kcal;
        double score = (limitSub(satEnergyShare / props.fatQuality().satFatEnergyShareLimit())
            + limitSub(satShare / props.fatQuality().satFatShareRef())) / 2;
        List<ContextRow> rows = List.of(
            new ContextRow("Telített E%", String.format("%.0f%% / %.0f%% limit",
                satEnergyShare * 100, props.fatQuality().satFatEnergyShareLimit() * 100)),
            new ContextRow("Telített/összzsír", String.format("%.0f%% (ref. %.0f%%)",
                satShare * 100, props.fatQuality().satFatShareRef() * 100)));
        String text = String.format("Telített zsír az energia %.0f%%-a · az összzsír %.0f%%-a.",
            satEnergyShare * 100, satShare * 100);
        return new Dim("fat_quality", "Zsírminőség", props.weights().fatQuality(), score, coverage,
            text, null, null, null, rows);
    }

    // --- Plant diversity (.08): distinct plant categories ---------------------------------------

    private Dim plantDiversityDim(List<ScoredLine> lines, double kcal) {
        List<ScoredLine> categorized = lines.stream().filter(l -> l.category() != null).toList();
        double coveredKcal = categorized.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("plant_diversity", "Növényi diverzitás",
                props.weights().plantDiversity(), "Nincs kategória-adat a tételekhez.");
        }
        List<String> plants = categorized.stream().map(ScoredLine::category).distinct()
            .filter(props.plantDiversity().plantCategories()::contains).sorted().toList();
        double score = Math.min(1, (double) plants.size() / props.plantDiversity().targetCategories());
        List<ContextRow> rows = new ArrayList<>();
        rows.add(new ContextRow("Növényi kategóriák", plants.isEmpty() ? "—" : String.join(" · ", plants)));
        rows.add(new ContextRow("Összesen", plants.size() + " / " + props.plantDiversity().targetCategories() + " cél"));
        String text = String.format("%d különböző növényi kategória a %d-s célhoz.",
            plants.size(), props.plantDiversity().targetCategories());
        return new Dim("plant_diversity", "Növényi diverzitás", props.weights().plantDiversity(),
            score, coverage, text, null, null, null, rows);
    }

    // --- Energy density (.06): kcal/100g over gram-mass lines -----------------------------------

    private Dim energyDensityDim(List<ScoredLine> lines, double kcal) {
        List<ScoredLine> gramLines = lines.stream()
            .filter(l -> l.amountG() != null && l.amountG().signum() > 0).toList();
        double gramKcal = gramLines.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double grams = gramLines.stream().mapToDouble(l -> l.amountG().doubleValue()).sum();
        double coverage = kcal > 0 ? gramKcal / kcal : 0;
        if (kcal <= 0 || grams <= 0 || coverage == 0) {
            return Dim.degraded("energy_density", "Energia-sűrűség", props.weights().energyDensity(),
                "Nincs gramm-alapú mennyiség a tételekhez.");
        }
        double density = gramKcal / grams * 100;
        double good = props.energyDensity().goodKcalPer100g();
        double bad = props.energyDensity().badKcalPer100g();
        double score = density <= good ? 1 : density >= bad ? 0 : (bad - density) / (bad - good);
        List<ContextRow> rows = List.of(
            new ContextRow("Sűrűség", String.format("%.0f kcal/100g", density)),
            new ContextRow("Lefedettség", pct(coverage) + "% gramm-alapú"));
        String text = String.format("%.0f kcal/100g (%.0f alatt teljes pont, %.0f felett nulla).",
            density, good, bad);
        return new Dim("energy_density", "Energia-sűrűség", props.weights().energyDensity(),
            score, coverage, text, null, null, null, rows);
    }

    // --- Portion (.12, template only): per-serving kcal vs the slot budget ----------------------

    private Dim portionDim(String slot, double kcal) {
        double share = slot == null ? props.portion().defaultShare() : props.slotShares().of(slot);
        double budget = targets.kcal() * share;
        double rel = kcal / budget;
        double deviation = Math.max(0, Math.abs(rel - 1) - props.slotShareTolerance());
        double score = Math.max(0, 1 - deviation);
        List<ContextRow> rows = List.of(
            new ContextRow("Adag kcal", String.format("%.0f kcal", kcal)),
            new ContextRow("Slot-büdzsé", String.format("%.0f kcal (%s %.0f%%)",
                budget, slot == null ? "alap" : slotLabel(slot), share * 100)));
        String text = String.format("Egy adag a %s büdzsé %d%%-a.",
            slot == null ? "alapértelmezett" : slotLabel(slot), (int) Math.round(rel * 100));
        return new Dim("portion", "Adag-arány", props.weights().portion(), score, 1.0, text,
            null, null, null, rows);
    }
```

(f) `tools(...)` signature changes to `tools(String slot, List<ScoredLine> lines, List<Dim> dims, LocalTime t)`; find micro/nova by id inside (`dims.stream().filter(d -> d.id().equals("micro")).findFirst()...`) and add one row `new ToolRow("compute", "guidelineFit(who, fat_quality)")` after `macroFit`.

- [ ] **Step 6: Update the two composers + call sites (compile fix)**

(a) `RecipeService.fitLines` (~line 117): the `new ScoredLine(...)` gains two args after `hasFacts`:
```java
                p == null ? null : p.getCategory(),
                gramAmount(line.getAmount(), line.getUnit()));
```
Add the private helper to `RecipeService`:
```java
    /** Line amount in grams for mass units (ml≈g); null for discrete units (db etc.). */
    private static BigDecimal gramAmount(BigDecimal amount, String unit) {
        if (amount == null || unit == null) {
            return null;
        }
        return switch (unit.trim().toLowerCase()) {
            case "g", "ml" -> amount;
            case "kg", "l" -> amount.multiply(BigDecimal.valueOf(1000));
            default -> null;
        };
    }
```
NOTE: the fit lines are per-serving scaled by `factor` — the gram amount must scale the same way: pass `gramAmount(...)` through the same `factor` multiplication the macros use (`mul(gramAmount(line.getAmount(), line.getUnit()), factor)` — reuse the file's existing `mul` helper; keep null-safe).

(b) `RecipeService` call sites of `recipeFit(...)`/`recipeTemplateBreakdown(...)` gain the recipe's canonical slot as first arg (`recipe.getCategory()` — the non-null breakfast|lunch|dinner|snack field; `slot` is a free-form display label, corrected at final review; grep `recipeFit(` in the file).

(c) `RecipeBreakdownService.getOrGenerate` (~line 50): `scoringService.recipeTemplateBreakdown(recipe.getCategory(), recipeService.fitLines(...))`.

(d) `MealService` (~line 179): the `Facts` record gains `String category` and the composer computes `amountG` the same way — extend `Facts` to `Facts(BigDecimal fiber, BigDecimal sugar, BigDecimal salt, BigDecimal satFat, boolean present, String category)` with `NONE = new Facts(null, null, null, null, false, null)`; `pantryFacts` passes `p.getCategory()`, `recipeFacts` passes `null` (a recipe line inside a meal is a composite — no single category; honest null). The `new ScoredLine(...)` gains `facts.category(), gramAmount(item.getAmount(), item.getUnit())` — add the same `gramAmount` helper to `MealService` (duplicate of the RecipeService one; both private, two small copies acceptable per house norm of feature-local helpers).

- [ ] **Step 7: Run the engine tests until green**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest -DargLine=-Xmx3g`
Expected: PASS (all — new + existing-adjusted).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main api/ backend/src/test/java/io/mrkuhne/mezo/feature/nutrition
git -c core.hooksPath=/dev/null commit -m "feat(nutrition): 8-dimension scoring engine — WHO, fat quality, plant diversity, energy density, portion (mezo-7797)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — prose prompt + integration tests

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownApiIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownFallbackApiIT.java`, plus the meal-score ITs (`grep -rln "breakdown" backend/src/test/java/io/mrkuhne/mezo/feature/meal | head` — the ones asserting dimension count/ids)

**Interfaces:**
- Consumes: Task 2's 8-dim envelope.
- Produces: prose prompt narrates all 8 dimension ids; ITs assert the 8-dim envelope end-to-end.

- [ ] **Step 1: Extend the prose prompt**

Read `RecipeBreakdownProseService.java`; locate the prompt section that lists/describes the envelope dimensions for the LLM (the per-dimension glossary it uses to request Hungarian `detail` prose + `improve[]`). Extend it with one line per new id, verbatim:

```
- who: Ajánlások · WHO — cukor az energia %-ában (≤10% cél) és só-keret; magyarázd, mely hozzávaló viszi a cukrot/sót.
- fat_quality: Zsírminőség — telített zsír energia-aránya (≤10%) és a telített/összzsír arány; nevezd meg a fő zsírforrásokat.
- plant_diversity: Növényi diverzitás — hány különböző növényi kategória van a receptben (cél: 3+); javasolj konkrét bővítést.
- energy_density: Energia-sűrűség — kcal/100g; alacsonyabb = laktatóbb; jelezd, ha db-alapú tétel miatt részleges a lefedettség.
- portion: Adag-arány — egy adag kcal a slot-büdzséhez képest; jelezd, ha az adag túl nagy/kicsi a slothoz.
```

Keep the service's existing response-schema mechanics unchanged (it keys prose by dimension id — verify by reading; if the schema enumerates ids, extend the enumeration with the five new ids).

- [ ] **Step 2: Update the ITs (read each first, follow its existing assertions style)**

- `RecipeBreakdownApiIT`: wherever it asserts the dimension list (count/ids/order), expect the 8 template ids `macro, micro, who, fat_quality, nova, plant_diversity, energy_density, portion` (renormalized weights; NO `context`); adjust seeded expectations (the populator recipes carry facts, so who/fat_quality are live; plant_diversity/energy_density live only if the populator items carry category/gram units — read `RecipePopulator`/`PantryPopulator` and assert accordingly, degraded-dim expectations included).
- `RecipeBreakdownFallbackApiIT`: same dimension-set adjustment on the prose-less path.
- Meal ITs asserting `breakdown.dimensions`: expect 8 ids ending with `context`.
- Add one cache-invalidation IT to `RecipeBreakdownApiIT` if not already covered by an existing stale-cache test: persist a recipe with an OLD 4-dim envelope shape (store via the entity setter), GET the breakdown, assert the response envelope has 8 dimensions (the `matches()` size check regenerates it).

- [ ] **Step 3: Run the focused ITs**

Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest='RecipeBreakdown*IT' -DargLine=-Xmx3g`
Then: `./mvnw clean test -Dtest='Meal*IT' -DargLine=-Xmx3g`
Expected: PASS. (Full suite is CI's job.)

- [ ] **Step 4: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(recipe): prose prompt + ITs for the 8-dimension breakdown (mezo-7797)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — types, colors, rows panel, mock seed, tests

**Files:**
- Modify: `frontend/src/data/types.ts` (~line 49–59)
- Modify: `frontend/src/data/fuel/mealApi.ts` (DIMENSION_COLOR ~line 24 + `fromDimension` ~line 36)
- Modify: `frontend/src/features/fuel/components/DimensionCard.tsx`
- Modify: the recipes mock seed carrying `templateBreakdown` (locate: `grep -rn "templateBreakdown" frontend/src/data/fuel --include='*.ts' -l`)
- Tests: colocated — `frontend/src/data/fuel/mealApi.test.ts` (or the file's existing test), `frontend/src/features/fuel/components/` DimensionCard-covering test, `RecipeDetailPage.test.tsx` stays green

**Interfaces:**
- Consumes: regenerated `api.gen.ts` (Task 1), 8-dim envelopes (Task 2/3).
- Produces: `RowsDimension` FE type for ids `who|fat_quality|plant_diversity|energy_density|portion` with payload `context: {label, value}[]`; DIMENSION_COLOR entries; DimensionCard renders label/value rows for the new ids.

- [ ] **Step 1: Read `docs/references/frontend_conventions.md`, then extend `data/types.ts`**

```ts
export interface MealDimensionBase { id: 'macro' | 'micro' | 'nova' | 'context' | 'who' | 'fat_quality' | 'plant_diversity' | 'energy_density' | 'portion'; label: string; weight: number; score: number; color: string; detail: string }
```
Add after `ContextDimension`:
```ts
/** Generic label/value-row dimensions (mezo-7797): WHO, zsírminőség, növényi diverzitás, energia-sűrűség, adag-arány. Same payload shape as ContextDimension. */
export interface RowsDimension extends MealDimensionBase { id: 'who' | 'fat_quality' | 'plant_diversity' | 'energy_density' | 'portion'; context: { label: string; value: string }[] }
export type MealDimension = MacroDimension | MicroDimension | NovaDimension | ContextDimension | RowsDimension
```
(Keep the four existing interfaces byte-identical; only the base union + the final union line change.)

- [ ] **Step 2: Extend `mealApi.ts`**

DIMENSION_COLOR gains (tokens verified to exist in `prototype.css`):
```ts
  who: 'var(--sky)',
  fat_quality: 'var(--amber-deep)',
  plant_diversity: 'var(--sage-deep)',
  energy_density: 'var(--lav)',
  portion: 'var(--coral-deep)',
```
`fromDimension` gains one branch before the final degraded/`context` handling (read the full function first — the `context` branch pattern is the model):
```ts
  if ((d.id === 'who' || d.id === 'fat_quality' || d.id === 'plant_diversity'
    || d.id === 'energy_density' || d.id === 'portion') && d.context && d.context.length > 0) {
    return { id: d.id, ...base, context: d.context.map(c => ({ label: c.label, value: c.value })) } as MealDimension
  }
```

- [ ] **Step 3: Extend `DimensionCard.tsx`**

The per-dimension visual block gains one line (ContextPanel is already a pure label/value rows renderer; widen its prop type):
```tsx
      {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
        || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
        && <ContextPanel dim={dim} />}
```
and in `ContextPanel.tsx` change the prop to `{ dim: ContextDimension | RowsDimension }` (import `RowsDimension` from `@/data/types`). Remove the now-redundant standalone `{dim.id === 'context' && <ContextPanel dim={dim} />}` line.

- [ ] **Step 4: Extend the mock seed**

In the recipes mock seed file (grep above), the seeded `templateBreakdown` gains four new dimensions and replaces its degraded-context entry with a `portion` entry so mock mode exercises the full set. Keep seed style consistent with the neighbors; realistic values (they are display-only):
```ts
      { id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, color: 'var(--sky)', detail: 'Cukor az energia 6%-a (WHO ≤10%) · só a keret 55%-án.', context: [ { label: 'Cukor', value: '6 E% / 10 E% limit' }, { label: 'Só', value: '0.8 g / 1.5 g keret' } ] },
      { id: 'fat_quality', label: 'Zsírminőség', weight: 0.10, score: 0.85, color: 'var(--amber-deep)', detail: 'Telített zsír az energia 5%-a · az összzsír 24%-a.', context: [ { label: 'Telített E%', value: '5% / 10% limit' }, { label: 'Telített/összzsír', value: '24% (ref. 33%)' } ] },
      { id: 'plant_diversity', label: 'Növényi diverzitás', weight: 0.08, score: 1.0, color: 'var(--sage-deep)', detail: '3 különböző növényi kategória a 3-s célhoz.', context: [ { label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' }, { label: 'Összesen', value: '3 / 3 cél' } ] },
      { id: 'energy_density', label: 'Energia-sűrűség', weight: 0.06, score: 0.78, color: 'var(--lav)', detail: '182 kcal/100g (150 alatt teljes pont, 400 felett nulla).', context: [ { label: 'Sűrűség', value: '182 kcal/100g' }, { label: 'Lefedettség', value: '100% gramm-alapú' } ] },
      { id: 'portion', label: 'Adag-arány', weight: 0.12, score: 0.95, color: 'var(--coral-deep)', detail: 'Egy adag a reggeli büdzsé 89%-a.', context: [ { label: 'Adag kcal', value: '689 kcal' }, { label: 'Slot-büdzsé', value: '775 kcal (reggeli 25%)' } ] },
```
Adjust the existing seed dims' weights to the new config (macro 0.22, micro 0.10, nova 0.18) and reduce the seeded micro rows to the single Rost row (matching the redistribution). Update any seed-coupled test expectations that assert the old rows (grep `'Cukor'`/`Mikro–makro` in `frontend/src`).

- [ ] **Step 5: Add/extend FE tests**

In the mealApi test (or create `mealApi.test.ts` next to it if none covers `fromDimension`): a contract dimension `{ id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, detail: 'x', context: [{label: 'Cukor', value: '6 E%'}] }` maps to a `RowsDimension` with the injected `var(--sky)` color; a degraded new-id dimension (weight 0, empty context) is dropped. In the DimensionCard-covering test: a `RowsDimension` renders its label/value rows.

- [ ] **Step 6: Run the FE gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, ALL tests green in BOTH modes (including the untouched `RecipeDetailPage.test.tsx` / `MealScoreSheet` tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): render the 8-dimension score envelope — rows panel, colors, mock seed (mezo-7797)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs + land

**Files:**
- Modify: `docs/features/fuel.md` (the P7 scoring sentences + the recipe-breakdown paragraph)
- Ops: lint, push, self-PR, CI, merge, bd close

- [ ] **Step 1: Update `docs/features/fuel.md`**

(a) In the §intro P7 sentence "**the 4-dimension meal score is REAL since Fuel P7 (mezo-yta, ADR 0006): a deterministic engine (`MealScoringService`, `feature/nutrition`) scores every meal at write (Macro .30 · Micro .25 · NOVA .25 · Context .20 → …" — update to: "**the meal score is REAL since Fuel P7 (mezo-yta, ADR 0006) and 8-dimensional since mezo-7797: a deterministic engine (`MealScoringService`, `feature/nutrition`) scores every meal at write (Macro .22 · Rost .10 · WHO .14 · Zsírminőség .10 · NOVA .18 · Növényi diverzitás .08 · Energia-sűrűség .06 · Context .12 → …" (keep the rest of the sentence).
(b) In the recipe AI-breakdown sentence, "the deterministic 3-dim envelope" → "the deterministic 7-dim template envelope (8 with Adag-arány replacing the meal-side Context since mezo-7797)" — phrase precisely: template = macro, rost, who, zsírminőség, nova, növényi diverzitás, energia-sűrűség, adag-arány.
(c) Wherever the doc describes the Micro dimension rows (Rost/Cukor/Só/Telített zsír) update to fiber-only + the new WHO/Zsírminőség dimensions carrying sugar/salt/satFat.
Run `node scripts/lint-docs.mjs` → fuel.md must be clean after the commit (git-drift clears on commit; the 4 pre-existing stale docs from other work streams are NOT this change's concern).

- [ ] **Step 2: Commit docs**

```bash
git add docs/features/fuel.md
git -c core.hooksPath=/dev/null commit -m "docs(fuel): 8-dimension scoring model (mezo-7797)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push + self-PR + CI + merge**

```bash
git push -u origin feat/recipe-scoring-dimensions
gh pr create --title "feat(nutrition): 8-dimension meal/recipe scoring (mezo-7797)" --body "Extends the deterministic scoring engine to 8 dimensions with clean fact redistribution: Rost-only Mikro; new Ajánlások·WHO (sugar E% + salt), Zsírminőség (satFat E% + sat share), Növényi diverzitás, Energia-sűrűség; template-side Adag-arány replaces the weight-0 context placeholder. Contract id-pattern widened; FE renders the new dims via the generic rows panel. Spec: docs/superpowers/specs/2026-07-25-recipe-scoring-dimensions-design.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr view --json mergeable --jq .mergeable   # must be MERGEABLE (conflicting PR never starts CI)
gh pr checks --watch --interval 30
```
CI green (the FULL backend suite runs here — authoritative gate) → merge:
```bash
gh pr merge --merge          # NO --delete-branch (main is checked out in another worktree; gh's local cleanup fails)
git push origin --delete feat/recipe-scoring-dimensions
```

- [ ] **Step 4: bd close (MAIN checkout)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
bd close mezo-7797
bd update mezo-7797 --notes="Shipped via feat/recipe-scoring-dimensions (self-PR, CI full suite green, gh pr merge). 8-dim engine both surfaces; spec docs/superpowers/specs/2026-07-25-recipe-scoring-dimensions-design.md."
bd dolt push
```

---

## Self-Review (done)

1. **Spec coverage:** dimension set + formulas (Task 2 Step 5 mirrors spec §1 exactly) ✓ · weights + dual-sum validation (Task 2 Steps 1–2 = spec §2) ✓ · carrier + composers (Task 2 Step 6 = spec §3) ✓ · contract + FE (Tasks 1, 4 = spec §4) ✓ · prose (Task 3 = spec §5) ✓ · caching/compat (Task 3 Step 2 invalidation IT = spec §6) ✓ · testing (Tasks 2/3/4 = spec §7) ✓ · docs (Task 5 = spec §8) ✓.
2. **Placeholder scan:** two deliberate bounded lookups remain (plant-category exact spellings vs the pantry contract; prose prompt location) — each carries the exact command/file to resolve it; all code steps carry complete code.
3. **Type consistency:** `ScoredLine` 14-field order consistent between Task 2 Steps 3 (helpers), 5(a), and 6; `recipeTemplateBreakdown(String, List)` consistent across engine/callers/tests; FE `RowsDimension` id list matches the contract pattern and DIMENSION_COLOR keys.
