# AI-napló oldal (`/me/ai-usage`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egy böngészhető felület a `llm_log_history` audit-napló fölé: `/me/ai-usage` (periódus-váltó + költség-bontás + szűrhető hívás-lista) és `/me/ai-usage/:id` (teljes payload + token-bontás + befagyasztott ártábla).

**Architecture:** Három új read-endpoint a MEGLÉVŐ `feature/llmlog` csomagban (`LlmUsageController`/`LlmUsageService`/`LlmLogRepository` bővül, új csomag nincs), contract-first az `api/feature/llm-usage/llm-usage.yml` fragmentben. A frontend a `data/me/llmUsage*` fájlokba nő, a felület a `features/me/` alá; a router két testvér-útvonalat kap (Me-alnav nélkül). Minden olvasás `useDualQuery` (dual-mode), a lapozás egyetlen növekvő `limit`.

**Tech Stack:** Spring Boot 4 / Java 21 / JPA-JPQL / MapStruct / openapi-generator (spring) · React 19 / TypeScript / TanStack Query / vitest + MSW · OpenAPI 3.0.3.

**Spec:** [`docs/superpowers/specs/2026-08-14-llm-audit-log-page-design.md`](../specs/2026-08-14-llm-audit-log-page-design.md) · **Mockup:** [`…-mockup.html`](../specs/2026-08-14-llm-audit-log-page-mockup.html) · **bd:** mezo-uakh

## Global Constraints

Ezek MINDEN taskra érvényesek, külön ismétlés nélkül:

- **Ág:** `feat/llm-audit-page` (már létezik, `origin/main`-ről). Commit-tárgy: `<type>(<scope>): <mit> (mezo-uakh)`. Minden commit végén `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Contract-first:** minden API-változás ELŐSZÖR az `api/feature/llm-usage/llm-usage.yml`-be megy, utána `cd api/generate && npm run generate:api` (ez írja az `api/openapi.yml`-t), és FE-oldalon `cd frontend && pnpm generate:api` (ez írja a `src/data/_client/api.gen.ts`-t). **Mindkét generált fájl commitolandó.** Kézzel írt boundary-DTO tilos.
- **Backend build:** MINDIG `./mvnw clean test` (a `clean` nélkül a Lombok+MapStruct inkrementális fordítás megbízhatatlan). A lokális DB-hez `cd backend && docker compose up -d` kell.
- **Backend konvenciók:** konstruktor-injektálás `@RequiredArgsConstructor`-ral (mezőinjektálás soha); `@Transactional` csak metódus-szinten; hibák `SystemRuntimeErrorException` + `SystemMessage` kóddal (`messages.properties`), sosem hardkódolt user-szöveg; repository sorrend `derived → JPQL → native`.
- **Backend teszt:** integráció-első, `ApiIntegrationTest`/`AbstractIntegrationTest` leszármazott, AssertJ (más assert-könyvtár tilos), név `test{Method}_should{Result}_when{Condition}`, adat `*Populator` factoryból. **Nincs mock, nincs `@MockBean`, nincs H2.**
- **FE konvenciók** (`docs/references/frontend_conventions.md`): routed komponens `*Page`; feature-ek CSAK `@/data/hooks`-ból importálnak hookot; nincs barrel a `data/hooks.ts`-en kívül; nincs relatív `../` import (mindig `@/*`); tesztek a forrás mellett; a `shared/ui` nem importálhat `@/data/*`-ot; dual-mode olvasás KIZÁRÓLAG `useDualQuery`-vel, a real-mód betöltési fallbackje SOSEM a mock seed.
- **FE gate (minden FE-task végén):** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — mindkét mód zöld.
- **Két invariáns, amit semmi nem ronthat el** (ADR 0014): (1) `costUsd: null` = **„ismeretlen", nem nulla** → a felületen mindenhol `—`; (2) **nincs `created_by` szűrés** sehol a read-oldalon (a cron/stream sorok tulajdonosa null).
- **Nyelv:** a felhasználónak látszó szöveg magyar; kód, kommentek, commit-üzenetek angolul (a `messages.properties` új kulcsa magyar, a legutóbbi bejegyzések mintájára).

---

## File Structure

**Backend — módosul:**
- `api/feature/llm-usage/llm-usage.yml` — 3 új path + 8 új séma (taskonként inkrementálisan)
- `backend/…/feature/llmlog/repository/LlmLogRepository.java` — 4 új query
- `backend/…/feature/llmlog/service/LlmUsageService.java` — `breakdown()` / `listCalls()` / `call()` + a periódus-számítás kiemelése
- `backend/…/feature/llmlog/controller/LlmUsageController.java` — 3 új metódus
- `backend/src/main/resources/messages.properties` — 2 új kulcs
- `backend/src/test/…/support/populator/LlmLogPopulator.java` — paraméterezhetőbb factory-metódusok

**Backend — új:**
- `…/feature/llmlog/repository/LlmStatusRow.java` · `LlmGroupRow.java` · `LlmCallRow.java` — JPQL-projekciós recordok
- `…/feature/llmlog/service/UsagePeriod.java` — a `DAY|WEEK|MONTH` enum + a naptári kezdőnap
- `…/feature/llmlog/mapper/LlmLogMapper.java` — entity → `LlmCallDetailResponse`
- `backend/src/test/…/feature/llmlog/controller/LlmUsageBreakdownIT.java` · `LlmCallListIT.java` · `LlmCallDetailIT.java`

**Frontend — módosul:**
- `frontend/src/data/me/llmUsageApi.ts` · `llmUsageHooks.ts` · `data/hooks.ts`
- `frontend/src/features/me/components/AiUsageCard.tsx` (+ tesztje) — linkké válik
- `frontend/src/app/router.tsx` — 2 testvér-útvonal

**Frontend — új:**
- `features/me/logic/llmCallFormat.ts` (+ teszt) — a pure formázók
- `features/me/components/AiUsageHero.tsx` · `AiFeatureBreakdown.tsx` · `AiModelBreakdown.tsx` · `AiCallFilters.tsx` · `AiCallRow.tsx` · `AiTokenBar.tsx` · `AiPayloadBlock.tsx` (+ tesztek)
- `features/me/pages/AiUsagePage.tsx` · `AiCallDetailPage.tsx` (+ tesztek)

**Docs — módosul (Task 10):** `docs/features/me.md` · `companion.md` · `_platform-api-backend.md`

---

## Task 1: Backend — `GET /api/llm-usage/breakdown`

**Files:**
- Modify: `api/feature/llm-usage/llm-usage.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmStatusRow.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmGroupRow.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/UsagePeriod.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageBreakdownIT.java`

**Interfaces:**
- Consumes: a meglévő `LlmLogRepository`, `LlmUsageService` (`summary()`), `LlmLogProperties#reportZone()`, `LlmPricingProperties#currency()`.
- Produces:
  - `UsagePeriod` enum: `DAY|WEEK|MONTH`, `LocalDate startDate(ZoneId)`, `static UsagePeriod parse(String)` (érvénytelenre `SystemRuntimeErrorException` 400 + `VALIDATION_INVALID_VALUE`, `fieldName = "period"`).
  - `LlmGroupRow(String key, long callCount, BigDecimal costUsd)`, `LlmStatusRow(CallStatus status, long callCount, BigDecimal costUsd, long unpricedCount)`.
  - `LlmLogRepository#aggregateByStatusSince(Instant)`, `#aggregateByFeatureSince(Instant)`, `#aggregateByModelSince(Instant)`.
  - `LlmUsageService#breakdown(String period) -> LlmUsageBreakdownResponse`.
  - Generált DTO-k: `LlmUsageBreakdownResponse`, `LlmUsageTotals`, `LlmUsageGroup`.

- [ ] **Step 1: Bővítsd a kontraktust**

`api/feature/llm-usage/llm-usage.yml` — a `paths:` alá, a `summary` MELLÉ (azt ne bántsd):

```yaml
  /api/llm-usage/breakdown:
    get:
      tags: [LlmUsage]
      operationId: getLlmUsageBreakdown
      summary: LLM call + cost breakdown by feature and served model for one calendar period (LlmUsage)
      parameters:
        - name: period
          in: query
          required: true
          description: Calendar period in mezo.llm-log.report-zone (DAY = today, WEEK = from Monday, MONTH = from the 1st)
          schema: { type: string, pattern: '^(DAY|WEEK|MONTH)$' }
      responses:
        '200':
          description: Totals plus the feature and model rollups, cost-descending
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LlmUsageBreakdownResponse' }
        '400':
          description: Unknown period
          content:
            application/json:
              schema: { $ref: '../../common/common-schemas.yml#/components/schemas/SystemMessageList' }
```

…és a `components.schemas` alá:

```yaml
    LlmUsageBreakdownResponse:
      type: object
      required: [from, totals, features, models]
      properties:
        from: { type: string, format: date, description: "first day of the period in the report zone" }
        totals: { $ref: '#/components/schemas/LlmUsageTotals' }
        features:
          type: array
          description: "one entry per feature slug, cost-descending (unpriced last)"
          items: { $ref: '#/components/schemas/LlmUsageGroup' }
        models:
          type: array
          description: "one entry per SERVED model; key is null for calls that never reached one"
          items: { $ref: '#/components/schemas/LlmUsageGroup' }
    LlmUsageTotals:
      type: object
      required: [callCount, successCount, errorCount, cancelledCount, unpricedCount, currency]
      properties:
        callCount: { type: integer, format: int64, description: "every audited call in the period, all statuses" }
        successCount: { type: integer, format: int64 }
        errorCount: { type: integer, format: int64 }
        cancelledCount: { type: integer, format: int64 }
        unpricedCount: { type: integer, format: int64, description: "rows with a null cost_usd — why the sum is an estimate" }
        costUsd: { type: number, format: double, nullable: true, description: "summed cost of the PRICED rows; null when none is priced" }
        currency: { type: string, example: USD }
    LlmUsageGroup:
      type: object
      required: [callCount]
      properties:
        key: { type: string, nullable: true, description: "feature slug or served model id; null = unknown" }
        callCount: { type: integer, format: int64 }
        costUsd: { type: number, format: double, nullable: true }
```

Ellenőrizd, hogy a `common-schemas.yml` relatív útvonala megegyezik azzal, ahogy a többi fragment hivatkozza (`grep -n "common-schemas" api/feature/*/*.yml`), és azt használd.

- [ ] **Step 2: Generáld újra a kontraktust**

```bash
cd api/generate && npm run generate:api
```

Elvárt: `api/openapi.yml` módosul, benne a `/api/llm-usage/breakdown` path és a három új séma. Ha a merge hibázik: a fragmentnek önálló mini-dokumentumnak kell lennie (`openapi`/`info`/`paths`/`components`) — ez már így van.

- [ ] **Step 3: Írd meg a bukó integrációs tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageBreakdownIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageGroup;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * GET /api/llm-usage/breakdown (mezo-uakh) — the page header's feature/model rollups. Two rules
 * from ADR 0014 are asserted here rather than assumed: a null cost is UNKNOWN (never coalesced to
 * zero), and owner-less (cron/stream) rows are part of the report, not filtered out of it.
 */
class LlmUsageBreakdownIT extends ApiIntegrationTest {

    private static final String URI = "/api/llm-usage/breakdown?period=DAY";

    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testGetBreakdown_shouldReturnUnauthorized_whenNoToken() {
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetBreakdown_shouldReturnEmptyRollupsAndNullCost_whenNothingLogged() {
        LlmUsageBreakdownResponse body = breakdown("DAY");

        assertThat(body.getFrom()).isEqualTo(LocalDate.now(java.time.ZoneId.of("Europe/Budapest")));
        assertThat(body.getTotals().getCallCount()).isZero();
        assertThat(body.getTotals().getUnpricedCount()).isZero();
        assertThat(body.getTotals().getCostUsd()).isNull();
        assertThat(body.getTotals().getCurrency()).isEqualTo("USD");
        assertThat(body.getFeatures()).isEmpty();
        assertThat(body.getModels()).isEmpty();
    }

    @Test
    void testGetBreakdown_shouldGroupByFeatureCostDescending_whenPricedCallsLogged() {
        UUID owner = ownerId();
        llmLogPopulator.log(owner, CallKind.CHAT, "meal_coach", "gemini-2.5-flash", 1_000, 100,
            snapshot(), new BigDecimal("0.002000"));
        llmLogPopulator.log(owner, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 4_000, 400,
            snapshot(), new BigDecimal("0.010000"));
        llmLogPopulator.log(owner, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 1_000, 100,
            snapshot(), new BigDecimal("0.002500"));

        LlmUsageBreakdownResponse body = breakdown("DAY");

        assertThat(body.getTotals().getCallCount()).isEqualTo(3);
        assertThat(body.getTotals().getSuccessCount()).isEqualTo(3);
        assertThat(body.getTotals().getCostUsd()).isEqualTo(0.0145, within(1e-9));
        // companion_chat (0.0125) before meal_coach (0.002) — cost, not call count, orders it
        assertThat(body.getFeatures()).extracting(LlmUsageGroup::getKey)
            .containsExactly("companion_chat", "meal_coach");
        assertThat(body.getFeatures().getFirst().getCallCount()).isEqualTo(2);
        assertThat(body.getFeatures().getFirst().getCostUsd()).isEqualTo(0.0125, within(1e-9));
    }

    /** An unpriced row is COUNTED and reported as unpriced — its cost stays null, never 0.00. */
    @Test
    void testGetBreakdown_shouldCountUnpricedRowsSeparately_whenModelHasNoPricing() {
        UUID owner = ownerId();
        llmLogPopulator.log(owner, CallKind.CHAT, "quest_flavor", "unpriced-model", 50, 10);

        LlmUsageBreakdownResponse body = breakdown("DAY");

        assertThat(body.getTotals().getCallCount()).isEqualTo(1);
        assertThat(body.getTotals().getUnpricedCount()).isEqualTo(1);
        assertThat(body.getTotals().getCostUsd()).isNull();
        assertThat(body.getFeatures()).singleElement()
            .satisfies(g -> {
                assertThat(g.getKey()).isEqualTo("quest_flavor");
                assertThat(g.getCostUsd()).isNull();
            });
    }

    /** An ERROR row has no served model — it becomes its own null-keyed model group, not a drop. */
    @Test
    void testGetBreakdown_shouldKeepNullServedModelAsItsOwnGroup_whenCallErrored() {
        llmLogPopulator.logError(ownerId(), CallKind.VISION, "meal_draft", "gemini-2.5-flash", "GEMINI_ERROR");

        LlmUsageBreakdownResponse body = breakdown("DAY");

        assertThat(body.getTotals().getErrorCount()).isEqualTo(1);
        assertThat(body.getModels()).singleElement()
            .satisfies(g -> assertThat(g.getKey()).isNull());
    }

    /** Cron/@Async rows carry created_by = null; hiding them would hide the priciest traffic. */
    @Test
    void testGetBreakdown_shouldIncludeOwnerlessRows_whenLoggedByBackgroundJob() {
        llmLogPopulator.log(null, CallKind.CHAT, "proactive_briefing", "gemini-2.5-flash", 9_000, 500,
            snapshot(), new BigDecimal("0.030000"));

        LlmUsageBreakdownResponse body = breakdown("DAY");

        assertThat(body.getTotals().getCallCount()).isEqualTo(1);
        assertThat(body.getFeatures()).singleElement()
            .satisfies(g -> assertThat(g.getKey()).isEqualTo("proactive_briefing"));
    }

    @Test
    void testGetBreakdown_shouldReturnBadRequest_whenPeriodUnknown() {
        getForBody("/api/llm-usage/breakdown?period=FOREVER", ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
    }

    private LlmUsageBreakdownResponse breakdown(String period) {
        return getForBody("/api/llm-usage/breakdown?period=" + period, ownerAuthHeaders(),
            HttpStatus.OK, LlmUsageBreakdownResponse.class);
    }

    private static PricingSnapshot snapshot() {
        return new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.now());
    }
}
```

