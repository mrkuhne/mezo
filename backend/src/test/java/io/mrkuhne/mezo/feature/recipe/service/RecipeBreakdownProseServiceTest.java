package io.mrkuhne.mezo.feature.recipe.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure prompt-assembly test (no Spring, no LLM): the role must reach the model. Lives in the
 * service package (the {@code MealCoachPromptTest} precedent) because {@code userMessage} is
 * package-private for exactly this test; constructing with all-null collaborators is safe because
 * {@code userMessage} touches neither the LLM port, the ObjectMapper nor the call-context holder.
 */
class RecipeBreakdownProseServiceTest {

    private final RecipeBreakdownProseService service =
        new RecipeBreakdownProseService(null, null, null, null);

    private RecipeEntity recipe(MealRole role) {
        RecipeEntity e = new RecipeEntity();
        e.setName("PB Banana Toast");
        e.setCategory("breakfast");
        e.setServings(1);
        e.setRole(role);
        e.setLines(List.of());
        return e;
    }

    private MealBreakdownJson envelope() {
        return new MealBreakdownJson(new BigDecimal("0.60"), new BigDecimal("0.80"), null, null,
            List.of(), List.of(), List.of(), MealScoringService.FORMULA_VERSION);
    }

    @Test
    void testUserMessage_shouldNameTheFuelRole_whenRecipeIsPreWorkout() {
        String msg = service.userMessage(recipe(MealRole.PRE_WORKOUT), envelope());

        assertThat(msg).contains("edzés előtti");
    }

    @Test
    void testUserMessage_shouldNameTheRecoveryRole_whenRecipeIsPostWorkout() {
        assertThat(service.userMessage(recipe(MealRole.POST_WORKOUT), envelope()))
            .contains("edzés utáni");
    }

    @Test
    void testUserMessage_shouldNotClaimATrainingRole_whenRecipeIsStandard() {
        String msg = service.userMessage(recipe(MealRole.STANDARD), envelope());

        assertThat(msg).doesNotContain("edzés előtti").doesNotContain("edzés utáni");
    }

    private static MealBreakdownJson.Dimension dim(String id) {
        return new MealBreakdownJson.Dimension(id, id, new BigDecimal("0.2"), new BigDecimal("0.4"), null,
            "számolt", null, null, null, null, null, null);
    }

    private MealBreakdownJson envelopeWith(MealBreakdownJson.Dimension... dims) {
        return new MealBreakdownJson(new BigDecimal("0.60"), new BigDecimal("0.80"), null, null,
            List.of(dims), List.of(), List.of(), MealScoringService.FORMULA_VERSION);
    }

    @Test
    void testMerge_shouldKeepTaglineAndStampProseVersion_whenLlmGivesTagline() {
        var prose = new RecipeBreakdownProseService.ExtractedProse("Összegzés.",
            "  Fehérjében erős, a só húzza le.  ", List.of(), java.util.Map.of("who", "Hosszú magyarázat."),
            List.of(new RecipeBreakdownProseService.ExtractedImprove("Cseréld a feta felét túróra.", "-só", "who")));

        MealBreakdownJson out = RecipeBreakdownProseService.merge(envelopeWith(dim("macro"), dim("who")), prose);

        assertThat(out.tagline()).isEqualTo("Fehérjében erős, a só húzza le.");
        assertThat(out.proseVersion()).isEqualTo(RecipeBreakdownProseService.PROSE_VERSION);
        assertThat(out.dimensions().get(1).detail()).isEqualTo("Hosszú magyarázat.");
        assertThat(out.improve().getFirst().dimension()).isEqualTo("who");
    }

    @Test
    void testMerge_shouldDropImproveDimension_whenDimensionIsDegraded() {
        var degraded = new MealBreakdownJson.Dimension("who", "who", BigDecimal.ZERO, BigDecimal.ZERO, null,
            "nincs adat", null, null, null, null, null, null);
        var prose = new RecipeBreakdownProseService.ExtractedProse("Összegzés.", null, List.of(), null,
            List.of(new RecipeBreakdownProseService.ExtractedImprove("Kevesebb só.", "-só", "who")));

        MealBreakdownJson out = RecipeBreakdownProseService.merge(envelopeWith(dim("macro"), degraded), prose);

        assertThat(out.improve().getFirst().dimension()).isNull();
    }

