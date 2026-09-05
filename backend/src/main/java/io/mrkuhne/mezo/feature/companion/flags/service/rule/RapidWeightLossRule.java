package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Spec 2026-09-03 §4 row 10 (rank 3): {@code WEIGHT_TREND_PCT_WK} below {@code pctPerWeekAtMost}
 * AND the owner is not deliberately cutting.
 *
 * <p><b>The sign trap.</b> {@code WEIGHT_TREND_PCT_WK} is a %/week SLOPE where NEGATIVE means
 * losing weight. {@code pctPerWeekAtMost} is itself negative (config bound {@code [-20.0, -0.1]},
 * house default -0.7): the flag raises only when the trend is MORE negative still, i.e.
 * {@code trend < pctPerWeekAtMost} (a -1.2 fires, a -0.3 does not, a +0.5 certainly does not).
 * Silence, not a raise, is the bail branch: {@code trend >= pctPerWeekAtMost} covers both "losing
 * slower than the bound" and "gaining".
 *
 * <p><b>The honesty gate on weigh-in count is the metric extractor's OWN</b> —
 * {@link MetricSeriesService}'s {@code weightTrendPctWk} yields NO data point for a day whose
 * rolling 7-day window has fewer than 4 weigh-ins (see its javadoc). This rule relies on that
 * {@code null} rather than re-counting or re-gating; {@link #weighInCount} below only freezes the
 * distinct-day count for the card's display, mirroring the extractor's own per-day dedupe.
 *
 * <p><b>"goal ≠ cut".</b> Losing weight fast is only a warning if the user is not deliberately
 * cutting. The goal domain's direction/mode concept is {@link GoalEntity#getTrajectory()} — a
 * DB-CHECKed {@code cut|bulk|maintain} string, read from the owner's single ACTIVE goal (the
 * {@code ContextSnapshotAssembler} precedent:
 * {@code goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")}). A
 * {@code "cut"} trajectory silences the rule outright. <b>No active goal at all</b> means the
 * precondition cannot be read — per spec §7's honesty-gate rule, the house default is silence
 * rather than assuming either direction (an absent goal is neither proven "cut" nor proven
 * "not cut"), so this rule stays silent in that case too, exactly like a cut goal.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RapidWeightLossRule implements FlagRule {

    private static final String TRAJECTORY_CUT = "cut";
    private static final String STATUS_ACTIVE = "active";

    private final MetricSeriesService metricSeriesService;
    private final WeightLogRepository weightLogRepository;
    private final GoalRepository goalRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.RapidWeightLoss cfg = properties.rapidWeightLoss();

        Double trend = metricSeriesService
            .series(userId, MetricKey.WEIGHT_TREND_PCT_WK, today, today)
            .get(today);
        if (trend == null) {
            return FlagVerdict.unavailable(FlagKey.RAPID_WEIGHT_LOSS,
                UnavailableReason.NO_WEIGHT_TREND);
        }
        if (trend >= cfg.pctPerWeekAtMost()) {
            return FlagVerdict.clear(FlagKey.RAPID_WEIGHT_LOSS, new FlagVerdict.ClearEvidence(
                "weight_trend_pct_wk", trend, cfg.pctPerWeekAtMost(), null));
        }

        GoalEntity activeGoal = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .stream().findFirst().orElse(null);
        if (activeGoal == null) {
            // Unreadable precondition ("goal ≠ cut" cannot be evaluated) ⇒ honest silence.
            return FlagVerdict.unavailable(FlagKey.RAPID_WEIGHT_LOSS,
                UnavailableReason.NO_ACTIVE_GOAL);
        }
        String trajectory = activeGoal.getTrajectory();
        if (TRAJECTORY_CUT.equals(trajectory)) {
            return FlagVerdict.clear(FlagKey.RAPID_WEIGHT_LOSS, new FlagVerdict.ClearEvidence(
                "trajectory", null, null, trajectory));
        }

        int weighInCount = countDistinctWeighInDays(userId, today.minusDays(6), today);

        return FlagVerdict.raised(FlagKey.RAPID_WEIGHT_LOSS,
            FlagPayloadEnvelope.rapidWeightLoss(new FlagPayloadEnvelope.RapidWeightLoss(
                trend, cfg.pctPerWeekAtMost(), weighInCount, cfg.minWeighIns(), trajectory)));
    }

    /** Distinct logged days in the same 7-day window the trend regression reads — display only;
     *  the honesty gate lives in the extractor's null, not here. */
    private int countDistinctWeighInDays(UUID userId, LocalDate from, LocalDate to) {
        return (int) weightLogRepository
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, to)
            .stream()
            .map(WeightLogEntity::getDate)
            .distinct()
            .count();
    }
}
