# Fuel — Kamra URL-import (LLM scrape) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste any product URL (myprotein.hu, gymbeam.hu, kifli.hu, …) into the Kamra import sheet and get a confirmed, LLM-extracted pantry draft (name, serving, kcal, macros, fiber/sugar/salt/satfat, category, NOVA, price) through the existing P6 confirm path.

**Architecture:** New `POST /api/pantry-import/scrape` under the existing `PantryImport` tag: `WebPageClient` (RestClient, OffClient pattern) fetches the page → `HtmlNutritionStripper` (jsoup) reduces it to visible text + flattened tables → `ScrapeExtractionService` makes ONE `CompanionLlm.complete()` call (cheap Gemini tier, strict JSON) → deterministic validation (Atwater + clamps) computes `confidence`/`needsReview` → draft returned, nothing persisted. Confirm reuses `POST /api/pantry-import` (extended with `sourceUrl` + `confidence`; low confidence → feed `status: manual-review`).

**Tech Stack:** Spring Boot 4 / Java 21, generated OpenAPI server types, jsoup (NEW dependency), WireMock + `FakeCompanionLlm` in ITs, React 19 + TanStack Query dual-mode FE.

**Spec:** `docs/superpowers/specs/2026-07-18-fuel-url-scrape-import-design.md` · **bd:** `mezo-8vum`

## Global Constraints

- Contract-first: edit `api/feature/pantry/pantry.yml` BEFORE any code; regenerate before compiling (`api_contract_conventions.md`).
- Backend refs are binding: `spring_patterns.md`, `error_handling.md` (`SystemRuntimeErrorException` + `SystemMessage` + `messages.properties`), `liquibase_conventions.md`, `testing_standards.md` (`test{Method}_should{Result}_when{Condition}`, AssertJ only), `integration_test_framework.md` (extend `ApiIntegrationTest`, no mocks/H2), `configuration_conventions.md` (never `@Value`).
- FE refs are binding: `frontend_conventions.md` — hooks only from `@/data/hooks`, no new barrels, deep `@/*` imports, tests colocated.
- Maven: ALWAYS `./mvnw clean test …` (incremental Lombok/MapStruct is flaky). Local backend runs need `docker compose up -d` (fixed `mezo_test` DB). Run FOCUSED tests locally (16 GB box); the full suite is CI's job via the self-PR.
- FE gate per task that touches `frontend/`: `pnpm test` AND `VITE_USE_MOCK=true pnpm test` (both green) + `pnpm build` at the end.
- Commits: conventional subject carrying `(mezo-8vum)`. **In this worktree use `git -c core.hooksPath=/dev/null commit`** — the bd pre-commit hook needs the main checkout's `.dolt` and pollutes worktree commits.
- Source enum lockstep rule (mezo-w3o): ANY new `source` value lands in the SAME commit in: all `pantry.yml` enum sites, both DB CHECK constraints, and `frontend/src/data/pantrySources.ts`.
- New source values: `gymbeam.hu`, `web`. New switch: `mezo.feature.pantry-scrape.enabled`. New error codes: `PANTRY_SCRAPE_FETCH_FAILED`, `PANTRY_SCRAPE_EXTRACT_FAILED`, `PANTRY_SCRAPE_LLM_UNAVAILABLE`.

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the feature branch** (from the worktree HEAD, which already carries the spec):

```bash
git checkout -b feat/fuel-url-scrape-import
```

---

### Task 1: Contract — scrape endpoint + widened source enums

