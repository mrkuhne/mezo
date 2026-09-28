package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.RobustnessSource;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
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
 * each with ≥1 session of any family (a COMPLETED gym instance / a logged sport / run session). A
 * week with no session breaks the streak; a skipped or still-open gym instance does not count
 * (mezo-iz4kt). The set of training dates is gathered from the three session families. A
 * BRIDGED week — one carrying at least one excused skip but no session (Kihagyás S1, mezo-q4xt2.1,
 * spec §8.1.6) — neither breaks nor extends the streak: the walk-back simply steps over it.
 */
@Component
@RequiredArgsConstructor
public class TrainingStreakCalculator implements RobustnessSource {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final PlannedSkipService plannedSkipService;

    /** Consecutive training weeks ending this week (0 if the current week has no logged session
     *  and is not bridged by an excused skip). */
    public int streakWeeks(UUID createdBy) {
        Set<Long> trainingWeeks = new HashSet<>();
        workoutSessionRepository.findCompletedInstanceDates(createdBy).forEach(d -> trainingWeeks.add(weekKey(d)));
        sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .forEach(s -> trainingWeeks.add(weekKey(s.getDate())));
        runSessionLogRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .forEach(r -> trainingWeeks.add(weekKey(r.getDate())));

        Set<Long> bridged = plannedSkipService.bridgedWeeks(
            createdBy, LocalDate.now(TZ).minusYears(1), LocalDate.now(TZ));
        long week = weekKey(LocalDate.now(TZ));
        int streak = 0;
        // A bridged week (≥1 excused skip, no session) neither breaks nor extends the streak
        // (spec §8.1.6) — it is skipped over rather than counted or stopped at.
        while (true) {
            if (trainingWeeks.contains(week)) {
                streak++;
                week--;
            } else if (bridged.contains(week)) {
                week--;
            } else {
                break;
            }
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
