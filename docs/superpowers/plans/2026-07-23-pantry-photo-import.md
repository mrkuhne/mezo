# Pantry Photo Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photograph a product's nutrition label (+ optional front-of-pack) → one multimodal LLM call extracts a per-100 g pantry draft → user confirms via the existing import path. Activates the `ImportItemSheet`'s inert "Címke fotó" as a real third import mode.

**Architecture:** New `POST /api/pantry-import/photo` (multipart, 1–2 images) in `feature/pantry`, reusing the URL-scrape slice's draft shape (`PantryScrapeResponse`), deterministic `ScrapeDraftValidator` confidence, and the `POST /api/pantry-import` confirm path (new three-armed source derivation via an `origin` marker). Pantry-owned `PhotoExtractLlm` port (ADR 0012) bridged by a companion adapter to a new multi-image `CompanionLlm` overload. Photos are ephemeral — never stored.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven · OpenAPI contract-first (`api/` fragments) · Liquibase · React 19 + Vite + TanStack Query · vitest · Testcontainers ITs.

**Spec:** `docs/superpowers/specs/2026-07-23-pantry-photo-import-design.md` · **bd:** `mezo-d8tr` · **Branch:** `feat/pantry-photo-import` (already checked out; the spec commit is on it).

## Global Constraints

- **Contract-first:** edit `api/feature/pantry/pantry.yml` BEFORE any code; merge via `cd api/generate && npm run generate:api`; FE types via `cd frontend && pnpm generate:api`; backend Java types regenerate in `./mvnw generate-sources`/`test`. Never hand-write boundary DTOs.
- **Macro basis (mezo-y9ga):** the draft is ALWAYS `per=100`, `unit='g'` — hard-set server-side, regardless of the model answer.
- **Backend:** base package `io.mrkuhne.mezo`; constructor injection + `@RequiredArgsConstructor`; `@Transactional` method-level only; configurable values in `application.yml` under `mezo:` via `@Validated` records — never `@Value`; errors via `SystemRuntimeErrorException` + `SystemMessage` with keys in `messages.properties` (note: file is `messages.properties`, plural).
- **Feature switch:** `mezo.feature.pantry-photo.enabled` + `FeaturesConfiguration` constant + `@ConditionalOnProperty`. Both switch states integration-tested.
- **Jackson:** SB4 uses `tools.jackson.databind.ObjectMapper` (NOT `com.fasterxml`).
- **Tests:** integration-first (`ApiIntegrationTest` base, `companion-fake` profile for LLM, `test{Method}_should{Result}_when{Condition}` names, AssertJ only, no mocks/H2). FE: vitest, BOTH modes must pass (`pnpm test` and `VITE_USE_MOCK=true pnpm test`).
- **Liquibase:** script `{YYYYMMDDHHMM}_mezo-d8tr_{desc}.sql` under `backend/src/main/resources/db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`; never modify released changesets; run `node scripts/lint-liquibase.mjs`.
- **Copy:** UI copy Hungarian; code/comments/commits English. Conventional commits carrying `(mezo-d8tr)`.
- **Photos are ephemeral** — bytes go multipart → memory → LLM call → dropped. No storage.
- **Cross-feature direction:** pantry NEVER imports `feature.companion`; the adapter lives in companion (ADR 0012).

---

### Task 1: API contract — photo endpoint, `photo` source, `origin` marker

**Files:**
- Modify: `api/feature/pantry/pantry.yml`
- Regenerate: `api/openapi.yml` (merge), `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `PantryPhotoApi` (backend interface, method `photoExtractPantryItem(MultipartFile photo, MultipartFile photo2)`), `PantrySource.PHOTO` enum value, `PantryImportRequest.getOrigin()`, `PantryScrapeResult.setSourceUrl(null)` legal (nullable). FE `components['schemas']['PantryScrapeResponse']` unchanged in name.

- [ ] **Step 1: Add the photo path to `api/feature/pantry/pantry.yml`**

Directly AFTER the existing `/api/pantry-import/scrape` path block, add (mirror the scrape block's response style exactly — it declares only `'200'`):

```yaml
  /api/pantry-import/photo:
    post:
      tags: [PantryPhoto]
      operationId: photoExtractPantryItem
      summary: Extract a pantry draft from nutrition-label photo(s) (stateless, photos ephemeral, nothing persisted)
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [photo]
              properties:
                photo:
                  type: string
                  format: binary
                photo2:
                  type: string
                  format: binary
      responses:
        '200': { description: Draft extracted (result null when no nutrition facts are legible), content: { application/json: { schema: { $ref: '#/components/schemas/PantryScrapeResponse' } } } }
```

- [ ] **Step 2: Widen `PantrySource` and `PantryImportRequest`; relax `PantryScrapeResult.sourceUrl`**

In the same file:

a) `PantrySource` enum — append `photo`:
```yaml
    PantrySource:
      type: string
      enum: [kifli.hu, myprotein.hu, tesco.hu, auchan.hu, gymbeam.hu, web, manual, lidl, nutriversum, herbahaz, nutrifit, decathlon, openfoodfacts, photo]
```

b) `PantryImportRequest` — add after the `confidence` property:
```yaml
        origin: { type: string, nullable: true, pattern: '^photo$' }
```

c) `PantryScrapeResult` — the photo draft has no URL:
- change `sourceUrl: { type: string }` to `sourceUrl: { type: string, nullable: true }`
- remove `sourceUrl` from the `required:` list (result: `required: [name, per, unit, kcal, source, confidence, needsReview]`)

- [ ] **Step 3: Regenerate merge + FE types**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; no errors.

- [ ] **Step 4: Verify the backend generates + compiles**

```bash
cd backend && ./mvnw clean generate-sources compile -q
```
Expected: BUILD SUCCESS (generated `PantryPhotoApi` exists; nothing implements it yet — interfaces don't force implementations).

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): pantry photo-import contract — POST /api/pantry-import/photo + photo source + origin marker (mezo-d8tr)"
```

---

### Task 2: Liquibase — widen the source CHECKs with `photo`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607231400_mezo-d8tr_pantry_photo_source.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)

**Interfaces:**
- Produces: `pantry_item.source` and `pantry_import.source` accept `'photo'` (Tasks 5 & 7 persist it).

- [ ] **Step 1: Write the migration script**

Open `202607181100_mezo-8vum_pantry_scrape.sql` and copy its exact `IN (...)` lists; append `'photo'`. The new file:

