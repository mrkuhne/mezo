package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Spec 2026-09-03 §4 row 8 (rank 9, the epic's last new detection): the last meal too close to
 * bedtime, or too late outright, on at least {@code minDaysOfLastThree} of the last
 * {@code windowDays} days.
 *
 * <p><b>Two arms, OR'd per day.</b> A day counts as late if its last meal is within
 * {@code minutesBeforeBed} minutes of the bedtime anchor (either direction — "close to bedtime",
 * not only "before" it, despite the config key's name), OR the meal is at/after
 * {@code absoluteHour} (inclusive: a meal logged at EXACTLY 22:30 counts, since the spec's
 * "at or after 22:30" is explicit about the boundary).
 *
 * <p><b>Trap 1 — the anchor ghosts.</b> {@link SleepAnchorPort#resolve} falls back to a config
 * default when no {@code sleep_goal} row exists ({@code IgnoredNudgeRule} faces the identical
 * trap). The BED arm is therefore gated on the row EXISTING, read directly via
 * {@link SleepGoalRepository} before ever calling the port — a user with no goal is never
 * measured against an invented bedtime. The ABSOLUTE arm needs no goal at all and keeps working
 * regardless: without a goal we still know 23:40 is late, we just do not know whether 21:00 is
 * late for THIS user. When no goal row exists, {@code anchorBedTimeHour} freezes as {@code null}
 * and only the absolute arm can ever qualify a day.
 *
 * <p><b>Trap 2 — the clock-hour space.</b> {@code MetricKey.LATE_MEAL_HOUR} is a PLAIN fractional
 * hour (0.0-23.99), unlike {@code BEDTIME_HOUR} (and the anchor), which live in the +24-below-noon
 * SHIFTED space {@code MetricSeriesService.clockHour} uses. This rule shifts BOTH the raw meal
 * hour and the anchor's {@link LocalTime} into that same shifted space before comparing (see
 * {@link #shiftedHour(double)} / {@link #shiftedHour(LocalTime)}) — a meal logged at 00:30 shifts
 * to 24.5, correctly sorting as very LATE rather than as an early breakfast. {@code absoluteHour}
 * (22.5) is already {@literal >}= 12 so the shift never touches it; comparing a shifted meal hour
 * against it directly still works, since any post-midnight meal shifts to 24+ and so always
 * clears 22.5 too.
 *
 * <p><b>Honesty gate.</b> A day with no logged meal ({@code LATE_MEAL_HOUR} has no entry for it)
 * is neither late nor compliant — it is simply skipped, so it never inflates or deflates the
 * qualifying-day count (that silence belongs to {@code logging_gap}, never to this rule).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LateEatingRule implements FlagRule {

    private static final String ARM_BED = "bed";
    private static final String ARM_ABSOLUTE = "absolute";
    private static final String ARM_BOTH = "both";

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final SleepAnchorPort sleepAnchorPort;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.LateEating cfg = properties.lateEating();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, Double> mealHours =
            metricSeriesService.series(userId, MetricKey.LATE_MEAL_HOUR, from, today);

        // Trap 1: gate the bed arm on the goal row EXISTING — never let SleepAnchorPort's
        // ghosted config default stand in for a real, personal target.
        Double anchorShiftedHour = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .isPresent() ? shiftedHour(sleepAnchorPort.resolve(userId).bed()) : null;

        Map<String, Double> hourByDay = new LinkedHashMap<>();
        Map<String, String> armByDay = new LinkedHashMap<>();
        int qualifying = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            Double rawHour = mealHours.get(day);
            if (rawHour == null) {
                continue; // honesty gate: an unlogged day is neither late nor compliant
            }
            // Trap 2: put the meal hour in the SAME shifted space the anchor/BEDTIME_HOUR use.
            double shiftedMealHour = shiftedHour(rawHour);

            boolean bedArm = anchorShiftedHour != null
                && Math.abs(shiftedMealHour - anchorShiftedHour) * 60.0 <= cfg.minutesBeforeBed();
            boolean absoluteArm = shiftedMealHour >= cfg.absoluteHour();
            if (!bedArm && !absoluteArm) {
                continue;
            }

            qualifying++;
            hourByDay.put(day.toString(), shiftedMealHour);
            armByDay.put(day.toString(),
                bedArm && absoluteArm ? ARM_BOTH : bedArm ? ARM_BED : ARM_ABSOLUTE);
        }

        if (qualifying < cfg.minDaysOfLastThree()) {
            return Optional.empty();
        }

        return Optional.of(new FlagRaise(FlagKey.LATE_EATING,
            FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(
                cfg.minutesBeforeBed(), cfg.absoluteHour(), cfg.minDaysOfLastThree(), cfg.windowDays(),
                anchorShiftedHour, qualifying, hourByDay, armByDay))));
    }

    /** The same +24-below-noon shift {@code MetricSeriesService.clockHour} applies to observed
     *  bedtimes, applied here to the anchor so both sides of every comparison live in one space. */
    private static double shiftedHour(LocalTime clock) {
        double fractional = clock.getHour() + clock.getMinute() / 60.0;
        return clock.getHour() < 12 ? fractional + 24 : fractional;
    }

    /** Same shift, applied to {@code LATE_MEAL_HOUR}'s raw plain-fractional value — a post-midnight
     *  meal (e.g. 0.5 == 00:30) becomes 24.5, correctly late rather than an early breakfast. */
    private static double shiftedHour(double rawHour) {
        return rawHour < 12 ? rawHour + 24 : rawHour;
    }
}
