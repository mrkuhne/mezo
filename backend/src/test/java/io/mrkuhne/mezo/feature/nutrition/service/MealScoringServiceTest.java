package io.mrkuhne.mezo.feature.nutrition.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.WorkoutWindow;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure-math unit test (no Spring): the engine's inputs are already-scaled {@link ScoredLine}
 * carriers + directly-constructed config records (testing_standards.md "pure utility" rule).
 * The amount/per scaling that BUILDS the lines is the callers' job — covered by the meal/recipe ITs.
 */
class MealScoringServiceTest {

    private final NutritionTargetsProperties targets =
        new NutritionTargetsProperties(3100, 220, 380, 95, 4000);

    private final MealScoringProperties props = new MealScoringProperties(
        new MealScoringProperties.Weights(0.22, 0.10, 0.14, 0.10, 0.18, 0.08, 0.06, 0.12, 0.12),
        new MealScoringProperties.NovaGroupScores(1.0, 0.85, 0.55, 0.20),
        2.0,
        0.0,
        new MealScoringProperties.MicroRefs(38),
        new MealScoringProperties.WhoRefs(0.10, 5),
        new MealScoringProperties.FatQualityRefs(0.10, 0.33),
        new MealScoringProperties.PlantDiversityRefs(3,
            List.of("vegetables", "fruits", "grains", "legumes", "nuts_seeds")),
        new MealScoringProperties.EnergyDensityRefs(150, 400),
        new MealScoringProperties.PortionRefs(0.30),
        new MealScoringProperties.SlotShares(0.25, 0.35, 0.30, 0.10),
        new MealScoringProperties.SlotWindows(5, 10, 11, 15, 17, 22),
        0.4,
        120,   // preLeadMin
        90,    // postTrailMin
        new MealScoringProperties.Roles(
            new MealScoringProperties.RoleRubric(150, 550, 60,
                new MealScoringProperties.WhoRefs(0.30, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.9, 0.8, 0.6)),
            new MealScoringProperties.RoleRubric(300, 480, 70,
                new MealScoringProperties.WhoRefs(0.20, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.88, 0.7, 0.45))));

    private final MealScoringService service = new MealScoringService(props, targets);

    /** Target-proportional lunch, 800 kcal NOVA-1 line + 285 kcal NOVA-4 line, facts on line 1 only. */
    private List<ScoredLine> lunchLines() {
        return List.of(
            new ScoredLine("Zabkása", "300g",
                bd(800), bd(41), bd(70), bd(18), (short) 1,
                bd(10), bd(5), bd(1), bd(3), true, null, null),
            new ScoredLine("Whey shake", "1 adag",
                bd(285), bd(14), bd(25), bd(6), (short) 4,
                null, null, null, null, false, null, null));
    }

    // A carb-heavy, high-sugar, NOVA-4 line — the "PB Banana Toast" shape.
    private List<ScoredLine> fuelLines() {
        return List.of(new ScoredLine(
            "PB Banana Toast", "1 adag",
            new BigDecimal("237"), new BigDecimal("10"), new BigDecimal("42"), new BigDecimal("3"),
            (short) 4,
            new BigDecimal("8"), new BigDecimal("20"), new BigDecimal("1.0"), new BigDecimal("0.5"),
            true, null, null));
    }

