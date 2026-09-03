package io.mrkuhne.mezo.feature.proactive.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DiagnosisGenerateRequest;
import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * The diagnosis HTTP surface (mezo-hqfi.2): honest-empty list, ownership-scoped detail, the
 * quota 429 and the no-usable-diagnosis 409. Generation itself is covered by
 * {@code DiagnosisGeneratorIT}; here the un-scripted fake answers with zero suspects, which is
 * exactly the "no row" path the 409 asserts.
 */
@ActiveProfiles("companion-fake")
class DiagnosisControllerIT extends ApiIntegrationTest {

    @Autowired private DiagnosisPopulator diagnosisPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private static DiagnosisGenerateRequest fatigueRequest() {
        DiagnosisGenerateRequest request = new DiagnosisGenerateRequest();
        request.setPhenomenon("fatigue");
        return request;
    }

    @Test
    void listIsHonestlyEmptyRatherThan404() {
        List<DiagnosisResponse> body = getForList("/api/proactive/diagnosis?phenomenon=fatigue",
                ownerAuthHeaders(), HttpStatus.OK, DiagnosisResponse.class);

        assertThat(body).isEmpty();
    }

    @Test
    void listReturnsTheUsersRows() {
        diagnosisPopulator.diagnosis(ownerId());

        List<DiagnosisResponse> body = getForList("/api/proactive/diagnosis?phenomenon=fatigue",
                ownerAuthHeaders(), HttpStatus.OK, DiagnosisResponse.class);

        assertThat(body).hasSize(1);
        assertThat(body.get(0).getVerdict()).isEqualTo("Teszt diagnózis.");
    }

    @Test
    void detailReturnsTheRowWithAStaleFlag() {
        DiagnosisEntity seeded = diagnosisPopulator.diagnosis(ownerId());

        DiagnosisResponse body = getForBody("/api/proactive/diagnosis/" + seeded.getId(),
                ownerAuthHeaders(), HttpStatus.OK, DiagnosisResponse.class);

        assertThat(body.getVerdict()).isEqualTo("Teszt diagnózis.");
        assertThat(body.getWindowDays()).isEqualTo(14);
        assertThat(body.getSuspects()).hasSize(1);
        assertThat(body.getSuspects().get(0).getMetricKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(body.getEvidence()).hasSize(1);
        assertThat(body.getEvidence().get(0).getSourceHu()).isEqualTo("Alvás-napló");
    }

    @Test
    void detailIs404ForAnUnknownId() {
        getForBody("/api/proactive/diagnosis/" + UUID.randomUUID(),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void generateIs429WhenTheDailyQuotaIsSpent() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        for (int i = 0; i < 3; i++) {
            diagnosisPopulator.diagnosis(ownerId(), now);
        }

        postForBody("/api/proactive/diagnosis", fatigueRequest(),
                ownerAuthHeaders(), HttpStatus.TOO_MANY_REQUESTS, String.class);
    }

    @Test
    void generateIs409WhenNoUsableDiagnosisComesBack() {
        postForBody("/api/proactive/diagnosis", fatigueRequest(),
                ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
    }
}