```sql
-- Photo import (mezo-d8tr): widen the source allow-lists with the 'photo' provenance.
-- Kept in lockstep with the PantrySource contract enum (defensive mapper: mezo-w3o).
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon',
                      'openfoodfacts','gymbeam.hu','web','photo'));

alter table pantry_import drop constraint ck_pantry_import_source;
alter table pantry_import add  constraint ck_pantry_import_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon',
                      'openfoodfacts','gymbeam.hu','web','photo'));
```

(If the 8vum lists differ from the above, the 8vum file wins — copy verbatim + `'photo'`.)

- [ ] **Step 2: Register in the master changelog**

Append to `1.0.0/1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202607231400_mezo-d8tr_pantry_photo_source"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607231400_mezo-d8tr_pantry_photo_source.sql
```

- [ ] **Step 3: Lint + prove the migration applies**

```bash
node scripts/lint-liquibase.mjs
cd backend && ./mvnw clean test -Dtest=PantryApiIT -q
```
Expected: lint PASS; the IT boots Liquibase on the fixed `mezo_test` DB (compose must be up) and passes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/
git commit -m "feat(db): widen pantry source CHECKs with photo provenance (mezo-d8tr)"
```

---

### Task 3: `CompanionLlm` multi-image overload (Gemini + Fake)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java:58-69`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`

**Interfaces:**
- Produces: `CompanionLlm.InlineImage(byte[] bytes, String mimeType)` record; abstract `String complete(String systemPrompt, String userMessage, List<InlineImage> images)`; the OLD single-image method becomes a `default` delegating to the list overload (meal-AI callers untouched).
- Produces (test infra): `FakeCompanionLlm.PHOTO_SENTINEL` — `[fake-photo:{json}]` decoded from image bytes.

- [ ] **Step 1: Extend the `CompanionLlm` interface**

In `CompanionLlm.java`, REPLACE the existing single-image method:

```java
    /**
     * One-shot completion on the cheap tier with ONE inline image (vision). The bytes live only
     * for this call — nothing is stored. mezo-78rn (AI meal log) is the first consumer.
     */
    String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
```

with the list overload + a delegating default:

```java
    /** An ephemeral inline image for a multimodal call — bytes live only for the call. */
    record InlineImage(byte[] bytes, String mimeType) {}

    /**
     * One-shot completion on the cheap tier with ephemeral inline image(s) (vision). Nothing is
     * stored. mezo-d8tr (pantry photo import) is the first multi-image consumer; single-image
     * callers (meal-AI, mezo-78rn) ride the delegating default below.
     */
    String complete(String systemPrompt, String userMessage, List<InlineImage> images);

    /** Single-image convenience — delegates to the list overload. */
    default String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        return complete(systemPrompt, userMessage, List.of(new InlineImage(imageBytes, mimeType)));
    }
```

- [ ] **Step 2: Rework `GeminiCompanionLlm`**

REPLACE the existing single-image override (lines 58–69) with the list version (imports `List`, `Media`, `MimeTypeUtils`, `ByteArrayResource` already present):

```java
    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        return chatClient.prompt()
            .system(systemPrompt)
            .user(u -> {
                u.text(userMessage == null || userMessage.isBlank() ? "(no text)" : userMessage);
                for (InlineImage img : images) {
                    u.media(Media.builder()
                        .mimeType(MimeTypeUtils.parseMimeType(img.mimeType()))
                        .data(new ByteArrayResource(img.bytes()))
                        .build());
                }
            })
            .call()
            .content();
    }
```

- [ ] **Step 3: Extend `FakeCompanionLlm`**

a) Add the sentinel constant next to `SCRAPE_SENTINEL`:

```java
    /** Scripted photo import (mezo-d8tr): {@code [fake-photo:{json}]} decoded from IMAGE BYTES —
     *  the flat draft JSON nests no objects, so the non-greedy match is safe (unlike meal). */
    public static final Pattern PHOTO_SENTINEL =
            Pattern.compile("\\[fake-photo:(\\{.*?})]", Pattern.DOTALL);
```

b) Add the list-overload implementation (next to the existing single-image override, which STAYS — it serves the meal sentinel path):

```java
    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        // Photo import (mezo-d8tr): a "photo" in ITs is the UTF-8 sentinel text — decode EVERY
        // image so the two-photo path is exercised; no sentinel -> prompt echo -> the caller's
        // parse fails -> 502, which is exactly the extraction-failure path ITs assert.
        for (InlineImage img : images) {
            Matcher m = PHOTO_SENTINEL.matcher(new String(img.bytes(), StandardCharsets.UTF_8));
            if (m.find()) {
                return m.group(1);
            }
        }
        return complete(systemPrompt, userMessage);
    }
```

- [ ] **Step 4: Regression — the meal photo path still works via the default**

```bash
cd backend && ./mvnw clean test -Dtest=MealAiDraftApiIT -q
```
Expected: PASS (Fake's explicit single-image override still catches `[fake-meal:...]`; Gemini's single-image calls now flow default → list).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/
git commit -m "feat(companion): multi-image CompanionLlm overload + fake photo sentinel (mezo-d8tr)"
```

---

### Task 4: Pantry wiring — switch, properties, messages, port, adapter

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/config/PantryPhotoProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PhotoExtractLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PantryPhotoLlmAdapter.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/resources/messages.properties`

**Interfaces:**
- Produces: `FeaturesConfiguration.PANTRY_PHOTO_SWITCH`; `PantryPhotoProperties(int maxPhotoBytes, List<String> allowedMimeTypes, double confidenceThreshold)`; `PhotoExtractLlm.complete(String, String, List<PhotoExtractLlm.Image>)` with nested `record Image(byte[] bytes, String mimeType)`.
- Consumes: `CompanionLlm.InlineImage` + list overload (Task 3).

- [ ] **Step 1: Feature-switch constant**

In `FeaturesConfiguration.java`, after `PANTRY_SCRAPE_SWITCH`:

```java
    /** Fuel photo import (mezo-d8tr) — nutrition-label photo -> LLM draft; independent of scrape. */
    public static final String PANTRY_PHOTO_SWITCH = "mezo.feature.pantry-photo.enabled";
```

- [ ] **Step 2: Properties record**

`PantryPhotoProperties.java`:

```java
package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-photo.*} — the label-photo import (mezo-d8tr): upload limits + the
 * confidence threshold at/below which a draft is flagged needs-review (boundary-inclusive,
 * same IEEE-754-motivated semantics as the scrape — see PantryScrapeService).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-photo")
