package io.mrkuhne.mezo.feature.nutrition.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ContextRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * The score envelope is written in the account's language (mezo-n4wf5.5): the same meal scored
 * for a Hungarian and for an English account carries the same numbers and ids, and different
 * words. The Hungarian sentences asserted here are the exact pre-bundle strings: when the
 * sentences moved into the bundle, 40 000 random envelopes (meal and template surface, every
 * role, three host locales) were compared field by field against the former implementation.
 */
class MealScoringLanguageTest {

    private static final Pattern HUNGARIAN_LETTER = Pattern.compile("[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]");

    private final NutritionTargetsProperties targets =
        new NutritionTargetsProperties(3100, 220, 380, 95, 4000);

    private final MealScoringProperties props = new MealScoringProperties(
        new MealScoringProperties.Weights(0.22, 0.10, 0.14, 0.10, 0.18, 0.08, 0.06, 0.12, 0.12),
        new MealScoringProperties.NovaGroupScores(1.0, 0.85, 0.55, 0.20),
        2.0, 0.0, 0.25,
        new MealScoringProperties.MicroRefs(38),
        new MealScoringProperties.WhoRefs(0.10, 5),
        new MealScoringProperties.FatQualityRefs(0.10, 0.33),
        new MealScoringProperties.PlantDiversityRefs(3,
            List.of("vegetables", "fruits", "grains", "legumes", "nuts_seeds")),
        new MealScoringProperties.EnergyDensityRefs(150, 400, 100),
        new MealScoringProperties.PortionRefs(0.30),
        new MealScoringProperties.SlotShares(0.25, 0.35, 0.30, 0.10),
        new MealScoringProperties.SlotWindows(5, 10, 11, 15, 17, 22),
        0.4, 0.25, 120, 90,
        new MealScoringProperties.Roles(
            new MealScoringProperties.RoleRubric(150, 550, 60,
                new MealScoringProperties.WhoRefs(0.30, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.9, 0.8, 0.6)),
            new MealScoringProperties.RoleRubric(300, 480, 70,
                new MealScoringProperties.WhoRefs(0.20, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.88, 0.7, 0.45))));

    private final MealScoringService hu = new MealScoringService(props, targets, UserMessages.fixed("hu"));
    private final MealScoringService en = new MealScoringService(props, targets, UserMessages.fixed("en"));

    /** Every dimension has data: facts, a plant category and a gram amount on both lines. */
    private static List<ScoredLine> fullLines() {
        return List.of(
            new ScoredLine("Zabkása", "300g", bd("800"), bd("41"), bd("70"), bd("18"), (short) 1,
                bd("10"), bd("5"), bd("1"), bd("3"), "grains", bd("300")),
            new ScoredLine("Alma", "150g", bd("80"), bd("0.5"), bd("20"), bd("0.3"), (short) 1,
                bd("3.6"), bd("15"), bd("0"), bd("0.1"), "fruits", bd("150")));
    }

