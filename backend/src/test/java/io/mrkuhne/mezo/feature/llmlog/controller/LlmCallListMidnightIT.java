package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Midnight simulation for the period=DAY window (mezo-7qpy): the report zone is computed at
 * startup so that "now" in that zone is ALWAYS 00:00-00:30 — every run exercises the
 * day-boundary that previously only bit CI runs in the first minutes after Europe/Budapest
 * midnight. Seeding anchored anywhere but the current local day fails here deterministically.
 */
class LlmCallListMidnightIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private UserPopulator userPopulator;

    /**
     * An offset zone in which the current wall time is a few minutes past midnight, computed once
     * at class init so every property resolution (Spring may query the supplier repeatedly) sees
     * the same zone instead of drifting as wall-clock time passes during the test run.
     */
    private static final String JUST_PAST_MIDNIGHT_ZONE_ID = computeJustPastMidnightZoneId();

    private static String computeJustPastMidnightZoneId() {
        LocalTime utcNow = LocalTime.now(ZoneOffset.UTC);
        // offset that maps "now" to ~00:05 local; ZoneOffset supports ±18h so this always resolves
        int targetSeconds = 5 * 60;
        int offsetSeconds = targetSeconds - utcNow.toSecondOfDay();
        if (offsetSeconds < -18 * 3600) {
            offsetSeconds += 24 * 3600;
        }
        return ZoneOffset.ofTotalSeconds(offsetSeconds).getId();
    }

    @DynamicPropertySource
    static void justPastMidnightZone(DynamicPropertyRegistry registry) {
        registry.add("mezo.llm-log.report-zone", () -> JUST_PAST_MIDNIGHT_ZONE_ID);
    }

    @Test
    void testListCalls_shouldSeeAllTwelveRows_whenLocalClockIsJustPastMidnight() {
        UUID owner = ownerId();
        Instant dayAnchor = LocalDate.now(llmLogProperties.reportZone())
            .atStartOfDay(llmLogProperties.reportZone()).toInstant();
        for (int i = 0; i < 12; i++) {
            llmLogPopulator.logCall(dayAnchor.plus(i, ChronoUnit.SECONDS), owner,
                CallKind.CHAT, CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", null);
        }

        LlmCallListResponse full = getForBody("/api/llm-usage/calls?period=DAY&limit=20",
            ownerAuthHeaders(), HttpStatus.OK, LlmCallListResponse.class);

        assertThat(full.getItems()).hasSize(12);
        assertThat(full.getHasMore()).isFalse();
    }

    private UUID ownerId() {
        return userPopulator.createUser("llm-call-list-midnight@test.hu").getId();
    }
}