public record PantryPhotoProperties(

    /** Hard cap per uploaded photo, in bytes (service-level, message-bearing check). */
    @Min(10_000) int maxPhotoBytes,

    /** Accepted photo MIME types (iOS converts HEIC to JPEG on file inputs). */
    @NotEmpty List<String> allowedMimeTypes,

    /** At/below this extraction confidence the draft lands as needs-review. */
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold
) {
}
```

- [ ] **Step 3: The pantry-owned LLM port**

`PhotoExtractLlm.java`:

```java
package io.mrkuhne.mezo.feature.pantry.service;

import java.util.List;

/**
 * Consumer-owned LLM port for the photo import (mezo-d8tr, ADR 0012). Pantry defines the seam it
 * needs; the companion feature provides the adapter ({@code PantryPhotoLlmAdapter}) delegating to
 * the real {@code CompanionLlm} multi-image overload — the only cross-feature dependency keeps
 * pointing companion → pantry (never pantry → companion), so the ArchUnit slice-cycle check stays
 * closed. The nested record mirrors {@code CompanionLlm.InlineImage} with pantry-owned types.
 */
public interface PhotoExtractLlm {

    /** An ephemeral inline image — bytes live only for the call, never stored. */
    record Image(byte[] bytes, String mimeType) {}

    /** One-shot multimodal completion on the cheap tier. */
    String complete(String systemPrompt, String userMessage, List<Image> images);
}
```

- [ ] **Step 4: The companion-side adapter**

`PantryPhotoLlmAdapter.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.pantry.service.PhotoExtractLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the pantry-owned {@link PhotoExtractLlm} port (mezo-d8tr, ADR 0012).
 * Companion off -> no CompanionLlm bean -> no adapter bean -> the photo endpoint degrades to a
 * clean 503 via ObjectProvider (same story as {@link PantryScrapeLlmAdapter}).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PantryPhotoLlmAdapter implements PhotoExtractLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage, List<Image> images) {
        return companionLlm.complete(systemPrompt, userMessage, images.stream()
            .map(i -> new CompanionLlm.InlineImage(i.bytes(), i.mimeType()))
            .toList());
    }
}
```

- [ ] **Step 5: `application.yml` — properties, switch, container cap**

a) Under `mezo:`, directly after the `pantry-scrape:` block:

```yaml
  pantry-photo:
    # Label-photo import (mezo-d8tr) — upload limits + needs-review threshold.
    max-photo-bytes: 5000000
    allowed-mime-types:
      - image/jpeg
      - image/png
      - image/webp
    confidence-threshold: 0.6
```

b) Under `mezo.feature:`, after the `pantry-scrape:` switch:

```yaml
    # Fuel photo import (mezo-d8tr) — label photo -> LLM draft; needs the companion switch too.
    pantry-photo:
      enabled: true
```

c) Raise the container request cap for the two-photo case (per-file cap stays):

```yaml
      max-file-size: 6MB
      max-request-size: 12MB
```
(change `max-request-size: 7MB` → `12MB`; extend the existing comment with: `# 12MB: the photo import (mezo-d8tr) sends up to TWO 5 MB photos in one request.`)

- [ ] **Step 6: Message keys**

Append to `backend/src/main/resources/messages.properties` (after the `MEAL_AI_*` block):

```properties
PANTRY_PHOTO_EXTRACT_FAILED=Reading the label photo failed, try again or add the item manually.
PANTRY_PHOTO_LLM_UNAVAILABLE=AI photo import is currently unavailable.
```

- [ ] **Step 7: Compile gate + commit**

```bash
cd backend && ./mvnw clean compile -q
git add backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/config/PantryPhotoProperties.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PhotoExtractLlm.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PantryPhotoLlmAdapter.java \
        backend/src/main/resources/application.yml backend/src/main/resources/messages.properties
git commit -m "feat(pantry): photo-import wiring — switch, properties, messages, PhotoExtractLlm port + adapter (mezo-d8tr)"
```

---

### Task 5: `PantryPhotoService` + controller + `PantryPhotoApiIT` (TDD)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryPhotoApiIT.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryPhotoService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/controller/PantryPhotoController.java`

**Interfaces:**
- Consumes: `PhotoExtractLlm`, `PantryPhotoProperties`, `ScrapeDraftValidator.confidence(ExtractedDraft)`, `ScrapeExtractionService.ExtractedDraft` (type only — the photo path must NOT depend on the scrape BEAN, which vanishes when the scrape switch is off), `FakeCompanionLlm.PHOTO_SENTINEL` (Task 3), multipart helpers `postMultipartForResponse`/`photoPart` from `ApiIntegrationTest`.
- Produces: `PantryPhotoService.extract(MultipartFile photo, MultipartFile photo2): PantryScrapeResponse`.

- [ ] **Step 1: Write the failing IT**

`PantryPhotoApiIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/**
 * HTTP-level suite for {@code POST /api/pantry-import/photo} (mezo-d8tr): real multipart plumbing
 * + {@code PantryPhotoController} → {@code PantryPhotoService} against the deterministic
 * {@code FakeCompanionLlm}. A "photo" is UTF-8 {@code [fake-photo:{json}]} sentinel bytes, so the
 * canned answer flows through decode → parse → validate → response without a model.
 *
 * <p>The photo cap is shrunk to the {@code @Min(10_000)} floor so the oversized test's 20 kB
 * payload trips the SERVICE cap while staying far under the container caps (mezo-78rn pattern).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.pantry-photo.max-photo-bytes=10000")
class PantryPhotoApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/pantry-import/photo";

    /** Flat draft JSON; Atwater-consistent: 4*10 + 4*4 + 9*0.2 = 57.8 ≈ kcal 62 → confidence 1.0. */
    private static final String DRAFT_JSON = "{\"name\":\"Skyr epres\",\"brand\":\"Milbona\","
            + "\"per\":100,\"unit\":\"g\",\"kcal\":62,\"proteinG\":10,\"carbsG\":4,\"fatG\":0.2,"
            + "\"fiberG\":null,\"sugarG\":3.9,\"saltG\":0.1,\"saturatedFatG\":0.1,"
            + "\"nova\":2,\"category\":\"dairy\",\"priceHuf\":null,\"priceUnit\":null}";

    private static HttpEntity<?> jpegPart(String content) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        return new HttpEntity<>(photoPart(content.getBytes(StandardCharsets.UTF_8), "label.jpg"), h);
    }

    @Test
    void testPhoto_shouldReturnDraft_whenLabelPhotoCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        var r = res.getBody().getResult();
        assertThat(r).isNotNull();
        assertThat(r.getName()).isEqualTo("Skyr epres");
        assertThat(r.getSource().getValue()).isEqualTo("photo");
        assertThat(r.getSourceUrl()).isNull();
        // mezo-y9ga made structural: per-100 g basis regardless of the model answer
        assertThat(r.getPer()).isEqualByComparingTo(BigDecimal.valueOf(100));
        assertThat(r.getUnit()).isEqualTo("g");
        assertThat(r.getConfidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(r.getNeedsReview()).isFalse();
    }

    @Test
    void testPhoto_shouldReturnDraft_whenSentinelIsOnSecondPhoto() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("just a blurry label"));
        parts.add("photo2", jpegPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getResult()).isNotNull(); // both images reached the LLM call
    }

    @Test
    void testPhoto_shouldReturnEmpty_whenNoNutritionFactsLegible() {
        String noFacts = DRAFT_JSON.replace("\"kcal\":62", "\"kcal\":null");
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + noFacts + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getResult()).isNull(); // honest empty
    }

    @Test
    void testPhoto_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        // kcal 200 vs Atwater 57.8 → >30% off → 1.0 - 0.4 = 0.6 == threshold → needs review
        String off = DRAFT_JSON.replace("\"kcal\":62", "\"kcal\":200");
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("[fake-photo:" + off + "]"));

        ResponseEntity<PantryScrapeResponse> res = postMultipartForResponse(PATH, parts, PantryScrapeResponse.class);

        assertThat(res.getBody().getResult().getNeedsReview()).isTrue();
    }

    @Test
    void testPhoto_should400_whenPhotoOversized() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("x".repeat(20_000))); // > the shrunk 10 kB cap

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should400_whenMimeUnsupported() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_GIF);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("gif".getBytes(StandardCharsets.UTF_8), "label.gif"), h));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should400_whenPhotoPartMissing() {
        var parts = new LinkedMultiValueMap<String, Object>();

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testPhoto_should502_whenAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", jpegPart("no sentinel here")); // fake echoes the prompt → parse fails

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "PANTRY_PHOTO_EXTRACT_FAILED");
    }
}
```

- [ ] **Step 2: Run it — must fail with 404s**

```bash
cd backend && ./mvnw clean test -Dtest=PantryPhotoApiIT -q
```
Expected: FAIL — every test gets 404 (no controller yet).

- [ ] **Step 3: Implement `PantryPhotoService`**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeResult;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.feature.pantry.config.PantryPhotoProperties;
import io.mrkuhne.mezo.feature.pantry.service.ScrapeExtractionService.ExtractedDraft;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Label-photo extraction (mezo-d8tr): validate upload → ONE multimodal LLM call → parse →
 * deterministic confidence. Stateless — the photos are ephemeral (multipart → memory → LLM →
 * dropped) and nothing persists until the user confirms via POST /api/pantry-import.
 *
 * <p>Reuses the scrape slice's {@link ExtractedDraft} TYPE and {@link ScrapeDraftValidator}, but
 * NOT the scrape beans — they vanish when the independent scrape switch is off. The draft basis is
 * hard-set to per-100 g / grams here (mezo-y9ga made structural), regardless of the model answer:
 * the prompt demands that basis and the numbers are validated by Atwater, so overriding per/unit
 * never silently rescales — it only pins the declared basis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_PHOTO_SWITCH, havingValue = "true")
public class PantryPhotoService {

    static final String SYSTEM_PROMPT = """
        You extract packaged-food data from photos of a product's nutrition label
        (and optionally the front of the package). Labels may be Hungarian or English.
        Answer with ONE JSON object and nothing else, using exactly these keys:
        {"name":string|null, "brand":string|null, "per":100, "unit":"g", "kcal":number|null,
         "proteinG":number|null, "carbsG":number|null, "fatG":number|null, "fiberG":number|null,
         "sugarG":number|null, "saltG":number|null, "saturatedFatG":number|null,
         "nova":1|2|3|4|null, "category":string|null, "priceHuf":null, "priceUnit":null}
        Rules:
        - ALL nutrition values MUST be on the per-100 g (or per-100 ml) basis. If the label only
          shows a per-serving column, convert to per-100 using the stated serving size.
        - NEVER invent a number. A value not legible on the photos is null.
        - If no nutrition table is legible at all, set kcal to null.
        - name: the product name; prefer the front-of-pack photo when present; null if not visible.
        - nova is YOUR classification estimate of the NOVA processing group (1-4).
        - category must be one of: vegetables, fruits, meat, fish, eggs, dairy, cheese, legumes,
          grains, pasta, bakery, nuts_seeds, oils_fats, condiments, snacks, beverages, supplement, other.
        - priceHuf and priceUnit are always null (labels carry no price).
        """;

    private final ObjectProvider<PhotoExtractLlm> llm;
    private final ScrapeDraftValidator validator;
    private final PantryPhotoProperties props;
    private final ObjectMapper objectMapper;

    public PantryScrapeResponse extract(MultipartFile photo, MultipartFile photo2) {
        PhotoExtractLlm port = requireAvailable();
        List<PhotoExtractLlm.Image> images = new ArrayList<>();
        images.add(toImage(photo)); // contract-required part
        if (photo2 != null && !photo2.isEmpty()) {
            images.add(toImage(photo2));
        }
        String answer = port.complete(SYSTEM_PROMPT, "", images);
        ExtractedDraft d = parse(answer);
        if (d.kcal() == null || d.name() == null || d.name().isBlank()) {
            return new PantryScrapeResponse(); // honest empty: no legible nutrition facts
        }
        double confidence = validator.confidence(d);
        PantryScrapeResult result = new PantryScrapeResult();
        result.setName(d.name().strip());
        result.setBrand(d.brand());
        result.setPer(BigDecimal.valueOf(100)); // mezo-y9ga: basis is ALWAYS per-100 g
        result.setUnit("g");
        result.setKcal(d.kcal());
        result.setProteinG(d.proteinG());
        result.setCarbsG(d.carbsG());
        result.setFatG(d.fatG());
        result.setFiberG(d.fiberG());
        result.setSugarG(d.sugarG());
        result.setSaltG(d.saltG());
        result.setSaturatedFatG(d.saturatedFatG());
        result.setNova(d.nova());
        result.setCategory(mapCategory(d.category()));
        result.setPriceHuf(null); // labels carry no price
        result.setPriceUnit(null);
        result.setSource(PantrySource.PHOTO);
        result.setSourceUrl(null);
        result.setConfidence(BigDecimal.valueOf(confidence));
        // Boundary-inclusive like the scrape (PantryScrapeService.java:72-75).
        result.setNeedsReview(confidence <= props.confidenceThreshold());
        PantryScrapeResponse resp = new PantryScrapeResponse();
        resp.setResult(result);
        return resp;
    }

