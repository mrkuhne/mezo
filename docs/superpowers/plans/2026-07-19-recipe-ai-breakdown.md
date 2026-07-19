# AI Recipe Template Breakdown Implementation Plan (mezo-bw3y)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The RecipeDetailPage sparkle zone becomes a real „Pontszám" surface: deterministic 3-dim template envelope + lazily generated, cached LLM prose (summary/detail/improve/fitsFor) via `GET /api/recipe/{id}/breakdown`.

**Architecture:** Hybrid per spec `docs/superpowers/specs/2026-07-19-recipe-ai-breakdown-design.md` — the P7 engine (`MealScoringService`) gains an envelope-returning recipe method (`recipeFit` delegates to it → hero ≡ breakdown); `feature/recipe` orchestrates cache-or-generate with a consumer-owned `RecipeBreakdownLlm` port (ADR 0012, companion adapter, cheap tier); envelope persisted in a new `recipe.breakdown` jsonb + prose `fitsFor` into the existing reserved `recipe.fits_for`. FE: dual-mode `useRecipeBreakdown` (mock = existing `templateBreakdown` seed) + `ScoreBreakdownBody` extracted from `MealScoreSheet`.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct-free manual DTO mapping for the envelope; React 19 + TanStack Query + MSW; OpenAPI contract-first (openapi-merge).

## Global Constraints

- Contract-first: edit `api/feature/recipe/recipe.yml` BEFORE code; regen via `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`; backend types regen in `./mvnw` builds.
- Backend always `./mvnw clean …` (Lombok+MapStruct incremental flakiness); focused tests with `-Dtest=…`; full suite is CI's job (16 GB box OOMs).
- No `@Value`; flags = `mezo.feature.<name>.enabled` + `FeaturesConfiguration` constant + `@ConditionalOnProperty`.
- No new SystemMessage codes (LLM failure is swallowed → deterministic fallback; 404 = existing `RESOURCE_NOT_FOUND`).
- recipe⇸meal package edge is FORBIDDEN (frozen slice cycle, mezo-ah18.16) — the envelope DTO mapping must live in `feature/nutrition`.
- FE: hooks only via `@/data/hooks`; deep absolute `@/*` imports; no new barrels; both test modes must pass; worktree commits with `git -c core.hooksPath=/dev/null commit`.
- Liquibase: `{YYYYMMDDHHMM}_mezo-bw3y_{desc}.sql`, never modify released changesets.

---

### Task 1: Contract + codegen

**Files:**
- Modify: `api/feature/recipe/recipe.yml`
- Regen: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces produced:** path `GET /api/recipe/{id}/breakdown` (operationId `getRecipeBreakdown`, tag Recipe) → `RecipeBreakdownResponse { breakdown: MealBreakdown|null, fitsFor: string[] }`; backend generated `RecipeApi.getRecipeBreakdown(UUID id)`; FE `components['schemas']['RecipeBreakdownResponse']`.

- [ ] **Step 1.1:** In `recipe.yml` add under `paths` (after `/api/recipe/{id}`):

```yaml
  /api/recipe/{id}/breakdown:
    get:
      tags: [Recipe]
      operationId: getRecipeBreakdown
      summary: Lazily materialized template breakdown — deterministic 3-dim envelope + cached AI prose (mezo-bw3y)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Breakdown (breakdown null while the recipe has no kcal), content: { application/json: { schema: { $ref: '#/components/schemas/RecipeBreakdownResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

and under `components.schemas` (cross-fragment `$ref` to the meal fragment's `MealBreakdown` — the `SystemMessage` merge precedent):

```yaml
    RecipeBreakdownResponse:
      type: object
      required: [fitsFor]
      properties:
        breakdown:
          nullable: true
          allOf: [ { $ref: '#/components/schemas/MealBreakdown' } ]
        fitsFor: { type: array, items: { type: string } }
