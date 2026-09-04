package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSegmentOverrideJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

/** Applies a suggestion to a supplied goal draft without performing I/O or making decisions. */
@Component
public class GoalSuggestionDraftApplier {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    public void apply(GoalEntity draft, GoalSuggestionEntity suggestion) {
        GoalSuggestionPayloadJson payload = suggestion.getPayload();
        if (GoalSuggestionService.KIND_WEEKLY_CORRECTION.equals(suggestion.getKind())) {
            int current = draft.getBalanceAdjustmentKcal() == null ? 0 : draft.getBalanceAdjustmentKcal();
            if (payload.deltaKcal() != null) {
                draft.setBalanceAdjustmentKcal(current + payload.deltaKcal());
            }
            return;
        }
        if (payload.suggestedTrajectory() != null) {
            draft.setTrajectory(payload.suggestedTrajectory());
            draft.setRateTargetPctPerWeek(deriveRate(draft));
        }
        if (payload.balanceOverrideKcal() != null && payload.fromWeek() != null && payload.toWeek() != null) {
            List<GoalSegmentOverrideJson> overrides = new ArrayList<>(
                draft.getSegmentOverrides() == null ? List.of() : draft.getSegmentOverrides());
            overrides.add(new GoalSegmentOverrideJson(
                payload.fromWeek(), payload.toWeek(), payload.balanceOverrideKcal()));
            draft.setSegmentOverrides(overrides);
        }
    }

    /** Reconstructs the pre-accept draft for historical previews. Suggestions are applied once,
     * so reversing the persisted effect prevents an accepted weekly correction from appearing as
     * a second, fictitious correction. */
    public void revert(GoalEntity draft, GoalSuggestionEntity suggestion) {
        GoalSuggestionPayloadJson payload = suggestion.getPayload();
        if (GoalSuggestionService.KIND_WEEKLY_CORRECTION.equals(suggestion.getKind())) {
            int current = draft.getBalanceAdjustmentKcal() == null ? 0 : draft.getBalanceAdjustmentKcal();
            if (payload.deltaKcal() != null) {
                draft.setBalanceAdjustmentKcal(current - payload.deltaKcal());
            }
            return;
        }
        if (payload.suggestedTrajectory() != null && payload.snapshotTrajectory() != null) {
            draft.setTrajectory(payload.snapshotTrajectory());
            draft.setRateTargetPctPerWeek(deriveRate(draft));
        }
        if (payload.balanceOverrideKcal() != null && payload.fromWeek() != null && payload.toWeek() != null) {
            List<GoalSegmentOverrideJson> overrides = new ArrayList<>(
                draft.getSegmentOverrides() == null ? List.of() : draft.getSegmentOverrides());
            for (int i = overrides.size() - 1; i >= 0; i--) {
                GoalSegmentOverrideJson override = overrides.get(i);
                if (Objects.equals(override.fromWeek(), payload.fromWeek())
                        && Objects.equals(override.toWeek(), payload.toWeek())
                        && Objects.equals(override.balanceKcal(), payload.balanceOverrideKcal())) {
                    overrides.remove(i);
                    break;
                }
            }
            draft.setSegmentOverrides(overrides);
        }
    }

    private static BigDecimal deriveRate(GoalEntity goal) {
        if ("maintain".equals(goal.getTrajectory())) {
            return BigDecimal.ZERO;
        }
        long weeks = ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate());
        if (weeks <= 0 || goal.getTargetWeightKg() == null) {
            return BigDecimal.ZERO;
        }
        return goal.getStartWeightKg().subtract(goal.getTargetWeightKg()).abs()
            .divide(goal.getStartWeightKg(), 10, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .divide(BigDecimal.valueOf(weeks), 4, RoundingMode.HALF_UP);
    }
}
