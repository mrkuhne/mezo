package io.mrkuhne.mezo.feature.proactive.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** The probe → experiment hand-off (mezo-hqfi.3, spec §4). */
@ActiveProfiles("companion-fake")
class DiagnosisExperimentIT extends ApiIntegrationTest {

    @Autowired private DiagnosisPopulator diagnosisPopulator;
    @Autowired private ExperimentRepository experimentRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private ExperimentResponse start(DiagnosisEntity diagnosis, int rank, HttpStatus expected) {
        return postForBody(
                "/api/proactive/diagnosis/" + diagnosis.getId() + "/suspect/" + rank + "/experiment",
                null, ownerAuthHeaders(), expected, ExperimentResponse.class);
    }

    @Test
    void createsAnActiveExperimentFromTheProbe() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());

        ExperimentResponse body = start(diagnosis, 1, HttpStatus.CREATED);

        assertThat(body.getStatus()).isEqualTo("active");
        assertThat(body.getMetricKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(body.getTotalDays()).isEqualTo(7);

        List<ExperimentEntity> rows = experimentRepository.findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
                ownerId(), ExperimentEntity.SOURCE_DIAGNOSIS);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getSourceDiagnosisId()).isEqualTo(diagnosis.getId());
        assertThat(rows.get(0).getStartDate()).isEqualTo(LocalDate.now());
        assertThat(rows.get(0).getExpectedDirection()).isEqualTo("up");
    }

    @Test
    void doesNotCreateASecondExperimentForTheSameMetric() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());
        start(diagnosis, 1, HttpStatus.CREATED);

        start(diagnosis, 1, HttpStatus.CREATED);

        assertThat(experimentRepository.findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
                ownerId(), ExperimentEntity.SOURCE_DIAGNOSIS)).hasSize(1);
    }

    @Test
    void is404ForARankThatHasNoSuspect() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());

        postForBody("/api/proactive/diagnosis/" + diagnosis.getId() + "/suspect/4/experiment",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void is404ForAnUnknownDiagnosis() {
        postForBody("/api/proactive/diagnosis/" + UUID.randomUUID() + "/suspect/1/experiment",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
