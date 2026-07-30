package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmUsagePeriod;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * GET /api/llm-usage/summary (mezo-h3gb) — day/week/month rollups over the llm_log_history audit
 * table. The three periods NEST (today ⊆ this week ⊆ this month), so a call logged "now" must show
 * up in all three; an unpriced row still counts but adds nothing to the cost.
 */
class LlmUsageIT extends ApiIntegrationTest {

    private static final String SUMMARY_URI = "/api/llm-usage/summary";

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetLlmUsageSummary_shouldReturnUnauthorized_whenNoToken() {
        getForBody(SUMMARY_URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetLlmUsageSummary_shouldReturnZeroCallsAndNullCost_whenNothingLogged() {
        LlmUsageSummaryResponse summary = summary();

        assertPeriod(summary.getDay(), 0, null);
        assertPeriod(summary.getWeek(), 0, null);
        assertPeriod(summary.getMonth(), 0, null);
    }

    /**
     * Everything logged "now" falls inside all three calendar periods at once, and only the PRICED
     * rows contribute to the sum — an unpriced row is counted, not costed.
     */
    @Test
    void testGetLlmUsageSummary_shouldCountAllRowsAndSumOnlyPricedOnes_whenCallsLoggedNow() {
        UUID owner = ownerId();
        llmLogPopulator.log(owner, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 1_000, 100,
            snapshot(), new BigDecimal("0.002500"));
        llmLogPopulator.log(owner, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 4_000, 200,
            snapshot(), new BigDecimal("0.010000"));
        llmLogPopulator.log(owner, CallKind.EMBED_QUERY, "companion_recall", "unpriced-model", 50, 0);

        LlmUsageSummaryResponse summary = summary();

        assertPeriod(summary.getDay(), 3, 0.0125);
        assertPeriod(summary.getWeek(), 3, 0.0125);
        assertPeriod(summary.getMonth(), 3, 0.0125);
    }

    /** callCount is status-blind: a failed call was still a call, and it carries no cost. */
    @Test
    void testGetLlmUsageSummary_shouldCountFailedCalls_whenCallErrored() {
        llmLogPopulator.logError(ownerId(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash",
            "RESOURCE_EXHAUSTED");

        assertPeriod(summary().getDay(), 1, null);
    }

    /**
     * Cron/async rows carry a null {@code created_by} — the summary must still see them, otherwise
     * the priciest background traffic would silently vanish from the report.
     */
    @Test
    void testGetLlmUsageSummary_shouldIncludeOwnerlessRows_whenLoggedByBackgroundJob() {
        llmLogPopulator.log(null, CallKind.CHAT, "daily_summary", "gemini-2.5-flash", 900, 90,
            snapshot(), new BigDecimal("0.001000"));

        assertPeriod(summary().getMonth(), 1, 0.001);
    }

    /** A row older than every period start is filtered out of all three buckets, cost included. */
    @Test
    void testGetLlmUsageSummary_shouldExcludeOldRows_whenLoggedBeforeEveryPeriodStart() {
        UUID owner = ownerId();
        llmLogPopulator.logAt(Instant.now().minus(400, ChronoUnit.DAYS), owner, CallKind.CHAT,
            "companion_chat", "gemini-2.5-flash", 9_000, 900, snapshot(), new BigDecimal("9.000000"));
        llmLogPopulator.log(owner, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 1_000, 100,
            snapshot(), new BigDecimal("0.002500"));

        LlmUsageSummaryResponse summary = summary();

        assertPeriod(summary.getDay(), 1, 0.0025);
        assertPeriod(summary.getWeek(), 1, 0.0025);
        assertPeriod(summary.getMonth(), 1, 0.0025);
    }

    private LlmUsageSummaryResponse summary() {
        return getForBody(SUMMARY_URI, ownerAuthHeaders(), HttpStatus.OK, LlmUsageSummaryResponse.class);
    }

    private void assertPeriod(LlmUsagePeriod period, long expectedCalls, Double expectedCostUsd) {
        assertThat(period).isNotNull();
        assertThat(period.getCallCount()).isEqualTo(expectedCalls);
        assertThat(period.getCurrency()).isEqualTo("USD");
        if (expectedCostUsd == null) {
            assertThat(period.getCostUsd()).isNull();
        } else {
            assertThat(period.getCostUsd()).isCloseTo(expectedCostUsd, within(1e-9));
        }
    }

    private UUID ownerId() {
        return userPopulator.createUser("llm-usage@test.hu").getId();
    }

    private PricingSnapshot snapshot() {
        return new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.now());
    }
}
