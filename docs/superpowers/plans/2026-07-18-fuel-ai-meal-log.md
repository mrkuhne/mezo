# Fuel — AI meal log (text + photo → draft → confirm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log a meal from Hungarian free text and/or an ephemeral photo: one cheap-tier LLM call parses AND matches against the user's pantry catalog + recipes, the user confirms an editable draft, and the confirm flows through the existing `POST /api/meal` write path (extended with an `estimate` item source + a `meal.provenance` jsonb envelope).

**Architecture:** Stateless draft endpoint `POST /api/meal/ai-draft` (multipart — first in the codebase) in `feature/meal`, reaching the LLM through a **consumer-owned port** `MealDraftLlm` + companion-side `MealDraftLlmAdapter` (ADR 0012 — this SUPERSEDES the spec's "meal → companion one-way edge" line; a direct edge would close an ArchUnit slice cycle because `companion → meal` already exists). `CompanionLlm` first gains a multimodal overload (Gemini via Spring AI `Media`; `FakeCompanionLlm` gains a `[fake-meal:...]` sentinel that also matches UTF-8-decoded image bytes). Matched lines get macros from the DB, never the LLM; hallucinated ids demote to `estimate`; Atwater sanity → per-line `confidence` + server-verdict `needsReview` (boundary-inclusive `<=`).

**Tech Stack:** Spring Boot 4 / Java 21 / Spring AI 2.0 (Gemini) / Liquibase / OpenAPI-first · React 19 + Vite + TanStack Query (dual-mode).

**Driving docs:** spec `docs/superpowers/specs/2026-07-18-fuel-ai-meal-log-design.md`, ADR 0012 `docs/decisions/0012-consumer-owned-llm-ports.md`, sibling deviations `docs/superpowers/specs/2026-07-18-fuel-url-scrape-import-design.md` §Implementation deviations. bd issue: `mezo-78rn`.

## Global Constraints

- **Worktree:** all work in `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`, branch `feat/fuel-ai-meal-log`. Commit with `git -c core.hooksPath=/dev/null commit ...` (bd pre-commit hook would stage `.beads/issues.jsonl`). Run `bd` only from the main checkout `/Users/daniel.kuhne/MrKuhne/mezo`.
- **Contract-first:** edit `api/feature/meal/meal.yml` BEFORE code → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api` → backend types regenerate inside `./mvnw` runs. Never hand-write boundary DTOs.
- **Commit subjects:** conventional, carrying the bd id, e.g. `feat(meal): ai-draft extraction service (mezo-78rn)`.
- **Backend tests:** FOCUSED only, locally (16 GB box OOMs on the full suite): `cd backend && ./mvnw clean test -Dtest=<ClassName>`. ALWAYS `clean`. Docker compose Postgres must be up (`docker compose up -d` under `backend/`). The full suite runs in CI via the self-PR.
- **Frontend gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — BOTH modes green.
- **No `@Value`** — switches via `FeaturesConfiguration` constants + `@ConditionalOnProperty`; tunables via `@Validated` `*Properties` records under the `mezo:` yaml root.
- **Error contract:** `SystemRuntimeErrorException` + `SystemMessage.error/field(code…)`; every new code gets a `messages.properties` key. No hardcoded user text, no stack traces to clients.
- **UI copy:** Hungarian. Code/comments/commits: English.
- **Soft delete / ownership:** `created_by` set server-side from the principal; `@SQLRestriction` handles `is_deleted`.
- **ArchUnit:** the `feature_slices_are_cycle_free` freeze store contains ONLY `biometrics↔goal`. No new cycle may appear. `feature/meal` must NEVER import `feature.companion`.
- **Naming:** UUID PKs; Liquibase scripts `{YYYYMMDDHHMM}_mezo-78rn_{desc}.sql`; tests `test{Method}_should{Result}_when{Condition}`; AssertJ only; no mocks/H2 in ITs.

---

## File Structure (what this plan touches)

**Contract (`api/`):**
- Modify: `api/feature/meal/meal.yml` — new `MealAiLog` tag + `POST /api/meal/ai-draft` (multipart) + `MealAiDraftResponse`/`MealAiDraftItem`/`MealProvenance` schemas; widen `MealItemRequest.source`, add estimate snapshot fields; `MealRequest.provenance`.

**Backend (`backend/src/main/java/io/mrkuhne/mezo/`):**
- Create: `feature/meal/service/MealDraftLlm.java` — consumer-owned LLM port (2 methods: text, multimodal).
- Create: `feature/companion/llm/MealDraftLlmAdapter.java` — delegates to `CompanionLlm`, `@ConditionalOnProperty(COMPANION_SWITCH)`.
- Modify: `feature/companion/CompanionLlm.java` — multimodal method `complete(system, user, imageBytes, mimeType)`.
- Modify: `feature/companion/llm/GeminiCompanionLlm.java` — multimodal impl via Spring AI `Media`.
- Modify: `feature/companion/llm/FakeCompanionLlm.java` — `MEAL_SENTINEL` (`[fake-meal:{...}]`) matching user text AND UTF-8-decoded image bytes.
- Create: `feature/meal/service/MealAiDraftService.java` — catalog assembly + prompt + parse + id-validation/demotion + response mapping.
- Create: `feature/meal/service/MealAiDraftValidator.java` — Atwater/range confidence (mirror of `ScrapeDraftValidator`).
- Create: `feature/meal/config/MealAiLogProperties.java` — `@Validated` record.
- Create: `feature/meal/controller/MealAiDraftController.java` — implements generated `MealAiLogApi`.
- Create: `feature/meal/entity/MealProvenanceJson.java` — typed jsonb record.
- Modify: `feature/meal/entity/MealEntity.java` — `provenance` jsonb column.
- Modify: `feature/meal/service/MealService.java` — `estimate` arm in `buildItem`, provenance persist, scoring null-guard for FK-less lines.
- Modify: `techcore/configuration/FeaturesConfiguration.java` — `MEAL_AI_LOG_SWITCH`.
- Modify: `backend/src/main/resources/application.yml` — switch + `mezo.meal-ai-log` block.
- Modify: `backend/src/main/resources/messages.properties` — 3 new codes.
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607181500_mezo-78rn_meal_item_estimate.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607181501_mezo-78rn_meal_provenance.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

**Backend tests:**
- Modify: `support/ApiIntegrationTest.java` — multipart POST helper.
- Modify: `feature/companion/CompanionLlmFakeIT.java` — meal-sentinel coverage.
- Create: `feature/meal/MealAiDraftApiIT.java`, `feature/meal/MealAiLlmUnavailableApiIT.java`, `feature/meal/MealAiDraftValidatorTest.java`.
- Modify: `feature/meal/MealApiIT.java` (+`MealServiceIT.java`) — estimate-arm + provenance tests.

**Frontend (`frontend/src/`):**
- Modify: `data/_client/api.ts` — FormData-aware `apiFetch`.
- Modify: `data/types.ts` — `MealItemSource` + estimate item union + `MealProvenance` + `MealAiDraft` types.
- Modify: `data/fuel/mealApi.ts` — `toRequest` estimate/provenance mapping + `aiDraft`.
- Modify: `data/fuel/fuelHooks.ts` — `draftMealFromAi` callback + mock estimate `buildLine` branch.
- Modify: `data/fuel/fuel.ts` (seeds) — `MOCK_AI_MEAL_DRAFT`.
- Modify: `data/hooks.ts` — barrel (no new export needed if it stays inside `useMealActions`).
- Create: `shared/lib/resizeImage.ts` (+ test) — canvas resize, pure `fitWithin` helper.
- Create: `features/fuel/sheets/AiLogSheet.tsx` (+ test).
- Modify: `features/fuel/pages/FuelMaiPage.tsx` — AI entry button + sheet mount.

**Docs:**
- Modify: `docs/features/fuel.md` (meal-logging feature doc), `docs/features/_platform-*.md` where the companion adapter list lives; spec deviations appendix if any deviation emerges; run `node scripts/lint-docs.mjs`.

---

### Task 1: API contract — ai-draft endpoint + estimate/provenance extensions

**Files:**
- Modify: `api/feature/meal/meal.yml`
- Generated (verify only): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, backend `target/generated-sources`

**Interfaces:**
- Consumes: existing `MealRequest`/`MealItemRequest`/`MealResponse` schemas (`meal.yml:201-297`), pantry-scrape fragment as style precedent (`api/feature/pantry/pantry.yml:251-283`).
- Produces: generated backend `io.mrkuhne.mezo.api.controller.MealAiLogApi` (op `draftMealFromAi`), `io.mrkuhne.mezo.api.dto.MealAiDraftResponse`, `.MealAiDraftItem`, `.MealProvenance`; widened `MealItemRequest` (`source` pattern `^(recipe|pantry|estimate)$` + optional `name`, `per`, `basisUnit`, `kcal`, `proteinG`, `carbsG`, `fatG`, `nova`); `MealRequest.provenance`. FE types in `api.gen.ts` with the same names. Later tasks depend on these exact names.

- [ ] **Step 1: Edit the meal fragment**

In `api/feature/meal/meal.yml`:

1. Add the endpoint under `paths` (sibling of `/api/meal`), with its OWN tag so the controller can be `@ConditionalOnProperty`-gated (404 when off — mirrors `PantryScrape`):

```yaml
  /api/meal/ai-draft:
    post:
      tags: [MealAiLog]
      operationId: draftMealFromAi
      summary: Parse + match a meal draft from free text and/or a photo (stateless, nothing persisted)
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [date]
              properties:
                date:
                  type: string
                  format: date
                text:
                  type: string
                  maxLength: 2000
                photo:
                  type: string
                  format: binary
      responses:
        '200':
          description: Editable draft (empty items = nothing recognized, honest empty)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MealAiDraftResponse'
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '502': { $ref: '#/components/responses/BadGateway' }
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
```

> If `components/responses` refs like `BadRequest` don't exist in this fragment, copy the exact response style used by `scrapePantryItem` in `api/feature/pantry/pantry.yml:76-…` (it documents 400/401/502/503 inline or via common refs — mirror whatever it does verbatim).

2. Add schemas next to the existing meal schemas:

```yaml
    MealAiDraftResponse:
      type: object
      required: [slot, items]
      properties:
        slot:
          type: string
          pattern: '^(breakfast|lunch|dinner|snack)$'
        title:
          type: string
          nullable: true
        note:
          type: string
          nullable: true
        items:
          type: array
          items:
            $ref: '#/components/schemas/MealAiDraftItem'
    MealAiDraftItem:
      type: object
      required: [source, name, amount, unit, per, basisUnit, kcal, proteinG, carbsG, fatG, confidence, needsReview]
      properties:
        source:
          type: string
          pattern: '^(recipe|pantry|estimate)$'
        pantryItemId:
          type: string
          format: uuid
          nullable: true
        recipeId:
          type: string
          format: uuid
          nullable: true
        name:
          type: string
        amount:
          type: number
        unit:
          type: string
        per:
          type: number
        basisUnit:
          type: string
        kcal:
          type: number
        proteinG:
          type: number
        carbsG:
          type: number
        fatG:
          type: number
        nova:
          type: integer
          minimum: 1
          maximum: 4
          nullable: true
        confidence:
          type: number
          minimum: 0
          maximum: 1
        needsReview:
          type: boolean
    MealProvenance:
      type: object
      required: [origin]
      properties:
        origin:
          type: string
          pattern: '^(manual|ai-text|ai-photo)$'
        model:
          type: string
          nullable: true
        confidence:
          type: number
          nullable: true
        rawText:
          type: string
          nullable: true
```

3. Widen `MealItemRequest` (at `meal.yml:201`): change `source` pattern to `'^(recipe|pantry|estimate)$'` and ADD optional fields (all nullable, only used by the estimate arm):

```yaml
        name: { type: string, nullable: true }
        per: { type: number, nullable: true }
        basisUnit: { type: string, nullable: true }
        kcal: { type: number, nullable: true }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
        nova: { type: integer, minimum: 1, maximum: 4, nullable: true }
```

4. Add to `MealRequest` (at `meal.yml:223`) properties:

```yaml
        provenance:
          nullable: true
          allOf: [ { $ref: '#/components/schemas/MealProvenance' } ]
```

- [ ] **Step 2: Merge + generate all three artifacts**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw generate-sources -q
```
Expected: merge succeeds; `frontend/src/data/_client/api.gen.ts` gains `MealAiDraftResponse`/`MealAiDraftItem`/`MealProvenance` and the `/api/meal/ai-draft` path; backend gains `io/mrkuhne/mezo/api/controller/MealAiLogApi.java` (check `backend/target/generated-sources/openapi/.../MealAiLogApi.java` — note the exact generated method signature for `draftMealFromAi`; it will take `LocalDate date, String text, MultipartFile photo` or similar — Task 7 implements it).

- [ ] **Step 3: Compile-check both sides**

```bash
cd backend && ./mvnw clean compile -q
cd ../frontend && pnpm build
```
Expected: both green (nothing implements `MealAiLogApi` yet — it's `interfaceOnly`, no failure).

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): meal ai-draft contract + estimate item source + provenance (mezo-78rn)"
```

---

### Task 2: DB changesets + provenance entity field

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607181500_mezo-78rn_meal_item_estimate.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607181501_mezo-78rn_meal_provenance.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealProvenanceJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemEntity.java` (source comment only)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRepositoryIT.java`

**Interfaces:**
- Consumes: `ck_meal_item_source` + `ck_meal_item_arm` exact current definitions in `db/changelog/1.0.0/script/202606241400_mezo-arb_create_meal.sql:52-58`; typed-jsonb idiom `MealEntity.java:81-83`.
- Produces: `MealProvenanceJson(String origin, String model, BigDecimal confidence, String rawText)` record; `MealEntity.getProvenance()/setProvenance(MealProvenanceJson)`; DB accepts `source='estimate'` with both FKs NULL. Tasks 3+ rely on these.

- [ ] **Step 1: Write the failing repository test**

Add to `MealRepositoryIT.java` (match its existing style — it extends `AbstractIntegrationTest`, uses populators + repositories directly):

```java
@Test
void testSave_shouldRoundTripProvenanceAndEstimateLine_whenAiOrigin() {
    UUID owner = databasePopulator.populateUser();

    MealEntity meal = new MealEntity();
    meal.setCreatedBy(owner);
    meal.setLoggedAt(Instant.parse("2026-07-18T12:00:00Z"));
    meal.setMealDate(LocalDate.of(2026, 7, 18));
    meal.setSlot("lunch");
    meal.setProvenance(new MealProvenanceJson("ai-text", null, new BigDecimal("0.80"), "csirkés wrap"));

    MealItemEntity line = new MealItemEntity();
    line.setCreatedBy(owner);
    line.setMeal(meal);
    line.setLineOrder(0);
    line.setSource("estimate");
    line.setAmount(new BigDecimal("1"));
    line.setUnit("db");
    line.setSnapshotName("Csirkés wrap");
    line.setSnapshotPer(new BigDecimal("1"));
    line.setSnapshotBasisUnit("db");
    line.setSnapshotKcal(new BigDecimal("450"));
    line.setSnapshotProteinG(new BigDecimal("28"));
    line.setSnapshotCarbsG(new BigDecimal("40"));
    line.setSnapshotFatG(new BigDecimal("18"));
    meal.getItems().add(line);

    MealEntity saved = mealRepository.saveAndFlush(meal);

    MealEntity found = mealRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getProvenance().origin()).isEqualTo("ai-text");
    assertThat(found.getProvenance().rawText()).isEqualTo("csirkés wrap");
    assertThat(found.getItems().getFirst().getSource()).isEqualTo("estimate");
    assertThat(found.getItems().getFirst().getRecipeId()).isNull();
    assertThat(found.getItems().getFirst().getPantryItemId()).isNull();
}
```

(Adjust field/populator names to the file's existing tests — e.g. how `mealRepository` and `databasePopulator` are injected there.)

- [ ] **Step 2: Run it — expect failure**

```bash
cd backend && ./mvnw clean test -Dtest=MealRepositoryIT
```
Expected: COMPILE FAILURE (`MealProvenanceJson` missing) — that is the failing state.

- [ ] **Step 3: Changeset 1 — widen source + arm CHECKs**

`202607181500_mezo-78rn_meal_item_estimate.sql` — FIRST open `202606241400_mezo-arb_create_meal.sql:52-58` and copy the EXACT current `ck_meal_item_source` and `ck_meal_item_arm` bodies, then extend:

```sql
-- mezo-78rn: allow FK-less AI-estimated meal lines (source='estimate', snapshots carry macros)
alter table meal_item drop constraint ck_meal_item_source;
alter table meal_item add constraint ck_meal_item_source
    check (source in ('recipe', 'pantry', 'estimate'));