**Fontos:** a `LlmLogPopulator.log(...)` jelenleg `UUID createdBy`-t vár, és a `null` átadása működik (az oszlop nullable) — külön overload nem kell. Az `ownerId()` az `ApiIntegrationTest`-ből jön; ha ott nincs ilyen helper, nézd meg a `LlmUsageIT`-t (`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageIT.java`), és MÁSOLD azt a mintát, amit ott használ az owner id megszerzésére.

- [ ] **Step 4: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest=LlmUsageBreakdownIT
```

Elvárt: fordítási hiba (`LlmUsageBreakdownResponse` nem létezik, ha a Step 2 kimaradt) VAGY 404/500 a hiányzó endpointra.

- [ ] **Step 5: Írd meg a `UsagePeriod` enumot**

`backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/UsagePeriod.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * The three CALENDAR periods every usage read is cut on (mezo-uakh) — start of today, of this ISO
 * week (Monday) and of this month, in the configured report zone. They NEST: everything in DAY is
 * also in WEEK and MONTH.
 *
 * <p>Parsing lives here rather than on a generated enum because the contract carries {@code period}
 * as a pattern-validated string: a bad enum query parameter would otherwise reach Spring's type
 * conversion, which this app has no handler for and would answer with 500 (bd mezo-x0nb).
 */
public enum UsagePeriod {

    DAY,
    WEEK,
    MONTH;

    /** The first day the period covers, in {@code zone}. */
    public LocalDate startDate(ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        return switch (this) {
            case DAY -> today;
            case WEEK -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> today.withDayOfMonth(1);
        };
    }

    /** Case-sensitive by contract; anything else is a client error, not a server one. */
    public static UsagePeriod parse(String raw) {
        for (UsagePeriod period : values()) {
            if (period.name().equals(raw)) {
                return period;
            }
        }
        throw new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "period").build());
    }
}
```

Ellenőrizd a `SystemMessage.field(...)` builder pontos szignatúráját (`grep -n "field(" backend/src/main/java/io/mrkuhne/mezo/techcore/exception/SystemMessage.java`) és azt használd; a `GlobalExceptionHandler` a `MissingServletRequestPartException`-ágban ugyanezt a formát használja. Ha a `SystemRuntimeErrorException` konstruktora státuszt is vár, add meg a `HttpStatus.BAD_REQUEST`-et (nézd meg a `MealCoachService` vagy bármely `*_NOT_FOUND` dobás mintáját).

- [ ] **Step 6: Írd meg a projekciós recordokat**

`…/feature/llmlog/repository/LlmGroupRow.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;

/**
 * One rollup bucket over {@code llm_log_history} (mezo-uakh) — a feature slug or a served model.
 *
 * @param key the grouping value; {@code null} for calls that never reached a model (ERROR rows)
 * @param costUsd summed cost of the PRICED rows only, {@code null} when none is priced — kept null
 *     on purpose: "unknown" is not "free" (ADR 0014)
 */
public record LlmGroupRow(String key, long callCount, BigDecimal costUsd) {}
```

`…/feature/llmlog/repository/LlmStatusRow.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import java.math.BigDecimal;

/**
 * Per-status slice of a period (mezo-uakh). The service folds these into the response totals, so
 * ONE grouped query yields the call count, the status split, the cost sum and the unpriced count.
 *
 * @param unpricedCount rows in this status whose {@code cost_usd} is null
 */
public record LlmStatusRow(CallStatus status, long callCount, BigDecimal costUsd, long unpricedCount) {}
```

- [ ] **Step 7: Bővítsd a repositoryt**

`LlmLogRepository.java` — a meglévő `aggregateSince` UTÁN (azt hagyd változatlanul, a `summary` használja):

```java
    /**
     * Per-status slice of a period (mezo-uakh) — call count, cost sum and unpriced count in ONE
     * grouped pass. Deliberately NOT filtered by {@code created_by}: cron- and stream-written rows
     * carry a null owner, and an ownership filter would hide the highest-volume traffic.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmStatusRow(
            l.status, count(l), sum(l.costUsd),
            sum(case when l.costUsd is null then 1L else 0L end))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.status
        """)
    List<LlmStatusRow> aggregateByStatusSince(@Param("since") Instant since);

    /** Feature rollup for the page header; ordering is done in the service (see its javadoc). */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow(
            l.feature, count(l), sum(l.costUsd))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.feature
        """)
    List<LlmGroupRow> aggregateByFeatureSince(@Param("since") Instant since);

    /** Served-model rollup. A null {@code servedModel} (ERROR rows) forms its own group. */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow(
            l.servedModel, count(l), sum(l.costUsd))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.servedModel
        """)
    List<LlmGroupRow> aggregateByModelSince(@Param("since") Instant since);
```

Importok: `java.util.List`. (Az `Instant`, `Query`, `Param` már bent van.)

- [ ] **Step 8: Bővítsd a service-t**

`LlmUsageService.java` — a meglévő `summary()`-t **írd át** úgy, hogy a `UsagePeriod`-ot használja (DRY), és vedd fel a `breakdown()`-t:

```java
    /**
     * Read-only transaction so the three period aggregates share ONE snapshot: without it a call
     * logged between the month query and the day query could report {@code day > month}.
     */
    @Transactional(readOnly = true)
    public LlmUsageSummaryResponse summary() {
        ZoneId zone = llmLogProperties.reportZone();
        return LlmUsageSummaryResponse.builder()
            .day(period(UsagePeriod.DAY.startDate(zone), zone))
            .week(period(UsagePeriod.WEEK.startDate(zone), zone))
            .month(period(UsagePeriod.MONTH.startDate(zone), zone))
            .build();
    }

    /**
     * The AI-napló header (mezo-uakh): totals plus the feature and served-model rollups for ONE
     * calendar period. Same read-only-transaction reasoning as {@link #summary()} — the three
     * queries must see one snapshot or the buckets would not add up to the totals.
     */
    @Transactional(readOnly = true)
    public LlmUsageBreakdownResponse breakdown(String rawPeriod) {
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate from = UsagePeriod.parse(rawPeriod).startDate(zone);
        Instant since = from.atStartOfDay(zone).toInstant();

        return LlmUsageBreakdownResponse.builder()
            .from(from)
            .totals(totals(llmLogRepository.aggregateByStatusSince(since)))
            .features(groups(llmLogRepository.aggregateByFeatureSince(since)))
            .models(groups(llmLogRepository.aggregateByModelSince(since)))
            .build();
    }

    /** Folds the per-status rows into one totals block; a missing status is simply zero. */
    private LlmUsageTotals totals(List<LlmStatusRow> rows) {
        return LlmUsageTotals.builder()
            .callCount(rows.stream().mapToLong(LlmStatusRow::callCount).sum())
            .successCount(countOf(rows, CallStatus.SUCCESS))
            .errorCount(countOf(rows, CallStatus.ERROR))
            .cancelledCount(countOf(rows, CallStatus.CANCELLED))
            .unpricedCount(rows.stream().mapToLong(LlmStatusRow::unpricedCount).sum())
            .costUsd(toDouble(sumCost(rows.stream().map(LlmStatusRow::costUsd).toList())))
            .currency(llmPricingProperties.currency())
            .build();
    }

    /**
     * Cost-descending, unpriced last, ties broken by call count.
     *
     * <p>Sorted in Java rather than with an HQL {@code order by … nulls last}: the ordering has to
     * express "unknown cost sorts last", the buckets are a handful of rows (one per feature slug),
     * and doing it here keeps the comparator readable and dialect-independent.
     */
    private List<LlmUsageGroup> groups(List<LlmGroupRow> rows) {
        return rows.stream()
            .sorted(Comparator
                .comparing(LlmGroupRow::costUsd, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Comparator.comparingLong(LlmGroupRow::callCount).reversed()))
            .map(r -> LlmUsageGroup.builder()
                .key(r.key())
                .callCount(r.callCount())
                .costUsd(toDouble(r.costUsd()))
                .build())
            .toList();
    }

    private static long countOf(List<LlmStatusRow> rows, CallStatus status) {
        return rows.stream().filter(r -> r.status() == status).mapToLong(LlmStatusRow::callCount).sum();
    }

    /** null + null stays null; any priced row makes the sum a number. */
    private static BigDecimal sumCost(List<BigDecimal> costs) {
        return costs.stream().filter(java.util.Objects::nonNull)
            .reduce(BigDecimal::add)
            .orElse(null);
    }
```

Importok, amiket fel kell venni: `io.mrkuhne.mezo.api.dto.{LlmUsageBreakdownResponse, LlmUsageGroup, LlmUsageTotals}`, `io.mrkuhne.mezo.feature.llmlog.entity.CallStatus`, `io.mrkuhne.mezo.feature.llmlog.repository.{LlmGroupRow, LlmStatusRow}`, `java.time.Instant`, `java.util.Comparator`, `java.util.List`. A `DayOfWeek`/`TemporalAdjusters` importok **törölhetők** (átköltöztek a `UsagePeriod`-ba).

- [ ] **Step 9: Kösd be a controllerbe**

`LlmUsageController.java`:

```java
    @Override
    public LlmUsageBreakdownResponse getLlmUsageBreakdown(String period) {
        return service.breakdown(period);
    }
```

A generált `LlmUsageApi` metódus-szignatúrája a mérvadó — ha a generátor `String period` helyett mást ad (pl. `@Valid` annotációkkal), azt kövesd. Nézd meg: `find backend/target -name "LlmUsageApi.java"` a `./mvnw clean test` után.

- [ ] **Step 10: Vedd fel a hibaüzenet-kulcsot**

`backend/src/main/resources/messages.properties` — ha a `VALIDATION_INVALID_VALUE` kulcs MÁR létezik (`grep -n "VALIDATION_INVALID_VALUE" backend/src/main/resources/messages.properties`), NE vedd fel újra; ez a lépés csak akkor tesz bármit, ha hiányzik.

- [ ] **Step 11: Futtasd — legyen zöld**

```bash
cd backend && ./mvnw clean test -Dtest=LlmUsageBreakdownIT
```

Elvárt: mind a 7 teszt PASS. Ha a `testGetBreakdown_shouldReturnBadRequest_whenPeriodUnknown` 500-at kap, akkor a `UsagePeriod.parse` nem fut le a konverzió előtt — ilyenkor NE az enumot cseréld: ellenőrizd, hogy a kontraktus-paraméter tényleg `string` (nem `enum`), mert enumnál a generátor típusos enumot csinál, és a konverziós hiba 500 lesz (mezo-x0nb).

- [ ] **Step 12: Futtasd a teljes llmlog-csomagot (regresszió)**

```bash
cd backend && ./mvnw clean test -Dtest='Llm*'
```

Elvárt: a meglévő `LlmUsageIT` is zöld marad (a `summary()` átírása nem változtatott viselkedést).

- [ ] **Step 13: Commit**

```bash
git add api/feature/llm-usage/llm-usage.yml api/openapi.yml backend/src/main/java backend/src/main/resources/messages.properties backend/src/test/java
git commit -m "feat(api): LLM usage breakdown endpoint — feature + model rollups (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Backend — `GET /api/llm-usage/calls` (lista)

**Files:**
- Modify: `api/feature/llm-usage/llm-usage.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmCallRow.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageController.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallListIT.java`

**Interfaces:**
- Consumes: `UsagePeriod` (Task 1), `LlmLogProperties#reportZone()`.
- Produces:
  - `LlmCallRow` record (a JPQL-projekció; mezősorrendje KÖTELEZŐEN egyezik a `select new` sorrendjével).
  - `LlmLogRepository#findCalls(Instant since, String feature, CallStatus status, CallKind callKind, Pageable pageable) -> List<LlmCallRow>`.
  - `LlmUsageService#listCalls(String period, String feature, String status, String callKind, Integer limit) -> LlmCallListResponse`.
  - Generált DTO-k: `LlmCallListResponse`, `LlmCallListItem`.

- [ ] **Step 1: Bővítsd a kontraktust**

`paths:` alá:

```yaml
  /api/llm-usage/calls:
    get:
      tags: [LlmUsage]
      operationId: listLlmCalls
      summary: Audited LLM calls of a period, newest first, without the payload (LlmUsage)
      parameters:
        - name: period
          in: query
          required: true
          schema: { type: string, pattern: '^(DAY|WEEK|MONTH)$' }
        - name: feature
          in: query
          required: false
          description: exact feature slug, e.g. companion_chat
          schema: { type: string, maxLength: 100 }
        - name: status
          in: query
          required: false
          schema: { type: string, pattern: '^(SUCCESS|ERROR|CANCELLED)$' }
        - name: callKind
          in: query
          required: false
          schema: { type: string, pattern: '^(CHAT|CHAT_STREAM|VISION|SMART|TOOL|TRANSCRIBE|EMBED_DOC|EMBED_QUERY)$' }
        - name: limit
          in: query
          required: false
          description: growing window — the client raises it to load more (never an offset)
          schema: { type: integer, format: int32, minimum: 1, maximum: 500, default: 50 }
      responses:
        '200':
          description: The newest `limit` calls matching the filters
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LlmCallListResponse' }
        '400':
          description: Unknown period, status or call kind
          content:
            application/json:
              schema: { $ref: '../../common/common-schemas.yml#/components/schemas/SystemMessageList' }
```

`components.schemas` alá:

```yaml
    LlmCallListResponse:
      type: object
      required: [items, hasMore]
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/LlmCallListItem' }
        hasMore: { type: boolean, description: "true when the period holds more rows than the window shows" }
    LlmCallListItem:
      type: object
      required: [id, createdAt, feature, callKind, status, requestedModel, latencyMs, streamed]
      properties:
        id: { type: string, format: uuid }
        createdAt: { type: string, format: date-time }
        feature: { type: string }
        operation: { type: string, nullable: true }
        callKind:
          type: string
          enum: [CHAT, CHAT_STREAM, VISION, SMART, TOOL, TRANSCRIBE, EMBED_DOC, EMBED_QUERY]
        status:
          type: string
          enum: [SUCCESS, ERROR, CANCELLED]
        requestedModel: { type: string }
        servedModel: { type: string, nullable: true }
        latencyMs: { type: integer, format: int32 }
        streamed: { type: boolean }
        toolRounds: { type: integer, format: int32, nullable: true }
        totalTokens: { type: integer, format: int32, nullable: true }
        imageCount: { type: integer, format: int32, nullable: true }
        embedInputCount: { type: integer, format: int32, nullable: true }
        embedDimensions: { type: integer, format: int32, nullable: true }
        costUsd: { type: number, format: double, nullable: true }
        errorClass: { type: string, nullable: true }
        errorCode: { type: string, nullable: true }
```

