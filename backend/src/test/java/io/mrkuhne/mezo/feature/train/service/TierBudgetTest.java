package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.Input;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.PlanDay;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.PlanExercise;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TierBudgetTest {

    private static final VolumeProperties PROPS;
    static {
        Map<String, VolumeProperties.Baseline> b = new LinkedHashMap<>();
        b.put("chest", new VolumeProperties.Baseline(8, 14, 20));
        b.put("back", new VolumeProperties.Baseline(10, 16, 22));
        PROPS = new VolumeProperties(new BigDecimal("0.5"), 2, b, new VolumeProperties.Bands(3, 2, 5, 8, 1, 2, 2, 4),
            new VolumeProperties.WeeklyReview("auto"), 2, 1, 1, new VolumeProperties.Signals(3, 2, 7),
            new VolumeProperties.Evaluator(new BigDecimal("2.4"), new BigDecimal("1.0"), 6, 40, new BigDecimal("1")),
            Map.of());
    }

    private static final List<String> CURVE = List.of("MEV", "MAV", "MAV", "Deload");

    private static Input input(List<PlanDay> days, Map<String, String> prio, Integer target, boolean styled) {
        return new Input(4, CURVE, days, prio, Set.of(), false, target, Set.of(), PROPS, styled);
    }

    private static TierBudget.Result budget(Input in) {
        return TierBudget.of(in, PlanEvaluator.evaluate(in));
    }

    private static PlanDay chestDay(String label) {
        return new PlanDay(label, List.of(new PlanExercise("chest", 4, 1, true)));
    }

    @Test void capacityNullWithoutTarget() {
        TierBudget.Result r = budget(input(List.of(chestDay("Hét"), chestDay("Csü")), Map.of(), null, false));
        assertThat(r.capacitySets()).isNull();
        assertThat(r.usedSets()).isPositive();
    }

    @Test void capacityFourDaysSixty() {
        // balanced rests: compound 150 s, isolation 90 s
        List<PlanDay> days = List.of("Hét", "Kedd", "Csü", "Pén").stream().map(d -> new PlanDay(d, List.of(
            new PlanExercise("chest", 3, 2, true, 0, 150), new PlanExercise("back", 3, 0, true, 0, 90)))).toList();
        TierBudget.Result r = budget(input(days, Map.of(), 60, true));
        double avg = ((40 + 150) / 60.0 + (40 + 90) / 60.0) / 2;
        int perDay = (int) Math.floor((60 - 6 - 2 * 1.0) / (avg + 1 / 3.0));
        assertThat(r.capacitySets()).isEqualTo(4 * perDay).isEqualTo(68);
    }

    @Test void usedIsPeakLoadingWeek() {
        // chest grow 8 (band 8..14) steps +1: 8, 9, 10, Deload 5 -> the deload week is ignored
        TierBudget.Result r = budget(input(List.of(chestDay("Hét"), chestDay("Csü")), Map.of(), null, false));
        assertThat(r.usedSets()).isEqualTo(10);
    }

    @Test void raiseCostPositiveForMaintain() {
        // maintain chest 8 sits at its top (3..7 band, no step) -> raised to grow it climbs 8, 9, 10
        TierBudget.Result r = budget(input(List.of(chestDay("Hét"), chestDay("Csü")),
            Map.of("chest", "maintain"), null, false));
        assertThat(r.usedSets()).isEqualTo(8);
        assertThat(r.raiseCost()).containsEntry("chest", 2);
    }

    @Test void emphasizedHasNoRaiseCost() {
        TierBudget.Result r = budget(input(List.of(chestDay("Hét"), chestDay("Csü")),
            Map.of("chest", "emphasize"), null, false));
        assertThat(r.raiseCost()).doesNotContainKey("chest");
        assertThat(r.emphasizeCount()).isEqualTo(1);
        assertThat(r.emphasizeMax()).isEqualTo(2);
    }

    @Test void nullWithoutCountingExercises() {
        Input in = input(List.of(new PlanDay("Hét", List.of(new PlanExercise("chest", 3, 0, false)))),
            Map.of(), 60, false);
        assertThat(budget(in)).isNull();
    }

    @Test void capacityCountsOnlyDaysWithACountingRow() {
        // a mobility-only day (no counting row) is not a training day for the budget
        List<PlanDay> days = List.of(
            new PlanDay("Hét", List.of(new PlanExercise("chest", 3, 0, true, 0, 150))),
            new PlanDay("Kedd", List.of(new PlanExercise("chest", 3, 0, false, 0, 150))),
            new PlanDay("Csü", List.of(new PlanExercise("chest", 3, 0, true, 0, 150))));
        TierBudget.Result r = budget(input(days, Map.of(), 60, true));
        int perDay = (int) Math.floor((60 - 6) / ((40 + 150) / 60.0 + 1 / 3.0));
        assertThat(r.capacitySets()).isEqualTo(2 * perDay);
    }

    @Test void capacitySubtractsTheRealWarmupsAveragedPerDay() {
        // 11 + 1 warm-up sets over two days = 6 min a day (not a flat 2 sets: 13 sets a day, not 14)
        List<PlanDay> days = List.of(
            new PlanDay("Hét", List.of(new PlanExercise("chest", 3, 11, true, 0, 150))),
            new PlanDay("Csü", List.of(new PlanExercise("chest", 3, 1, true, 0, 150))));
        TierBudget.Result r = budget(input(days, Map.of(), 60, true));
        int perDay = (int) Math.floor((60 - 6 - 6 * 1.0) / ((40 + 150) / 60.0 + 1 / 3.0));
        assertThat(r.capacitySets()).isEqualTo(2 * perDay).isEqualTo(26);
    }

    @Test void unstyledCapacityUsesTheFlatSetFigureWithoutTransitions() {
        // unstyled minutes = 2.4 per working set + warm-ups + overhead, no per-exercise transition
        TierBudget.Result r = budget(input(List.of(chestDay("Hét"), chestDay("Csü")), Map.of(), 60, false));
        int perDay = (int) Math.floor((60 - 6 - 1 * 1.0) / 2.4);
        assertThat(r.capacitySets()).isEqualTo(2 * perDay);
    }

    /** Two chest rows of 2 sets a day: the per-exercise cap (5) does not bind the climb. */
    private static PlanDay twoChestRows(String label, int sets) {
        return new PlanDay(label, List.of(new PlanExercise("chest", sets, 0, true), new PlanExercise("chest", sets, 0, true)));
    }

    @Test void raiseCostGrowToEmphasize() {
        List<PlanDay> days = List.of(twoChestRows("Hét", 2), twoChestRows("Csü", 2));
        TierBudget.Result grow = budget(input(days, Map.of(), null, false));
        // emphasize steps faster than grow from the same 8 sets: the peak loading week is higher
        TierBudget.Result emph = budget(input(days, Map.of("chest", "emphasize"), null, false));
        assertThat(grow.raiseCost()).containsEntry("chest", emph.usedSets() - grow.usedSets());
        assertThat(grow.raiseCost().get("chest")).isPositive();
    }

    @Test void sportAdjustedRaiseKeepsItsFlag() {
        // chest 12 (maintain, no step) raised to Építés: the plain band (8..14) climbs to 14, the sport-adjusted
        // one (7..12) has no room above 12 — a raise priced on the plain band would cost 2, not 0
        List<PlanDay> days = List.of(twoChestRows("Hét", 3), twoChestRows("Csü", 3));
        Input sport = new Input(4, CURVE, days, Map.of("chest", "maintain"), Set.of("chest"), false, null, Set.of(),
            PROPS, false);
        Input sportGrow = new Input(4, CURVE, days, Map.of(), Set.of("chest"), false, null, Set.of(), PROPS, false);
        TierBudget.Result raised = budget(sport);
        assertThat(raised.raiseCost()).containsEntry("chest", budget(sportGrow).usedSets() - raised.usedSets());
        TierBudget.Result plain = budget(input(days, Map.of("chest", "maintain"), null, false));
        assertThat(raised.raiseCost().get("chest")).isLessThan(plain.raiseCost().get("chest"));
    }

    @Test void intakeCapacityNeverBelowTheSetsOfADayWithinTarget() {
        List<PlanDay> days = List.of("Hét", "Csü").stream().map(d -> new PlanDay(d, List.of(
            new PlanExercise("chest", 4, 2, true, 0, 150), new PlanExercise("back", 4, 0, true, 0, 90)))).toList();
        Input in = input(days, Map.of(), 40, true);
        PlanEvaluator.Result r = PlanEvaluator.evaluate(in);
        int minutes = r.days().get(0).minutesEstimate();
        // exactly at the target: no room for more, never fewer than it has
        Input at = input(days, Map.of(), minutes, true);
        assertThat(TierBudget.intakeCapacity(at, PlanEvaluator.evaluate(at))).isEqualTo(16);
        assertThat(TierBudget.weekOneSets(r)).isEqualTo(16);
        // 10 minutes more: + floor(10 / (set-weighted (190 + 130)/2/60 + 1/3)) per day
        Input more = input(days, Map.of(), minutes + 10, true);
        double perSet = (4 * 190 / 60.0 + 4 * 130 / 60.0) / 8 + 1 / 3.0;
        assertThat(TierBudget.intakeCapacity(more, PlanEvaluator.evaluate(more)))
            .isEqualTo(2 * (8 + (int) Math.floor(10 / perSet)));
        // over the target: the overrun shows as fewer sets than it has
        Input over = input(days, Map.of(), minutes - 10, true);
        assertThat(TierBudget.intakeCapacity(over, PlanEvaluator.evaluate(over))).isLessThan(16);
        assertThat(TierBudget.intakeCapacity(input(days, Map.of(), null, true), r)).isNull();
    }
}