    @Test
    void testMerge_shouldDropUnknownImproveDimension_whenIdNotInEnvelope() {
        var prose = new RecipeBreakdownProseService.ExtractedProse("Összegzés.", " ", List.of(), null,
            List.of(new RecipeBreakdownProseService.ExtractedImprove("Tipp.", "+rost", "timing")));

        MealBreakdownJson out = RecipeBreakdownProseService.merge(envelopeWith(dim("macro")), prose);

        assertThat(out.improve().getFirst().dimension()).isNull();
        assertThat(out.tagline()).isNull();
    }

    @Test
    void testUserMessage_shouldListSaltSources_whenWhoHasContributors() {
        var who = dim("who").withContributors(List.of(new MealBreakdownJson.Contributor("Feta", "salt",
            new BigDecimal("1.2"), "g", new BigDecimal("0.6316"))));

        String msg = service.userMessage(recipe(MealRole.STANDARD), envelopeWith(dim("macro"), who));

        assertThat(msg).contains("FORRÁSOK who: Feta 1.2 g só (63%)");
    }

    @Test
    void testSystemPrompt_shouldBanTemplateOpeners() {
        assertThat(RecipeBreakdownProseService.SYSTEM_PROMPT)
            .contains("\"tagline\"").contains("\"dimension\"").contains("„Ez egy")
            .contains("- Write Hungarian, tegeződve, tömören.");
    }

    // ---- parse(): tolerate the model's structural slips (mezo-r36n9.219 live, 2026-11-28) ----

    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    @Test
    void testParse_shouldHoistImprove_whenTheModelLeftDetailsUnclosed() {
        // seen live on 2 of 2 recipes: "details" never closed, so improve[] landed INSIDE it and the
        // top-level object lost its closing brace — Map<String,String> then choked on the array
        String answer = """
            {"tagline":"Laktató tányér, a telített zsír húzza le.","summary":"Összegzés.","fitsFor":["Főétel"],\
            "details":{"macro":"Makró szöveg.","portion":"Adag szöveg.",\
            "improve":[{"text":"Cseréld a steak felét.","impact":"-telített zsír","dimension":"fat_quality"}]}""";

        RecipeBreakdownProseService.ExtractedProse prose = RecipeBreakdownProseService.parse(JSON, answer);

        assertThat(prose.summary()).isEqualTo("Összegzés.");
        assertThat(prose.tagline()).isEqualTo("Laktató tányér, a telített zsír húzza le.");
        assertThat(prose.fitsFor()).containsExactly("Főétel");
        assertThat(prose.details()).containsOnlyKeys("macro", "portion");
        assertThat(prose.improve()).singleElement().satisfies(i -> {
            assertThat(i.text()).isEqualTo("Cseréld a steak felét.");
            assertThat(i.dimension()).isEqualTo("fat_quality");
        });
    }

    @Test
    void testParse_shouldReadAWellFormedAnswer_andDropNonTextDetails() {
        String answer = "Itt a válasz: {\"summary\":\"S.\",\"tagline\":\"T.\",\"fitsFor\":[],"
            + "\"details\":{\"macro\":\"M.\",\"micro\":[\"lista\"],\"who\":null},"
            + "\"improve\":[{\"text\":\"Tipp.\",\"impact\":\"+rost\",\"dimension\":\"micro\"}]} kész";

        RecipeBreakdownProseService.ExtractedProse prose = RecipeBreakdownProseService.parse(JSON, answer);

        assertThat(prose.summary()).isEqualTo("S.");
        assertThat(prose.details()).containsOnlyKeys("macro"); // an array or null detail is skipped, not fatal
        assertThat(prose.improve()).hasSize(1);
    }

    @Test
    void testParse_shouldReturnNull_whenThereIsNoReadableJson() {
        assertThat(RecipeBreakdownProseService.parse(JSON, "Sajnos nem tudok segíteni.")).isNull();
        assertThat(RecipeBreakdownProseService.parse(JSON, "{\"summary\": \"félbe")).isNull();
    }
}