alter table meal_item drop constraint ck_meal_item_arm;
alter table meal_item add constraint ck_meal_item_arm
    check (
        (source = 'recipe' and recipe_id is not null and pantry_item_id is null)
        or (source = 'pantry' and pantry_item_id is not null and recipe_id is null)
        or (source = 'estimate' and recipe_id is null and pantry_item_id is null)
    );
```
(If the original arm CHECK is phrased differently, keep its phrasing and append only the estimate disjunct.)

- [ ] **Step 4: Changeset 2 — provenance column**

`202607181501_mezo-78rn_meal_provenance.sql`:

```sql
-- mezo-78rn: AI-log provenance envelope (origin manual|ai-text|ai-photo); NULL for manual/legacy rows
alter table meal add column provenance jsonb;
```

- [ ] **Step 5: Register both in `1.0.0_master.yml`**

Append two changesets at the END, copying the exact shape of the previous entry (id `"1.0.0:{filename-without-ext}"`, author `daniel.kuhne`, `sqlFile` + `relativeToChangelogFile: true` + `path: script/{file}.sql`).

- [ ] **Step 6: Entity changes**

`feature/meal/entity/MealProvenanceJson.java` (new — javadoc: typed jsonb per ADR 0006; written by the confirm path, null for manual/legacy):

```java
package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;

/**
 * Typed payload of meal.provenance (jsonb) — ADR 0006 typed-envelope idiom.
 * origin: manual | ai-text | ai-photo. NULL column = manual/legacy row (no backfill).
 */
public record MealProvenanceJson(String origin, String model, BigDecimal confidence, String rawText) {
}
```

`MealEntity.java` — add below the `breakdown` field (mirror its annotations at L81-83):

```java
@JdbcTypeCode(SqlTypes.JSON)
@Column(columnDefinition = "jsonb")
private MealProvenanceJson provenance;
```

`MealItemEntity.java:57` — update the source comment to `// recipe | pantry | estimate (DB CHECK ck_meal_item_source)`.

- [ ] **Step 7: Run the test — expect pass**

```bash
cd backend && ./mvnw clean test -Dtest=MealRepositoryIT
```
Expected: PASS (Liquibase applies the two new changesets to `mezo_test`).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRepositoryIT.java
git -c core.hooksPath=/dev/null commit -m "feat(meal): estimate item source + provenance jsonb — DB + entity (mezo-78rn)"
```

---

### Task 3: Confirm path — estimate arm + provenance persist + scoring null-guard

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: widened `MealItemRequest` (Task 1: `getName()/getPer()/getBasisUnit()/getKcal()/getProteinG()/getCarbsG()/getFatG()/getNova()`), `MealRequest.getProvenance()` (generated `MealProvenance` dto), `MealProvenanceJson` (Task 2). `MealService.buildItem` at `MealService.java:271` (arms at L280/L294, `invalidItems()` at L336), `toScoredLine` at L167, `pantryFacts` L191 / `recipeFacts` L209.
- Produces: `POST /api/meal` accepts `source="estimate"` lines (both FKs null, snapshots verbatim from request) + persists provenance. Task 8/10 (FE confirm) relies on this behavior.

- [ ] **Step 1: Write failing API tests**

Add to `MealApiIT.java` (mirror the style of `testCreateThenGetDay_...` at L98 — build `MealRequest` dto, `postForBody`, assert response):

```java
@Test
void testCreate_shouldPersistEstimateLineAndProvenance_whenAiDraftConfirmed() {
    MealItemRequest estimate = new MealItemRequest();
    estimate.setSource("estimate");
    estimate.setAmount(new BigDecimal("1"));
    estimate.setUnit("db");
    estimate.setName("Csirkés wrap");
    estimate.setPer(new BigDecimal("1"));
    estimate.setBasisUnit("db");
    estimate.setKcal(new BigDecimal("450"));
    estimate.setProteinG(new BigDecimal("28"));
    estimate.setCarbsG(new BigDecimal("40"));
    estimate.setFatG(new BigDecimal("18"));

    MealRequest req = new MealRequest();
    req.setSlot("lunch");
    req.setItems(List.of(estimate));
    MealProvenance prov = new MealProvenance();
    prov.setOrigin("ai-text");
    prov.setRawText("ettem egy csirkés wrapot");
    req.setProvenance(prov);

    MealResponse res = postForBody("/api/meal", req, MealResponse.class);

    assertThat(res.getItems()).hasSize(1);
    assertThat(res.getItems().getFirst().getName()).isEqualTo("Csirkés wrap");
    assertThat(res.getItems().getFirst().getContribution().getKcal()).isEqualByComparingTo("450");
    assertThat(res.getScore()).isNotNull(); // scoring ran; micro/nova dims degrade, macro dim scores
}

