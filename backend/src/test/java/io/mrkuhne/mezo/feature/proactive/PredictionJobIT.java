package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.proactive.service.PredictionJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class PredictionJobIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired
    private PredictionJob job;

    @Autowired
    private PredictionRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PatternPopulator patternPopulator;

    @Autowired
    private PredictionPopulator predictionPopulator;

    @Autowired
    private WeightLogPopulator weightLogPopulator;

    @Test
    void testRunWeekly_shouldGenerate_whenUserHasConfirmedPattern() {
        UUID user = userPopulator.createUser("pj-gen@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        job.runWeekly();
        assertThat(repository.existsByCreatedByAndWeekStart(user, WEEK)).isTrue();
    }

    @Test
    void testRunValidation_shouldCloseDueWindow_whenDataPresent() {
        UUID user = userPopulator.createUser("pj-val@test.local").getId();
        // a closed window (last completed week), weight dropped
        LocalDate pastWeek = WEEK.minusWeeks(2);
        predictionPopulator.prediction(user, pastWeek, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_PENDING);
        weightLogPopulator.createWeightLog(user, pastWeek.minusDays(5), new BigDecimal("79.0"));
        weightLogPopulator.createWeightLog(user, pastWeek.plusDays(2), new BigDecimal("78.0"));

        job.runValidation();

        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user).getFirst().getStatus())
                .isEqualTo(PredictionEntity.STATUS_VALIDATED);
    }
}