**A `callKind`/`status` a VÁLASZBAN enum** (a szerver állítja elő, sosem konvertálódik bejövő adatból), a QUERY-ben `pattern` — ez szándékos, lásd a spec §5-öt.

- [ ] **Step 2: Generáld újra**

```bash
cd api/generate && npm run generate:api
```

- [ ] **Step 3: Bővítsd a populátort**

`LlmLogPopulator.java` — vedd fel ezt a metódust (a meglévőket ne bántsd):

```java
    /**
     * Full-shape row for the list/filter tests (mezo-uakh): status, kind, feature and timestamp are
     * all caller-chosen, and the payload columns are filled so a test can assert that the LIST
     * response does not carry them.
     */
    public LlmLogEntity logCall(Instant createdAt, UUID createdBy, CallKind kind, CallStatus status,
            String feature, String operation, String servedModel, BigDecimal costUsd) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(kind);
        entity.setStatus(status);
        entity.setFeature(feature);
        entity.setOperation(operation);
        entity.setRequestedModel(servedModel == null ? "gemini-2.5-flash" : servedModel);
        entity.setServedModel(servedModel);
        entity.setLatencyMs(120);
        entity.setPromptTokens(100);
        entity.setCandidatesTokens(20);
        entity.setTotalTokens(120);
        entity.setSystemPrompt("SYS");
        entity.setUserMessage("USR");
        entity.setResponseText("RSP");
        entity.setPayloadBytes(9);
        entity.setCostUsd(costUsd);
        LlmLogEntity saved = llmLogRepository.saveAndFlush(entity);
        if (createdAt != null) {
            jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
                Timestamp.from(createdAt), saved.getId());
        }
        return saved;
    }
```

- [ ] **Step 4: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallListIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallListItem;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * GET /api/llm-usage/calls (mezo-uakh) — the browsable audit list. Two things this endpoint must
 * never do: leak the (up to 64k-per-column) payload into a list row, and page with an offset that
 * duplicates rows as new calls land on top.
 */
class LlmCallListIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testListCalls_shouldReturnUnauthorized_whenNoToken() {
        getForBody("/api/llm-usage/calls?period=DAY", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListCalls_shouldReturnNewestFirst_whenSeveralCallsLogged() {
        Instant now = Instant.now();
        llmLogPopulator.logCall(now.minus(3, ChronoUnit.MINUTES), ownerId(), CallKind.CHAT,
            CallStatus.SUCCESS, "meal_coach", "verdict", "gemini-2.5-flash", new BigDecimal("0.001"));
        llmLogPopulator.logCall(now.minus(1, ChronoUnit.MINUTES), ownerId(), CallKind.CHAT_STREAM,
            CallStatus.SUCCESS, "companion_chat", "stream", "gemini-2.5-flash", new BigDecimal("0.002"));

        LlmCallListResponse body = list("period=DAY");

        assertThat(body.getItems()).extracting(LlmCallListItem::getFeature)
            .containsExactly("companion_chat", "meal_coach");
        assertThat(body.getHasMore()).isFalse();
    }

    /** The payload columns exist on the row but must not travel with the list. */
    @Test
    void testListCalls_shouldOmitPayloadFields_whenRowHasThem() {
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", new BigDecimal("0.002"));

        String raw = exchangeForResponse("/api/llm-usage/calls?period=DAY",
            org.springframework.http.HttpMethod.GET, null, ownerAuthHeaders(), HttpStatus.OK).getBody();

        assertThat(raw).doesNotContain("SYS").doesNotContain("USR").doesNotContain("RSP");
    }

    @Test
    void testListCalls_shouldNarrowToOneFeature_whenFeatureFilterGiven() {
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "meal_coach", "verdict", "gemini-2.5-flash", null);

        assertThat(list("period=DAY&feature=meal_coach").getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getFeature()).isEqualTo("meal_coach"));
    }

    @Test
    void testListCalls_shouldNarrowToErrors_whenStatusFilterGiven() {
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.VISION, CallStatus.ERROR,
            "meal_draft", "photo", null, null);

        assertThat(list("period=DAY&status=ERROR").getItems())
            .singleElement()
            .satisfies(i -> {
                assertThat(i.getStatus()).isEqualTo(LlmCallListItem.StatusEnum.ERROR);
                assertThat(i.getServedModel()).isNull();
            });
    }

    @Test
    void testListCalls_shouldCombineFilters_whenFeatureAndKindGiven() {
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.CHAT_STREAM, CallStatus.SUCCESS,
            "companion_chat", "stream", "gemini-2.5-flash", null);

        assertThat(list("period=DAY&feature=companion_chat&callKind=CHAT_STREAM").getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getOperation()).isEqualTo("stream"));
    }

    /** The growing window: a small limit truncates and SAYS so; a large one shows everything. */
    @Test
    void testListCalls_shouldFlagMoreRows_whenWindowSmallerThanThePeriod() {
        for (int i = 0; i < 12; i++) {
            llmLogPopulator.logCall(Instant.now().minus(i, ChronoUnit.MINUTES), ownerId(),
                CallKind.CHAT, CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", null);
        }

        LlmCallListResponse small = list("period=DAY&limit=5");
        assertThat(small.getItems()).hasSize(5);
        assertThat(small.getHasMore()).isTrue();

        LlmCallListResponse full = list("period=DAY&limit=20");
        assertThat(full.getItems()).hasSize(12);
        assertThat(full.getHasMore()).isFalse();
    }

    @Test
    void testListCalls_shouldExcludeOlderRows_whenLoggedBeforeThePeriodStart() {
        llmLogPopulator.logCall(Instant.now().minus(40, ChronoUnit.DAYS), ownerId(), CallKind.CHAT,
            CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", null);

        assertThat(list("period=DAY").getItems()).isEmpty();
        assertThat(list("period=MONTH").getItems()).isEmpty();
    }

    @Test
    void testListCalls_shouldReturnBadRequest_whenStatusUnknown() {
        getForBody("/api/llm-usage/calls?period=DAY&status=WOBBLY", ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
    }

    private LlmCallListResponse list(String query) {
        return getForBody("/api/llm-usage/calls?" + query, ownerAuthHeaders(),
            HttpStatus.OK, LlmCallListResponse.class);
    }
}
```

**Megjegyzés a `LlmCallListItem.StatusEnum`-ról:** a generátor a válasz-enumot beágyazott enumként hozza létre; a PONTOS nevet a generált forrásból vedd (`find backend/target -name "LlmCallListItem.java"` a build után), és ahhoz igazítsd az assertet. A `40 nap` a `MONTH` teszthez azért biztonságos, mert a naptári hónap legfeljebb 31 napos.

- [ ] **Step 5: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallListIT
```

- [ ] **Step 6: Írd meg a `LlmCallRow` projekciót**

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One audit row as the LIST needs it (mezo-uakh) — metadata only. The payload columns
 * ({@code system_prompt}, {@code user_message}, {@code response_text}) are deliberately absent:
 * each can hold 64 000 characters, so they must not leave the database for a list of 50 rows.
 *
 * <p>The component order IS the {@code select new} order in
 * {@link LlmLogRepository#findCalls} — changing one without the other is a runtime failure.
 */
public record LlmCallRow(
    UUID id,
    Instant createdAt,
    String feature,
    String operation,
    CallKind callKind,
    CallStatus status,
    String requestedModel,
    String servedModel,
    int latencyMs,
    boolean streamed,
    Integer toolRounds,
    Integer totalTokens,
    Integer imageCount,
    Integer embedInputCount,
    Integer embedDimensions,
    BigDecimal costUsd,
    String errorClass,
    String errorCode) {}
```

- [ ] **Step 7: Vedd fel a lista-queryt**

`LlmLogRepository.java`:

```java
    /**
     * The browsable list (mezo-uakh): newest first, metadata only, every filter optional via the
     * {@code (:param is null or …)} idiom. No owner filter — same reason as the aggregates.
     *
     * <p>The caller asks for {@code limit + 1} rows: getting that many is how the service knows
     * more exist, without paying for a second {@code count(*)} on every load-more.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmCallRow(
            l.id, l.createdAt, l.feature, l.operation, l.callKind, l.status,
            l.requestedModel, l.servedModel, l.latencyMs, l.streamed, l.toolRounds,
            l.totalTokens, l.imageCount, l.embedInputCount, l.embedDimensions,
            l.costUsd, l.errorClass, l.errorCode)
        from LlmLogEntity l
        where l.createdAt >= :since
          and (:feature is null or l.feature = :feature)
          and (:status is null or l.status = :status)
          and (:callKind is null or l.callKind = :callKind)
        order by l.createdAt desc
        """)
    List<LlmCallRow> findCalls(@Param("since") Instant since,
                               @Param("feature") String feature,
                               @Param("status") CallStatus status,
                               @Param("callKind") CallKind callKind,
                               Pageable pageable);
```

Importok: `org.springframework.data.domain.Pageable`, `io.mrkuhne.mezo.feature.llmlog.entity.{CallKind, CallStatus}`.

Ha a `:status is null` összehasonlítás enum-paraméterrel Hibernate-hibát ad („could not determine type"), a bevett megoldás a `(:status is null or l.status = :status)` helyett `(cast(:status as string) is null or l.status = :status)` — de ELŐSZÖR próbáld az egyszerű formát, a legtöbb Hibernate 6/7 verzió elfogadja.

- [ ] **Step 8: Írd meg a service-metódust**

`LlmUsageService.java`:

```java
    /** The list window's default and hard ceiling — mirrored by the contract's min/max/default. */
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 500;

    /**
     * The browsable audit list (mezo-uakh). {@code limit} is a GROWING WINDOW, not a page offset:
     * the client raises it to see more, so every response is one consistent read from the top of
     * the log and rows can neither duplicate nor be skipped as new calls arrive.
     */
    @Transactional(readOnly = true)
    public LlmCallListResponse listCalls(String rawPeriod, String feature, String rawStatus,
                                         String rawCallKind, Integer rawLimit) {
        ZoneId zone = llmLogProperties.reportZone();
        Instant since = UsagePeriod.parse(rawPeriod).startDate(zone).atStartOfDay(zone).toInstant();
        int limit = Math.clamp(rawLimit == null ? DEFAULT_LIMIT : rawLimit, 1, MAX_LIMIT);

        List<LlmCallRow> rows = llmLogRepository.findCalls(
            since,
            blankToNull(feature),
            parseEnum(rawStatus, CallStatus::valueOf, "status"),
            parseEnum(rawCallKind, CallKind::valueOf, "callKind"),
            PageRequest.of(0, limit + 1));

        boolean hasMore = rows.size() > limit;
        return LlmCallListResponse.builder()
            .items(rows.stream().limit(limit).map(this::toListItem).toList())
            .hasMore(hasMore)
            .build();
    }

    private LlmCallListItem toListItem(LlmCallRow row) {
        return LlmCallListItem.builder()
            .id(row.id())
            .createdAt(row.createdAt().atOffset(ZoneOffset.UTC))
            .feature(row.feature())
            .operation(row.operation())
            .callKind(LlmCallListItem.CallKindEnum.fromValue(row.callKind().name()))
            .status(LlmCallListItem.StatusEnum.fromValue(row.status().name()))
            .requestedModel(row.requestedModel())
            .servedModel(row.servedModel())
            .latencyMs(row.latencyMs())
            .streamed(row.streamed())
            .toolRounds(row.toolRounds())
            .totalTokens(row.totalTokens())
            .imageCount(row.imageCount())
            .embedInputCount(row.embedInputCount())
            .embedDimensions(row.embedDimensions())
            .costUsd(toDouble(row.costUsd()))
            .errorClass(row.errorClass())
            .errorCode(row.errorCode())
            .build();
    }

    /** An unknown filter value is a client error (400), not a 500 — see UsagePeriod's javadoc. */
    private static <E> E parseEnum(String raw, java.util.function.Function<String, E> factory, String field) {
        String value = blankToNull(raw);
        if (value == null) {
            return null;
        }
        try {
            return factory.apply(value);
        } catch (IllegalArgumentException ex) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", field).build());
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
```

**A generált enum-átalakítás:** a `LlmCallListItem.CallKindEnum.fromValue(...)` a generátor szokásos alakja; ha a generált osztályban más a neve (pl. nincs beágyazott enum, mert a generátor külön osztályt csinált), IGAZÍTSD a generált forráshoz — de a DTO-t NE írd át kézzel.

`Math.clamp` Java 21-ben elérhető. Importok: `org.springframework.data.domain.PageRequest`, `java.time.ZoneOffset`, `io.mrkuhne.mezo.api.dto.{LlmCallListItem, LlmCallListResponse}`, `io.mrkuhne.mezo.feature.llmlog.entity.{CallKind, CallStatus}`, `io.mrkuhne.mezo.feature.llmlog.repository.LlmCallRow`, `io.mrkuhne.mezo.techcore.exception.{SystemMessage, SystemRuntimeErrorException}`.

- [ ] **Step 9: Kösd be a controllerbe**

```java
    @Override
    public LlmCallListResponse listLlmCalls(String period, String feature, String status,
                                            String callKind, Integer limit) {
        return service.listCalls(period, feature, status, callKind, limit);
    }
```

A paraméter-sorrend a generált `LlmUsageApi`-ból jön — ellenőrizd, és ahhoz igazodj.

- [ ] **Step 10: Futtasd — legyen zöld**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallListIT
```

Elvárt: mind a 9 teszt PASS.

- [ ] **Step 11: Commit**

```bash
git add api/feature/llm-usage/llm-usage.yml api/openapi.yml backend/src
git commit -m "feat(api): browsable LLM call list with server-side filters (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Backend — `GET /api/llm-usage/calls/{id}` (részlet)

**Files:**
- Modify: `api/feature/llm-usage/llm-usage.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/mapper/LlmLogMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallDetailIT.java`

**Interfaces:**
- Consumes: `LlmLogRepository#findById` (JpaRepository), `LlmCallListItem` sémabővítés.
- Produces: `LlmLogMapper#toDetail(LlmLogEntity) -> LlmCallDetailResponse`, `LlmUsageService#call(UUID) -> LlmCallDetailResponse`.

- [ ] **Step 1: Bővítsd a kontraktust**

`paths:` alá:

```yaml
  /api/llm-usage/calls/{id}:
    get:
      tags: [LlmUsage]
      operationId: getLlmCall
      summary: One audited LLM call with its verbatim payload and frozen price snapshot (LlmUsage)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The full audit row
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LlmCallDetailResponse' }
        '404':
          description: No such call
          content:
            application/json:
              schema: { $ref: '../../common/common-schemas.yml#/components/schemas/SystemMessageList' }
```

`components.schemas` alá:

```yaml
    LlmCallDetailResponse:
      type: object
      required: [id, createdAt, feature, callKind, status, requestedModel, latencyMs, streamed, truncated, payloadBytes]
      properties:
        id: { type: string, format: uuid }
        createdAt: { type: string, format: date-time }
        createdBy: { type: string, format: uuid, nullable: true, description: "null for cron/stream calls — no security context on that thread" }
        feature: { type: string }
        operation: { type: string, nullable: true }
        entityKind: { type: string, nullable: true }
        entityId: { type: string, format: uuid, nullable: true }
        callKind:
          type: string
          enum: [CHAT, CHAT_STREAM, VISION, SMART, TOOL, TRANSCRIBE, EMBED_DOC, EMBED_QUERY]
        status:
          type: string
          enum: [SUCCESS, ERROR, CANCELLED]
        requestedModel: { type: string }
        servedModel: { type: string, nullable: true }
        errorCode: { type: string, nullable: true }
        errorClass: { type: string, nullable: true }
        latencyMs: { type: integer, format: int32 }
        streamed: { type: boolean }
        toolRounds: { type: integer, format: int32, nullable: true }
        serviceTier: { type: string, nullable: true }
        promptTokens: { type: integer, format: int32, nullable: true, description: "RAW provider count — INCLUDES cachedTokens" }
        candidatesTokens: { type: integer, format: int32, nullable: true }
        thoughtsTokens: { type: integer, format: int32, nullable: true }
        cachedTokens: { type: integer, format: int32, nullable: true }
        totalTokens: { type: integer, format: int32, nullable: true }
        embedInputCount: { type: integer, format: int32, nullable: true }
        embedDimensions: { type: integer, format: int32, nullable: true }
        embedBillableChars: { type: integer, format: int32, nullable: true }
        imageCount: { type: integer, format: int32, nullable: true }
        imageBytesTotal: { type: integer, format: int64, nullable: true }
        imageMime: { type: string, nullable: true }
        systemPrompt: { type: string, nullable: true }
        userMessage: { type: string, nullable: true }
        responseText: { type: string, nullable: true }
        truncated: { type: boolean, description: "a payload column was cut to mezo.llm-log.max-payload-chars" }
        payloadBytes: { type: integer, format: int32, description: "TRUE pre-truncation payload size in bytes" }
        costUsd: { type: number, format: double, nullable: true }
        pricingSnapshot: { $ref: '#/components/schemas/LlmPricingSnapshot' }
    LlmPricingSnapshot:
      type: object
      nullable: true
      description: Unit prices FROZEN onto the call at write time — the cost was derived from these, not from live config
      properties:
        sourceModel: { type: string, nullable: true }
        currency: { type: string, nullable: true }
        inputPerMillion: { type: number, format: double, nullable: true }
        outputPerMillion: { type: number, format: double, nullable: true }
        thinkingPerMillion: { type: number, format: double, nullable: true }
        cachedPerMillion: { type: number, format: double, nullable: true }
        embedPerMillionChars: { type: number, format: double, nullable: true }
        pricedOn: { type: string, format: date, nullable: true }
```

- [ ] **Step 2: Generáld újra**

```bash
cd api/generate && npm run generate:api
```

- [ ] **Step 3: Vedd fel a hibaüzenetet**

`backend/src/main/resources/messages.properties` — a többi `*_NOT_FOUND` mellé:

```properties
LLM_LOG_CALL_NOT_FOUND=A naplózott hívás nem található.
```

(A fájl a legutóbbi bejegyzéseknél magyar szöveget használ — ezt követjük. Ha a fájl ASCII-escape nélkül tárol ékezetet, írd simán: `A naplózott hívás nem található.` — a formátumot a szomszédos sorokból másold.)

- [ ] **Step 4: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallDetailIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * GET /api/llm-usage/calls/{id} (mezo-uakh) — the debug view's source. This is the ONLY endpoint
 * that returns the verbatim prompt/response, and the only one that exposes the frozen price
 * snapshot the cost was derived from.
 */
class LlmCallDetailIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testGetCall_shouldReturnUnauthorized_whenNoToken() {
        getForBody("/api/llm-usage/calls/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetCall_shouldReturnThePayloadAndSnapshot_whenCallExists() {
        LlmLogEntity row = llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.TOOL,
            CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", new BigDecimal("0.058"));

        LlmCallDetailResponse body = detail(row.getId());

        assertThat(body.getFeature()).isEqualTo("companion_chat");
        assertThat(body.getOperation()).isEqualTo("send");
        assertThat(body.getSystemPrompt()).isEqualTo("SYS");
        assertThat(body.getUserMessage()).isEqualTo("USR");
        assertThat(body.getResponseText()).isEqualTo("RSP");
        assertThat(body.getPayloadBytes()).isEqualTo(9);
        assertThat(body.getTruncated()).isFalse();
        assertThat(body.getCostUsd()).isEqualTo(0.058);
    }

    /** A cron-written row has no owner; the detail must say so honestly rather than 500. */
    @Test
    void testGetCall_shouldReturnNullCreatedBy_whenLoggedByBackgroundJob() {
        LlmLogEntity row = llmLogPopulator.logCall(Instant.now(), null, CallKind.CHAT,
            CallStatus.SUCCESS, "proactive_briefing", "generate", "gemini-2.5-flash", null);

        assertThat(detail(row.getId()).getCreatedBy()).isNull();
    }

    /** An ERROR row: the reason survives, provider usage and cost do not. */
    @Test
    void testGetCall_shouldReturnErrorFieldsWithoutUsage_whenCallFailed() {
        LlmLogEntity row = llmLogPopulator.logError(ownerId(), CallKind.VISION, "meal_draft",
            "gemini-2.5-flash", "GEMINI_ERROR");

        LlmCallDetailResponse body = detail(row.getId());

        assertThat(body.getErrorCode()).isEqualTo("GEMINI_ERROR");
        assertThat(body.getServedModel()).isNull();
        assertThat(body.getCostUsd()).isNull();
        assertThat(body.getPricingSnapshot()).isNull();
    }

    @Test
    void testGetCall_shouldReturnNotFound_whenIdUnknown() {
        String raw = exchangeForResponse("/api/llm-usage/calls/" + UUID.randomUUID(),
            org.springframework.http.HttpMethod.GET, null, ownerAuthHeaders(), HttpStatus.NOT_FOUND).getBody();

        assertHasRequestError(raw, "LLM_LOG_CALL_NOT_FOUND");
    }

    private LlmCallDetailResponse detail(UUID id) {
        return getForBody("/api/llm-usage/calls/" + id, ownerAuthHeaders(),
            HttpStatus.OK, LlmCallDetailResponse.class);
    }
}
```

Az `assertHasRequestError(...)` az `ApiIntegrationTest` helpere — ellenőrizd a szignatúráját, és ha `String responseBody, String code` sorrendű, így jó.

- [ ] **Step 5: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallDetailIT
```

- [ ] **Step 6: Írd meg a mappert**

`backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/mapper/LlmLogMapper.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.mapper;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmPricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/**
 * The audit row → detail DTO mapping (mezo-uakh). Written as default methods rather than generated
 * field mappings because three things need explicit handling and would be wrong by default: the
 * jsonb {@link PricingSnapshot} value object, the {@code BigDecimal} → {@code Double} money
 * conversion (null must STAY null — "unpriced" is not "free"), and {@code Instant} →
 * {@code OffsetDateTime} for the contract's date-time.
 */
@Mapper(componentModel = "spring")
public interface LlmLogMapper {

    default LlmCallDetailResponse toDetail(LlmLogEntity e) {
        return LlmCallDetailResponse.builder()
            .id(e.getId())
            .createdAt(toOffset(e.getCreatedAt()))
            .createdBy(e.getCreatedBy())
            .feature(e.getFeature())
            .operation(e.getOperation())
            .entityKind(e.getEntityKind())
            .entityId(e.getEntityId())
            .callKind(LlmCallDetailResponse.CallKindEnum.fromValue(e.getCallKind().name()))
            .status(LlmCallDetailResponse.StatusEnum.fromValue(e.getStatus().name()))
            .requestedModel(e.getRequestedModel())
            .servedModel(e.getServedModel())
            .errorCode(e.getErrorCode())
            .errorClass(e.getErrorClass())
            .latencyMs(e.getLatencyMs())
            .streamed(e.isStreamed())
            .toolRounds(e.getToolRounds())
            .serviceTier(e.getServiceTier())
            .promptTokens(e.getPromptTokens())
            .candidatesTokens(e.getCandidatesTokens())
            .thoughtsTokens(e.getThoughtsTokens())
            .cachedTokens(e.getCachedTokens())
            .totalTokens(e.getTotalTokens())
            .embedInputCount(e.getEmbedInputCount())
            .embedDimensions(e.getEmbedDimensions())
            .embedBillableChars(e.getEmbedBillableChars())
            .imageCount(e.getImageCount())
            .imageBytesTotal(e.getImageBytesTotal())
            .imageMime(e.getImageMime())
            .systemPrompt(e.getSystemPrompt())
            .userMessage(e.getUserMessage())
            .responseText(e.getResponseText())
            .truncated(e.isTruncated())
            .payloadBytes(e.getPayloadBytes())
            .costUsd(toDouble(e.getCostUsd()))
            .pricingSnapshot(toSnapshot(e.getPricingSnapshot()))
            .build();
    }

    default LlmPricingSnapshot toSnapshot(PricingSnapshot s) {
        return s == null ? null : LlmPricingSnapshot.builder()
            .sourceModel(s.sourceModel())
            .currency(s.currency())
            .inputPerMillion(toDouble(s.inputPerMillion()))
            .outputPerMillion(toDouble(s.outputPerMillion()))
            .thinkingPerMillion(toDouble(s.thinkingPerMillion()))
            .cachedPerMillion(toDouble(s.cachedPerMillion()))
            .embedPerMillionChars(toDouble(s.embedPerMillionChars()))
            .pricedOn(s.pricedOn())
            .build();
    }

    /** null STAYS null: an absent price is "unknown", never a confident zero (ADR 0014). */
    default Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    default OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

- [ ] **Step 7: Írd meg a service-metódust**

```java
    /**
     * One audited call in full (mezo-uakh) — the only read that returns the verbatim payload.
     * No ownership check: the log has rows with no owner at all (cron/stream), and this is a
     * single-user app behind JWT (ADR 0014).
     */
    @Transactional(readOnly = true)
    public LlmCallDetailResponse call(UUID id) {
        return llmLogRepository.findById(id)
            .map(llmLogMapper::toDetail)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("LLM_LOG_CALL_NOT_FOUND").build()));
    }
```

Vedd fel a `private final LlmLogMapper llmLogMapper;` mezőt (a `@RequiredArgsConstructor` bekapja). A 404-es státuszt a `SystemRuntimeErrorException` konstruktora/`SystemMessage` builder adja — MÁSOLD egy meglévő `*_NOT_FOUND` dobás pontos alakját (pl. `grep -rn "PATTERN_NOT_FOUND" backend/src/main/java`), hogy a státusz tényleg 404 legyen.

- [ ] **Step 8: Kösd be a controllerbe**

```java
    @Override
    public LlmCallDetailResponse getLlmCall(UUID id) {
        return service.call(id);
    }
```

- [ ] **Step 9: Futtasd — legyen zöld**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallDetailIT
```

- [ ] **Step 10: Teljes backend-regresszió**

```bash
cd backend && ./mvnw clean test
```

Elvárt: az EGÉSZ suite zöld. Ha OOM-ol a gépen, futtasd `-Dtest='Llm*'`-mel, és hagyd a teljes futást a CI-ra (a self-PR a hiteles kapu).

- [ ] **Step 11: Commit**

```bash
git add api backend/src
git commit -m "feat(api): LLM call detail endpoint with payload + frozen price snapshot (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — adatréteg (kliens + 3 hook + mockok)

**Files:**
- Modify: `frontend/src/data/me/llmUsageApi.ts`
- Modify: `frontend/src/data/me/llmUsageHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Test: `frontend/src/data/me/llmUsageHooks.test.tsx` (bővítés)

**Interfaces:**
- Consumes: a Task 1–3 kontraktus (`api.gen.ts` sémái).
- Produces:
  - Típusok: `LlmUsageBreakdownResponse`, `LlmUsageGroup`, `LlmCallListResponse`, `LlmCallListItem`, `LlmCallDetailResponse`, `LlmUsagePeriodKey = 'DAY'|'WEEK'|'MONTH'`, `LlmCallFilters = { feature?: string; status?: string; callKind?: string }`.
  - `llmUsageApi.getBreakdown(period)`, `.listCalls(period, filters, limit)`, `.getCall(id)`.
  - Hookok: `useLlmUsageBreakdown(period)`, `useLlmCalls(period, filters, limit)`, `useLlmCall(id)` — mind `{data, isPending, isError, refetch}`.
  - Mock seedek: `LLM_BREAKDOWN_MOCK`, `LLM_CALLS_MOCK`, `LLM_CALL_DETAIL_MOCK`.

- [ ] **Step 1: Generáld a FE-típusokat**

```bash
cd frontend && pnpm generate:api
```

Elvárt: `src/data/_client/api.gen.ts` módosul, benne a hat új séma.

- [ ] **Step 2: Bővítsd az API-klienst**

`frontend/src/data/me/llmUsageApi.ts` — a meglévő tartalom UTÁN (a `getSummary`-t ne bántsd):

```ts
export type LlmUsageBreakdownResponse = components['schemas']['LlmUsageBreakdownResponse']
export type LlmUsageGroup = components['schemas']['LlmUsageGroup']
export type LlmCallListResponse = components['schemas']['LlmCallListResponse']
export type LlmCallListItem = components['schemas']['LlmCallListItem']
export type LlmCallDetailResponse = components['schemas']['LlmCallDetailResponse']

/** The three calendar periods the backend cuts every rollup on (mezo.llm-log.report-zone). */
export type LlmUsagePeriodKey = 'DAY' | 'WEEK' | 'MONTH'

/** Server-side filters — an omitted key means "don't narrow on this axis". */
export interface LlmCallFilters {
  feature?: string
  status?: string
  callKind?: string
}

function callsQuery(period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number): string {
  const params = new URLSearchParams({ period, limit: String(limit) })
  if (filters.feature) params.set('feature', filters.feature)
  if (filters.status) params.set('status', filters.status)
  if (filters.callKind) params.set('callKind', filters.callKind)
  return params.toString()
}
```

…és bővítsd az exportált objektumot:

```ts
export const llmUsageApi = {
  getSummary: (): Promise<LlmUsageSummaryResponse> =>
    apiFetch<LlmUsageSummaryResponse>('/api/llm-usage/summary'),
  getBreakdown: (period: LlmUsagePeriodKey): Promise<LlmUsageBreakdownResponse> =>
    apiFetch<LlmUsageBreakdownResponse>(`/api/llm-usage/breakdown?period=${period}`),
  listCalls: (period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number): Promise<LlmCallListResponse> =>
    apiFetch<LlmCallListResponse>(`/api/llm-usage/calls?${callsQuery(period, filters, limit)}`),
  getCall: (id: string): Promise<LlmCallDetailResponse> =>
    apiFetch<LlmCallDetailResponse>(`/api/llm-usage/calls/${id}`),
}
```

- [ ] **Step 3: Írd meg a bukó hook-tesztet**

`frontend/src/data/me/llmUsageHooks.test.tsx` — a meglévő tesztek MELLÉ (nézd meg a fájl jelenlegi szerkezetét, és kövesd a mintáját; ha nem létezik, hozd létre a `AiUsageCard.test.tsx` MSW-mintája szerint):

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { useLlmUsageBreakdown, useLlmCalls, LLM_BREAKDOWN_EMPTY } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

describe('useLlmUsageBreakdown (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns the honest empty (never the seed) while unresolved, then the fetched rollup', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () =>
        HttpResponse.json({
          from: '2026-08-14',
          totals: { callCount: 3, successCount: 3, errorCount: 0, cancelledCount: 0, unpricedCount: 1, costUsd: 0.5, currency: 'USD' },
          features: [{ key: 'companion_chat', callCount: 3, costUsd: 0.5 }],
          models: [{ key: 'gemini-2.5-flash', callCount: 3, costUsd: 0.5 }],
        }),
      ),
    )

    const { result } = renderHook(() => useLlmUsageBreakdown('DAY'), { wrapper: QueryWrapper })

    // the unresolved window must NOT show the mock seed
    expect(result.current.data).toEqual(LLM_BREAKDOWN_EMPTY)
    await waitFor(() => expect(result.current.data.totals.callCount).toBe(3))
    expect(result.current.data.features[0].key).toBe('companion_chat')
  })
})

