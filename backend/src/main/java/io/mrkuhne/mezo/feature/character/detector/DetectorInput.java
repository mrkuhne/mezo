package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** A 14-day read-only slice of the user's data ending at {@code day} (the observed day). */
public record DetectorInput(LocalDate day,
                            Set<LocalDate> mealDates,
                            Map<LocalDate, Integer> checkinCounts,
                            List<WeightPoint> weights,
                            Map<LocalDate, List<String>> journalTexts,
                            List<GymDay> gymDays,
                            List<SportPoint> sportSessions,
                            List<RunPoint> runLogs,
                            List<SleepPoint> sleepPoints,
                            MesoContext meso,
                            TrendWindow trend) {
    public record WeightPoint(LocalDate date, BigDecimal kg) {}
    /** One completed gym instance day with per-exercise aggregates (working sets only). */
    public record GymDay(LocalDate date, List<ExerciseWork> exercises) {}
    /** Per-exercise aggregate for one session. Nullable aggregates mean "no data", never zero. */
    public record ExerciseWork(String exerciseName,
                               int workingSets,
                               int skippedSets,
                               List<SetPoint> sets,
                               Integer worstJointPain,
                               Integer pump,
                               Integer workload) {}
    /** One logged working set, ordered by setIndex. Nullable fields were not logged. */
    public record SetPoint(int setIndex, BigDecimal weightKg, Integer reps, Integer rir,
                           BigDecimal targetWeightKg, Integer targetReps, boolean skipped) {}
    public record SportPoint(LocalDate date, String sport, BigDecimal rpe,
                             Integer shoulderStrain, Integer jumpCount, Integer intensity) {}
    public record RunPoint(LocalDate date, Integer rpeActual, Integer hrRecoverySec,
                           Integer completedRounds) {}
    /** date = the night leading into that day (companion "last night" convention). */
    public record SleepPoint(LocalDate date, Integer quality, BigDecimal durationH,
                             Integer awakenings) {}
    /** Active mesocycle context; null when no active meso. plannedDays from gym schedule slots. */
    public record MesoContext(String title, int currentWeek, int totalWeeks, boolean deloadWeek,
                              Set<DayOfWeek> plannedDays, Set<LocalDate> doneDays) {}
    /** Raw 8-week series ending at day — trend detectors aggregate these themselves so they can
     *  recompute the band both as-of day and as-of day-1 (stateless band-change gate). */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks) {}
}
