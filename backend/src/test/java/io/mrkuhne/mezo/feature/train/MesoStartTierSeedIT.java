package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** Tier-aware week-1 seed (mesocycle wizard redesign): an EMPHASIZE group starts at MEV+2. */
class MesoStartTierSeedIT extends ApiIntegrationTest {

    @Autowired
    private MuscleGroupVolumeLogRepository volumeLogRepository;

    @Autowired
    private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testStartTemplate_shouldSeedEmphasizeAtMevPlusTwo_whenPriorityIsEmphasize() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse tpl = postForBody("/api/train/meso-templates", request(), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody("/api/train/meso-templates/" + tpl.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now()).status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);

        List<MuscleGroupVolumeLogEntity> rows = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(ownerId(), List.of(run.getId()));

        assertThat(rows).extracting(MuscleGroupVolumeLogEntity::getMuscle).contains("back", "chest");
        assertThat(rows).filteredOn(r -> r.getMuscle().equals("back")).extracting(MuscleGroupVolumeLogEntity::getCurrentSets).containsExactly(12);
        assertThat(rows).filteredOn(r -> r.getMuscle().equals("chest")).extracting(MuscleGroupVolumeLogEntity::getCurrentSets).containsExactly(8);
    }

    private static MesoTemplateUpsertRequest request() {
        return MesoTemplateUpsertRequest.builder()
            .title("Tier seed teszt").weeks(6).goalPreset("hypertrophy")
            .musclePriorities(Map.of("back", "emphasize"))
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV, MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Upper").muscle("back").exercises(List.of(
                    ex("Row", "back-mid", GymExerciseInput.TypeEnum.COMPOUND),
                    ex("Bench", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND))).build(),
                MesoDayInput.builder().day("Csü").type("Upper").muscle("back").exercises(List.of(
                    ex("Pulldown", "back-wide", GymExerciseInput.TypeEnum.COMPOUND),
                    ex("Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION))).build()))
            .build();
    }

    private static GymExerciseInput ex(String name, String muscle, GymExerciseInput.TypeEnum type) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(10).targetRIR(1).type(type).build();
    }
}
