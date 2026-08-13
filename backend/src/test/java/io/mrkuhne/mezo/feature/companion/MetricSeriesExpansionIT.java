package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * V3.4 katalógus-bővítés (mezo-6ha5): az új KÖZVETLEN metrikák extraktorai populator-adat felett —
 * nap-aggregálás (átlag vs csúcs-érzékeny max), ablak-határok, hiányzó nap = nincs adatpont.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesExpansionIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    /** Egy befejezett workout-instance DAY-en két gyakorlattal + két feedbackkel. */
    private UUID seedFeedbackDay(UUID owner, int workloadA, int painA, int workloadB, int painB) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "V3.4 meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
                owner, meso.getId(), "H", "Pull Day", 0, "planned");
        ExerciseEntity exA = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        ExerciseEntity exB = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, DAY, "completed");
        trainPopulator.createFeedback(owner, instance.getId(), exA.getId(), 3, painA, workloadA);
        trainPopulator.createFeedback(owner, instance.getId(), exB.getId(), 3, painB, workloadB);
        return instance.getId();
    }

    @Test
    void testSeries_shouldAverageWorkload_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 1, 1, 3, 1);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_WORKLOAD, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isEqualTo(2.0);
    }

    @Test
    void testSeries_shouldTakeMaxJointPain_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 2, 1, 2, 3);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_JOINT_PAIN, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(3.0); // a fájdalom csúcs-érzékeny
    }

    @Test
    void testSeries_shouldAverageBodyAndMental_whenMultipleCheckInsPerDay() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 3, 2, 2, 4, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 3, 2, 4, 2, null);

        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_BODY, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_MENTAL, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
    }
}