**Files:**
- Modify: `api/feature/pantry/pantry.yml`
- Generated (do not hand-edit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `PantryScrapeApi.scrapePantryItem(PantryScrapeRequest)` server interface (OWN tag → own controller can be switch-gated independently of `PantryImportApi`); generated DTOs `PantryScrapeRequest { url }`, `PantryScrapeResponse { result: PantryScrapeResult|null }`, `PantryScrapeResult` (lookup-result fields + `category?`, `priceHuf?`, `priceUnit?`, `source`, `sourceUrl`, `confidence`, `needsReview`); `PantryImportRequest` gains `sourceUrl?`, `confidence?`, `priceHuf?`, `priceUnit?`.

- [ ] **Step 1: Edit `api/feature/pantry/pantry.yml`.** Add after the `/api/pantry-import` path block:

```yaml
  /api/pantry-import/scrape:
    post:
      tags: [PantryScrape]
      operationId: scrapePantryItem
      summary: LLM-extract a pantry draft from any product-page URL (mezo-8vum) — nothing is persisted
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/PantryScrapeRequest' } } }
      responses:
        '200': { description: Draft extracted (result null when the page carries no nutrition facts), content: { application/json: { schema: { $ref: '#/components/schemas/PantryScrapeResponse' } } } }
        '400': { description: Validation error (bad/missing/non-http URL), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '502': { description: Page unreachable or LLM extraction failed, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '503': { description: LLM port unavailable (companion off), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

Add to `components.schemas` (next to `PantryLookupResult`):

```yaml
    PantryScrapeRequest:
      type: object
      required: [url]
      properties:
        url: { type: string, minLength: 12, maxLength: 2000 }
    PantryScrapeResponse:
      type: object
      properties:
        result: { allOf: [ { $ref: '#/components/schemas/PantryScrapeResult' } ], nullable: true }
    PantryScrapeResult:
      type: object
      required: [name, per, unit, kcal, source, sourceUrl, confidence, needsReview]
      properties:
        name: { type: string }
        brand: { type: string, nullable: true }
        per: { type: number }
        unit: { type: string }
        kcal: { type: number }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
        fiberG: { type: number, nullable: true }
        sugarG: { type: number, nullable: true }
        saltG: { type: number, nullable: true }
        saturatedFatG: { type: number, nullable: true }
        nova: { type: integer, minimum: 1, maximum: 4, nullable: true }
        category: { type: string, nullable: true, enum: [vegetables, fruits, meat, fish, eggs, dairy, cheese, legumes, grains, pasta, bakery, nuts_seeds, oils_fats, condiments, snacks, beverages, supplement, other] }
        priceHuf: { type: integer, nullable: true }
        priceUnit: { type: string, nullable: true }
        source: { $ref: '#/components/schemas/PantrySource' }
        sourceUrl: { type: string }
        confidence: { type: number, minimum: 0, maximum: 1 }
        needsReview: { type: boolean }
```

- [ ] **Step 2: Deduplicate the source enum.** The enum is currently inlined in 5 places (`IngredientResponse.source`, `SupplementStashResponse.source`, `PantryItemRequest.source`, `PantryImportEntryResponse.source` ×2 area — grep `enum: [kifli.hu` to find all). Add ONE named schema and point every site at it:

```yaml
    PantrySource:
      type: string
      enum: [kifli.hu, myprotein.hu, tesco.hu, auchan.hu, gymbeam.hu, web, manual, lidl, nutriversum, herbahaz, nutrifit, decathlon, openfoodfacts]
```

Replace each inline `source: { type: string, enum: [...] }` with `source: { $ref: '#/components/schemas/PantrySource' }` (keep `nullable: true` via `allOf` where it was nullable: `source: { allOf: [ { $ref: '#/components/schemas/PantrySource' } ], nullable: true }`).

- [ ] **Step 3: Extend `PantryImportRequest`** with four optional fields (`priceHuf`/`priceUnit` so the scrape enrichment survives the confirm hop — the suggestion engine needs them):

```yaml
        sourceUrl: { type: string, nullable: true, maxLength: 2000 }
        confidence: { type: number, minimum: 0, maximum: 1, nullable: true }
        priceHuf: { type: integer, nullable: true }
        priceUnit: { type: string, nullable: true }
```

- [ ] **Step 4: Merge + regenerate both sides:**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw clean generate-sources -q
```

Expected: merge writes `api/openapi.yml`; backend generates `PantryScrapeRequest/Response/Result` + a NEW `PantryScrapeApi` interface (own tag). Nothing implements it yet — an unimplemented generated interface compiles fine, so `./mvnw clean generate-sources` (and later compiles) stay green.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): pantry scrape contract — POST /api/pantry-import/scrape + PantrySource schema (mezo-8vum)"
```

---

### Task 2: DB migration — widened source CHECKs + `pantry_import.source_url`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607181100_mezo-8vum_pantry_scrape.sql`
- Modify: the changelog registry the previous scripts use — mirror `202607051415_mezo-bka_pantry_import.sql`'s include entry (open `backend/src/main/resources/db/changelog/` and copy the registration pattern of the newest script exactly)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryImportEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java` (assert extended in Task 6; here compile-only)

**Interfaces:**
- Produces: `PantryImportEntity.getSourceUrl()/setSourceUrl(String)`; DB accepts `source` values `gymbeam.hu`/`web` on both tables.

- [ ] **Step 1: Write the changeset** (immutable once merged — never edit released ones):

```sql
--liquibase formatted sql
--changeset mezo:202607181100_mezo-8vum_pantry_scrape

-- mezo-8vum: URL-scrape import — widen the source allow-list (gymbeam.hu, web) on both
-- tables (mezo-w3o lockstep with pantry.yml PantrySource + FE pantrySources.ts) and add
-- provenance for scraped drafts.
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','gymbeam.hu','web',
                      'manual','lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts'));

alter table pantry_import drop constraint ck_pantry_import_source;
alter table pantry_import add  constraint ck_pantry_import_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','gymbeam.hu','web',
                      'manual','lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts'));

alter table pantry_import add column source_url text;
```

(Check the P6 script `202607051415_mezo-bka_pantry_import.sql` first: copy its exact `--changeset` author/id header style and its CHECK value list — if the current list differs from the above, take the CURRENT list and only append the two new values.)

- [ ] **Step 2: Register the script** in the changelog index exactly like the newest existing script is registered.

- [ ] **Step 3: Extend the entity** — add to `PantryImportEntity` after `barcode`:

```java
    /** Scrape provenance (mezo-8vum): the product-page URL the draft came from. Null for OFF/manual. */
    @Size(max = 2000)
    @Column(name = "source_url", length = 2000)
    private String sourceUrl;
```

(Postgres `text` has no length; the bean-level `@Size` mirrors the contract's `maxLength: 2000` — follow how other `text`-backed fields in this entity/neighbors annotate, and drop `length` from `@Column` if the P6 entity omits it for `text` columns.)

- [ ] **Step 4: Verify the migration applies** (compose must be up):

```bash
cd backend && ./mvnw clean test -Dtest=PantryItemRepositoryIT -DargLine=-Xmx3g
```

Expected: Liquibase applies `202607181100_mezo-8vum_pantry_scrape` and the IT passes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryImportEntity.java
git -c core.hooksPath=/dev/null commit -m "feat(db): widen pantry source CHECKs + pantry_import.source_url (mezo-8vum)"
```

---

### Task 3: Switch, properties, error codes + controller stub (compile-green point)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/config/PantryScrapeProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/controller/PantryImportController.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryScrapeDisabledApiIT.java`

**Interfaces:**
- Produces: `FeaturesConfiguration.PANTRY_SCRAPE_SWITCH` = `"mezo.feature.pantry-scrape.enabled"`; `PantryScrapeProperties(timeoutMs, maxBodyBytes, userAgent, acceptLanguage, confidenceThreshold, allowPrivateHosts)`; message codes `PANTRY_SCRAPE_FETCH_FAILED`, `PANTRY_SCRAPE_EXTRACT_FAILED`, `PANTRY_SCRAPE_LLM_UNAVAILABLE`.

- [ ] **Step 1: Switch constant** in `FeaturesConfiguration` (after `PANTRY_IMPORT_SWITCH`):

```java
    /** Fuel URL-scrape import (mezo-8vum) — LLM extraction; independent of pantry-import (OFF). */
    public static final String PANTRY_SCRAPE_SWITCH = "mezo.feature.pantry-scrape.enabled";
```

- [ ] **Step 2: Properties record:**

```java
package io.mrkuhne.mezo.feature.pantry.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.pantry-scrape.*} — the URL-scrape import (mezo-8vum): outbound page fetch
 * limits + the confidence threshold below which a confirmed import lands as manual-review.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.pantry-scrape")
public record PantryScrapeProperties(

    /** Connect + read timeout for the product-page fetch, in milliseconds. */
    @Min(100) @Max(30_000) int timeoutMs,

    /** Hard cap on the downloaded HTML size, in bytes (oversize -> fetch-failed). */
    @Min(10_000) @Max(10_000_000) int maxBodyBytes,

    /** Browser-like User-Agent (some shops 403 obvious bots). */
    @NotBlank String userAgent,

    /** Accept-Language header — Hungarian shops render HU nutrition tables. */
    @NotBlank String acceptLanguage,

    /** Below this extraction confidence the confirmed import's feed status is manual-review. */
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold,

    /** SSRF guard escape hatch for ITs (WireMock is loopback). NEVER true outside tests. */
    boolean allowPrivateHosts
) {
}
```

(Register it the same way `PantryImportProperties` is registered — grep `PantryImportProperties.class` for an `@EnableConfigurationProperties`/scan site and mirror it.)

- [ ] **Step 3: `application.yml`** — under `mezo:` next to `pantry-import:`:

```yaml
  pantry-scrape:
    # URL-scrape import (mezo-8vum) — outbound product-page fetch + LLM extraction limits.
    timeout-ms: 8000
    max-body-bytes: 2000000
    user-agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    accept-language: "hu,en;q=0.8"
    confidence-threshold: 0.6
    allow-private-hosts: false
```

and under `mezo.feature:` next to `pantry-import:`:

```yaml
    # Fuel URL-scrape import (mezo-8vum) — LLM extraction from product pages; needs the
    # companion switch too (CompanionLlm bean), otherwise the endpoint answers 503.
    pantry-scrape:
      enabled: true
```

- [ ] **Step 4: `messages.properties`** (next to `PANTRY_IMPORT_LOOKUP_FAILED`):

```properties
PANTRY_SCRAPE_FETCH_FAILED=The product page could not be loaded, check the link or try again later.
PANTRY_SCRAPE_EXTRACT_FAILED=Reading the product data failed, try again or add the item manually.
PANTRY_SCRAPE_LLM_UNAVAILABLE=AI import is currently unavailable.
```

- [ ] **Step 5: Create `PantryScrapeController`** — its OWN controller on the generated `PantryScrapeApi` (own tag = own bean = clean `@ConditionalOnProperty` gating, independent of `PantryImportController`). Until Task 6 delivers the service, the method throws the unavailable error so the build is green:

```java
package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryScrapeApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** URL-scrape draft endpoint (mezo-8vum). Switch off -> the whole path 404s. */
@RestController
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeController implements PantryScrapeApi {

    @Override
    public PantryScrapeResponse scrapePantryItem(PantryScrapeRequest req) {
        // Task 6 replaces this with the injected PantryScrapeService call.
        throw new SystemRuntimeErrorException(
            SystemMessage.error("PANTRY_SCRAPE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
    }
}
```

- [ ] **Step 6: Write the failing disabled-IT** — mirror `PantryImportDisabledApiIT` exactly (open it, copy its class-level annotations/property override mechanism), asserting the scrape path 404s when `mezo.feature.pantry-scrape.enabled=false`:

```java
class PantryScrapeDisabledApiIT extends ApiIntegrationTest {
    // copy PantryImportDisabledApiIT's switch-off mechanism, targeting PANTRY_SCRAPE_SWITCH

    @Test
    void testScrape_should404_whenScrapeSwitchOff() {
        var body = new PantryScrapeRequest();
        body.setUrl("https://www.myprotein.hu/p/impact-whey/10530943/");
        ResponseEntity<String> resp = exchangeForResponse(
            "/api/pantry-import/scrape", HttpMethod.POST, body, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

(Adjust the `exchangeForResponse` call to the actual helper signature in `ApiIntegrationTest.java:108`.)

- [ ] **Step 7: Run:**

```bash
cd backend && ./mvnw clean test -Dtest='PantryScrapeDisabledApiIT,PantryImportApiIT' -DargLine=-Xmx3g
```

Expected: disabled-IT PASS (404 with switch off), import ITs PASS untouched.

- [ ] **Step 8: Commit**

```bash
git add backend/src api/
git -c core.hooksPath=/dev/null commit -m "feat(pantry): scrape switch + properties + error codes + gated controller (mezo-8vum)"
```

---

### Task 4: `WebPageClient` — capped, guarded page fetch

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/WebPageClient.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/service/WebPageClientIT.java`

**Interfaces:**
- Consumes: `PantryScrapeProperties` (Task 3).
- Produces: `String fetch(String url)` — raw HTML (≤ maxBodyBytes) or throws `SystemRuntimeErrorException` (`PANTRY_SCRAPE_FETCH_FAILED`, 502; bad URL → `VALIDATION_INVALID_VALUE`/`url`, 400).

- [ ] **Step 1: Write the failing IT** (WireMock, mirrors `PantryImportApiIT`'s server wiring — no `base-url` property here, the client hits the URL it is given, so the test passes WireMock's own URL):

```java
package io.mrkuhne.mezo.feature.pantry.service;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** WebPageClient limits: happy fetch, upstream error, oversize cap, URL guard (mezo-8vum). */
class WebPageClientIT extends AbstractIntegrationTest {

    static final WireMockServer SHOP = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void shopProps(DynamicPropertyRegistry registry) {
        SHOP.start();
        // WireMock listens on loopback — relax the SSRF guard for ITs only.
        registry.add("mezo.pantry-scrape.allow-private-hosts", () -> "true");
        registry.add("mezo.pantry-scrape.max-body-bytes", () -> "20000");
    }

    @AfterAll
    static void stop() { SHOP.stop(); }

    @Autowired
    private WebPageClient client;

    @BeforeEach
    void reset() { SHOP.resetAll(); }

    @Test
    void testFetch_shouldReturnHtml_whenPageResponds() {
        SHOP.stubFor(get(urlPathEqualTo("/p/impact-whey")).willReturn(
            aResponse().withHeader("Content-Type", "text/html").withBody("<html><body>Impact Whey</body></html>")));
        assertThat(client.fetch(SHOP.baseUrl() + "/p/impact-whey")).contains("Impact Whey");
    }

    @Test
    void testFetch_shouldThrowFetchFailed_whenUpstream404() {
        SHOP.stubFor(get(urlPathEqualTo("/gone")).willReturn(aResponse().withStatus(404)));
        assertThatThrownBy(() -> client.fetch(SHOP.baseUrl() + "/gone"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testFetch_shouldThrowFetchFailed_whenBodyExceedsCap() {
        SHOP.stubFor(get(urlPathEqualTo("/huge")).willReturn(
            aResponse().withHeader("Content-Type", "text/html").withBody("x".repeat(30_000))));
        assertThatThrownBy(() -> client.fetch(SHOP.baseUrl() + "/huge"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testFetch_shouldThrowValidation_whenNotHttpUrl() {
        assertThatThrownBy(() -> client.fetch("ftp://example.com/x"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("VALIDATION_INVALID_VALUE");
    }
}
```

(If `SystemRuntimeErrorException` doesn't surface the code in `getMessage()`, assert the way `PantryImportApiIT` asserts OffClient failures — open it and copy the idiom.)

- [ ] **Step 2: Run to verify it fails:**

```bash
cd backend && ./mvnw clean test -Dtest=WebPageClientIT -DargLine=-Xmx3g
```

Expected: FAIL — `WebPageClient` does not exist.

- [ ] **Step 3: Implement** (OffClient is the pattern — timeouts via `HttpClientSettings`, `@ConditionalOnProperty` gating):

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Outbound product-page fetch for the URL-scrape import (mezo-8vum). Browser-like headers
 * (some shops 403 obvious bots), hard size cap, and an SSRF guard: only http/https and only
 * public hosts (allow-private-hosts exists solely for WireMock ITs).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class WebPageClient {

    private final RestClient rest;
    private final PantryScrapeProperties props;

    public WebPageClient(RestClient.Builder builder, PantryScrapeProperties props) {
        this.props = props;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(Duration.ofMillis(props.timeoutMs()), Duration.ofMillis(props.timeoutMs()));
        this.rest = builder
            .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
            .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, props.acceptLanguage())
            .defaultHeader(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml")
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /** Fetches the page and returns its HTML; every failure maps to a typed SystemMessage. */
    public String fetch(String url) {
        URI uri = validated(url);
        try {
            String body = rest.get().uri(uri).retrieve().body(String.class);
            if (body == null || body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > props.maxBodyBytes()) {
                throw fetchFailed(url, body == null ? "empty body" : "body exceeds cap", null);
            }
            return body;
        } catch (RestClientException e) {
            throw fetchFailed(url, e.getClass().getSimpleName(), e);
        }
    }

    private URI validated(String url) {
        URI uri;
        try {
            uri = URI.create(url.strip());
        } catch (IllegalArgumentException e) {
            throw badUrl();
        }
        String scheme = uri.getScheme();
        if (uri.getHost() == null || (!"http".equals(scheme) && !"https".equals(scheme))) {
            throw badUrl();
        }
        if (!props.allowPrivateHosts()) {
            try {
                InetAddress addr = InetAddress.getByName(uri.getHost());
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {
                    throw badUrl();
                }
            } catch (UnknownHostException e) {
                throw fetchFailed(url, "unknown host", e);
            }
        }
        return uri;
    }

    private SystemRuntimeErrorException badUrl() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "url").build(), HttpStatus.BAD_REQUEST);
    }

    private SystemRuntimeErrorException fetchFailed(String url, String reason, Exception cause) {
        log.warn("Scrape fetch failed for {}: {}", url, reason, cause);
        return new SystemRuntimeErrorException(
            SystemMessage.error("PANTRY_SCRAPE_FETCH_FAILED").build(), HttpStatus.BAD_GATEWAY);
    }
}
```

(Match `SystemRuntimeErrorException`'s actual constructor/cause-handling to how `OffClient` throws — open `OffClient.java` lines 60+ and copy the throw idiom exactly.)

- [ ] **Step 4: Run to verify it passes:**

```bash
cd backend && ./mvnw clean test -Dtest=WebPageClientIT -DargLine=-Xmx3g
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(pantry): WebPageClient — capped, SSRF-guarded page fetch (mezo-8vum)"
```

---

### Task 5: `HtmlNutritionStripper` — jsoup dependency + pure text reduction

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/HtmlNutritionStripper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/service/HtmlNutritionStripperTest.java`

**Interfaces:**
- Produces: `String strip(String html, int maxChars)` — visible text with tables flattened to `label: value` lines, truncated at `maxChars`.

- [ ] **Step 1: Add jsoup to `backend/pom.xml`** (next to the other runtime deps; pick the newest 1.x — verify with `mvn versions` or use the version below):

```xml
		<dependency>
			<groupId>org.jsoup</groupId>
			<artifactId>jsoup</artifactId>
			<version>1.18.3</version>
		</dependency>
```

- [ ] **Step 2: Write the failing unit test:**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Pure jsoup reduction: drop chrome, keep visible text, flatten tables (mezo-8vum). */
class HtmlNutritionStripperTest {

    private final HtmlNutritionStripper stripper = new HtmlNutritionStripper();

    @Test
    void testStrip_shouldDropScriptStyleNavFooter_whenPresent() {
        String html = """
            <html><head><style>.x{}</style><script>var a=1;</script></head>
            <body><nav>Menü</nav><h1>Impact Whey</h1><footer>© shop</footer></body></html>""";
        String out = stripper.strip(html, 10_000);
        assertThat(out).contains("Impact Whey").doesNotContain("Menü").doesNotContain("var a=1").doesNotContain("© shop");
    }

    @Test
    void testStrip_shouldFlattenTableRowsToLabelValueLines_whenNutritionTable() {
        String html = """
            <table><tr><th>Energia</th><td>412 kcal</td></tr>
            <tr><th>Fehérje</th><td>82 g</td></tr></table>""";
        String out = stripper.strip(html, 10_000);
        assertThat(out).contains("Energia: 412 kcal").contains("Fehérje: 82 g");
    }

    @Test
    void testStrip_shouldTruncate_whenLongerThanMaxChars() {
        String out = stripper.strip("<p>" + "a".repeat(500) + "</p>", 100);
        assertThat(out).hasSizeLessThanOrEqualTo(100);
    }
}
```

- [ ] **Step 3: Run to verify it fails:**

```bash
cd backend && ./mvnw clean test -Dtest=HtmlNutritionStripperTest -DargLine=-Xmx3g
```

Expected: FAIL — class missing.

- [ ] **Step 4: Implement:**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

/**
 * Reduces a product page to LLM-prompt-sized visible text (mezo-8vum): drops chrome
 * (script/style/nav/header/footer/iframe/svg), flattens table rows to "label: value" lines
 * (nutrition tables survive layout changes that way), and truncates to a char budget.
 */
@Component
public class HtmlNutritionStripper {

    public String strip(String html, int maxChars) {
        Document doc = Jsoup.parse(html);
        doc.select("script, style, nav, header, footer, iframe, svg, noscript, form").remove();
        StringBuilder tables = new StringBuilder();
        for (Element row : doc.select("table tr")) {
            var cells = row.select("th, td");
            if (cells.size() >= 2) {
                tables.append(cells.get(0).text().strip()).append(": ")
                      .append(cells.get(1).text().strip()).append('\n');
            }
        }
        doc.select("table").remove();
        String text = tables + "\n" + doc.body().text();
        return text.length() <= maxChars ? text : text.substring(0, maxChars);
    }
}
```

- [ ] **Step 5: Run to verify it passes** (same command). Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/pom.xml backend/src
git -c core.hooksPath=/dev/null commit -m "feat(pantry): jsoup HtmlNutritionStripper for scrape prompts (mezo-8vum)"
```

---

### Task 6: Extraction + validation + service + endpoint (the core)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/ScrapeExtractionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/ScrapeDraftValidator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryScrapeService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/controller/PantryScrapeController.java` (drop the stub throw, inject the service)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (new sentinel)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/service/ScrapeDraftValidatorTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryScrapeApiIT.java`

**Interfaces:**
- Consumes: `WebPageClient.fetch(String)`, `HtmlNutritionStripper.strip(String,int)`, `CompanionLlm.complete(String,String)` via `ObjectProvider<CompanionLlm>`, `PantryScrapeProperties`.
- Produces: `PantryScrapeService.scrape(String url) -> PantryScrapeResponse`; `FakeCompanionLlm.SCRAPE_SENTINEL` = `[fake-scrape:{json}]`.

- [ ] **Step 1: Failing validator unit test:**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Deterministic confidence: clamps + Atwater consistency (mezo-8vum, spec §Backend 4). */
class ScrapeDraftValidatorTest {

    private final ScrapeDraftValidator validator = new ScrapeDraftValidator();

    private ScrapeExtractionService.ExtractedDraft draft(double kcal, Double p, Double c, Double f) {
        return new ScrapeExtractionService.ExtractedDraft(
            "Impact Whey", "Myprotein", BigDecimal.valueOf(100), "g", BigDecimal.valueOf(kcal),
            p == null ? null : BigDecimal.valueOf(p), c == null ? null : BigDecimal.valueOf(c),
            f == null ? null : BigDecimal.valueOf(f), null, null, null, null, 4, "supplement", null, null);
    }

    @Test
    void testConfidence_shouldBeFull_whenAtwaterConsistent() {
        // 4*82 + 4*4 + 9*7.5 = 411.5 ≈ 412
        assertThat(validator.confidence(draft(412, 82.0, 4.0, 7.5))).isEqualTo(1.0);
    }

    @Test
    void testConfidence_shouldDrop_whenAtwaterOffByMoreThan30Percent() {
        assertThat(validator.confidence(draft(900, 10.0, 10.0, 2.0))).isLessThan(0.7);
    }

    @Test
    void testConfidence_shouldDrop_whenMacrosMissing() {
        assertThat(validator.confidence(draft(412, null, null, null))).isLessThan(1.0);
    }
}
```

- [ ] **Step 2: Run to verify it fails** (`-Dtest=ScrapeDraftValidatorTest`). Expected: FAIL — classes missing.

- [ ] **Step 3: Implement extraction + validator + service.**

`ScrapeExtractionService` — prompt + parse (the `ExtractedDraft` record is the LLM's JSON shape):

```java
package io.mrkuhne.mezo.feature.pantry.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * One cheap-tier CompanionLlm call turning stripped product-page text into a nutrition draft
 * (mezo-8vum). The LLM never invents numbers (nulls allowed everywhere except name+kcal) and
 * never derives source/confidence — those are deterministic (PantryScrapeService).
 */
@Slf4j
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class ScrapeExtractionService {

    /** The LLM's JSON contract. All-null nutrition -> "page carries no facts" (result:null upstream). */
    public record ExtractedDraft(
        String name, String brand, BigDecimal per, String unit, BigDecimal kcal,
        BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG, BigDecimal fiberG,
        BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        Integer nova, String category, Integer priceHuf, String priceUnit) {
    }

    static final String SYSTEM_PROMPT = """
        You extract packaged-food data from Hungarian or English webshop product pages.
        Answer with ONE JSON object and nothing else, using exactly these keys:
        {"name":string, "brand":string|null, "per":number, "unit":"g"|"ml", "kcal":number|null,
         "proteinG":number|null, "carbsG":number|null, "fatG":number|null, "fiberG":number|null,
         "sugarG":number|null, "saltG":number|null, "saturatedFatG":number|null,
         "nova":1|2|3|4|null, "category":string|null, "priceHuf":integer|null, "priceUnit":string|null}
        Rules:
        - All nutrition values are per the "per"+"unit" basis; prefer the per-100g/100ml column.
        - NEVER invent a number. A value not present on the page is null.
        - If the page shows no nutrition facts at all, set kcal to null.
        - nova is YOUR classification estimate of the NOVA processing group (1-4).
        - category must be one of: vegetables, fruits, meat, fish, eggs, dairy, cheese, legumes,
          grains, pasta, bakery, nuts_seeds, oils_fats, condiments, snacks, beverages, supplement, other.
        - priceHuf is the product price in HUF if shown; priceUnit like "/kg" or "/db" if shown.
        """;

    private final ObjectProvider<CompanionLlm> llm;
    private final ObjectMapper mapper = new ObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public ScrapeExtractionService(ObjectProvider<CompanionLlm> llm) {
        this.llm = llm;
    }

    public ExtractedDraft extract(String pageText) {
        CompanionLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_SCRAPE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        String answer = port.complete(SYSTEM_PROMPT, pageText);
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return mapper.readValue(json, ExtractedDraft.class);
        } catch (Exception e) {
            log.warn("Scrape extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_SCRAPE_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }
}
```

`ScrapeDraftValidator` — deterministic confidence:

```java
package io.mrkuhne.mezo.feature.pantry.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/**
 * Deterministic plausibility scoring for an extracted draft (mezo-8vum): starts at 1.0,
 * subtracts for missing macros and Atwater inconsistency (kcal vs 4P+4C+9F beyond 30%).
 * No LLM self-assessment — testable, explainable.
 */
@Component
public class ScrapeDraftValidator {

    public double confidence(ScrapeExtractionService.ExtractedDraft d) {
        double score = 1.0;
        if (d.proteinG() == null || d.carbsG() == null || d.fatG() == null) {
            score -= 0.3;
        } else if (d.kcal() != null) {
            double atwater = d.proteinG().doubleValue() * 4
                + d.carbsG().doubleValue() * 4 + d.fatG().doubleValue() * 9;
            double kcal = d.kcal().doubleValue();
            if (kcal > 0 && Math.abs(kcal - atwater) / kcal > 0.30) {
                score -= 0.4;
            }
        }
        if (d.nova() != null && (d.nova() < 1 || d.nova() > 4)) score -= 0.2;
        if (outOfRange(d.kcal(), 0, 900)) score -= 0.2;
        return Math.max(0.0, score);
    }

    private boolean outOfRange(BigDecimal v, double lo, double hi) {
        return v != null && (v.doubleValue() < lo || v.doubleValue() > hi);
    }
}
```

`PantryScrapeService` — orchestration + source derivation + response mapping:

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeResult;
import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * URL-scrape orchestration (mezo-8vum): fetch -> strip -> LLM extract -> validate.
 * Stateless — nothing persists until the user confirms via POST /api/pantry-import.
 * source is derived HERE from the URL domain (never trusted from any model output).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeService {

    /** Known shop domains -> pantry source values; anything else is the generic 'web'. */
    static final Map<String, String> DOMAIN_SOURCES = Map.of(
        "myprotein.hu", "myprotein.hu", "www.myprotein.hu", "myprotein.hu",
        "gymbeam.hu", "gymbeam.hu", "www.gymbeam.hu", "gymbeam.hu",
        "kifli.hu", "kifli.hu", "www.kifli.hu", "kifli.hu",
        "tesco.hu", "tesco.hu", "auchan.hu", "auchan.hu");

    static final int MAX_PROMPT_CHARS = 24_000;

    private final WebPageClient pageClient;
    private final HtmlNutritionStripper stripper;
    private final ScrapeExtractionService extraction;
    private final ScrapeDraftValidator validator;
    private final PantryScrapeProperties props;

    public PantryScrapeResponse scrape(String url) {
        String html = pageClient.fetch(url);
        String text = stripper.strip(html, MAX_PROMPT_CHARS);
        ScrapeExtractionService.ExtractedDraft d = extraction.extract(text);
        if (d.kcal() == null || d.name() == null || d.name().isBlank()) {
            return new PantryScrapeResponse(); // honest empty: page carries no nutrition facts
        }
        double confidence = validator.confidence(d);
        PantryScrapeResult result = new PantryScrapeResult();
        result.setName(d.name().strip());
        result.setBrand(d.brand());
        result.setPer(d.per() == null ? BigDecimal.valueOf(100) : d.per());
        result.setUnit(d.unit() == null ? "g" : d.unit());
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
        result.setPriceHuf(d.priceHuf());
        result.setPriceUnit(d.priceUnit());
        result.setSource(sourceFor(url));
        result.setSourceUrl(url);
        result.setConfidence(BigDecimal.valueOf(confidence));
        result.setNeedsReview(confidence < props.confidenceThreshold());
        PantryScrapeResponse resp = new PantryScrapeResponse();
        resp.setResult(result);
        return resp;
    }

    static String sourceFor(String url) {
        String host = URI.create(url.strip()).getHost();
        return host == null ? "web" : DOMAIN_SOURCES.getOrDefault(host.toLowerCase(), "web");
    }

    /** Unknown/typo category from the model degrades to null, never a 500 (mezo-w3o spirit). */
    private String mapCategory(String category) {
        if (category == null) return null;
        return java.util.Set.of("vegetables", "fruits", "meat", "fish", "eggs", "dairy", "cheese",
            "legumes", "grains", "pasta", "bakery", "nuts_seeds", "oils_fats", "condiments",
            "snacks", "beverages", "supplement", "other").contains(category) ? category : null;
    }
}
```

(Adapt setters/enum types to the actual generated `PantryScrapeResult` — `category`/`source` may be generated enums; if so use `PantryScrapeResult.CategoryEnum.fromValue(...)` inside try/catch → null, and the generated `PantrySource` enum via `PantrySource.fromValue(sourceFor(url))`. Wire `PantryScrapeController` to call `service.scrape(req.getUrl())` and delete the stub throw.)

- [ ] **Step 4: Run validator tests** (`-Dtest=ScrapeDraftValidatorTest`). Expected: 3 PASS.

- [ ] **Step 5: Extend `FakeCompanionLlm`** with a scrape sentinel (next to `FACTS_SENTINEL`):

```java
    /** Scripted scrape (mezo-8vum): {@code [fake-scrape:{json}]} payload is returned verbatim. */
    public static final Pattern SCRAPE_SENTINEL =
            Pattern.compile("\\[fake-scrape:(\\{.*?})]", Pattern.DOTALL);
```

and in `complete(...)`, where the other sentinels are matched (mirror the FACTS handling):

```java
        Matcher scrape = SCRAPE_SENTINEL.matcher(userMessage);
        if (scrape.find()) {
            return scrape.group(1);
        }
```

- [ ] **Step 6: Write the failing HTTP-level IT** — WireMock product pages EMBED the sentinel in visible text, so fetch→strip→prompt→fake→parse runs the real path:

```java
package io.mrkuhne.mezo.feature.pantry;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * HTTP-level ITs for POST /api/pantry-import/scrape (mezo-8vum). The shop is WireMock; the
 * LLM is FakeCompanionLlm (companion-fake) scripted via [fake-scrape:{json}] sentinels
 * embedded in the served page text — the full fetch->strip->prompt->parse path runs.
 */
@ActiveProfiles("companion-fake") // merge with ApiIntegrationTest's own profiles if it declares any
class PantryScrapeApiIT extends ApiIntegrationTest {

    static final WireMockServer SHOP = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void shopProps(DynamicPropertyRegistry registry) {
        SHOP.start();
        registry.add("mezo.pantry-scrape.allow-private-hosts", () -> "true");
    }

    @AfterAll
    static void stop() { SHOP.stop(); }

    @BeforeEach
    void reset() { SHOP.resetAll(); }

    private static final String WHEY_JSON = """
        {"name":"Impact Whey Protein","brand":"Myprotein","per":100,"unit":"g","kcal":412,
         "proteinG":82,"carbsG":4,"fatG":7.5,"fiberG":null,"sugarG":4,"saltG":0.5,
         "saturatedFatG":5,"nova":4,"category":"supplement","priceHuf":24990,"priceUnit":"/kg"}""";

    private void stubShopPage(String path, String sentinelJson) {
        SHOP.stubFor(get(urlPathEqualTo(path)).willReturn(aResponse()
            .withHeader("Content-Type", "text/html")
            .withBody("<html><body><h1>Termék</h1><p>[fake-scrape:" + sentinelJson + "]</p></body></html>")));
    }

    private PantryScrapeResponse scrape(String url, HttpStatus expected) {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(url);
        return postForBody("/api/pantry-import/scrape", req, ownerAuthHeaders(), expected, PantryScrapeResponse.class);
    }

    @Test
    void testScrape_shouldReturnEnrichedDraft_whenPageCarriesNutrition() {
        stubShopPage("/p/impact-whey", WHEY_JSON);
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/impact-whey", HttpStatus.OK);
        assertThat(resp.getResult()).isNotNull();
        assertThat(resp.getResult().getName()).isEqualTo("Impact Whey Protein");
        assertThat(resp.getResult().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(412));
        assertThat(resp.getResult().getSource().getValue()).isEqualTo("web"); // WireMock host is not a known shop domain
        assertThat(resp.getResult().getNeedsReview()).isFalse(); // Atwater-consistent fixture
        assertThat(resp.getResult().getConfidence().doubleValue()).isEqualTo(1.0);
    }

    @Test
    void testScrape_shouldReturnNullResult_whenPageHasNoNutrition() {
        stubShopPage("/p/tshirt", "{\"name\":\"Póló\",\"brand\":null,\"per\":100,\"unit\":\"g\",\"kcal\":null,"
            + "\"proteinG\":null,\"carbsG\":null,\"fatG\":null,\"fiberG\":null,\"sugarG\":null,\"saltG\":null,"
            + "\"saturatedFatG\":null,\"nova\":null,\"category\":null,\"priceHuf\":null,\"priceUnit\":null}");
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/tshirt", HttpStatus.OK);
        assertThat(resp.getResult()).isNull();
    }

    @Test
    void testScrape_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        stubShopPage("/p/weird", "{\"name\":\"Gyanús szelet\",\"brand\":null,\"per\":100,\"unit\":\"g\",\"kcal\":900,"
            + "\"proteinG\":10,\"carbsG\":10,\"fatG\":2,\"fiberG\":null,\"sugarG\":null,\"saltG\":null,"
            + "\"saturatedFatG\":null,\"nova\":null,\"category\":\"snacks\",\"priceHuf\":null,\"priceUnit\":null}");
        PantryScrapeResponse resp = scrape(SHOP.baseUrl() + "/p/weird", HttpStatus.OK);
        assertThat(resp.getResult().getNeedsReview()).isTrue();
    }

    @Test
    void testScrape_should502_whenLlmAnswerUnparseable() {
        SHOP.stubFor(get(urlPathEqualTo("/p/garbage")).willReturn(aResponse()
            .withHeader("Content-Type", "text/html")
            .withBody("<html><body>no sentinel here — the fake echoes prompts, not JSON</body></html>")));
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(SHOP.baseUrl() + "/p/garbage");
        ResponseEntity<String> resp = exchangeForResponse("/api/pantry-import/scrape", HttpMethod.POST, req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_EXTRACT_FAILED");
    }

    @Test
    void testScrape_should502_whenPageUnreachable() {
        SHOP.stubFor(get(urlPathEqualTo("/p/gone")).willReturn(aResponse().withStatus(404)));
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl(SHOP.baseUrl() + "/p/gone");
        ResponseEntity<String> resp = exchangeForResponse("/api/pantry-import/scrape", HttpMethod.POST, req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testScrape_should400_whenUrlNotHttp() {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl("ftp://example.com/product");
        ResponseEntity<String> resp = exchangeForResponse("/api/pantry-import/scrape", HttpMethod.POST, req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testImport_shouldPersistSourceUrlAndManualReview_whenLowConfidenceScrapedDraftConfirmed() {
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Gyanús szelet");
        req.setPer(BigDecimal.valueOf(100));
        req.setUnit("g");
        req.setKcal(BigDecimal.valueOf(900));
        req.setSourceUrl("https://www.gymbeam.hu/p/gyanus-szelet");
        req.setConfidence(BigDecimal.valueOf(0.3));
        PantryItemResponse item = postForBody("/api/pantry-import", req, ownerAuthHeaders(), HttpStatus.CREATED, PantryItemResponse.class);
        assertThat(item.getId()).isNotNull();
        // feed assertions: fetch GET /api/pantry and assert imports[0].status == manual-review
        // and the persisted item's source == gymbeam.hu — mirror PantryImportApiIT's feed asserts.
    }
}
```

(Fixture-shape note: adjust `getSource().getValue()`/`getNeedsReview()` accessors to the generated code; check how `ApiIntegrationTest` activates profiles — if it already sets `@ActiveProfiles`, add `companion-fake` alongside rather than replacing. `mezo.feature.companion.enabled` is already `true` in `application.yml`, which the fake requires.)

- [ ] **Step 7: Run to verify the ITs fail**, then wire `PantryScrapeController` to `PantryScrapeService` and extend `PantryImportService.importItem`:

In `PantryImportService.importItem` replace the fixed source/status lines:

```java
        String source = req.getSourceUrl() == null
            ? SOURCE_OPENFOODFACTS
            : PantryScrapeService.sourceFor(req.getSourceUrl()); // derive, never trust the client
        item.setSource(source);
        // …
        feed.setSource(source);
        feed.setSourceUrl(req.getSourceUrl());
        feed.setStatus(req.getConfidence() != null
            && req.getConfidence().doubleValue() < scrapeProps.confidenceThreshold()
            ? "manual-review" : "synced");
```

(`scrapeProps`: the import feature must keep working with the scrape switch OFF, so inject `ObjectProvider<PantryScrapeProperties>` and fall back to `"synced"` when the bean is absent. Also map the price enrichment added to the contract in Task 1 Step 3: `item.setPriceHuf(req.getPriceHuf()); item.setPriceUnit(req.getPriceUnit());`.)

- [ ] **Step 8: Add the LLM-unavailable IT** (spec: "no-LLM → 503") — a tiny separate class, because it needs a different context (companion switch OFF, scrape switch ON):

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/** Scrape on, companion off -> no CompanionLlm bean -> clean 503, never a 500 (mezo-8vum). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PantryScrapeLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testScrape_should503_whenCompanionSwitchOff() {
        PantryScrapeRequest req = new PantryScrapeRequest();
        req.setUrl("https://www.myprotein.hu/p/impact-whey/10530943/");
        ResponseEntity<String> resp = exchangeForResponse(
            "/api/pantry-import/scrape", HttpMethod.POST, req, ownerAuthHeaders());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "PANTRY_SCRAPE_LLM_UNAVAILABLE");
    }
}
```

⚠️ Ordering note for this to pass: `PantryScrapeService.scrape` must ask `ScrapeExtractionService` for the LLM port **before** fetching the page (move the `llm.getIfAvailable()` null-check into a public `ScrapeExtractionService.requireAvailable()` called first in `scrape()`), otherwise this test would try a real outbound fetch to myprotein.hu. Implement `requireAvailable()` accordingly.

- [ ] **Step 9: Run:**

```bash
cd backend && ./mvnw clean test -Dtest='PantryScrapeApiIT,PantryScrapeDisabledApiIT,PantryScrapeLlmUnavailableApiIT,PantryImportApiIT,ScrapeDraftValidatorTest' -DargLine=-Xmx3g
```

Expected: ALL PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src api/
git -c core.hooksPath=/dev/null commit -m "feat(pantry): LLM scrape pipeline — extraction, validation, endpoint + ITs (mezo-8vum)"
```

---

### Task 7: FE data layer — sources, scrape action, dual-mode

**Files:**
- Modify: `frontend/src/data/pantrySources.ts` (add `gymbeam.hu`, `web` entries — copy the existing `{ label, color, short }` shape)
- Modify: `frontend/src/data/types.ts` (or wherever `PantryLookupItem` lives — grep it): add `PantryScrapeDraft`
- Modify: `frontend/src/data/fuel/pantryApi.ts`
- Modify: `frontend/src/data/fuel/pantryHooks.ts`
- Test: colocated existing test files for both (`pantryApi.test.ts` / `pantryHooks.test.tsx` — extend, mirror the lookup tests)

**Interfaces:**
- Consumes: generated `PantryScrapeRequest/Response` types from `api.gen.ts` (Task 1).
- Produces: `usePantryActions().scrapeItem(url: string): Promise<PantryScrapeDraft | null>`; `PantryScrapeDraft` = `PantryLookupItem` + `{ category: string | null, priceHuf: number | null, priceUnit: string | null, source: PantrySourceKey, sourceUrl: string, confidence: number, needsReview: boolean }`; `importItem` input extended with `sourceUrl?`, `confidence?`, `priceHuf?`, `priceUnit?`.

- [ ] **Step 1: Write the failing tests** — in the pantry data test file, mirror the existing `lookup` tests:

```ts
// real mode: scrape maps the response draft and null result passes through
it('scrapeItem maps a draft and returns null for result:null', async () => {
  // stub apiFetch the way the lookup tests do, returning:
  // { result: { name: 'Impact Whey', per: 100, unit: 'g', kcal: 412, proteinG: 82, carbsG: 4,
  //   fatG: 7.5, nova: 4, category: 'supplement', priceHuf: 24990, priceUnit: '/kg',
  //   source: 'myprotein.hu', sourceUrl: 'https://www.myprotein.hu/p/x', confidence: 1, needsReview: false } }
  // assert the mapped PantryScrapeDraft fields; then stub { result: null } and assert null.
})
// mock mode: scrapeItem resolves the canned draft
```

(Follow the EXACT stubbing idiom already used in the file — do not introduce a new mocking style.)

- [ ] **Step 2: Run to verify they fail:** `cd frontend && pnpm test -- pantry` → FAIL (`scrapeItem` missing).

- [ ] **Step 3: Implement.** `pantryApi.ts` (after `importItem`):

```ts
  // mezo-8vum: URL-scrape draft — nothing persisted server-side.
  scrape: (url: string): Promise<PantryScrapeDraft | null> =>
    apiFetch<PantryScrapeResponse>('/api/pantry-import/scrape', {
      method: 'POST',
      body: JSON.stringify({ url } satisfies PantryScrapeRequest),
    }).then(r => (r.result ? fromScrapeResult(r.result) : null)),
```

with a `fromScrapeResult` mapper next to `fromLookupResult` (copy its null-handling style). `pantryHooks.ts` — extend `usePantryActions` mirroring `lookupItems`:

```ts
  const scrapeItem = useCallback(
    (url: string) =>
      isMockMode()
        ? new Promise<PantryScrapeDraft | null>(resolve =>
            setTimeout(() => resolve(MOCK_SCRAPE_DRAFT), 600))
        : pantryApi.scrape(url),
    [],
  )
  // add scrapeItem to the returned object
```

`MOCK_SCRAPE_DRAFT` (in `frontend/src/data/fuel/pantry.ts` next to the other seeds):

```ts
export const MOCK_SCRAPE_DRAFT: PantryScrapeDraft = {
  name: 'Impact Whey Protein · vanília', brand: 'Myprotein', per: 100, unit: 'g',
  kcal: 412, proteinG: 82, carbsG: 4, fatG: 7.5, fiberG: null, sugarG: 4, saltG: 0.5,
  saturatedFatG: 5, nova: 4, category: 'supplement', priceHuf: 24990, priceUnit: '/kg',
  source: 'myprotein.hu', sourceUrl: 'https://www.myprotein.hu/p/impact-whey/10530943/',
  confidence: 1, needsReview: false, barcode: null,
}
```

Also extend the `importItem` input type + `toImportRequest` with `sourceUrl`, `confidence`, `priceHuf`, `priceUnit` passthrough.

- [ ] **Step 4: Run both modes:**

```bash
cd frontend && pnpm test -- pantry && VITE_USE_MOCK=true pnpm test -- pantry
```

Expected: PASS ×2.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): pantry scrape data layer — scrapeItem action, sources, mock draft (mezo-8vum)"
```

---

### Task 8: FE — ImportItemSheet Link mode

**Files:**
- Modify: `frontend/src/features/fuel/sheets/ImportItemSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx` (extend)

**Interfaces:**
- Consumes: `usePantryActions().scrapeItem`, `importItem` (Task 7).

Design (follows the existing 3-phase wizard; the spec's "Keresés | Vonalkód | Link" folds to TWO segments because the existing single input already handles name+barcode):

- New top-level segmented toggle: `Keresés (OFF)` | `Link` (two `chip` buttons, `aria-pressed`).
- Link mode input phase: one URL field (`placeholder="https://…"`, `inputMode="url"`), CTA `Beolvasás` (disabled until the value starts with `http`).
- Link mode searching phase: reuse the searching card with `SourceBadge source={draft?.source ?? 'web'}`.
- Link mode preview phase: reuse the picked-draft card (name input + category select + StatCell macros row), plus:
  - a `SourceBadge` for the derived source,
  - when `needsReview`: a warning line `Az AI nem teljesen biztos a számokban — ellenőrizd őket mentés előtt.` styled like the existing error line but `color: 'var(--warning)'`,
  - `null` draft (no nutrition on page): the existing empty-state card with text `Ezen az oldalon nem találtam tápértéket — vidd fel kézzel a Kamrában.`
- Save: `importItem({ ...draft, name, category, sourceUrl: draft.sourceUrl, confidence: draft.confidence, priceHuf: draft.priceHuf, priceUnit: draft.priceUnit })`.

- [ ] **Step 1: Write failing tests** (extend the existing test file, copy its render/act idioms):

```ts
// 1. toggling to Link mode shows the URL input and Beolvasás CTA
// 2. Beolvasás → mock draft renders the preview with name 'Impact Whey Protein · vanília'
//    and a myprotein.hu SourceBadge
// 3. a needsReview draft renders the warning line (override the hook/mock the way the
//    file's other override tests do)
// 4. scrape rejection renders the fetch-error copy and returns to input phase
// 5. null draft renders the 'nem találtam tápértéket' empty state
```

Write them as real tests with the file's existing helpers — no new testing idioms.

- [ ] **Step 2: Run to verify they fail:** `pnpm test -- ImportItemSheet` → FAIL.

- [ ] **Step 3: Implement the Link mode** in `ImportItemSheet.tsx`: add `const [mode, setMode] = useState<'search' | 'link'>('search')`, `const [url, setUrl] = useState('')`, `const [draft, setDraft] = useState<PantryScrapeDraft | null>(null)`, a `scan` function mirroring `search`:

```ts
  const scan = async () => {
    if (!url.trim().startsWith('http')) return
    setPhase('searching')
    setError(null)
    try {
      const found = await scrapeItem(url.trim())
      setDraft(found)
      setName(found?.name ?? '')
      setCategory(found?.category ?? 'other')
      setPhase('preview')
    } catch {
      setError('Az oldal beolvasása nem sikerült — ellenőrizd a linket, vagy próbáld később.')
      setPhase('input')
    }
  }
```

and render the mode toggle + branch the input/preview blocks on `mode`. Keep the OFF flow byte-identical.

- [ ] **Step 4: Run both modes + build:**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

Expected: ALL green (full FE suite — the sheet touches shared flows).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): ImportItemSheet Link mode — URL scrape wizard (mezo-8vum)"
```

---

### Task 9: Docs + gates + landing

**Files:**
- Modify: `docs/features/fuel.md` (§1 status + §4 endpoints + §10 file map — add the scrape endpoint, the new source values, the Link mode; overwrite in place, no changelog)
- Modify: `docs/superpowers/specs/2026-07-18-fuel-url-scrape-import-design.md` — ONLY if implementation deviated (record the deviation, don't rewrite the design)

- [ ] **Step 1: Update `docs/features/fuel.md`** — the P6 import paragraphs gain the scrape path: `POST /api/pantry-import/scrape` (LLM, `mezo.feature.pantry-scrape.enabled`), `WebPageClient`/`HtmlNutritionStripper`/`ScrapeExtractionService`/`PantryScrapeService` file pointers, `gymbeam.hu`+`web` sources, `pantry_import.source_url`, ImportItemSheet Link mode.

- [ ] **Step 2: Lint docs:**

```bash
node scripts/lint-docs.mjs
```

Expected: fuel.md staleness flag clear, no broken links.

- [ ] **Step 3: Focused backend gate** (full suite is CI's job):

```bash
cd backend && ./mvnw clean test -Dtest='Pantry*' -DargLine=-Xmx3g
```

Expected: all pantry ITs PASS.

- [ ] **Step 4: FE full gate:**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build + both modes green.

- [ ] **Step 5: Live smoke (manual, needs the real Gemini key):** start the stack (`docker compose up -d`, `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`, `pnpm dev`), paste a real myprotein.hu product URL in the Link mode, verify a sane draft and a confirmed import landing in the Kamra + feed. Record the result in the PR description.

- [ ] **Step 6: Commit docs, push, open the self-PR (CI gate):**

```bash
git add docs/
git -c core.hooksPath=/dev/null commit -m "docs(fuel): scrape import — feature doc + spec deviations (mezo-8vum)"
git push -u origin feat/fuel-url-scrape-import
gh pr create --title "feat(fuel): Kamra URL-import — LLM scrape (mezo-8vum)" --body "Implements docs/superpowers/specs/2026-07-18-fuel-url-scrape-import-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Wait for CI green. Land per the worktree rule (`gh pr merge --merge` when the main checkout is busy — see memory `mezo-worktree-landing-via-gh-pr-merge`), then close `mezo-8vum` from the MAIN checkout with notes (spec path, merge SHA, live-smoke result).

---

## Execution notes

- **ArchUnit:** Task 6 introduces `feature.pantry → feature.companion` (the `CompanionLlm` import). If the ArchUnit suite rejects the edge, do NOT freeze a cycle — extract the port instead (file a follow-up bd issue and consult the reviewer).
- **Generated-type drift:** Tasks 6–8 reference generated accessors (`getNeedsReview`, `PantrySource.fromValue`, `PantryScrapeRequest` TS type). Always regenerate (`api/generate` + `pnpm generate:api` + `./mvnw clean generate-sources`) after any yml change and adapt call sites to what was actually generated — never hand-edit generated files.
- **16 GB box:** never run the full backend suite locally; the listed focused `-Dtest=` selections + `-DargLine=-Xmx3g` are the local gates; CI runs everything.
