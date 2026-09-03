package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The weekly adaptive-review correction math (diet-plan slice 5). Pure + deterministic:
 * {@code neededKcal = (targetRate − observedRate) × kcalPerKg ÷ 7} with signed kg/week rates
 * (cut negative, bulk positive, maintain 0), a dead-band (small gaps are on-track, not noise to
 * chase) and a ±maxStep clamp (small smoothed steps — the RP unsmoothed-jump anti-pattern is what
 * the clamp exists to avoid). The sleep guard halves a deficit-DEEPENING (negative, non-bulk)
 * correction; corrections that ADD food are never damped, and neither is a bulk correction that
 * trims a surplus even though it is also negative (see the bulk-aware note below).
 *
 * <p>Gates: no trend, sufficiency {@code none}, or a null observed rate → empty. The observed
 * spine is {@code last4wRateKgPerWeek} — the same reconciliation source the projection uses.
 *
 * <p><b>Sleep-debt damping is bulk-aware (final-review fix, mezo-r4n7):</b> a negative delta does
 * NOT always mean "deepen a deficit" — on a {@code bulk} goal it means the opposite: the owner is
 * gaining faster than the target surplus, and the correction TRIMS that surplus, it does not add
 * one. Damping exists to protect sleep-debt recovery from a deeper deficit, so it must never fire
 * on a bulk trim; the predicate is {@code delta < 0 && !"bulk".equals(trajectory)} — cut and
 * maintain both keep the original halving (a negative delta on either really is deficit-deepening).
 */
@Service
@RequiredArgsConstructor
public class AdaptiveCorrectionService {

    private static final String TRAJ_BULK = "bulk";
    private static final String TRAJ_MAINTAIN = "maintain";
    private static final int DAYS_PER_WEEK = 7;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final GoalEngineProperties props;

    /** The proposed weekly correction; {@code deltaKcal} is the signed kcal/day suggestion. */
    public record Correction(
        int deltaKcal,
        BigDecimal observedRateKgPerWk,
        BigDecimal targetRateKgPerWk,
        boolean dampedBySleep,
        String rationaleHu) {
    }

    /**
     * Compute the correction, or empty when the trend is not trustworthy yet ({@code none}), the
     * gap sits inside the dead-band, or the (possibly damped) step rounds to 0.
     */
    public Optional<Correction> compute(GoalEntity goal, WeightTrendResponse trend, boolean sleepDebted) {
        if (trend == null || trend.getDataSufficiency() == null
            || trend.getDataSufficiency() == DataSufficiencyEnum.NONE
            || trend.getLast4wRateKgPerWeek() == null
            || trend.getLatestTrendKg() == null || trend.getLatestTrendKg().signum() <= 0) {
            return Optional.empty();
        }

        BigDecimal observed = trend.getLast4wRateKgPerWeek();
        BigDecimal target = targetRateKgPerWk(goal, trend.getLatestTrendKg());

        BigDecimal neededKcal = target.subtract(observed)
            .multiply(BigDecimal.valueOf(props.kcalPerKg()))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), 2, RoundingMode.HALF_UP);

        if (neededKcal.abs().compareTo(BigDecimal.valueOf(props.adaptive().deadBandKcal())) < 0) {
            return Optional.empty(); // on track — silence, not micro-nudges
        }

        int maxStep = props.adaptive().maxStepKcal();
        int delta = neededKcal
            .max(BigDecimal.valueOf(-maxStep))
            .min(BigDecimal.valueOf(maxStep))
            .setScale(0, RoundingMode.HALF_UP)
            .intValueExact();

        // Bulk-aware (final-review fix): a negative delta on a bulk goal TRIMS the surplus, it does
        // not deepen a deficit — damping must never fire there. See class javadoc.
        boolean damped = sleepDebted && delta < 0 && !TRAJ_BULK.equalsIgnoreCase(goal.getTrajectory());
        if (damped) {
            delta = delta / 2; // deficit-increasing under sleep debt → half step (recovery guard)
        }
        if (delta == 0) {
            return Optional.empty();
        }
        return Optional.of(new Correction(delta, observed, target, damped, rationale(delta, observed, target, damped)));
    }

    /** Signed target rate (kg/week): cut negative, bulk positive, maintain 0. */
    private BigDecimal targetRateKgPerWk(GoalEntity goal, BigDecimal weightKg) {
        if (TRAJ_MAINTAIN.equalsIgnoreCase(goal.getTrajectory())) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP); // scale-consistent with the non-maintain branch below (rationale() prints "0.00", not "0")
        }
        BigDecimal magnitude = goal.getRateTargetPctPerWeek() == null
            ? BigDecimal.ZERO
            : goal.getRateTargetPctPerWeek().divide(ONE_HUNDRED, 10, RoundingMode.HALF_UP).multiply(weightKg);
        BigDecimal scaled = magnitude.setScale(2, RoundingMode.HALF_UP);
        return TRAJ_BULK.equalsIgnoreCase(goal.getTrajectory()) ? scaled : scaled.negate();
    }

    private static String rationale(int delta, BigDecimal observed, BigDecimal target, boolean damped) {
        String direction = delta < 0 ? "csökkentés" : "növelés";
        String base = String.format(
            "A mért trend %s kg/hét, a cél %s kg/hét — a heti felülvizsgálat %+d kcal/nap %st javasol.",
            observed.setScale(2, RoundingMode.HALF_UP).toPlainString(),
            target.toPlainString(), delta, direction);
        return damped
            ? base + " Az alváshiány miatt a deficit-mélyítés a felére tompítva."
            : base;
    }
}