@Test
void testCreate_should400_whenEstimateLineMissingMacros() {
    MealItemRequest estimate = new MealItemRequest();
    estimate.setSource("estimate");
    estimate.setAmount(new BigDecimal("1"));
    estimate.setUnit("db");
    estimate.setName("Wrap"); // per/basisUnit/kcal/macros missing
    MealRequest req = new MealRequest();
    req.setSlot("lunch");
    req.setItems(List.of(estimate));

    ResponseEntity<String> res = exchangeForResponse("/api/meal", HttpMethod.POST, req);
    assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
}

@Test
void testCreate_should400_whenEstimateLineCarriesFk() {
    MealItemRequest estimate = new MealItemRequest();
    estimate.setSource("estimate");
    estimate.setAmount(new BigDecimal("1"));
    estimate.setUnit("db");
    estimate.setName("Wrap");
    estimate.setPer(new BigDecimal("1"));
    estimate.setBasisUnit("db");
    estimate.setKcal(new BigDecimal("450"));
    estimate.setProteinG(new BigDecimal("28"));
    estimate.setCarbsG(new BigDecimal("40"));
    estimate.setFatG(new BigDecimal("18"));
    estimate.setPantryItemId(UUID.randomUUID()); // illegal on estimate arm
    MealRequest req = new MealRequest();
    req.setSlot("lunch");
    req.setItems(List.of(estimate));

    ResponseEntity<String> res = exchangeForResponse("/api/meal", HttpMethod.POST, req);
    assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
}
```

(Use the file's existing helper style — if 400 asserts go through `assertHasFieldError(body, "items", ...)`, mirror the neighbouring 400 tests at L249-303 exactly.)

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && ./mvnw clean test -Dtest=MealApiIT
```
Expected: the three new tests FAIL (estimate arm → `invalidItems()` 400 today; provenance ignored).

- [ ] **Step 3: Implement in `MealService`**

1. `buildItem` (L271): add an `"estimate"` branch alongside the recipe/pantry arms:

```java
} else if ("estimate".equals(req.getSource())) {
    if (req.getRecipeId() != null || req.getPantryItemId() != null) {
        throw invalidItems();
    }
    if (req.getName() == null || req.getName().isBlank()
            || req.getPer() == null || req.getPer().signum() <= 0
            || req.getBasisUnit() == null || req.getBasisUnit().isBlank()
            || req.getKcal() == null || req.getProteinG() == null
            || req.getCarbsG() == null || req.getFatG() == null) {
        throw invalidItems();
    }
    item.setSnapshotName(req.getName());
    item.setSnapshotPer(req.getPer());
    item.setSnapshotBasisUnit(req.getBasisUnit());
    item.setSnapshotKcal(req.getKcal());
    item.setSnapshotProteinG(req.getProteinG());
    item.setSnapshotCarbsG(req.getCarbsG());
    item.setSnapshotFatG(req.getFatG());
    item.setSnapshotNova(req.getNova() == null ? null : req.getNova().shortValue());
}
```
(Match the surrounding arm style — if the method uses a switch, add a case.)

2. Provenance: in `create` (L68) and `update` (L78), after `applyHeader`, map the dto → `MealProvenanceJson`:

```java
meal.setProvenance(toProvenance(req.getProvenance()));
...
private static MealProvenanceJson toProvenance(MealProvenance dto) {
    if (dto == null) {
        return null;
    }
    return new MealProvenanceJson(dto.getOrigin(), dto.getModel(),
            dto.getConfidence(), dto.getRawText());
}
```

3. Scoring null-guard: inspect `toScoredLine` (L167) — it resolves live micro facts via `pantryFacts(userId, pantryItemId, factor)` / `recipeFacts(...)` keyed on the ids. Ensure a line with BOTH ids null yields `Facts.NONE` (`hasMicroFacts=false`, nova from snapshot = null) instead of an NPE. If the current branching already falls through safely, add nothing; otherwise add the explicit both-null → `Facts.NONE` guard.

- [ ] **Step 4: Run — expect pass**

```bash
cd backend && ./mvnw clean test -Dtest='MealApiIT,MealServiceIT,MealRepositoryIT'
```
Expected: all PASS (including pre-existing meal tests — no regression).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal
git -c core.hooksPath=/dev/null commit -m "feat(meal): estimate confirm arm + provenance persistence (mezo-78rn)"
```

---

### Task 4: CompanionLlm multimodal overload (Gemini + Fake with meal sentinel)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionLlmFakeIT.java`

**Interfaces:**
- Consumes: `CompanionLlm` (2-string `complete` at L30, cheap-tier ChatClient in `GeminiCompanionLlm` L32-42); `FakeCompanionLlm` sentinel idiom (`SCRAPE_SENTINEL` L58-59, matched at end of `complete` L233-239).
- Produces: `String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType)` on `CompanionLlm` (abstract, implemented by both adapters); `[fake-meal:{json}]` sentinel matched in user text (both text path and multimodal path) AND in UTF-8-decoded image bytes (photo-only ITs). Task 5's adapter delegates to this.

- [ ] **Step 1: Write failing IT**

Add to `CompanionLlmFakeIT.java` (it already asserts `companionLlm instanceof FakeCompanionLlm` and exercises sentinels):

```java
@Test
void testComplete_shouldReturnMealSentinelJson_whenUserTextCarriesIt() {
    String json = "{\"slot\":\"lunch\",\"items\":[]}";
    String answer = companionLlm.complete("SYS", "ettem valamit [fake-meal:" + json + "]");
    assertThat(answer).isEqualTo(json);
}

@Test
void testCompleteMultimodal_shouldReturnMealSentinelJson_whenImageBytesCarryIt() {
    String json = "{\"slot\":\"dinner\",\"items\":[]}";
    byte[] fakePhoto = ("[fake-meal:" + json + "]").getBytes(StandardCharsets.UTF_8);
    String answer = companionLlm.complete("SYS", "", fakePhoto, "image/jpeg");
    assertThat(answer).isEqualTo(json);
}

@Test
void testCompleteMultimodal_shouldFallBackToEcho_whenNoSentinel() {
    String answer = companionLlm.complete("SYS", "user text", new byte[] {1, 2, 3}, "image/jpeg");
    assertThat(answer).startsWith("FAKE-LLM");
}
```

- [ ] **Step 2: Run — expect compile failure**

```bash
cd backend && ./mvnw clean test -Dtest=CompanionLlmFakeIT
```
Expected: COMPILE FAILURE — no 4-arg multimodal `complete` exists.

- [ ] **Step 3: Implement**

1. `CompanionLlm.java` — add the abstract method (javadoc: multimodal cheap-tier one-shot; image is request-scoped, never stored — mezo-78rn):

```java
/**
 * One-shot completion on the cheap tier with ONE inline image (vision). The bytes live only
 * for this call — nothing is stored. mezo-78rn (AI meal log) is the first consumer.
 */
String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
```

2. `GeminiCompanionLlm.java` — implement with Spring AI `Media` on the cheap-tier client (imports: `org.springframework.ai.content.Media`, `org.springframework.core.io.ByteArrayResource`, `org.springframework.util.MimeTypeUtils`):

```java
@Override
public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
    return chatClient.prompt()
            .system(systemPrompt)
            .user(u -> u.text(userMessage == null || userMessage.isBlank() ? "(no text)" : userMessage)
                    .media(Media.builder()
                            .mimeType(MimeTypeUtils.parseMimeType(mimeType))
                            .data(new ByteArrayResource(imageBytes))
                            .build()))
            .call()
            .content();
}
```
(Match the fluent style of the existing `request(...)` helper at L61-69; if `u.media(MimeType, Resource)` exists as a direct overload in Spring AI 2.0.0, that shorter form is fine too. Note: `.user(u -> ...)` requires non-blank text with some providers — hence the `"(no text)"` fallback.)

3. `FakeCompanionLlm.java`:
   - add next to `SCRAPE_SENTINEL` (L58-59):
   ```java
   private static final Pattern MEAL_SENTINEL =
           Pattern.compile("\\[fake-meal:(\\{.*?})]", Pattern.DOTALL);
   ```
   - in the existing `complete(...)` (before/after the scrape sentinel check at L233-239, same shape):
   ```java
   Matcher meal = MEAL_SENTINEL.matcher(userMessage);
   if (meal.find()) {
       return meal.group(1);
   }
   ```
   - new multimodal override — sentinel in user text first, then in the image bytes (a "photo" in ITs is just UTF-8 sentinel text), else fall through to the echo path:
   ```java
   @Override
   public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
       Matcher meal = MEAL_SENTINEL.matcher(userMessage == null ? "" : userMessage);
       if (meal.find()) {
           return meal.group(1);
       }
       if (imageBytes != null) {
           Matcher img = MEAL_SENTINEL.matcher(new String(imageBytes, StandardCharsets.UTF_8));
           if (img.find()) {
               return img.group(1);
           }
       }
       return complete(systemPrompt, userMessage);
   }
   ```

- [ ] **Step 4: Run — expect pass**

