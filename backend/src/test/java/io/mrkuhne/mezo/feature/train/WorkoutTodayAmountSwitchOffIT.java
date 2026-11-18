package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The switch-off twin of {@link WorkoutTodayAmountIT#oneQuadExerciseKeepsItsThreeSets} (the gate
 * bean's presence is fixed per Spring context, hence a separate class): with the volume switch off
 * the workout prescribes the row's own {@code working_sets}, exactly as with it on.
 */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class WorkoutTodayAmountSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void gateOffIsIdentical() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        MesocycleEntity meso = train.createActiveMeso(owner);
        String label = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), label);
        ExerciseEntity legPress = train.createExercise(owner, day.getId(), "Leg Press", "quad", "compound");
        legPress.setWorkingSets(3);
        train.save(legPress);
        train.createVolumeLog(owner, meso.getId(), "quad", 8);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise te = res.getExercises().stream().filter(e -> legPress.getId().equals(e.getId()))
            .findFirst().orElseThrow();
        assertThat(te.getWorkingSets()).isEqualTo(3);
    }
}
