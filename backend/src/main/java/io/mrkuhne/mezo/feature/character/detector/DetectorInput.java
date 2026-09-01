package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
    /** One day's meal aggregate. kcal/macros are sums over the day's meal item snapshots.
     *  {@code nova4KcalShare} is null when {@code novaCoveragePct} is below the detector-side
     *  coverage gate's input threshold — a partly-unclassified day must not fake a share. */
    public record MealDayPoint(LocalDate date,
                               BigDecimal kcal,
                               BigDecimal proteinG,
                               BigDecimal carbsG,
                               BigDecimal fatG,
                               BigDecimal nova4KcalShare,
                               BigDecimal novaCoveragePct,
                               BigDecimal kcalTarget,
                               BigDecimal proteinTarget,
                               List<MealPoint> meals) {}

    /** One logged meal. {@code loggedAtLocalTime} is {@code loggedAt} in the JVM default zone —
     *  the same clock the character jobs take {@code LocalDate.now()} from. */
    public record MealPoint(String slot, LocalTime loggedAtLocalTime, BigDecimal kcal, Integer nova) {}

    /** A day with at least one water log; an absent date means "not logged", never 0 ml. */
    public record WaterDayPoint(LocalDate date, int amountMl, int targetMl) {}

    /** The active supplement protocol plus per-day intake facts; null when no active protocol. */
    public record StackContext(List<StackItem> items, List<StackDayPoint> days) {}
    /** One planned protocol item. {@code restDayFallback} is a zone key or null (null = the item
     *  is deliberately dropped on a rest day rather than displaced). */
    public record StackItem(UUID pantryItemId, String name, String slotKey, String restDayFallback) {}
    public record StackDayPoint(LocalDate date, Set<UUID> takenPantryItemIds) {}

    /** Per-day means of the day's logged check-in slots; a null scale means nobody logged it.
     *  energy/body/mental: higher = better. stress: higher = worse. All 1..10. */
    public record CheckinDayPoint(LocalDate date, int count,
                                  BigDecimal energy, BigDecimal stress,
                                  BigDecimal body, BigDecimal mental) {}

    /** Active medication cycle context; null when the owner has no active medication. */
    public record MedContext(int cycleLengthDays, List<MedCycleDayPoint> days) {}
    /** One day projected onto the medication cycle. {@code stale} marks a day whose last dose is
     *  older than one full cycle — {@code MedicationCycleService} CLAMPS those to the last cycle
     *  day for the Fuel UI, which would pile no-dose weeks into one bucket, so covariance drops
     *  them. {@code daysSinceDose} is null when there is no dose at all. */
    public record MedCycleDayPoint(LocalDate date, int cycleDay, String phaseKey,
                                   Integer daysSinceDose, boolean stale) {}

    /** Raw 8-week series ending at day — detectors aggregate these themselves so they can
     *  recompute their state both as-of day and as-of day-1 (stateless state-change gate).
     *  Round-2 series (mealDays..med) live ONLY here: every round-2 detector windows them to a
     *  trailing 14 days by an {@code asOf} parameter, so a duplicated 14-day copy would be dead
     *  weight (round-2 spec §4). */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks,
                              List<MealDayPoint> mealDays, List<WaterDayPoint> waterDays,
                              StackContext stack, List<CheckinDayPoint> checkinDays,
                              MedContext med) {}
}
