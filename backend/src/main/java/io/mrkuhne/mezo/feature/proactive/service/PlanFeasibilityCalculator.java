package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Does the user's sleep plan actually fit their own week? (S3, bd mezo-d58h.3, spec §4 setup
 * table row 6.) Required lights-out is derived from the earliest MORNING obligation; the evening
 * schedule and the observed bedtime are what push against it.
 *
 * <p>Every operand is minutes-from-midnight with hours below 12 shifted by +24h, so a 00:30
 * bedtime is LATER than a 22:15 lights-out rather than 21h45m earlier. {@code BEDTIME_HOUR}'s
 * extractor already applies that same shift to its values, so its numbers drop straight in.
 *
 * <p>Silent by design (spec §7 — never estimate) when there is no goal, when nothing makes the
 * morning early, or when neither half has enough to say.
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

    private final SleepGoalRepository sleepGoalRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;
    private final MetricSeriesService metricSeriesService;
    private final SetupCheckProperties properties;

    /** The verdict, or empty when the check must stay silent. */
    public Optional<Verdict> evaluate(UUID userId, LocalDate today) {
        SetupCheckProperties.PlanFeasibility cfg = properties.planFeasibility();
        Optional<SleepGoalEntity> goal = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId);
        if (goal.isEmpty()) {
            return Optional.empty(); // the missing-goal check owns this story
        }
        OptionalInt obligation = earliestMorningObligation(userId, goal.get(), cfg);
        if (obligation.isEmpty()) {
            return Optional.empty(); // nothing to be early FOR — inventing one would be an estimate
        }
        int requiredLightsOut =
            obligation.getAsInt() - cfg.wakeBufferMin() - goal.get().getTargetMinutes();

        OptionalInt sportEnd = latestSportEnd(userId, cfg);
        OptionalInt medianBedtime = medianBedtime(userId, today, cfg);
        if (sportEnd.isEmpty() && medianBedtime.isEmpty()) {
            return Optional.empty(); // neither half has anything to say
        }
        int latest = Math.max(sportEnd.orElse(Integer.MIN_VALUE), medianBedtime.orElse(Integer.MIN_VALUE));
        String source = sportEnd.isPresent() && sportEnd.getAsInt() == latest ? SOURCE_SPORT : SOURCE_BEDTIME;

        int misfit = latest - requiredLightsOut;
        return Optional.of(new Verdict(misfit <= cfg.misfitToleranceMin(),
            toLocalTime(requiredLightsOut), toLocalTime(latest), source, misfit));
    }

    /** The earliest morning gym slot; failing that, a WAKE-anchored goal's own wake time. */
    private OptionalInt earliestMorningObligation(
            UUID userId, SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        OptionalInt earliestSlot = gymScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(GymScheduleSlotEntity::getTime)
            .map(LocalTime::parse)
            .filter(t -> t.getHour() <= cfg.morningCutoffHour())
            .mapToInt(PlanFeasibilityCalculator::shiftedMinutes)
            .min();
        if (earliestSlot.isPresent()) {
            return earliestSlot;
        }
        // A BED-anchored goal states when to go to bed, not what to be up FOR — no obligation.
        return "WAKE".equals(goal.getAnchor())
            ? OptionalInt.of(shiftedMinutes(LocalTime.parse(goal.getAnchorTime())))
            : OptionalInt.empty();
    }

    /** The latest "actually home" moment across the sport schedule. */
    private OptionalInt latestSportEnd(UUID userId, SetupCheckProperties.PlanFeasibility cfg) {
        return sportScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .mapToInt(slot -> shiftedMinutes(LocalTime.parse(slot.getTime()))
                + slot.getDurationMin() + cfg.commuteBufferMin())
            .max();
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

    /**
     * @param feasible whether {@code latestConstraint} is within tolerance of {@code requiredLightsOut}
     * @param requiredLightsOut the lights-out time the morning obligation demands
     * @param latestConstraint the later of the evening sport end and the observed median bedtime —
     *                         whichever one {@code constraintSource} names
     * @param constraintSource {@link #SOURCE_SPORT} or {@link #SOURCE_BEDTIME} — which half bound
     *                         the verdict, so the card can say it
     * @param misfitMin {@code latestConstraint − requiredLightsOut} in minutes; negative when
     *                  comfortably feasible (a margin, not a shortfall), positive when the plan
     *                  runs late — a card is emitted only once this exceeds the tolerance
     */
    public record Verdict(boolean feasible, LocalTime requiredLightsOut, LocalTime latestConstraint,
                          String constraintSource, int misfitMin) {
    }
}
