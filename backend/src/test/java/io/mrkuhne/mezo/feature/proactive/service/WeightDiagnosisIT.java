package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Week-anchored WEIGHT phenomenon gates (mezo-85x5r): the weigh-in floor and the anchor-week
 * reuse — no LLM involvement for either path, so this stays a fast service-level test. The full
 * generator flow (evidence gather + LLM answer) is Task 4.
 */
@ActiveProfiles("companion-fake")
class WeightDiagnosisIT extends AbstractIntegrationTest {

    @Autowired private DiagnosisService diagnosisService;
    @Autowired private DiagnosisRepository diagnosisRepository;
    @Autowired private DiagnosisPopulator diagnosisPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private static LocalDate someMonday() {
        LocalDate date = LocalDate.now().minusWeeks(1);
        return date.minusDays(date.getDayOfWeek().getValue() - 1L);
    }

    @Test
    void fewerThanThreeWeighInsIs409() {
        UUID user = userPopulator.createUser("weight-diag-few@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("79.8"));

        assertThatThrownBy(() -> diagnosisService.generate(
                user, DiagnosisEntity.PHENOMENON_WEIGHT, monday))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("DIAGNOSIS_INSUFFICIENT_WEIGHINS")
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void anExistingNonStaleAnchorRowIsReusedWithoutBurningQuota() {
        UUID user = userPopulator.createUser("weight-diag-reuse@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("79.8"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(2), new BigDecimal("79.6"));
        // The existing row was generated AFTER the last weigh-in went in — nothing newer landed.
        Instant generatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        DiagnosisEntity existing = diagnosisPopulator.weightDiagnosis(user, monday, generatedAt);

        Instant dayStart = LocalDate.now().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        Instant dayEnd = LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        long quotaBefore = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);

        var response = diagnosisService.generate(user, DiagnosisEntity.PHENOMENON_WEIGHT, monday);

        assertThat(response.getId()).isEqualTo(existing.getId());
        long quotaAfter = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);
        assertThat(quotaAfter).isEqualTo(quotaBefore);
    }
}
