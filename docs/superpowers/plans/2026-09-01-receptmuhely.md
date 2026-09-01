# Receptműhely Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI-driven recipe builder ("Receptműhely") under Fuel: a canvas-first hybrid page where a stateless LLM turn endpoint iterates a recipe draft (pantry + free text + goal presets), macros are always computed deterministically, and the result saves through the existing recipe CRUD.

**Architecture:** Contract-first new endpoint `POST /api/recipe/workshop/turn` (stateless: client sends history + current draft, server returns prose reply + full updated draft; FE computes the visual diff). Backend follows the `MealAiDraftService` template: consumer-owned `RecipeWorkshopLlm` port (ADR 0012, adapter in companion), strict-JSON parse → deterministic `RecipeWorkshopValidator` (hallucinated pantry ids demoted to estimate lines). FE: dual-mode `workshopHooks` + pure `workshopState` logic module + `RecipeWorkshopPage` matching the approved prototype (`docs/design_2.0/prototypes/receptmuhely.html`).

**Tech Stack:** Spring Boot 4 (contract-generated `RecipeWorkshopApi`), openapi-merge-cli + openapi-typescript, React + TanStack Query, vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-receptmuhely-design.md` · **bd:** mezo-92pb (claimed) · **Branch:** `claude/receptmuehely-ai-builder-dce581` (this worktree — do NOT cd to the primary repo).

## Global Constraints

- Contract-first: edit `api/feature/recipe/recipe.yml` BEFORE any code; regenerate `api/openapi.yml` (`cd api/generate && npm run generate:api`) and `frontend/src/data/_client/api.gen.ts` (`cd frontend && pnpm generate:api`); commit both.
- ArchUnit direction: recipe must NEVER import `feature.companion`; the adapter lives in `feature/companion/llm/` (companion→recipe only).
- Macros are computed, never asked of the LLM: pantry lines resolve facts from the DB/pantry cache; only estimate lines carry LLM numbers, visibly BECSLÉS-tagged.
- Honest-null + never-punitive colors (no red); Hungarian UI copy.
- `VITE_USE_MOCK` unset = mock: FE tests must pass in BOTH modes (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`).
- Backend locally: run FOCUSED tests only (`./mvnw test -Dtest='RecipeWorkshop*'`); CI (self-PR) is the authoritative full-suite gate. Full local suite would need `-Dmezo.test.use-testcontainers=true` — don't run it here.
- `RecipeInput` is a full replace: the workshop's save path must carry EVERY RecipeInput field (slot, tags, starred, prepMins, cookMins) through, or saving wipes them (mezo-uavr lesson).
- Conventional commits with the driving id, e.g. `feat(api): workshop turn contract (mezo-92pb)`.
- Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change that adds new files; `node scripts/lint-docs.mjs` must pass after the docs task.

---

### Task 1: Contract — workshop turn endpoint

