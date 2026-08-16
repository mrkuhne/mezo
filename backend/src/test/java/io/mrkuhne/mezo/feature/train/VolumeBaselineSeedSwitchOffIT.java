package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Volume progression switch OFF (mezo-xlmp): with {@code mezo.feature.volume-progression.enabled
 * =false} the {@code VolumeProgressionGate} bean is absent, so a run started as ACTIVE must get NO
 * volume-log rows — byte-identical to the pre-seed behavior, and that holds even when the template
 * itself carries explicit landmarks (mezo-meyc.1). Separate class because a
 * {@code @ConditionalOnProperty} bean's presence is fixed per Spring context (mirrors {@code
 * VolumeEffectiveSetsSwitchOffIT}).
 */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class VolumeBaselineSeedSwitchOffIT extends AbstractIntegrationTest {

    @Autowired MesoTemplateService mesoTemplateService;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired DatabasePopulator databasePopulator;

    @Test
    void testStartTemplate_shouldSeedNothing_whenSwitchOff() {
        UUID user = databasePopulator.populateUser("seed-off@test.local");
        UUID templateId = mesoTemplateService.create(user, MesoTemplateUpsertRequest.builder()
            .title("Switch-off teszt")
            .weeks(6)
            .split("PPL").style("RP")
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV))
            .volumePerMuscle(Map.of("chest", VolumeBaseline.builder()
                .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build()))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Push").muscle("chest")
                .exercises(List.of(GymExerciseInput.builder().name("Bench Press").muscle("chest")
                    .warmupSets(2).workingSets(4).repMin(6).repMax(8).targetRIR(2)
                    .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                .build()))
            .build()).getId();

        MesocycleResponse started = mesoTemplateService.start(user, templateId,
            MesoTemplateStartRequest.builder()
                .startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE)
                .build());

        assertThat(volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(
            user, List.of(started.getId()))).isEmpty();
    }
}