```bash
cd backend && ./mvnw clean test -Dtest=CompanionLlmFakeIT
```
Expected: PASS (new + pre-existing sentinel tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git -c core.hooksPath=/dev/null commit -m "feat(companion): CompanionLlm multimodal overload + fake meal sentinel (mezo-78rn)"
```

---

### Task 5: MealDraftLlm port + companion adapter + switch/properties/messages

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealDraftLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MealDraftLlmAdapter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/config/MealAiLogProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/resources/messages.properties`

**Interfaces:**
- Consumes: `CompanionLlm` multimodal overload (Task 4); ADR 0012 pattern (`ScrapeLlm` `feature/pantry/service/ScrapeLlm.java` + `PantryScrapeLlmAdapter` `feature/companion/llm/PantryScrapeLlmAdapter.java`); properties registration style of `PantryScrapeProperties` (`feature/pantry/config/PantryScrapeProperties.java` — copy how it gets registered, e.g. `@ConfigurationPropertiesScan` already covers the package).
- Produces: `MealDraftLlm` with `complete(String,String)` + `complete(String,String,byte[],String)`; `FeaturesConfiguration.MEAL_AI_LOG_SWITCH = "mezo.feature.meal-ai-log.enabled"`; `MealAiLogProperties(maxPhotoBytes, allowedMimeTypes, confidenceThreshold, maxItems)` under prefix `mezo.meal-ai-log`; messages keys `MEAL_AI_INPUT_REQUIRED`, `MEAL_AI_EXTRACT_FAILED`, `MEAL_AI_LLM_UNAVAILABLE`. Task 6 consumes all of these.

- [ ] **Step 1: Port interface** (`feature/meal/service/MealDraftLlm.java` — javadoc mirrors `ScrapeLlm`'s: consumer-owned per ADR 0012, only cross-feature edge runs companion → meal):

```java
package io.mrkuhne.mezo.feature.meal.service;

/**
 * Meal-owned LLM seam for the AI meal-draft extraction (ADR 0012 consumer-owned port).
 * The companion feature provides the adapter; meal NEVER imports feature.companion, so the
 * only cross-feature edge runs companion -> meal (same direction as the existing transitive
 * dependency) and the ArchUnit feature-slice cycle rule stays green.
 */
public interface MealDraftLlm {

    /** Cheap-tier text-only completion. */
    String complete(String systemPrompt, String userMessage);

    /** Cheap-tier multimodal completion with ONE ephemeral inline image. */
    String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
}
```

- [ ] **Step 2: Companion-side adapter** (`feature/companion/llm/MealDraftLlmAdapter.java` — exact mirror of `PantryScrapeLlmAdapter`):

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.meal.service.MealDraftLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the meal-owned {@link MealDraftLlm} port (ADR 0012).
 * Companion off -> no CompanionLlm bean -> no adapter bean -> the ai-draft endpoint
 * degrades to a clean 503 via ObjectProvider.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MealDraftLlmAdapter implements MealDraftLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }

    @Override
    public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        return companionLlm.complete(systemPrompt, userMessage, imageBytes, mimeType);
    }
}
```

- [ ] **Step 3: Switch + properties + yaml + messages**

`FeaturesConfiguration.java` — add next to `PANTRY_SCRAPE_SWITCH` (L38):

```java
/** AI meal logging (text/photo -> LLM draft). Independent of the companion chat switch. */
public static final String MEAL_AI_LOG_SWITCH = "mezo.feature.meal-ai-log.enabled";
```

`feature/meal/config/MealAiLogProperties.java`:

```java
package io.mrkuhne.mezo.feature.meal.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Tunables of the AI meal-draft endpoint (mezo-78rn). All values live in application.yml. */
@Validated
@ConfigurationProperties(prefix = "mezo.meal-ai-log")
public record MealAiLogProperties(
        @Min(10_000) @Max(20_000_000) int maxPhotoBytes,
        @NotEmpty List<@NotBlank String> allowedMimeTypes,
        @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold,
        @Min(1) @Max(50) int maxItems) {
}
```
(Verify how `PantryScrapeProperties` is registered — if the app uses `@ConfigurationPropertiesScan`, nothing more is needed; otherwise mirror its `@EnableConfigurationProperties` site.)

`application.yml` — next to the `mezo.pantry-scrape` block (L105-112) add:

```yaml
  meal-ai-log:
    max-photo-bytes: 5000000
    allowed-mime-types:
      - image/jpeg
      - image/png
      - image/webp
    confidence-threshold: 0.6
    max-items: 12
```
and under `mezo.feature` (near L136):

```yaml
    meal-ai-log:
      enabled: true
```

`messages.properties` — next to the scrape keys (L30-32):

```properties
MEAL_AI_INPUT_REQUIRED=Adj meg szöveget vagy fotót a naplózáshoz.
MEAL_AI_EXTRACT_FAILED=Az AI-kivonatolás nem sikerült. Próbáld újra, vagy naplózz kézzel.
MEAL_AI_LLM_UNAVAILABLE=Az AI-naplózás jelenleg nem érhető el.
```

- [ ] **Step 4: Compile + context sanity**

```bash
cd backend && ./mvnw clean test -Dtest=CompanionLlmFakeIT
```
Expected: PASS — proves the context still boots with the new beans/properties (the adapter instantiates; `ArchitectureTest` runs in CI, but if paranoid: `./mvnw clean test -Dtest=ArchitectureTest` — the new `companion → meal` import must NOT create a cycle since that direction already exists).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/main/resources
git -c core.hooksPath=/dev/null commit -m "feat(meal): MealDraftLlm consumer-owned port + companion adapter + config (mezo-78rn)"
```

---

### Task 6: MealAiDraftService — catalog prompt, parse, demotion, confidence

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftValidator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftValidatorTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftServiceIT.java`

**Interfaces:**
- Consumes: `MealDraftLlm` via `ObjectProvider` (Task 5), `MealAiLogProperties` (Task 5), generated `MealAiDraftResponse`/`MealAiDraftItem` dtos (Task 1), `PantryItemRepository`/`RecipeRepository`/`RecipeMapper` (already imported by `MealService.java:17-22` — the meal→pantry/recipe edges exist), shared Jackson-3 `tools.jackson.databind.ObjectMapper` bean (as in `ScrapeExtractionService`), error idiom of `ScrapeExtractionService.java:67-86`.
- Produces: `MealAiDraftResponse draft(UUID userId, LocalDate date, String text, MultipartFile photo)` — Task 7's controller calls exactly this. `requireAvailable()` public for the 503 path. `MealAiDraftValidator.confidence(kcal, proteinG, carbsG, fatG) : double`.

- [ ] **Step 1: Validator unit test first** (`MealAiDraftValidatorTest.java`, plain JUnit, AssertJ — mirror `MealMapperTest` no-Spring style):

```java
class MealAiDraftValidatorTest {

    private final MealAiDraftValidator validator = new MealAiDraftValidator();

    @Test
    void testConfidence_shouldReturnFull_whenAtwaterConsistent() {
        // 4*28 + 4*40 + 9*18 = 434 vs kcal 450 -> ~3.6% off, consistent
        double c = validator.confidence(bd("450"), bd("28"), bd("40"), bd("18"));
        assertThat(c).isEqualTo(1.0);
    }

    @Test
    void testConfidence_shouldPenalize_whenAtwaterOffOver30Percent() {
        // atwater = 434, kcal 900 -> >30% off -> -0.4
        double c = validator.confidence(bd("900"), bd("28"), bd("40"), bd("18"));
        assertThat(c).isEqualTo(0.6);
    }

    @Test
    void testConfidence_shouldPenalize_whenMacroMissing() {
        double c = validator.confidence(bd("450"), null, bd("40"), bd("18"));
        assertThat(c).isEqualTo(0.7);
    }

    @Test
    void testConfidence_shouldClampToZero_whenEverythingWrong() {
        double c = validator.confidence(bd("9000"), null, null, null);
        assertThat(c).isEqualTo(0.5); // -0.3 missing macros, -0.2 kcal range
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
```

- [ ] **Step 2: Run — expect compile failure; implement the validator** (`MealAiDraftValidator.java` — mirror of `ScrapeDraftValidator`, per-portion kcal range 0..3000):

```java
package io.mrkuhne.mezo.feature.meal.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/**
 * Deterministic confidence score for AI-estimated meal lines (mirror of ScrapeDraftValidator).
 * Starts at 1.0: missing macro -0.3; Atwater (4P+4C+9F) off by >30% vs kcal -0.4;
 * per-portion kcal outside [0, 3000] -0.2. Clamped at 0. The LLM never supplies confidence.
 */
@Component
public class MealAiDraftValidator {

    public double confidence(BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
        double score = 1.0;
        if (proteinG == null || carbsG == null || fatG == null) {
            score -= 0.3;
        } else if (kcal != null && kcal.doubleValue() > 0) {
            double atwater = 4 * proteinG.doubleValue() + 4 * carbsG.doubleValue() + 9 * fatG.doubleValue();
            if (Math.abs(kcal.doubleValue() - atwater) / kcal.doubleValue() > 0.30) {
                score -= 0.4;
            }
        }
        if (kcal != null && (kcal.doubleValue() < 0 || kcal.doubleValue() > 3000)) {
            score -= 0.2;
        }
        return Math.max(0.0, score);
    }
}
```

```bash
cd backend && ./mvnw clean test -Dtest=MealAiDraftValidatorTest
```
Expected: PASS.

- [ ] **Step 3: Service IT — the full pipeline against the fake** (`MealAiDraftServiceIT.java` extends `AbstractIntegrationTest`, `@ActiveProfiles("companion-fake")` on the class — merges with base `demodata`):

```java
@ActiveProfiles("companion-fake")
class MealAiDraftServiceIT extends AbstractIntegrationTest {

    @Autowired private MealAiDraftService service;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testDraft_shouldMatchPantryAndEstimate_whenSentinelCarriesBoth() {
        UUID owner = databasePopulator.populateUser();
        var pantry = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(30));

        String json = """
            {"slot":"breakfast","title":"Reggeli","note":null,"items":[
              {"pantryItemId":"%s","recipeId":null,"name":"Zabpehely","amount":60,"unit":"g",
               "kcal":220,"proteinG":8,"carbsG":38,"fatG":4},
              {"pantryItemId":null,"recipeId":null,"name":"Latte","amount":1,"unit":"db",
               "kcal":120,"proteinG":6,"carbsG":10,"fatG":6}
            ]}""".formatted(pantry.getId());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "zabpehely és latte [fake-meal:" + json + "]", null);

        assertThat(res.getSlot()).isEqualTo("breakfast");
        assertThat(res.getItems()).hasSize(2);

        MealAiDraftItem matched = res.getItems().getFirst();
        assertThat(matched.getSource()).isEqualTo("pantry");
        assertThat(matched.getPantryItemId()).isEqualTo(pantry.getId());
        // macros come from the DB row, NOT the LLM numbers above:
        assertThat(matched.getKcal()).isEqualByComparingTo(pantry.getKcal());
        assertThat(matched.getConfidence()).isEqualTo(1.0);
        assertThat(matched.getNeedsReview()).isFalse();

        MealAiDraftItem estimate = res.getItems().get(1);
        assertThat(estimate.getSource()).isEqualTo("estimate");
        assertThat(estimate.getKcal()).isEqualByComparingTo("120");
        assertThat(estimate.getPer()).isEqualByComparingTo("1"); // per = amount for estimates
    }

