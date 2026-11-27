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
}
