package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageGroup;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.MidnightZone;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Midnight simulation for {@code GET /api/llm-usage/breakdown?period=DAY} (mezo-pk63) — the sibling
 * of {@link LlmCallListMidnightIT}, for the rollup endpoint {@link LlmUsageBreakdownIT} covers.
 *
 * <p>The report zone is computed at class init so "now" in it is ALWAYS 00:00-00:30. That turns the
 * DAY window's lower edge into a boundary the suite crosses on EVERY run instead of only in the
 * first minutes after local midnight on CI: a row stamped one second BEFORE the report zone's
 * start-of-day is yesterday's, while in any other zone (notably the hardcoded
 * {@code Europe/Budapest} that {@code LlmUsageBreakdownIT} used to re-derive) that same instant is
 * still "today" and would be rolled up. A window cut on anything but the configured report zone
 * therefore fails here deterministically.
 */
class LlmUsageBreakdownMidnightIT extends ApiIntegrationTest {

    private static final String MODEL = "gemini-2.5-flash";

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private UserPopulator userPopulator;

    @DynamicPropertySource
    static void justPastMidnightZone(DynamicPropertyRegistry registry) {
        registry.add("mezo.llm-log.report-zone", () -> MidnightZone.JUST_PAST_MIDNIGHT_ZONE_ID);
    }

    @Test
    void testGetBreakdown_shouldEchoTheReportZonesToday_whenLocalClockIsJustPastMidnight() {
        LlmUsageBreakdownResponse body = breakdown();

        assertThat(body.getFrom()).isEqualTo(LocalDate.now(llmLogProperties.reportZone()));
        assertThat(body.getTotals().getCallCount()).isZero();
    }

    /**
     * The boundary itself: one row at 00:00:00 of the report zone's today, one a single second
     * earlier (23:59:59 yesterday). Only the first is this day's traffic.
     */
    @Test
    void testGetBreakdown_shouldCountOnlyRowsAtOrAfterMidnight_whenTheReportZoneJustRolledOver() {
        UUID owner = ownerId();
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();

        llmLogPopulator.logAt(dayStart, owner, CallKind.CHAT, "companion_chat", MODEL,
            4_000, 400, snapshot(), new BigDecimal("0.010000"));
        llmLogPopulator.logAt(dayStart.minusSeconds(1), owner, CallKind.CHAT, "meal_coach", MODEL,
            1_000, 100, snapshot(), new BigDecimal("0.002000"));

        LlmUsageBreakdownResponse body = breakdown();

        assertThat(body.getFrom()).isEqualTo(today);
        assertThat(body.getTotals().getCallCount()).isEqualTo(1);
        assertThat(body.getTotals().getCostUsd()).isEqualTo(0.01, within(1e-9));
        assertThat(body.getFeatures()).extracting(LlmUsageGroup::getKey)
            .containsExactly("companion_chat");
    }

    private LlmUsageBreakdownResponse breakdown() {
        return getForBody("/api/llm-usage/breakdown?period=DAY", ownerAuthHeaders(),
            HttpStatus.OK, LlmUsageBreakdownResponse.class);
    }

    private UUID ownerId() {
        return userPopulator.createUser("llm-usage-breakdown-midnight@test.hu").getId();
    }

    private static PricingSnapshot snapshot() {
        return new PricingSnapshot(MODEL, "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.of(2026, 1, 1));
    }
}
