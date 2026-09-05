package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AcuteBadDayRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AllHealthyRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.IgnoredNudgeRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.JointOveruseRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LateEatingRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LoadFuelMismatchRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LoggingGapRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MomentumAtRiskRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.RapidWeightLossRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.RecoveryNeededRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.SleepDebtRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.SustainedStressRule;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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
    private final SustainedStressRule sustainedStressRule;
    private final SleepDebtRule sleepDebtRule;
    private final MomentumAtRiskRule momentumAtRiskRule;
    private final RecoveryNeededRule recoveryNeededRule;
    private final LoggingGapRule loggingGapRule;
    private final MissedWorkoutsRule missedWorkoutsRule;
    private final AllHealthyRule allHealthyRule;

    /** Every rule's verdict for {@code userId} right now, cooldowns NOT yet applied — 13 entries,
     *  one per rule, in AdvicePriority order. */
    @Transactional(readOnly = true)
    public List<FlagVerdict> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagVerdict> verdicts = new ArrayList<>();
        verdicts.add(acuteBadDayRule.evaluate(userId, today));
        verdicts.add(loadFuelMismatchRule.evaluate(userId, today));
        verdicts.add(rapidWeightLossRule.evaluate(userId, today));
        verdicts.add(jointOveruseRule.evaluate(userId, today));
        verdicts.add(ignoredNudgeRule.evaluate(userId, today));
        verdicts.add(lateEatingRule.evaluate(userId, today));
        verdicts.add(sustainedStressRule.evaluate(userId, today));
        verdicts.add(sleepDebtRule.evaluate(userId, today));
        verdicts.add(momentumAtRiskRule.evaluate(userId, today));
        verdicts.add(recoveryNeededRule.evaluate(userId, today));
        verdicts.add(loggingGapRule.evaluate(userId, today));
        verdicts.add(missedWorkoutsRule.evaluate(userId, today));

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
