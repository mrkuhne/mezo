package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
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
    @Autowired private UserPopulator userPopulator;

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
