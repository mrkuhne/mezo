package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class AllHealthyRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final FlagProperties properties;
    private final CompanionFlagLogRepository flagLogRepository;

    /**
     * The quiet state, and only honestly: nothing else fires now, no problem flag was raised inside
     * the quiet window, AND the window actually contains data — "all healthy" over an empty log
     * would be a claim about nothing (IDENT-3).
     */
    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.AllHealthy cfg = properties.allHealthy();
        LocalDate from = today.minusDays(cfg.quietDays() - 1L);
        Instant since = Instant.now().minus(cfg.quietDays(), ChronoUnit.DAYS);

        if (flagLogRepository.existsProblemRaiseSince(userId, since)) {
            return FlagVerdict.clear(FlagKey.ALL_HEALTHY, new FlagVerdict.ClearEvidence(
                "quiet_days", null, (double) cfg.quietDays(), "problem_raise_in_window"));
        }
        Set<LocalDate> observed = new HashSet<>();
        observed.addAll(metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today).keySet());
        observed.addAll(metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today).keySet());
        if (observed.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.ALL_HEALTHY, UnavailableReason.NO_DATA_IN_WINDOW);
        }
        return FlagVerdict.raised(FlagKey.ALL_HEALTHY,
            FlagPayloadEnvelope.allHealthy(new FlagPayloadEnvelope.AllHealthy(
                cfg.quietDays(), observed.size())));
    }
}