```

- [ ] **Step 1.2:** `cd api/generate && npm run generate:api` → expect merged `api/openapi.yml` containing `getRecipeBreakdown`. Then `cd frontend && pnpm generate:api` → `api.gen.ts` gains `RecipeBreakdownResponse`.
- [ ] **Step 1.3:** Commit: `feat(api): recipe template breakdown contract (mezo-bw3y)`.

### Task 2: Migration + entity + nutrition envelope builder

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607191100_mezo-bw3y_recipe_breakdown.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/mapper/BreakdownDtoMapper.java` (relocated envelope→DTO mapping)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/mapper/MealMapper.java` (delegate to the relocated mapper — inspect current breakdown-mapping code first and move it verbatim)
- Test: extend the existing MealScoringService test (or `RecipeFitIT`) with template-envelope assertions.

**Interfaces produced:**
- `MealScoringService.recipeTemplateBreakdown(List<ScoredLine> perServingLines): MealBreakdownJson` — null iff `recipeFit` is null; envelope = macro/micro/nova dims (renormalized weights) + degraded context dim (`weight 0, score 0, context []`), `value` = renormalized total, `confidence = Σ wᵢ·covᵢ / Σ wᵢ` over the three live dims, `summary null`, `improve []`, honest `compute:` tools.
- `recipeFit` delegates: `var b = recipeTemplateBreakdown(lines); return b == null ? null : b.value();`
- `BreakdownDtoMapper.toDto(MealBreakdownJson): io.mrkuhne.mezo.api.dto.MealBreakdown` (nutrition-owned; meal + recipe both call it).
- `RecipeEntity.breakdown: MealBreakdownJson` (`@JdbcTypeCode(SqlTypes.JSON)`, `columnDefinition = "jsonb"` — the `MealEntity.breakdown` pattern).

- [ ] **Step 2.1:** Migration SQL:

```sql
-- Recipe template breakdown cache (mezo-bw3y): the deterministic 3-dim envelope + AI prose,
-- persisted on first successful prose enrichment; NULL = never generated / invalidated.
ALTER TABLE recipe ADD COLUMN breakdown jsonb;
```

Register in `1.0.0_master.yml` (same shape as the `202607181501` entry, id `"1.0.0:202607191100_mezo-bw3y_recipe_breakdown"`).

- [ ] **Step 2.2:** `MealScoringService` — add after `recipeFit`:

```java
/**
 * Full template envelope for a recipe (mezo-bw3y): the SAME three dimensions recipeFit scores
 * (weights renormalized over the present ones) + an honest degraded context dimension
 * (weight 0 — a template has no logged time/slot; evaluated on the meal side), so the detail
 * page can explain the fit number. {@code value} ≡ {@link #recipeFit} by construction.
 */
