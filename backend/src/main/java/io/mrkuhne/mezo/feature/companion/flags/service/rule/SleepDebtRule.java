package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepDebtRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.SleepDebt cfg = properties.sleepDebt();
        // sleep_log.date is the WAKE-UP MORNING, not the evening the night began (confirmed by
        // HabitEvaluator's sleep_wake_window/bedtime_next_day metrics and by SleepLogSheet posting
        // date=today on wake) — so the row dated today IS last night, and the window ends TODAY.
        // An unlogged today is simply skipped by the null check below, never counted as a
        // debt-free night.
        LocalDate to = today;
        LocalDate from = to.minusDays(cfg.nights() - 1L);
        Map<LocalDate, Double> sleep =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(cfg.defaultGoalHours());

        Map<String, Double> byDay = new LinkedHashMap<>();
        double deficit = 0;
        int logged = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Double hours = sleep.get(day);
            if (hours == null) {
                continue;
            }
            logged++;
            byDay.put(day.toString(), hours);
            deficit += Math.max(0, goalHours - hours); // a long night never repays a short one
        }
        if (logged < cfg.minNights() || deficit < cfg.deficitHours()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.SLEEP_DEBT,
            FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                goalHours, cfg.nights(), logged, cfg.deficitHours(), deficit, byDay))));
    }
}