    @Test
    void testDraft_shouldDemoteToEstimate_whenPantryIdHallucinated() {
        UUID owner = databasePopulator.populateUser();
        String json = """
            {"slot":"lunch","title":null,"note":null,"items":[
              {"pantryItemId":"%s","recipeId":null,"name":"Kamu wrap","amount":1,"unit":"db",
               "kcal":450,"proteinG":28,"carbsG":40,"fatG":18}
            ]}""".formatted(UUID.randomUUID());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getPantryItemId()).isNull();
        assertThat(line.getNeedsReview()).isTrue(); // demotion always forces review
    }

    @Test
    void testDraft_shouldReturnEmptyItems_whenNothingRecognized() {
        UUID owner = databasePopulator.populateUser();
        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:{\"slot\":\"snack\",\"title\":null,\"note\":null,\"items\":[]}]", null);
        assertThat(res.getItems()).isEmpty();
    }

    @Test
    void testDraft_should502_whenAnswerUnparseable() {
        UUID owner = databasePopulator.populateUser();
        // no sentinel -> fake echoes the prompt -> unparseable
        assertThatThrownBy(() -> service.draft(owner, LocalDate.now(), "csak szöveg", null))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void testDraft_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        UUID owner = databasePopulator.populateUser();
        String json = """
            {"slot":"dinner","title":null,"note":null,"items":[
              {"pantryItemId":null,"recipeId":null,"name":"Gyanús kaja","amount":1,"unit":"db",
               "kcal":900,"proteinG":28,"carbsG":40,"fatG":18}
            ]}""";
        MealAiDraftResponse res = service.draft(owner, LocalDate.now(), "[fake-meal:" + json + "]", null);
        assertThat(res.getItems().getFirst().getConfidence()).isEqualTo(0.6);
        assertThat(res.getItems().getFirst().getNeedsReview()).isTrue(); // <= threshold, boundary-INCLUSIVE
    }
}
```
(Adjust populator method/field names to reality — e.g. whatever `PantryItemPopulator.createFood` returns and its kcal getter. If `MultipartFile` isn't on the service signature yet, this task defines it — see Step 5.)

- [ ] **Step 4: Run — expect compile failure**

```bash
cd backend && ./mvnw clean test -Dtest=MealAiDraftServiceIT
```

- [ ] **Step 5: Implement `MealAiDraftService`**

```java
package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.MealAiDraftItem;
import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.feature.meal.config.MealAiLogProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Stateless AI meal-draft extraction (mezo-78rn): one cheap-tier LLM call parses the user's
 * free text / photo AND matches against the owner's pantry + recipe catalog. Matched lines get
 * their macros from the DB row (the LLM only picks id + amount); unknown ids are demoted to
 * estimate lines (never 500, never silent corruption). Nothing is persisted here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_AI_LOG_SWITCH, havingValue = "true")
public class MealAiDraftService {

    private static final Set<String> SLOTS = Set.of("breakfast", "lunch", "dinner", "snack");

    private final ObjectProvider<MealDraftLlm> llm;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeMapper recipeMapper;
    private final MealAiLogProperties props;
    private final MealAiDraftValidator validator;
    private final ObjectMapper objectMapper;

    /** LLM answer contract — ids as String so a malformed uuid demotes the line, not the call. */
    record ExtractedLine(String pantryItemId, String recipeId, String name, BigDecimal amount,
            String unit, BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
    }

    record ExtractedMeal(String slot, String title, String note, List<ExtractedLine> items) {
    }

    public MealDraftLlm requireAvailable() {
        MealDraftLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    public MealAiDraftResponse draft(UUID userId, LocalDate date, String text, MultipartFile photo) {
        MealDraftLlm port = requireAvailable();
        validateInput(text, photo);

        String systemPrompt = buildSystemPrompt(userId);
        String userMessage = text == null ? "" : text;

        String answer;
        if (photo != null && !photo.isEmpty()) {
            answer = port.complete(systemPrompt, userMessage, readBytes(photo), photo.getContentType());
        } else {
            answer = port.complete(systemPrompt, userMessage);
        }

        ExtractedMeal extracted = parse(answer);
        return toResponse(userId, extracted);
    }

    private void validateInput(String text, MultipartFile photo) {
        boolean hasText = text != null && !text.isBlank();
        boolean hasPhoto = photo != null && !photo.isEmpty();
        if (!hasText && !hasPhoto) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_INPUT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        if (hasPhoto) {
            if (photo.getSize() > props.maxPhotoBytes()) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
            }
            String mime = photo.getContentType();
            if (mime == null || !props.allowedMimeTypes().contains(mime)) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
            }
        }
    }

    private byte[] readBytes(MultipartFile photo) {
        try {
            return photo.getBytes();
        } catch (Exception e) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
    }

    private String buildSystemPrompt(UUID userId) {
        StringBuilder sb = new StringBuilder("""
            You extract ONE meal log from Hungarian free text and/or a food photo.
            Answer with ONE JSON object and nothing else, exactly these keys:
            {"slot":"breakfast"|"lunch"|"dinner"|"snack","title":string|null,"note":string|null,
             "items":[{"pantryItemId":string|null,"recipeId":string|null,"name":string,
                       "amount":number,"unit":string,
                       "kcal":number,"proteinG":number,"carbsG":number,"fatG":number}]}
            Rules:
            - Match a food against the CATALOG below only when it is clearly the same item; then copy
              the EXACT id into pantryItemId or recipeId. NEVER invent or alter an id.
            - For a pantry match give amount in the row's serving unit; for a recipe match amount = servings.
            - ALWAYS fill name + kcal/proteinG/carbsG/fatG as your estimate for the stated amount,
              matched lines included (they are a fallback only).
            - Unknown / restaurant / street food: both ids null.
            - Nothing edible recognized: "items":[].
            - title: short Hungarian meal title; note: only genuinely useful remarks, else null.

            PANTRY CATALOG (id | name | brand | serving):
            """);
        for (PantryItemEntity p : pantryItemRepository.findByCreatedBy(userId)) {
            sb.append(p.getId()).append(" | ").append(p.getName()).append(" | ")
              .append(p.getBrand() == null ? "-" : p.getBrand()).append(" | ")
              .append(p.getServingAmount() == null ? "100" : p.getServingAmount())
              .append(' ').append(p.getServingUnit() == null ? "g" : p.getServingUnit()).append('\n');
        }
        sb.append("\nRECIPES (id | name):\n");
        for (RecipeEntity r : recipeRepository.findByCreatedBy(userId)) {
            sb.append(r.getId()).append(" | ").append(r.getName()).append('\n');
        }
        return sb.toString();
    }

    private ExtractedMeal parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, ExtractedMeal.class);
        } catch (Exception e) {
            log.warn("Meal AI extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    private MealAiDraftResponse toResponse(UUID userId, ExtractedMeal extracted) {
        MealAiDraftResponse res = new MealAiDraftResponse();
        res.setSlot(extracted.slot() != null && SLOTS.contains(extracted.slot()) ? extracted.slot() : "snack");
        res.setTitle(extracted.title());
        res.setNote(extracted.note());

        List<MealAiDraftItem> items = new ArrayList<>();
        for (ExtractedLine line : extracted.items() == null ? List.<ExtractedLine>of() : extracted.items()) {
            if (items.size() >= props.maxItems()) {
                log.warn("Meal AI draft truncated at {} items", props.maxItems());
                break;
            }
            MealAiDraftItem item = mapLine(userId, line);
            if (item != null) {
                items.add(item);
            }
        }
        res.setItems(items);
        return res;
    }

    private MealAiDraftItem mapLine(UUID userId, ExtractedLine line) {
        UUID pantryId = parseUuid(line.pantryItemId());
        UUID recipeId = parseUuid(line.recipeId());

        if (pantryId != null) {
            PantryItemEntity p = pantryItemRepository.findByIdAndCreatedBy(pantryId, userId).orElse(null);
            if (p != null) {
                return pantryItem(p, line);
            }
            log.warn("Meal AI draft: hallucinated pantry id {} demoted to estimate", pantryId);
            return estimateItem(line, true);
        }
        if (recipeId != null) {
            RecipeEntity r = recipeRepository.findByIdAndCreatedBy(recipeId, userId).orElse(null);
            if (r != null) {
                return recipeItem(r, line);
            }
            log.warn("Meal AI draft: hallucinated recipe id {} demoted to estimate", recipeId);
            return estimateItem(line, true);
        }
        return estimateItem(line, false);
    }
    // ... pantryItem / recipeItem / estimateItem / parseUuid below
}
```

Mapping helpers (complete them in the class):

```java
    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null; // malformed id == no id -> estimate
        }
    }

    /** Matched pantry line: snapshot numbers from the DB row, never the LLM. */
    private MealAiDraftItem pantryItem(PantryItemEntity p, ExtractedLine line) {
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("pantry");
        item.setPantryItemId(p.getId());
        item.setName(p.getName());
        BigDecimal per = p.getServingAmount() == null ? BigDecimal.ONE : p.getServingAmount();
        String basisUnit = p.getServingUnit() == null ? "unit" : p.getServingUnit();
        item.setPer(per);
        item.setBasisUnit(basisUnit);
        item.setAmount(positiveOr(line.amount(), per));
        item.setUnit(basisUnit);
        item.setKcal(zeroSafe(p.getKcal()));
        item.setProteinG(zeroSafe(p.getProteinG()));
        item.setCarbsG(zeroSafe(p.getCarbsG()));
        item.setFatG(zeroSafe(p.getFatG()));
        item.setNova(p.getNova() == null ? null : p.getNova().intValue());
        item.setConfidence(1.0);
        item.setNeedsReview(false);
        return item;
    }

    /** Matched recipe line: per-serving snapshot exactly like MealService's recipe arm. */
    private MealAiDraftItem recipeItem(RecipeEntity r, ExtractedLine line) {
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("recipe");
        item.setRecipeId(r.getId());
        item.setName(r.getName());
        item.setPer(BigDecimal.ONE);
        item.setBasisUnit("adag");
        item.setAmount(positiveOr(line.amount(), BigDecimal.ONE));
        item.setUnit("adag");
        var macros = recipeMapper.toResponse(r).getMacros(); // same rollup MealService reuses
        // per-serving = whole / servings, scale 6 — mirror MealService.perServing
        ...
        item.setNova(r.getNovaDominant() == null ? null : r.getNovaDominant().intValue());
        item.setConfidence(1.0);
        item.setNeedsReview(false);
        return item;
    }

    /** Estimate (or demoted) line: LLM macros for the stated portion; per = amount. */
    private MealAiDraftItem estimateItem(ExtractedLine line, boolean demoted) {
        if (line.kcal() == null || line.name() == null || line.name().isBlank()) {
            log.warn("Meal AI draft: dropping macro-less line '{}'", line.name());
            return null;
        }
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("estimate");
        item.setName(line.name());
        BigDecimal amount = positiveOr(line.amount(), BigDecimal.ONE);
        item.setAmount(amount);
        item.setUnit(line.unit() == null || line.unit().isBlank() ? "adag" : line.unit());
        item.setPer(amount);               // factor 1: snapshots carry the portion totals
        item.setBasisUnit(item.getUnit());
        item.setKcal(line.kcal());
        item.setProteinG(zeroSafe(line.proteinG()));
        item.setCarbsG(zeroSafe(line.carbsG()));
        item.setFatG(zeroSafe(line.fatG()));
        item.setNova(null);
        double confidence = validator.confidence(line.kcal(), line.proteinG(), line.carbsG(), line.fatG());
        item.setConfidence(confidence);
        // boundary-INCLUSIVE threshold (mezo-8vum deviation note); demotion always forces review
        item.setNeedsReview(demoted || confidence <= props.confidenceThreshold());
        return item;
    }

    private static BigDecimal positiveOr(BigDecimal v, BigDecimal fallback) {
        return v == null || v.signum() <= 0 ? fallback : v;
    }

    private static BigDecimal zeroSafe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
