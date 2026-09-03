package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Does the user's sleep plan actually fit their own week? (S3, bd mezo-d58h.3, spec §4 setup
 * table row 6; day-pairing corrected in S3's whole-branch review, same bd id.) Required
 * lights-out is derived from the earliest MORNING obligation; the evening schedule and the
 * observed bedtime are what push against it.
 *
 * <p><b>The sport half is day-paired.</b> A sport evening only constrains the morning that
 * ACTUALLY follows it — a Friday-night volleyball match has nothing to do with Monday's early gym
 * slot. So each {@code sport_schedule_slot} on weekday {@code D} is measured against the morning
 * obligation on weekday {@code (D + 1) mod 7}; a slot whose following day has no obligation at
 * all is skipped (nothing follows it, so it cannot make the plan infeasible), never compared
 * against some other day's obligation.
 *
 * <p><b>The bedtime half is deliberately NOT day-paired</b> — this is asymmetric with the sport
 * half ON PURPOSE, not an oversight. The observed median bedtime is a HABIT: it happens every
 * night, not on one weekday, so it must be judged against the user's TIGHTEST morning across the
 * whole week (the earliest morning obligation, day-agnostic), exactly as before this correction.
 *
 * <p>Every operand is minutes-from-midnight with hours below 12 shifted by +24h, so a 00:30
 * bedtime is LATER than a 22:15 lights-out rather than 21h45m earlier. {@code BEDTIME_HOUR}'s
 * extractor already applies that same shift to its values, so its numbers drop straight in.
 *
 * <p>Silent by design (spec §7 — never estimate) when there is no goal, when nothing makes the
 * morning early, or when neither half has enough to say (now including: every sport slot's
 * following day has no morning obligation at all).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class PlanFeasibilityCalculator {

    public static final String SOURCE_SPORT = "sport";
    public static final String SOURCE_BEDTIME = "bedtime";

    private static final int DAY_MINUTES = 1440;
    private static final int NOON_HOUR = 12;
    private static final int DAYS_PER_WEEK = 7;

    private final SleepGoalRepository sleepGoalRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;
    private final MetricSeriesService metricSeriesService;
    private final SetupCheckProperties properties;

    /** The verdict, or empty when the check must stay silent. */
    public Optional<Verdict> evaluate(UUID userId, LocalDate today) {
        SetupCheckProperties.PlanFeasibility cfg = properties.planFeasibility();
        Optional<SleepGoalEntity> goalOpt = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId);
        if (goalOpt.isEmpty()) {
            return Optional.empty(); // the missing-goal check owns this story
        }
        SleepGoalEntity goal = goalOpt.get();
        List<GymScheduleSlotEntity> gymSlots =
            gymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);

        // The day-agnostic "tightest morning of the week" — gates the whole check, and is what
        // the (deliberately un-paired) bedtime half is judged against.
        OptionalInt tightestMorning = earliestMorningObligation(gymSlots, goal, cfg);
        if (tightestMorning.isEmpty()) {
            return Optional.empty(); // nothing to be early FOR — inventing one would be an estimate
        }
        int bedtimeRequiredLightsOut =
            tightestMorning.getAsInt() - cfg.wakeBufferMin() - goal.getTargetMinutes();

        Optional<Candidate> sportCandidate = worstSportCandidate(userId, gymSlots, goal, cfg);
        OptionalInt medianBedtime = medianBedtime(userId, today, cfg);
        Optional<Candidate> bedtimeCandidate = medianBedtime.stream()
            .mapToObj(bedtime -> new Candidate(
                bedtime - bedtimeRequiredLightsOut, bedtime, bedtimeRequiredLightsOut, null))
            .findFirst();

        if (sportCandidate.isEmpty() && bedtimeCandidate.isEmpty()) {
            return Optional.empty(); // neither half has anything to say
        }
        boolean sportWins = sportCandidate.isPresent()
            && (bedtimeCandidate.isEmpty() || sportCandidate.get().misfit() >= bedtimeCandidate.get().misfit());
        Candidate winner = sportWins ? sportCandidate.get() : bedtimeCandidate.get();
        String source = sportWins ? SOURCE_SPORT : SOURCE_BEDTIME;

        return Optional.of(new Verdict(winner.misfit() <= cfg.misfitToleranceMin(),
            toLocalTime(winner.requiredLightsOut()), toLocalTime(winner.latestConstraint()),
            source, winner.misfit(), winner.bindingDay()));
    }

    /**
     * The sport slot whose day-paired misfit is largest, or empty when no sport slot has a
     * following-morning obligation at all (skipped, not compared against an unrelated day).
     */
    private Optional<Candidate> worstSportCandidate(UUID userId, List<GymScheduleSlotEntity> gymSlots,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        return sportScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .flatMap(slot -> parseClock(slot.getTime()).stream()
                .flatMap(t -> {
                    int end = shiftedMinutes(t) + slot.getDurationMin() + cfg.commuteBufferMin();
                    int followingDay = Math.floorMod(slot.getDayOfWeek() + 1, DAYS_PER_WEEK);
                    return morningObligationForDay(gymSlots, followingDay, goal, cfg).stream()
                        .mapToObj(obligation -> {
                            int requiredLightsOut =
                                obligation - cfg.wakeBufferMin() - goal.getTargetMinutes();
                            return new Candidate(
                                end - requiredLightsOut, end, requiredLightsOut, slot.getDayOfWeek());
                        });
                }))
            .max(Comparator.comparingInt(Candidate::misfit));
    }

    /** The earliest MORNING gym slot across the WHOLE week, day-agnostic; failing that, a
     *  WAKE-anchored goal's own wake time. Used for the top-level silence gate and for the
     *  (deliberately un-paired) bedtime half — see the class javadoc. */
    private OptionalInt earliestMorningObligation(List<GymScheduleSlotEntity> gymSlots,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        OptionalInt slot = earliestQualifyingSlot(gymSlots.stream(), cfg);
        return slot.isPresent() ? slot : wakeFallback(goal);
    }

    /** The earliest MORNING gym slot on exactly weekday {@code day}; failing that, a
     *  WAKE-anchored goal's own wake time (a wake anchor is a daily commitment, so it applies to
     *  every following morning, not just days with a logged slot). */
    private OptionalInt morningObligationForDay(List<GymScheduleSlotEntity> gymSlots, int day,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        OptionalInt slot = earliestQualifyingSlot(
            gymSlots.stream().filter(g -> g.getDayOfWeek() == day), cfg);
        return slot.isPresent() ? slot : wakeFallback(goal);
    }

    /** The earliest MORNING slot (at or before {@code morningCutoffHour}) in {@code slots},
     *  malformed rows silently dropped (see {@link #parseClock}). */
    private static OptionalInt earliestQualifyingSlot(
            Stream<GymScheduleSlotEntity> slots, SetupCheckProperties.PlanFeasibility cfg) {
        return slots
            .map(GymScheduleSlotEntity::getTime)
            .flatMap(clock -> parseClock(clock).stream())
            .filter(t -> t.getHour() <= cfg.morningCutoffHour())
            .mapToInt(PlanFeasibilityCalculator::shiftedMinutes)
            .min();
    }

    /** A BED-anchored goal states when to go to bed, not what to be up FOR — no obligation. */
    private static OptionalInt wakeFallback(SleepGoalEntity goal) {
        return "WAKE".equals(goal.getAnchor())
            ? parseClock(goal.getAnchorTime()).map(PlanFeasibilityCalculator::shiftedMinutes)
                .map(OptionalInt::of).orElseGet(OptionalInt::empty)
            : OptionalInt.empty();
    }

    /** {@link LocalTime#parse} on a free-form clock string, returning empty instead of throwing
     *  on malformed input (e.g. {@code "99:99"}, which the varchar(5) column contract admits) —
     *  the {@code MetricSeriesService.clockHour} null-on-malformed idiom, so one bad slot cannot
     *  kill the whole check for a user with an otherwise-fine schedule. */
    private static Optional<LocalTime> parseClock(String clock) {
        if (clock == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalTime.parse(clock));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    /** Median of the logged bedtimes, honest-gated on sample count. */
    private OptionalInt medianBedtime(
            UUID userId, LocalDate today, SetupCheckProperties.PlanFeasibility cfg) {
        LocalDate from = today.minusDays(cfg.bedtimeWindowDays() - 1L);
        // The series values are ALREADY midnight-shifted hours (00:30 reads as 24.5).
        List<Double> hours = new ArrayList<>(
            metricSeriesService.series(userId, MetricKey.BEDTIME_HOUR, from, today).values());
        if (hours.size() < cfg.minBedtimeSamples()) {
            return OptionalInt.empty();
        }
        Collections.sort(hours);
        int mid = hours.size() / 2;
        double median = hours.size() % 2 == 1
            ? hours.get(mid)
            : (hours.get(mid - 1) + hours.get(mid)) / 2;
        return OptionalInt.of((int) Math.round(median * 60));
    }

    /** Minutes from midnight, with anything before noon pushed into the following day. */
    private static int shiftedMinutes(LocalTime time) {
        int minutes = time.getHour() * 60 + time.getMinute();
        return time.getHour() < NOON_HOUR ? minutes + DAY_MINUTES : minutes;
    }

    private static LocalTime toLocalTime(int shiftedMinutes) {
        return LocalTime.ofSecondOfDay(Math.floorMod(shiftedMinutes, DAY_MINUTES) * 60L);
    }

    /** One half's candidate constraint: {@code misfit} decides which half (and, for sport, which
     *  day's slot) wins; {@code bindingDay} is null for the day-agnostic bedtime half. */
    private record Candidate(int misfit, int latestConstraint, int requiredLightsOut, Integer bindingDay) {
    }

    /**
     * @param feasible whether {@code latestConstraint} is within tolerance of {@code requiredLightsOut}
     * @param requiredLightsOut the lights-out time the winning half's morning obligation demands
     *                          (day-paired for {@code sport}, the week's tightest morning for
     *                          {@code bedtime})
     * @param latestConstraint the winning half's own latest time — the day-paired sport slot's end,
     *                         or the observed median bedtime — whichever one {@code constraintSource}
     *                         names
     * @param constraintSource {@link #SOURCE_SPORT} or {@link #SOURCE_BEDTIME} — which half bound
     *                         the verdict, so the card can say it
     * @param misfitMin {@code latestConstraint − requiredLightsOut} in minutes; negative when
     *                  comfortably feasible (a margin, not a shortfall), positive when the plan
     *                  runs late — a card is emitted only once this exceeds the tolerance
     * @param bindingDay the weekday (0=Monday..6=Sunday) of the sport slot that binds when
     *                   {@code constraintSource} is {@code sport}; null for {@code bedtime} — the
     *                   observed bedtime is a nightly habit, not tied to one day
     */
    public record Verdict(boolean feasible, LocalTime requiredLightsOut, LocalTime latestConstraint,
                          String constraintSource, int misfitMin, Integer bindingDay) {
    }
}
