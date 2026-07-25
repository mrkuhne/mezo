package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Volume progression switch OFF (mezo-hi9m): with {@code mezo.feature.volume-progression.enabled
 * =false} the {@code VolumeProgressionGate} bean is absent, so getToday must neither run the
 * weekly rollover nor override any exercise's working-set count — every exercise keeps its
 * template {@code workingSets} (Plan-1 behavior), even when a volume-log row exists that would
 * otherwise redistribute it. Separate class because a {@code @ConditionalOnProperty} bean's
 * presence is fixed per Spring context (mirrors {@code ClosingBlockSwitchOffIT}).
 */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class VolumeEffectiveSetsSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void testGetToday_shouldKeepTemplateCounts_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        MesocycleEntity meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity benchPress = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        benchPress.setWorkingSets(3);
        train.save(benchPress);
        ExerciseEntity flye = train.createExercise(owner, day.getId(), "Cable Flye", 1, "chest", "isolation", null);
        flye.setWorkingSets(2);
        train.save(flye);
        // Same fixture as VolumeEffectiveSetsIT's distribute-case (chest currentSets=14 >> template
        // sum 5) — with the switch off this must have NO effect on either exercise's workingSets.
        train.createVolumeLog(owner, meso.getId(), "chest", 14);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise benchTe = byId(res, benchPress.getId());
        TodayExercise flyeTe = byId(res, flye.getId());
        assertThat(benchTe.getWorkingSets()).isEqualTo(3);
        assertThat(flyeTe.getWorkingSets()).isEqualTo(2);
    }

    private TodayExercise byId(WorkoutTodayResponse res, UUID exerciseId) {
        return res.getExercises().stream()
            .filter(e -> exerciseId.equals(e.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("exercise " + exerciseId + " not found in getToday response"));
    }
}
