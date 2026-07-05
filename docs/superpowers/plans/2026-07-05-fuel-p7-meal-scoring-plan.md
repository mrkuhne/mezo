# Fuel P7 — Deterministic Meal-Scoring v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** populate `meal.score` + `meal.breakdown` (and `RecipeResponse.mezoFit.score`) with a real
deterministic 4-dimension score; zero new UI.

**Architecture:** a pure-math `MealScoringService` (feature/meal) computes the typed envelope at
meal write-time (persisted: the envelope IS the micro snapshot) and at recipe read-time
(fit = macro+micro+nova, renormalized). Config-driven weights/thresholds via
`MealScoringProperties` (`mezo.fuel.scoring.*`). Contract tightened (`MealBreakdown` typed schema).
FE only maps + guards — no new components.

**Tech stack:** Spring Boot 4/Java 21, Liquibase, MapStruct-free hand mappers (house pattern),
OpenAPI contract-first, React 19 + vitest + MSW.

**Design spec:** `docs/superpowers/specs/2026-07-05-fuel-p7-meal-scoring-design.md` (formulas §3).

## Global constraints

- Contract-first: `api/feature/meal/meal.yml` + `recipe.yml` BEFORE code; regenerate both sides.
- `./mvnw clean test` (never without `clean`); FE gates: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- No `@Value`; config via `@Validated` records under `mezo:`. AssertJ only; ITs extend the two bases.
- Hook signatures + view/component props stay stable (additive-only FE changes).
- Conventional commits carrying `(mezo-yta)`.

---

### Task 1 — Contract: typed MealBreakdown + RecipeLog.score + novaDominant integer

**Files:** Modify `api/feature/meal/meal.yml`, `api/feature/recipe/recipe.yml`; regen
`api/openapi.yml` (`cd api/generate && npm run generate:api`) + `frontend/src/data/_client/api.gen.ts`
(`cd frontend && pnpm generate:api`).

- [ ] `MealScore.breakdown` → `{ $ref: MealBreakdown, nullable: true }` (via allOf+nullable or direct ref per merged-file conventions).
- [ ] New schemas: `MealBreakdown { value, confidence, summary(nullable), dimensions[], improve[], tools[] }`;
  `MealScoreDimension { id(pattern macro|micro|nova|context), label, weight, score, detail, macro?, micros?, nova?, context? }`;
  `MealMacroDetail { ratioP/ratioC/ratioF, targetP/targetC/targetF (strings), kcalShareOfDay, notes(nullable) }`;
  `MealMicroRow { name, value, pct, status(pattern good|ok|low) }`;
  `MealNovaDetail { dominant(integer), stack[MealNovaStackRow], items[MealNovaItemRow] }`;
  `MealNovaStackRow { nova, pct, label }`; `MealNovaItemRow { name, nova, warning }`;
  `MealContextRow { label, value }`; `MealImproveRow { text, impact }`; `MealToolRow { type, name }`.
- [ ] `RecipeLogResponse` + `score: { type: number, nullable: true }`.
- [ ] `recipe.yml` `novaDominant: { type: number }` → `{ type: integer }` (mezo-2dy).
- [ ] Regenerate both outputs; commit contract + generated files.

### Task 2 — Migration + entity: `meal.score` column

**Files:** Create `backend/src/main/resources/db/changelog/1.0.0/script/202607051000_mezo-yta_meal_score_column.sql`;
modify `1.0.0_master.yml`, `MealEntity.java`.

- [ ] SQL: `ALTER TABLE meal ADD COLUMN score numeric;` (nullable, no index).
- [ ] Changeset id `1.0.0:202607051000_mezo-yta_meal_score_column`, author `daniel.kuhne`.
- [ ] `MealEntity` + `@Column(name = "score") private BigDecimal score;`.

### Task 3 — Config: `MealScoringProperties` + application.yml

**Files:** Create `backend/.../feature/meal/config/MealScoringProperties.java`; modify
`application.yml` (+ test yml if overrides needed).

- [ ] Record, `@Validated @ConfigurationProperties(prefix = "mezo.fuel.scoring")`, nested records:
  `Weights(macro,micro,nova,context)` with `@AssertTrue` sum≈1 check; `novaGroupScores Map<Integer,Double>`
  (or 4 fields); `macroDeviationSlope`; `MicroRefs(fiberG, sugarLimitG, saltLimitG, saturatedFatLimitG)`;
  `SlotShares(breakfast,lunch,dinner,snack)`; slot windows (`breakfastFrom/To` … as `int` hours);
  `contextShareTolerance`. Javadoc + YAML comments per configuration_conventions.
