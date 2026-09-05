package io.mrkuhne.mezo.feature.companion.flags.entity;

import java.util.List;
import java.util.Map;

/**
 * Typed jsonb envelope for {@code companion_flag_log.payload} (Phase 5 W5.1, bd mezo-b3pp.18,
 * spec §4.5) — the {@code FeedbackRollupStatsEnvelope} precedent: one record, all-nullable
 * fields, a static factory per shape. Exactly one nested record is non-null per row: the rule
 * that raised, with BOTH its thresholds and the observed values, so the raise is reproducible
 * from the log alone. Day keys are ISO-8601 strings ({@code LocalDate.toString()}) — jsonb object
 * keys are text.
 */
public record FlagPayloadEnvelope(
    SustainedStress sustainedStress,
    SleepDebt sleepDebt,
    MomentumAtRisk momentumAtRisk,
    RecoveryNeeded recoveryNeeded,
    AllHealthy allHealthy,
    LoggingGap loggingGap,
    MissedWorkouts missedWorkouts,
    AcuteBadDay acuteBadDay,
    LoadFuelMismatch loadFuelMismatch,
    RapidWeightLoss rapidWeightLoss,
    JointOveruse jointOveruse,
    IgnoredNudge ignoredNudge,
    LateEating lateEating,
    ProtocolLapse protocolLapse
) {

    public record SustainedStress(
        double threshold, int windowDays, int minDays, int daysOverThreshold,
        Map<String, Double> stressByDay) {
    }

    public record SleepDebt(
        double goalHours, int nights, int loggedNights, double deficitThresholdHours,
        double deficitHours, Map<String, Double> sleepHoursByDay) {
    }

    public record MomentumAtRisk(
        int windowDays, int baselineDays, double recentDoneAvg, double baselineDoneAvg,
        double dropRatio, double minBaseline, List<String> missedGymDays) {
    }

    public record RecoveryNeeded(
        int windowDays, double sleepFloorHours, double rpeThreshold, double stressThreshold,
        Double sleepHours, String sleepDay, Double rpe, String rpeDay, Double stress, String stressDay) {
    }

    public record AllHealthy(int quietDays, int observedDays) {
    }

    public record LoggingGap(
        List<String> staleDomains, Integer mealStaleHours, Integer mealHoursSince,
        Integer checkinStaleHours, Integer checkinHoursSince,
        Integer sleepStaleMornings, Integer sleepMorningsSince,
        Double sleepSuspicionDeficitHours, Double observedDeficitPerLoggedNight,
        Integer loggedNights) {
    }

    public record MissedWorkouts(
        int windowDays, int minConsecutiveMissed, int longestMissedRun,
        List<String> missedDays, List<String> plannedDays) {
    }

    /** Spec 2026-09-03 §4 row 6 (rank 1). One entry per qualifying check-in, so the card can name
     *  the day's pattern rather than reciting a count. */
    public record AcuteBadDay(
        int minCheckIns, int bodyOrEnergyAtMost, int qualifyingCount,
        List<QualifyingCheckIn> qualifyingCheckIns) {
    }

    public record QualifyingCheckIn(String slotTime, Integer body, Integer energy) {
    }

    /** Spec 2026-09-03 §4 row 2 (rank 2): 7-day training load vs. fuel/sleep conjunction.
     *  {@code kcalAvg}/{@code kcalTargetAvg}/{@code kcalFraction} and {@code sleepAvg} are null
     *  when their side's honesty gate ({@code kcalLoggedDays}/{@code sleepLoggedDays} vs
     *  {@code minLoggedDaysPerSide}) is not met — the count comes from the SPARSE kcal/sleep
     *  series, never from {@code COMBINED_LOAD_MIN} (calendar-complete, so an unlogged day there
     *  is a real 0.0, not an absence). {@code firedArm} is {@code "kcal"}, {@code "sleep"} or
     *  {@code "both"}. {@code weightTrendPctWk} is a CORROBORATING FACT only — it never affects
     *  whether the rule fires, and is null whenever the 7-day regression has too few weigh-ins. */
    public record LoadFuelMismatch(
        int windowDays, double loadAvg, double loadThreshold,
        Double kcalAvg, Double kcalTargetAvg, Double kcalFraction, double kcalFractionThreshold,
        int kcalLoggedDays,
        Double sleepAvg, double sleepFloorHours, int sleepLoggedDays,
        int minLoggedDaysPerSide,
        String firedArm,
        Double weightTrendPctWk) {
    }

    /** Spec 2026-09-03 §4 row 10 (rank 3): 7-day {@code WEIGHT_TREND_PCT_WK} slope below
     *  {@code pctPerWeekAtMost} (negative — %/week, so "below" means more negative, faster
     *  loss) AND the owner is not deliberately cutting. {@code weighInCount} is the distinct
     *  logged days inside the trend's own 7-day window, frozen for display only — the honesty
     *  gate itself is the metric extractor's own (no data point under 4 weigh-ins), not this
     *  count. {@code goalTrajectory} is the active goal's {@code cut|bulk|maintain} as read;
     *  this shape only ever exists when it was NOT {@code "cut"} (a cut goal stays silent, so
     *  no raise ever carries it) — {@code null} here would mean "no active goal", which also
     *  never reaches a raise (see the rule's honesty gate). */
    public record RapidWeightLoss(
        double weightTrendPctWk, double pctPerWeekAtMost,
        int weighInCount, int minWeighIns,
        String goalTrajectory) {
    }

    /** Spec 2026-09-03 §4 row 16 (rank 4, offers {@code lighten_tomorrow} — wired by a later
     *  task): sport {@code SHOULDER_STRAIN} {@code windowDays}-average at or above
     *  {@code strainAvgAtLeast}, AND tomorrow's planned gym session is shoulder-focused.
     *  {@code dataPoints} is the count of days the average was actually taken over (a session
     *  with a null strain is not a data point). {@code tomorrowMuscle} is tomorrow's session
     *  muscle AFTER {@code MuscleGroup.of} normalisation, e.g. {@code "shoulder-lateral"}
     *  collapses to {@code "shoulder"} — this shape only ever exists once that already equals
     *  the configured {@code muscleNeedle}. */
    public record JointOveruse(
        double strainAvg, double strainAvgAtLeast, int dataPoints, int windowDays,
        String tomorrowDate, String tomorrowMuscle) {
    }

    /** Spec 2026-09-03 §4 row 7/8 (rank 8, offers {@code shift_sleep_anchor} — wired by a later
     *  task): the {@code category} push sent on {@code runLength} consecutive evenings (always
     *  equal to {@code minConsecutiveDays} — a raise only ever exists for the exact required
     *  run) while the observed bedtime NEVER complied. {@code anchorBedTimeHour} and every value
     *  in {@code bedtimeHourByNight} are in {@code MetricKey.BEDTIME_HOUR}'s own SHIFTED-clock
     *  space (hours below 12 read +24, so a post-midnight bedtime sorts after every pre-midnight
     *  one) — the same space the rule compares in, so the raise is reproducible from these
     *  numbers alone without re-deriving the shift. {@code bedtimeHourByNight} is keyed by the
     *  EVENING the nudge was sent ({@code push_log.log_date}), not the wake-morning
     *  {@code sleep_log.date} the value was actually read from (sleep_log.date = that key + 1
     *  day) — the user-facing "night" is the evening, not the following morning. */
    public record IgnoredNudge(
        String category, int runLength, int minConsecutiveDays,
        double anchorBedTimeHour, int nonComplianceMinutes,
        Map<String, Double> bedtimeHourByNight) {
    }

    /** Spec 2026-09-03 §4 row 8 (rank 9): the last meal within {@code minutesBeforeBed} of the
     *  bedtime anchor, OR at/after {@code absoluteHour}, on at least {@code minDaysOfLastThree}
     *  of the last {@code windowDays} days. {@code anchorBedTimeHour} is null whenever no
     *  {@code sleep_goal} row exists — the bed arm never fires in that case, only the absolute
     *  arm does (see the rule's own javadoc for the honesty split). Both it and every value in
     *  {@code lastMealHourByDay} are in {@code MetricKey.BEDTIME_HOUR}'s own SHIFTED-clock space
     *  (hours below 12 read +24), the same space the rule compares in, so a post-midnight meal is
     *  frozen as the very-late hour it actually is rather than an early-morning one.
     *  {@code qualifyingArmByDay} names which arm ({@code "bed"}, {@code "absolute"} or
     *  {@code "both"}) made each day in {@code lastMealHourByDay} qualify; a day present in
     *  neither map simply had no logged meal, or a meal that qualified under neither arm. */
    public record LateEating(
        int minutesBeforeBed, double absoluteHour, int minDaysOfLastThree, int windowDays,
        Double anchorBedTimeHour, int qualifyingDays,
        Map<String, Double> lastMealHourByDay, Map<String, String> qualifyingArmByDay) {
    }

    /** Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)). {@code pantryItemId} is the offending
     *  item's id as a STRING (jsonb keys and values are text, and the per-item cooldown compares
     *  it as text); {@code itemName} is frozen at raise time so {@code AdviceFactRenderer} — a
     *  pure static renderer with no repositories — can name the supplement. Dates are ISO-8601
     *  strings. {@code lastTakenDate} is null when the item was never taken inside the history
     *  window (which the prior-habit gate makes impossible in practice, but the payload does not
     *  assume the gate). */
    public record ProtocolLapse(
        String pantryItemId, String itemName, String slotKey,
        int consecutiveMissedDueDays, int threshold,
        List<String> missedDueDates, String lastTakenDate,
        int historyDueDays, int historyTakenDays,
        double historyAdherence, double minHistoryAdherence) {
    }

    public static FlagPayloadEnvelope sustainedStress(SustainedStress p) {
        return new FlagPayloadEnvelope(p, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope sleepDebt(SleepDebt p) {
        return new FlagPayloadEnvelope(null, p, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope momentumAtRisk(MomentumAtRisk p) {
        return new FlagPayloadEnvelope(null, null, p, null, null, null, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope recoveryNeeded(RecoveryNeeded p) {
        return new FlagPayloadEnvelope(null, null, null, p, null, null, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope allHealthy(AllHealthy p) {
        return new FlagPayloadEnvelope(null, null, null, null, p, null, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope loggingGap(LoggingGap p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, p, null, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope missedWorkouts(MissedWorkouts p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, p, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope acuteBadDay(AcuteBadDay p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, p, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope loadFuelMismatch(LoadFuelMismatch p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, p, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope rapidWeightLoss(RapidWeightLoss p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, p, null, null, null, null);
    }

    public static FlagPayloadEnvelope jointOveruse(JointOveruse p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null, p, null, null, null);
    }

    public static FlagPayloadEnvelope ignoredNudge(IgnoredNudge p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null, null, p, null, null);
    }

    public static FlagPayloadEnvelope lateEating(LateEating p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null, null, null, p, null);
    }

    public static FlagPayloadEnvelope protocolLapse(ProtocolLapse p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null, null, null, null, p);
    }
}