**Files:**
- Modify: `api/feature/recipe/recipe.yml` (add path + schemas at the end)
- Verify only (no edit needed): `api/generate/merge.yml` already lists `../feature/recipe/recipe.yml`
- Generated (commit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `RecipeWorkshopApi` interface (tag `RecipeWorkshop`, operationId `workshopTurn`), DTOs `WorkshopTurnRequest`, `WorkshopTurnResponse`, `WorkshopDraft`, `WorkshopDraftLine`, `WorkshopChatMessage` — used by Tasks 4–6 (backend) and Task 8 (FE types).

- [ ] **Step 1: Add the path to `api/feature/recipe/recipe.yml`** (after the `/api/recipe/{id}/breakdown` block, still under `paths:`):

```yaml
  /api/recipe/workshop/turn:
    post:
      tags: [RecipeWorkshop]
      operationId: workshopTurn
      summary: One stateless Receptműhely AI turn — history + current draft in, prose reply + full updated draft out (mezo-92pb); nothing persisted
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/WorkshopTurnRequest' } } }
      responses:
        '200': { description: Updated draft, content: { application/json: { schema: { $ref: '#/components/schemas/WorkshopTurnResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '502': { description: LLM answer unparseable, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '503': { description: LLM port unavailable (companion off), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Add the schemas** (under `components.schemas`, after `RecipeListResponse`):

```yaml
    WorkshopChatMessage:
      type: object
      required: [role, text]
      properties:
        role: { type: string, pattern: '^(user|assistant)$' }
        text: { type: string, minLength: 1, maxLength: 4000 }
    WorkshopDraftLine:
      type: object
      required: [source, name, amount, unit]
      properties:
        source: { type: string, pattern: '^(pantry|estimate)$' }
        pantryItemId: { type: string, format: uuid, nullable: true }
        name: { type: string, minLength: 1 }
        amount: { type: number, exclusiveMinimum: 0 }
        unit: { type: string, minLength: 1 }
        # Estimate lines only — LLM totals for the STATED amount (never per-100). Pantry lines
        # carry null here; their macros are computed from the pantry row, never the LLM.
        kcal: { type: number, nullable: true }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
    WorkshopDraft:
      type: object
      required: [name, category, servings, steps, lines]
      properties:
        name: { type: string, minLength: 1 }
        category: { type: string, pattern: '^(breakfast|lunch|dinner|snack)$' }
        servings: { type: integer, minimum: 1, maximum: 12 }
        steps: { type: array, items: { type: string }, maxItems: 20 }
        lines: { type: array, items: { $ref: '#/components/schemas/WorkshopDraftLine' }, maxItems: 30 }
    WorkshopTurnRequest:
      type: object
      required: [message]
      properties:
        message: { type: string, minLength: 1, maxLength: 2000 }
        goal: { type: string, nullable: true, pattern: '^(high_protein|pre_workout|post_workout|before_bed|breakfast)$' }
        history: { type: array, items: { $ref: '#/components/schemas/WorkshopChatMessage' }, maxItems: 20, default: [] }
        draft:
          nullable: true
          allOf: [ { $ref: '#/components/schemas/WorkshopDraft' } ]
    WorkshopTurnResponse:
      type: object
      required: [reply, draft]
      properties:
        reply: { type: string }
        draft: { $ref: '#/components/schemas/WorkshopDraft' }
```

- [ ] **Step 3: Regenerate + verify**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both contain `WorkshopTurnRequest`. Then `cd ../backend && ./mvnw generate-sources -q` compiles the `RecipeWorkshopApi` interface without error.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): Receptműhely workshop turn contract (mezo-92pb)"
```

---

### Task 2: Backend switch + properties

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/config/RecipeWorkshopProperties.java`
- Modify: `backend/src/main/resources/application.yml`

**Interfaces:**
- Produces: `FeaturesConfiguration.RECIPE_WORKSHOP_SWITCH` (= `"mezo.feature.recipe-workshop.enabled"`), `RecipeWorkshopProperties(int maxLines, int maxSteps, int maxHistoryTurns)` — consumed by Tasks 4–5.

- [ ] **Step 1: Add the switch constant** to `FeaturesConfiguration` (next to `RECIPE_AI_SCORE_SWITCH`):

```java
    /** Receptműhely AI turn endpoint (mezo-92pb) — off: POST /api/recipe/workshop/turn is gone
     *  (controller bean absent); LLM availability additionally needs COMPANION_SWITCH
     *  (the RecipeWorkshopLlm adapter lives there). */
    public static final String RECIPE_WORKSHOP_SWITCH = "mezo.feature.recipe-workshop.enabled";
```

- [ ] **Step 2: Create `RecipeWorkshopProperties`** (mirror of `MealAiLogProperties`; registration happens via the existing `@ConfigurationPropertiesScan` — check `MezoApplication`/config the way `MealAiLogProperties` is picked up and do the same if an explicit `@EnableConfigurationProperties` list exists):

```java
package io.mrkuhne.mezo.feature.recipe.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Tunables of the Receptműhely turn endpoint (mezo-92pb). Values live in application.yml. */
@Validated
@ConfigurationProperties(prefix = "mezo.recipe-workshop")
public record RecipeWorkshopProperties(
        @Min(1) @Max(30) int maxLines,
        @Min(1) @Max(20) int maxSteps,
        @Min(1) @Max(20) int maxHistoryTurns) {
}
```

- [ ] **Step 3: application.yml** — add under the existing `mezo:` tree: a `recipe-workshop:` properties block next to `meal-ai-log:` (`max-lines: 30`, `max-steps: 20`, `max-history-turns: 20`) and the feature switch next to `recipe-ai-score:`:

```yaml
    # Receptműhely AI turn (mezo-92pb) — off: the workshop endpoint is gone; the rest of the
    # recipe surface (CRUD + breakdown) is unaffected. LLM needs the companion switch too.
    recipe-workshop:
      enabled: true
```

- [ ] **Step 4: Compile + commit**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/java/io/mrkuhne/mezo/feature/recipe/config/RecipeWorkshopProperties.java backend/src/main/resources/application.yml
git commit -m "feat(recipe): Receptműhely switch + properties (mezo-92pb)"
```

---

### Task 3: LLM port + companion adapter + fake sentinel

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/RecipeWorkshopLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`

**Interfaces:**
- Produces: `RecipeWorkshopLlm.complete(String systemPrompt, String userMessage)` (port, Task 4 consumes via `ObjectProvider`); FakeCompanionLlm sentinel `[fake-workshop:{json}]` (Task 6 ITs consume).

- [ ] **Step 1: Port interface** (mirror `RecipeBreakdownLlm`):

```java
package io.mrkuhne.mezo.feature.recipe.service;

/**
 * Recipe-owned LLM port for the Receptműhely turn (ADR 0012, mezo-92pb). The companion feature
 * provides the adapter; recipe never imports {@code feature.companion}. An absent bean
 * (companion off) degrades the endpoint to a clean 503 via ObjectProvider.
 */
public interface RecipeWorkshopLlm {

    String complete(String systemPrompt, String userMessage);
}
```

- [ ] **Step 2: Companion adapter** (mirror `MealDraftLlmAdapter`):

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the recipe-owned {@link RecipeWorkshopLlm} port (ADR 0012).
 * Companion off -> no bean -> the workshop endpoint degrades to a clean 503.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecipeWorkshopLlmAdapter implements RecipeWorkshopLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
```

- [ ] **Step 3: Fake sentinel** — in `FakeCompanionLlm`, add next to `MEAL_SENTINEL` (~line 193):

```java
    /** Scripted workshop turn (mezo-92pb): {@code [fake-workshop:{json}]} payload returned verbatim. */
    private static final Pattern WORKSHOP_SENTINEL =
            Pattern.compile("\\[fake-workshop:(\\{.*})]", Pattern.DOTALL);
```

and in the two-arg `complete(...)` sentinel chain (next to the `MEAL_SENTINEL` branch, BEFORE the prompt-echo fallback):

```java
        // Receptműhely turn (mezo-92pb): sentinel planted in the user message is returned verbatim;
        // no sentinel -> prompt echo -> unparseable -> 502, as the ITs assert.
        Matcher workshop = WORKSHOP_SENTINEL.matcher(userMessage);
        if (workshop.find()) {
            return workshop.group(1);
        }
```

- [ ] **Step 4: Compile + commit**

Run: `cd backend && ./mvnw compile -q && ./mvnw test-compile -q`
Expected: BUILD SUCCESS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopLlm.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/RecipeWorkshopLlmAdapter.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java
git commit -m "feat(recipe): RecipeWorkshopLlm port + companion adapter + fake sentinel (mezo-92pb)"
```

---

### Task 4: Validator (TDD) — deterministic draft sanitation

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopValidator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeWorkshopValidatorTest.java` (plain unit test, no Spring)

**Interfaces:**
- Consumes: generated DTOs `WorkshopDraft`, `WorkshopDraftLine` (Task 1), `RecipeWorkshopProperties` (Task 2), `PantryItemRepository.findByIdAndCreatedByAndDeletedFalse(UUID, UUID)` (existing).
- Produces: `WorkshopDraft sanitize(UUID userId, RawDraft raw)` where `RawDraft` is the service's parse record (Task 5 defines it; the validator takes the PARSED record types defined here). To keep the validator Spring-free and unit-testable, pantry resolution is injected as a function: `sanitize(RawDraft raw, Function<UUID, Optional<PantryItemEntity>> pantryLookup)`.

- [ ] **Step 1: Write the failing test.** The parse records live in the validator file (service imports them). Test the rules: hallucinated/malformed pantry id → demoted to estimate (kept only when it carries kcal + name); pantry line name/unit overwritten from the DB row; amounts clamped positive; category fallback `dinner`; servings clamped 1..12; lines capped at `maxLines`; steps capped at `maxSteps`; macro-less estimate dropped.

```java
package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawLine;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecipeWorkshopValidatorTest {

    private final RecipeWorkshopValidator validator =
            new RecipeWorkshopValidator(new RecipeWorkshopProperties(30, 20, 20));

    private static PantryItemEntity pantry(UUID id, String name) {
        PantryItemEntity p = new PantryItemEntity();
        p.setId(id);
        p.setName(name);
        p.setServingUnit("g");
        return p;
    }

    @Test
    void testSanitize_shouldResolvePantryLine_andOverwriteNameFromDb() {
        UUID id = UUID.randomUUID();
        RawDraft raw = new RawDraft("Csirketál", "dinner", 2, List.of("Süsd meg."),
                List.of(new RawLine(id.toString(), "csirke (LLM név)", BigDecimal.valueOf(300), "g",
                        null, null, null, null)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.of(pantry(id, "Csirkemell")));

        assertThat(out.getLines()).hasSize(1);
        assertThat(out.getLines().getFirst().getSource()).isEqualTo("pantry");
        assertThat(out.getLines().getFirst().getName()).isEqualTo("Csirkemell"); // DB, not LLM
        assertThat(out.getLines().getFirst().getKcal()).isNull();               // macros never from LLM
    }

    @Test
    void testSanitize_shouldDemoteHallucinatedId_toEstimate() {
        RawDraft raw = new RawDraft("X", "dinner", 2, List.of(),
                List.of(new RawLine(UUID.randomUUID().toString(), "Édesburgonya",
                        BigDecimal.valueOf(200), "g", BigDecimal.valueOf(172),
                        BigDecimal.valueOf(3), BigDecimal.valueOf(40), BigDecimal.ZERO)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.empty());

        assertThat(out.getLines().getFirst().getSource()).isEqualTo("estimate");
        assertThat(out.getLines().getFirst().getPantryItemId()).isNull();
        assertThat(out.getLines().getFirst().getKcal()).isEqualByComparingTo("172");
    }

    @Test
    void testSanitize_shouldDropMacrolessEstimate_andClampMeta() {
        RawDraft raw = new RawDraft(null, "brunch", 0, List.of(),
                List.of(new RawLine(null, "Valami", BigDecimal.ONE, "g", null, null, null, null),
                        new RawLine("not-a-uuid", "Rizs", BigDecimal.valueOf(-5), "g",
                                BigDecimal.valueOf(130), BigDecimal.valueOf(3),
                                BigDecimal.valueOf(28), BigDecimal.ZERO)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.empty());

        assertThat(out.getName()).isEqualTo("Új recept");   // blank-name fallback
        assertThat(out.getCategory()).isEqualTo("dinner");  // invalid category fallback
        assertThat(out.getServings()).isEqualTo(1);         // clamped
        assertThat(out.getLines()).hasSize(1);              // macro-less line dropped
        assertThat(out.getLines().getFirst().getAmount()).isEqualByComparingTo("1"); // non-positive amount -> 1
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -q -Dtest=RecipeWorkshopValidatorTest`
Expected: COMPILATION ERROR (`RecipeWorkshopValidator` does not exist).

- [ ] **Step 3: Implement the validator**

```java
package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.api.dto.WorkshopDraftLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Deterministic sanitation of the LLM's workshop draft (mezo-92pb, mirror of the
 * MealAiDraftService mapping rules): the LLM proposes, this component decides. Pantry ids are
 * resolved through the injected lookup (owner-scoped repo call in production, lambda in unit
 * tests); a hallucinated/malformed id demotes the line to estimate — never a 500, never silent
 * corruption. Pantry lines get their NAME from the DB row and carry NO macros (the FE computes
 * them from pantry facts); estimate lines keep the LLM's totals for the stated amount.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RecipeWorkshopValidator {

    private static final Set<String> CATEGORIES = Set.of("breakfast", "lunch", "dinner", "snack");

    private final RecipeWorkshopProperties props;

    /** LLM answer contract — ids as String so a malformed uuid demotes the line, not the call. */
    public record RawLine(String pantryItemId, String name, BigDecimal amount, String unit,
            BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
    }

    public record RawDraft(String name, String category, Integer servings, List<String> steps,
            List<RawLine> lines) {
    }

    public WorkshopDraft sanitize(RawDraft raw, Function<UUID, Optional<PantryItemEntity>> pantryLookup) {
        WorkshopDraft out = new WorkshopDraft();
        out.setName(raw.name() == null || raw.name().isBlank() ? "Új recept" : raw.name().strip());
        out.setCategory(raw.category() != null && CATEGORIES.contains(raw.category()) ? raw.category() : "dinner");
        int servings = raw.servings() == null ? 1 : raw.servings();
        out.setServings(Math.max(1, Math.min(12, servings)));
        List<String> steps = raw.steps() == null ? List.of() : raw.steps();
        out.setSteps(steps.stream().filter(s -> s != null && !s.isBlank()).limit(props.maxSteps()).toList());

        List<WorkshopDraftLine> lines = new ArrayList<>();
        for (RawLine line : raw.lines() == null ? List.<RawLine>of() : raw.lines()) {
            if (lines.size() >= props.maxLines()) {
                log.warn("Workshop draft truncated at {} lines", props.maxLines());
                break;
            }
            WorkshopDraftLine mapped = mapLine(line, pantryLookup);
            if (mapped != null) {
                lines.add(mapped);
            }
        }
        out.setLines(lines);
        return out;
    }

    private WorkshopDraftLine mapLine(RawLine line, Function<UUID, Optional<PantryItemEntity>> pantryLookup) {
        UUID pantryId = parseUuid(line.pantryItemId());
        if (pantryId != null) {
            PantryItemEntity p = pantryLookup.apply(pantryId).orElse(null);
            if (p != null) {
                WorkshopDraftLine out = base(line);
                out.setSource("pantry");
                out.setPantryItemId(p.getId());
                out.setName(p.getName());                       // DB name, never the LLM's
                out.setUnit(p.getServingUnit() == null ? "g" : p.getServingUnit());
                return out;                                     // macros stay null: FE computes
            }
            log.warn("Workshop draft: hallucinated pantry id {} demoted to estimate", pantryId);
        }
        if (line.kcal() == null || line.name() == null || line.name().isBlank()) {
            log.warn("Workshop draft: dropping macro-less estimate line '{}'", line.name());
            return null;
        }
        WorkshopDraftLine out = base(line);
        out.setSource("estimate");
        out.setName(line.name().strip());
        out.setKcal(line.kcal());
        out.setProteinG(zeroSafe(line.proteinG()));
        out.setCarbsG(zeroSafe(line.carbsG()));
        out.setFatG(zeroSafe(line.fatG()));
        return out;
    }

    private static WorkshopDraftLine base(RawLine line) {
        WorkshopDraftLine out = new WorkshopDraftLine();
        out.setAmount(line.amount() == null || line.amount().signum() <= 0 ? BigDecimal.ONE : line.amount());
        out.setUnit(line.unit() == null || line.unit().isBlank() ? "g" : line.unit());
        out.setName(line.name() == null ? "" : line.name());
        return out;
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static BigDecimal zeroSafe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw test -q -Dtest=RecipeWorkshopValidatorTest`
Expected: 3 tests PASS. (If DTO getters differ — e.g. `getFirst()` vs list indexing, BigDecimal vs Double in generated DTOs — adapt the TEST to the generated types, keeping the assertions' meaning. The generated DTOs use the types from Task 1's contract: `amount`/macros are `BigDecimal`, `servings` is `Integer`.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopValidator.java backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeWorkshopValidatorTest.java
git commit -m "feat(recipe): workshop draft validator — demotion + clamps (mezo-92pb)"
```

---

### Task 5: Service + controller

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeWorkshopController.java`

**Interfaces:**
- Consumes: `RecipeWorkshopLlm` (Task 3, via `ObjectProvider`), `RecipeWorkshopValidator` + its `RawDraft` (Task 4), `RecipeWorkshopProperties` (Task 2), generated `RecipeWorkshopApi` + DTOs (Task 1), existing `PantryItemRepository`, `LlmCallContextHolder`, `CurrentUserId`, `SystemMessage`/`SystemRuntimeErrorException`.
- Produces: `RecipeWorkshopService.turn(UUID userId, WorkshopTurnRequest req): WorkshopTurnResponse`; error codes `RECIPE_WORKSHOP_LLM_UNAVAILABLE` (503), `RECIPE_WORKSHOP_EXTRACT_FAILED` (502) — Task 6 ITs assert these.

- [ ] **Step 1: Service** (template: `MealAiDraftService`; same `@ConditionalOnProperty` + `ObjectProvider` + parse pattern):

```java
package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.WorkshopChatMessage;
import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.api.dto.WorkshopTurnResponse;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Stateless Receptműhely AI turn (mezo-92pb): the client sends the chat history + current draft,
 * ONE cheap-tier LLM call answers with prose + a FULL updated draft (the manual edits arrive in
 * the input draft, so returning full state preserves them — the FE renders the diff). The draft
 * is sanitized deterministically ({@link RecipeWorkshopValidator}); nothing is persisted here —
 * saving goes through the existing recipe CRUD.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_WORKSHOP_SWITCH, havingValue = "true")
public class RecipeWorkshopService {

    private static final Map<String, String> GOAL_DIRECTIVES = Map.of(
            "high_protein", "Cél: HIGH PROTEIN — maximalizáld az adagonkénti fehérjét, a kcal maradjon hasonló.",
            "pre_workout", "Cél: PRE-WORKOUT — gyors szénhidrát hangsúly, alacsony zsír, könnyen emészthető.",
            "post_workout", "Cél: POST-WORKOUT — fehérje + gyors szénhidrát a regenerációhoz.",
            "before_bed", "Cél: LEFEKVÉS ELŐTT — lassú fehérje (kazein), alacsony szénhidrát, könnyű étel.",
            "breakfast", "Cél: REGGELI — könnyű indítás, magas fehérje, reggelihez illő alapanyagok.");

    private final ObjectProvider<RecipeWorkshopLlm> llm;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeWorkshopProperties props;
    private final RecipeWorkshopValidator validator;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    record LlmAnswer(String reply, RawDraft draft) {
    }

    public RecipeWorkshopLlm requireAvailable() {
        RecipeWorkshopLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RECIPE_WORKSHOP_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    @Transactional(readOnly = true)
    public WorkshopTurnResponse turn(UUID userId, WorkshopTurnRequest req) {
        RecipeWorkshopLlm port = requireAvailable();

        String systemPrompt = buildSystemPrompt(userId, req.getGoal());
        String userMessage = buildUserMessage(req);

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("recipe_workshop", "turn", null, null),
                () -> port.complete(systemPrompt, userMessage));

        LlmAnswer parsed = parse(answer);
        WorkshopDraft draft = validator.sanitize(parsed.draft(),
                id -> pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId));

        WorkshopTurnResponse res = new WorkshopTurnResponse();
        res.setReply(parsed.reply() == null || parsed.reply().isBlank()
                ? "Frissítettem a vázlatot." : parsed.reply());
        res.setDraft(draft);
        return res;
    }

    private String buildSystemPrompt(UUID userId, String goal) {
        StringBuilder sb = new StringBuilder("""
            Te a Receptműhely vagy: magyar nyelvű, iteratív recept-tervező társ.
            Válaszolj EGYETLEN JSON objektummal, pontosan ezekkel a kulcsokkal:
            {"reply":string,"draft":{"name":string,"category":"breakfast"|"lunch"|"dinner"|"snack",
             "servings":number,"steps":[string],
             "lines":[{"pantryItemId":string|null,"name":string,"amount":number,"unit":string,
                       "kcal":number|null,"proteinG":number|null,"carbsG":number|null,"fatG":number|null}]}}
            Szabályok:
            - MINDIG a TELJES frissített vázlatot add vissza. A felhasználó által kézzel állított
              sorokhoz és értékekhez NE nyúlj, csak ha kifejezetten kéri.
            - Ha egy hozzávaló egyértelműen megvan a lenti KAMRA katalógusban, másold be az id-ját
              a pantryItemId-be és hagyd null-on a makrókat (a rendszer számolja). SOHA ne találj ki id-t.
            - Kamrán kívüli hozzávalónál pantryItemId=null és add meg a becsült kcal/proteinG/carbsG/fatG
              értékeket a MEGADOTT mennyiségre.
            - amount grammban (g), ahol értelmes; a mennyiségek az EGÉSZ receptre vonatkoznak.
            - reply: rövid magyar indoklás, mit és miért változtattál (makró-hatással).
            """);
        if (goal != null && GOAL_DIRECTIVES.containsKey(goal)) {
            sb.append('\n').append(GOAL_DIRECTIVES.get(goal)).append('\n');
        }
        sb.append("\nKAMRA KATALÓGUS (id | név | márka | alap):\n");
        for (PantryItemEntity p : pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            sb.append(p.getId()).append(" | ").append(p.getName()).append(" | ")
              .append(p.getBrand() == null ? "-" : p.getBrand()).append(" | ")
              .append(p.getServingAmount() == null ? "100" : p.getServingAmount())
              .append(' ').append(p.getServingUnit() == null ? "g" : p.getServingUnit()).append('\n');
        }
        return sb.toString();
    }

    private String buildUserMessage(WorkshopTurnRequest req) {
        StringBuilder sb = new StringBuilder();
        List<WorkshopChatMessage> history = req.getHistory() == null ? List.of() : req.getHistory();
        int from = Math.max(0, history.size() - props.maxHistoryTurns());
        if (from < history.size()) {
            sb.append("KORÁBBI BESZÉLGETÉS:\n");
            for (WorkshopChatMessage m : history.subList(from, history.size())) {
                sb.append("user".equals(m.getRole()) ? "Daniel: " : "Műhely: ").append(m.getText()).append('\n');
            }
        }
        if (req.getDraft() != null) {
            sb.append("\nAKTUÁLIS VÁZLAT (JSON):\n").append(toJson(req.getDraft())).append('\n');
        }
        sb.append("\nMOSTANI ÜZENET:\n").append(req.getMessage());
        return sb.toString();
    }

    private String toJson(WorkshopDraft draft) {
        try {
            return objectMapper.writeValueAsString(draft);
        } catch (Exception e) {
            throw new IllegalStateException("draft serialization failed", e);
        }
    }

    private LlmAnswer parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, LlmAnswer.class);
        } catch (Exception e) {
            log.warn("Workshop turn unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RECIPE_WORKSHOP_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }
}
```

- [ ] **Step 2: Controller** (contract conventions: implement the generated interface, no mapping annotations, inject `CurrentUserId` — copy the import style from `MealAiDraftController` / `RecipeController`):

```java
package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeWorkshopApi;
import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.api.dto.WorkshopTurnResponse;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Receptműhely turn endpoint (mezo-92pb). Switch off ⇒ this bean is gone (route 404/405s). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_WORKSHOP_SWITCH, havingValue = "true")
public class RecipeWorkshopController implements RecipeWorkshopApi {

    private final RecipeWorkshopService service;
    private final CurrentUserId currentUserId;

    @Override
    public WorkshopTurnResponse workshopTurn(WorkshopTurnRequest workshopTurnRequest) {
        return service.turn(currentUserId.get(), workshopTurnRequest);
    }
}
```

(Verify the actual `CurrentUserId` package with `grep -rn "class CurrentUserId" backend/src/main/java` and match existing controllers' imports; the generated method name/signature comes from Task 1's operationId.)

- [ ] **Step 3: Compile + commit**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopService.java backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeWorkshopController.java
git commit -m "feat(recipe): Receptműhely turn service + controller (mezo-92pb)"
```

---

### Task 6: Backend ITs — happy path, demotion, gating

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeWorkshopApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeWorkshopSwitchOffApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeWorkshopLlmUnavailableApiIT.java`

**Interfaces:**
- Consumes: `ApiIntegrationTest` base (helpers: `postForBody`, `ownerAuthHeaders()`, `assertHasRequestError`; check the base class for the exact JSON-post helper — `MealCoachApiIT`/`RecipeApiIT` show the JSON-body idiom), `[fake-workshop:...]` sentinel (Task 3), a pantry item seeded the way `RecipeApiIT` seeds one (reuse its fixture/populator approach — read `RecipeApiIT` first and copy its seeding).

- [ ] **Step 1: Write `RecipeWorkshopApiIT`** (`@ActiveProfiles("companion-fake")`). Tests:
  1. `testTurn_shouldReturnDraft_whenSentinelCarriesFullDraft` — POST with `message` containing `[fake-workshop:{"reply":"Kész.","draft":{"name":"Csirketál","category":"dinner","servings":2,"steps":["Süsd meg."],"lines":[{"pantryItemId":"<SEEDED_ID>","name":"x","amount":300,"unit":"g","kcal":null,"proteinG":null,"carbsG":null,"fatG":null}]}}]` where `<SEEDED_ID>` is a pantry item created in the test → 200; body `reply == "Kész."`, one line with `source == "pantry"`, `name` = the DB name, `kcal == null`.
  2. `testTurn_shouldDemoteHallucinatedPantryId` — sentinel line with a random uuid + estimate macros → line comes back `source == "estimate"`, `pantryItemId == null`.
  3. `testTurn_should400_whenMessageBlank` — `{"message":""}` → 400 (bean validation from the contract's `minLength: 1`).
  4. `testTurn_should502_whenAnswerUnparseable` — message WITHOUT sentinel (fake echoes the prompt; the echoed prompt contains `{`...`}` fragments that fail Jackson) → 502 `RECIPE_WORKSHOP_EXTRACT_FAILED`. (If the prompt echo happens to parse, plant `[fake-workshop:{broken]`-style content is NOT possible — the regex requires braces; instead assert on a message crafted as `x [fake-workshop:{"reply":}]` which matches the regex but is invalid JSON.)
- [ ] **Step 2: Write `RecipeWorkshopSwitchOffApiIT`** — mirror `MealAiDraftSwitchOffApiIT`: `@TestPropertySource(properties = "mezo.feature.recipe-workshop.enabled=false")`, POST `/api/recipe/workshop/turn` `{"message":"x"}` → the controller bean is gone. Path `/api/recipe/workshop/turn` does NOT collide with `/api/recipe/{id}` (different segment count), so expect **404 NOT_FOUND** (`assertHasRequestError(body, "NOT_FOUND")` — check the exact code the GlobalExceptionHandler emits for no-handler, e.g. what `PantryScrape` switch-off IT asserts, and mirror that).
- [ ] **Step 3: Write `RecipeWorkshopLlmUnavailableApiIT`** — mirror `MealAiLlmUnavailableApiIT`: `@TestPropertySource(properties = "mezo.feature.companion.enabled=false")`, POST → 503 `RECIPE_WORKSHOP_LLM_UNAVAILABLE`.
- [ ] **Step 4: Run focused**

Run: `cd backend && ./mvnw test -q -Dtest='RecipeWorkshop*'`
Expected: all green (validator unit test + 3 IT classes). Note: focused ITs skip ArchUnit — CI covers it; the adapter direction (companion→recipe) is correct by construction.

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/recipe/
git commit -m "test(recipe): Receptműhely turn ITs — happy, demotion, gating (mezo-92pb)"
```

---

### Task 7: FE data layer — types, api module, workshopState (TDD)

**Files:**
- Modify: `frontend/src/data/types.ts` (add workshop domain types near the Recipe types)
- Create: `frontend/src/data/fuel/workshopApi.ts`
- Create: `frontend/src/data/fuel/workshopState.ts`
- Test: `frontend/src/data/fuel/workshopState.test.ts`

**Interfaces:**
- Consumes: `components['schemas']['WorkshopTurnRequest'|'WorkshopTurnResponse'|'WorkshopDraft'|'WorkshopDraftLine']` from `api.gen.ts` (Task 1); `lineContribution`, `rescaleFrozen`, `roundMacro` from `@/data/fuel/recipeMacros`; `PickableIngredient` from `@/data/fuel/pantryPickables`; `Recipe`, `RecipeInput` from `@/data/types`.
- Produces (Tasks 8–9 rely on these exact names):
  - types: `WorkshopGoal = 'high_protein'|'pre_workout'|'post_workout'|'before_bed'|'breakfast'`; `WorkshopLine { source:'pantry'|'estimate'; refId: string|null; name: string; amount: number; unit: string; est?: {kcal:number; p:number; c:number; f:number} }` (est = totals for the line's CURRENT amount); `WorkshopDraft { name: string; category: RecipeCategory; servings: number; steps: string[]; lines: WorkshopLine[] }`; `WorkshopTurn { reply: string; draft: WorkshopDraft }`
  - `workshopApi.turn(req: { message: string; goal: WorkshopGoal|null; history: {role:'user'|'assistant'; text:string}[]; draft: WorkshopDraft|null }): Promise<WorkshopTurn>` (wire mapping both directions)
  - `workshopState.ts` pure functions:
    - `lineMacros(line: WorkshopLine, pool: PickableIngredient[]): {kcal:number;p:number;c:number;f:number}|null` — pantry: `lineContribution(amount, ing.per, ing.macros)`; unresolvable pantry ref: `null` (honest dash); estimate: its `est` totals.
    - `draftTotals(draft, pool): {kcal:number;p:number;c:number;f:number}` — Σ of non-null lineMacros.
    - `scaleServings(draft, next: number): WorkshopDraft` — proportionally rescales every line amount (g rounded to 5) AND estimate `est` totals; clamps 1..12.
    - `diffLineKeys(prev: WorkshopDraft|null, next: WorkshopDraft): string[]` — keys (`refId ?? 'est:'+name`) of added/changed lines, for the gold flash.
    - `recipeToDraft(r: Recipe): WorkshopDraft` and `draftToInput(draft, base: {slot?:string|null; tags:string[]; starred:boolean; prepMins?:number|null; cookMins?:number|null}, role: RecipeRole): RecipeInput|null` — returns `null` while ANY line is `estimate` (save gate); pantry lines map `refId → pantryItemId`.
    - `goalRole(goal: WorkshopGoal|null): RecipeRole` — `pre_workout`/`post_workout` map through, everything else `'standard'`.

- [ ] **Step 1: Write the failing tests** (`workshopState.test.ts`, vitest; mirror `recipeMacros.test.ts` style). Cover: pantry line macro via lineContribution; unresolved pantry ref → null; estimate line returns est; totals skip nulls; scaleServings 2→4 doubles amounts (5g rounding) and est totals, per-serving invariant (totals(scaled)/4 ≈ totals(orig)/2 within rounding); diffLineKeys flags added + amount-changed lines only; draftToInput null with estimate line, maps refId→pantryItemId and carries base fields verbatim; goalRole mapping.
- [ ] **Step 2: Run** `cd frontend && pnpm vitest run src/data/fuel/workshopState.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement `workshopState.ts` + types + `workshopApi.ts`.** `workshopApi.turn` POSTs `/api/recipe/workshop/turn` via `apiFetch`, request built `satisfies WorkshopTurnRequest` (domain→wire: pantry line ⇒ `{source:'pantry', pantryItemId: refId, name, amount, unit, kcal:null,...}`; estimate ⇒ macros from `est`); response wire→domain reverses it (wire `kcal` etc → `est`).
- [ ] **Step 4: Run** the same vitest command — expect PASS. Also `pnpm tsc --noEmit` (or the repo's typecheck script — check `package.json` scripts; use the existing one) green.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/fuel/workshopApi.ts frontend/src/data/fuel/workshopState.ts frontend/src/data/fuel/workshopState.test.ts
git commit -m "feat(fuel): workshop data layer — types, api, pure state logic (mezo-92pb)"
```

---

### Task 8: FE hooks — dual-mode turn + mock rounds

**Files:**
- Create: `frontend/src/data/fuel/workshopMock.ts`
- Create: `frontend/src/data/fuel/workshopHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel export — follow how `useRecipeActions` is exported)
- Test: `frontend/src/data/fuel/workshopHooks.test.tsx`

**Interfaces:**
- Consumes: Task 7's `workshopApi.turn`, `WorkshopTurn`, `WorkshopDraft`; `isMockMode()` from `@/data/_client/mode`.
- Produces: `useWorkshop(): { workshopTurn(req: { message; goal; history; draft }): Promise<WorkshopTurn> }` — ephemeral (no cache), the `draftMealFromAi` pattern verbatim: mock serves scripted rounds after a 600 ms delay; real POSTs.

- [ ] **Step 1: `workshopMock.ts`** — scripted rounds mirroring the approved prototype: round 1 (draft == null) returns the base draft (name `Citromos-joghurtos csirketál`, 2 servings, 4 steps, 3–4 pantry lines using MOCK PANTRY IDS — resolve real ids from the mock pantry seeds: look up `ingredients` in `@/data/fuel/pantry` and pick e.g. the chicken/rice/yogurt rows; estimate line `Citrom + fűszerek` with est totals) + reply prose. Goal-tagged turns (`goal` set and draft exists) return goal-specific tweaks (high_protein: chicken +60 g, rice −50 g; pre_workout: rice +100 g, oil −5 g; post_workout: +whey line; before_bed: rice→túró swap; breakfast: rice→zab swap) — implement as pure functions over the INCOMING draft so manual edits survive. Free-text turns cycle 2 generic tweaks then an honest fallback reply with the unchanged draft.
- [ ] **Step 2: `workshopHooks.ts`**:

```ts
import { useCallback } from 'react'
import { isMockMode } from '@/data/_client/mode'
import { workshopApi } from '@/data/fuel/workshopApi'
import { mockWorkshopTurn } from '@/data/fuel/workshopMock'
import type { WorkshopGoal, WorkshopDraft, WorkshopTurn } from '@/data/types'

/** Receptműhely turn (mezo-92pb) — an ephemeral call (no cache), the draftMealFromAi pattern:
 *  mock serves the scripted rounds after a demo delay, real POSTs /api/recipe/workshop/turn. */
export function useWorkshop() {
  const mock = isMockMode()
  const workshopTurn = useCallback(
    (req: { message: string; goal: WorkshopGoal | null; history: { role: 'user' | 'assistant'; text: string }[]; draft: WorkshopDraft | null }): Promise<WorkshopTurn> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(mockWorkshopTurn(req)), 600))
        : workshopApi.turn(req),
    [mock],
  )
  return { workshopTurn }
}
```

- [ ] **Step 3: Test** (`workshopHooks.test.tsx`, mirror `fuelHooks.test.tsx` harness): mock mode — first turn yields a draft with lines resolvable against the mock pantry pool (every pantry line's `refId` exists in `buildPickables(ingredients, supplementsStash)`), goal turn preserves a manually-edited amount on an untouched line; real mode — `workshopTurn` calls `fetch` with `/api/recipe/workshop/turn` (assert via the same fetch-stub idiom the existing real-mode tests use).
- [ ] **Step 4: Run BOTH modes**

Run: `cd frontend && pnpm vitest run src/data/fuel/workshopHooks.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/data/fuel/workshopHooks.test.tsx`
Expected: PASS twice. (Check how existing tests toggle mode — if mode is fixed per test file via the harness rather than env, follow that convention instead.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/fuel/workshopMock.ts frontend/src/data/fuel/workshopHooks.ts frontend/src/data/hooks.ts frontend/src/data/fuel/workshopHooks.test.tsx
git commit -m "feat(fuel): useWorkshop dual-mode hook + scripted mock rounds (mezo-92pb)"
```

---

### Task 9: FE page — RecipeWorkshopPage + entry points + router

**Files:**
- Create: `frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx`
- Create: `frontend/src/features/fuel/components/workshop/WorkshopMacroCard.tsx`
- Create: `frontend/src/features/fuel/components/workshop/WorkshopIngredientRow.tsx`
- Create: `frontend/src/features/fuel/components/workshop/WorkshopChatDock.tsx`
- Modify: `frontend/src/app/router.tsx` (route), `frontend/src/features/fuel/pages/FuelRecipesPage.tsx` (entry button), `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` (iterate action)

**Interfaces:**
- Consumes: `useWorkshop` (Task 8), everything from `workshopState.ts` (Task 7), `usePickableIngredients` (existing), `useRecipes` + `useRecipeActions` (existing), `IngredientPickerSheet` (existing — reuse for the kamra picker; read its props first and match how `RecipeEditorPage` invokes it).
- Produces: route `/fuel/recipes/muhely` (+ `?recipeId=<uuid>` seeds the draft from that recipe).

**Design source:** `docs/design_2.0/prototypes/receptmuhely.html` (approved) — canvas-first layout: editable name + goal chip; macro card (kcal + P/C/F cells, `/adag ↔ egész` toggle, kcal-source bar P·4/C·4/F·9); serving stepper (`scaleServings`); ingredient rows (pantry tag / ✨ BECSLÉS tag, editable amount with ±10 steppers, per-row kcal or honest `—`); collapsible steps; save bar; docked chat (preset chips `High protein · Pre-workout · Post-workout · Lefekvés előtt · Reggeli`, last-reply preview, composer + kamra button). Page dress: match `RecipeEditorPage`/Mozaik-2.0 (MozaikPage/PageHead, clay `i-muhely` icon — NOTE: the sprite exists only in the design assets; add the icon the way the app registers clay icons — find how existing pages render clay icons (`grep -rn "i-fuel\|ClayIcon" frontend/src/shared` first) and register `i-muhely` the same way, copying the symbol paths from `docs/design_2.0/assets/clay-icons.svg`).

**Page state (all local `useState`/`useReducer` — nothing persisted):**
```ts
draft: WorkshopDraft | null
history: { role: 'user' | 'assistant'; text: string }[]
goal: WorkshopGoal | null
diffKeys: string[]            // last turn's changed-line keys → gold flash, cleared after 2.6 s
busy: boolean
error: { message: string; retryText: string } | null   // F7.5 bubble: Újra re-sends, Szerkesztés → composer
baseMeta: { slot?: string | null; tags: string[]; starred: boolean; prepMins?: number | null; cookMins?: number | null }  // from ?recipeId, else defaults — full-replace safety
sourceRecipeId: string | null // update vs create on save
```

**Turn flow:** send → push user msg to history → `workshopTurn({message, goal, history, draft})` → on success: `setDiffKeys(diffLineKeys(draft, res.draft))`, `setDraft(res.draft)`, push assistant reply; on error: keep the user bubble, set `error` (copy: `„A Műhely most nem elérhető — az üzeneted megvan."`, actions `Újra`/`Szerkesztés`).

**Save flow:** `draftToInput(draft, baseMeta, goalRole(goal))`; while it returns `null` the save button is disabled with the honest note `„✨ becslés-sorok: cseréld kamra-itemre vagy töröld a mentéshez"` (each estimate row offers `Csere` → opens the picker preselecting a replacement, and `Törlés`); on success toast + navigate to the recipe (create → `/fuel/recipes` list; update → detail). `sourceRecipeId` present ⇒ `update(id, input)`, else `create(input)`.

- [ ] **Step 1: Build the three components + page** per the state/flows above. Ingredient row macro cell: `lineMacros(line, pool)` → number, or `—` when null (unresolvable pantry line), `✨ BECSLÉS` tag on estimate rows; manual amount edits go straight into `draft.lines[i].amount` (and rescale `est` via `rescaleFrozen`-equivalent already handled in `workshopState`).
- [ ] **Step 2: Router** — in `frontend/src/app/router.tsx` add ABOVE the `:id` routes:

```tsx
      { path: 'fuel/recipes/muhely', element: <RecipeWorkshopPage /> },
```

- [ ] **Step 3: Entry points** — `FuelRecipesPage`: header/action button `✨ Műhely` → `/fuel/recipes/muhely`; `RecipeDetailPage`: action `Iterálás a Műhelyben` → `/fuel/recipes/muhely?recipeId=${id}`. The page seeds `draft = recipeToDraft(recipe)` + `baseMeta` from the loaded recipe when the param is present (recipe from `useRecipes()` cache; fall back to `recipeApi.get` if not loaded).
- [ ] **Step 4: Verify** — `pnpm tsc --noEmit` (or repo typecheck script) + `pnpm test` (both modes) + `pnpm build` green. Then runtime-verify mock mode with the `verify` skill recipe (drive: open `/fuel/recipes/muhely`, send a message, see the draft render, tap a preset, edit an amount, check the save gate note on the estimate line, replace it via the picker, save, land on the recipe list with the new recipe present).
- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel frontend/src/app/router.tsx frontend/src/shared
git commit -m "feat(fuel): Receptműhely page — canvas + chat dock + entry points (mezo-92pb)"
```

---

### Task 10: Docs + CODEMAP

**Files:**
- Modify: `docs/features/fuel.md` (§2 surface inventory: the workshop page + endpoint; grep the file by § — do NOT read it whole, it is 295 KB)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1:** Add the Receptműhely paragraphs to `docs/features/fuel.md` §2 (page anatomy, entry points, save gate) and the backend §: endpoint, switch, port/adapter, validator demotion rules, error codes. Follow the file's dense single-line paragraph style.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` (regenerates; CI's `--check` gate must pass) and `node scripts/lint-docs.mjs` → both clean.
- [ ] **Step 3: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md
git commit -m "docs(fuel): Receptműhely feature docs + codemap (mezo-92pb)"
```

---

### Task 11: Gates, PR, merge, deploy

- [ ] **Step 1: Local quality gates** — `cd backend && ./mvnw test -q -Dtest='RecipeWorkshop*'`; `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`. All green before pushing.
- [ ] **Step 2: bd + push** — `bd close mezo-92pb` with a completion comment; `bd dolt push`; `git push -u origin claude/receptmuehely-ai-builder-dce581`.
- [ ] **Step 3: Self-PR** — `gh pr create` (title `feat(fuel): Receptműhely — AI recept-builder (mezo-92pb)`, body summarizing the slice + test evidence, footer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Wait for CI green (`gh pr checks --watch`) — CI runs the FULL backend IT suite + FE both modes + lint + contract-drift + ArchUnit + CODEMAP check.
- [ ] **Step 4: Merge + deploy** — `git checkout main && git pull --rebase && git merge --no-ff <branch> && git push` (PR auto-closes; `deploy.yml` builds the changed images and ArgoCD rolls them out automatically). Delete the branch. NOTE: this session runs in the worktree — perform the merge from the worktree per `superpowers:finishing-a-development-branch` (or coordinate with the primary checkout carefully; never work ON main in the primary checkout beyond the merge itself).
- [ ] **Step 5: Verify** — `git status` shows "up to date with origin"; `gh run watch` the deploy workflow to completion.

---

## Out of scope (spec §8, unchanged)

Pantry-stock deduction on cooking; `MealRole` enum extension (breakfast/before_bed rubrics — the goal presets map those to `standard` for now); workshop-conversation persistence on the recipe; pantry quick-create from an estimate line; live goal-fit badge on the canvas.
