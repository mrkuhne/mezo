package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.gym.GymSignal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GymSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private GymSignalCalculator calculator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;

    @Test
    void testCompute_shouldAggregateVolumeAndE1rmPerMuscle_whenInstanceHasWeightedSets() {
        UUID user = databasePopulator.populateUser("gym@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp 04", "active");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "push", 0, "completed");
        // chest exercise (free-typed muscle, no catalog) with two weighted sets
        ExerciseEntity bench = trainPopulator.createExercise(user, instance.getId(), "Fekvenyomás", 0);
        bench.setMuscle("chest");
        exerciseRepository.saveAndFlush(bench);
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 0,
            new BigDecimal("100.00"), 10, false); // weight 100 × 10 = 1000; e1rm 100*(40/30)=133.3333
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 1,
            new BigDecimal("80.00"), 8, false);    // 640
        // a skipped set must be ignored
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 2,
            new BigDecimal("60.00"), 5, true);

        GymSignal signal = calculator.compute(user, instance.getId());

        assertThat(signal.instanceId()).isEqualTo(instance.getId());
        assertThat(signal.volumeByMuscle()).containsEntry("chest", 1640L); // 1000 + 640, skip ignored
        assertThat(signal.bestE1rm()).isEqualByComparingTo(new BigDecimal("133.3333"));
        assertThat(signal.workSetCount()).isEqualTo(2); // skipped excluded
        assertThat(signal.bodyweightRepCount()).isZero();
    }

    @Test
    void testCompute_shouldCountBodyweightRepsAndSkipE1rm_whenSetsHaveNoWeight() {
        UUID user = databasePopulator.populateUser("bw@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp 04", "active");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "pull", 0, "completed");
        ExerciseEntity pullup = trainPopulator.createExercise(user, instance.getId(), "Húzódzkodás", 0);
        pullup.setMuscle("lats");
        exerciseRepository.saveAndFlush(pullup);
        trainPopulator.createExerciseSetFull(user, pullup.getId(), instance.getId(), 0, null, 12, false);

        GymSignal signal = calculator.compute(user, instance.getId());

        assertThat(signal.volumeByMuscle()).doesNotContainKey("lats"); // no weighted volume
        assertThat(signal.bestE1rm()).isNull();
        assertThat(signal.workSetCount()).isEqualTo(1);
        assertThat(signal.bodyweightRepCount()).isEqualTo(12);
    }
}