```

Implementation notes for the engineer:
- **Repository methods:** check `PantryItemRepository` / `RecipeRepository` for existing owned-list/by-id-and-owner derived queries (the pantry list endpoint + `MealService.resolvePantry`/`resolveRecipe` at `MealService.java:312-334` use them). Reuse their exact names; only add `findByCreatedBy(UUID)` / `findByIdAndCreatedBy(UUID, UUID)` if nothing equivalent exists (soft-delete is handled by `@SQLRestriction`).
- **Recipe per-serving macros:** `MealService.perServing` (L349) does whole÷servings at scale 6. Make it reusable (e.g. package-private static in `MealService`) instead of copy-pasting; fill the `...` in `recipeItem` with the same four setters MealService's recipe arm computes (kcal/protein/carbs/fat per serving).
- **`MealAiDraftItem` setter types:** confidence in the generated dto may be `Double`/`BigDecimal` — adapt `setConfidence(...)` accordingly.
- **Dto instantiation style:** if generated dtos use builders/ctors instead of setters, follow whatever `PantryScrapeService` does with `PantryScrapeResponse`.

- [ ] **Step 6: Run — expect pass**

```bash
cd backend && ./mvnw clean test -Dtest='MealAiDraftValidatorTest,MealAiDraftServiceIT'
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal
git -c core.hooksPath=/dev/null commit -m "feat(meal): MealAiDraftService — catalog prompt, parse, demotion, confidence (mezo-78rn)"
```

---

### Task 7: Controller + multipart IT helper + endpoint IT suite

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/controller/MealAiDraftController.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftApiIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiLlmUnavailableApiIT.java`

**Interfaces:**
- Consumes: generated `MealAiLogApi` (Task 1 — read the exact generated signature in `backend/target/generated-sources/openapi/.../MealAiLogApi.java` before implementing), `MealAiDraftService.draft(...)` (Task 6), `CurrentUserId` (used by `MealController`), `ownerAuthHeaders()`/`assertHasRequestError` from `ApiIntegrationTest`.
- Produces: `POST /api/meal/ai-draft` live; `postMultipartForResponse(path, parts, type)` helper on `ApiIntegrationTest` for future multipart ITs.

- [ ] **Step 1: Controller** (mirror `PantryScrapeController` + `MealController`'s `CurrentUserId` usage):

```java
package io.mrkuhne.mezo.feature.meal.controller;

import io.mrkuhne.mezo.api.controller.MealAiLogApi;
import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.feature.meal.service.MealAiDraftService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Switch off -> no bean -> 404 (same gating story as PantryScrapeController). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_AI_LOG_SWITCH, havingValue = "true")
public class MealAiDraftController implements MealAiLogApi {

    private final MealAiDraftService service;
    private final CurrentUserId currentUserId;

    @Override
    public MealAiDraftResponse draftMealFromAi(LocalDate date, String text, MultipartFile photo) {
        return service.draft(currentUserId.get(), date, text, photo);
    }
}
```
(Match the EXACT generated method signature/param order from `MealAiLogApi.java`, and the exact `CurrentUserId` accessor `MealController` uses. Adjust the `CurrentUserId` import path to reality.)

- [ ] **Step 2: Multipart helper in `ApiIntegrationTest`** (next to `postForBody`; use the same `TestRestTemplate` field name the class uses):

```java
protected <T> ResponseEntity<T> postMultipartForResponse(String path,
        org.springframework.util.MultiValueMap<String, Object> parts, Class<T> responseType) {
    HttpHeaders headers = ownerAuthHeaders();
    headers.setContentType(MediaType.MULTIPART_FORM_DATA);
    return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(parts, headers), responseType);
}
```
And a small part-builder helper for photo bytes:

```java
protected static org.springframework.core.io.ByteArrayResource photoPart(byte[] bytes, String filename) {
    return new org.springframework.core.io.ByteArrayResource(bytes) {
        @Override public String getFilename() { return filename; }
    };
}
```

- [ ] **Step 3: Write the endpoint IT** (`MealAiDraftApiIT.java` extends `ApiIntegrationTest`, `@ActiveProfiles("companion-fake")`):

Cover, using `postMultipartForResponse` (photo parts: `HttpHeaders` with `Content-Type: image/jpeg` per part when needed — wrap in `HttpEntity<>(photoPart(...), partHeaders)`):

```java
@ActiveProfiles("companion-fake")
class MealAiDraftApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_shouldReturnDraft_whenTextCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "latte [fake-meal:{\"slot\":\"snack\",\"title\":null,\"note\":null,"
                + "\"items\":[{\"pantryItemId\":null,\"recipeId\":null,\"name\":\"Latte\","
                + "\"amount\":1,\"unit\":\"db\",\"kcal\":120,\"proteinG\":6,\"carbsG\":10,\"fatG\":6}]}]");

        ResponseEntity<MealAiDraftResponse> res =
                postMultipartForResponse("/api/meal/ai-draft", parts, MealAiDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getItems()).hasSize(1);
        assertThat(res.getBody().getItems().getFirst().getSource()).isEqualTo("estimate");
    }

    @Test
    void testDraft_shouldReturnDraft_whenPhotoBytesCarrySentinel() {
        byte[] fakeJpeg = ("[fake-meal:{\"slot\":\"dinner\",\"title\":null,\"note\":null,\"items\":[]}]")
                .getBytes(StandardCharsets.UTF_8);
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.IMAGE_JPEG);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(fakeJpeg, "meal.jpg"), photoHeaders));

        ResponseEntity<MealAiDraftResponse> res =
                postMultipartForResponse("/api/meal/ai-draft", parts, MealAiDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getSlot()).isEqualTo("dinner");
        assertThat(res.getBody().getItems()).isEmpty(); // honest empty
    }

    @Test
    void testDraft_should400_whenNeitherTextNorPhoto() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        ResponseEntity<String> res = postMultipartForResponse("/api/meal/ai-draft", parts, String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "MEAL_AI_INPUT_REQUIRED");
    }

    @Test
    void testDraft_should400_whenPhotoMimeNotAllowed() {
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(MediaType.APPLICATION_PDF);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("photo", new HttpEntity<>(photoPart(new byte[] {1}, "x.pdf"), photoHeaders));
        ResponseEntity<String> res = postMultipartForResponse("/api/meal/ai-draft", parts, String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testDraft_should400_whenPhotoTooLarge() {
        // max-photo-bytes is 5_000_000 in yaml — send more via @TestPropertySource-shrunk cap instead:
        // add @TestPropertySource(properties = "mezo.meal-ai-log.max-photo-bytes=10000") on the class
        // OR (simpler) a dedicated small IT class; assert 400 with a 20kB payload.
    }

    @Test
    void testDraft_should502_whenLlmAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "no sentinel here");
        ResponseEntity<String> res = postMultipartForResponse("/api/meal/ai-draft", parts, String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "MEAL_AI_EXTRACT_FAILED");
    }
}
```

Notes: for the size-cap test prefer a small `@TestPropertySource` cap (10 kB) on this class if Spring's own multipart limit interferes with a >5 MB in-test payload; Spring's `spring.servlet.multipart.max-file-size` default is 1 MB — the service cap test must use a cap BELOW that (hence 10 kB) or configure the multipart limit in yaml. Decide in-code and leave a comment.

`MealAiLlmUnavailableApiIT.java` (mirror `PantryScrapeLlmUnavailableApiIT`):

```java
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class MealAiLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_should503_whenCompanionOff() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("date", "2026-07-18");
        parts.add("text", "bármi");
        ResponseEntity<String> res = postMultipartForResponse("/api/meal/ai-draft", parts, String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "MEAL_AI_LLM_UNAVAILABLE");
    }

    @Test
    void testDraft_should404_whenFeatureSwitchOff() {
        // separate nested/class with mezo.feature.meal-ai-log.enabled=false -> no controller bean -> 404
    }
}
```
(Implement the 404-switch-off case as its own tiny IT class with `@TestPropertySource(properties = "mezo.feature.meal-ai-log.enabled=false")` — mirror how the pantry suite proves switch-off → 404.)

- [ ] **Step 4: Run — expect failures first (before Step 1 code lands), then pass**

```bash
cd backend && ./mvnw clean test -Dtest='MealAiDraftApiIT,MealAiLlmUnavailableApiIT'
```
Expected: PASS after implementation.

- [ ] **Step 5: Focused regression sweep + commit**

```bash
cd backend && ./mvnw clean test -Dtest='MealAiDraftApiIT,MealAiLlmUnavailableApiIT,MealApiIT,MealAiDraftServiceIT,CompanionLlmFakeIT,ArchitectureTest'
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(meal): ai-draft endpoint + multipart IT plumbing (mezo-78rn)"
```
Expected: all green — `ArchitectureTest` proves the port direction is legal.

---

### Task 8: FE data layer — FormData client, aiDraft, estimate/provenance types, mocks

**Files:**
- Modify: `frontend/src/data/_client/api.ts`
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/fuel/mealApi.ts`
- Modify: `frontend/src/data/fuel/fuelHooks.ts`
- Modify: `frontend/src/data/fuel/fuel.ts` (mock seeds home — or wherever `MOCK_SCRAPE_DRAFT`'s sibling belongs; scrape's lives in `data/fuel/pantry.ts:339`)
- Test: `frontend/src/data/fuel/fuelHooks.test.tsx`

**Interfaces:**
- Consumes: generated `MealAiDraftResponse`/`MealAiDraftItem`/`MealProvenance`/`MealItemRequest` from `api.gen.ts` (Task 1); `apiFetch` (`api.ts:22-30`); `useMealActions` (`fuelHooks.ts:58-91`); `toRequest` (`mealApi.ts:102-115`); mock `buildLine` (`fuelHooks.ts:145-176`).
- Produces (Task 10 depends on these exact names):
  - `types.ts`: `MealItemSource = 'recipe' | 'pantry' | 'estimate'`; `MealItemInput` discriminated union; `MealInput.provenance?: MealProvenanceInput`; `MealProvenanceInput = { origin: 'manual' | 'ai-text' | 'ai-photo'; model?: string | null; confidence?: number | null; rawText?: string | null }`; `MealAiDraft = { slot: MealSlot; title: string | null; note: string | null; items: MealAiDraftLine[] }`; `MealAiDraftLine = { source: MealItemSource; pantryItemId: string | null; recipeId: string | null; name: string; amount: number; unit: string; per: number; basisUnit: string; kcal: number; proteinG: number; carbsG: number; fatG: number; nova: number | null; confidence: number; needsReview: boolean }`.
  - `mealApi.aiDraft(req: { date: string; text?: string; photo?: Blob }): Promise<MealAiDraft>`.
  - `useMealActions(date?)` additionally returns `draftMealFromAi(req): Promise<MealAiDraft>`.
  - `MOCK_AI_MEAL_DRAFT: MealAiDraft` (one pantry-matched line referencing a real mock pantry seed id + one estimate line with `needsReview: true`).

- [ ] **Step 1: Write failing hook test**

Add to `fuelHooks.test.tsx` (mock mode, existing wrapper style):

```tsx
it('draftMealFromAi returns the canned draft in mock mode', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useMealActions(), { wrapper: QueryWrapper })
  const promise = result.current.draftMealFromAi({ date: '2026-07-18', text: 'csirkés wrap' })
  vi.advanceTimersByTime(700)
  const draft = await promise
  expect(draft.items.length).toBeGreaterThan(0)
  expect(draft.items.some(l => l.source === 'estimate')).toBe(true)
  vi.useRealTimers()
})

