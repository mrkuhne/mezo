package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Spec 2026-09-03 §4 row 10 (rank 3): 7-day {@code WEIGHT_TREND_PCT_WK} below the configured
 * {@code pctPerWeekAtMost} (-0.7, negative — %/week) AND the owner's active goal is NOT a
 * deliberate cut. The ≥4-weigh-in honesty gate belongs to the metric extractor itself
 * ({@code MetricSeriesService.weightTrendPctWk}, which yields no data point under 4 points in the
 * rolling 7-day window); this rule relies on that null rather than re-counting.
 */
class FlagEvaluatorRapidWeightLossIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return raisedKeys(evaluator.evaluate(owner));
    }

    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    /** One weigh-in per day for {@code weights.length} consecutive days ending {@code today}. */
    private void weighIns(UUID owner, LocalDate today, double... weights) {
        int n = weights.length;
        for (int i = 0; i < n; i++) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(n - 1 - i),
                BigDecimal.valueOf(weights[i]));
        }
    }

    @Test
    void raises_when_the_trend_is_well_below_the_threshold_and_the_goal_is_not_a_cut() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        // Linear -0.15 kg/day over 7 days ⇒ trend ≈ -1.32%/wk, well below -0.7.
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        assertThat(keys(owner)).contains(FlagKey.RAPID_WEIGHT_LOSS);
    }

    @Test
    void stays_silent_when_the_trend_is_a_mild_loss_above_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        // Linear -0.04 kg/day over 7 days ⇒ trend ≈ -0.35%/wk, above (less negative than) -0.7.
        weighIns(owner, today, 80.00, 79.96, 79.92, 79.88, 79.84, 79.80, 79.76);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
    }

    @Test
    void stays_silent_when_the_trend_is_rapid_loss_but_the_active_goal_is_a_cut() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "cut", "active");
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
    }

    @Test
    void stays_silent_when_the_trend_is_positive_even_with_a_bulk_goal() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        // Linear +0.15 kg/day: a healthy GAIN must never fire this rule (the sign trap).
        weighIns(owner, today, 79.10, 79.25, 79.40, 79.55, 79.70, 79.85, 80.00);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
    }

    @Test
    void stays_silent_when_fewer_than_four_weighins_back_the_window_despite_rapid_loss_looking_values() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        // Only 3 weigh-ins in the 7-day window ⇒ the extractor's own gate yields no data point.
        weighIns(owner, today, 80.00, 79.55, 79.10);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
    }

    @Test
    void stays_silent_when_the_owner_has_no_active_goal_at_all() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // No goal created — "goal ≠ cut" is unreadable, so the honest default is silence.
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
    }

    // ── boundary pair: value < pctPerWeekAtMost, both sides negative ────────────────────────
    // 6×(-0.079 kg/day) lands the trend just ABOVE -0.7 (a milder loss ⇒ silent); 6×(-0.08 kg/day)
    // lands it just BELOW -0.7 (a faster loss ⇒ raises). Only the last two points differ.

    @Test
    void stays_silent_when_the_trend_sits_just_above_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        weighIns(owner, today, 80.00, 79.92, 79.84, 79.76, 79.68, 79.61, 79.53);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);

        assertThat(keys(owner)).doesNotContain(FlagKey.RAPID_WEIGHT_LOSS);
        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("weight_trend_pct_wk");
        assertThat(verdict.clear().observed()).isGreaterThanOrEqualTo(verdict.clear().threshold());
    }

    @Test
    void raises_when_the_trend_sits_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        weighIns(owner, today, 80.00, 79.92, 79.84, 79.76, 79.68, 79.60, 79.52);

        assertThat(keys(owner)).contains(FlagKey.RAPID_WEIGHT_LOSS);
        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);
        assertThat(verdict.payload().rapidWeightLoss().weightTrendPctWk()).isLessThan(-0.7);
    }

    @Test
    void the_payload_freezes_the_trend_threshold_weighin_count_and_goal_trajectory() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "maintain", "active");
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);

        var p = verdict.payload().rapidWeightLoss();
        assertThat(p.pctPerWeekAtMost()).isEqualTo(-0.7);
        assertThat(p.weightTrendPctWk()).isLessThan(-0.7);
        assertThat(p.weighInCount()).isEqualTo(7);
        assertThat(p.minWeighIns()).isEqualTo(4);
        assertThat(p.goalTrajectory()).isEqualTo("maintain");
    }

    @Test
    void is_unavailable_when_fewer_than_four_weighins_back_the_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "bulk", "active");
        weighIns(owner, today, 80.00, 79.55, 79.10);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_WEIGHT_TREND);
    }

    @Test
    void is_unavailable_when_the_owner_has_no_active_goal_at_all() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_ACTIVE_GOAL);
    }

    @Test
    void is_clear_when_the_active_goal_is_a_cut() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        goalPopulator.createGoal(owner, "cut", "active");
        weighIns(owner, today, 80.00, 79.85, 79.70, 79.55, 79.40, 79.25, 79.10);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.RAPID_WEIGHT_LOSS);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("trajectory");
        assertThat(verdict.clear().detail()).isEqualTo("cut");
    }
}