- [ ] YAML defaults: weights .30/.25/.25/.20; nova 1.0/.85/.55/.20; slope 2.0; fiber 38, sugar 78,
  salt 6, satfat 34; shares .25/.35/.30/.10; windows 5–10/11–15/17–22; tolerance 0.4.

### Task 4 — Backend scoring engine (TDD)

**Files:** Create `backend/.../feature/meal/service/MealScoringService.java`, replace
`entity/MealBreakdownJson.java` (full envelope records: `MealBreakdownJson`, `ScoreDimensionJson`,
`MacroDetailJson`, `MicroRowJson`, `NovaDetailJson(+rows)`, `ContextRowJson`, `ToolRowJson` — one
file per record or nested); test `MealScoringServiceIT` (or unit-style test if pure — inputs are
resolved entities + config record, so a **plain unit test** with a constructed properties record is
correct per testing_standards "pure utility" rule; ITs cover the wire-through).

- [ ] Failing tests first: `testScoreMeal_shouldWeightDimensions_whenAllCovered`,
  `testScoreMeal_shouldRenormalize_whenNovaCoverageZero`, `testScoreMeal_shouldScaleMicroFacts_byAmountPer`,
  `testScoreMeal_shouldScoreRecipeArm_fromIngredientPantryRows`, `testScoreMeal_shouldDeriveContext_fromSlotAndLocalHour`,
  `testRecipeFit_shouldExcludeContext_andRenormalize`.
- [ ] API: `MealBreakdownJson scoreMeal(MealEntity meal, Map<UUID,PantryItemEntity> pantryByLine, Map<UUID,List<RecipeIngredientEntity>> recipeIngredients, Map<UUID,PantryItemEntity> recipePantry, OffsetDateTime loggedAtLocal)`
  — exact shape may collapse into a small `ScoringInput` carrier built by `MealService`;
  `BigDecimal recipeFit(RecipeEntity recipe, Map<UUID,PantryItemEntity> pantryById)`.
- [ ] Formulas exactly per spec §3; 2-decimal HALF_UP on every emitted score/value/confidence.

### Task 5 — Wire-through: MealService, MealMapper, RecipeService/Mapper, recipeLogs

**Files:** Modify `MealService.java` (score at create/update; pass the request's offset-bearing
`loggedAt`), `MealMapper.java` (`toScore(e)` emits real value+breakdown from the entity),
`RecipeService`/`RecipeMapper` (fit at read; batch pantry fetch), `MealService.recipeLogs`
(+ meal score into `RecipeLogResponse`).

- [ ] `MealApiIT`: flip the null assertion (`MealApiIT:135`) → score present, `value` in [0,1],
  breakdown 4 dimensions, weights sum 1; + a degraded-NOVA case; recipe-arm case.
- [ ] `RecipeApiIT`: `mezoFit.score` non-null for a recipe with macro-carrying lines.
- [ ] Populator growth: `PantryItemPopulator` overload with fiber/sugar/salt/satFat;
  keep existing tests green (additive).
- [ ] `./mvnw clean test` green.

### Task 6 — FE mapping + guards + fold-ins

**Files:** Modify `frontend/src/data/fuel/mealApi.ts` (breakdown fromResponse + color inject —
new small `data/fuel/scoreMeta.ts` for the per-id color map), `data/types.ts`
(`MealBreakdown.summary: string | null`), `features/fuel/sheets/MealScoreSheet.tsx` (hide summary
when null), `features/fuel/components/RecipeLogsList.tsx` (use `baselineScore` for delta),
`data/fuel/mealApi.ts` recipe-log mapping (+score), `data/nova.ts` (`NOVA_META[1].color` →
`var(--cat-response)`, mezo-0xh.30), `frontend/src/test/msw/handlers.ts` (shared `P_TURO` macros,
mezo-24j; scored-meal fixture for mapping tests).

- [ ] Tests: `mealApi` fromResponse reconstructs the 4-dim union + colors + null-breakdown passthrough;
  `MealScoreSheet` renders without summary; `RecipeLogsList` delta vs baseline; existing suites.
- [ ] Gates: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

### Task 7 — Verify live, docs, close

- [ ] Live-drive real mode (backend demodata + `pnpm dev`): log a meal from Kamra/recipe → tap the
  scored meal on Mai → `MealScoreSheet` shows real dimensions; recipe card fit badge lights up.
- [ ] `docs/features/fuel.md`: §status/§2 Mai/§3/§4/§9 — score real; `docs/milestones/roadmap.md` row.
- [ ] `node scripts/lint-docs.mjs` PASS.
- [ ] `--no-ff` merge to main (pull --rebase BEFORE), `bd dolt push && git push`, close `mezo-yta`
  + fold-ins `mezo-2dy`/`mezo-0xh.30`/`mezo-24j` with notes.