describe('useLlmCalls (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('passes the filters and the limit as query parameters', async () => {
    let seen = ''
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({ items: [], hasMore: false })
      }),
    )

    const { result } = renderHook(
      () => useLlmCalls('WEEK', { feature: 'meal_coach', status: 'ERROR' }, 100),
      { wrapper: QueryWrapper },
    )

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(seen).toContain('period=WEEK')
    expect(seen).toContain('feature=meal_coach')
    expect(seen).toContain('status=ERROR')
    expect(seen).toContain('limit=100')
  })
})
```

- [ ] **Step 4: Futtasd — bukjon**

```bash
cd frontend && pnpm test llmUsageHooks
```

Elvárt: FAIL — `useLlmUsageBreakdown` nem exportált.

- [ ] **Step 5: Írd meg a hookokat és a seedeket**

`frontend/src/data/me/llmUsageHooks.ts` — a meglévő `useLlmUsageSummary` UTÁN:

```ts
/** Honest empty for real mode: zero everything and NULL cost — an unresolved read must not read as $0. */
export const LLM_BREAKDOWN_EMPTY: LlmUsageBreakdownResponse = {
  from: '',
  totals: { callCount: 0, successCount: 0, errorCount: 0, cancelledCount: 0, unpricedCount: 0, costUsd: null, currency: 'USD' },
  features: [],
  models: [],
}

/** Believable demo rollup for mock mode — the real feature slugs, one unpriced bucket. */
export const LLM_BREAKDOWN_MOCK: LlmUsageBreakdownResponse = {
  from: '2026-08-10',
  totals: { callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7, unpricedCount: 38, costUsd: 1.86, currency: 'USD' },
  features: [
    { key: 'companion_chat', callCount: 96, costUsd: 0.74 },
    { key: 'companion_hypothesis', callCount: 21, costUsd: 0.39 },
    { key: 'proactive_briefing', callCount: 7, costUsd: 0.21 },
    { key: 'meal_draft', callCount: 34, costUsd: 0.18 },
    { key: 'meal_coach', callCount: 29, costUsd: 0.12 },
    { key: 'embed_memory', callCount: 148, costUsd: 0.09 },
    { key: 'proactive_heartbeat', callCount: 28, costUsd: 0.07 },
    { key: 'quest_flavor', callCount: 6, costUsd: null },
  ],
  models: [
    { key: 'gemini-2.5-flash', callCount: 241, costUsd: 1.12 },
    { key: 'gemini-2.5-pro', callCount: 23, costUsd: 0.65 },
    { key: 'gemini-embedding-001', callCount: 148, costUsd: 0.09 },
  ],
}

export const LLM_CALLS_EMPTY: LlmCallListResponse = { items: [], hasMore: false }

