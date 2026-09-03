package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.DoublePredicate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecoveryNeededRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final FlagProperties properties;

    /**
     * Poor sleep + high RPE + high stress inside the same short window (spec's "same 48h", read as
     * whole days with today included — the three signals rarely land on one calendar day).
     */
    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.Recovery cfg = properties.recovery();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Map.Entry<LocalDate, Double> poorSleep = newestMatch(
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today),
            v -> v <= cfg.sleepFloorHours());
        Map.Entry<LocalDate, Double> highRpe = newestMatch(
            metricSeriesService.series(userId, MetricKey.TRAINING_RPE, from, today),
            v -> v >= cfg.rpeThreshold());
        Map.Entry<LocalDate, Double> highStress = newestMatch(
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today),
            v -> v >= cfg.stressThreshold());

        if (poorSleep == null || highRpe == null || highStress == null) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.RECOVERY_NEEDED,
            FlagPayloadEnvelope.recoveryNeeded(new FlagPayloadEnvelope.RecoveryNeeded(
                cfg.windowDays(), cfg.sleepFloorHours(), cfg.rpeThreshold(), cfg.stressThreshold(),
                poorSleep.getValue(), poorSleep.getKey().toString(),
                highRpe.getValue(), highRpe.getKey().toString(),
                highStress.getValue(), highStress.getKey().toString()))));
    }

    /** The newest day in the series whose value satisfies {@code test}, or null. */
    private static Map.Entry<LocalDate, Double> newestMatch(
        Map<LocalDate, Double> series, DoublePredicate test) {
        return series.entrySet().stream()
            .filter(e -> e.getValue() != null && test.test(e.getValue()))
            .max(Map.Entry.comparingByKey())
            .orElse(null);
    }
}
