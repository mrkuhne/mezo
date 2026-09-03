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
 * The recipe test (mezo-po3y): the SECOND phenomenon goes through the SAME generator with a
 * different recipe — sleep-relevant metric subset, sleep question line, the same validation
 * discipline. Sentinel planted in a confirmed pattern's MECHANISM (the DiagnosisGeneratorIT
 * channel).
 */
@ActiveProfiles("companion-fake")
class SleepDiagnosisIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private DiagnosisGenerator generator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    /** Sleep (SLEEP) + check-in stress (MIND) — two domains of sleep-recipe metrics. */
    private void seedTwoDomains(UUID user) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("5.8"), 4);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "20:00", 4, 8, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.4"), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "20:00", 7, 4, null);
        }
    }

    private void plantSentinel(UUID user, String json) {
        PatternEntity pattern = patternPopulator.createPattern(
                user, "pair-" + UUID.randomUUID().toString().substring(0, 8), "Stressz minta");
        pattern.setMechanism("[fake-diagnosis:" + json + "]");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
    }

    @Test
    void generatesASleepDiagnosisThroughTheSleepRecipe() {
        UUID user = userPopulator.createUser("sleep-diag@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, "{\"verdict\":\"Az esti stressz viszi el az alvásod.\","
                + "\"confidence\":\"moderate\",\"suspects\":[{\"title\":\"Esti stressz\","
                + "\"claim\":\"Magas stressz mellett alszol el.\",\"evidenceIndexes\":[0],"
                + "\"strength\":\"moderate\",\"probe\":{\"text\":\"Zárd a napot 21:30-kor.\","
                + "\"metricKey\":\"CHECKIN_STRESS\",\"expectedDirection\":\"down\",\"totalDays\":7}}]}");

        DiagnosisEntity diagnosis = generator.generate(user, TODAY, DiagnosisEntity.PHENOMENON_SLEEP);

        assertThat(diagnosis).isNotNull();
        assertThat(diagnosis.getPhenomenon()).isEqualTo("sleep");
        assertThat(diagnosis.getVerdict()).isEqualTo("Az esti stressz viszi el az alvásod.");
        assertThat(diagnosis.getSuspects().suspects()).hasSize(1);
        // the recipe's OWN metric subset produced the evidence — sleep state + stress present
        assertThat(diagnosis.getEvidence().items())
                .anyMatch(e -> "SLEEP_DURATION_H".equals(e.metricKey()))
                .anyMatch(e -> "CHECKIN_STRESS".equals(e.metricKey()));
        // fatigue-only metrics (CHECKIN_ENERGY) are NOT in the sleep recipe
        assertThat(diagnosis.getEvidence().items())
                .noneMatch(e -> "CHECKIN_ENERGY".equals(e.metricKey()));
    }

    @Test
    void theFatigueRecipeStillWorksUnchanged() {
        UUID user = userPopulator.createUser("sleep-diag-fatigue@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, "{\"verdict\":\"Fáradtság-verdikt.\",\"confidence\":\"weak\","
                + "\"suspects\":[{\"title\":\"Alváshiány\",\"claim\":\"Kevés alvás.\","
                + "\"evidenceIndexes\":[0],\"strength\":\"weak\",\"probe\":{\"text\":\"Aludj.\","
                + "\"metricKey\":\"SLEEP_DURATION_H\",\"expectedDirection\":\"up\",\"totalDays\":7}}]}");

        DiagnosisEntity diagnosis = generator.generate(user, TODAY, DiagnosisEntity.PHENOMENON_FATIGUE);

        assertThat(diagnosis).isNotNull();
        assertThat(diagnosis.getPhenomenon()).isEqualTo("fatigue");
    }
}