export const LLM_CALLS_MOCK: LlmCallListResponse = {
  items: [
    { id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-08-14T12:32:00Z', feature: 'companion_chat', operation: 'stream', callKind: 'CHAT_STREAM', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 3100, streamed: true, toolRounds: null, totalTokens: 4812, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.021, errorClass: null, errorCode: null },
    { id: '22222222-2222-4222-8222-222222222222', createdAt: '2026-08-14T12:31:00Z', feature: 'companion_chat', operation: 'send', callKind: 'TOOL', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 7812, streamed: false, toolRounds: 2, totalTokens: 11204, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.0583, errorClass: null, errorCode: null },
    { id: '33333333-3333-4333-8333-333333333333', createdAt: '2026-08-14T12:28:00Z', feature: 'meal_draft', operation: 'photo', callKind: 'VISION', status: 'ERROR', requestedModel: 'gemini-2.5-flash', servedModel: null, latencyMs: 12000, streamed: false, toolRounds: null, totalTokens: null, imageCount: 1, embedInputCount: null, embedDimensions: null, costUsd: null, errorClass: 'ResourceExhaustedException', errorCode: null },
    { id: '44444444-4444-4444-8444-444444444444', createdAt: '2026-08-14T12:19:00Z', feature: 'companion_chat', operation: 'stream', callKind: 'CHAT_STREAM', status: 'CANCELLED', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 1400, streamed: true, toolRounds: null, totalTokens: null, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: null, errorClass: null, errorCode: null },
    { id: '55555555-5555-4555-8555-555555555555', createdAt: '2026-08-14T12:02:00Z', feature: 'embed_memory', operation: 'document', callKind: 'EMBED_DOC', status: 'SUCCESS', requestedModel: 'gemini-embedding-001', servedModel: 'gemini-embedding-001', latencyMs: 400, streamed: false, toolRounds: null, totalTokens: null, imageCount: null, embedInputCount: 12, embedDimensions: 768, costUsd: 0.0004, errorClass: null, errorCode: null },
    { id: '66666666-6666-4666-8666-666666666666', createdAt: '2026-08-14T11:47:00Z', feature: 'companion_hypothesis', operation: 'critique', callKind: 'SMART', status: 'SUCCESS', requestedModel: 'gemini-2.5-pro', servedModel: 'gemini-2.5-pro', latencyMs: 22600, streamed: false, toolRounds: null, totalTokens: 18902, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.184, errorClass: null, errorCode: null },
    { id: '77777777-7777-4777-8777-777777777777', createdAt: '2026-08-14T03:45:00Z', feature: 'proactive_briefing', operation: 'generate', callKind: 'CHAT', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 5200, streamed: false, toolRounds: null, totalTokens: 9341, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.031, errorClass: null, errorCode: null },
  ],
  hasMore: true,
}

export const LLM_CALL_DETAIL_EMPTY: LlmCallDetailResponse = {
  id: '', createdAt: '', createdBy: null, feature: '', operation: null, entityKind: null, entityId: null,
  callKind: 'CHAT', status: 'SUCCESS', requestedModel: '', servedModel: null, errorCode: null, errorClass: null,
  latencyMs: 0, streamed: false, toolRounds: null, serviceTier: null,
  promptTokens: null, candidatesTokens: null, thoughtsTokens: null, cachedTokens: null, totalTokens: null,
  embedInputCount: null, embedDimensions: null, embedBillableChars: null,
  imageCount: null, imageBytesTotal: null, imageMime: null,
  systemPrompt: null, userMessage: null, responseText: null,
  truncated: false, payloadBytes: 0, costUsd: null, pricingSnapshot: null,
}

export const LLM_CALL_DETAIL_MOCK: LlmCallDetailResponse = {
  ...LLM_CALL_DETAIL_EMPTY,
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-08-14T12:31:07Z',
  createdBy: '00000000-0000-4000-8000-000000000001',
  feature: 'companion_chat', operation: 'send', entityKind: 'conversation',
  entityId: '8f2acccc-cccc-4ccc-8ccc-cccccccccc41',
  callKind: 'TOOL', status: 'SUCCESS',
  requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash',
  latencyMs: 7812, streamed: false, toolRounds: 2, serviceTier: 'standard',
  promptTokens: 5826, candidatesTokens: 1008, thoughtsTokens: 3474, cachedTokens: 896, totalTokens: 11204,
  systemPrompt: 'Te vagy Mezo, Daniel személyes egészség- és teljesítmény-társa.',
  userMessage: 'most ettem egy nagy adag rizses csirkét, írd be kb 600 kcal-nak',
  responseText: 'Beírtam: Rizses csirke — 600 kcal, 48 g fehérje, 62 g szénhidrát, 14 g zsír, ebédre.',
  truncated: false, payloadBytes: 3584, costUsd: 0.0583,
  pricingSnapshot: {
    sourceModel: 'gemini-2.5-flash', currency: 'USD',
    inputPerMillion: 0.3, outputPerMillion: 2.5, thinkingPerMillion: 2.5,
    cachedPerMillion: 0.075, embedPerMillionChars: null, pricedOn: '2026-08-14',
  },
}

/** Feature/model cost rollup for the selected period — the AI-napló header (mezo-uakh). */
export function useLlmUsageBreakdown(period: LlmUsagePeriodKey) {
  return useDualQuery({
    queryKey: ['llmUsageBreakdown', period],
    mockData: LLM_BREAKDOWN_MOCK,
    realFetch: () => llmUsageApi.getBreakdown(period),
    realEmpty: LLM_BREAKDOWN_EMPTY,
    realStaleTime: 60_000,
  })
}

/**
 * The audit list. `limit` is a GROWING WINDOW (the page raises it to load more), so it belongs in
 * the queryKey — each width is its own cached read, and no page accumulation state is needed.
 */
export function useLlmCalls(period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number) {
  return useDualQuery({
    queryKey: ['llmCalls', period, filters.feature ?? null, filters.status ?? null, filters.callKind ?? null, limit],
    mockData: LLM_CALLS_MOCK,
    realFetch: () => llmUsageApi.listCalls(period, filters, limit),
    realEmpty: LLM_CALLS_EMPTY,
    realStaleTime: 30_000,
  })
}

/** One call in full, including the verbatim payload — the detail page's only read. */
export function useLlmCall(id: string) {
  return useDualQuery({
    queryKey: ['llmCall', id],
    mockData: LLM_CALL_DETAIL_MOCK,
    realFetch: () => llmUsageApi.getCall(id),
    realEmpty: LLM_CALL_DETAIL_EMPTY,
    realStaleTime: Infinity,
  })
}
```

Bővítsd a fájl tetején az importot: `import { llmUsageApi, type LlmUsageSummaryResponse, type LlmUsageBreakdownResponse, type LlmCallListResponse, type LlmCallDetailResponse, type LlmUsagePeriodKey, type LlmCallFilters } from '@/data/me/llmUsageApi'`.

**Megjegyzés a mock-szűrésről:** a mock-mód seedje SZÁNDÉKOSAN nem szűr — a szűrés szerveroldali, és a mock-mód célja a demó-felület, nem a szűrő-szimuláció. A `AiUsagePage` tesztje ezért a szűrő-viselkedést real-módban (MSW-vel) ellenőrzi.

- [ ] **Step 6: Re-exportáld a barrelből**

`frontend/src/data/hooks.ts` — a meglévő `useLlmUsageSummary` re-export mellé vedd fel a hármat (a fájl formátumát kövesd: `grep -n "llmUsage" frontend/src/data/hooks.ts`).

- [ ] **Step 7: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test llmUsageHooks && VITE_USE_MOCK=true pnpm test llmUsageHooks
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data
git commit -m "feat(me): LLM audit data layer — breakdown/list/detail hooks (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — pure formázók (`llmCallFormat.ts`)

**Files:**
- Create: `frontend/src/features/me/logic/llmCallFormat.ts`
- Test: `frontend/src/features/me/logic/llmCallFormat.test.ts`

**Interfaces:**
- Consumes: `LlmCallDetailResponse` típus (Task 4).
- Produces (a többi FE-task ezeket hívja — a nevek KÖTELEZŐEK):
  - `formatCost(costUsd: number | null | undefined): string` — `$0.0583` → 4 tizedes 0.01 alatt, 2 fölötte; null ⇒ `'—'`

    **Miért nem a meglévő `formatUsageCost`:** az (az `AiUsageCard`-ban) MINDIG 2 tizedest ír, ami a *periódus-összegre* helyes, de egy hívás költségét (`$0.0004`) `$0.00`-ra lapítaná — vagyis pont az „ingyen volt" látszatot keltené, amit az egész feature kerülni akar. A kártya formázója **változatlan marad** a helyén; a két függvény szándékosan él egymás mellett, és a null ⇒ `'—'` szabály mindkettőben ugyanaz.
  - `formatTokens(n: number | null | undefined): string` — `11204` → `'11 204'`; null ⇒ `'—'`
  - `formatLatency(ms: number): string` — `<1000` ⇒ `'812 ms'`, fölötte `'7.8 s'`
  - `formatTime(iso: string): string` — `'14:32'` (Europe/Budapest)
  - `callKindLabel(kind: string): string` — rövid badge-felirat
  - `statusTone(status: string): 'ok' | 'error' | 'cancelled'`
  - `tokenSegments(d: LlmCallDetailResponse): { key: string; label: string; value: number; percent: number }[]`

- [ ] **Step 1: Írd meg a bukó tesztet**

```ts
import { describe, it, expect } from 'vitest'
import {
  formatCost, formatTokens, formatLatency, callKindLabel, statusTone, tokenSegments,
} from '@/features/me/logic/llmCallFormat'
import { LLM_CALL_DETAIL_MOCK, LLM_CALL_DETAIL_EMPTY } from '@/data/me/llmUsageHooks'

describe('formatCost', () => {
  it('dashes an unknown cost instead of showing zero', () => {
    expect(formatCost(null)).toBe('—')
    expect(formatCost(undefined)).toBe('—')
  })

  it('keeps sub-cent costs readable and rounds larger ones to cents', () => {
    expect(formatCost(0.0004)).toBe('$0.0004')
    expect(formatCost(0.0583)).toBe('$0.0583')
    expect(formatCost(1.86)).toBe('$1.86')
    expect(formatCost(0)).toBe('$0.0000')
  })
})

describe('formatTokens', () => {
  it('groups thousands with a non-breaking space and dashes unknown counts', () => {
    expect(formatTokens(11204)).toBe('11 204')
    expect(formatTokens(120)).toBe('120')
    expect(formatTokens(null)).toBe('—')
  })
})

describe('formatLatency', () => {
  it('switches from milliseconds to seconds above a second', () => {
    expect(formatLatency(812)).toBe('812 ms')
    expect(formatLatency(7812)).toBe('7.8 s')
    expect(formatLatency(22600)).toBe('22.6 s')
  })
})

describe('callKindLabel / statusTone', () => {
  it('labels every call kind and maps every status to a tone', () => {
    expect(callKindLabel('CHAT_STREAM')).toBe('STREAM')
    expect(callKindLabel('EMBED_DOC')).toBe('EMBED')
    expect(callKindLabel('TOOL')).toBe('TOOL')
    expect(statusTone('SUCCESS')).toBe('ok')
    expect(statusTone('ERROR')).toBe('error')
    expect(statusTone('CANCELLED')).toBe('cancelled')
  })
})

describe('tokenSegments', () => {
  it('splits the reported counts into percentage segments that sum to 100', () => {
    const segments = tokenSegments(LLM_CALL_DETAIL_MOCK)

    expect(segments.map((s) => s.key)).toEqual(['prompt', 'candidates', 'thoughts', 'cached'])
    // prompt is stored RAW (it INCLUDES cached), so the bar must show the NET prompt slice
    expect(segments[0].value).toBe(5826 - 896)
    expect(segments[2].value).toBe(3474)
    expect(Math.round(segments.reduce((sum, s) => sum + s.percent, 0))).toBe(100)
  })

  it('returns no segments when the provider reported no usage at all', () => {
    expect(tokenSegments(LLM_CALL_DETAIL_EMPTY)).toEqual([])
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && pnpm test llmCallFormat
```

- [ ] **Step 3: Írd meg az implementációt**

```ts
import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// Pure formatters for the AI-napló surfaces (mezo-uakh). Kept out of the components so the two
// rules that matter — an unknown value renders as an em dash, and the token bar shows the NET
// prompt — are asserted once, here, instead of per component.

/** An unknown (null) money value is "—": unpriced is not free (ADR 0014). */
export function formatCost(costUsd: number | null | undefined): string {
  if (costUsd == null) return '—'
  // Per-call costs live in the sub-cent range; two decimals would render most of them as $0.00.
  return costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('hu-HU').replace(/\s/g, ' ')
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('hu-HU', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest',
  })
}

const KIND_LABELS: Record<string, string> = {
  CHAT: 'CHAT',
  CHAT_STREAM: 'STREAM',
  VISION: 'KÉP',
  SMART: 'SMART',
  TOOL: 'TOOL',
  TRANSCRIBE: 'HANG',
  EMBED_DOC: 'EMBED',
  EMBED_QUERY: 'EMBED?',
}

export function callKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

export function statusTone(status: string): 'ok' | 'error' | 'cancelled' {
  if (status === 'ERROR') return 'error'
  if (status === 'CANCELLED') return 'cancelled'
  return 'ok'
}

export interface TokenSegment {
  key: string
  label: string
  value: number
  percent: number
}

/**
 * The four billable token slices of one call, as bar segments.
 *
 * `promptTokens` is stored RAW and INCLUDES `cachedTokens` (Gemini reports cached as a subset), so
 * the prompt segment shows the NET value — otherwise the cached tokens would be drawn twice and
 * the bar would not match what the call was billed.
 */
export function tokenSegments(d: LlmCallDetailResponse): TokenSegment[] {
  const cached = d.cachedTokens ?? 0
  const raw = [
    { key: 'prompt', label: 'prompt', value: Math.max((d.promptTokens ?? 0) - cached, 0) },
    { key: 'candidates', label: 'válasz', value: d.candidatesTokens ?? 0 },
    { key: 'thoughts', label: 'gondolkodás', value: d.thoughtsTokens ?? 0 },
    { key: 'cached', label: 'cache-elt', value: cached },
  ]
  const total = raw.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return []
  return raw.map((s) => ({ ...s, percent: (s.value / total) * 100 }))
}
```

- [ ] **Step 4: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test llmCallFormat && VITE_USE_MOCK=true pnpm test llmCallFormat
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/logic
git commit -m "feat(me): pure formatters for the AI audit surfaces (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — fejléc-komponensek (hero + feature-bontás + modell-bontás)

**Files:**
- Create: `frontend/src/features/me/components/AiUsageHero.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/components/AiFeatureBreakdown.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/components/AiModelBreakdown.tsx`

**Interfaces:**
- Consumes: `formatCost`/`formatTokens` (Task 5), `LlmUsageBreakdownResponse`/`LlmUsageGroup` típusok (Task 4).
- Produces:
  - `<AiUsageHero totals={LlmUsageTotals} periodLabel={string} />`
  - `<AiFeatureBreakdown groups={LlmUsageGroup[]} selected={string | null} onSelect={(feature: string | null) => void} />`
  - `<AiModelBreakdown groups={LlmUsageGroup[]} />`

- [ ] **Step 1: Írd meg a bukó teszteket**

`AiUsageHero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiUsageHero } from '@/features/me/components/AiUsageHero'

const TOTALS = {
  callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7,
  unpricedCount: 38, costUsd: 1.86, currency: 'USD',
}

describe('AiUsageHero', () => {
  it('shows the call count, the cost and the status split', () => {
    render(<AiUsageHero totals={TOTALS} periodLabel="Ez a hét" />)

    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('$1.86')).toBeInTheDocument()
    expect(screen.getByText('Ez a hét')).toBeInTheDocument()
    expect(screen.getByText(/381 sikeres/)).toBeInTheDocument()
    expect(screen.getByText(/24 hiba/)).toBeInTheDocument()
    expect(screen.getByText(/7 megszakadt/)).toBeInTheDocument()
  })

  it('explains the estimate by naming the unpriced rows', () => {
    render(<AiUsageHero totals={TOTALS} periodLabel="Ez a hét" />)
    expect(screen.getByText(/38 hívás árazatlan/)).toBeInTheDocument()
  })

  it('dashes the cost when no row in the period is priced', () => {
    render(<AiUsageHero totals={{ ...TOTALS, costUsd: null }} periodLabel="Ma" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

`AiFeatureBreakdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AiFeatureBreakdown } from '@/features/me/components/AiFeatureBreakdown'

const GROUPS = [
  { key: 'companion_chat', callCount: 96, costUsd: 0.74 },
  { key: 'meal_draft', callCount: 34, costUsd: 0.18 },
  { key: 'quest_flavor', callCount: 6, costUsd: null },
]

describe('AiFeatureBreakdown', () => {
  it('renders one row per feature with its call count and cost', () => {
    render(<AiFeatureBreakdown groups={GROUPS} selected={null} onSelect={() => {}} />)

    expect(screen.getByText('companion_chat')).toBeInTheDocument()
    expect(screen.getByText('$0.74')).toBeInTheDocument()
    // an unpriced bucket shows a dash, not $0.00
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('selects a feature on click and clears it when the selected one is clicked again', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <AiFeatureBreakdown groups={GROUPS} selected={null} onSelect={onSelect} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /companion_chat/ }))
    expect(onSelect).toHaveBeenCalledWith('companion_chat')

    rerender(<AiFeatureBreakdown groups={GROUPS} selected="companion_chat" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /companion_chat/ }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('collapses to the top rows and expands on demand', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ key: `f${i}`, callCount: 1, costUsd: 0.01 }))
    render(<AiFeatureBreakdown groups={many} selected={null} onSelect={() => {}} />)

    expect(screen.queryByText('f11')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mind/ }))
    expect(screen.getByText('f11')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && pnpm test AiUsageHero AiFeatureBreakdown
```

- [ ] **Step 3: Írd meg az `AiUsageHero`-t**

```tsx
import { formatCost } from '@/features/me/logic/llmCallFormat'
import type { components } from '@/data/_client/api.gen'

type Totals = components['schemas']['LlmUsageTotals']

// The AI-napló header (mezo-uakh): the two numbers that answer "how much did the period cost",
// with the honesty footnote right under them — the cost is a SUM OF PRICED ROWS ONLY, so the
// unpriced count is what makes it an estimate rather than a fact.

export function AiUsageHero({ totals, periodLabel }: { totals: Totals; periodLabel: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px 15px', background: 'var(--wash-coral, var(--surface-2))' }}>
      <div className="eyebrow">{periodLabel}</div>

      <div className="row" style={{ gap: 26, marginTop: 7 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
            {totals.callCount}
          </div>
          <div className="text-tertiary" style={{ fontSize: 10.5, fontWeight: 600 }}>hívás</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
            {formatCost(totals.costUsd)}
          </div>
          <div className="text-tertiary" style={{ fontSize: 10.5, fontWeight: 600 }}>becsült költség</div>
        </div>
      </div>

      <div className="text-tertiary" style={{ fontSize: 11, marginTop: 9 }}>
        {totals.successCount} sikeres · {totals.errorCount} hiba · {totals.cancelledCount} megszakadt
      </div>
      {totals.unpricedCount > 0 && (
        <div className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
          {totals.unpricedCount} hívás árazatlan — ezek nincsenek az összegben
        </div>
      )}
    </div>
  )
}
```

**Színek:** ha a `--wash-coral` token nem létezik, használd azt a wash-tokent, amit a Me-oldal más kártyái (`grep -n "wash-" frontend/src/features/me/components/*.tsx`) — RAW hex NEM megengedett.

- [ ] **Step 4: Írd meg az `AiFeatureBreakdown`-t**

```tsx
import { useState } from 'react'
import { formatCost } from '@/features/me/logic/llmCallFormat'
import type { LlmUsageGroup } from '@/data/me/llmUsageApi'

// Feature rollup as a bar list (mezo-uakh). The bar is proportional to COST, not call count —
// the question this answers is "what burns the money", and a cheap high-volume feature
// (embed_memory) must not out-draw an expensive rare one (companion_hypothesis).

const COLLAPSED = 8

export function AiFeatureBreakdown({ groups, selected, onSelect }: {
  groups: LlmUsageGroup[]
  selected: string | null
  onSelect: (feature: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? groups : groups.slice(0, COLLAPSED)
  // Widths are relative to the biggest bucket; an unpriced (null) bucket has no width to give.
  const max = Math.max(...groups.map((g) => g.costUsd ?? 0), 0)

  return (
    <div className="card" style={{ padding: '11px 0 4px' }}>
      <div className="eyebrow" style={{ padding: '0 13px 6px' }}>Feature szerint</div>

      {shown.map((g) => {
        const key = g.key ?? 'unknown'
        const isSelected = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isSelected ? null : key)}
            aria-pressed={isSelected}
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
              padding: '8px 13px', background: isSelected ? 'var(--surface-2)' : 'transparent',
            }}
          >
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{key}</span>
              <span className="text-tertiary" style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
                {g.callCount}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sage-deep)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCost(g.costUsd)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', marginTop: 5 }}>
              <div style={{
                height: '100%', borderRadius: 3, background: 'var(--brand)',
                width: max > 0 ? `${((g.costUsd ?? 0) / max) * 100}%` : '0%',
              }} />
            </div>
          </button>
        )
      })}

      {groups.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '8px 13px', fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}
        >
          {expanded ? 'Kevesebb' : `Mind (${groups.length})`}
        </button>
      )}
    </div>
  )
}
```

Ellenőrizd a `--brand` és `--sage-deep` tokenek létezését (`grep -rn "\-\-brand\b" frontend/src/styles` vagy az `AiUsageCard.tsx` `--sage-deep` használata); ha a `--brand` nem létezik, használd azt a coral-tokent, amit a Me-felület máshol használ.

- [ ] **Step 5: Írd meg az `AiModelBreakdown`-t**

```tsx
import { formatCost } from '@/features/me/logic/llmCallFormat'
import type { LlmUsageGroup } from '@/data/me/llmUsageApi'

// Served-model rollup (mezo-uakh) — a horizontal strip, because there are three models at most.
// A null key is a call that never reached a model (an ERROR row), shown as "ismeretlen" rather
// than dropped: those calls happened and their absence from the cost is the point.

export function AiModelBreakdown({ groups }: { groups: LlmUsageGroup[] }) {
  if (groups.length === 0) return null
  return (
    <div className="card" style={{ padding: '11px 0 12px' }}>
      <div className="eyebrow" style={{ padding: '0 13px 8px' }}>Modell szerint</div>
      <div className="row" style={{ gap: 7, padding: '0 13px', overflowX: 'auto' }}>
        {groups.map((g) => (
          <div key={g.key ?? 'unknown'} style={{ flexShrink: 0, background: 'var(--surface-2)', borderRadius: 12, padding: '7px 11px', minWidth: 96 }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{g.key ?? 'ismeretlen'}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{g.callCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage-deep)' }}>{formatCost(g.costUsd)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test AiUsageHero AiFeatureBreakdown && VITE_USE_MOCK=true pnpm test AiUsageHero AiFeatureBreakdown
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me/components
git commit -m "feat(me): AI-napló header components — hero, feature and model breakdown (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Frontend — lista-komponensek (szűrőchipek + hívás-sor)

**Files:**
- Create: `frontend/src/features/me/components/AiCallFilters.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/components/AiCallRow.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: Task 4 típusok, Task 5 formázók.
- Produces:
  - `<AiCallFilters totals={LlmUsageTotals} filters={LlmCallFilters} onChange={(next: LlmCallFilters) => void} />`
  - `<AiCallRow call={LlmCallListItem} />` — a teljes sor egy `<Link to={/me/ai-usage/${call.id}}>`

- [ ] **Step 1: Írd meg a bukó teszteket**

`AiCallRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AiCallRow } from '@/features/me/components/AiCallRow'
import { LLM_CALLS_MOCK } from '@/data/me/llmUsageHooks'

const [stream, tool, failed, cancelled, embed] = LLM_CALLS_MOCK.items

function renderRow(call: typeof stream) {
  return render(<AiCallRow call={call} />, { wrapper: MemoryRouter })
}

describe('AiCallRow', () => {
  it('links to the call detail page', () => {
    renderRow(tool)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href', `/me/ai-usage/${tool.id}`,
    )
  })

  it('shows feature, operation, kind badge, tokens, latency and cost', () => {
    renderRow(tool)
    expect(screen.getByText('companion_chat')).toBeInTheDocument()
    expect(screen.getByText(/send/)).toBeInTheDocument()
    expect(screen.getByText('TOOL')).toBeInTheDocument()
    expect(screen.getByText('11 204')).toBeInTheDocument()
    expect(screen.getByText('7.8 s')).toBeInTheDocument()
    expect(screen.getByText('$0.0583')).toBeInTheDocument()
  })

  it('shows the error reason and no cost on a failed call', () => {
    renderRow(failed)
    expect(screen.getByText(/ResourceExhaustedException/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('explains a cancelled stream instead of leaving it blank', () => {
    renderRow(cancelled)
    expect(screen.getByText(/megszakadt/i)).toBeInTheDocument()
  })

  it('shows the batch size and dimensions on an embedding call', () => {
    renderRow(embed)
    expect(screen.getByText(/12 db/)).toBeInTheDocument()
    expect(screen.getByText(/768/)).toBeInTheDocument()
  })

  it('marks a streamed call', () => {
    renderRow(stream)
    expect(screen.getByText('STREAM')).toBeInTheDocument()
  })
})
```

`AiCallFilters.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AiCallFilters } from '@/features/me/components/AiCallFilters'

const TOTALS = {
  callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7,
  unpricedCount: 38, costUsd: 1.86, currency: 'USD',
}

describe('AiCallFilters', () => {
  it('shows the error and cancelled counts on their chips', () => {
    render(<AiCallFilters totals={TOTALS} filters={{}} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Hiba 24/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Megszakadt 7/ })).toBeInTheDocument()
  })

  it('sets a status filter on click and clears it when clicked again', () => {
    const onChange = vi.fn()
    const { rerender } = render(<AiCallFilters totals={TOTALS} filters={{}} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Hiba/ }))
    expect(onChange).toHaveBeenCalledWith({ status: 'ERROR' })

    rerender(<AiCallFilters totals={TOTALS} filters={{ status: 'ERROR' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Hiba/ }))
    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it('surfaces the active feature filter with a way to clear it', () => {
    const onChange = vi.fn()
    render(<AiCallFilters totals={TOTALS} filters={{ feature: 'meal_coach' }} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /meal_coach/ }))
    expect(onChange).toHaveBeenCalledWith({})
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && pnpm test AiCallRow AiCallFilters
```

- [ ] **Step 3: Írd meg az `AiCallRow`-t**

```tsx
import { Link } from 'react-router-dom'
import {
  callKindLabel, formatCost, formatLatency, formatTime, formatTokens, statusTone,
} from '@/features/me/logic/llmCallFormat'
import type { LlmCallListItem } from '@/data/me/llmUsageApi'

// One audit row in the list (mezo-uakh). Two lines: identity on top, the numbers below. A failed
// or cancelled call gets an extra explanatory strip — those rows are the reason the page exists,
// and an empty cost cell alone would read as "free" rather than "never answered".

const TONE_COLOR: Record<'ok' | 'error' | 'cancelled', string> = {
  ok: 'var(--sage-deep)',
  error: 'var(--danger, var(--brand))',
  cancelled: 'var(--gold-deep, var(--text-tertiary))',
}

/** The usage cell says whatever the call kind actually measured — tokens, images or vectors. */
function usageLabel(call: LlmCallListItem): string {
  if (call.embedInputCount != null) {
    return `${call.embedInputCount} db · ${call.embedDimensions ?? '?'} d`
  }
  if (call.imageCount != null) return `${call.imageCount} kép`
  return call.totalTokens != null ? `${formatTokens(call.totalTokens)} tok` : 'usage n/a'
}

export function AiCallRow({ call }: { call: LlmCallListItem }) {
  const tone = statusTone(call.status)

  return (
    <Link
      to={`/me/ai-usage/${call.id}`}
      className="card"
      style={{ display: 'block', padding: '10px 12px', marginTop: 7, borderLeft: `3px solid ${TONE_COLOR[tone]}`, color: 'inherit' }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span className="text-tertiary" style={{ fontSize: 10.5, width: 38, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(call.createdAt)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>
          {call.feature}
          {call.operation && <span className="text-tertiary" style={{ fontWeight: 500, fontSize: 11 }}> · {call.operation}</span>}
        </span>
        <span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 5, padding: '2px 5px', background: 'var(--surface-2)' }}>
          {callKindLabel(call.callKind)}{call.toolRounds ? ` ×${call.toolRounds}` : ''}
        </span>
      </div>

      <div className="row text-tertiary" style={{ alignItems: 'center', gap: 9, marginTop: 6, fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
        <span>{call.servedModel ?? `${call.requestedModel} kért`}</span>
        <span>{usageLabel(call)}</span>
        <span>{formatLatency(call.latencyMs)}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12, color: call.costUsd == null ? 'var(--text-tertiary)' : 'var(--sage-deep)' }}>
          {formatCost(call.costUsd)}
        </span>
      </div>

      {tone === 'error' && (
        <div style={{ marginTop: 6, borderRadius: 8, padding: '5px 8px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
          HIBA · {call.errorClass ?? 'ismeretlen'}{call.errorCode ? ` · ${call.errorCode}` : ''}
        </div>
      )}
      {tone === 'cancelled' && (
        <div style={{ marginTop: 6, borderRadius: 8, padding: '5px 8px', fontSize: 10.5, fontWeight: 600, background: 'var(--surface-2)' }}>
          MEGSZAKADT · a kliens lecsatlakozott — a részleges válasz megvan
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Írd meg az `AiCallFilters`-t**

```tsx
import type { components } from '@/data/_client/api.gen'
import type { LlmCallFilters as Filters } from '@/data/me/llmUsageApi'

type Totals = components['schemas']['LlmUsageTotals']

// The list's filter strip (mezo-uakh). Every chip toggles: clicking the active one clears it, so
// there is never a filter you cannot get out of. The feature chip is not chosen here — it arrives
// from the breakdown bars above — but it IS shown here so the active narrowing lives in one place.

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 11px',
    cursor: 'pointer', border: '1px solid var(--border, var(--surface-2))',
    background: active ? 'var(--text-primary)' : 'var(--surface-1, transparent)',
    color: active ? 'var(--surface-1)' : 'var(--text-secondary)',
  }
}

export function AiCallFilters({ totals, filters, onChange }: {
  totals: Totals
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const toggleStatus = (status: string) => {
    const { status: current, ...rest } = filters
    onChange(current === status ? rest : { ...rest, status })
  }

  return (
    <div className="row" style={{ gap: 6, overflowX: 'auto', padding: '12px 0 2px' }}>
      {filters.feature && (
        <button type="button" style={chipStyle(true)} onClick={() => {
          const { feature, ...rest } = filters
          onChange(rest)
        }}>
          {filters.feature} ✕
        </button>
      )}
      <button type="button" style={chipStyle(!filters.status)} onClick={() => {
        const { status, ...rest } = filters
        onChange(rest)
      }}>
        Mind
      </button>
      <button type="button" style={chipStyle(filters.status === 'SUCCESS')} onClick={() => toggleStatus('SUCCESS')}>
        Siker {totals.successCount}
      </button>
      <button type="button" style={chipStyle(filters.status === 'ERROR')} onClick={() => toggleStatus('ERROR')}>
        Hiba {totals.errorCount}
      </button>
      <button type="button" style={chipStyle(filters.status === 'CANCELLED')} onClick={() => toggleStatus('CANCELLED')}>
        Megszakadt {totals.cancelledCount}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test AiCallRow AiCallFilters && VITE_USE_MOCK=true pnpm test AiCallRow AiCallFilters
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/components
git commit -m "feat(me): AI-napló list components — filter chips and call row (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Frontend — `AiUsagePage` + útvonal + a kártya linkké tétele

**Files:**
- Create: `frontend/src/features/me/pages/AiUsagePage.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/me/components/AiUsageCard.tsx`
- Modify: `frontend/src/features/me/components/AiUsageCard.test.tsx`

**Interfaces:**
- Consumes: Task 4 hookok (`@/data/hooks`-ból!), Task 6–7 komponensek.
- Produces: `<AiUsagePage />` a `/me/ai-usage` útvonalon.

- [ ] **Step 1: Írd meg a bukó tesztet**

`AiUsagePage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { AiUsagePage } from '@/features/me/pages/AiUsagePage'
import { LLM_CALLS_MOCK } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

function renderPage() {
  return render(
    <MemoryRouter>
      <AiUsagePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AiUsagePage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('opens on the week period with the header numbers and the call list', () => {
    renderPage()

    expect(screen.getByText('AI-napló')).toBeInTheDocument()
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('$1.86')).toBeInTheDocument()
    // the breakdown and the list both render
    expect(screen.getByText('companion_hypothesis')).toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('switches the period and keeps the three options reachable', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ma' }))
    expect(screen.getByRole('button', { name: 'Ma' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ez a hónap' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies a feature filter when a breakdown bar is tapped', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /meal_draft/ }))

    // the active narrowing shows up as a clearable chip
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /meal_draft ✕/ })).toBeInTheDocument(),
    )
  })

  it('offers the load-more control only while the server says more rows exist', () => {
    renderPage()
    // LLM_CALLS_MOCK.hasMore is true → the control is offered
    expect(screen.getByRole('button', { name: /További hívások/ })).toBeInTheDocument()
  })
})

describe('AiUsagePage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('raises the requested window when more calls are loaded', async () => {
    const limits: string[] = []
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () =>
        HttpResponse.json({
          from: '2026-08-14',
          totals: { callCount: 60, successCount: 60, errorCount: 0, cancelledCount: 0, unpricedCount: 0, costUsd: 1, currency: 'USD' },
          features: [], models: [],
        }),
      ),
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        limits.push(new URL(request.url).searchParams.get('limit') ?? '')
        return HttpResponse.json({
          items: [LLM_CALLS_MOCK.items[0]],
          hasMore: true,
        })
      }),
    )

    renderPage()

    await waitFor(() => expect(limits).toEqual(['50']))
    fireEvent.click(screen.getByRole('button', { name: /További hívások/ }))
    await waitFor(() => expect(limits).toContain('100'))
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test AiUsagePage
```

- [ ] **Step 3: Írd meg az oldalt**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLlmCalls, useLlmUsageBreakdown } from '@/data/hooks'
import { AiCallFilters } from '@/features/me/components/AiCallFilters'
import { AiCallRow } from '@/features/me/components/AiCallRow'
import { AiFeatureBreakdown } from '@/features/me/components/AiFeatureBreakdown'
import { AiModelBreakdown } from '@/features/me/components/AiModelBreakdown'
import { AiUsageHero } from '@/features/me/components/AiUsageHero'
import { GhostState } from '@/shared/ui/GhostState'
import type { LlmCallFilters as Filters, LlmUsagePeriodKey } from '@/data/me/llmUsageApi'

// The AI-napló (mezo-uakh): the browsable face of llm_log_history. ONE period selection drives
// both the header rollup and the list, so the two can never disagree — every filter is applied
// server-side for the same reason (the header covers the whole period, the list only a window).

const PERIODS = [
  { key: 'DAY', label: 'Ma' },
  { key: 'WEEK', label: 'Ez a hét' },
  { key: 'MONTH', label: 'Ez a hónap' },
] as const satisfies readonly { key: LlmUsagePeriodKey; label: string }[]

const PAGE = 50
const MAX_WINDOW = 500

export function AiUsagePage() {
  const [period, setPeriod] = useState<LlmUsagePeriodKey>('WEEK')
  const [filters, setFilters] = useState<Filters>({})
  const [limit, setLimit] = useState(PAGE)

  const breakdown = useLlmUsageBreakdown(period)
  const calls = useLlmCalls(period, filters, limit)

  // A new period or a new filter starts a fresh window — keeping a grown limit would make the
  // first render of the narrowed list needlessly heavy.
  const changePeriod = (next: LlmUsagePeriodKey) => {
    setPeriod(next)
    setLimit(PAGE)
  }
  const changeFilters = (next: Filters) => {
    setFilters(next)
    setLimit(PAGE)
  }

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? ''

  return (
    <div className="col gap-md" style={{ padding: '14px 12px 24px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <Link to="/me" aria-label="Vissza" style={{ fontSize: 19, color: 'var(--text-tertiary)' }}>‹</Link>
        <h1 style={{ fontSize: 16.5, fontWeight: 800, flex: 1, margin: 0 }}>AI-napló</h1>
      </div>

      <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 3 }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => changePeriod(p.key)}
            style={{
              flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '7px 0',
              borderRadius: 9, border: 0, cursor: 'pointer',
              background: period === p.key ? 'var(--surface-1)' : 'transparent',
              color: period === p.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {breakdown.isError ? (
        <GhostState message="Nem sikerült betölteni az AI-használatot." ctaLabel="Újra" onCta={breakdown.refetch} />
      ) : (
        <>
          <AiUsageHero totals={breakdown.data.totals} periodLabel={periodLabel} />
          <AiFeatureBreakdown
            groups={breakdown.data.features}
            selected={filters.feature ?? null}
            onSelect={(feature) => changeFilters(feature ? { ...filters, feature } : omitFeature(filters))}
          />
          <AiModelBreakdown groups={breakdown.data.models} />
        </>
      )}

      <AiCallFilters totals={breakdown.data.totals} filters={filters} onChange={changeFilters} />

      {calls.isError ? (
        <GhostState message="Nem sikerült betölteni a hívásokat." ctaLabel="Újra" onCta={calls.refetch} />
      ) : calls.data.items.length === 0 ? (
        <GhostState message="Ebben az időszakban nincs naplózott hívás." />
      ) : (
        <div>
          {calls.data.items.map((call) => <AiCallRow key={call.id} call={call} />)}

          {calls.data.hasMore && limit < MAX_WINDOW && (
            <div style={{ textAlign: 'center', marginTop: 11 }}>
              <button
                type="button"
                onClick={() => setLimit((n) => Math.min(n + PAGE, MAX_WINDOW))}
                style={{ borderRadius: 999, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border, var(--surface-2))', background: 'var(--surface-1, transparent)' }}
              >
                További hívások ({PAGE})
              </button>
            </div>
          )}
          {calls.data.hasMore && limit >= MAX_WINDOW && (
            <p className="text-tertiary" style={{ textAlign: 'center', fontSize: 10.5, marginTop: 11 }}>
              Az ablak betelt ({MAX_WINDOW} hívás) — szűkíts szűrővel a régebbiekhez.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function omitFeature(filters: Filters): Filters {
  const { feature, ...rest } = filters
  return rest
}
```

- [ ] **Step 4: Regisztráld az útvonalat**

`frontend/src/app/router.tsx` — importáld az oldalt a többi `me/pages` import mellé, és vedd fel a `me/routines/edit` SORÁBA (a `me` csoport TESTVÉREKÉNT, nem gyerekeként):

```tsx
      // Full-screen AI audit log browser (mezo-uakh) — no Me sub-nav chrome.
      { path: 'me/ai-usage', element: <AiUsagePage /> },
```

- [ ] **Step 5: Tedd linkké a kártyát**

`AiUsageCard.tsx` — a NEM-skeleton ágban burkold a kártya gyökerét `<Link to="/me/ai-usage">`-be, tartsd meg a `className="card biocard"`-ot és a stílust, és tegyél egy `›` affordanciát a `.bhd` fejlécbe:

```tsx
  return (
    <Link to="/me/ai-usage" className="card biocard" style={{ display: 'block', padding: '14px 15px 13px', color: 'inherit' }}>
      <div className="bhd">
        <h3>AI-használat</h3>
        <span className="text-tertiary" style={{ marginLeft: 'auto', fontSize: 15 }}>›</span>
      </div>
      {/* A .biogrid blokk és a "~ becslés" lábjegyzet VÁLTOZATLANUL marad — csak a külső
          <div className="card biocard"> lett <Link>, és a .bhd kapott egy › jelet. */}
    </Link>
  )
```

**A skeleton ágat NE alakítsd linkké** — annak a `role="status"` landmarkja és az `aria-label`-je marad, ahogy van (a meglévő teszt erre asszertál).

- [ ] **Step 6: Igazítsd a kártya tesztjét**

`AiUsageCard.test.tsx` — a `renderCard()` mostantól routert igényel:

```tsx
function renderCard() {
  return render(<AiUsageCard />, {
    wrapper: ({ children }) => (
      <QueryWrapper><MemoryRouter>{children}</MemoryRouter></QueryWrapper>
    ),
  })
}
```

…és vedd fel az új assertet:

```tsx
  it('links to the full AI audit log', () => {
    renderCard()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/me/ai-usage')
  })
```

A `MemoryRouter` importját add hozzá. A meglévő assertek NEM változhatnak.

- [ ] **Step 7: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test AiUsagePage AiUsageCard && VITE_USE_MOCK=true pnpm test AiUsagePage AiUsageCard
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(me): AI-napló page at /me/ai-usage, opened from the profile card (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Frontend — részletoldal (`AiCallDetailPage` + token-sáv + payload-blokk)

**Files:**
- Create: `frontend/src/features/me/components/AiTokenBar.tsx`
- Create: `frontend/src/features/me/components/AiPayloadBlock.tsx`
- Create: `frontend/src/features/me/pages/AiCallDetailPage.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `useLlmCall` (Task 4), `tokenSegments`/`formatCost`/`formatTokens`/`formatLatency` (Task 5).
- Produces: `<AiTokenBar detail={LlmCallDetailResponse} />`, `<AiPayloadBlock label={string} text={string | null} />`, `<AiCallDetailPage />` a `/me/ai-usage/:id` útvonalon.

- [ ] **Step 1: Írd meg a bukó tesztet**

`AiCallDetailPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { AiCallDetailPage } from '@/features/me/pages/AiCallDetailPage'
import { LLM_CALL_DETAIL_MOCK } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/me/ai-usage/${LLM_CALL_DETAIL_MOCK.id}`]}>
      <Routes>
        <Route path="/me/ai-usage/:id" element={<AiCallDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AiCallDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('shows the call identity and the request/response models', () => {
    renderDetail()
    expect(screen.getByText(/companion_chat/)).toBeInTheDocument()
    expect(screen.getAllByText('gemini-2.5-flash').length).toBeGreaterThan(0)
    expect(screen.getByText('7.8 s')).toBeInTheDocument()
  })

  it('renders the four token segments with the NET prompt', () => {
    renderDetail()
    // prompt is RAW in storage (includes cached) — the bar shows 5826 - 896
    expect(screen.getByText(/4 930/)).toBeInTheDocument()
    expect(screen.getByText(/gondolkodás/)).toBeInTheDocument()
    expect(screen.getByText(/3 474/)).toBeInTheDocument()
  })

  it('shows the frozen price snapshot the cost came from', () => {
    renderDetail()
    expect(screen.getByText(/Befagyasztott ártábla/)).toBeInTheDocument()
    expect(screen.getByText(/2026-08-14/)).toBeInTheDocument()
  })

  it('renders the three payload blocks', () => {
    renderDetail()
    expect(screen.getByText('System prompt')).toBeInTheDocument()
    expect(screen.getByText('User üzenet')).toBeInTheDocument()
    expect(screen.getByText('Válasz')).toBeInTheDocument()
    expect(screen.getByText(/rizses csirkét/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test AiCallDetailPage
```

- [ ] **Step 3: Írd meg az `AiTokenBar`-t**

```tsx
import { formatTokens, tokenSegments } from '@/features/me/logic/llmCallFormat'
import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// The billable token split of one call (mezo-uakh) — the view that shows when THINKING is what
// costs the money (a live probe once measured 188 thinking tokens against 8 answer tokens).

const SEGMENT_COLOR: Record<string, string> = {
  prompt: 'var(--lav-deep, var(--text-secondary))',
  candidates: 'var(--sage-deep)',
  thoughts: 'var(--gold-deep, var(--brand))',
  cached: 'var(--text-tertiary)',
}

export function AiTokenBar({ detail }: { detail: LlmCallDetailResponse }) {
  const segments = tokenSegments(detail)
  if (segments.length === 0) {
    return (
      <p className="text-tertiary" style={{ fontSize: 11 }}>
        A szolgáltató nem jelentett token-használatot ehhez a híváshoz.
      </p>
    )
  }

  return (
    <div>
      <div className="row" style={{ height: 9, borderRadius: 5, overflow: 'hidden', margin: '7px 0 8px' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${s.percent}%`, background: SEGMENT_COLOR[s.key] }} />
        ))}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 9, fontSize: 10.5 }}>
        {segments.map((s) => (
          <span key={s.key} className="row" style={{ alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SEGMENT_COLOR[s.key] }} />
            {s.label} {formatTokens(s.value)}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Írd meg az `AiPayloadBlock`-ot**

```tsx
// One verbatim payload column (mezo-uakh). Monospace on a dark surface because this is raw wire
// content, not prose — and the character count is shown so a truncated payload is visible as a
// fact rather than guessed from a cut-off sentence.

export function AiPayloadBlock({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span className="eyebrow" style={{ flex: 1 }}>{label}</span>
        <span className="text-tertiary" style={{ fontSize: 10.5 }}>{text.length} kar.</span>
      </div>
      <pre style={{
        margin: 0, borderRadius: 11, padding: '10px 11px', background: 'var(--text-primary)',
        color: 'var(--surface-1)', fontSize: 10.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', maxHeight: 320, overflow: 'auto',
      }}>{text}</pre>
    </div>
  )
}
```

**Másolás gomb:** a mockupon szerepelt, de a `navigator.clipboard` jsdom alatt nem létezik, és a felület e nélkül is teljes. **Kihagyjuk** — ha kell, külön bd. (Ez tudatos szűkítés, nem felejtés.)

- [ ] **Step 5: Írd meg a részletoldalt**

```tsx
import { Link, useParams } from 'react-router-dom'
import { useLlmCall } from '@/data/hooks'
import { AiPayloadBlock } from '@/features/me/components/AiPayloadBlock'
import { AiTokenBar } from '@/features/me/components/AiTokenBar'
import { callKindLabel, formatCost, formatLatency } from '@/features/me/logic/llmCallFormat'
import { GhostState } from '@/shared/ui/GhostState'

// One audited call in full (mezo-uakh) — the debug view. A separate page rather than a sheet:
// each payload column can hold 64 000 characters, and a call is worth deep-linking to.

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-1)', padding: '8px 10px' }}>
      <div className="text-tertiary" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function AiCallDetailPage() {
  const { id = '' } = useParams()
  const { data, isPending, isError, refetch } = useLlmCall(id)

  if (isError) {
    return <GhostState message="Ez a hívás nem elérhető." ctaLabel="Újra" onCta={refetch} />
  }
  if (isPending && !data.id) {
    return <GhostState message="A hívás betöltése…" />
  }

  const snapshot = data.pricingSnapshot

  return (
    <div className="col gap-md" style={{ padding: '14px 12px 24px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <Link to="/me/ai-usage" aria-label="Vissza" style={{ fontSize: 19, color: 'var(--text-tertiary)' }}>‹</Link>
        <h1 style={{ fontSize: 16.5, fontWeight: 800, flex: 1, margin: 0 }}>Hívás részletei</h1>
      </div>

      <div className="card" style={{ padding: '13px 14px' }}>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '2px 6px', background: 'var(--surface-2)' }}>
            {callKindLabel(data.callKind)}{data.toolRounds ? ` ×${data.toolRounds}` : ''}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800 }}>{data.status}</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '7px 0 2px' }}>
          {data.feature}{data.operation ? ` · ${data.operation}` : ''}
        </h2>
        <div className="text-tertiary" style={{ fontSize: 11 }}>
          {data.createdAt}{data.entityKind ? ` · ${data.entityKind}` : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden', marginTop: 11 }}>
          <Cell label="Kért modell" value={data.requestedModel} />
          <Cell label="Kiszolgált" value={data.servedModel ?? '—'} />
          <Cell label="Latency" value={formatLatency(data.latencyMs)} />
          <Cell label="Tool-körök" value={data.toolRounds != null ? String(data.toolRounds) : '—'} />
          {/* A cron/stream call has no security context on its thread — say so, don't leave it blank. */}
          <Cell label="Hívó" value={data.createdBy ? 'te' : 'háttérfolyamat'} />
          <Cell label="Service tier" value={data.serviceTier ?? '—'} />
        </div>
      </div>

      <div className="card" style={{ padding: '11px 13px 12px' }}>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span className="eyebrow" style={{ flex: 1 }}>Tokenek</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sage-deep)' }}>{formatCost(data.costUsd)}</span>
        </div>
        <AiTokenBar detail={data} />
      </div>

      {snapshot && (
        <div className="card" style={{ padding: '9px 11px', fontSize: 10.5 }}>
          <b>Befagyasztott ártábla</b> · {snapshot.sourceModel} · {snapshot.pricedOn}
          <div className="text-tertiary" style={{ marginTop: 3 }}>
            input ${snapshot.inputPerMillion} · output ${snapshot.outputPerMillion} · thinking ${snapshot.thinkingPerMillion} · cached ${snapshot.cachedPerMillion} / 1M
          </div>
          <div className="text-tertiary" style={{ marginTop: 3 }}>
            A számlázás nettó prompttal megy — a cache-elt szelet a promptban benne van.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '4px 13px 14px' }}>
        <AiPayloadBlock label="System prompt" text={data.systemPrompt} />
        <AiPayloadBlock label="User üzenet" text={data.userMessage} />
        <AiPayloadBlock label="Válasz" text={data.responseText} />
        {data.truncated && (
          <p style={{ fontSize: 10, fontWeight: 700, marginTop: 8, color: 'var(--danger, var(--brand))' }}>
            A payload csonkolva lett — az eredeti mérete {data.payloadBytes} bájt.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Regisztráld az útvonalat**

`router.tsx` — közvetlenül a `me/ai-usage` UTÁN:

```tsx
      { path: 'me/ai-usage/:id', element: <AiCallDetailPage /> },
```

- [ ] **Step 7: Futtasd — legyen zöld**

```bash
cd frontend && pnpm test AiCallDetailPage && VITE_USE_MOCK=true pnpm test AiCallDetailPage
```

- [ ] **Step 8: Teljes FE-kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: build OK, MINDKÉT mód zöld. Ha a `dualMode.guard.test.ts` bukik, valahol seed szivárog real-módba — nézd át a `realEmpty` értékeket.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat(me): AI call detail page with token bar, price snapshot and payloads (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Dokumentáció + záró kapuk

**Files:**
- Modify: `docs/features/me.md`
- Modify: `docs/features/companion.md`
- Modify: `docs/features/_platform-api-backend.md`

**Interfaces:**
- Consumes: minden korábbi task végállapota.
- Produces: naprakész élő feature-dokumentáció; `node scripts/lint-docs.mjs` tisztán fut.

- [ ] **Step 1: `docs/features/me.md`**

Két helyen kell hozzányúlni:
1. **§5 (`AiUsageCard`)** — a meglévő bekezdés végére: a kártya mostantól **link** a `/me/ai-usage`-ra (`›` affordancia a `.bhd`-ben); a skeleton-ág `role="status"` landmarkja változatlan.
2. **Új szakasz** az `AiUsagePage` (`/me/ai-usage`) és az `AiCallDetailPage` (`/me/ai-usage/:id`) leírásával: teljes oldalak, Me-alnav nélküli **testvér-útvonalak**; a periódus-szegmens egyszerre szűri a fejlécet és a listát; a szűrés **szerveroldali**; a lapozás **növekvő ablak** (50 → 500), a plafonon magyarázó sorral; a részletoldal a `tokenSegments` **nettó prompt**ját mutatja és a befagyasztott ártáblát.
3. **§3 (hookok)** — a három új dual-mode hook (`useLlmUsageBreakdown` / `useLlmCalls` / `useLlmCall`), `file:line` mutatókkal, a `realEmpty` ≠ seed szabály kiemelésével.

`file:line` mutatókkal dolgozz, kódot NE másolj be.

- [ ] **Step 2: `docs/features/companion.md`**

Az „LLM call audit log" szakaszban a **v1 = DB-only** állítás már NEM igaz. Írd át:
- a §524 körüli státusz-sorban: a v1 „DB-only — query with SQL" mondat helyére a read-oldal (`summary` + `breakdown`/`calls`/`calls/{id}`) és a `/me/ai-usage` felület;
- a §1867 körüli „nyitott végek" listában maradjon a retention és az árak reconciliation-je, de a „read API later" pont törlendő;
- a §1928 körüli **elavult** darabszám (`29 call sites in 25 classes`) javítandó a valósra: **31 tagelt hívási hely 29 osztályban** (ellenőrizd: `grep -rn "new LlmCallContext(" backend/src/main/java | grep -v "LlmCallContext.java" | wc -l`, és a fájlok száma `… | cut -d: -f1 | sort -u | wc -l`);
- a fájl-térkép szakasz kapja meg az új backend-fájlokat (`UsagePeriod`, `LlmLogMapper`, a három projekciós record, a három IT).

- [ ] **Step 3: `docs/features/_platform-api-backend.md`**

- A `LlmUsage` sorban a felület-oszlop bővül a `/me/ai-usage` oldallal.
- Az endpoint-táblába három új sor: `GET /llm-usage/breakdown`, `GET /llm-usage/calls`, `GET /llm-usage/calls/{id}` — mindegyiknél jegyezd meg, hogy **ungated** és **nincs user-szűrés**, valamint hogy a `costUsd` null = ismeretlen.

- [ ] **Step 4: Futtasd a doc-lintet**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nincs hiba, és a három érintett doksi staleness-jelzése tiszta.

- [ ] **Step 5: Teljes kapuk**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

```bash
cd backend && ./mvnw clean test
```

Ha a backend-suite lokálisan OOM-ol, hagyd a CI-ra (a self-PR a hiteles kapu) — de MONDD MEG, hogy lokálisan nem futott le teljesen.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs(features): AI-napló page + LLM audit read API (mezo-uakh)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: bd zárás**

```bash
bd close mezo-uakh --reason "AI-napló oldal kész: 3 read-endpoint (breakdown/calls/calls-{id}) a feature/llmlog csomagban, /me/ai-usage + /me/ai-usage/:id teljes oldalak, a Profil AiUsageCard belépővel. Növekvő ablakos lapozás (50-500), szerveroldali szűrők, nettó-prompt token-sáv, befagyasztott ártábla. Docs: me.md + companion.md + _platform-api-backend.md."
bd dolt push
```

---

## Merge / push / deploy (a taskok után, a fő session csinálja)

1. `git push -u origin feat/llm-audit-page`
2. Self-PR nyitása (`gh pr create`) — **a PR a CI-kapu**, nem review.
3. **Várd meg a CI zöldet** (`gh pr checks --watch`): backend IT-suite + FE mindkét mód + lint + contract-drift.
4. `git checkout main && git pull --rebase && git merge --no-ff feat/llm-audit-page && git push`
5. `git push origin --delete feat/llm-audit-page`
6. **Deploy:** a `main`-re kerülés indítja a release/deploy folyamatot — a lépések előtt OLVASD el a [`docs/infrastructure/deployment-k3s-argocd.md`](../../infrastructure/deployment-k3s-argocd.md)-t, és aszerint járj el (image-tag bump + ArgoCD sync). A backend `MEZO_FEATURE_LLM_LOG_ENABLED=true` már él k8s-en, tehát az oldal éles adatot fog látni.
