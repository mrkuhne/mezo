package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The switch-off twin of {@link WorkoutTodayStyleIT} (the gate bean's presence is fixed per Spring
 * context, hence a separate class): with the Hypertrophy Drive off there is no prescription and no
 * effort-ramp overlay — the row's stamped targetRir stands (mezo-r36n9.79).
 */
@TestPropertySource(properties = "mezo.feature.hypertrophy-drive.enabled=false")
class WorkoutTodayStyleSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainService trainService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired OwnerProperties ownerProperties;

    @Test
    void engineOffKeepsTheStampedReserve() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        MesocycleEntity meso = train.createActiveMeso(owner);
        meso.setPhaseCurve(List.of("MAV", "MAV", "MAV", "MAV", "MAV", "Deload"));
        meso.setCurrentWeek(5); // last loading week: the ramp would take reserve 2 → 0
        meso.setTrainingStyle("balanced");
        meso.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        mesocycleRepository.saveAndFlush(meso);
        String label = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), label);
        trainService.replaceDayExercises(owner, meso.getId(), day.getId(), List.of(
            GymExerciseInput.builder().name("Machine Chest Press").muscle("chest-mid").warmupSets(2).workingSets(3)
                .repMin(8).repMax(12).targetRIR(3).type(GymExerciseInput.TypeEnum.COMPOUND)
                .catalogId(catalogRepository.findBySlug("machine-chest-press").orElseThrow().getId()).build()));

        TodayExercise t = workoutService.getToday(owner, null).getExercises().get(0);

        assertThat(t.getTargetRIR()).isEqualTo(2); // the balanced stamp, not the ramped 0
        assertThat(t.getPrescribedSets()).isNull();
    }
}
