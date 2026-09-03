package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MomentumAtRiskRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final FlagProperties properties;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;

    /**
     * Habit completions in the recent window vs the baseline window before it, AND at least one
     * PLANNED gym day (a {@code gym_schedule_slot} on that weekday) with no completed workout.
     * Both windows end YESTERDAY: today is still in progress, and counting its unfinished habits
     * as a collapse would flag every morning.
     */
    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.Momentum cfg = properties.momentum();
        LocalDate recentTo = today.minusDays(1);
        LocalDate recentFrom = recentTo.minusDays(cfg.windowDays() - 1L);
        LocalDate baselineTo = recentFrom.minusDays(1);
        LocalDate baselineFrom = baselineTo.minusDays(cfg.baselineDays() - 1L);

        // A day with no habit_day row means zero completions — here absence IS information.
        double recentAvg = dailyAverage(
            metricSeriesService.series(userId, MetricKey.HABITS_DONE, recentFrom, recentTo),
            recentFrom, recentTo);
        double baselineAvg = dailyAverage(
            metricSeriesService.series(userId, MetricKey.HABITS_DONE, baselineFrom, baselineTo),
            baselineFrom, baselineTo);

        if (baselineAvg < cfg.minBaseline() || recentAvg > baselineAvg * (1 - cfg.dropRatio())) {
            return Optional.empty();
        }

        List<String> missedGymDays = missedPlannedGymDays(userId, recentFrom, recentTo);
        if (missedGymDays.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.MOMENTUM_AT_RISK,
            FlagPayloadEnvelope.momentumAtRisk(new FlagPayloadEnvelope.MomentumAtRisk(
                cfg.windowDays(), cfg.baselineDays(), recentAvg, baselineAvg,
                cfg.dropRatio(), cfg.minBaseline(), missedGymDays))));
    }

    /** Mean over EVERY calendar day in the window, absent days counted as 0. */
    private static double dailyAverage(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        double sum = 0;
        int days = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            sum += series.getOrDefault(day, 0.0);
            days++;
        }
        return days == 0 ? 0 : sum / days;
    }

    /** Planned gym weekdays inside the window with no completed workout instance that day. */
    private List<String> missedPlannedGymDays(UUID userId, LocalDate from, LocalDate to) {
        Set<Integer> plannedDows = gymScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(GymScheduleSlotEntity::getDayOfWeek)
            .collect(Collectors.toSet());
        if (plannedDows.isEmpty()) {
            return List.of();
        }
        Set<LocalDate> trained = Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, to));
        List<String> missed = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment)
            int dow = day.getDayOfWeek().getValue() - 1;
            if (plannedDows.contains(dow) && !trained.contains(day)) {
                missed.add(day.toString());
            }
        }
        return missed;
    }
}
