package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallListItem;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * GET /api/llm-usage/calls (mezo-uakh) — the browsable audit list. Two things this endpoint must
 * never do: leak the (up to 64k-per-column) payload into a list row, and page with an offset that
 * duplicates rows as new calls land on top.
 */
class LlmCallListIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LlmLogProperties llmLogProperties;

    @Test
    void testListCalls_shouldReturnUnauthorized_whenNoToken() {
        getForBody("/api/llm-usage/calls?period=DAY", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListCalls_shouldReturnNewestFirst_whenSeveralCallsLogged() {
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(60), owner, CallKind.CHAT,
            CallStatus.SUCCESS, "meal_coach", "verdict", "gemini-2.5-flash", new BigDecimal("0.001"));
        llmLogPopulator.logCall(todayAt(180), owner, CallKind.CHAT_STREAM,
            CallStatus.SUCCESS, "companion_chat", "stream", "gemini-2.5-flash", new BigDecimal("0.002"));

        LlmCallListResponse body = list("period=DAY");

        assertThat(body.getItems()).extracting(LlmCallListItem::getFeature)
            .containsExactly("companion_chat", "meal_coach");
        assertThat(body.getHasMore()).isFalse();
    }

    /** The payload columns exist on the row but must not travel with the list. */
    @Test
    void testListCalls_shouldOmitPayloadFields_whenRowHasThem() {
        llmLogPopulator.logCall(todayAt(0), ownerId(), CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", new BigDecimal("0.002"));

        ResponseEntity<String> response = exchangeForResponse(HttpMethod.GET,
            "/api/llm-usage/calls?period=DAY", null, ownerAuthHeaders());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("SYS").doesNotContain("USR").doesNotContain("RSP");
    }

    /**
     * ADR 0014's first invariant, pinned at {@code toListItem}: an unpriced row's cost is UNKNOWN,
     * so it must arrive as JSON null — never coalesced to 0.0, which the UI would render "$0.00"
     * and a reader would take for "this call was free". The breakdown ITs guard the aggregates;
     * this mapping is a different code path and needs its own pin.
     */
    @Test
    void testListCalls_shouldKeepCostNull_whenRowIsUnpriced() {
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(120), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "quest_flavor", "flavor", "unpriced-model", null);
        llmLogPopulator.logCall(todayAt(60), owner, CallKind.CHAT,
            CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", new BigDecimal("0.002"));

        LlmCallListResponse body = list("period=DAY");

        assertThat(body.getItems()).hasSize(2);
        assertThat(body.getItems()).filteredOn(i -> "quest_flavor".equals(i.getFeature()))
            .singleElement()
            .satisfies(i -> assertThat(i.getCostUsd()).isNull());
        assertThat(body.getItems()).filteredOn(i -> "companion_chat".equals(i.getFeature()))
            .singleElement()
            .satisfies(i -> assertThat(i.getCostUsd()).isEqualTo(0.002));
    }

    /**
     * ADR 0014's second invariant on the LIST query specifically: cron and CHAT_STREAM rows carry
     * {@code created_by = null}, and the list JPQL is its own query string — an ownership filter
     * sneaking into it would hide exactly the background traffic this page exists to surface.
     */
    @Test
    void testListCalls_shouldIncludeOwnerlessRows_whenLoggedByBackgroundJob() {
        llmLogPopulator.logCall(todayAt(120), null, CallKind.CHAT, CallStatus.SUCCESS,
            "proactive_briefing", "generate", "gemini-2.5-flash", new BigDecimal("0.030"));
        llmLogPopulator.logCall(todayAt(60), ownerId(),
            CallKind.CHAT, CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", null);

        LlmCallListResponse body = list("period=DAY");

        assertThat(body.getItems()).extracting(LlmCallListItem::getFeature)
            .containsExactly("proactive_briefing", "companion_chat");
    }

    @Test
    void testListCalls_shouldNarrowToOneFeature_whenFeatureFilterGiven() {
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "meal_coach", "verdict", "gemini-2.5-flash", null);

        assertThat(list("period=DAY&feature=meal_coach").getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getFeature()).isEqualTo("meal_coach"));
    }

    @Test
    void testListCalls_shouldNarrowToErrors_whenStatusFilterGiven() {
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.VISION, CallStatus.ERROR,
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
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT_STREAM, CallStatus.SUCCESS,
            "companion_chat", "stream", "gemini-2.5-flash", null);

        assertThat(list("period=DAY&feature=companion_chat&callKind=CHAT_STREAM").getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getOperation()).isEqualTo("stream"));
    }

    /** The growing window: a small limit truncates and SAYS so; a large one shows everything. */
    @Test
    void testListCalls_shouldFlagMoreRows_whenWindowSmallerThanThePeriod() {
        UUID owner = ownerId();
        for (int i = 0; i < 12; i++) {
            llmLogPopulator.logCall(todayAt(i), owner,
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

    /** The DAY window's lower edge: start-of-day is IN, one second before it is OUT (mezo-7qpy). */
    @Test
    void testListCalls_shouldCutAtLocalDayStart_whenRowStraddlesTheBoundary() {
        UUID owner = ownerId();
        llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "companion_chat", "send", "gemini-2.5-flash", null);
        llmLogPopulator.logCall(todayAt(0).minusSeconds(1), owner, CallKind.CHAT, CallStatus.SUCCESS,
            "meal_coach", "verdict", "gemini-2.5-flash", null);

        assertThat(list("period=DAY").getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getFeature()).isEqualTo("companion_chat"));
    }

    private LlmCallListResponse list(String query) {
        return getForBody("/api/llm-usage/calls?" + query, ownerAuthHeaders(),
            HttpStatus.OK, LlmCallListResponse.class);
    }

    private UUID ownerId() {
        return userPopulator.createUser("llm-call-list@test.hu").getId();
    }

    /** Second {@code i} of the current report-zone day — always inside the period=DAY window (mezo-7qpy). */
    private Instant todayAt(int i) {
        var zone = llmLogProperties.reportZone();
        return LocalDate.now(zone).atStartOfDay(zone).toInstant().plusSeconds(i);
    }
}
