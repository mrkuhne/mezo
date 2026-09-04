package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AcuteBadDayRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.AllHealthyRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.LoggingGapRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MomentumAtRiskRule;
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
    private final SustainedStressRule sustainedStressRule;
    private final SleepDebtRule sleepDebtRule;
    private final MomentumAtRiskRule momentumAtRiskRule;
    private final RecoveryNeededRule recoveryNeededRule;
    private final LoggingGapRule loggingGapRule;
    private final MissedWorkoutsRule missedWorkoutsRule;
    private final AllHealthyRule allHealthyRule;

    /** Every flag that is TRUE for {@code userId} right now, cooldowns NOT yet applied. */
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        acuteBadDayRule.evaluate(userId, today).ifPresent(raises::add);
        sustainedStressRule.evaluate(userId, today).ifPresent(raises::add);
        sleepDebtRule.evaluate(userId, today).ifPresent(raises::add);
        momentumAtRiskRule.evaluate(userId, today).ifPresent(raises::add);
        recoveryNeededRule.evaluate(userId, today).ifPresent(raises::add);
        loggingGapRule.evaluate(userId, today).ifPresent(raises::add);
        missedWorkoutsRule.evaluate(userId, today).ifPresent(raises::add);
        if (raises.isEmpty()) {
            allHealthyRule.evaluate(userId, today).ifPresent(raises::add);
        }
        return raises;
    }
}
