package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The pure-code fatigue gather (mezo-hqfi.2): coverage discipline, deterministic ordering, and
 * the honest "not enough domains" absence. No LLM anywhere in this path.
 */
class FatigueEvidenceCollectorIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private FatigueEvidenceCollector collector;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ExperimentRepository experimentRepository;

    /** Sleep (SLEEP domain) + check-in (MIND domain) on every day of the window AND the baseline. */
    private void seedTwoDomains(UUID user, double windowSleepH, double baselineSleepH) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), BigDecimal.valueOf(windowSleepH), 7);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 5, 5, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), BigDecimal.valueOf(baselineSleepH), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    @Test
    void returnsNullWhenFewerThanTwoDomainsHaveCoverage() {
        UUID user = userPopulator.createUser("gather-thin@test.local").getId();
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.0"), 8);
        }

        assertThat(collector.gather(user, TODAY)).isNull();
    }

    @Test
    void dropsAMetricBelowTheCoverageThreshold() {
        UUID user = userPopulator.createUser("gather-coverage@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);
        // Water on only 3 of the 14 days — below min-coverage-days (7), so DAILY_WATER_ML must
        // not become a candidate even though the FUEL domain now has some data.
        for (int i = 0; i < 3; i++) {
            waterLogPopulator.createWaterLog(user, TODAY.minusDays(i), 500);
        }

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        assertThat(gather.candidates()).noneMatch(item -> "DAILY_WATER_ML".equals(item.metricKey()));
        assertThat(gather.candidates())
                .filteredOn(item -> "metric".equals(item.kind()))
                .isNotEmpty()
                .allMatch(item -> item.coverageDays() >= 7);
    }

    @Test
    void carriesValueBaselineAndDeltaForEachMetric() {
        UUID user = userPopulator.createUser("gather-delta@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        EvidenceItem sleep = gather.candidates().stream()
                .filter(item -> "SLEEP_DURATION_H".equals(item.metricKey()))
                .findFirst().orElseThrow();
        assertThat(sleep.value()).isEqualTo(6.0);
        assertThat(sleep.baselineValue()).isEqualTo(7.5);
        assertThat(sleep.delta()).isEqualTo(-1.5);
        assertThat(sleep.sourceHu()).isEqualTo("Alvás-napló");
        assertThat(sleep.label()).isEqualTo("alváshossz");
    }

    @Test
    void numbersEveryCandidateExactlyOnceInThePayload() {
        UUID user = userPopulator.createUser("gather-payload@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        for (int i = 0; i < gather.candidates().size(); i++) {
            assertThat(gather.payload()).contains("\n" + i + ": ");
        }
        // Each label appears exactly once — the sentinel-safety property DiagnosisGeneratorIT needs.
        String label = gather.candidates().get(0).label();
        assertThat(gather.payload().split(Pattern.quote(label), -1)).hasSize(2);
    }

    @Test
    void feedsPriorDiagnosisExperimentsBackIntoThePayload() {
        UUID user = userPopulator.createUser("gather-prior@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        ExperimentEntity prior = new ExperimentEntity();
        prior.setCreatedBy(user);
        prior.setTitle("Korábbi alvás-kísérlet");
        prior.setHypothesis("Feküdj le 23:00 előtt.");
        prior.setStatus(ExperimentEntity.STATUS_COMPLETED);
        prior.setMetricKey("SLEEP_DURATION_H");
        prior.setExpectedDirection("up");
        prior.setStartDate(TODAY.minusDays(20));
        prior.setTotalDays(7);
        prior.setOutcome("Bevált.");
        prior.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        prior.setSource(ExperimentEntity.SOURCE_DIAGNOSIS);
        experimentRepository.saveAndFlush(prior);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        assertThat(gather.payload()).contains("KORÁBBI KÍSÉRLETEK");
        assertThat(gather.payload()).contains("Korábbi alvás-kísérlet");
        assertThat(gather.payload()).contains("Bevált.");
        // Context only — a prior experiment is never citable evidence.
        assertThat(gather.candidates()).noneMatch(item -> "Korábbi alvás-kísérlet".equals(item.label()));
    }

    @Test
    void orderingIsDeterministicAcrossCalls() {
        UUID user = userPopulator.createUser("gather-order@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        assertThat(collector.gather(user, TODAY).candidates())
                .isEqualTo(collector.gather(user, TODAY).candidates());
    }
}
