package io.mrkuhne.mezo.feature.capacity.service;

import java.util.ArrayList;
import java.util.List;

/**
 * The pure season load-vs-recovery model (Boop B7 K2). A week's load is the sum of its day units; its recovery is the
 * mean over the week's days of (sleep / need, clamped 0.6..1.1) x (resting-HR baseline / resting HR, clamped
 * 0.85..1.1) x the day's base x 7. A missing input is a neutral 1, never a guess. A planned week carries only the
 * training load of its planned sessions and no recovery.
 */
public final class SeasonLoadModel {

    static final double SLEEP_MIN = 0.6;
    static final double SLEEP_MAX = 1.1;
    static final double RHR_MIN = 0.85;
    static final double RHR_MAX = 1.1;
    static final int OVER_STREAK_WEEKS = 3;
    static final String HEADLINE = "Az utóbbi három hétben a terhed gyorsabban nőtt, mint ahogy pihensz.";

    private SeasonLoadModel() {
    }

    /** One day's recovery inputs; any of them may be null. */
    public record DayRecovery(Integer sleepMin, Integer needMin, Integer restingHr, Double rhrBaseline, double base) {
    }

    /** One week before the verdict: {@code load}/{@code recovery} null = unknown. */
    public record WeekIn(int week, Double load, Double recovery, boolean planned, boolean trainingOnly) {
    }

    public record WeekOut(int week, Double load, Double recovery, boolean planned, boolean over,
                          boolean trainingOnly) {
    }

    /** One day's recovery units: base x sleep factor x resting-HR factor. */
    public static double dayRecovery(DayRecovery d) {
        double f = 1.0;
        if (d.sleepMin() != null && d.needMin() != null && d.needMin() > 0) {
            f *= clamp((double) d.sleepMin() / d.needMin(), SLEEP_MIN, SLEEP_MAX);
        }
        if (d.restingHr() != null && d.rhrBaseline() != null && d.restingHr() > 0) {
            f *= clamp(d.rhrBaseline() / d.restingHr(), RHR_MIN, RHR_MAX);
        }
        return d.base() * f;
    }

    /** The week's recovery: the mean of its days' recovery units times 7 (a short list still means a 7-day week). */
    public static double weekRecovery(List<DayRecovery> days) {
        if (days.isEmpty()) {
            return 0;
        }
        double sum = 0;
        for (DayRecovery d : days) {
            sum += dayRecovery(d);
        }
        return sum / days.size() * 7;
    }

    public static List<WeekOut> weeks(List<WeekIn> in) {
        List<WeekOut> out = new ArrayList<>();
        for (WeekIn w : in) {
            boolean over = !w.planned() && w.load() != null && w.recovery() != null && w.load() > w.recovery();
            out.add(new WeekOut(w.week(), w.load(), w.recovery(), w.planned(), over, w.trainingOnly()));
        }
        return out;
    }

    /**
     * The headline when each of the last three completed weeks (those before {@code nowWeek}, planned ones excluded)
     * is over; else null. No number in the sentence.
     */
    public static String headline(List<WeekOut> weeks, int nowWeek) {
        List<WeekOut> done = weeks.stream().filter(w -> !w.planned() && w.week() < nowWeek).toList();
        if (done.size() < OVER_STREAK_WEEKS) {
            return null;
        }
        List<WeekOut> last = done.subList(done.size() - OVER_STREAK_WEEKS, done.size());
        return last.stream().allMatch(WeekOut::over) ? HEADLINE : null;
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