it('logMeal accepts an estimate line and computes its contribution from snapshots', async () => {
  const { result } = renderHook(() => useMealActions('2026-07-18'), { wrapper: QueryWrapper })
  result.current.logMeal({
    slot: 'lunch',
    loggedAt: new Date('2026-07-18T12:00:00Z').toISOString(),
    title: null,
    items: [{ source: 'estimate', name: 'Csirkés wrap', amount: 1, unit: 'db',
              per: 1, basisUnit: 'db', kcal: 450, proteinG: 28, carbsG: 40, fatG: 18 }],
    provenance: { origin: 'ai-text', rawText: 'csirkés wrap' },
  })
  await waitFor(() => { /* assert the fuelDay cache gained a meal with kcal 450 — mirror the file's existing logMeal assertions */ })
})
```
(Follow the file's established render/assert idioms exactly — the second test's cache assert copies whatever the existing logMeal test asserts.)

- [ ] **Step 2: Run — expect failure**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- fuelHooks
```

- [ ] **Step 3: Implement**

1. `api.ts` — FormData-aware headers (surgical change at L22-30):

```ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  ...
```
(Leave the rest of the function untouched — the browser sets the multipart boundary itself.)

2. `types.ts` — widen `MealItemSource` (L58) to include `'estimate'`; split `MealInput` items into the discriminated union + add `provenance`; add `MealProvenanceInput`, `MealAiDraft`, `MealAiDraftLine` (shapes above). Update ONLY type declarations — chase compile errors in consumers (LogMealSheet's lines are `'recipe' | 'pantry'`, they still assign fine).

3. `mealApi.ts` — extend `toRequest` (L102-115):

```ts
items: input.items.map(it =>
  it.source === 'estimate'
    ? ({ source: 'estimate', recipeId: null, pantryItemId: null,
        amount: it.amount, unit: it.unit, name: it.name, per: it.per,
        basisUnit: it.basisUnit, kcal: it.kcal, proteinG: it.proteinG,
        carbsG: it.carbsG, fatG: it.fatG, nova: it.nova ?? null } satisfies MealItemRequest)
    : ({ source: it.source,
        recipeId: it.source === 'recipe' ? it.refId : null,
        pantryItemId: it.source === 'pantry' ? it.refId : null,
        amount: it.amount, unit: it.unit } satisfies MealItemRequest)),
provenance: input.provenance ?? null,
```
and add:

```ts
aiDraft: (req: { date: string; text?: string; photo?: Blob }): Promise<MealAiDraft> => {
  const form = new FormData()
  form.append('date', req.date)
  if (req.text) form.append('text', req.text)
  if (req.photo) form.append('photo', req.photo, 'photo.jpg')
  return apiFetch<MealAiDraftResponse>('/api/meal/ai-draft', { method: 'POST', body: form })
    .then(fromAiDraftResponse)
},
```
with `fromAiDraftResponse` a structural mapper (mirror `fromScrapeResult` in `pantryApi.ts:84-88`).

4. Mock draft — add next to the fuel seeds (import a REAL mock pantry item so the Kamra badge path is exercised):

```ts
export const MOCK_AI_MEAL_DRAFT: MealAiDraft = {
  slot: 'lunch',
  title: 'Csirkés wrap + latte',
  note: null,
  items: [
    { source: 'pantry', pantryItemId: <existing seed id>, recipeId: null, name: <seed name>,
      amount: 60, unit: 'g', per: 100, basisUnit: 'g', kcal: <seed kcal>, proteinG: <seed>, carbsG: <seed>, fatG: <seed>,
      nova: <seed nova>, confidence: 1, needsReview: false },
    { source: 'estimate', pantryItemId: null, recipeId: null, name: 'Csirkés wrap',
      amount: 1, unit: 'db', per: 1, basisUnit: 'db', kcal: 450, proteinG: 28, carbsG: 40, fatG: 18,
      nova: null, confidence: 0.6, needsReview: true },
  ],
}
```

5. `fuelHooks.ts`:
   - `useMealActions` gains (mirror `scrapeItem`'s plain-callback dual-mode idiom, `pantryHooks.ts:96-102`):
   ```ts
   const draftMealFromAi = useCallback(
     (req: { date: string; text?: string; photo?: Blob }): Promise<MealAiDraft> =>
       mock
         ? new Promise(resolve => setTimeout(() => resolve(MOCK_AI_MEAL_DRAFT), 600))
         : mealApi.aiDraft(req),
     [mock],
   )
   ```
   and return it from the hook.
   - mock `buildLine` (L145-176): add the estimate branch — no seed lookup; `name` from input, `nova` from input (null), `contribution = { kcal: round(kcal / per * amount), ... }` (per = amount ⇒ contribution = the given macros).

- [ ] **Step 4: Run — both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green (real-mode tests compile against the new types; no behavior change for recipe/pantry paths).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): FE data layer — aiDraft call, estimate lines, provenance, mock draft (mezo-78rn)"
```

---

### Task 9: Client-side image resize util

**Files:**
- Create: `frontend/src/shared/lib/resizeImage.ts`
- Test: `frontend/src/shared/lib/resizeImage.test.ts`

**Interfaces:**
- Produces: `fitWithin(width: number, height: number, maxDim: number): { width: number; height: number }` (pure, tested) and `resizeImage(file: File, maxDim?: number, quality?: number): Promise<Blob>` (DOM part — canvas/createImageBitmap; jsdom can't run it, verified in live smoke; Task 10 mocks it in tests).

- [ ] **Step 1: Failing test for the pure math**

```ts
import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/shared/lib/resizeImage'

describe('fitWithin', () => {
  it('keeps small images untouched', () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 })
  })
  it('scales landscape down to maxDim preserving ratio', () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 })
  })
  it('scales portrait down to maxDim preserving ratio', () => {
    expect(fitWithin(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 })
  })
})
```

- [ ] **Step 2: Run — fail; implement**

```ts
/** Fit (width x height) inside a maxDim square, preserving aspect ratio (no upscale). */
export function fitWithin(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height }
  }
  const scale = maxDim / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Downscale a photo to ~maxDim px JPEG before upload (the photo is ephemeral — extraction
 * only, never stored server-side). DOM-dependent; excluded from jsdom tests, proven in live smoke.
 */
