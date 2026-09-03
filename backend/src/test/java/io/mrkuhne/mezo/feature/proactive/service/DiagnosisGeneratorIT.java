package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Diagnosis generation over the fake LLM (mezo-hqfi.2). The {@code [fake-diagnosis:{…}]} sentinel
 * is planted in a CONFIRMED PATTERN's MECHANISM, which the collector renders exactly once as the
 * candidate's detail. Not the title: that column is {@code @Size(max = 200)} and the scripted
 * JSON is longer; mechanism is {@code text}.
 *
 * <p>No class-level {@code @Transactional} — the house rule for generator ITs.
 */
@ActiveProfiles("companion-fake")
class DiagnosisGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private DiagnosisGenerator generator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    private void seedTwoDomains(UUID user) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 4, 7, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.5"), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    private void plantSentinel(UUID user, String json) {
        PatternEntity pattern = patternPopulator.createPattern(
                user, "pair-" + UUID.randomUUID().toString().substring(0, 8), "Alvás minta");
        pattern.setMechanism("[fake-diagnosis:" + json + "]");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
    }

    private static String scripted(String metricKey, String direction, int totalDays, String indexes) {
        return "{\"verdict\":\"Az alvásod esett vissza.\",\"confidence\":\"strong\","
                + "\"suspects\":[{\"title\":\"Alváshiány\",\"claim\":\"Kevesebbet alszol.\","
                + "\"evidenceIndexes\":" + indexes + ",\"strength\":\"strong\","
                + "\"probe\":{\"text\":\"Feküdj le 23:00 előtt.\",\"metricKey\":\"" + metricKey
                + "\",\"expectedDirection\":\"" + direction + "\",\"totalDays\":" + totalDays + "}}]}";
    }

    @Test
    void persistsAValidatedDiagnosis() {
        UUID user = userPopulator.createUser("diag-ok@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, scripted("SLEEP_DURATION_H", "up", 7, "[0]"));

        DiagnosisEntity diagnosis = generator.generate(user, TODAY);

        assertThat(diagnosis).isNotNull();
        assertThat(diagnosis.getVerdict()).isEqualTo("Az alvásod esett vissza.");
        assertThat(diagnosis.getConfidence()).isEqualTo("strong");
        assertThat(diagnosis.getWindowDays()).isEqualTo(14);
        assertThat(diagnosis.getSuspects().suspects()).hasSize(1);
        assertThat(diagnosis.getSuspects().suspects().get(0).rank()).isEqualTo(1);
        assertThat(diagnosis.getSuspects().suspects().get(0).metricKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(diagnosis.getSuspects().suspects().get(0).evidenceIndexes()).containsExactly(0);
        assertThat(diagnosis.getEvidence().items()).isNotEmpty();
    }

    @Test
    void dropsASuspectWhoseEvidenceIndexIsOutOfRange() {
        UUID user = userPopulator.createUser("diag-oob@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, scripted("SLEEP_DURATION_H", "up", 7, "[9999]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithNoEvidenceAtAll() {
        UUID user = userPopulator.createUser("diag-noev@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, scripted("SLEEP_DURATION_H", "up", 7, "[]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithAnUnknownMetricKey() {
        UUID user = userPopulator.createUser("diag-badmetric@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, scripted("NOT_A_METRIC", "up", 7, "[0]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithAnOutOfBandProbeLength() {
        UUID user = userPopulator.createUser("diag-baddays@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, scripted("SLEEP_DURATION_H", "up", 900, "[0]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void returnsNullWhenThereIsNotEnoughData() {
        UUID user = userPopulator.createUser("diag-thin@test.local").getId();
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
        }

        assertThat(generator.generate(user, TODAY)).isNull();
    }
}
