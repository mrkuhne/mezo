package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.FeasibilityPreviewRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewResponse;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Stateless realism core for the goal system (G6 §3.2). Owns the single, shared definition of two pure
 * functions that the rest of the goal engine reuses so the band is defined exactly once:
 *
 * <ul>
 *   <li>{@link #deriveRatePctPerWeek} — the weekly-rate magnitude derivation
 *       ({@code |startW − targetW| / startW * 100 / weeks}). {@link io.mrkuhne.mezo.feature.goal.service.GoalService}
 *       delegates here on upsert, so create/update store exactly what the preview reports.</li>
 *   <li>{@link #verdictForRate} — the cap/band → {@code feasible | feasible-with-warnings | aggressive}
 *       mapping. {@link GoalEvaluationService} reuses it so the eval gate and the preview never diverge.</li>
 * </ul>
 *
 * <p>The {@link #preview} entry point answers the 2-step wizard's "is this realistic before I save?"
 * question: it derives the rate from a draft window, grades it, and — only when the draft is over the
 * cap — suggests the earliest cap-paced target date. No persistence, no ownership, no I/O.
 */
@Service
@RequiredArgsConstructor
public class GoalFeasibilityService {

    private static final String TRAJ_MAINTAIN = "maintain";
    private static final String VERDICT_FEASIBLE = "feasible";
    private static final String VERDICT_WARNINGS = "feasible-with-warnings";
    private static final String VERDICT_AGGRESSIVE = "aggressive";

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    /** Stored precision for the derived rate; matches the G5 rate divides. */
    private static final int RATE_SCALE = 4;
    /** Working precision for the start/target ratio before the weeks divide. */
    private static final int RATIO_SCALE = 10;

    private final GoalEngineProperties props;

    /**
     * Derives the weekly rate magnitude: {@code |startW − targetW| / startW * 100 / weeks}. Returns
     * {@link BigDecimal#ZERO} for maintain (or a missing target weight) and guards weeks &le; 0 (equal
     * start/target date, or an inverted window) against a divide-by-zero. Always non-null. This is the
     * ONE rate formula — {@code GoalService.applyUpsert} delegates here so the persisted rate equals
     * the previewed rate.
     */
    public BigDecimal deriveRatePctPerWeek(
            String trajectory, BigDecimal startWeightKg, BigDecimal targetWeightKg,
            LocalDate startDate, LocalDate targetDate) {
        if (TRAJ_MAINTAIN.equals(trajectory) || targetWeightKg == null
                || startWeightKg == null || startWeightKg.signum() == 0
                || startDate == null || targetDate == null) {
            return BigDecimal.ZERO;
        }
        long weeks = ChronoUnit.WEEKS.between(startDate, targetDate);
        if (weeks <= 0) {
            return BigDecimal.ZERO; // equal dates (or <1 week apart) → no derivable rate.
        }
        return startWeightKg.subtract(targetWeightKg).abs()
            .divide(startWeightKg, RATIO_SCALE, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .divide(BigDecimal.valueOf(weeks), RATE_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * The single band → verdict mapping (G6 §3.2), shared with {@link GoalEvaluationService}:
     * {@code abs ≤ targetPctPerWeek (0.7) → feasible}; {@code ≤ capPctPerWeek (1.0) →
     * feasible-with-warnings}; otherwise {@code aggressive}.
     */
    public String verdictForRate(BigDecimal ratePctPerWeek) {
        BigDecimal rate = ratePctPerWeek == null ? BigDecimal.ZERO : ratePctPerWeek.abs();
        if (rate.compareTo(targetRate()) <= 0) {
            return VERDICT_FEASIBLE;
        }
        if (rate.compareTo(capRate()) <= 0) {
            return VERDICT_WARNINGS;
        }
        return VERDICT_AGGRESSIVE;
    }

    /**
     * Stateless feasibility preview for a draft goal window (G6 §3.2). Derives the rate, grades it, and
     * — only when the draft is over the cap — suggests the earliest cap-paced target date
     * ({@code startDate + ceil(weeksAtCap)}, where {@code weeksAtCap = |startW − targetW| / startW * 100
     * / capPctPerWeek}). Maintain / no target → rate 0, no suggestion.
     */
    public FeasibilityPreviewResponse preview(FeasibilityPreviewRequest req) {
        BigDecimal derivedRate = deriveRatePctPerWeek(
            req.getTrajectory(), req.getStartWeightKg(), req.getTargetWeightKg(),
            req.getStartDate(), req.getTargetDate());

        boolean withinSafeBand = derivedRate.compareTo(capRate()) <= 0;
        // suggestedTargetDate is meaningful ONLY when the draft is over the cap (G6 §3.2).
        LocalDate suggested = withinSafeBand ? null : suggestedTargetDate(req);

        return FeasibilityPreviewResponse.builder()
            .derivedRatePctPerWeek(derivedRate)
            .withinSafeBand(withinSafeBand)
            .verdict(FeasibilityPreviewResponse.VerdictEnum.fromValue(verdictForRate(derivedRate)))
            .suggestedTargetDate(suggested)
            .build();
    }

    /**
     * The earliest cap-paced target date: {@code startDate + ceil(weeksAtCap)} where
     * {@code weeksAtCap = |startW − targetW| / startW * 100 / capPctPerWeek}. Returns {@code null} for
     * maintain / a missing target (no magnitude to pace). Caller only invokes this once it knows the
     * draft is over the cap.
     */
    private LocalDate suggestedTargetDate(FeasibilityPreviewRequest req) {
        if (TRAJ_MAINTAIN.equals(req.getTrajectory()) || req.getTargetWeightKg() == null
                || req.getStartWeightKg() == null || req.getStartWeightKg().signum() == 0
                || req.getStartDate() == null) {
            return null;
        }
        BigDecimal weeksAtCap = req.getStartWeightKg().subtract(req.getTargetWeightKg()).abs()
            .divide(req.getStartWeightKg(), RATIO_SCALE, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .divide(capRate(), RATIO_SCALE, RoundingMode.HALF_UP);
        long wholeWeeks = weeksAtCap.setScale(0, RoundingMode.CEILING).longValueExact();
        return req.getStartDate().plusWeeks(wholeWeeks);
    }

    private BigDecimal targetRate() {
        return new BigDecimal(String.valueOf(props.rate().targetPctPerWeek()));
    }

    private BigDecimal capRate() {
        return new BigDecimal(String.valueOf(props.rate().capPctPerWeek()));
    }
}
