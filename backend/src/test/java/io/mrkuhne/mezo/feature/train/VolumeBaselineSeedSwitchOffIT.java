package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Volume progression switch OFF (mezo-xlmp): with {@code mezo.feature.volume-progression.enabled
 * =false} the {@code VolumeProgressionGate} bean is absent, so a create-as-active wizard meso must
 * get NO baseline volume-log rows — byte-identical to the pre-seed behavior. Separate class because
 * a {@code @ConditionalOnProperty} bean's presence is fixed per Spring context (mirrors {@code
 * VolumeEffectiveSetsSwitchOffIT}).
 */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class VolumeBaselineSeedSwitchOffIT extends AbstractIntegrationTest {

    @Autowired TrainService trainService;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired DatabasePopulator databasePopulator;

    @Test
    void testCreateMesocycle_shouldSeedNothing_whenSwitchOff() {
        UUID user = databasePopulator.populateUser("seed-off@test.local");

        MesocycleResponse created = trainService.createMesocycle(user, MesocycleCreateRequest.builder()
            .title("Switch-off teszt")
            .status(MesocycleCreateRequest.StatusEnum.ACTIVE)
            .startDate(LocalDate.now())
            .weeks(6)
            .split("PPL").style("RP")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Push").muscle("chest")
                .exercises(List.of(GymExerciseInput.builder().name("Bench Press").muscle("chest")
                    .warmupSets(2).workingSets(4).repMin(6).repMax(8).targetRIR(2)
                    .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                .build()))
            .build());

        assertThat(volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(
            user, List.of(created.getId()))).isEmpty();
    }
}
