# Deterministic pantry name matcher for AI meal drafts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the LLM fails to link a recognized food to a pantry row, a strict deterministic name match links it instead — and the UI stops labelling every AI line "becslés".

**Architecture:** A new Spring-free `PantryNameIndex` (built from the owner's pantry rows) sits in `MealAiDraftService.mapLine` between the LLM-id arm and the estimate arm. A hit produces a normal pantry line with DB macros plus `needsReview=true`. The frontend splits the line tag into a semantic `tag` (drives `data-tag` + CSS) and a displayed `tagLabel` (carries the `✨`).

**Tech Stack:** Java 25 / Spring Boot (backend, JUnit 5 + AssertJ, Testcontainers ITs), React 19 + TypeScript + Vitest + Testing Library (frontend).

**Spec:** [`docs/superpowers/specs/2026-09-01-meal-ai-pantry-name-match-design.md`](../specs/2026-09-01-meal-ai-pantry-name-match-design.md) · **bd:** mezo-qrks · **branch:** `feat/meal-ai-pantry-name-match`

## Global Constraints

- **A téves párosítás rosszabb, mint a becslés.** Every ambiguous case must fall through to the estimate arm, never to a guessed pantry row.
- The OpenAPI contract (`api/feature/meal/meal.yml`) does **not** change. No regeneration of `frontend/src/data/_client/api.gen.ts`.
- No new configuration property, no new feature switch.
- Recipes are **out of scope** for name matching — pantry only.
- Backend tests run from the `backend/` directory. Integration tests need `-Dmezo.test.use-testcontainers=true` (the default fixed-DB mode races and reports fake failures).
- Frontend tests must pass in **both** modes; a bare `pnpm test` runs mock mode twice, so the real-mode run needs `VITE_USE_MOCK=false` explicitly.
- Hungarian user-facing copy. Comments and commit messages in English, matching the surrounding code.
- Conventional commit subjects carrying the bd id: `feat(meal): ... (mezo-qrks)`.

---

### Task 1: `PantryNameIndex` — the deterministic matcher

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndex.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndexTest.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity` (getters: `getId()`, `getName()`, `getBrand()`, `getServingUnit()`).
- Produces:
  - `static PantryNameIndex of(List<PantryItemEntity> items)`
  - `Optional<PantryItemEntity> match(String name, String unit)`

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndexTest.java`:

```java
package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the deterministic pantry name matcher (mezo-qrks) — no Spring, no DB.
 * The house rule under test: an ambiguous or unit-mismatched lookup MUST miss, because a wrong
 * pantry match silently writes wrong macros into the log while a miss only costs convenience.
 */
class PantryNameIndexTest {

    private static PantryItemEntity item(String name, String brand, String servingUnit) {
        PantryItemEntity e = new PantryItemEntity();
        e.setId(UUID.randomUUID());
        e.setName(name);
        e.setBrand(brand);
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit(servingUnit);
        return e;
    }

    @Test
    void testMatch_shouldFindExactName_whenCaseAndAccentsDiffer() {
        PantryItemEntity turo = item("Túró Rudi", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(turo));

        assertThat(index.match("Túró Rudi", "g")).contains(turo);
        assertThat(index.match("turo rudi", "g")).contains(turo);
        assertThat(index.match("  TÚRÓ   RUDI ", "g")).contains(turo);
    }

    @Test
    void testMatch_shouldFindByBrandPrefixedName() {
        PantryItemEntity rizs = item("Basmati rizs", "Rizspont", "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(rizs));

        assertThat(index.match("Rizspont Basmati rizs", "g")).contains(rizs);
        assertThat(index.match("Basmati rizs", "g")).contains(rizs);
    }

    @Test
    void testMatch_shouldStripPackSize_whenNameEndsWithUnitSuffixedNumber() {
        PantryItemEntity zab = item("Zabpehely 500 g", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab));

        assertThat(index.match("Zabpehely", "g")).contains(zab);
        assertThat(index.match("Zabpehely 500 g", "g")).contains(zab);
    }

    @Test
    void testMatch_shouldNotStripPercentage_soMilkFatContentSurvives() {
        PantryItemEntity tej = item("Tej 1,5%", null, "ml");
        PantryNameIndex index = PantryNameIndex.of(List.of(tej));

        assertThat(index.match("Tej 1,5%", "ml")).contains(tej);
        assertThat(index.match("Tej", "ml")).isEmpty(); // the fat content is NOT packaging
    }

    @Test
    void testMatch_shouldMiss_whenAStrippedKeyIsAmbiguous() {
        PantryItemEntity small = item("Tej 1 l", null, "ml");
        PantryItemEntity big = item("Tej 2 l", null, "ml");
        PantryNameIndex index = PantryNameIndex.of(List.of(small, big));

        assertThat(index.match("Tej", "ml")).isEmpty();       // ambiguous -> no guess
        assertThat(index.match("Tej 1 l", "ml")).contains(small); // full names still resolve
        assertThat(index.match("Tej 2 l", "ml")).contains(big);
    }

    @Test
    void testMatch_shouldMiss_whenUnitDisagrees() {
        PantryItemEntity zab = item("Zabpehely", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab));

        assertThat(index.match("Zabpehely", "db")).isEmpty();
        assertThat(index.match("Zabpehely", null)).isEmpty();
        assertThat(index.match("Zabpehely", " ")).isEmpty();
    }

    @Test
    void testMatch_shouldAcceptUnitSynonyms() {
        PantryItemEntity zab = item("Zabpehely", null, "g");
        PantryItemEntity tojas = item("Tojás", null, "db");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab, tojas));

        assertThat(index.match("Zabpehely", "gramm")).contains(zab);
        assertThat(index.match("Zabpehely", "GR")).contains(zab);
        assertThat(index.match("Tojás", "darab")).contains(tojas);
    }

    @Test
    void testMatch_shouldTreatNullServingUnitAsGrams() {
        PantryItemEntity e = item("Mák", null, null);
        PantryNameIndex index = PantryNameIndex.of(List.of(e));

        assertThat(index.match("Mák", "g")).contains(e);
        assertThat(index.match("Mák", "db")).isEmpty();
    }

    @Test
    void testMatch_shouldMiss_whenIndexOrNameIsEmpty() {
        assertThat(PantryNameIndex.of(List.of()).match("Zabpehely", "g")).isEmpty();

        PantryNameIndex index = PantryNameIndex.of(List.of(item("Zabpehely", null, "g")));
        assertThat(index.match(null, "g")).isEmpty();
        assertThat(index.match("   ", "g")).isEmpty();
        assertThat(index.match("Nincs ilyen", "g")).isEmpty();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=PantryNameIndexTest -DfailIfNoTests=false
```

Expected: compile error — `PantryNameIndex` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndex.java`:

```java
package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Strict, deterministic name -> pantry-row lookup for the AI meal draft (mezo-qrks). It is the
 * net UNDER the LLM's own catalog matching: when the model recognizes a food but leaves
 * {@code pantryItemId} null, {@link MealAiDraftService} asks this index before falling through to
 * an estimate line.
 *
 * <p>Deliberately unforgiving — a wrong match silently writes wrong macros into the log, while a
 * miss only costs convenience. Hence: normalized FULL-name equality (no substring, no similarity
 * score), an ambiguous key resolves to nothing, and the amount unit must agree with the row's
 * serving unit. Pure and Spring-free so the rules are unit-testable without a context.
 */
public final class PantryNameIndex {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}]+");
    /** A trailing packaging size on the RAW name: "Zabpehely 500 g", "Kefir 1,5 l". */
    private static final Pattern PACK_SIZE =
            Pattern.compile("[\\s,;\\-]+\\d+(?:[.,]\\d+)?\\s*(?:g|dkg|kg|ml|cl|dl|l|db)\\s*$",
                    Pattern.CASE_INSENSITIVE);
    private static final Map<String, String> UNIT_SYNONYMS = Map.of(
            "gramm", "g", "gr", "g", "milliliter", "ml", "darab", "db", "piece", "db");
    private static final String DEFAULT_SERVING_UNIT = "g";

    /** Keys that survived the ambiguity check; a key claimed by two different rows is dropped. */
    private final Map<String, PantryItemEntity> byKey;

    private PantryNameIndex(Map<String, PantryItemEntity> byKey) {
        this.byKey = byKey;
    }

    public static PantryNameIndex of(List<PantryItemEntity> items) {
        Map<String, PantryItemEntity> byKey = new HashMap<>();
        Set<String> ambiguous = new HashSet<>();
        for (PantryItemEntity item : items) {
            for (String key : keysOf(item)) {
                PantryItemEntity previous = byKey.putIfAbsent(key, item);
                if (previous != null && !Objects.equals(previous.getId(), item.getId())) {
                    ambiguous.add(key);
                }
            }
        }
        ambiguous.forEach(byKey::remove);
        return new PantryNameIndex(Map.copyOf(byKey));
    }

    /** The row whose name (or brand+name, or pack-size-stripped name) equals {@code name}. */
    public Optional<PantryItemEntity> match(String name, String unit) {
        String key = normalize(name);
        if (key.isEmpty()) {
            return Optional.empty();
        }
        PantryItemEntity hit = byKey.get(key);
        if (hit == null || !unitsAgree(unit, hit.getServingUnit())) {
            return Optional.empty();
        }
        return Optional.of(hit);
    }

    private static Set<String> keysOf(PantryItemEntity item) {
        String name = item.getName() == null ? "" : item.getName();
        String brand = item.getBrand() == null ? "" : item.getBrand().trim();
        String stripped = PACK_SIZE.matcher(name).replaceFirst("");
        Set<String> keys = new LinkedHashSet<>();
        keys.add(normalize(name));
        keys.add(normalize(stripped));
        if (!brand.isEmpty()) {
            keys.add(normalize(brand + " " + name));
            keys.add(normalize(brand + " " + stripped));
        }
        keys.remove("");
        return keys;
    }

    /** Accent-free, punctuation-free, single-spaced lowercase — applied to BOTH sides. */
    private static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        String bare = DIACRITICS.matcher(decomposed).replaceAll("");
        return NON_ALPHANUMERIC.matcher(bare).replaceAll(" ").trim().toLowerCase();
    }

    /** The draft's unit must be the row's serving unit; a blank draft unit never matches. */
    private static boolean unitsAgree(String draftUnit, String servingUnit) {
        String draft = canonicalUnit(draftUnit);
        if (draft.isEmpty()) {
            return false;
        }
        String serving = canonicalUnit(servingUnit);
        return draft.equals(serving.isEmpty() ? DEFAULT_SERVING_UNIT : serving);
    }

    private static String canonicalUnit(String raw) {
        String normalized = normalize(raw);
        return UNIT_SYNONYMS.getOrDefault(normalized, normalized);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && ./mvnw -q test -Dtest=PantryNameIndexTest -DfailIfNoTests=false
```

Expected: PASS, 9 tests.

If `testMatch_shouldNotStripPercentage_soMilkFatContentSurvives` fails on the `Tej` lookup returning the row, the `PACK_SIZE` pattern is anchoring wrong — it must only strip when the name **ends** with a number + unit, and `1,5%` ends with `%`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndex.java backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndexTest.java
git commit -m "feat(meal): strict deterministic pantry name index (mezo-qrks)"
```

---

### Task 2: Wire the index into `MealAiDraftService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftServiceIT.java`

**Interfaces:**
- Consumes: `PantryNameIndex.of(List<PantryItemEntity>)` and `Optional<PantryItemEntity> match(String, String)` from Task 1.
- Produces: no new public API. `MealAiDraftService.draft(UUID, LocalDate, String, MultipartFile)` keeps its signature; the private `pantryItem` gains a `boolean needsReview` parameter.

- [ ] **Step 1: Write the failing tests**

Append these three tests to `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftServiceIT.java`, inside the class, before the closing brace. `pantryItemPopulator.createFood` seeds `serving 100 g`, `kcal 110`, `brand "Bonafarm"`.

```java
    @Test
    void testDraft_shouldMatchPantryByName_whenLlmLeftTheIdNull() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        PantryItemEntity pantry = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(30));

        // The LLM recognized the food but did NOT link it — the deterministic index must.
        String json = """
            {"slot":"breakfast","title":"Reggeli","note":null,"items":[
              {"pantryItemId":null,"recipeId":null,"name":"zabpehely","amount":60,"unit":"g",
               "kcal":220,"proteinG":8,"carbsG":38,"fatG":4}
            ]}""";

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("pantry");
        assertThat(line.getPantryItemId()).isEqualTo(pantry.getId());
        assertThat(line.getName()).isEqualTo(pantry.getName());          // DB name, not the LLM's casing
        assertThat(line.getKcal()).isEqualByComparingTo(pantry.getKcal()); // DB macros, not the LLM's 220
        assertThat(line.getAmount()).isEqualByComparingTo("60");           // the draft's own portion
        assertThat(line.getBasisUnit()).isEqualTo("g");
        assertThat(line.getNeedsReview()).isTrue();                        // identity is the uncertain part
    }

    @Test
    void testDraft_shouldStayEstimate_whenNameMatchesButUnitDisagrees() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(30)); // serving: g

        String json = """
            {"slot":"breakfast","title":null,"note":null,"items":[
              {"pantryItemId":null,"recipeId":null,"name":"Zabpehely","amount":1,"unit":"db",
               "kcal":220,"proteinG":8,"carbsG":38,"fatG":4}
            ]}""";

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getPantryItemId()).isNull();
        assertThat(line.getKcal()).isEqualByComparingTo("220"); // the LLM's own numbers
    }

    @Test
    void testDraft_shouldMatchByName_whenTheLlmIdWasHallucinated() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        PantryItemEntity pantry = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(30));

        String json = """
            {"slot":"breakfast","title":null,"note":null,"items":[
              {"pantryItemId":"%s","recipeId":null,"name":"Zabpehely","amount":60,"unit":"g",
               "kcal":220,"proteinG":8,"carbsG":38,"fatG":4}
            ]}""".formatted(UUID.randomUUID());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("pantry"); // demoted, then rescued by the name index
        assertThat(line.getPantryItemId()).isEqualTo(pantry.getId());
        assertThat(line.getKcal()).isEqualByComparingTo(pantry.getKcal());
        assertThat(line.getNeedsReview()).isTrue();
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && ./mvnw -q clean test -Dtest=MealAiDraftServiceIT -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Expected: the three new tests FAIL (the name-matched lines come back as `source=estimate`); the five pre-existing tests in the class PASS.

- [ ] **Step 3: Write the implementation**

In `MealAiDraftService`, make these five edits.

**3a.** Add the import next to the existing pantry imports:

```java
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
```

**3b.** In `draft(...)`, fetch the pantry list once and hand it to the prompt builder and the response mapper. Replace:

```java
        String systemPrompt = buildSystemPrompt(userId);
```

with:

```java
        List<PantryItemEntity> pantry =
                pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        String systemPrompt = buildSystemPrompt(userId, pantry);
```

and replace the closing line:

```java
        ExtractedMeal extracted = parse(answer);
        return toResponse(userId, extracted);
```

with:

```java
        ExtractedMeal extracted = parse(answer);
        return toResponse(userId, extracted, pantry);
```

**3c.** Change `buildSystemPrompt` to take the already-fetched list. Its signature becomes:

```java
    private String buildSystemPrompt(UUID userId, List<PantryItemEntity> pantry) {
```

and its pantry loop header becomes (the recipe loop below it is unchanged):

```java
        for (PantryItemEntity p : pantry) {
```

**3d.** Thread the list through `toResponse` into `mapLine`. Replace the `toResponse` signature and its `mapLine` call:

```java
    private MealAiDraftResponse toResponse(UUID userId, ExtractedMeal extracted,
            List<PantryItemEntity> pantry) {
        Map<UUID, PantryItemEntity> pantryById = pantry.stream()
                .collect(Collectors.toMap(PantryItemEntity::getId, Function.identity()));
        PantryNameIndex nameIndex = PantryNameIndex.of(pantry);
```

(the rest of the method body is unchanged, except the loop's call:)

```java
            MealAiDraftItem item = mapLine(userId, line, pantryById, nameIndex);
```

**3e.** Replace `mapLine` and `pantryItem`'s signature with the three-arm version. The pantry-id arm now resolves from the already-loaded map (the list is `createdBy` + `deleted=false` filtered, so ownership still holds), and BOTH the demoted and the id-less path go through the name index first:

```java
    private MealAiDraftItem mapLine(UUID userId, ExtractedLine line,
            Map<UUID, PantryItemEntity> pantryById, PantryNameIndex nameIndex) {
        UUID pantryId = parseUuid(line.pantryItemId());
        UUID recipeId = parseUuid(line.recipeId());

        if (pantryId != null) {
            PantryItemEntity p = pantryById.get(pantryId);
            if (p != null) {
                return pantryItem(p, line, false);
            }
            log.warn("Meal AI draft: hallucinated pantry id {} demoted", pantryId);
            return matchByNameOrEstimate(line, nameIndex, true);
        }
        if (recipeId != null) {
            RecipeEntity r = recipeRepository.findByIdAndCreatedByAndDeletedFalse(recipeId, userId)
                    .orElse(null);
            if (r != null) {
                return recipeItem(r, line);
            }
            log.warn("Meal AI draft: hallucinated recipe id {} demoted", recipeId);
            return matchByNameOrEstimate(line, nameIndex, true);
        }
        return matchByNameOrEstimate(line, nameIndex, false);
    }

    /**
     * The net under the LLM's own catalog matching (mezo-qrks): a strict name+unit hit becomes a
     * real pantry line with DB macros, flagged for review because the IDENTITY — not the numbers —
     * is what stayed uncertain. Runs before the macro-completeness check on purpose: a matched line
     * gets its macros from the row, so the LLM's missing kcal no longer has to drop it.
     */
    private MealAiDraftItem matchByNameOrEstimate(ExtractedLine line, PantryNameIndex nameIndex,
            boolean demoted) {
        PantryItemEntity matched = nameIndex.match(line.name(), line.unit()).orElse(null);
        if (matched != null) {
            log.info("Meal AI draft: '{}' name-matched pantry item {}", line.name(), matched.getId());
            return pantryItem(matched, line, true);
        }
        return estimateItem(line, demoted);
    }
```

and `pantryItem` gains the flag (the `confidence` stays `ONE` — the DB macros are exact):

```java
    /** Matched pantry line: snapshot numbers from the DB row, never the LLM. */
    private MealAiDraftItem pantryItem(PantryItemEntity p, ExtractedLine line, boolean needsReview) {
```

with its last two assignments becoming:

```java
        item.setConfidence(BigDecimal.ONE);
        item.setNeedsReview(needsReview);
```

Finally, delete the now-unused `findByIdAndCreatedByAndDeletedFalse` call site — the `PantryItemRepository` field itself is still used by `draft`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q clean test -Dtest='MealAiDraftServiceIT,MealAiDraftApiIT,MealAiUploadLimitApiIT,PantryNameIndexTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Expected: all PASS (8 tests in `MealAiDraftServiceIT`).

`MealAiDraftApiIT` runs as the shared `demodata` user, whose pantry is seeded. Its first
test drafts a `"Latte"` line with unit `db` and asserts `source=estimate`. If that flips to
`pantry`, the demo seed contains a colliding row — change the sentinel's name in that test to
something the seed cannot hold (e.g. `"Latte KAMU"`) rather than loosening the matcher.

- [ ] **Step 5: Run the ArchUnit + context gates**

New backend classes must not break the layer rules.

```bash
cd backend && ./mvnw -q clean test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Expected: PASS. `PantryNameIndex` lives in `feature.meal.service` and imports only `feature.pantry.entity`, which `MealAiDraftService` already does — the feature-slice cycle rule stays closed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftService.java backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealAiDraftServiceIT.java
git commit -m "feat(meal): fall back to deterministic pantry name matching before estimating (mezo-qrks)"
```

---

### Task 3: The composer tells the truth about a line's source

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx` (`lineMeta` at :85–133, the tag span at :420, the review note at :448–450)
- Test: `frontend/src/features/fuel/pages/LogFlowPage.test.tsx` (the mixed-sources test at :155–177)

**Interfaces:**
- Consumes: the `MealAiDraft` line shape already mapped in `runAi` — `source: 'pantry' | 'recipe' | 'estimate'`, `needsReview: boolean`, `fromAi: true`.
- Produces: `lineMeta` now returns `tagLabel` alongside `tag`. `tag` stays one of `'kamra' | 'recept' | 'becslés'` — the CSS in `prototype.css:6742–6743` selects on it via `data-tag`.

- [ ] **Step 1: Write the failing test**

In `frontend/src/features/fuel/pages/LogFlowPage.test.tsx`, replace the assertion block of the test named `'AI-recognized lines land BECSLÉS-tagged next to a manual pantry line — mixed sources in one meal'`. Rename the test and swap its three tag assertions:

```tsx
test('AI lines carry their REAL source tag next to a manual pantry line — mixed sources in one meal', async () => {
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  renderPage()
  // Manual Kamra line first.
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))

  // Then the AI panel — MOCK_AI_MEAL_DRAFT resolves after 600ms in mock mode.
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap és egy latte')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))

  expect(await screen.findByText('Elemzem az étkezést…')).toBeInTheDocument()
  expect(await screen.findByText('Csirkés wrap')).toBeInTheDocument()
  // The draft's pantry-matched line says so (mezo-qrks) — only the genuinely estimated line
  // is tagged 'becslés'. The ✨ marks who put the line there, the word stays honest about
  // where the macros came from.
  expect(screen.getByText('kamra ✨')).toBeInTheDocument()
  expect(screen.getByText('becslés')).toBeInTheDocument()
  // The manual line keeps its own unadorned tag.
  expect(screen.getByText('kamra')).toBeInTheDocument()
  expect(screen.getByText(/Az AI nem teljesen biztos ebben a sorban/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/fuel/pages/LogFlowPage.test.tsx
```

Expected: FAIL — `Unable to find an element with the text: kamra ✨`.

- [ ] **Step 3: Write the implementation**

**3a.** In `MealComposer.tsx`, replace the tag line at the top of `lineMeta`:

```ts
  const tag = l.fromAi ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
```

with:

```ts
  // The tag names where the MACROS came from; ✨ marks who put the line there. Keeping the two
  // apart is why an AI line matched to a real Kamra row no longer lies about being an estimate
  // (mezo-qrks). `tag` alone feeds data-tag — prototype.css selects on its exact value.
  const tag = l.source === 'estimate' ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
  const tagLabel = l.fromAi ? `${tag} ✨` : tag
```

**3b.** Add `tagLabel` to all three `return` objects in `lineMeta` — the estimate arm, the recipe arm, and the final pantry arm. Each already has `tag,` in its object literal; make it `tag, tagLabel,`.

**3c.** Update the JSX at :420 to render the label while keeping the semantic attribute:

```tsx
                <span className="logflow-lntag" data-tag={meta.tag}>{meta.tagLabel}</span>
```

**3d.** Update the `DraftLine.fromAi` doc comment at :76–78, which now states the opposite of the truth:

```ts
  /** true when this line came out of the AI panel — shown as a ✨-suffixed source tag, so a
   *  pantry-matched AI line reads "kamra ✨" rather than pretending to be an estimate. */
  fromAi?: boolean
```

**3e.** Make the review note say what actually needs reviewing (at :448–450):

```tsx
            {l.needsReview && (
              <p className="logflow-lnnote">
                {l.source === 'estimate'
                  ? '✨ Az AI nem teljesen biztos ebben a sorban — nézd át a mennyiséget.'
                  : '✨ Ezt a kamrádból párosítottuk név alapján — ellenőrizd, hogy tényleg ez a tétel.'}
              </p>
            )}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && pnpm vitest run src/features/fuel
```

Expected: PASS. `MealComposer.logDate.test.tsx`, `LogFlowPage.ai.test.tsx`, `LogFlowPage.overrides.test.tsx` and the rest of the fuel suite must stay green — if any of them asserts on the literal `'becslés'` for a pantry-sourced AI line, update that assertion the same way.

- [ ] **Step 5: Run the full frontend gate in both modes**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: both runs PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx frontend/src/features/fuel/pages/LogFlowPage.test.tsx
git commit -m "feat(fuel): AI meal lines show their real source tag (mezo-qrks)"
```

---

### Task 4: Docs + generated codemap

**Files:**
- Modify: `docs/features/fuel.md` (the AI meal-logging section, and §10's key-files/tests listing)
- Regenerate: `docs/CODEMAP.md`

**Interfaces:**
- Consumes: the finished behavior from Tasks 1–3. Nothing consumes this task.

- [ ] **Step 1: Find the AI meal-logging passage**

```bash
grep -n "mezo-78rn\|ai-draft" docs/features/fuel.md
```

- [ ] **Step 2: Document the new matching order**

In the AI meal-logging passage, state the three-arm order explicitly: the LLM's own catalog match (ids copied from the prompt's PANTRY CATALOG) → **the deterministic `PantryNameIndex` name+unit match, which flags `needsReview` because only the identity is uncertain (mezo-qrks)** → the estimate line. Record the two rules a future reader will otherwise re-litigate: an ambiguous normalized key resolves to nothing, and a unit disagreement blocks the match. Note that the composer now tags an AI line by its real source (`kamra ✨` / `recept ✨` / `becslés`), replacing the design-2.0 §7 blanket "becslés".

Add `PantryNameIndex.java` and `PantryNameIndexTest.java` to the file's key-files / test listings wherever the sibling meal-AI classes are already listed.

- [ ] **Step 3: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 4: Verify the doc lint passes**

```bash
node scripts/lint-docs.mjs
```

Expected: no new errors. Pre-existing warnings unrelated to `fuel.md` are fine — do not fix them here.

- [ ] **Step 5: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md
git commit -m "docs(fuel): record the deterministic pantry name-match arm (mezo-qrks)"
```

---

## Verification before handoff

- [ ] `cd backend && ./mvnw -q clean test -Dtest='io.mrkuhne.mezo.feature.meal.**' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"` — the whole meal slice is green.
- [ ] `cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build` — both modes green, build clean.
- [ ] `git log --oneline` shows four commits, each carrying `(mezo-qrks)`.
- [ ] `git status` is clean.