    @Test
    void testScoreMeal_shouldEmitEightWeightedDimensions_whenLinesScored() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        // lunchLines carry no category/gram data → plant-diversity + energy-density degrade to weight 0
        assertThat(b.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "context");
        assertThat(b.dimensions()).extracting(d -> d.weight().doubleValue())
            .containsExactly(0.22, 0.10, 0.14, 0.10, 0.18, 0.0, 0.0, 0.12);
        // total = Σ w·s / Σ w recomputed from the emitted dimensions (self-consistency)
        double weightSum = b.dimensions().stream().mapToDouble(d -> d.weight().doubleValue()).sum();
        double expected = b.dimensions().stream()
            .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum() / weightSum;
        assertThat(b.value().doubleValue()).isCloseTo(expected, within(0.02));
        assertThat(b.value().doubleValue()).isBetween(0.0, 1.0);
        // P8 prose stays honest-empty; tools list the deterministic provenance
        assertThat(b.summary()).isNull();
        assertThat(b.improve()).isEmpty();
        assertThat(b.tools()).isNotEmpty();
    }

    @Test
    void testScoreMeal_shouldLeaveTaglineNull_whenNoCoachRan() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        // the coach's card-sized socket (mezo-mr4n) — the scorer never fabricates prose
        assertThat(b.tagline()).isNull();
    }

    @Test
    void testScoreMeal_shouldScoreMacroNearPerfect_whenSharesMatchTargets() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension macro = b.dimensions().getFirst();
        // 55p/95c/24f on 1085 kcal ≈ the 220/380/95 target shares → deviation ~0 → score 1.00
        assertThat(macro.score()).isEqualByComparingTo("1.00");
        assertThat(macro.macro().kcalShareOfDay().doubleValue()).isCloseTo(35.0, within(0.5));
        assertThat(macro.macro().notes()).isNull();
    }

    @Test
    void testScoreMeal_shouldNotPenalizeProteinOvershoot_whenSurplusPenaltyZero() {
        // 60p/40c/10f on 490 macro-kcal → shares 49/33/18% vs targets ~27/47/26%: protein +22pp
        // is FORGIVEN (fitness-app policy, mezo-8ms6); only the carb (−14pp) and fat (−8pp)
        // deficits count → deviation (0.1404+0.0790)/2 → score 1 − 2·0.1097 = 0.78 (symmetric: 0.56)
        var lines = List.of(line("Csirkés tál", 620, 60, 40, 10, 1, 5.0, 8.0, 0.5, 3.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "macro");
        assertThat(dim.score()).isEqualByComparingTo("0.78");
    }

    @Test
    void testScoreMeal_shouldStillPenalizeProteinDeficit_whenSurplusPenaltyZero() {
        // 20p/100c/15f on 615 macro-kcal → shares 13/65/22%: the protein DEFICIT (−14pp) and the
        // carb surplus (+18pp) count in full → deviation 0.1834 → score 1 − 2·0.1834 = 0.63
        var lines = List.of(line("Tésztás tál", 620, 20, 100, 15, 1, 5.0, 8.0, 0.5, 3.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "macro");
        assertThat(dim.score()).isEqualByComparingTo("0.63");
    }

    @Test
    void testScoreMeal_shouldReproduceSymmetricPenalty_whenSurplusPenaltyOne() {
        // surplus-penalty 1.0 must reproduce the old total-variation score for the SAME
        // protein-heavy line as the forgiveness test: (0.2194+0.1404+0.0790)/2 → 0.56
        MealScoringProperties symmetric = new MealScoringProperties(
            props.weights(), props.nova(), props.macroDeviationSlope(), 1.0, props.micro(),
            props.who(), props.fatQuality(), props.plantDiversity(), props.energyDensity(),
            props.portion(), props.slotShares(), props.slotWindows(), props.slotShareTolerance(),
            props.preLeadMin(), props.postTrailMin(), props.roles());
        MealScoringService symmetricService = new MealScoringService(symmetric, targets);

        var lines = List.of(line("Csirkés tál", 620, 60, 40, 10, 1, 5.0, 8.0, 0.5, 3.0));
        var dim = dimension(symmetricService.scoreMeal("lunch", lines, LocalTime.NOON), "macro");
        assertThat(dim.score()).isEqualByComparingTo("0.56");
    }

    @Test
    void testScoreMeal_shouldEmitKcalWeightedNova_whenLinesCarryNova() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension nova = dimension(b, "nova");
        // 0.7373·1.0 + 0.2627·0.20 = 0.79
        assertThat(nova.score()).isEqualByComparingTo("0.79");
        assertThat(nova.nova().dominant()).isEqualTo(1);
        assertThat(nova.nova().stack()).hasSize(4);
        assertThat(nova.nova().stack().getFirst().pct()).isEqualTo(74);
        assertThat(nova.nova().items()).hasSize(2);
        assertThat(nova.nova().items().get(1).warning()).isTrue(); // the NOVA-4 line
    }

    @Test
    void testScoreMeal_shouldBuildFiberOnlyMicroRow_whenFactsPresent() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension micro = dimension(b, "micro");
        assertThat(micro.micros()).hasSize(1);
        MealBreakdownJson.MicroRow fiber = micro.micros().getFirst();
        // 10 g fiber vs 38·0.35 = 13.3 g allotment → 75% · ok
        assertThat(fiber.name()).isEqualTo("Rost");
        assertThat(fiber.pct()).isEqualTo(75);
        assertThat(fiber.status()).isEqualTo("ok");
        // confidence = Σ(effWeight·coverage)/Σ effWeight over the live set = 0.90
        assertThat(b.confidence()).isEqualByComparingTo("0.90");
    }

    @Test
    void testScoreMeal_shouldRenormalizeTotal_whenNovaCoverageZero() {
        List<ScoredLine> noNova = List.of(
            new ScoredLine("Házi étel", "400g", bd(800), bd(41), bd(70), bd(18), null,
                bd(10), bd(5), bd(1), bd(3), true, null, null));

        MealBreakdownJson b = service.scoreMeal("lunch", noNova, LocalTime.of(13, 0));

        MealBreakdownJson.Dimension nova = dimension(b, "nova");
        assertThat(nova.weight()).isEqualByComparingTo("0");
        assertThat(nova.score()).isEqualByComparingTo("0");
        assertThat(nova.detail()).contains("Nincs");
        // total renormalizes over the live dims only (nova/plant/energy degrade here)
        double weightSum = b.dimensions().stream().mapToDouble(d -> d.weight().doubleValue()).sum();
        double expected = b.dimensions().stream()
            .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum() / weightSum;
        assertThat(b.value().doubleValue()).isCloseTo(expected, within(0.02));
    }

    @Test
    void testScoreMeal_shouldPenalizeTiming_whenLoggedOutsideSlotWindow() {
        MealBreakdownJson inWindow = service.scoreMeal("breakfast", lunchLines(), LocalTime.of(7, 30));
        MealBreakdownJson late = service.scoreMeal("breakfast", lunchLines(), LocalTime.of(14, 0));

        double inScore = dimension(inWindow, "context").score().doubleValue();
        double lateScore = dimension(late, "context").score().doubleValue();
        assertThat(lateScore).isLessThan(inScore);
        assertThat(dimension(late, "context").context()).isNotEmpty();
    }

    @Test
    void testScoreMeal_shouldScoreWhoDimension_whenSugarAndSaltWithinLimits() {
        // one 620-kcal line (20% of 3100): sugar 8g → 8*4/620 = 5.2 E% (≤10% → sub 1.0);
        // salt allotment 5g*0.2 = 1.0g, salt 0.5g → ratio 0.5 → sub 1.0; score = 1.0
        var lines = List.of(line("Zab", 620, 20, 80, 20, 1, 5.0, 8.0, 0.5, 3.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "who");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
        assertThat(dim.label()).isEqualTo("Ajánlások · WHO");
    }

    @Test
    void testScoreMeal_shouldPenalizeWhoDimension_whenSugarExceedsEnergyShareLimit() {
        // sugar 31g → 31*4/620 = 20 E% → ratio 2.0 → limitSub 0; salt fine → sub 1.0; score 0.5
        var lines = List.of(line("Édes", 620, 10, 100, 10, 2, 2.0, 31.0, 0.5, 2.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "who");
        assertThat(dim.score()).isEqualByComparingTo("0.50");
    }

    @Test
    void testScoreMeal_shouldScoreFatQuality_whenSaturatedShareLow() {
        // satFat 3g of f=20g → share 0.15 (≤0.33 → sub 1.0); satFat E% = 27/620 = 4.4% → sub 1.0
        var lines = List.of(line("Hal", 620, 40, 20, 20, 1, 2.0, 3.0, 0.5, 3.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "fat_quality");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void testScoreMeal_shouldDegradeFatQuality_whenNoFatFacts() {
        var lines = List.of(lineNoFacts("Rejtély", 620, 40, 20, 20, 1));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "fat_quality");
        assertThat(dim.weight()).isEqualByComparingTo("0.00");
    }

    @Test
    void testScoreMeal_shouldCountDistinctPlantCategories_forPlantDiversity() {
        var lines = List.of(
            lineWithCategory("Zab", 300, "grains"), lineWithCategory("Áfonya", 100, "fruits"),
            lineWithCategory("Mandula", 120, "nuts_seeds"), lineWithCategory("Túró", 200, "dairy"));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "plant_diversity");
        assertThat(dim.score()).isEqualByComparingTo("1.00"); // 3 distinct plant cats / target 3
    }

    @Test
    void testScoreMeal_shouldScorePartialPlantDiversity_whenBelowTarget() {
        var lines = List.of(lineWithCategory("Zab", 300, "grains"), lineWithCategory("Túró", 200, "dairy"));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "plant_diversity");
        assertThat(dim.score()).isEqualByComparingTo("0.33"); // 1/3
    }

    @Test
    void testScoreMeal_shouldScoreEnergyDensity_fromGramLinesOnly() {
        // 300 kcal over 200 g → 150 kcal/100g → score 1.0; a db-unit line is excluded from density
        var lines = List.of(lineWithGrams("Saláta", 300, new BigDecimal("200")),
            lineNoGrams("Tojás db", 150));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "energy_density");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void testScoreMeal_shouldDegradeEnergyDensity_whenNoGramLines() {
        var lines = List.of(lineNoGrams("Tojás db", 150));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "energy_density");
        assertThat(dim.weight()).isEqualByComparingTo("0.00");
    }

    @Test
    void testScoreMeal_shouldScoreEnergyDensity_forRealisticPerServingLine() {
        // pins the density arithmetic the composers must feed: 300 kcal over 80 g → 375 kcal/100g;
        // between good(150) and bad(400) → score = (400-375)/(400-150) = 0.10 (NOT amount/per-scaled).
        // The recipe fitLines per-serving gram scaling that produces this is pinned by the Task 3 IT.
        var lines = List.of(lineWithGrams("Zabkása adag", 300, new BigDecimal("80")));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "energy_density");
        assertThat(dim.score()).isEqualByComparingTo("0.10");
        assertThat(dim.context().getFirst().value()).isEqualTo("375 kcal/100g");
    }

    @Test
    void testRecipeTemplateBreakdown_shouldEmitPortionDimension_withSlotBudget() {
        // per-serving 775 kcal vs breakfast budget 3100*0.25 = 775 → rel 1.0 → score 1.0
        var lines = List.of(line("Reggeli", 775, 40, 90, 25, 1, 5.0, 8.0, 0.8, 4.0));
        var breakdown = service.recipeTemplateBreakdown("breakfast", lines);
        var dim = dimension(breakdown, "portion");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
        assertThat(breakdown.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .doesNotContain("context");
    }

    @Test
    void testRecipeTemplateBreakdown_shouldUseDefaultShare_whenRecipeHasNoSlot() {
        // slot null → defaultShare 0.30 → budget 930; 930 kcal → rel 1.0 → score 1.0
        var lines = List.of(line("Főétel", 930, 50, 100, 30, 1, 6.0, 9.0, 1.0, 5.0));
        var dim = dimension(service.recipeTemplateBreakdown(null, lines), "portion");
        assertThat(dim.score()).isEqualByComparingTo("1.00");
    }

    @Test
    void testMicroDim_shouldScoreFiberOnly_afterRedistribution() {
        // fiber-only micro: rows contain exactly one "Rost" row, no Cukor/Só/Telített zsír rows
        var lines = List.of(line("Zab", 620, 20, 80, 20, 1, 7.6, 8.0, 0.5, 3.0));
        var dim = dimension(service.scoreMeal("lunch", lines, LocalTime.NOON), "micro");
        assertThat(dim.micros()).hasSize(1);
        assertThat(dim.micros().get(0).name()).isEqualTo("Rost");
    }

    @Test
    void testRecipeFit_shouldScoreWithoutContext_andRenormalize() {
        BigDecimal fit = service.recipeFit("lunch", lunchLines());

        assertThat(fit).isNotNull();
        assertThat(fit.doubleValue()).isBetween(0.0, 1.0);
        // context excluded (portion replaces it): fit reflects the template surface — scores high
        assertThat(fit.doubleValue()).isGreaterThan(0.7);
    }

    @Test
    void testRecipeTemplateBreakdown_shouldMatchRecipeFitAndEmitPortion_whenLinesScored() {
        MealBreakdownJson b = service.recipeTemplateBreakdown("lunch", lunchLines());

        assertThat(b).isNotNull();
        // hero ≡ envelope: recipeFit is a delegate of this method by construction (mezo-bw3y)
        assertThat(b.value()).isEqualByComparingTo(service.recipeFit("lunch", lunchLines()));
        // template surface: portion instead of context, no context dimension at all
        assertThat(b.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .containsExactly("macro", "micro", "who", "fat_quality", "nova",
                "plant_diversity", "energy_density", "portion");
        // live weights renormalized over the present dims and summing to ~1
        double weightSum = b.dimensions().stream().mapToDouble(d -> d.weight().doubleValue()).sum();
        assertThat(weightSum).isCloseTo(1.0, within(0.01));
        // plant/energy degrade (lunchLines carry no category/gram data) → honest zero weight
        assertThat(dimension(b, "plant_diversity").weight()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(dimension(b, "energy_density").weight()).isEqualByComparingTo(BigDecimal.ZERO);
        // prose stays empty here (the LLM layer merges over it); confidence is a real coverage mix
        assertThat(b.summary()).isNull();
        assertThat(b.improve()).isEmpty();
        assertThat(b.confidence().doubleValue()).isStrictlyBetween(0.0, 1.01);
        assertThat(b.tools()).extracting(MealBreakdownJson.ToolRow::name)
            .contains("templateFit(weights_renormalized)");
    }

    @Test
    void testRecipeFit_shouldReturnNull_whenNoLineHasKcal() {
        BigDecimal fit = service.recipeFit("lunch", List.of(
            new ScoredLine("Fűszer", "5g", bd(0), bd(0), bd(0), bd(0), null,
                null, null, null, null, false, null, null)));

        assertThat(fit).isNull(); // honest: nothing to score → pending, never a fabricated number
    }

    @Test
    void testClassifyRole_shouldBePreWorkout_whenInsideLeadWindow() {
        var gym = new WorkoutWindow(LocalTime.of(14, 30), LocalTime.of(15, 30), false);
        // 13:20 is 70 min before start, inside the 120-min pre-lead
        MealRole role = MealScoringService.classifyRole(LocalTime.of(13, 20), List.of(gym), 120, 90);
        assertThat(role).isEqualTo(MealRole.PRE_WORKOUT);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenBeforeLeadWindow() {
        var gym = new WorkoutWindow(LocalTime.of(14, 30), LocalTime.of(15, 30), false);
        // 12:00 is 150 min before start, OUTSIDE the 120-min pre-lead
        assertThat(MealScoringService.classifyRole(LocalTime.of(12, 0), List.of(gym), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldBePostWorkout_whenInsideTrailAndDone() {
        var gym = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), true);
        // 10:45 is 45 min after end, inside the 90-min trail, workout DONE
        assertThat(MealScoringService.classifyRole(LocalTime.of(10, 45), List.of(gym), 120, 90))
            .isEqualTo(MealRole.POST_WORKOUT);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenInTrailButNotDone() {
        var gym = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), false);
        // in the post window but the workout was NOT done → no recovery bonus
        assertThat(MealScoringService.classifyRole(LocalTime.of(10, 45), List.of(gym), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenNoWorkouts() {
        assertThat(MealScoringService.classifyRole(LocalTime.of(13, 0), List.of(), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldPreferPostDone_whenBetweenDonePriorAndUpcomingWorkout() {
        var morningDone = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), true);
        var eveningPlanned = new WorkoutWindow(LocalTime.of(11, 30), LocalTime.of(12, 30), false);
        // 10:45: post-window of the DONE morning workout AND pre-window of the planned one → post wins
        assertThat(MealScoringService.classifyRole(
                LocalTime.of(10, 45), List.of(morningDone, eveningPlanned), 120, 90))
            .isEqualTo(MealRole.POST_WORKOUT);
    }

    @Test
    void testScoreMeal_shouldEqualStandardOverload_whenRoleStandard() {
        var lines = fuelLines();
        MealBreakdownJson viaOverload = service.scoreMeal("breakfast", lines, LocalTime.of(6, 13));
        MealBreakdownJson viaRole =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.STANDARD);
        assertThat(viaRole.value()).isEqualByComparingTo(viaOverload.value());
    }

    @Test
    void testScoreMeal_shouldNotPenalizeFuel_whenPreWorkout() {
        var lines = fuelLines();
        MealBreakdownJson standard =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.PRE_WORKOUT);

        // whole score lifts, and the three role-sensitive dims each lift (or hold) vs standard
        assertThat(pre.value().doubleValue()).isGreaterThan(standard.value().doubleValue());
        assertThat(dimension(pre, "who").score().doubleValue())
            .isGreaterThan(dimension(standard, "who").score().doubleValue());
        assertThat(dimension(pre, "nova").score().doubleValue())
            .isGreaterThan(dimension(standard, "nova").score().doubleValue());
        assertThat(dimension(pre, "macro").score().doubleValue())
            .isGreaterThanOrEqualTo(dimension(standard, "macro").score().doubleValue());
    }

    @Test
    void testScoreMeal_shouldTagRole_whenNonStandard() {
        MealBreakdownJson pre =
            service.scoreMeal("breakfast", fuelLines(), LocalTime.of(6, 13), MealRole.PRE_WORKOUT);
        assertThat(dimension(pre, "context").context())
            .anySatisfy(row -> assertThat(row.label()).isEqualTo("Szerep"));
    }

    @Test
    void testScoreMeal_shouldNotTagRole_whenStandard() {
        MealBreakdownJson std =
            service.scoreMeal("breakfast", fuelLines(), LocalTime.of(6, 13), MealRole.STANDARD);
        assertThat(dimension(std, "context").context())
            .noneSatisfy(row -> assertThat(row.label()).isEqualTo("Szerep"));
    }

    @Test
    void testRecipeTemplateBreakdown_shouldEqualLegacyOutput_whenRoleIsStandard() {
        MealBreakdownJson legacy = service.recipeTemplateBreakdown("breakfast", preWorkoutLines());
        MealBreakdownJson explicit =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);

        assertThat(explicit.value()).isEqualByComparingTo(legacy.value());
        assertThat(explicit.confidence()).isEqualByComparingTo(legacy.confidence());
        assertThat(explicit.dimensions()).usingRecursiveComparison().isEqualTo(legacy.dimensions());
    }

    @Test
    void testRecipeTemplateBreakdown_shouldLiftRoleSensitiveDimensions_whenRolePreWorkout() {
        MealBreakdownJson std =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT);

        assertThat(dimension(pre, "who").score()).isGreaterThan(dimension(std, "who").score());
        assertThat(dimension(pre, "nova").score()).isGreaterThan(dimension(std, "nova").score());
        assertThat(dimension(pre, "macro").score()).isGreaterThan(dimension(std, "macro").score());
        assertThat(pre.value()).isGreaterThan(std.value());
    }

    @Test
    void testRecipeTemplateBreakdown_shouldKeepRoleIndependentDimensions_whenRolePreWorkout() {
        MealBreakdownJson std =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT);

        for (String id : List.of("micro", "fat_quality", "plant_diversity", "energy_density", "portion")) {
            assertThat(dimension(pre, id).score())
                .as("dimension %s must be role-independent", id)
                .isEqualByComparingTo(dimension(std, id).score());
        }
    }

    @Test
    void testRecipeTemplateBreakdown_shouldLowerTheValue_whenRolePreWorkoutAndProfileIsProteinFatDominant() {
        MealBreakdownJson std =
            service.recipeTemplateBreakdown("breakfast", proteinFatLines(), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.recipeTemplateBreakdown("breakfast", proteinFatLines(), MealRole.PRE_WORKOUT);

        // The overlay is a RETARGET, not a bonus: pre-workout wants carbs (c 550 vs 380), so a
        // protein/fat-dominant template deviates FURTHER from the pre target than from the base one.
        assertThat(dimension(pre, "macro").score()).isLessThan(dimension(std, "macro").score());
        // macro is the sole driver here — everything else is degraded or role-independent, so the
        // whole envelope follows it down (no role-sensitive dimension is live to offset it).
        for (String id : List.of("micro", "who", "fat_quality", "nova", "plant_diversity")) {
            assertThat(dimension(pre, id).weight())
                .as("dimension %s must be degraded for this fixture", id)
                .isEqualByComparingTo(BigDecimal.ZERO);
        }
        assertThat(pre.value()).isLessThan(std.value());
    }

    @Test
    void testRecipeFit_shouldMatchTemplateValue_whenRoleGiven() {
        assertThat(service.recipeFit("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT))
            .isEqualByComparingTo(
                service.recipeTemplateBreakdown("breakfast", preWorkoutLines(), MealRole.PRE_WORKOUT).value());
    }

    // --- line builders (mirror the file's ScoredLine constructor style) --------------------------

    /** Carb/sugar-heavy pre-workout profile: white toast + honey + banana, one serving. */
    private List<ScoredLine> preWorkoutLines() {
        return List.of(
            new ScoredLine("Fehér toast", "80g",
                bd(210), bd(7), bd(40), bd(2), (short) 4,
                bd(2), bd(4), bd(1), bd(0.5), true, "grains", bd(80)),
            new ScoredLine("Méz", "30g",
                bd(90), bd(0), bd(24), bd(0), (short) 3,
                bd(0), bd(23), bd(0), bd(0), true, null, bd(30)),
            new ScoredLine("Banán", "120g",
                bd(107), bd(1), bd(27), bd(0), (short) 1,
                bd(3), bd(14), bd(0), bd(0), true, "fruits", bd(120)));
    }


    /**
     * Protein/fat-dominant PER-SERVING profile: one 125 g line of 375 kcal / p 16.25 / c 5 / f 5.625.
     * The macro grams are the {@code RecipeBreakdownApiIT} food's per-100g p 13 / c 4 / f 4.5 scaled
     * to a serving the way {@code RecipeService.fitLines} does (250 g over 2 servings ⇒ ×1.25, the
     * label keeping the recipe-level amount); the energy is this fixture's own, higher than the IT's.
     * Facts-less, NOVA-less and category-less ON PURPOSE (the API fixture carries none either), so
     * every role-sensitive dimension except macro degrades to weight 0 and the macro retarget is the
     * only thing moving the envelope value.
     */
    private List<ScoredLine> proteinFatLines() {
        return List.of(new ScoredLine("Túró", "250g",
            bd(375), bd(16.25), bd(5), bd(5.625), null,
            null, null, null, null, false, null, bd(125)));
    }

    /** Fully-covered line: nutrition facts + a plant-neutral category + a gram amount (who/fat/micro). */
    private ScoredLine line(String name, double kcal, double p, double c, double f, int nova,
            double fiber, double sugar, double salt, double satFat) {
        return new ScoredLine(name, "adag", bd(kcal), bd(p), bd(c), bd(f), (short) nova,
            bd(fiber), bd(sugar), bd(salt), bd(satFat), true, "other", bd(kcal));
    }

    /** kcal + pantry category only (plant-diversity input); no facts / grams. */
    private ScoredLine lineWithCategory(String name, double kcal, String category) {
        return new ScoredLine(name, "adag", bd(kcal), null, null, null, null,
            null, null, null, null, false, category, null);
    }

    /** kcal + a gram amount (energy-density input); no facts / category. */
    private ScoredLine lineWithGrams(String name, double kcal, BigDecimal amountG) {
        return new ScoredLine(name, "adag", bd(kcal), null, null, null, null,
            null, null, null, null, false, null, amountG);
    }

    /** kcal only, discrete unit (null amountG) — excluded from the energy-density mass. */
    private ScoredLine lineNoGrams(String name, double kcal) {
        return new ScoredLine(name, "adag", bd(kcal), null, null, null, null,
            null, null, null, null, false, null, null);
    }

    /** Macros only, no nutrition-quality facts (hasMicroFacts=false) — degrades who/fat/micro. */
    private ScoredLine lineNoFacts(String name, double kcal, double p, double c, double f, int nova) {
        return new ScoredLine(name, "adag", bd(kcal), bd(p), bd(c), bd(f), (short) nova,
            null, null, null, null, false, null, null);
    }

    /** Finds a dimension by id in the emitted envelope, or fails. */
    private static MealBreakdownJson.Dimension dimension(MealBreakdownJson envelope, String id) {
        return envelope.dimensions().stream()
            .filter(d -> d.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new AssertionError("no dimension with id " + id));
    }

    @Test
    void testScoreMeal_shouldUseProvidedDailyTargets_whenBaseGiven() {
        // A cutting-goal day: 2400 kcal, 180/240/70 g. The same lunch must be judged
        // against THESE shares, not the static 3100/220/380/95 config.
        DailyTargets base = new DailyTargets(2400, 180, 240, 70, "goal");

        MealBreakdownJson withGoal =
            service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0), MealRole.STANDARD, base);
        MealBreakdownJson withConfig =
            service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0), MealRole.STANDARD);

        MealBreakdownJson.Dimension goalMacro = withGoal.dimensions().get(0);
        MealBreakdownJson.Dimension configMacro = withConfig.dimensions().get(0);
        assertThat(goalMacro.id()).isEqualTo("macro");
        // The target shares differ (config P share ≈ 26%, goal P share ≈ 29%) → different score.
        assertThat(goalMacro.score()).isNotEqualTo(configMacro.score());
        // kcalShareOfDay uses the goal kcal: (800+285)/2400 ≈ 45.2%, not (…)/3100 ≈ 35.0%.
        assertThat(goalMacro.macro().kcalShareOfDay()).isEqualByComparingTo(new BigDecimal("45.2"));
    }

    @Test
    void testScoreMeal_shouldMatchConfigOverload_whenBaseIsFromConfig() {
        // The delegating overload and an explicit config-derived base are byte-identical.
        MealBreakdownJson explicit = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0),
            MealRole.STANDARD, DailyTargets.fromConfig(targets));
        MealBreakdownJson implicit = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        assertThat(explicit).isEqualTo(implicit);
    }

    @Test
    void testScoreMeal_shouldKeepRoleRubric_whenPrePostWithGoalBase() {
        // PRE/POST rubrics are role-absolute config bundles — a goal base must NOT change the
        // macro targets they judge against, only the day-share denominators (kcalShare, slot kcal).
        DailyTargets base = new DailyTargets(2400, 180, 240, 70, "goal");
        List<WorkoutWindow> windows = List.of(
            new WorkoutWindow(LocalTime.of(15, 0), LocalTime.of(16, 0), false));
        MealRole role = MealScoringService.classifyRole(LocalTime.of(14, 0), windows, 120, 90);
        assertThat(role).isEqualTo(MealRole.PRE_WORKOUT);

        MealBreakdownJson b =
            service.scoreMeal("snack", lunchLines(), LocalTime.of(14, 0), role, base);
        // The pre-workout macro target label comes from the role rubric (150/550/60), whose
        // protein share is 150·4 / (150·4+550·4+60·9) ≈ 18%.
        assertThat(b.dimensions().get(0).macro().targetP()).isEqualTo("~18%");
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }
}
