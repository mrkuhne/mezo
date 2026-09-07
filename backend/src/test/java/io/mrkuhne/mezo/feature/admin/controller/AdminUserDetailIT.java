package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserDetailResponse;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** GET /api/admin/users/{id}/insight — one user's activity, inventory and cost (mezo-d5iy). */
class AdminUserDetailIT extends ApiIntegrationTest {

    @Autowired private LlmLogRepository llmLogRepository;

    private static String uri(UUID id) {
        return "/api/admin/users/" + id + "/insight";
    }

    @Test
    void testUserDetail_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(uri(anna.id()), anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testUserDetail_shouldReturn404_whenUserDoesNotExist() {
        assertHasRequestError(
                getForBody(uri(UUID.randomUUID()), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class),
                "ADMIN_USER_NOT_FOUND");
    }

    @Test
    void testUserDetail_shouldReturnNinetyDaySeriesAndInventory_whenOwner() {
        RegisteredUser anna = registerUser("Anna");

        AdminUserDetailResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserDetailResponse.class);

        assertThat(body.getUser().getId()).isEqualTo(anna.id());
        assertThat(body.getActivitySeries()).isNotEmpty();
        body.getActivitySeries().forEach(series -> assertThat(series.getDays()).hasSize(90));
        assertThat(body.getInventory()).isNotEmpty();
        assertThat(body.getInventory()).allSatisfy(t -> {
            assertThat(t.getTable()).isNotBlank();
            assertThat(t.getRowCount()).isNotNegative();
            assertThat(t.getDeletedCount()).isNotNegative();
        });
        assertThat(body.getFeatureUsage30d()).isNotNull();
        assertThat(body.getCostByFeature30d()).isNotNull();
    }

    @Test
    void testUserDetail_shouldLandASeededLlmCostInItsFeatureBucket_whenRowExists() {
        RegisteredUser anna = registerUser("Anna");
        LlmLogEntity row = new LlmLogEntity();
        row.setCreatedBy(anna.id());
        row.setCallKind(CallKind.CHAT);
        row.setFeature("companion_chat");
        row.setRequestedModel("gemini-2.5-flash");
        row.setServedModel("gemini-2.5-flash");
        row.setStatus(CallStatus.SUCCESS);
        row.setLatencyMs(100);
        row.setCostUsd(new BigDecimal("0.040000"));
        llmLogRepository.save(row);

        AdminUserDetailResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserDetailResponse.class);

        assertThat(body.getFeatureUsage30d()).containsEntry("companion_chat", 1L);
        assertThat(body.getCostByFeature30d()).filteredOn(c -> "companion_chat".equals(c.getFeature()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.getCalls()).isEqualTo(1L);
                    assertThat(c.getCostUsd()).isEqualTo(0.04);
                });
    }

    @Test
    void testUserDetail_shouldOmitEmptyTablesFromInventory_whenUserHasNoRowsThere() {
        RegisteredUser anna = registerUser("Anna");

        AdminUserDetailResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserDetailResponse.class);

        assertThat(body.getInventory())
                .allSatisfy(t -> assertThat(t.getRowCount() + t.getDeletedCount()).isPositive());
    }
}
