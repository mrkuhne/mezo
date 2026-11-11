package io.mrkuhne.mezo.feature.boop.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Everything Boop knows about one local day (Boop S3, mezo-r36n9.7) — the raw, unscored input of
 * the morning brief, assembled read-only by {@link BoopDayAssembler}. Nullable fields mean "no
 * data", never a fake zero: no night → {@code sleep} null, no wearable day → {@code steps} null.
 *
 * <p>Series are oldest-first and end on {@link #date}; baselines average the 14 days BEFORE it
 * (today is compared against them, not part of them).
 */
public record BoopDay(
        LocalDate date,
        /** The night that ended on {@code date} (its wake day), or null. */
        Sleep sleep,
        /** Nightly sleep target in minutes (goal row or config ghost). */
        int sleepTargetMin,
        /** Target bedtime from the sleep goal (config ghost when unset) — never null. */
        LocalTime bedtimeTarget,
        /** Nights logged in the 60 days ending on {@code date}. */
        int nightsKnown,
        /** Deep-sleep minutes per wake day, {@code date-6 … date}; null where missing. Size 7. */
        List<Integer> deepSleepWeek,
        /** Resting HR per day, {@code date-6 … date}; null where missing. Size 7. */
        List<Integer> restingHrWeek,
        /** Mean resting HR over {@code date-14 … date-1}; null without data. */
        Double baselineRestingHr,
        /** Mean deep-sleep minutes over the nights {@code date-14 … date-1}; null without data. */
        Double baselineDeepMin,
        /** Today's resting HR, or null. */
        Integer restingHr,
        /** Today's min/avg/max HR, or null without a wearable day. */
        HrToday hrToday,
        Integer steps,
        Integer activeKcal,
        /** Today's planned gym session (not skipped, not a rest day), or null. */
        Session session,
        /** Yesterday's load, each session once: logged gym/sport sessions plus unmatched live Health workouts (zeros when none). */
        WorkoutLoad yesterdayLoad,
        List<Meal> meals,
        int kcalSoFar,
        int kcalTarget,
        int proteinG,
        int proteinTarget,
        int carbsG,
        int fatG,
        List<Checkin> checkins,
        Intention intention,
        /** Companion patterns awaiting the owner's decision, newest first, at most 3. */
        List<Observation> observations,
        Calendar calendar,
        Weight weight,
        Recovery recovery) {

    /** Number of quarter-hour busy slots covering 06:00–24:00. */
    public static final int BUSY_SLOTS = 72;
    /** First busy slot starts here; slot {@code i} covers {@code 06:00 + 15·i} for 15 minutes. */
    public static final LocalTime BUSY_FROM = LocalTime.of(6, 0);
    public static final int SLOT_MINUTES = 15;

    /** {@code totalMin} = logged duration; stage minutes are null on sparse (manual) rows. */
    public record Sleep(UUID id, String bedtime, String wakeup, int totalMin, Integer deepMin, Integer remMin,
                        Integer lightMin, Integer awakeMin, Integer quality, List<Segment> hypnogram) {}

    /** One run of equal stages: 0 awake, 1 REM, 2 light, 3 deep. */
    public record Segment(int stage, int minutes) {}

    public record HrToday(Integer min, Integer avg, Integer max) {}

    /** {@code time} = moved time if overridden, else {@code plannedTime} (the weekday's gym slot);
     *  both null without a slot. {@code minutes} = the template's estimate, null when unset. */
    public record Session(String title, LocalTime time, LocalTime plannedTime, Integer minutes,
                          List<Exercise> exercises) {}

    public record Exercise(String name, int sets) {}

    public record WorkoutLoad(int minutes, int kcal) {}

    public record Meal(LocalTime time, String title, String slot, int kcal, int proteinG, boolean logged) {}

    /** {@code slot} ∈ morning|midday|afternoon|evening (configured slot times in order). */
    public record Checkin(String slot, LocalTime time, boolean done, String summary) {}

    public record Intention(String creed, List<String> foci) {}

    /** {@code id} is a pattern id {@code decidePattern} accepts; {@code strength} 0..5. */
    public record Observation(String id, String lead, String bold, String tail, int strength) {}

    /** Events of the day in local time; {@code busySlots} has {@link #BUSY_SLOTS} flags. */
    public record Calendar(int count, List<Boolean> busySlots, List<CalendarItem> events) {}

    /** A timed calendar event in local clock time (all-day events: both times null). */
    public record CalendarItem(String title, LocalTime start, LocalTime end, boolean allDay) {}

    /** Latest weigh-in on/before the day and the EWMA trend at that point. */
    public record Weight(double kg, double trendKg) {}

    /** Kímélő mód covering the day: Hungarian reason label and 1-based day index. */
    public record Recovery(String reason, int day) {}
}
