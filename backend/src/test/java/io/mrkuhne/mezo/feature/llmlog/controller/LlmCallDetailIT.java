package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmPricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetCall_shouldReturnUnauthorized_whenNoToken() {
        getForBody("/api/llm-usage/calls/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetCall_shouldReturnThePayloadAndSnapshot_whenCallExists() {
        // Distinct value per field: a swapped pair (e.g. thinking <-> cached) must fail this test.
        PricingSnapshot snapshot = new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("0.15"),
            new BigDecimal("0.075"), new BigDecimal("0.02"), LocalDate.of(2026, 8, 1));
        LlmLogEntity row = llmLogPopulator.logCall(Instant.now(), ownerId(), CallKind.TOOL,
            CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", snapshot,
            new BigDecimal("0.058"));

        LlmCallDetailResponse body = detail(row.getId());

        assertThat(body.getFeature()).isEqualTo("companion_chat");
        assertThat(body.getOperation()).isEqualTo("send");
        assertThat(body.getSystemPrompt()).isEqualTo("SYS");
        assertThat(body.getUserMessage()).isEqualTo("USR");
        assertThat(body.getResponseText()).isEqualTo("RSP");
        assertThat(body.getPayloadBytes()).isEqualTo(9);
        assertThat(body.getTruncated()).isFalse();
        assertThat(body.getCostUsd()).isEqualTo(0.058);

        LlmPricingSnapshot snapshotBody = body.getPricingSnapshot();
        assertThat(snapshotBody).isNotNull();
        assertThat(snapshotBody.getSourceModel()).isEqualTo("gemini-2.5-flash");
        assertThat(snapshotBody.getCurrency()).isEqualTo("USD");
        assertThat(snapshotBody.getInputPerMillion()).isEqualTo(0.30);
        assertThat(snapshotBody.getOutputPerMillion()).isEqualTo(2.50);
        assertThat(snapshotBody.getThinkingPerMillion()).isEqualTo(0.15);
        assertThat(snapshotBody.getCachedPerMillion()).isEqualTo(0.075);
        assertThat(snapshotBody.getEmbedPerMillionChars()).isEqualTo(0.02);
        assertThat(snapshotBody.getPricedOn()).isEqualTo(LocalDate.of(2026, 8, 1));
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
        String raw = getForBody("/api/llm-usage/calls/" + UUID.randomUUID(), ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(raw, "LLM_LOG_CALL_NOT_FOUND");
    }

    private LlmCallDetailResponse detail(UUID id) {
        return getForBody("/api/llm-usage/calls/" + id, ownerAuthHeaders(),
            HttpStatus.OK, LlmCallDetailResponse.class);
    }

    private UUID ownerId() {
        return userPopulator.createUser("llm-call-detail@test.hu").getId();
    }
}
