# Boop receptértékelés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the munkamenet default) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The recipe sheet's „Boop értékelése" becomes the approved spike card — rosette hero with a food-specific
verdict, „Ha ma megennéd", 2×4 dimension tiles opening a long detail page over a blurred sheet, rank among the owner's
recipes, tips tied to a dimension, „Hasznos volt?" — in the Étel colours (green + honey + coral).

**Architecture:** Backend: the recipe prose prompt gains `tagline`, longer food-specific `details`, `improve[].dimension`;
a `proseVersion` stamp on the stored envelope makes old cached prose stale; a pure `RecipeContributors` computes the
top ingredients per nutrient dimension from the same per-serving lines the scorer reads, overlaid on every read (never
persisted, never the LLM's). All wire fields additive/optional. iOS: BoopKit maps the payloads it drops today + the new
fields + a feedback client; app-side pure logic (day impact, rank, verdict fallback, extremes) is unit-tested; the views
are ported from the spike (`spike/boop-receptertekeles`, `ios/Boop/ReceptDemo/ReceptErtekelesDemo.swift` — look
reference only, **not merged**).

**Tech Stack:** Spring Boot 3 / Java 21, contract-first OpenAPI (`api/feature/meal/meal.yml` → `api/generate`), SwiftUI
iOS 26, Swift Testing, swift-openapi-generator (filter `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`).

**Spec:** `docs/superpowers/specs/2026-11-27-boop-receptertekeles-design.md` (§5.4 overrides §5.1) · decisions
#139–#140 · bd `mezo-r36n9.199` (acceptance = *Kész, ha…* at the end).

## Global Constraints

- Napkelte: dark glass cards (`EtelSheetCard`); Étel colours exactly: main `#3FBF8F`, honey `#F4C860`, coral `#F28B6E`;
  dimension shades macro `#3FBF8F`, micro `#A9D86B`, who `#F28B6E`, fat_quality `#F4C860`, nova `#7FDCC0`,
  plant_diversity `#6CC46A`, energy_density `#F5A65B`, portion `#F2A3B3`; day bars kcal green, protein coral, carbs
  honey, fat mint, „eddig ma" grey; tip glyphs honey; weakest marker amber, never red.
- Never an AI-written number the engine didn't give; no daily targets in the prompt.
- No emoji, never „Mezo" in a visible string; Dynamic Type largest (rosette stacked above verdict, tiles 2×2);
  VoiceOver label per tile (name, points, weakest/strongest); reduced motion → no bar/petal animation.
- „Ha ma megennéd" = exactly one serving (`Recipe.perServing`), from the same `EtelStore.day` as Étel Ma; hidden when
  that day is missing or not today. Over target = same hue + „felett", not red.
- Wire changes additive and optional; the installed app keeps working against the new server.

## Review Focus

1. **Old cached envelope** (no `proseVersion`, null tagline, no `dimension`) → regenerated on next open; while prose is
   off the deterministic envelope shows with the local verdict fallback, no blank headline. (Task 2 IT, Task 5 test.)
2. **Degraded dimensions** (weight 0) → faint petal stub, tile „—", never weakest/strongest, no detail numbers invented.
   (Task 5 `extremes` test.)
3. **Kímélő day (`fuelMode == "GUIDANCE"`) / target 0** → day block shows eaten → after only, sentence without a target
   percentage. (Task 5 day tests.)
4. **Fewer than 3 scored recipes / ties** → rank block hidden / tied recipes share a rank. (Task 5 rank tests.)
5. **Recipe lines without nutrient facts** (null salt/sugar) → no contributor rows for that nutrient, „HONNAN JÖN"
   hidden, never a 0 g row. (Task 1 unit test.)

---

### Task 1: Contract + per-ingredient contributors (backend)

**Files:**
- Modify: `api/feature/meal/meal.yml` (`MealScoreDimension.contributors`, new `MealContributorRow`,
  `MealImproveRow.dimension`), then `cd api/generate && npm run generate:api`; `ios/scripts/sync-openapi.sh`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/mapper/BreakdownDtoMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeContributors.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/service/RecipeContributorsTest.java`

**Interfaces:**
- Produces (wire): `MealContributorRow { name: string, nutrient: 'salt'|'sugar'|'saturated_fat'|'fiber'|'kcal',
  amount: number, unit: string, share: number /*0..1*/ }`; `MealScoreDimension.contributors: MealContributorRow[]?`
  (nullable, absent on meals); `MealImproveRow.dimension: string?` (nullable).
- Produces (Java): `MealBreakdownJson.Contributor(String name, String nutrient, BigDecimal amount, String unit,
  BigDecimal share)`; `Dimension` gains last component `List<Contributor> contributors` + a 12-arg compat constructor
  (contributors null) so existing call sites stay; `ImproveRow(String text, String impact, String dimension)` + 2-arg
  compat; `MealBreakdownJson` gains last component `Integer proseVersion` (not on the wire) + compat constructors for
  the existing 8- and 9-arg shapes.
- Produces: `static MealBreakdownJson RecipeContributors.attach(MealBreakdownJson env, List<MealScoringService.ScoredLine> perServingLines)`
  — returns a copy whose `who` (salt then sugar), `fat_quality` (saturated_fat), `micro` (fiber), `nova` (kcal of lines
  with NOVA ≥ 3) dimensions carry contributors: top 3 per nutrient by amount, `share` = line ÷ recipe total (4 dp),
  amount rounded to 1 dp (kcal 0 dp), units `g`/`kcal`; null/zero amounts skipped; a nutrient with no row → none;
  degraded dimensions (weight 0) get none. Other dimensions untouched.

- [ ] **Step 1: Write `RecipeContributorsTest`** — `testAttach_shouldRankTopThreeSaltSources_whenFourLinesCarrySalt`
  (4 lines salt 1.2/0.4/0.2/0.1 g → who contributors names in that order, size 3, share of first = 1.2/1.9 → 0.6316),
  `testAttach_shouldSkipLinesWithoutFacts_whenSaltIsNull` (null salt everywhere → who has no salt rows),
  `testAttach_shouldListOnlyProcessedLines_whenNovaDimensionLive` (NOVA 1/3/4 lines → nova rows = the NOVA 3 and 4
  lines, nutrient `kcal`), `testAttach_shouldLeaveDegradedDimensionEmpty_whenWeightZero`.
- [ ] **Step 2: Run** `cd backend && ./mvnw -q test -Dtest=RecipeContributorsTest` → FAIL (class missing).
- [ ] **Step 3: Contract** — edit `meal.yml`, regenerate, sync to BoopKit; extend the records + mapper (contributors,
  improve dimension); implement `RecipeContributors`.
- [ ] **Step 4: Run** the test → PASS; `./mvnw -q clean compile` green.
- [ ] **Step 5: Commit** `feat(api): recipe breakdown contributors + improve dimension on the wire (mezo-r36n9.199)`.

### Task 2: Food-specific prose + cache invalidation (backend)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownService.java`
- Test: `.../recipe/service/RecipeBreakdownProseServiceTest.java`, `.../recipe/RecipeBreakdownApiIT.java`,
  `RecipeLanguageTest` (must stay green)

**Interfaces:**
- Consumes: Task 1 records, `RecipeContributors.attach`.
- Produces: `static final int PROSE_VERSION = 2` in `RecipeBreakdownProseService`; `merge(...)` package-private, writes
  `tagline` (trimmed, blank → null), `improve[].dimension` (kept only when it is one of the envelope's dimension ids,
  else null), `proseVersion = PROSE_VERSION`.

Prompt changes (`SYSTEM_PROMPT`; keep the exact line `- Write Hungarian, tegeződve, tömören.` so the neutral variant
still replaces it): JSON gains `"tagline":string` and `improve` items `{"text","impact","dimension"}`; rules —
tagline one sentence ≤ 70 characters naming the recipe's defining trait and its weakest point; summary leads with the
most telling fact, names real ingredients from HOZZÁVALÓK; banned openers listed verbatim („Ez egy", „Ez a recept",
„Ez a sablon"); details 3–4 sentences each, name the ingredients behind the number, only numbers present in the input;
each improve a concrete swap/add with an amount, `dimension` = the id it lifts. The user message gains, per
contributor-carrying dimension, a line `FORRÁSOK <id>: <name> <amount><unit> (<share%>)…` so the prose can name sources
without inventing figures.

- [ ] **Step 1: Tests** — unit: `testMerge_shouldKeepTaglineAndStampProseVersion_whenLlmGivesTagline`,
  `testMerge_shouldDropUnknownImproveDimension_whenIdNotInEnvelope`, `testUserMessage_shouldListSaltSources_whenWhoHasContributors`,
  `testSystemPrompt_shouldBanTemplateOpeners` (contains „Ez egy" in the banned list and `"tagline"`).
  IT (sentinel JSON with `"tagline":"Fehérjében erős, a só húzza le."` and an improve with `"dimension":"micro"`):
  extend `testGetBreakdown_shouldReturnEnrichedEnvelopeAndPersist_whenLlmAnswers` to assert tagline, improve
  dimension `micro`, stored `proseVersion` = 2; new `testGetBreakdown_shouldRegenerate_whenCachedProseVersionIsOld`
  (persist an envelope equal in numbers but `proseVersion` null → response re-enriched, stored version 2); new
  `testGetBreakdown_shouldCarryContributors_evenWhenServedFromCache` (a food with fiber facts → `micro.contributors`
  non-empty on the first and the cached second read).
- [ ] **Step 2: Run** `./mvnw -q test -Dtest='RecipeBreakdownProseServiceTest,RecipeLanguageTest'` and
  `./mvnw test -Dtest=RecipeBreakdownApiIT -Dmezo.test.use-testcontainers=true` → new ones FAIL.
- [ ] **Step 3: Implement** prompt + merge + `matches()` (`stored.proseVersion() == null || < PROSE_VERSION` → stale) +
  `RecipeContributors.attach(...)` applied to whichever envelope `getOrGenerate` returns (cached, enriched or
  deterministic) using the `fitLines` it already computed; contributors are also passed to `enrich` for the prompt.
- [ ] **Step 4: Run** both commands → PASS; `ArchitectureTest` green; `node scripts/gen-codemap.mjs`.
- [ ] **Step 5: Commit** `feat(recipe): food-specific breakdown prose with tagline, stale old prose (mezo-r36n9.199)`.

### Task 3: BoopKit mapping + feedback client

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/FoodModels.swift`, `.../Etel/FoodClient.swift` (map at ~l.1150)
- Modify: `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (+ `listFeedback`, `putFeedback`, `deleteFeedback`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/FoodRecipeClientTests.swift`

**Interfaces:**
- Produces: `ScoreDimension` gains `macro: DimensionMacro?` (`ratioP/C/F: Double`, `targetP/C/F: String`),
  `micros: [DimensionMicro]` (`name, value: String, pct: Int, status: String`), `nova: DimensionNova?`
  (`dominant: Int, stack: [(nova: Int, pct: Int, label: String)]` as a struct `NovaShare`, `items: [NovaItem]`
  (`name, nova: Int, warning: Bool`)), `context: [DimensionFact]` (`label, value`), `contributors: [Contributor]`
  (`name, nutrient, amount: Double, unit, share: Double`) — all defaulted in `init` so existing callers compile.
  `MealImprove.dimension: String?` (default nil).
- Produces: `FoodClient.breakdownVote(recipeId: UUID) async throws -> Bool?` (listFeedback kind `recipe_breakdown`,
  ids [id]; up → true, down → false, none → nil) and `FoodClient.setBreakdownVote(recipeId: UUID, up: Bool?) async throws`
  (nil → deleteFeedback, else putFeedback verdict up/down).

- [ ] **Step 1: Tests** — `recipeBreakdownMapsPayloadsAndContributors` (stub JSON with a `who` dim carrying `context`
  rows + 2 contributors, a `nova` dim with stack/items, an improve with `dimension: "who"` → mapped fields equal),
  `recipeBreakdownToleratesOldEnvelope` (no contributors/dimension keys → empty arrays / nil),
  `breakdownVoteReadsUpVerdict`, `setBreakdownVoteNilDeletes` (asserts the DELETE path is called).
- [ ] **Step 2: Run** `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination '<own simulator>' -skipPackagePluginValidation -derivedDataPath ../build/kit -only-testing:BoopCoreTests/FoodRecipeClientTests` → FAIL.
- [ ] **Step 3: Implement** models, mapping, generator filter, the two client calls.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(boopkit): map recipe breakdown payloads, contributors, feedback votes (mezo-r36n9.199)`.

### Task 4: Étel palette

**Files:**
- Create: `ios/Boop/Etel/EtelPalette.swift`

**Interfaces:**
- Produces: `enum EtelPalette { static let main, honey, coral, mint, amber: Color; static func dimension(_ id: String) -> Color;
  static func dayMacro(_ key: DayMacro) -> Color }` with `enum DayMacro { case kcal, protein, carbs, fat }`; hex values
  from Global Constraints (`amber` = the spike's weakest marker `Color(red: 0.96, green: 0.78, blue: 0.38)`).
  Folded into Task 6's commit (no own test; values are exercised by the views).

### Task 5: Pure score logic (app)

**Files:**
- Create: `ios/Boop/Etel/RecipeScoreLogic.swift`
- Test: `ios/BoopTests/RecipeScoreLogicTests.swift`

**Interfaces:**
- Produces:
  - `struct DayImpactRow { key: DayMacro; eaten, after: Double; target: Double? }` and
    `struct DayImpact { rows: [DayImpactRow]; sentence: String }`;
    `func recipeDayImpact(day: FoodDay?, todayYmd: String, serving: Macros) -> DayImpact?` — nil when `day` is nil or
    `day.date != todayYmd`; GUIDANCE → `target` nil on every row.
  - `func dayImpactSentence(rows: [DayImpactRow], guidance: Bool) -> String` — templates (numbers rounded, Hungarian
    thousands separator „1 650"):
    guidance „Ma kímélő nap van — ezzel {after kcal} kcal-nál tartanál." ·
    kcal over „Ezzel {over} kcal-lal a napi kereted felett lennél." ·
    normal with protein target „Ezzel a fehérjecélod {pct}%-án lennél, és még {left} kcal maradna mára." ·
    protein target 0 „Ezzel még {left} kcal maradna mára."
  - `struct RecipeRank { position, of: Int; standout: (macro: DayMacro, position: Int)? }`;
    `func recipeRank(id: UUID, recipes: [Recipe]) -> RecipeRank?` — over recipes with non-nil `fit`; nil when < 3 or
    this one unscored; position = 1 + count(fit > mine) (ties share); standout = best per-serving rank among protein,
    carbs, fat (tie order protein, carbs, fat).
  - `func recipeEatenLine(logs: [RecipeLog], now: Date) -> String?` — „6× etted (utoljára nov. 22.)", nil when empty.
  - `func dimensionExtremes(_ dims: [ScoreDimension]) -> (weakest: String?, strongest: String?)` — over weight > 0 only;
    nil both when < 2 live or weakest == strongest.
  - `func recipeVerdict(_ b: MealBreakdown) -> String` — tagline when non-empty and ≤ 90 chars, else fallback by score
    band (≥ 80 „Erős recept", ≥ 60 „Jó alap", else „Van rajta mit javítani") + „, a(z) {weakest label} húzza le." when a
    weakest exists, else „.".
- [ ] **Step 1: Tests** — one per function and every template/branch above, plus: day not today → nil; degraded dims
  excluded from extremes; tie → shared rank; 2 scored recipes → nil; tagline of 120 chars → fallback.
- [ ] **Step 2: Run** `cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination '<own simulator>' -skipPackagePluginValidation -derivedDataPath build/app -only-testing:BoopTests/RecipeScoreLogicTests` → FAIL.
- [ ] **Step 3: Implement**. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(boop): recipe score logic — day impact, rank, verdict (mezo-r36n9.199)`.

### Task 6: The card + detail page (app)

**Files:**
- Create: `ios/Boop/Etel/RecipeScoreCard.swift` (hero `Rosette`/`Petal`, day block, 2×4 tiles, rank strip, tips,
  feedback row — ported from the spike's `ReceptErtekelesDemoRoot`, `Rosette`, `Petal`, `RankStrip`)
- Create: `ios/Boop/Etel/RecipeDimensionDetail.swift` (spike `DimDetail`: icon + name + big number, long bar, chips
  leggyengébb/legerősebb · súly % · lefedettség, MIT MÉR, MIÉRT ENNYI = `detail`, A SZÁMOK from
  macro/micros/nova/context, HONNAN JÖN from contributors, ÍGY JAVÍTHATÓ = improve rows with this `dimension`, Kész)
- Modify: `ios/Boop/Etel/RecipeDetail.swift` (`score()` → `RecipeScoreCard`; the detail page is an overlay inside the
  sheet over `.blur` of the content, tap on the dim background closes; loads the vote with the breakdown)
- Modify: `ios/Boop/Connect/PreviewTransport.swift` (preview breakdown carries tagline, contributors, improve dimension)

**Interfaces:**
- Consumes: Tasks 3–5. `RecipeScoreCard(recipe:, breakdown: RecipeBreakdown, day: FoodDay?, recipes: [Recipe],
  logs: [RecipeLog]?, vote: Bool?, onVote: (Bool?) -> Void, onOpen: (ScoreDimension) -> Void)`.
- Feedback: shown only when `summary` is non-empty; optimistic, revert + toast „Nem sikerült elmenteni" on failure;
  re-tapping the same choice clears it.
- Loading/error states unchanged from today (ring + „számolom", retry button).

- [ ] **Step 1:** Build the views; existing `DimensionSheet` stays for the meal/pantry pages.
- [ ] **Step 2:** Full Boop test suite + BoopKit suite on the own simulator → green.
- [ ] **Step 3:** Simulator walk-through with preview data: full, loading, error, detail page, largest Dynamic Type,
  VoiceOver labels (accessibility inspector), reduced motion, iPhone SE width; screenshots compared to
  `docs/superpowers/specs/assets/receptertekeles/`.
- [ ] **Step 4: Commit** `feat(boop): recipe evaluation card — rosette, day, tiles, detail page (mezo-r36n9.199)`.

### Task 7: Docs, gates, ship

- [ ] `docs/features/boop-ios.md` + `docs/features/recipe.md` (prose contract, contributors, proseVersion), handbook
  `docs/boop-handbook/06-etel/05-receptek.md`, `_kiadasok.json` row at merge; `node scripts/gen-codemap.mjs`,
  `node scripts/lint-docs.mjs` 0/0.
- [ ] Backend: focused tests above + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true`.
- [ ] munkamenet lezárás: `--no-ff` merge via detached HEAD → push → deploy green, pod tag = release → spot-check 3
  live recipes (tagline present after open, no number contradicting the engine) → install on the phone + walk-through
  → Notion once (boop-notion-sync worker) → tracker backup → Hungarian report.

## Kész, ha…

- [ ] The built card matches the approved spike (order, rosette, 2×4 tiles, blurred detail page, colours #139–#140).
- [ ] A recipe opens with verdict, confidence, fitsFor, summary, day block, tiles, rank, tips (with dimension pill),
  feedback; an old cached recipe regenerates its prose with a tagline on first open.
- [ ] Detail page shows MIT MÉR, MIÉRT ENNYI (3–4 sentences), A SZÁMOK, HONNAN JÖN (when facts exist), ÍGY JAVÍTHATÓ.
- [ ] No AI number contradicts the engine (3 live recipes checked); day numbers equal Étel Ma's for the same day.
- [ ] Loading / error / offline (day block hidden) / kímélő day / < 3 scored recipes states verified.
- [ ] Dynamic Type largest, VoiceOver per tile, reduced motion, smallest iPhone width; no emoji, no „Mezo".
- [ ] Gates: backend focused tests + `ArchitectureTest` (Testcontainers); `xcodebuild test` BoopKit + Boop;
  `gen-codemap`; `lint-docs` 0/0.
- [ ] Docs + handbook + `_jegyek.json` / `_kiadasok.json`; Notion `check` exits 0.
- [ ] Merged, deployed, live recipes show the new prose; app installed on the phone and walked through.
