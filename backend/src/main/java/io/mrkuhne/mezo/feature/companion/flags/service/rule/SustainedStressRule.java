package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 7+ stress on minDays of the last windowDays check-in days (spec §9.1 sustained_stress). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SustainedStressRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.SustainedStress cfg = properties.sustainedStress();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, Double> stress =
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today);

        Map<String, Double> byDay = new LinkedHashMap<>();
        int over = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            Double value = stress.get(day);
            if (value == null) {
                continue;
            }
            byDay.put(day.toString(), value);
            if (value >= cfg.threshold()) {
                over++;
            }
        }
        if (over < cfg.minDays()) {
            if (byDay.isEmpty()) {
                return FlagVerdict.unavailable(FlagKey.SUSTAINED_STRESS,
                    UnavailableReason.NO_CHECKIN_DATA);
            }
            return FlagVerdict.clear(FlagKey.SUSTAINED_STRESS, new FlagVerdict.ClearEvidence(
                "stress_days_over", (double) over, (double) cfg.minDays(), null));
        }
        return FlagVerdict.raised(FlagKey.SUSTAINED_STRESS,
            FlagPayloadEnvelope.sustainedStress(new FlagPayloadEnvelope.SustainedStress(
                cfg.threshold(), cfg.windowDays(), cfg.minDays(), over, byDay)));
    }
}
