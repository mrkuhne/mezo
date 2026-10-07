package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AcuteBadDayRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AllHealthyRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.CravingStreakRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.EnergyDipMealTimingRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.IgnoredNudgeRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.JointOveruseRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LateEatingRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LoadFuelMismatchRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LoggingGapRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MealRhythmDriftRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MomentumAtRiskRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MotivationSlumpRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.PersistentPainRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.PoorRestednessRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.ProtocolLapseRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.RapidWeightLossRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.RecoveryNeededRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.SleepDebtRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.SustainedStressRule;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W5.1 composite-flag rule set (bd mezo-b3pp.18, spec §9.1) — deterministic and
 * <b>LLM-free</b>: pure arithmetic over series that {@link MetricSeriesService} already composes
 * READ-ONLY from the owning features. Every threshold comes from {@link FlagProperties}; this
 * class holds no numbers of its own. It never writes: {@code FlagService} owns the cooldown gate
 * and the audit row.
 *
 * <p>Missing days stay missing (the MetricSeriesService rule) — the exceptions are
 * {@code HABITS_DONE}, where "no habit_day row" genuinely means zero completions, and
 * {@code COMBINED_LOAD_MIN}, where a day with no training genuinely means zero load.
 *
 * <p>Each rule lives in its own class under {@code service/rule/}; this class is just the
 * orchestrator that calls them in a fixed order.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluator {

    private final AcuteBadDayRule acuteBadDayRule;
    private final LoadFuelMismatchRule loadFuelMismatchRule;
    private final RapidWeightLossRule rapidWeightLossRule;
    private final JointOveruseRule jointOveruseRule;
    private final IgnoredNudgeRule ignoredNudgeRule;
    private final LateEatingRule lateEatingRule;
    private final ProtocolLapseRule protocolLapseRule;
    private final MealRhythmDriftRule mealRhythmDriftRule;
    private final EnergyDipMealTimingRule energyDipMealTimingRule;
    private final SustainedStressRule sustainedStressRule;
    private final SleepDebtRule sleepDebtRule;
    private final MomentumAtRiskRule momentumAtRiskRule;
    private final RecoveryNeededRule recoveryNeededRule;
    private final LoggingGapRule loggingGapRule;
    private final MissedWorkoutsRule missedWorkoutsRule;
    private final AllHealthyRule allHealthyRule;
    /** Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2). */
    private final PersistentPainRule persistentPainRule;
    private final PoorRestednessRule poorRestednessRule;
    private final CravingStreakRule cravingStreakRule;
    private final MotivationSlumpRule motivationSlumpRule;
    /** Kihagyás S2/S3 (mezo-q4xt2.2/.3): the read-only gate for the seven rules below — four
     *  training-pressure rules and three fuel-judgement rules; train, never the reverse. */
    private final RecoveryPeriodService recoveryPeriodService;

    /** Every rule's verdict for {@code userId} right now, cooldowns NOT yet applied — 20 entries,
     *  one per rule, in AdvicePriority order. */
    @Transactional(readOnly = true)
    public List<FlagVerdict> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagVerdict> verdicts = new ArrayList<>();
        // Kihagyás S2/S3 (mezo-q4xt2.2/.3): while a recovery period ("kímélő mód") is open, the
        // seven rules (four training-pressure, three fuel-judgement) go quiet instead of running —
        // a genuinely excused gap or a sick-day plate (illness, injury, a stomach bug, travel)
        // must never be read back to the user as a nag.
        Optional<RecoveryPeriodEntity> openRecovery = recoveryPeriodService.open(userId);
        verdicts.add(acuteBadDayRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.LOAD_FUEL_MISMATCH, UnavailableReason.RECOVERY_MODE)
                : loadFuelMismatchRule.evaluate(userId, today));
        verdicts.add(rapidWeightLossRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.JOINT_OVERUSE, UnavailableReason.RECOVERY_MODE)
                : jointOveruseRule.evaluate(userId, today));
        verdicts.add(persistentPainRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.MISSED_WORKOUTS, UnavailableReason.RECOVERY_MODE)
                : missedWorkoutsRule.evaluate(userId, today));
        verdicts.add(sleepDebtRule.evaluate(userId, today));
        verdicts.add(poorRestednessRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.LOGGING_GAP, UnavailableReason.RECOVERY_MODE)
                : loggingGapRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.IGNORED_NUDGE, UnavailableReason.RECOVERY_MODE)
                : ignoredNudgeRule.evaluate(userId, today));
        verdicts.add(lateEatingRule.evaluate(userId, today));
        verdicts.add(protocolLapseRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT, UnavailableReason.RECOVERY_MODE)
                : mealRhythmDriftRule.evaluate(userId, today));
        verdicts.add(energyDipMealTimingRule.evaluate(userId, today));
        verdicts.add(cravingStreakRule.evaluate(userId, today));
        verdicts.add(recoveryNeededRule.evaluate(userId, today));
        verdicts.add(sustainedStressRule.evaluate(userId, today));
        verdicts.add(motivationSlumpRule.evaluate(userId, today));
        verdicts.add(openRecovery.isPresent()
                ? FlagVerdict.unavailable(FlagKey.MOMENTUM_AT_RISK, UnavailableReason.RECOVERY_MODE)
                : momentumAtRiskRule.evaluate(userId, today));

        boolean anyRaised = verdicts.stream().anyMatch(v -> v.outcome() == FlagOutcome.RAISED);
        FlagVerdict healthy = allHealthyRule.evaluate(userId, today);
        if (anyRaised && healthy.outcome() == FlagOutcome.RAISED) {
            // The quiet state is not true while something else is firing. Same behaviour as the
            // old `if (raises.isEmpty())` gate, but it now leaves a trace instead of a hole.
            healthy = FlagVerdict.clear(FlagKey.ALL_HEALTHY, new FlagVerdict.ClearEvidence(
                "other_flags_raised", null, null, "another_rule_fired"));
        }
        verdicts.add(healthy);
        return verdicts;
    }
}
