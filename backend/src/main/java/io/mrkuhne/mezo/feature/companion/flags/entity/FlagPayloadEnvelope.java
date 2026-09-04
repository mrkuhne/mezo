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
    AcuteBadDay acuteBadDay
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

    public static FlagPayloadEnvelope sustainedStress(SustainedStress p) {
        return new FlagPayloadEnvelope(p, null, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope sleepDebt(SleepDebt p) {
        return new FlagPayloadEnvelope(null, p, null, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope momentumAtRisk(MomentumAtRisk p) {
        return new FlagPayloadEnvelope(null, null, p, null, null, null, null, null);
    }

    public static FlagPayloadEnvelope recoveryNeeded(RecoveryNeeded p) {
        return new FlagPayloadEnvelope(null, null, null, p, null, null, null, null);
    }

    public static FlagPayloadEnvelope allHealthy(AllHealthy p) {
        return new FlagPayloadEnvelope(null, null, null, null, p, null, null, null);
    }

    public static FlagPayloadEnvelope loggingGap(LoggingGap p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, p, null, null);
    }

    public static FlagPayloadEnvelope missedWorkouts(MissedWorkouts p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, p, null);
    }

    public static FlagPayloadEnvelope acuteBadDay(AcuteBadDay p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, p);
    }
}
