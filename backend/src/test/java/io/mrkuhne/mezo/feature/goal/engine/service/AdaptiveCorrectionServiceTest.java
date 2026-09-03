package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.AdaptiveCorrectionService.Correction;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Worked-example coverage for the weekly adaptive-review correction math (diet-plan slice 5).
 * Sign discipline is the whole point: {@code neededKcal = (targetRate − observedRate) ×
 * kcalPerKg ÷ 7}, signed kg/week rates (cut negative, bulk positive, maintain zero).
 *
 * <p>Pure logic: no Spring context (model: {@code TdeeBootstrapServiceTest}). Only {@code
 * kcalPerKg} and {@code adaptive()} are read by the service; the rest of the properties record
 * mirrors the application.yml defaults for completeness (the yml→record binding itself is
 * covered by {@code GoalEnginePropertiesIT}).
 */
class AdaptiveCorrectionServiceTest {

    private final AdaptiveCorrectionService service = new AdaptiveCorrectionService(props());

    // Mirror application.yml defaults; kcalPerKg 7700 → ×1100 per kg/week of gap.
    private static GoalEngineProperties props() {
        return new GoalEngineProperties(
            new GoalEngineProperties.Neat(1.20, 1.35, 1.50),
            7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6),
            new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            new GoalEngineProperties.Diet(0.275, 0.20, 0.40, 0.22, 0.5),
            0,
            300,
            new GoalEngineProperties.Suggestion(Map.of()),
            new GoalEngineProperties.Adaptive(120, 50, 7, 4, 5.0));
    }

    private static GoalEntity goal(String trajectory, String ratePct) {
        GoalEntity g = new GoalEntity();
        g.setTrajectory(trajectory);
        g.setRateTargetPctPerWeek(new BigDecimal(ratePct));
        return g;
    }

    private static WeightTrendResponse trend(String observedRate, DataSufficiencyEnum sufficiency) {
        return new WeightTrendResponse(
            List.of(), new BigDecimal("80.000"), new BigDecimal(observedRate),
            BigDecimal.ZERO, new BigDecimal(observedRate), sufficiency);
    }

    @Test
    void cutTooSlowDeepensTheDeficitClampedToMaxStep() {
        Optional<Correction> c = service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(-120); // needed −308, clamped
            assertThat(v.targetRateKgPerWk()).isEqualByComparingTo("-0.48");
            assertThat(v.dampedBySleep()).isFalse();
        });
    }

    @Test
    void cutTooFastEasesUp() {
        Optional<Correction> c = service.compute(goal("cut", "0.6"), trend("-0.900", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(120)); // needed +462
    }

    @Test
    void bulkTooSlowAddsKcal() {
        Optional<Correction> c = service.compute(goal("bulk", "0.25"), trend("0.050", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(120)); // needed +165
    }

    @Test
    void deadBandSuppressesSmallGaps() {
        assertThat(service.compute(goal("cut", "0.6"), trend("-0.450", DataSufficiencyEnum.FULL), false))
            .isEmpty(); // needed −33 < dead-band 50
    }

    @Test
    void sleepDebtHalvesDeficitIncreasingCorrectionsOnly() {
        Optional<Correction> deeper = service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.FULL), true);
        assertThat(deeper).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(-60);
            assertThat(v.dampedBySleep()).isTrue();
        });
        Optional<Correction> easier = service.compute(goal("cut", "0.6"), trend("-0.900", DataSufficiencyEnum.FULL), true);
        assertThat(easier).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(120);
            assertThat(v.dampedBySleep()).isFalse();
        });
    }

    @Test
    void bulkTrimIsNeverDampedEvenUnderSleepDebt() {
        // Final-review fix (mezo-r4n7): bulk gaining FASTER than the target 0.20 kg/wk surplus needs
        // a negative delta to TRIM the surplus, not deepen a deficit — sleep-debt damping must never
        // halve it, unlike the cut case above where a negative delta really is deficit-deepening.
        Optional<Correction> c = service.compute(goal("bulk", "0.25"), trend("0.500", DataSufficiencyEnum.FULL), true);
        assertThat(c).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(-120); // needed −330, clamped — NOT halved to −60
            assertThat(v.dampedBySleep()).isFalse();
        });
    }

    @Test
    void insufficientTrendYieldsNothing() {
        assertThat(service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.NONE), false)).isEmpty();
        assertThat(service.compute(goal("cut", "0.6"), null, false)).isEmpty();
    }

    @Test
    void maintainTargetsZeroRate() {
        // maintain drifting up at 0.15 kg/wk → needed = (0 − 0.15)×1100 = −165 → clamp −120.
        Optional<Correction> c = service.compute(goal("maintain", "0.0"), trend("0.150", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(-120));
    }
}
