package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** LLM half of the plan generator on the companion-fake profile (default switches ON). */
@org.springframework.test.context.ActiveProfiles("companion-fake")
class MesoPlanGenerateAiIT extends ApiIntegrationTest {

    private static final String GENERATE = "/api/train/meso-plans/generate";

    @Test
    void testGenerateMesoPlan_shouldStayDeterministic_whenFakeAnswersEmptyDays() {
        org.springframework.http.HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén", "Szo")).weeks(6).priorities(Map.of("back", "emphasize")).build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        // fake's default answer is {"rationale":"FAKE-INDOK","days":[]} — no accepted pick, so
        // the endpoint must report the answer as unused and keep the deterministic rationale.
        assertThat(res.getLlmUsed()).isFalse();
        assertThat(res.getRationale()).isNotEqualTo("FAKE-INDOK");
        int backSets = res.getTemplate().getDays().stream().flatMap(d -> d.getExercises().stream())
            .filter(e -> "back".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle())))
            .mapToInt(GymExerciseInput::getWorkingSets).sum();
        assertThat(backSets).isEqualTo(12);
    }

    @Test
    void testGenerateMesoPlan_shouldHonorScriptedPick_whenSentinelPlantedInGoalText() {
        org.springframework.http.HttpHeaders auth = ownerAuthHeaders();
        List<ExerciseCatalogItem> catalog =
            getForList("/api/train/exercises", auth, org.springframework.http.HttpStatus.OK, ExerciseCatalogItem.class);
        ExerciseCatalogItem chestIso = catalog.stream()
            .filter(i -> i.getMuscle().startsWith("chest") && i.getType() == ExerciseCatalogItem.TypeEnum.ISOLATION)
            .findFirst().orElseThrow();
        String script = "[fake-meso-plan:{\"rationale\":\"Szkriptelt\",\"days\":[{\"day\":\"Hét\",\"exercises\":[{\"catalogId\":\""
            + chestIso.getId() + "\",\"workingSets\":1}]}]}]";

        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén", "Szo")).weeks(6).goalText(script).build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isTrue();
        assertThat(res.getRationale()).isEqualTo("Szkriptelt");
        var monChest = res.getTemplate().getDays().get(0).getExercises().stream()
            .filter(e -> "chest".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle()))).toList();
        assertThat(monChest).extracting(GymExerciseInput::getCatalogId).containsExactly(chestIso.getId());
        assertThat(monChest.get(0).getWorkingSets()).isEqualTo(4); // frame's chest 8 / 2 days, not the scripted 1
    }

    @Test
    void testGenerateMesoPlan_shouldFallBackDeterministic_whenFakeFails() {
        org.springframework.http.HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Csü")).weeks(4).goalText("[fake-fail]").build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isFalse();
        assertThat(res.getTemplate().getDays()).hasSize(7);
    }
}
