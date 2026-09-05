package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageGroup;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
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
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetBreakdown_shouldReturnUnauthorized_whenNoToken() {
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetBreakdown_shouldReturnEmptyRollupsAndNullCost_whenNothingLogged() {
        // `from` is the SERVER's own today, cut on the CONFIGURED report zone (never a hardcoded
        // one): capture the day AROUND the call and accept either side, so a midnight between the
        // two reads cannot flip the assert. LlmUsageBreakdownMidnightIT drives this same window
        // with a report zone whose "now" is always 00:0x.
        LocalDate dayBefore = LocalDate.now(llmLogProperties.reportZone());
        LlmUsageBreakdownResponse body = breakdown("DAY");
        LocalDate dayAfter = LocalDate.now(llmLogProperties.reportZone());

        assertThat(body.getFrom()).isIn(dayBefore, dayAfter);
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

    private UUID ownerId() {
        return userPopulator.createUser("llm-usage-breakdown@test.hu").getId();
    }

    private static PricingSnapshot snapshot() {
        return new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            // a FIXED effective-from date: the snapshot is inert fixture metadata, and re-reading
            // the clock per call could stamp two rows of one test with two different days
            new BigDecimal("0.075"), null, LocalDate.of(2026, 1, 1));
    }
}
