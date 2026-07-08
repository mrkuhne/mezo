package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PrescribedSetsFoundationIT extends AbstractIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseSetRepository exerciseSetRepository;
    @Autowired WorkoutService workoutService;

    @Test
    void testExerciseRecipe_shouldPersistWarmupAndWorkingCounts_whenSaved() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        ExerciseEntity reloaded = exerciseRepository.findById(ex.getId()).orElseThrow();
        assertThat(reloaded.getWarmupSets()).isEqualTo(2);
        assertThat(reloaded.getWorkingSets()).isEqualTo(3);
        assertThat(reloaded.getRepMin()).isEqualTo(6);
        assertThat(reloaded.getRepMax()).isEqualTo(8);
    }

    @Test
    void testLogSet_shouldDefaultKindToWorking_whenKindOmitted() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.startInstance(owner, day.getId());

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(0)
            .weightKg(BigDecimal.valueOf(80)).reps(8).rir(0).build();
        ExerciseSetResponse res = workoutService.logSet(owner, instance.getId(), req);

        ExerciseSetEntity saved = exerciseSetRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getKind()).isEqualTo("working");
        assertThat(res.getKind()).isEqualTo(ExerciseSetResponse.KindEnum.WORKING);
    }

    @Test
    void testLogSet_shouldPersistWarmupKind_whenKindWarmup() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.startInstance(owner, day.getId());

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(0)
            .weightKg(BigDecimal.valueOf(40)).reps(8).rir(4).kind("warmup").build();
        ExerciseSetResponse res = workoutService.logSet(owner, instance.getId(), req);

        assertThat(exerciseSetRepository.findById(res.getId()).orElseThrow().getKind()).isEqualTo("warmup");
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
