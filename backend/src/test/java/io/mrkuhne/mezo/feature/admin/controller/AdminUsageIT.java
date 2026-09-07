package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminCostMatrixResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureUsageResponse;
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

/** GET /api/admin/usage/{features,cost-matrix} (mezo-d5iy). */
class AdminUsageIT extends ApiIntegrationTest {

    private static final String FEATURES_URI = "/api/admin/usage/features";
    private static final String MATRIX_URI = "/api/admin/usage/cost-matrix";

    @Autowired private LlmLogRepository llmLogRepository;

    @Test
    void testFeatureUsage_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(FEATURES_URI, anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testCostMatrix_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(MATRIX_URI, anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testFeatureUsage_shouldCoverTheRequestedWindow_whenPeriodGiven() {
        AdminFeatureUsageResponse body =
                getForBody(FEATURES_URI + "?period=7d", ownerAuthHeaders(), HttpStatus.OK, AdminFeatureUsageResponse.class);

        assertThat(body.getPeriod()).isEqualTo("7d");
        assertThat(body.getDays()).hasSize(7);
        assertThat(body.getFeatures()).isNotEmpty();
        body.getFeatures().forEach(f -> assertThat(f.getDays()).hasSize(7));
    }

    @Test
    void testFeatureUsage_shouldListAFeatureLoggedToday_whenARowExists() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "companion_chat", CallStatus.SUCCESS, new BigDecimal("0.010000")));

        AdminFeatureUsageResponse body =
                getForBody(FEATURES_URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureUsageResponse.class);

        assertThat(body.getFeatures()).extracting("key").contains("companion_chat");
    }

    @Test
    void testCostMatrix_shouldBucketNullCreatedByAsHatter_whenRowHasNoOwner() {
        llmLogRepository.save(logRow(null, "nightly_recall", CallStatus.SUCCESS, new BigDecimal("0.020000")));

        AdminCostMatrixResponse body =
                getForBody(MATRIX_URI, ownerAuthHeaders(), HttpStatus.OK, AdminCostMatrixResponse.class);

        assertThat(body.getUsers()).anySatisfy(u -> {
            assertThat(u.getId()).isNull();
            assertThat(u.getLabel()).isEqualTo("Háttér");
        });
        assertThat(body.getCells()).anySatisfy(c -> {
            assertThat(c.getUserId()).isNull();
            assertThat(c.getFeature()).isEqualTo("nightly_recall");
            assertThat(c.getCostUsd()).isEqualTo(0.02);
        });
    }

    @Test
    void testCostMatrix_shouldExcludeErrorCalls_whenStatusIsError() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "meal_draft", CallStatus.SUCCESS, new BigDecimal("0.030000")));
        llmLogRepository.save(logRow(anna.id(), "meal_draft", CallStatus.ERROR, new BigDecimal("9.000000")));

        AdminCostMatrixResponse body =
                getForBody(MATRIX_URI, ownerAuthHeaders(), HttpStatus.OK, AdminCostMatrixResponse.class);

        assertThat(body.getCells()).filteredOn(c -> "meal_draft".equals(c.getFeature()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.getCalls()).isEqualTo(1L);
                    assertThat(c.getCostUsd()).isEqualTo(0.03);
                });
        assertThat(body.getTotalUsd()).isLessThan(1.0);
    }

    @Test
    void testCostMatrix_shouldReportNullCostAsUnknownCalls_neverAsZero() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "train_meso_plan", CallStatus.SUCCESS, null));

        AdminCostMatrixResponse body =
                getForBody(MATRIX_URI, ownerAuthHeaders(), HttpStatus.OK, AdminCostMatrixResponse.class);

        assertThat(body.getCells()).filteredOn(c -> "train_meso_plan".equals(c.getFeature()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.getUnknownCalls()).isEqualTo(1L);
                    assertThat(c.getCostUsd()).isZero();
                });
    }

    /** Minimal valid audit row: only the NOT NULL columns plus what the test needs — see
     *  {@code LlmLogRepositoryIT} for the fuller fixture this shape is copied from. */
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
