package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort.GoalFields;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * How a season draft becomes its goal (pure). The goal's window is the season's ({@code weeks} whole weeks from the
 * start) unless the draft names both a target and a pace — then the pace sets how many weeks the target takes
 * (the spike's rule: weeks = ⌈|start − target| ÷ kg per week⌉) and the goal ends there. With a pace but no target
 * the target follows from the pace over the season. A maintain season has no target.
 */
public final class SeasonDraftMath {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private SeasonDraftMath() {
    }

    public static GoalFields goalFields(SeasonDraftJson d, BigDecimal startWeightKg, List<String> guards) {
        LocalDate start = d.startDate();
        LocalDate seasonTarget = start.plusWeeks(d.weeks());
        if ("maintain".equals(d.trajectory())) {
            return new GoalFields(d.title(), d.trajectory(), start, seasonTarget, startWeightKg, null, guards);
        }
        BigDecimal pace = paceKgPerWeek(d, startWeightKg);
        BigDecimal target = d.targetWeightKg();
        LocalDate targetDate = seasonTarget;
        if (target != null && pace != null && pace.signum() > 0) {
            long weeks = target.subtract(startWeightKg).abs().divide(pace, 0, RoundingMode.CEILING).longValue();
            targetDate = start.plusWeeks(Math.max(1, weeks));
        } else if (target == null && pace != null && pace.signum() > 0) {
            BigDecimal change = pace.multiply(BigDecimal.valueOf(d.weeks()));
            target = ("cut".equals(d.trajectory()) ? startWeightKg.subtract(change) : startWeightKg.add(change))
                .setScale(1, RoundingMode.HALF_UP);
        }
        return new GoalFields(d.title(), d.trajectory(), start, targetDate, startWeightKg, target, guards);
    }

    /** The draft's unsigned weekly pace in kg (kg/week wins over %BW), or null. */
    static BigDecimal paceKgPerWeek(SeasonDraftJson d, BigDecimal startWeightKg) {
        if (d.kgPerWeek() != null) {
            return d.kgPerWeek();
        }
        if (d.ratePctPerWeek() != null && startWeightKg != null) {
            return d.ratePctPerWeek().multiply(startWeightKg).divide(HUNDRED, 3, RoundingMode.HALF_UP);
        }
        return null;
    }

    /** Whole weeks of the goal window. */
    public static int goalWeeks(GoalFields f) {
        return (int) ChronoUnit.WEEKS.between(f.startDate(), f.targetDate());
    }

    /** Distinct weekdays with gym or sport. */
    public static int activeDays(SeasonDraftJson d) {
        Set<Integer> days = new HashSet<>(d.gymDaysOrEmpty());
        d.sportOrEmpty().forEach(s -> days.add(s.dayOfWeek()));
        return days.size();
    }
}
