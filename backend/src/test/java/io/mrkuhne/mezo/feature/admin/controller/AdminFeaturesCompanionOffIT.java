package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminFeatureBoardResponse;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Degraded, not dead (mezo-l096.3, mirroring {@code AdminAlertsCompanionOffIT}): with the
 * companion switch off, {@code /api/admin/features} still answers 200 and {@code helped} is
 * {@code null} on every row — the query is never even run.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class AdminFeaturesCompanionOffIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/features";

    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private FeedbackPopulator feedbackPopulator;

    @Test
    void testBoard_shouldOmitHelped_whenCompanionSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");
        // Would show up under companion_chat's helped counts if the switch were on.
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        llmLogRepository.save(logRow(anna.id(), "companion_chat", CallStatus.SUCCESS, new BigDecimal("0.01")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).isNotEmpty();
        assertThat(body.getRows()).allSatisfy(r -> assertThat(r.getHelped()).isNull());
    }

    private static LlmLogEntity logRow(UUID owner, String feature, CallStatus status, BigDecimal cost) {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(owner);
        e.setCallKind(CallKind.CHAT);
        e.setFeature(feature);
        e.setRequestedModel("gemini-2.5-flash");
        e.setServedModel(status == CallStatus.ERROR ? null : "gemini-2.5-flash");
        e.setStatus(status);
        e.setLatencyMs(100);
        e.setCostUsd(cost);
        return e;
    }
}