    /** Nothing but kcal and macros: every coverage-gated dimension degrades. */
    private static List<ScoredLine> bareLines() {
        return List.of(new ScoredLine("Valami", "1 adag", bd("400"), bd("20"), bd("40"), bd("15"),
            null, null, null, null, null, null, null));
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private static Dimension dim(MealBreakdownJson b, String id) {
        return b.dimensions().stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    private static String row(Dimension d, int i) {
        ContextRow r = d.context().get(i);
        return r.label() + " = " + r.value();
    }

    @Test
    void testScoreMeal_shouldKeepTheHungarianSentences_whenAccountIsHungarian() {
        MealBreakdownJson b = hu.scoreMeal("lunch", fullLines(), LocalTime.of(13, 0));

        assertThat(dim(b, "macro").label()).isEqualTo("Kcal & makró arány");
        assertThat(dim(b, "macro").detail())
            .isEqualTo("Az energia 24% fehérje · 52% szénhidrát · 24% zsír — a cél 27/47/26%.");
        assertThat(dim(b, "macro").macro().targetOrigin()).isEqualTo(
            "az alapértelmezett napi keret (nincs aktív cél-előírás erre a napra)"
                + " · 220 g fehérje / 380 g szénhidrát / 95 g zsír egy 3100 kcal-s napra");
        assertThat(dim(b, "micro").detail()).isEqualTo("Rost 13.6 g a(z) 10.8 g allotmenthez (126%).");
        assertThat(dim(b, "who").detail()).isEqualTo("Cukor az energia 9%-a (WHO ≤10%) · só a keret 70%-án");
        assertThat(row(dim(b, "who"), 0)).isEqualTo("Cukor = 9 E% / 10 E% limit");
        assertThat(row(dim(b, "who"), 1)).isEqualTo("Só = 1 g / 1.4 g keret");
        assertThat(dim(b, "fat_quality").detail())
            .isEqualTo("Telített zsír 3.1 g — az energia 3.2%-a · az összzsír 17%-a.");
        assertThat(row(dim(b, "fat_quality"), 1)).isEqualTo("Telített E% = 3.2% / 10% limit");
        assertThat(dim(b, "nova").detail()).isEqualTo("Domináns NOVA 1 · a kalóriák 100%-a NOVA 1–2 forrásból.");
        assertThat(dim(b, "plant_diversity").detail()).isEqualTo("2 különböző növényi kategória a 3-s célhoz.");
        assertThat(row(dim(b, "plant_diversity"), 1)).isEqualTo("Összesen = 2 / 3 cél");
        assertThat(dim(b, "energy_density").detail()).isEqualTo(
            "450 g étel 880 kcal-t hoz — 196 kcal/100g (150 alatt teljes pont, 400 felett nulla).");
        assertThat(row(dim(b, "energy_density"), 2)).isEqualTo("Lefedettség = 100% gramm-alapú");
        assertThat(dim(b, "context").label()).isEqualTo("Időzítés & kontextus");
        assertThat(row(dim(b, "context"), 0)).isEqualTo("Időzítés = 13:00 · ebéd ablakban");
        assertThat(row(dim(b, "context"), 1)).isEqualTo("Adag vs keret = 880 kcal / ~1085 kcal névleges slot-keret");
        assertThat(dim(b, "context").timing().slotLabel()).isEqualTo("ebéd");
    }

    @Test
    void testScoreMeal_shouldWriteEnglish_whenAccountIsEnglish() {
        MealBreakdownJson b = en.scoreMeal("lunch", fullLines(), LocalTime.of(13, 0));

        assertThat(dim(b, "macro").label()).isEqualTo("Kcal and macro split");
        assertThat(dim(b, "macro").detail())
            .isEqualTo("Energy is 24% protein · 52% carbs · 24% fat. The target is 27/47/26%.");
        assertThat(dim(b, "macro").macro().targetOrigin()).isEqualTo(
            "The default daily budget (no goal targets for this day)"
                + " · 220 g protein / 380 g carbs / 95 g fat for a 3100 kcal day");
        assertThat(dim(b, "micro").detail()).isEqualTo("Fibre 13.6 g against a share of 10.8 g for this meal (126%).");
        assertThat(dim(b, "who").detail())
            .isEqualTo("Sugar is 9% of the energy (WHO ≤10%) · salt is at 70% of its budget");
        assertThat(row(dim(b, "who"), 1)).isEqualTo("Salt = 1 g / 1.4 g budget");
        assertThat(dim(b, "fat_quality").detail())
            .isEqualTo("Saturated fat 3.1 g: 3.2% of the energy · 17% of the total fat.");
        assertThat(dim(b, "plant_diversity").detail()).isEqualTo("2 different plant categories against a target of 3.");
        assertThat(row(dim(b, "context"), 0)).isEqualTo("Timing = 13:00 · inside the lunch window");
        assertThat(dim(b, "context").timing().slotLabel()).isEqualTo("lunch");
    }

    @Test
    void testScoreMeal_shouldMoveNoNumber_whenOnlyTheLanguageDiffers() {
        MealBreakdownJson a = hu.scoreMeal("dinner", fullLines(), LocalTime.of(23, 30), MealRole.POST_WORKOUT);
        MealBreakdownJson b = en.scoreMeal("dinner", fullLines(), LocalTime.of(23, 30), MealRole.POST_WORKOUT);

        assertThat(b.value()).isEqualByComparingTo(a.value());
        assertThat(b.confidence()).isEqualByComparingTo(a.confidence());
        assertThat(b.dimensions()).extracting(Dimension::id)
            .containsExactlyElementsOf(a.dimensions().stream().map(Dimension::id).toList());
        assertThat(b.dimensions()).extracting(Dimension::score)
            .containsExactlyElementsOf(a.dimensions().stream().map(Dimension::score).toList());
        assertThat(row(dim(a, "context"), 0)).isEqualTo("Szerep = Post-workout regeneráció");
        assertThat(row(dim(b, "context"), 0)).isEqualTo("Role = Post-workout recovery");
        assertThat(row(dim(b, "context"), 1)).isEqualTo("Timing = 23:30 · outside the dinner window");
    }

    @Test
    void testScoreMeal_shouldLeaveNoHungarianWord_whenAccountIsEnglish() {
        // Both the full and the degraded shape, the meal and the template surface, every role.
        for (MealRole role : MealRole.values()) {
            assertNoHungarian(en.scoreMeal("breakfast", fullLines(), LocalTime.of(8, 0), role));
            assertNoHungarian(en.scoreMeal("snack", bareLines(), LocalTime.of(16, 0), role));
            assertNoHungarian(en.recipeTemplateBreakdown("lunch", fullLines(), role));
            assertNoHungarian(en.recipeTemplateBreakdown(null, bareLines(), role));
        }
    }

    @Test
    void testRecipeTemplate_shouldNameTheDegradedDimensions_inBothLanguages() {
        MealBreakdownJson a = hu.recipeTemplateBreakdown(null, bareLines());
        MealBreakdownJson b = en.recipeTemplateBreakdown(null, bareLines());

        assertThat(dim(a, "micro").detail()).isEqualTo("Nincs rost-adat a tételekhez.");
        assertThat(dim(b, "micro").detail()).isEqualTo("No fibre data for these items.");
        assertThat(dim(a, "portion").detail()).isEqualTo("Egy adag a alapértelmezett büdzsé 43%-a.");
        assertThat(dim(b, "portion").detail()).isEqualTo("One serving is 43% of the default budget.");
        assertThat(row(dim(a, "portion"), 1)).isEqualTo("Slot-büdzsé = 930 kcal (alap 30%)");
        assertThat(row(dim(b, "portion"), 1)).isEqualTo("Slot budget = 930 kcal (default 30%)");
    }

    private static void assertNoHungarian(MealBreakdownJson b) {
        for (Dimension d : b.dimensions()) {
            assertThat(HUNGARIAN_LETTER.matcher(d.label()).find()).as(d.label()).isFalse();
            assertThat(HUNGARIAN_LETTER.matcher(d.detail()).find()).as(d.detail()).isFalse();
            if (d.context() != null) {
                for (ContextRow r : d.context()) {
                    assertThat(HUNGARIAN_LETTER.matcher(r.label() + r.value()).find())
                        .as(r.label() + " = " + r.value()).isFalse();
                }
            }
            if (d.macro() != null) {
                assertThat(HUNGARIAN_LETTER.matcher(d.macro().targetOrigin()).find()).as(d.macro().targetOrigin()).isFalse();
            }
        }
    }
}
