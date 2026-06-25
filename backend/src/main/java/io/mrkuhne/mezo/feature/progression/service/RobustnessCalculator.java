package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Streak-only robustness (v1): consecutive ISO weeks (Europe/Budapest) ending at the current week,
 * each with ≥1 logged session of any family (gym instance / sport / run). A week with no session
 * breaks the streak. The set of training dates is gathered from the three session families.
 */
@Component
@RequiredArgsConstructor
public class RobustnessCalculator {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;

    /** Consecutive training weeks ending this week (0 if the current week has no logged session). */
    public int streakWeeks(UUID createdBy) {
        Set<Long> trainingWeeks = new HashSet<>();
        workoutSessionRepository.findInstanceDates(createdBy).forEach(d -> trainingWeeks.add(weekKey(d)));
        sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .forEach(s -> trainingWeeks.add(weekKey(s.getDate())));
        runSessionLogRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .forEach(r -> trainingWeeks.add(weekKey(r.getDate())));

        long current = weekKey(LocalDate.now(TZ));
        int streak = 0;
        while (trainingWeeks.contains(current - streak)) {
            streak++;
        }
        return streak;
    }

    /**
     * Monotonic week id = isoYear*100 + isoWeek, so consecutive weeks differ by 1 within a year.
     * Known v1 limitation: the {@code current - streak} step only walks back correctly inside one
     * ISO year (year-boundary streaks may under-count); acceptable for v1's short streaks.
     */
    private long weekKey(LocalDate date) {
        return date.get(IsoFields.WEEK_BASED_YEAR) * 100L + date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }
}
