package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
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

/**
 * Cumulative sleep deficit vs the user's goal over a window of wake-mornings — shared by
 * {@code SleepDebtRule} (which turns it into a verdict) and {@code LoggingGapRule} (which turns
 * it into the spec §4 row 5 "gap + suspicion" variant). Extracted so the goal lookup and the
 * deficit loop exist once.
 *
 * <p>sleep_log.date is the WAKE-UP MORNING, not the evening the night began (confirmed by
 * HabitEvaluator's sleep_wake_window/bedtime_next_day metrics and by SleepLogSheet posting
 * date=today on wake) — so the row dated today IS last night. An unlogged morning is skipped,
 * never counted as a debt-free night.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepDeficitCalculator {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;

    /** The observed deficit over the inclusive window of wake-mornings {@code [from, to]}. */
    public Deficit over(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> sleep =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(properties.sleepDebt().defaultGoalHours());

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
        return new Deficit(goalHours, logged, deficit, byDay);
    }

    /** Goal, how many nights were actually logged, the summed deficit, and the per-day hours. */
    public record Deficit(
        double goalHours, int loggedNights, double deficitHours, Map<String, Double> byDay) {

        /** Mean deficit per LOGGED night — the honest denominator when nights are missing. */
        public double deficitPerLoggedNight() {
            return loggedNights == 0 ? 0 : deficitHours / loggedNights;
        }
    }
}
