package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-r36n9.115: with {@code mezo.meso-plan.default-training-style} blank the generator writes the unstyled
 * block of before — no block style, the generator's own rep / RIR / warm-up frames, no rest, no overrides.
 */
@TestPropertySource(properties = {
    "mezo.feature.meso-plan-ai.enabled=false",
    "mezo.meso-plan.default-training-style="
})
class MesoPlanGenerateUnstyledIT extends ApiIntegrationTest {

    @Test
    void testGenerateMesoPlan_shouldWriteTheUnstyledFrames_whenDefaultStyleBlank() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody("/api/train/meso-plans/generate", MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Sze", "Csü", "Pén")).weeks(6).build(),
            auth, HttpStatus.OK, MesoPlanGenerateResponse.class);
        MesoTemplateUpsertRequest t = res.getTemplate();

        assertThat(t.getTrainingStyle()).isNull();
        assertThat(t.getTechniquesEnabled()).isNull();
        List<GymExerciseInput> all = t.getDays().stream().flatMap(d -> d.getExercises().stream()).toList();
        assertThat(all).isNotEmpty().allSatisfy(e -> {
            boolean compound = e.getType() == GymExerciseInput.TypeEnum.COMPOUND;
            assertThat(e.getTargetRIR()).as(e.getName()).isEqualTo(1);
            assertThat(e.getRepMin()).as(e.getName()).isEqualTo(compound ? 8 : 12);
            assertThat(e.getRepMax()).as(e.getName()).isEqualTo(compound ? 10 : 15);
            assertThat(e.getWarmupSets()).as(e.getName()).isEqualTo(compound ? 2 : 1);
            assertThat(e.getRestSec()).as(e.getName()).isNull();
            assertThat(e.getTrainingStyle()).as(e.getName()).isNull();
            assertThat(e.getOverrides()).as(e.getName()).isNullOrEmpty();
            assertThat(e.getTechnique()).as(e.getName()).isNull();
            assertThat(e.getCountsTowardVolume()).as(e.getName()).isTrue();
        });
    }
}