public MealBreakdownJson recipeTemplateBreakdown(List<ScoredLine> perServingLines) {
    double kcal = sum(perServingLines, ScoredLine::kcal);
    if (kcal <= 0) { return null; }
    Dim macro = macroDim(perServingLines, kcal);
    Dim micro = microDim(perServingLines, kcal);
    Dim nova = novaDim(perServingLines, kcal);
    List<Dim> live = List.of(macro, micro, nova);
    double weightSum = live.stream().mapToDouble(d -> d.effectiveWeight).sum();
    if (weightSum == 0) { return null; }
    double value = live.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
    double confidence = live.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;
    List<Dimension> dims = new ArrayList<>();
    for (Dim d : live) { dims.add(d.renormalized(weightSum).toJson()); }
    dims.add(new Dimension("context", "Időzítés & kontextus", round2(0), round2(0),
        "Sablon szinten nincs időzítési adat — a kontextust a logolt étkezéseknél értékeljük.",
        null, null, null, List.of()));
    List<ToolRow> tools = new ArrayList<>();
    tools.add(new ToolRow("read", "recipe.line_snapshots(n=" + perServingLines.size() + ")"));
    tools.add(new ToolRow("compute", "macroFit(mezo.nutrition)"));
    if (nova.coverage > 0) { tools.add(new ToolRow("compute", "novaDistribution(kcal_weighted)")); }
    tools.add(new ToolRow("compute", "templateFit(weights_renormalized)"));
    return new MealBreakdownJson(round2(value), round2(confidence), null, dims, List.of(), tools);
}
```

plus a `Dim.renormalized(double weightSum)` helper on the private record (`new Dim(id, label, effectiveWeight / weightSum, score, coverage, detail, macro, micros, nova, context)`), and `recipeFit` rewritten as the delegate above (keep the javadoc, note the delegation). NOTE: the emitted per-dim `weight` is the renormalized one so the UI's `× súly W% = X pt` sums to the total honestly.

- [ ] **Step 2.3:** `RecipeEntity` — add after `fitsFor`:

```java
/** Template breakdown cache (mezo-bw3y): 3-dim deterministic envelope + AI prose; null = not generated. */
@JdbcTypeCode(SqlTypes.JSON)
@Column(columnDefinition = "jsonb")
private MealBreakdownJson breakdown;
```

(import `io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson`).

- [ ] **Step 2.4:** Locate the `MealBreakdownJson → api.dto.MealBreakdown` mapping inside `MealMapper` (grep `breakdown` in `feature/meal/mapper/`); move it verbatim into a new `@Component BreakdownDtoMapper` under `feature/nutrition/mapper/`; `MealMapper` delegates (constructor-inject). Run `./mvnw clean compile -q -pl .` in `backend/` (or `./mvnw clean compile`) → BUILD SUCCESS.
- [ ] **Step 2.5:** Test — extend the existing scoring test class (find via `grep -rl "recipeFit" backend/src/test`) with: template envelope of a 2-line profile has 4 dimensions (context last, weight 0, score 0), live weights sum to 1.0 (±.001), `value` equals `recipeFit` output exactly, confidence in (0,1]. Run focused: `./mvnw clean test -Dtest='<TestClass>' -DargLine=-Xmx3g` → PASS.
- [ ] **Step 2.6:** Commit: `feat(nutrition): recipe template breakdown envelope + recipe.breakdown jsonb (mezo-bw3y)`.

### Task 3: Recipe backend — port, prose service, orchestrator, controller, flag, adapter, fake

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java` (expose `fitLines`+`pantryByIdFor` package-private; `update` nulls `breakdown`/`fitsFor`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (+`RECIPE_AI_SCORE_SWITCH`)
- Modify: `backend/src/main/resources/application.yml` (feature block + comment)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/RecipeBreakdownLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (+`RECIPE_FIT_SENTINEL` fallthrough)

**Interfaces produced:**
- `RecipeBreakdownLlm { String complete(String systemPrompt, String userMessage); }`
- `RecipeBreakdownProseService.enrich(RecipeEntity recipe, MealBreakdownJson deterministic): MealBreakdownJson` — returns the prose-merged envelope, or **null** on any failure/absence (companion off, parse fail, LLM throw). Bean gated `@ConditionalOnProperty(RECIPE_AI_SCORE_SWITCH)`.
- `RecipeBreakdownService.getOrGenerate(UUID userId, UUID id): RecipeBreakdownResponse`.

- [ ] **Step 3.1:** Port:

```java
package io.mrkuhne.mezo.feature.recipe.service;

/**
 * Recipe-owned LLM port (ADR 0012, mezo-bw3y): the template-breakdown prose generator's only
 * LLM dependency. The companion feature provides the adapter (cheap tier), so recipe never
 * imports {@code feature.companion}. Absent bean (companion off) == prose skipped, never an error.
 */
public interface RecipeBreakdownLlm {

    String complete(String systemPrompt, String userMessage);
}
```

- [ ] **Step 3.2:** `RecipeBreakdownProseService` (new, complete file):

```java
package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ImproveRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ToolRow;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * LLM prose layer over the deterministic template envelope (mezo-bw3y, spec D1/D6): ONE cheap-tier
 * call turns the computed numbers into Hungarian summary / per-dimension detail / improve[] /
 * fitsFor[]. The numbers are NEVER the LLM's — prose only. Any failure (companion off, LLM throw,
 * unparseable answer) returns null and the caller serves the deterministic envelope — degraded
 * honesty, never a 5xx (this differs from scrape/ai-draft, whose whole feature IS the LLM).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_AI_SCORE_SWITCH, havingValue = "true")
public class RecipeBreakdownProseService {

    private static final String SYSTEM_PROMPT = """
        You evaluate ONE saved recipe TEMPLATE against the owner's daily nutrition targets.
        You get the recipe and the DETERMINISTIC dimension scores already computed by the engine.
        Answer with ONE JSON object and nothing else, exactly these keys:
        {"summary":string,"fitsFor":[string],
         "details":{"macro":string,"micro":string,"nova":string},
         "improve":[{"text":string,"impact":string}]}
        Rules:
        - Write Hungarian, tegeződve, tömören.
        - summary: 2-3 mondat — a recept sablon-szintű olvasata (mire jó, hogyan illik a célokhoz).
        - details.*: 1-2 mondat dimenziónként; a megadott számok MAGYARÁZATA — soha ne mondj
          ellent nekik és ne találj ki új számokat.
        - fitsFor: 1-3 rövid címke, mikor/mire illik a recept (pl. "Post-workout · este").
        - improve: 0-3 konkrét javaslat; impact = rövid kvalitatív tag (pl. "+rost", "−NOVA4").
        - A kontextus (időzítés) sablon szinten nem értékelhető — arról ne írj javaslatot.
        """;

    /** LLM answer contract — permissive Strings; a malformed answer degrades, never errors. */
    record ExtractedDetails(String macro, String micro, String nova) { }

    record ExtractedImprove(String text, String impact) { }

    record ExtractedProse(String summary, List<String> fitsFor, ExtractedDetails details,
                          List<ExtractedImprove> improve) { }

    private final ObjectProvider<RecipeBreakdownLlm> llm;
    private final ObjectMapper objectMapper;

    /** Prose-merged envelope, or null when enrichment is unavailable/failed (caller degrades). */
    public MealBreakdownJson enrich(RecipeEntity recipe, MealBreakdownJson det) {
        RecipeBreakdownLlm port = llm.getIfAvailable();
        if (port == null) {
            return null; // companion off — deterministic envelope is served un-enriched
        }
        try {
            String answer = port.complete(SYSTEM_PROMPT, userMessage(recipe, det));
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            ExtractedProse prose = objectMapper.readValue(json, ExtractedProse.class);
            if (prose.summary() == null || prose.summary().isBlank()) {
                log.warn("Recipe breakdown prose: blank summary for {} — degrading", recipe.getId());
                return null;
            }
            return merge(det, prose);
        } catch (Exception e) {
            log.warn("Recipe breakdown prose failed for {} — serving deterministic envelope",
                recipe.getId(), e);
            return null;
        }
    }

    /** fitsFor[] of the last successful enrichment (merge caps at 3, drops blanks). */
    public List<String> fitsFor(ExtractedProse prose) {
        return prose.fitsFor() == null ? List.of() : prose.fitsFor().stream()
            .filter(s -> s != null && !s.isBlank()).limit(3).toList();
    }

    private String userMessage(RecipeEntity recipe, MealBreakdownJson det) {
        StringBuilder sb = new StringBuilder();
        sb.append("RECEPT: ").append(recipe.getName())
          .append(" | slot: ").append(recipe.getSlot() == null ? "-" : recipe.getSlot())
          .append(" | adag: ").append(recipe.getServings()).append('\n');
        sb.append("HOZZÁVALÓK (1 adagra vetítve pontozva):\n");
        recipe.getLines().forEach(l -> sb.append("- ").append(l.getSnapshotName())
            .append(' ').append(l.getAmount().stripTrailingZeros().toPlainString())
            .append(l.getUnit()).append('\n'));
        sb.append("DETERMINISZTIKUS BONTÁS (0-1 skála, súlyozott):\n");
        for (Dimension d : det.dimensions()) {
            sb.append("- ").append(d.id()).append(" (").append(d.label()).append("): score ")
              .append(d.score()).append(", súly ").append(d.weight())
              .append(" — ").append(d.detail()).append('\n');
        }
        sb.append("VÉGSŐ ÉRTÉK: ").append(det.value())
          .append(" | megbízhatóság: ").append(det.confidence()).append('\n');
        return sb.toString();
    }

    /** Numbers untouched; prose replaces summary + the three live details + improve; llm tool row. */
    private MealBreakdownJson merge(MealBreakdownJson det, ExtractedProse prose) {
        List<Dimension> dims = det.dimensions().stream().map(d -> {
            String text = switch (d.id()) {
                case "macro" -> prose.details() == null ? null : prose.details().macro();
                case "micro" -> prose.details() == null ? null : prose.details().micro();
                case "nova" -> prose.details() == null ? null : prose.details().nova();
                default -> null;
            };
            return text == null || text.isBlank() ? d
                : new Dimension(d.id(), d.label(), d.weight(), d.score(), text,
                    d.macro(), d.micros(), d.nova(), d.context());
        }).toList();
        List<ImproveRow> improve = prose.improve() == null ? List.of() : prose.improve().stream()
            .filter(i -> i.text() != null && !i.text().isBlank())
            .limit(3)
            .map(i -> new ImproveRow(i.text(), i.impact() == null ? "" : i.impact()))
            .toList();
        List<ToolRow> tools = new ArrayList<>(det.tools());
        tools.add(new ToolRow("compute", "llm:sablon-olvasat"));
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), dims,
            improve, tools);
    }
}
```

NOTE while implementing: `enrich` must ALSO hand back the parsed `fitsFor` — restructure to return a small `record Enriched(MealBreakdownJson envelope, List<String> fitsFor)` instead of two methods (the plan's two-method sketch loses the parsed prose); adjust `RecipeBreakdownService` accordingly.

- [ ] **Step 3.3:** `RecipeBreakdownService` (new):

```java
package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.mapper.BreakdownDtoMapper;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazy cache-or-generate template breakdown (mezo-bw3y, spec D2/D5): the deterministic envelope is
 * recomputed on every read (cheap); the persisted copy is served only while its numbers still match
 * (pantry drift ⇒ regenerate; recipe update nulls the cache in RecipeService). Only prose-enriched
 * envelopes are persisted — a prose-less pass stays unpersisted so prose self-heals when the LLM
 * is back. The LLM call runs OUTSIDE any transaction (reads and the persist are separate txns).
 */
@Service
@RequiredArgsConstructor
public class RecipeBreakdownService {

    private final RecipeRepository repository;
    private final RecipeService recipeService;
    private final MealScoringService scoringService;
    private final BreakdownDtoMapper dtoMapper;
    private final ObjectProvider<RecipeBreakdownProseService> prose;

    public RecipeBreakdownResponse getOrGenerate(UUID userId, UUID id) {
        Loaded loaded = load(userId, id);
        MealBreakdownJson fresh = loaded.fresh();
        if (fresh == null) { // no kcal — pending sparkle territory, nothing to explain
            return response(null, List.of());
        }
        if (matches(loaded.stored(), fresh)) {
            return response(loaded.stored(), loaded.fitsFor());
        }
        RecipeBreakdownProseService svc = prose.getIfAvailable();
        RecipeBreakdownProseService.Enriched enriched =
            svc == null ? null : svc.enrich(loaded.recipe(), fresh);
        if (enriched == null) {
            return response(fresh, List.of()); // deterministic, unpersisted (D5/D6)
        }
        persist(id, enriched);
        return response(enriched.envelope(), enriched.fitsFor());
    }

    /** Read tx: entity + lazy lines + the fresh deterministic envelope + current cache. */
    @Transactional(readOnly = true)
    protected Loaded load(UUID userId, UUID id) {
        RecipeEntity recipe = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        MealBreakdownJson fresh = scoringService.recipeTemplateBreakdown(
            recipeService.fitLines(recipe, recipeService.pantryByIdFor(List.of(recipe))));
        return new Loaded(recipe, fresh, recipe.getBreakdown(),
            recipe.getFitsFor() == null ? List.of() : recipe.getFitsFor());
    }

    /** Write tx AFTER the LLM call: re-read + persist envelope and fitsFor. */
    @Transactional
    protected void persist(UUID id, RecipeBreakdownProseService.Enriched enriched) {
        repository.findById(id).ifPresent(r -> {
            r.setBreakdown(enriched.envelope());
            r.setFitsFor(enriched.fitsFor());
        });
    }

    /** Cache valid iff the persisted numbers equal the freshly computed ones (value + per-dim). */
    private boolean matches(MealBreakdownJson stored, MealBreakdownJson fresh) {
        if (stored == null || stored.value() == null || fresh.value() == null
            || stored.value().compareTo(fresh.value()) != 0
            || stored.dimensions().size() != fresh.dimensions().size()) {
            return false;
        }
        for (int i = 0; i < fresh.dimensions().size(); i++) {
            var s = stored.dimensions().get(i);
            var f = fresh.dimensions().get(i);
            if (!Objects.equals(s.id(), f.id())
                || s.score().compareTo(f.score()) != 0
                || s.weight().compareTo(f.weight()) != 0) {
                return false;
            }
        }
        return true;
    }

    private RecipeBreakdownResponse response(MealBreakdownJson envelope, List<String> fitsFor) {
        RecipeBreakdownResponse res = new RecipeBreakdownResponse();
        res.setBreakdown(envelope == null ? null : dtoMapper.toDto(envelope));
        res.setFitsFor(fitsFor);
        return res;
    }

    record Loaded(RecipeEntity recipe, MealBreakdownJson fresh, MealBreakdownJson stored,
                  List<String> fitsFor) {
    }
}
```

(Adjust getter/setter names to the actual generated DTO; `@Transactional` on protected methods of the same class does NOT proxy — move `load`/`persist` into the service as self-invoked… **it does not work via self-invocation**: instead make them package-private methods on `RecipeService` OR inject `TransactionTemplate`. RESOLUTION: put `load` + `persist` as public `@Transactional` methods on a tiny `RecipeBreakdownTxSupport` @Service, or simplest — mark `getOrGenerate` itself `@Transactional` for the read part and run `persist` via the repository's own transactional `save`… FINAL CHOICE at implementation: follow `MealAiDraftService`'s precedent — single-user app, holding a connection across the LLM call is accepted there (`@Transactional(readOnly = true)` around the whole draft). So: `getOrGenerate` = `@Transactional` (read-write), lazy lines resolvable, persist via managed entity dirty-checking at commit. One method, no proxy games; document the accepted connection-hold.)

- [ ] **Step 3.4:** `RecipeService`: change `private` → package-private on `fitLines` and `pantryByIdFor` (same package usage from `RecipeBreakdownService`); in `update(...)` after `rebuildLines(...)` add:

```java
recipe.setBreakdown(null); // template breakdown cache invalidated on edit (mezo-bw3y D5)
recipe.setFitsFor(null);
```

- [ ] **Step 3.5:** `RecipeController` — add:

```java
@Override
public RecipeBreakdownResponse getRecipeBreakdown(UUID id) {
    return breakdownService.getOrGenerate(currentUserId.get(), id);
}
```

(+ inject `RecipeBreakdownService breakdownService`.)

- [ ] **Step 3.6:** `FeaturesConfiguration` — after `MEAL_AI_LOG_SWITCH`:

```java
/** Recipe AI template breakdown (mezo-bw3y): gates ONLY the LLM prose enrichment — the
 *  deterministic envelope endpoint stays on regardless. Prose additionally needs COMPANION_SWITCH
 *  (the port adapter lives there). */
public static final String RECIPE_AI_SCORE_SWITCH = "mezo.feature.recipe-ai-score.enabled";
```

`application.yml` `mezo.feature` block — append:

```yaml
    # Recipe AI template breakdown prose (mezo-bw3y) — off: GET /api/recipe/{id}/breakdown still
    # serves the deterministic envelope, only summary/improve/fitsFor stay empty.
    recipe-ai-score:
      enabled: true
```

- [ ] **Step 3.7:** Companion adapter (mirror `PantryScrapeLlmAdapter` verbatim, renamed):

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.recipe.service.RecipeBreakdownLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Companion-side adapter for the recipe-owned breakdown-prose port (ADR 0012, mezo-bw3y). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecipeBreakdownLlmAdapter implements RecipeBreakdownLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage, java.util.List.of(), java.util.Map.of());
    }
}
```

(Check `PantryScrapeLlmAdapter`'s actual delegate signature first and copy that call shape exactly.)

- [ ] **Step 3.8:** `FakeCompanionLlm` — add sentinel near `MEAL_SENTINEL`:

```java
/** Scripted recipe breakdown prose (mezo-bw3y): {@code [fake-recipe-fit:{json}]} planted in the
 *  RECIPE NAME (it appears in the prompt's user message). GREEDY — the payload nests objects. */
