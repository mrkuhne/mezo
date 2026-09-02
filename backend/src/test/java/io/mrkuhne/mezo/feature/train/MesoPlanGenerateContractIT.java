package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Deterministic half of the plan generator (AI switch OFF in this context). */
@TestPropertySource(properties = "mezo.feature.meso-plan-ai.enabled=false")
class MesoPlanGenerateContractIT extends ApiIntegrationTest {

    private static final String GENERATE = "/api/train/meso-plans/generate";

    @Test
    void testGenerateMesoPlan_shouldReturnSevenDayTemplateWithFrames_whenFourDays() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén", "Szo")).weeks(6)
            .priorities(Map.of("back", "emphasize", "calf", "maintain")).build(),
            auth, HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isFalse();
        assertThat(res.getRationale()).isNotBlank();
        MesoTemplateUpsertRequest t = res.getTemplate();
        assertThat(t.getGoalPreset()).isEqualTo("hypertrophy");
        assertThat(t.getWeeks()).isEqualTo(6);
        assertThat(t.getSplit()).isEqualTo("Upper / Lower · 4×/hét");
        assertThat(t.getPhaseCurve()).extracting(Enum::name).containsExactly("MEV", "MEV", "MAV", "MAV", "MRV", "DELOAD");
        assertThat(t.getMusclePriorities()).containsEntry("back", "emphasize").containsEntry("calf", "maintain").doesNotContainKey("chest");
        assertThat(t.getDays()).hasSize(7);
        assertThat(t.getDays()).extracting(MesoDayInput::getType).containsExactly("Upper", "Rest", "Lower", "Rest", "Upper", "Lower", "Rest");
        assertThat(t.getVolumePerMuscle()).containsKeys("chest", "back", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf");
        assertThat(t.getVolumePerMuscle().get("back").getMev()).isEqualTo(10);

        int backSets = t.getDays().stream().flatMap(d -> d.getExercises().stream())
            .filter(e -> "back".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle())))
            .mapToInt(GymExerciseInput::getWorkingSets).sum();
        assertThat(backSets).isEqualTo(12);
        assertThat(t.getDays().stream().flatMap(d -> d.getExercises().stream()))
            .allSatisfy(e -> {
                assertThat(e.getCatalogId()).isNotNull();
                assertThat(e.getWorkingSets()).isBetween(1, 8);
                assertThat(e.getTargetRIR()).isEqualTo(1);
            });
    }

    @Test
    void testGenerateMesoPlan_shouldBeSaveableAsTemplate_whenPostedBack() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Csü")).weeks(4).build(), auth, HttpStatus.OK, MesoPlanGenerateResponse.class);

        MesoTemplateResponse saved = postForBody("/api/train/meso-templates", res.getTemplate(), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDays()).hasSize(7);
    }

    @Test
    void testGenerateMesoPlan_shouldReturn400_whenDayTokenInvalid() {
        HttpHeaders auth = ownerAuthHeaders();
        String body = postForBody(GENERATE, Map.of("daysOfWeek", List.of("Mon", "Tue"), "weeks", 6),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "daysOfWeek[]", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testGenerateMesoPlan_shouldReturn400_whenPriorityValueUnknown() {
        HttpHeaders auth = ownerAuthHeaders();
        String body = postForBody(GENERATE, Map.of("daysOfWeek", List.of("Hét", "Csü"), "weeks", 6,
            "priorities", Map.of("back", "max")), auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
    }
}
