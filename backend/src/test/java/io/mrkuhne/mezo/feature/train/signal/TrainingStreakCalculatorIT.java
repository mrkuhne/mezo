package io.mrkuhne.mezo.feature.train.signal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The robustness streak counts a gym week only through a COMPLETED instance (mezo-iz4kt) — the
 * mezo-cd8s done-state: an auto-closed empty ('skipped') or still-open ('active') instance is not
 * training. Every expected value is year-boundary safe (the v1 week-key walk-back limitation).
 */
class TrainingStreakCalculatorIT extends ApiIntegrationTest {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private TrainingStreakCalculator trainingStreakCalculator;

    private record Fixture(UUID owner, WorkoutSessionEntity template) {}

    private Fixture fixture(String email) {
        UUID owner = databasePopulator.populateUser(email);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        return new Fixture(owner, trainPopulator.createTemplateDay(owner, meso.getId(), "Hét"));
    }

    @Test
    void testStreakWeeks_shouldBeZero_whenCurrentWeekHasOnlySkippedInstance() {
        Fixture f = fixture("streak-skipped@test.hu");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(TZ), "skipped");

        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isZero();
    }

    @Test
    void testStreakWeeks_shouldStopAtSkippedOnlyWeek_whenCurrentWeekIsCompleted() {
        Fixture f = fixture("streak-gap@test.hu");
        LocalDate today = LocalDate.now(TZ);
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), today, "completed");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), today.minusWeeks(1), "skipped");

        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isEqualTo(1);
    }

    @Test
    void testStreakWeeks_shouldBeZero_whenCurrentWeekHasOnlyActiveInstance() {
        Fixture f = fixture("streak-active@test.hu");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(TZ), "active");

        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isZero();
    }

    @Test
    void testStreakWeeks_shouldCountWeek_whenCurrentWeekHasCompletedInstance() {
        Fixture f = fixture("streak-done@test.hu");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(TZ), "completed");

        assertThat(trainingStreakCalculator.streakWeeks(f.owner())).isEqualTo(1);
    }
}
