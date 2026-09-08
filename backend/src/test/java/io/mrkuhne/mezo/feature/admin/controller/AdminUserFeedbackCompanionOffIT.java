package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserFeedbackResponse;
import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Degraded, not dead (mezo-zde2, mirroring {@code AdminFeaturesCompanionOffIT}): with the
 * companion switch off, the users-list's {@code feedbackUp}/{@code feedbackDown} answer an honest
 * zero (never a crash — the fields are non-nullable ints, so there is no null to fall back to),
 * and the per-user feedback endpoint answers 200 with both {@code surfaces} and {@code recall}
 * null — the underlying queries are never even run.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class AdminUserFeedbackCompanionOffIT extends ApiIntegrationTest {

    @Autowired private FeedbackPopulator feedbackPopulator;

    @Test
    void testListUserInsights_shouldReportZeroFeedback_whenCompanionSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");
        // Would show up in feedbackUp if the switch were on.
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);

        List<AdminUserInsightResponse> users = getForList(
                "/api/admin/users-insight", ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        AdminUserInsightResponse row = users.stream().filter(u -> u.getId().equals(anna.id())).findFirst().orElseThrow();
        assertThat(row.getFeedbackUp()).isEqualTo(0);
        assertThat(row.getFeedbackDown()).isEqualTo(0);
        // Everything else keeps answering — this is degraded, not dead.
        assertThat(row.getActivityByDay()).hasSize(90);
    }

    @Test
    void testUserFeedback_shouldReturn200WithNullSurfacesAndRecall_whenCompanionSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);

        AdminUserFeedbackResponse body = getForBody("/api/admin/users/" + anna.id() + "/feedback",
                ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);

        assertThat(body.getSurfaces()).isNull();
        assertThat(body.getRecall()).isNull();
    }
}