export async function resizeImage(file: File, maxDim = 1024, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  )
}
```

```bash
cd frontend && pnpm test -- resizeImage
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/lib
git -c core.hooksPath=/dev/null commit -m "feat(shared): resizeImage canvas util for AI photo upload (mezo-78rn)"
```

---

### Task 10: AiLogSheet + Mai entry point

**Files:**
- Create: `frontend/src/features/fuel/sheets/AiLogSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/AiLogSheet.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`

**Interfaces:**
- Consumes: `useMealActions().draftMealFromAi/logMeal` (Task 8), `resizeImage` (Task 9, mocked in tests), `Sheet` render-prop (`shared/ui/Sheet.tsx`), `Chip`/`Eyebrow`/`StatCell`/`GhostState` primitives, `MealAiDraft`/`MealItemInput` types (Task 8), ImportItemSheet as the structural template (`features/fuel/sheets/ImportItemSheet.tsx` — phases, error strings, spinner card, needsReview hint at L409-413).
- Produces: `AiLogSheet({ date, initialSlot?, onClose, onManualFallback }: { date: string; initialSlot?: MealSlot; onClose: () => void; onManualFallback: () => void })`; FuelMaiPage gains an „AI” button beside the „Log” button (L62-70) + `aiOpen` state + mount.

- [ ] **Step 1: Failing component tests** (`AiLogSheet.test.tsx` — copy ImportItemSheet.test.tsx's harness: `vi.stubEnv('VITE_USE_MOCK','true')`, `vi.hoisted` + `vi.mock('@/data/hooks', importOriginal)` override slot for `draftMealFromAi`, fake timers + `fireEvent`, inline QueryClient wrapper; ALSO `vi.mock('@/shared/lib/resizeImage', ...)` returning the input blob):

Cover:
1. **text path** — type „csirkés wrap és latte", submit → after `advanceTimersByTime(700)` the review list shows both mock lines with badges **Kamra** and **Becslés**;
2. **needsReview hint** — the estimate line renders the yellow „ellenőrizd" warning;
3. **photo path** — set a file on the file input (`fireEvent.change(input, { target: { files: [file] } })`) → submit → review renders (resizeImage mock called);
4. **line edit + delete** — change an amount input, delete a line, confirm → `logMeal` called with the edited amount and 1 item;
5. **confirm payload** — `logMeal` receives `provenance.origin === 'ai-text'` (no photo) and the estimate line carries per/basisUnit/kcal…;
6. **empty draft** — override `draftMealFromAi` → resolve `{ slot:'snack', title:null, note:null, items: [] }` → „Nem ismertem fel ételt" + „Kézi naplózás" CTA → clicking it calls `onManualFallback`;
7. **error path** — override → reject → error message + back on input phase.

- [ ] **Step 2: Run — fail**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- AiLogSheet
```

- [ ] **Step 3: Implement `AiLogSheet`**

Structure (mirror ImportItemSheet's phase machine; ALL copy Hungarian):

```tsx
type Phase = 'input' | 'drafting' | 'review'

export function AiLogSheet({ date, initialSlot, onClose, onManualFallback }: AiLogSheetProps) {
  const { draftMealFromAi, logMeal } = useMealActions(date)
  const [phase, setPhase] = useState<Phase>('input')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<MealAiDraft | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])   // draft lines + local amount edits
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? 'snack')
  ...
}
```

- **input phase:** `<textarea>` („Mit ettél? Írd le szabadon…"), photo affordance — `<input type="file" accept="image/*" capture="environment">` hidden behind a `Chip` („Fotó”, camera icon; shows filename/thumbnail via `URL.createObjectURL` when set, removable), CTA „AI naplózás” (sparkle icon) disabled unless `text.trim() || photo`. On submit:
  ```tsx
  const submit = async () => {
    setPhase('drafting'); setError(null)
    try {
      const blob = photo ? await resizeImage(photo) : undefined
      const d = await draftMealFromAi({ date, text: text.trim() || undefined, photo: blob })
      setDraft(d); setLines(d.items.map((it, i) => ({ ...it, key: i })))
      setSlot(d.slot); setPhase('review')
    } catch {
      setError('Nem sikerült az AI-feldolgozás. Próbáld újra, vagy naplózz kézzel.')
      setPhase('input')
    }
  }
  ```
- **drafting phase:** the shared spinner card (copy ImportItemSheet L251-266, text „Elemzem az étkezést…").
- **review phase:**
  - empty `lines` → `GhostState` („Nem ismertem fel ételt a megadottakból.") + CTA „Kézi naplózás" → `onManualFallback()` (+ close).
  - otherwise: slot selector chips (4 slots, Hungarian labels — reuse the slot-label map idiom from `LogMealSheet.tsx:28-33`), line list: per line a badge (`source === 'pantry'` → `<Chip variant="brand">Kamra</Chip>`; `'recipe'` → `<Chip>Recept</Chip>`; `'estimate'` → `<Chip variant="warning">Becslés</Chip>`), name, editable amount `<input type="number" inputMode="decimal">` + unit label, kcal preview (`Math.round(kcal / per * amount)` kcal), delete ×; `needsReview` line → yellow warning `<p style={{ color: 'var(--warning)' }}>Az AI nem teljesen biztos ebben a sorban — ellenőrizd a számokat.</p>` (ImportItemSheet L409-413 idiom); `draft.title` shown as editable title input, `draft.note` as muted text.
  - CTA „Naplózás":
  ```tsx
  const confirm = (close: () => void) => {
    const items: MealItemInput[] = lines.map(l =>
      l.source === 'estimate'
        ? { source: 'estimate', name: l.name, amount: l.amount, unit: l.unit,
            per: l.per, basisUnit: l.basisUnit, kcal: l.kcal, proteinG: l.proteinG,
            carbsG: l.carbsG, fatG: l.fatG, nova: l.nova }
        : { source: l.source, refId: (l.source === 'pantry' ? l.pantryItemId : l.recipeId)!,
            amount: l.amount, unit: l.unit })
    logMeal({
      slot,
      loggedAt: new Date().toISOString(),
      title: title || null,
      items,
      provenance: {
        origin: photo ? 'ai-photo' : 'ai-text',
        confidence: lines.length ? Math.min(...lines.map(l => l.confidence)) : null,
        rawText: text.trim() || null,
      },
    })
    close()
  }
  ```
  (`logMeal` is a sync `.mutate` — mock path lands in the cache immediately; mirror how `LogMealSheet` closes after save at `LogMealSheet.tsx:121-132`.)

- [ ] **Step 4: Wire the Mai entry** (`FuelMaiPage.tsx`): add `const [aiOpen, setAiOpen] = useState(false)` next to `logOpen` (L35-37); beside the „Log" header button (L62-70) add an „AI" button (sparkle icon, same `pgact-np np-press` styling); mount after the LogMealSheet line (L207):

```tsx
{aiOpen && (
  <AiLogSheet
    date={/* the page's displayed fuel date — same value the page passes to useMealActions/useFuelDay; fall back to today's ISO date */}
    onClose={() => setAiOpen(false)}
    onManualFallback={() => { setAiOpen(false); openLog() }}
  />
)}
```

- [ ] **Step 5: Full FE gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green, both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): AiLogSheet — AI meal log wizard on Mai (mezo-78rn)"
```

---

### Task 11: Docs — feature docs, spec deviations, lint

**Files:**
- Modify: `docs/features/fuel.md` (meal-logging sections — new AI-log flow, ai-draft endpoint, estimate source, provenance; §4 endpoints + §5 integrations + §10 file map per the 10-section template)
- Modify: the platform/companion feature doc that lists LLM port adapters (grep `PantryScrapeLlmAdapter` under `docs/features/` — add `MealDraftLlmAdapter` + the CompanionLlm multimodal overload to the same table/section)
- Modify: `docs/superpowers/specs/2026-07-18-fuel-ai-meal-log-design.md` — append an "## Implementation deviations (2026-07-18)" section (mirror the sibling spec's) recording at minimum: (1) consumer-owned `MealDraftLlm` port per ADR 0012 instead of the spec's direct meal→companion edge; (2) `ck_meal_item_arm` also widened (spec only listed `ck_meal_item_source`); (3) anything else that emerged during implementation.
- Run: `node scripts/lint-docs.mjs`

**Interfaces:**
- Consumes: everything shipped in Tasks 1-10; the sibling deviations section (`2026-07-18-fuel-url-scrape-import-design.md:127-152`) as the template.
- Produces: current living docs; lint green (no staleness flags on touched docs).

- [ ] **Step 1: Update the three doc surfaces** (edit affected sections in place — no changelogs; `file:line` pointers over pasted code).
- [ ] **Step 2: Lint**

```bash
node scripts/lint-docs.mjs
```
Expected: exit 0, no staleness/orphan/broken-link findings for the touched docs.

- [ ] **Step 3: Commit**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(fuel): AI meal log — feature docs + spec deviations (mezo-78rn)"
```

---

## After the plan (session close — not plan tasks)

Per CLAUDE.md + memory notes: push the branch → self-PR (CI is the authoritative full-suite gate) → land via `gh pr merge --merge` (worktree idiom — the main checkout may be busy) → bd close `mezo-78rn` with notes (from the MAIN checkout) → **live smoke** (spec §Testing: one real food photo + one Hungarian sentence against the running stack with `GEMINI_API_KEY`) is a manual step — file a bd follow-up if not run in-session.

## Self-review notes (spec → task mapping)

- Contract §spec → Task 1 (ai-draft multipart, estimate source, provenance envelope). ✔
- Backend §1 (catalog context, strict prompt, one call, parse, id validation, Atwater, DB-macros-for-matches) → Task 6. ✔
- Backend §2 (photo cap + mime whitelist, request-scoped bytes) → Tasks 5 (properties) + 6 (validateInput). ✔
- Backend §3 (confirm path: estimate arm, provenance persist, scoring unchanged) → Task 3. ✔
- Backend §4 (cross-feature edge) → ADR 0012 SUPERSEDES: Tasks 4-5 (port + adapter + 503 via ObjectProvider). ✔
- DB §spec (2 changesets) → Task 2 (+ the spec-missed `ck_meal_item_arm` relax — recorded as deviation in Task 11). ✔
- Configuration §spec → Task 5. ✔
- Frontend §spec (AiLogSheet, resize, badges, needsReview hint, manual CTA, mock draft) → Tasks 8-10. ✔
- Error handling table → 503 Task 5/6, 502 Task 6, 400s Task 6/7, honest-empty Task 6 (+FE Task 10), demotion Task 6. ✔
- Testing §spec → ITs Tasks 2/3/6/7, unit Tasks 6/9, FE both modes Tasks 8/10, live smoke deferred to session close. ✔
