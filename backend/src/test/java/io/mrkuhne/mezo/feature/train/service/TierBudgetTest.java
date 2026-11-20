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
}
