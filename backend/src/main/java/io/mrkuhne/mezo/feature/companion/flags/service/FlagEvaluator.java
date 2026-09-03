package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.SustainedStressRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.DoublePredicate;
import java.util.stream.Collectors;
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
 * <p>Missing days stay missing (the MetricSeriesService rule) — the one exception is
 * {@code HABITS_DONE}, where "no habit_day row" genuinely means zero completions.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluator {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final CompanionFlagLogRepository flagLogRepository;
    private final SustainedStressRule sustainedStressRule;

    /** Every flag that is TRUE for {@code userId} right now, cooldowns NOT yet applied. */
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        sustainedStressRule.evaluate(userId, today).ifPresent(raises::add);
        sleepDebt(userId, today).ifPresent(raises::add);
        momentumAtRisk(userId, today).ifPresent(raises::add);
        recoveryNeeded(userId, today).ifPresent(raises::add);
        if (raises.isEmpty()) {
            allHealthy(userId, today).ifPresent(raises::add);
        }
        return raises;
    }

    private Optional<FlagRaise> sleepDebt(UUID userId, LocalDate today) {
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

    /**
     * Habit completions in the recent window vs the baseline window before it, AND at least one
     * PLANNED gym day (a {@code gym_schedule_slot} on that weekday) with no completed workout.
     * Both windows end YESTERDAY: today is still in progress, and counting its unfinished habits
     * as a collapse would flag every morning.
     */
    private Optional<FlagRaise> momentumAtRisk(UUID userId, LocalDate today) {
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

    /**
     * Poor sleep + high RPE + high stress inside the same short window (spec's "same 48h", read as
     * whole days with today included — the three signals rarely land on one calendar day).
     */
    private Optional<FlagRaise> recoveryNeeded(UUID userId, LocalDate today) {
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

    /**
     * The quiet state, and only honestly: nothing else fires now, no problem flag was raised inside
     * the quiet window, AND the window actually contains data — "all healthy" over an empty log
     * would be a claim about nothing (IDENT-3).
     */
    private Optional<FlagRaise> allHealthy(UUID userId, LocalDate today) {
        FlagProperties.AllHealthy cfg = properties.allHealthy();
        LocalDate from = today.minusDays(cfg.quietDays() - 1L);
        Instant since = Instant.now().minus(cfg.quietDays(), ChronoUnit.DAYS);

        if (flagLogRepository.existsProblemRaiseSince(userId, since)) {
            return Optional.empty();
        }
        Set<LocalDate> observed = new HashSet<>();
        observed.addAll(metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today).keySet());
        observed.addAll(metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today).keySet());
        if (observed.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.ALL_HEALTHY,
            FlagPayloadEnvelope.allHealthy(new FlagPayloadEnvelope.AllHealthy(
                cfg.quietDays(), observed.size()))));
    }
}