public static final Pattern RECIPE_FIT_SENTINEL =
        Pattern.compile("\\[fake-recipe-fit:(\\{.*})]", Pattern.DOTALL);
```

and in the fallthrough chain (after the `MEAL_SENTINEL` block):

```java
// Recipe breakdown prose (mezo-bw3y): sentinel planted in the recipe name; no sentinel ->
// prompt echo -> unparseable -> the service degrades to the deterministic envelope (as ITs assert).
Matcher recipeFit = RECIPE_FIT_SENTINEL.matcher(userMessage);
if (recipeFit.find()) {
    return recipeFit.group(1);
}
```

- [ ] **Step 3.9:** `cd backend && ./mvnw clean compile -DskipTests` → BUILD SUCCESS. Commit: `feat(recipe): AI template breakdown endpoint — port + prose + cache (mezo-bw3y)`.

### Task 4: Backend integration tests

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownApiIT.java` (`@ActiveProfiles("companion-fake")`, extends `ApiIntegrationTest` — check its helper names first: verb helpers + `ownerAuthHeaders()`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownFallbackApiIT.java` (companion OFF — mirror `MealAiLlmUnavailableApiIT`'s property setup)

Scenarios (adapt toHTTP-or-service level per `ApiIntegrationTest` affordances; recipe created via `RecipePopulator.createRecipe(owner, pantryItemId)` with the sentinel planted by updating the entity name, or create via API):

1. **Enriched happy path:** recipe named `"Lazacos rizs [fake-recipe-fit:{…}]"` where the canned JSON is `{"summary":"Fake sablon-olvasat.","fitsFor":["Post-workout · este"],"details":{"macro":"Fake makró.","micro":"Fake mikró.","nova":"Fake nova."},"improve":[{"text":"Adj hozzá zöldséget.","impact":"+rost"}]}` → GET breakdown: `summary` = canned, dims 4 (context last, weight 0), macro dim detail = "Fake makró.", improve size 1, fitsFor = canned; DB: `recipe.breakdown` non-null, `fits_for` = canned (assert via repository).
2. **Cache hit proof:** after (1), rename the recipe VIA REPOSITORY to a sentinel-less name (numbers unchanged) → 2nd GET still returns the canned summary (a fresh LLM pass would echo→degrade → prose-less; cached prose proves the hit).
3. **Numeric drift regenerates:** after (2), bump the pantry item's kcal via repository → GET returns `summary null` (echo answer unparseable → deterministic fallback) and DB cache still holds the OLD envelope (prose-less runs don't persist).
4. **Update invalidates:** PUT the recipe (same payload) → repository shows `breakdown == null && fitsFor == null`.
5. **No kcal:** recipe over a macro-less pantry item → `breakdown` null, `fitsFor` empty, 200.
6. **404:** foreign owner's recipe id → 404 SystemMessage `RESOURCE_NOT_FOUND`.
7. **Fallback IT (companion off):** flag on, no adapter bean → 200 deterministic envelope, `summary` null, nothing persisted.

- [ ] **Step 4.1:** Write both IT classes with the scenarios above (test names `test{Method}_should{Result}_when{Condition}`, AssertJ only).
- [ ] **Step 4.2:** Run focused: `cd backend && ./mvnw clean test -Dtest='RecipeBreakdown*IT' -DargLine=-Xmx3g` → all PASS (compose Postgres must be up: `docker compose up -d`).
- [ ] **Step 4.3:** Also run the touched neighbors: `./mvnw clean test -Dtest='Recipe*IT,MealAi*,MealScoring*,Meal*IT' -DargLine=-Xmx3g` → PASS.
- [ ] **Step 4.4:** Commit: `test(recipe): breakdown cache/prose/fallback ITs (mezo-bw3y)`.

### Task 5: FE data layer

**Files:**
- Modify: `frontend/src/data/fuel/mealApi.ts` (`fromBreakdown`/`fromDimension` gain `opts?: { keepDegraded?: boolean }` — degraded context kept when set)
- Modify: `frontend/src/data/fuel/recipeApi.ts` (`getBreakdown`)
- Modify: `frontend/src/data/fuel/recipeHooks.ts` (`useRecipeBreakdown` + action invalidations)
- Modify: `frontend/src/data/hooks.ts` (re-export `useRecipeBreakdown`)
- Modify: `frontend/src/test/msw/handlers.ts` (breakdown fixture + handler)
- Test: `frontend/src/data/fuel/recipeHooks.test.tsx` (extend)

**Interfaces produced:** `useRecipeBreakdown(recipeId: string): { breakdown: MealBreakdown | null; fitsFor: string[]; pending: boolean }`.

- [ ] **Step 5.1:** `mealApi.ts`: `fromDimension(d, keepDegraded?)` — context branch becomes `if (d.id === 'context' && d.context && (d.context.length > 0 || keepDegraded))`; `fromBreakdown(b, opts?)` threads it. Existing meal callsites unchanged (default drops degraded — P7 behavior preserved).
- [ ] **Step 5.2:** `recipeApi.ts`:

```ts
type RecipeBreakdownResponse = components['schemas']['RecipeBreakdownResponse']

export interface RecipeBreakdownData { breakdown: MealBreakdown | null; fitsFor: string[] }

// getBreakdown: the degraded context card is KEPT (spec D3) — the template view explains
// why the context dimension carries no weight, unlike the meal sheet which drops it.
getBreakdown: (id: string): Promise<RecipeBreakdownData> =>
  apiFetch<RecipeBreakdownResponse>(`/api/recipe/${id}/breakdown`).then(r => ({
    breakdown: r.breakdown ? fromBreakdown(r.breakdown, { keepDegraded: true }) : null,
    fitsFor: r.fitsFor,
  })),
```

(import `fromBreakdown` from `@/data/fuel/mealApi`, `MealBreakdown` type from `@/data/types`).

- [ ] **Step 5.3:** `recipeHooks.ts`:

```ts
const RECIPE_BREAKDOWN_KEY = (id: string) => ['recipeBreakdown', id] as const

/** Template breakdown for the detail page (mezo-bw3y). Mock = the seed's templateBreakdown +
 *  mezoFit.fitsFor, synchronous; real = the lazily materializing GET (first call may take LLM
 *  seconds — `pending` drives the "Mezo értékeli…" card). */
export function useRecipeBreakdown(recipeId: string): {
  breakdown: MealBreakdown | null; fitsFor: string[]; pending: boolean
} {
  const mock = isMockMode()
  const seed = (): RecipeBreakdownData => {
    const r = mockRecipes.find(x => x.id === recipeId)
    return { breakdown: r?.templateBreakdown ?? null, fitsFor: r?.mezoFit.fitsFor ?? [] }
  }
  const { data, isPending } = useQuery({
    queryKey: RECIPE_BREAKDOWN_KEY(recipeId),
    queryFn: mock ? async () => seed() : () => recipeApi.getBreakdown(recipeId),
    initialData: mock ? seed() : undefined,
    staleTime: mock ? Infinity : 5 * 60_000,
    enabled: recipeId !== '',
  })
  return {
    breakdown: data?.breakdown ?? null,
    fitsFor: data?.fitsFor ?? [],
    pending: !mock && isPending,
  }
}
```

In `useRecipeActions`' `invalidate` add `qc.invalidateQueries({ queryKey: ['recipeBreakdown'] })`. Re-export the hook from `data/hooks.ts` next to `useRecipes`.

- [ ] **Step 5.4:** MSW: fixture + handler:

```ts
const recipeBreakdownFixture = {
  breakdown: {
    value: 0.91, confidence: 0.86, summary: 'MSW sablon-olvasat.',
    dimensions: [
      { id: 'macro', label: 'Kcal & makró arány', weight: 0.375, score: 0.92,
        detail: 'MSW makró detail.', macro: { ratioP: 30, ratioC: 40, ratioF: 30,
        targetP: '~27%', targetC: '~46%', targetF: '~27%', kcalShareOfDay: 24.5, notes: null } },
      { id: 'micro', label: 'Mikro–makro balance', weight: 0.3125, score: 0.88, detail: 'MSW mikró detail.',
        micros: [{ name: 'Rost', value: '9.5 g', pct: 82, status: 'good' }] },
      { id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.3125, score: 0.94, detail: 'MSW nova detail.',
        nova: { dominant: 1, stack: [{ nova: 1, pct: 100, label: 'Zab' }], items: [{ name: 'Zab 70g', nova: 1, warning: false }] } },
      { id: 'context', label: 'Időzítés & kontextus', weight: 0, score: 0,
        detail: 'Sablon szinten nincs időzítési adat — a kontextust a logolt étkezéseknél értékeljük.', context: [] },
    ],
    improve: [{ text: 'MSW javaslat.', impact: '+rost' }],
    tools: [{ type: 'compute', name: 'templateFit(weights_renormalized)' }, { type: 'compute', name: 'llm:sablon-olvasat' }],
  },
  fitsFor: ['Post-workout · este'],
}
…
http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => HttpResponse.json(recipeBreakdownFixture)),
```

(Register BEFORE the `/api/recipe/:id` handler — path-specificity: MSW matches in order, `:id` would swallow `breakdown` otherwise. Verify the existing `/logs` handler placement — it already sits before `:id`; mirror that.)

- [ ] **Step 5.5:** Extend `recipeHooks.test.tsx`: mock mode — `useRecipeBreakdown('rec-1')` returns the seed's templateBreakdown synchronously + non-empty fitsFor; real mode — resolves the MSW fixture (`summary 'MSW sablon-olvasat.'`, 4 dimensions incl. the degraded context, `pending` flips false).
- [ ] **Step 5.6:** `cd frontend && pnpm test …recipeHooks… && VITE_USE_MOCK=true pnpm test …recipeHooks…` → PASS. Commit: `feat(fuel): FE data layer — useRecipeBreakdown dual-mode hook (mezo-bw3y)`.

### Task 6: FE UI — ScoreBreakdownBody + RecipeDetailPage sections

**Files:**
- Create: `frontend/src/features/fuel/components/ScoreBreakdownBody.tsx` (extraction)
- Modify: `frontend/src/features/fuel/sheets/MealScoreSheet.tsx` (delegate)
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` (sparkle zone → olvasat card + PONTSZÁM section)
- Test: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx` (extend)

- [ ] **Step 6.1:** `ScoreBreakdownBody` — move the MealScoreSheet blocks verbatim (dimension cards `col gap-md`, „Lehetne jobb" incl. its numbering/impact styles, „Hogyan számoltam" ToolChipRow) into:

```tsx
// ============================================================
// Mezo · ScoreBreakdownBody (shared score-breakdown sections)
// Dimension cards + „Lehetne jobb" + „Hogyan számoltam" — used by
// MealScoreSheet (meal) and RecipeDetailPage „Pontszám" (mezo-bw3y).
// ============================================================
import type { MealBreakdown } from '@/data/types'
…
export function ScoreBreakdownBody({ breakdown }: { breakdown: MealBreakdown }) { … }
```

`MealScoreSheet` keeps header + `ScoreHero` + the summary card and renders `<ScoreBreakdownBody breakdown={b} />` below its section eyebrow (the „Súlyozott bontás / N dimenzió" eyebrow row STAYS in the sheet — the page has its own different header row).

- [ ] **Step 6.2:** `RecipeDetailPage` — call `useRecipeBreakdown(id ?? '')` with the other top-level hooks (BEFORE the not-found return, hook-order comment updated); replace the whole „Mezo-fit · indoklás hamarosan" `div` with:

```tsx
{/* Mezo · sablon-olvasat + Pontszám (mezo-bw3y) — deterministic numbers + lazy AI prose */}
{pending && (
  <div className="card" style={{ margin: '16px 0', padding: '16px', textAlign: 'center' }}>
    <div className="np-twinkle" style={{ color: 'var(--coral)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
      <Icon name="sparkle" size={20} />
    </div>
    <span className="text-tertiary" style={{ fontSize: 11.5 }}>Mezo értékeli a receptet…</span>
  </div>
)}
{!pending && breakdown?.summary && (
  <div className="card" style={{ margin: '16px 0', padding: 12, background: 'color-mix(in srgb, var(--sage) 6%, transparent)' }}>
    <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
      <Icon name="sparkle" size={12} color="var(--coral)" />
      <div className="col flex-1">
        <Eyebrow brand>Mezo · sablon-olvasat</Eyebrow>
        <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>
          <SafeMarkdown text={breakdown.summary} />
        </p>
        {fitsFor.length > 0 && (
          <div className="row gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {fitsFor.map(t => (
              <span key={t} className="chip brand" style={{ fontSize: 9, padding: '3px 8px' }}>● {t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}
{!pending && breakdown && (
  <>
    <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
      <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>PONTSZÁM</span>
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
        {breakdown.dimensions.length} szempont · megbízh. {Math.round(breakdown.confidence * 100)}%
      </span>
    </div>
    <div style={{ marginBottom: 16 }}>
      <ScoreBreakdownBody breakdown={breakdown} />
    </div>
  </>
)}
{!pending && !breakdown && (
  <div className="card" style={{ margin: '16px 0', padding: 16, textAlign: 'center' }}>
    <span className="text-tertiary" style={{ fontSize: 11.5 }}>
      Sablon-pontszámhoz még nincs elég adat (kcal nélküli hozzávalók).
    </span>
  </div>
)}
```

(imports: `SafeMarkdown`, `ScoreBreakdownBody`, `useRecipeBreakdown` from `@/data/hooks`; the section-header idiom mirrors the existing HOZZÁVALÓK/LOGOK rows; header comment block updated — the sparkle-deferral note is replaced by the new reality.)

- [ ] **Step 6.3:** Extend `RecipeDetailPage.test.tsx` (mock mode): rendering `rec-1` shows `PONTSZÁM`, the seed breakdown's dimension labels (e.g. „Kcal & makró arány"), and (if the seed has a summary) the olvasat card; `MealScoreSheet.test.tsx` still green after the extraction.
- [ ] **Step 6.4:** Full FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green. Commit: `feat(fuel): RecipeDetailPage — sablon-olvasat + Pontszám section (mezo-bw3y)`.

### Task 7: Docs + land

- [ ] **Step 7.1:** `docs/features/fuel.md`: header-summary sentence (third LLM endpoint), §2 RecipeDetailPage paragraph (sparkle zone → olvasat + Pontszám), §3 (new hook), §4 (endpoint + `recipe.breakdown` column + flag), §10 key files. Run `node scripts/lint-docs.mjs` → no staleness flag for fuel.md.
- [ ] **Step 7.2:** Backend focused re-run (Task 4 command) + FE gate re-run if anything changed. Commit docs: `docs(fuel): recipe AI template breakdown (mezo-bw3y)`.
- [ ] **Step 7.3:** Land per worktree flow: `git fetch origin && git rebase origin/main` (user instruction: rebase if main moved) → `git push -u origin feat/fuel-recipe-ai-breakdown` → `gh pr create --fill` (self-PR, body ends with the standard generated-with footer) → wait CI green (`gh pr checks --watch`) → `gh pr merge --merge` (worktree landing memory) → verify main → bd close mezo-bw3y (+notes), `bd dolt push` from the main checkout.