    private PhotoExtractLlm requireAvailable() {
        PhotoExtractLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_PHOTO_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    /** Size/mime service-level checks (message-bearing 400s; the container caps are the safety net). */
    private PhotoExtractLlm.Image toImage(MultipartFile f) {
        if (f == null || f.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        if (f.getSize() > props.maxPhotoBytes()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        String mime = f.getContentType();
        if (mime == null || !props.allowedMimeTypes().contains(mime)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        try {
            return new PhotoExtractLlm.Image(f.getBytes(), mime);
        } catch (Exception e) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Same brace-window parse as the scrape, with photo-owned error semantics (502). */
    private ExtractedDraft parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, ExtractedDraft.class);
        } catch (Exception e) {
            log.warn("Photo extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_PHOTO_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    /** Unknown/typo category from the model degrades to null, never a 500 (mezo-w3o spirit). */
    private PantryScrapeResult.CategoryEnum mapCategory(String category) {
        return category == null ? null : PantryScrapeResult.CategoryEnum.fromValue(category);
    }
}
```

- [ ] **Step 4: Implement `PantryPhotoController`**

```java
package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryPhotoApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryPhotoService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Label-photo draft endpoint (mezo-d8tr). Switch off -> the whole path 404s. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_PHOTO_SWITCH, havingValue = "true")
public class PantryPhotoController implements PantryPhotoApi {

    private final PantryPhotoService photoService;

    @Override
    public PantryScrapeResponse photoExtractPantryItem(MultipartFile photo, MultipartFile photo2) {
        return photoService.extract(photo, photo2);
    }
}
```
(If the generated `PantryPhotoApi` method signature differs — check `backend/target/generated-sources` after `./mvnw generate-sources` — implement exactly the generated signature.)

- [ ] **Step 5: Run the IT — green**

```bash
cd backend && ./mvnw clean test -Dtest=PantryPhotoApiIT -q
```
Expected: PASS (8/8).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/ backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryPhotoApiIT.java
git commit -m "feat(pantry): photo-import endpoint — multimodal extraction + deterministic confidence (mezo-d8tr)"
```

---

### Task 6: Switch-state ITs — feature off (404) + companion off (503)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryPhotoDisabledApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryPhotoLlmUnavailableApiIT.java`

**Interfaces:**
- Consumes: Task 5's endpoint; `postMultipartForResponse`/`photoPart` helpers.

- [ ] **Step 1: Write both ITs**

`PantryPhotoDisabledApiIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/**
 * The pantry-photo switch OFF state (configuration_conventions.md: both switch states tested):
 * the {@code PantryPhotoController} bean disappears -> the photo path 404s; every other pantry
 * switch stays on (only the photo switch is flipped here).
 */
@TestPropertySource(properties = "mezo.feature.pantry-photo.enabled=false")
class PantryPhotoDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testPhoto_shouldReturn404_whenPhotoSwitchOff() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        var parts = new org.springframework.util.LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("x".getBytes(StandardCharsets.UTF_8), "label.jpg"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/pantry-import/photo", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

`PantryPhotoLlmUnavailableApiIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/** Photo on, companion off -> no CompanionLlm bean -> clean 503, never a 500 (mezo-d8tr). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PantryPhotoLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testPhoto_should503_whenCompanionSwitchOff() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        var parts = new org.springframework.util.LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("x".getBytes(StandardCharsets.UTF_8), "label.jpg"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/pantry-import/photo", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "PANTRY_PHOTO_LLM_UNAVAILABLE");
    }
}
```

- [ ] **Step 2: Run both — green**

```bash
cd backend && ./mvnw clean test -Dtest='PantryPhotoDisabledApiIT,PantryPhotoLlmUnavailableApiIT' -q
```
Expected: PASS (2/2).

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/pantry/
git commit -m "test(pantry): photo-import switch-off 404 + companion-off 503 ITs (mezo-d8tr)"
```

---

### Task 7: Confirm path — `origin=photo` → source `photo` (TDD)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java` (extend)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java:74-79`

**Interfaces:**
- Consumes: `PantryImportRequest.getOrigin()` (Task 1), the widened DB CHECK (Task 2).
- Produces: `pantry_item.source='photo'` + feed row `source='photo'` on an `origin=photo` confirm.

- [ ] **Step 1: Write the failing test**

Open `PantryImportApiIT.java`, mirror its existing happy-path import test's helper/assert style (same post helper, same repository lookups) and add:

```java
    @Test
    void testImport_shouldPersistPhotoSource_whenOriginPhoto() {
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Skyr epres");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(62));
        req.setOrigin("photo");
        req.setConfidence(BigDecimal.valueOf(0.95));

        postForBody("/api/pantry-import", req, ownerAuthHeaders(), HttpStatus.OK, PantryItemResponse.class);

        PantryItemEntity item = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId())
            .stream().filter(i -> i.getName().equals("Skyr epres")).findFirst().orElseThrow();
        assertThat(item.getSource()).isEqualTo("photo");
        assertThat(importRepository.findAll()).anyMatch(f ->
            "photo".equals(f.getSource()) && "Skyr epres".equals(f.getItemName()) && "synced".equals(f.getStatus()));
    }
```
(Align the exact status constant, repository field names, and `ownerId()` helper with the sibling tests already in this file — copy their idiom verbatim.)

- [ ] **Step 2: Run it — must fail**

```bash
cd backend && ./mvnw clean test -Dtest=PantryImportApiIT -q
```
Expected: FAIL — the new test's `item.getSource()` is `"openfoodfacts"` (origin ignored).

- [ ] **Step 3: Implement the third derivation arm**

In `PantryImportService.importItem`, REPLACE:

```java
        // A scraped draft carries its origin URL -> derive the source from the URL host (never the
        // client); a plain OFF/manual confirm has no sourceUrl and stays 'openfoodfacts'.
        String source = req.getSourceUrl() == null
            ? SOURCE_OPENFOODFACTS
            : PantryScrapeService.sourceFor(req.getSourceUrl());
```

with:

```java
        // Three-armed source derivation: a scraped draft carries its origin URL -> derive from the
        // URL host (never the client); a photo draft carries the origin marker (mezo-d8tr) -> the
        // 'photo' provenance; a plain OFF confirm has neither and stays 'openfoodfacts'.
        String source = req.getSourceUrl() != null
            ? PantryScrapeService.sourceFor(req.getSourceUrl())
            : "photo".equals(req.getOrigin()) ? SOURCE_PHOTO : SOURCE_OPENFOODFACTS;
```

and add next to `SOURCE_OPENFOODFACTS`:

```java
    private static final String SOURCE_PHOTO = "photo";
```

- [ ] **Step 4: Run — green (whole class, no regression)**

```bash
cd backend && ./mvnw clean test -Dtest=PantryImportApiIT -q
```
Expected: PASS (all tests, old + new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java
git commit -m "feat(pantry): origin=photo confirm arm — photo provenance on item + feed (mezo-d8tr)"
```

---

### Task 8: FE data layer — types, source badge, `photoExtract`, mock draft

**Files:**
- Modify: `frontend/src/data/pantrySources.ts`
- Modify: `frontend/src/data/types.ts` (`PantryScrapeDraft`, `PantryImportInput`)
- Modify: `frontend/src/data/fuel/pantryApi.ts` (`photoExtract` + `toImportRequest`)
- Modify: `frontend/src/data/fuel/pantry.ts` (`MOCK_PHOTO_DRAFT`)
- Modify: `frontend/src/data/fuel/pantryHooks.ts` (`usePantryActions`)
- Test: `frontend/src/data/fuel/pantryApi.test.ts`, `frontend/src/data/fuel/pantryHooks.test.tsx` (extend)

**Interfaces:**
- Produces: `usePantryActions().photoExtract(photo: File, photo2?: File): Promise<PantryScrapeDraft | null>`; `MOCK_PHOTO_DRAFT: PantryScrapeDraft`; `PantryImportInput.origin?: 'photo' | null`. Task 9 consumes all three.

- [ ] **Step 1: `pantrySources.ts` — the `photo` source**

Add to the `PantrySourceKey` union: `| 'photo'`, and to the map (after `openfoodfacts`):

```ts
  'photo':        { label: 'Fotó',          color: '#F97316', short: 'F' },
```

- [ ] **Step 2: `types.ts` — nullable `sourceUrl` + `origin` marker**

In `PantryScrapeDraft` change `sourceUrl: string` → `sourceUrl: string | null`.
In `PantryImportInput` add after `confidence`:

```ts
  origin?: 'photo' | null // mezo-d8tr: photo-draft confirms carry the provenance marker (no URL)
```

- [ ] **Step 3: `pantryApi.ts` — multipart extract + origin passthrough**

a) In `toImportRequest`, add `origin: input.origin,` right after `sourceUrl: input.sourceUrl, confidence: input.confidence,`.

b) Add to the `pantryApi` object after `scrape`:

```ts
  // Photo import (mezo-d8tr): label photo(s) → extracted draft; photos ephemeral server-side.
  // FormData: the browser sets the multipart boundary (apiFetch omits its JSON Content-Type).
  photoExtract: (photo: File, photo2?: File): Promise<PantryScrapeDraft | null> => {
    const form = new FormData()
    form.append('photo', photo, photo.name || 'label.jpg')
    if (photo2) form.append('photo2', photo2, photo2.name || 'front.jpg')
    return apiFetch<PantryScrapeResponse>('/api/pantry-import/photo', { method: 'POST', body: form })
      .then(r => (r.result ? fromScrapeResult(r.result) : null))
  },
```

- [ ] **Step 4: `pantry.ts` — the mock draft**

After `MOCK_SCRAPE_DRAFT`:

```ts
// === Mock photo-import draft (mezo-d8tr) — what the demo Fotó-mode "reads" off a label ===
export const MOCK_PHOTO_DRAFT: PantryScrapeDraft = {
  name: 'Skyr · epres', brand: 'Milbona', per: 100, unit: 'g',
  kcal: 62, proteinG: 10, carbsG: 4, fatG: 0.2, fiberG: null, sugarG: 3.9, saltG: 0.1,
  saturatedFatG: 0.1, nova: 2, category: 'dairy', priceHuf: null, priceUnit: null,
  source: 'photo', sourceUrl: null, confidence: 1, needsReview: false, barcode: null,
}
```

- [ ] **Step 5: `pantryHooks.ts` — the action**

Import `MOCK_PHOTO_DRAFT` next to the existing `MOCK_SCRAPE_DRAFT` import. After the `scrapeItem` callback:

```ts
  // Photo import (mezo-d8tr) — ephemeral read like scrapeItem; mock serves the canned draft.
  const photoExtract = useCallback(
    (photo: File, photo2?: File): Promise<PantryScrapeDraft | null> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(MOCK_PHOTO_DRAFT), 600))
        : pantryApi.photoExtract(photo, photo2),
    [mock],
  )
```
and add `photoExtract` to the returned object: `return { addItem, updateItem, deleteItem, importItem, lookupItems, scrapeItem, photoExtract }`.

- [ ] **Step 6: Tests**

a) `pantryApi.test.ts` — mirror the existing `scrape` test's fetch-stub idiom and add:

```ts
test('photoExtract POSTs multipart and maps the result draft', async () => {
  // stub apiFetch/fetch exactly like the existing scrape test does, resolving:
  // { result: { ...minimal PantryScrapeResult with source: 'photo', sourceUrl: null } }
  const draft = await pantryApi.photoExtract(new File(['x'], 'label.jpg', { type: 'image/jpeg' }))
  expect(draft?.source).toBe('photo')
  expect(draft?.sourceUrl).toBeNull()
})

test('toImportRequest carries the origin marker', () => {
  // exercised through importItem's body — assert the serialized body contains "origin":"photo"
})
```
(Copy the file's existing stub helpers verbatim — same `vi.stubGlobal`/mock-fetch idiom the `scrape`/`importItem` tests use; assert on the same seams they assert on.)

b) `pantryHooks.test.tsx` — mirror the existing `scrapeItem` mock-mode test:

```tsx
test('photoExtract serves the canned mock draft in mock mode', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => usePantryActions(), { wrapper: wrapper() })
  const p = result.current.photoExtract(new File(['x'], 'label.jpg', { type: 'image/jpeg' }))
  await act(async () => { vi.advanceTimersByTime(700) })
  await expect(p).resolves.toEqual(MOCK_PHOTO_DRAFT)
  vi.useRealTimers()
})
```
(Match the file's existing renderHook `wrapper()` helper + fake-timer idiom exactly.)

- [ ] **Step 7: Run both FE modes**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/
git commit -m "feat(fuel): photo-import data layer — photoExtract action, photo source, mock draft (mezo-d8tr)"
```

---

### Task 9: FE — `ImportItemSheet` third mode "Fotó"

**Files:**
- Modify: `frontend/src/features/fuel/sheets/ImportItemSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx` (extend + adjust one existing test)

**Interfaces:**
- Consumes: `usePantryActions().photoExtract`, `MOCK_PHOTO_DRAFT` (Task 8); the existing Link-mode preview JSX.

- [ ] **Step 1: State + mode plumbing**

In `ImportItemSheet.tsx`:

a) `type Mode = 'search' | 'link'` → `type Mode = 'search' | 'link' | 'photo'`.

b) Destructure the new action: `const { lookupItems, importItem, scrapeItem, photoExtract } = usePantryActions()`.

c) New state next to `url` (also change the react import to `import { useState, type ChangeEvent } from 'react'` — the file currently imports only `useState`):

```tsx
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoFile2, setPhotoFile2] = useState<File | null>(null)
```

d) New extraction fn next to `scan` (5 MB client pre-check fails fast; the server re-checks):

```tsx
  const MAX_PHOTO_BYTES = 5_000_000

  const extractPhotos = async (second?: File | null) => {
    if (!photoFile) return
    const p2 = second !== undefined ? second : photoFile2
    setPhase('searching')
    setError(null)
    try {
      const found = await photoExtract(photoFile, p2 ?? undefined)
      setDraft(found)
      setName(found?.name ?? '')
      setCategory(found?.category ?? 'other')
      setPhase('preview')
    } catch {
      setError('A fotó beolvasása nem sikerült — próbáld élesebb képpel, vagy vidd fel kézzel.')
      setPhase('input')
    }
  }

  const pickPhoto = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_PHOTO_BYTES) {
      setError('A kép túl nagy (JPEG/PNG/WebP, max 5 MB).')
      return
    }
    setError(null)
    setter(f)
  }
```

e) `saveDraft` — the confirm carries the provenance marker:

```tsx
      await importItem({
        ...draft,
        name: name.trim() || draft.name,
        category,
        sourceUrl: draft.sourceUrl,
        confidence: draft.confidence,
        priceHuf: draft.priceHuf,
        priceUnit: draft.priceUnit,
        origin: mode === 'photo' ? 'photo' : undefined,
      })
```

- [ ] **Step 2: Mode toggle + input phase JSX**

a) In the mode-toggle row add a third chip after the Link chip (copy the Link chip's exact style expression, swapping the mode literal and label):

```tsx
            <button
              className="chip"
              aria-pressed={mode === 'photo'}
              onClick={() => switchMode('photo')}
              style={{
                flex: 1, justifyContent: 'center', fontSize: 11, padding: '8px 0',
                background: mode === 'photo' ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'transparent',
                borderColor: mode === 'photo' ? 'var(--line)' : 'var(--border-subtle)',
                color: mode === 'photo' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              Fotó
            </button>
```

b) New input-phase block after the `phase === 'input' && mode === 'link'` block:

```tsx
          {phase === 'input' && mode === 'photo' && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <label className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Címke fotó
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Címke fotó"
                    onChange={pickPhoto(setPhotoFile)}
                    style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6, width: '100%' }}
                  />
                </label>
                {photoFile && (
                  <span className="text-secondary" style={{ fontSize: 11 }}>✓ {photoFile.name}</span>
                )}
              </div>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <label className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Előlap fotó (opcionális — ha a név nem látszik a címkén)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Előlap fotó"
                    onChange={pickPhoto(setPhotoFile2)}
                    style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6, width: '100%' }}
                  />
                </label>
                {photoFile2 && (
                  <span className="text-secondary" style={{ fontSize: 11 }}>✓ {photoFile2.name}</span>
                )}
              </div>

              {error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginBottom: 10 }}>{error}</p>
              )}

              <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 14 }}>
                Fotózd le a termék tápérték-táblázatát — az AI kiolvassa a makrókat /100 g bázison.
                A fotó nem kerül tárolásra.
              </p>

              <div className="row gap-sm">
                <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
                <button
                  className="cta-primary flex-1"
                  onClick={() => void extractPhotos()}
                  disabled={!photoFile}
                >
                  <Icon name="sparkle" size={14} /> Beolvasás
                </button>
              </div>
            </>
          )}
```

- [ ] **Step 3: Searching badge + shared preview**

a) Searching-phase `SourceBadge` source expression → handle the third mode:

```tsx
<SourceBadge source={mode === 'link' ? (draft?.source ?? 'web') : mode === 'photo' ? 'photo' : 'openfoodfacts'} size="lg" />
```

b) Reuse the Link preview for photo: change the condition
`{phase === 'preview' && mode === 'link' && (` → `{phase === 'preview' && (mode === 'link' || mode === 'photo') && (`.

c) Inside that block's null-draft card, make the copy mode-aware:

```tsx
                  <span className="text-secondary" style={{ fontSize: 12 }}>
                    {mode === 'photo'
                      ? 'Nem találtam tápértéket a fotón — próbáld élesebb/közelebbi képpel, vagy vidd fel kézzel.'
                      : 'Ezen az oldalon nem találtam tápértéket — vidd fel kézzel a Kamrában.'}
                  </span>
```

d) In the same block, after the `needsReview` warning paragraph, add the photo re-extract affordance:

```tsx
                  {mode === 'photo' && !photoFile2 && (!name.trim() || draft.needsReview) && (
                    <label className="chip" style={{ marginTop: 10, fontSize: 10, padding: '6px 10px', cursor: 'pointer' }}>
                      <Icon name="camera" size={11} /> + előlap fotó (név/márka)
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        aria-label="Előlap fotó hozzáadása"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          if (!f) return
                          setPhotoFile2(f)
                          void extractPhotos(f) // re-extract with BOTH images
                        }}
                      />
                    </label>
                  )}
```

e) Remove the inert "Címke fotó" chip from the HAMAROSAN card (search-mode input phase) — delete the whole `<button className="chip" disabled ...>Címke fotó</button>` element; the barcode + dictation chips stay.

- [ ] **Step 4: Tests**

In `ImportItemSheet.test.tsx`:

a) FIX the existing inert-chips test — the "Címke fotó" chip is gone; replace the assertion
`expect(screen.getByRole('button', { name: /Címke fotó/ })).toBeDisabled()` with:

```tsx
  expect(screen.queryByRole('button', { name: /Címke fotó/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Vonalkód-szkenner/ })).toBeDisabled()
```

b) Extend the `hoisted` override block with a `photo` slot (mirror the `scrape` slot):

```tsx
const hoisted = vi.hoisted(() => ({
  scrape: null as null | ((url: string) => Promise<PantryScrapeDraft | null>),
  photo: null as null | ((p: File, p2?: File) => Promise<PantryScrapeDraft | null>),
}))
```
and in the `usePantryActions` mock return:

```tsx
      return {
        ...real,
        ...(hoisted.scrape ? { scrapeItem: hoisted.scrape } : {}),
        ...(hoisted.photo ? { photoExtract: hoisted.photo } : {}),
      }
```
(also reset `hoisted.photo = null` in the existing `afterEach`).

c) New tests (fake-timer + fireEvent idiom, exactly like the Link tests):

```tsx
test('photo mode: selecting a label photo enables Beolvasás and lands on the shared preview', async () => {
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Fotó' }))
  expect(screen.getByRole('button', { name: /Beolvasás/ })).toBeDisabled()

  const file = new File(['x'], 'label.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Címke fotó'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  await act(async () => { vi.advanceTimersByTime(700) }) // mock photoExtract demo delay
  expect(screen.getByDisplayValue('Skyr · epres')).toBeInTheDocument() // MOCK_PHOTO_DRAFT preview
  vi.useRealTimers()
})

test('photo mode: confirm passes the origin marker to importItem', async () => {
  vi.useFakeTimers()
  const importSpy = vi.fn().mockResolvedValue(undefined)
  hoisted.photo = () => Promise.resolve(MOCK_PHOTO_DRAFT)
  // reuse the hoisted override idiom for importItem as well:
  // add an `importItem` slot to `hoisted` exactly like `photo` above, set it to importSpy here.
  hoisted.importItem = importSpy

  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })
  fireEvent.click(screen.getByRole('button', { name: 'Fotó' }))
  fireEvent.change(screen.getByLabelText('Címke fotó'),
    { target: { files: [new File(['x'], 'label.jpg', { type: 'image/jpeg' })] } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))
  await act(async () => { await vi.runAllTimersAsync() })

  fireEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  await act(async () => { await vi.runAllTimersAsync() })

  expect(importSpy).toHaveBeenCalledWith(expect.objectContaining({ origin: 'photo', source: 'photo' }))
  vi.useRealTimers()
})
```
(For the second test, add the `importItem` slot to `hoisted` + the mock-return spread + `afterEach` reset, exactly like the `photo` slot in step b. Import `MOCK_PHOTO_DRAFT` at the top next to `MOCK_SCRAPE_DRAFT`.)

- [ ] **Step 5: Run both FE modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build clean; PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/sheets/
git commit -m "feat(fuel): Fotó import mode — label photo(s) to AI draft in ImportItemSheet (mezo-d8tr)"
```

---

### Task 10: Docs, gates, PR

**Files:**
- Modify: `docs/features/fuel.md` (§2 walkthrough sentence, §4 endpoint row, §9 gotcha, §10 key files)

- [ ] **Step 1: Update `docs/features/fuel.md`**

- §2 (Kamra/import behavior): extend the import-modes sentence with the third mode — "…and since mezo-d8tr a **Fotó** mode: photograph the nutrition label (+ optional front-of-pack), `POST /api/pantry-import/photo` extracts a per-100 g draft (photos ephemeral, never stored), confirmed down the same `POST /api/pantry-import` path with `origin=photo`."
- §4: add the endpoint to the API table: `POST /api/pantry-import/photo` → multipart photo(+photo2) → `PantryScrapeResponse` (result null = no legible facts); `PantrySource` gains `photo`; `PantryImportRequest` gains `origin`.
- §9: one new bullet — photo import decisions: reused scrape draft shape + validator; per-100 g/g basis hard-set server-side (mezo-y9ga structural); `PhotoExtractLlm` consumer-owned port (ADR 0012) + multi-image `CompanionLlm` overload; switch `mezo.feature.pantry-photo.enabled` (off → 404; companion off → 503); container `max-request-size` raised to 12 MB for the two-photo case.
- §10: add the new key files (`PantryPhotoService.java`, `PantryPhotoController.java`, `PhotoExtractLlm.java`, `PantryPhotoLlmAdapter.java`, `PantryPhotoProperties.java`, the migration, `ImportItemSheet.tsx`).

- [ ] **Step 2: Lint docs + liquibase**

```bash
node scripts/lint-docs.mjs --errors-only
node scripts/lint-liquibase.mjs
```
Expected: both PASS.

- [ ] **Step 3: Focused backend re-run + FE both modes (local gate)**

```bash
cd backend && ./mvnw clean test -Dtest='PantryPhoto*IT,PantryImportApiIT,PantryScrapeApiIT,MealAiDraftApiIT' -q
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green (CI runs the full suite — the self-PR is the authoritative gate).

- [ ] **Step 4: Commit docs, push, PR**

```bash
git add docs/features/fuel.md
git commit -m "docs(fuel): photo-import feature docs (mezo-d8tr)"
git push -u origin feat/pantry-photo-import
gh pr create --title "feat(fuel): pantry photo import — nutrition-label photo to AI draft (mezo-d8tr)" \
  --body "Spec: docs/superpowers/specs/2026-07-23-pantry-photo-import-design.md · Plan: docs/superpowers/plans/2026-07-23-pantry-photo-import.md. Self-PR = CI gate."
```
Wait for CI green, then merge per the house flow (`git checkout main && git pull --rebase && git merge --no-ff feat/pantry-photo-import && git push`, delete the branch, `bd close mezo-d8tr`).
