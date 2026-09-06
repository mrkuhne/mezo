package io.mrkuhne.mezo.feature.habit.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Where one habit stands on the way to automaticity, from the user's OWN history
 * (spec {@code docs/superpowers/specs/2026-09-06-habit-formation-design.md}, bd mezo-08zl).
 *
 * <p>Pure and Spring-free on purpose: no clock, no repository, no properties bean — every input
 * arrives as a plain value, so the model can be pinned by a plain unit test
 * ({@code HabitFormationEstimatorTest}). Precedent: {@link HabitFrameworkValidator} for a
 * collaborator that owns one rule, {@code EwmaEstimator} for a static, config-parameterised
 * estimator.
 *
 * <p><b>The model.</b> A saturating curve over successful REPETITIONS — never calendar days,
 * which is the whole point (a user who does the habit ten times over a month is exactly as far
 * along as one who did it ten times in ten days):
 *
 * <pre>
 *   automaticity(n) = 1 − e^(−k·n)                      n = done rows over the lifetime
 * </pre>
 *
 * <p>{@code k} is not a constant of nature — it is driven by how the user actually behaves:
 *
 * <pre>
 *   consistency = Loop-style EMA over the lifetime in date order, seeded 0.5
 *                 done   → s += rise·(1 − s)
 *                 missed → s ·= (1 − decay)
 *                 pending/absent → s unchanged
 *   context     = arithmetic mean of the AVAILABLE context signals, else 0.5
 *   k           = kBase · (0.6 + 0.4·consistency) · (0.7 + 0.5·context)
 * </pre>
 *
 * <p>A miss therefore SLOWS the curve and can never reset it (product decision 4 + ADR 0010: no
 * streak, no failure ceremony). A day with no row at all is absence, not a miss — habit_day rows
 * only materialize when the user opens the app, so treating a gap as a failure would invent data.
 *
 * <p><b>Range, never a point.</b> {@code k} is perturbed by ±{@code kBand}. The repetitions to the
 * threshold are {@code n_T = ln(1/(1−T))/k} with {@code T = thresholdPct/100}; the SLOWER curve
 * ({@code k·(1−band)}) yields the HIGH end and the faster one the LOW end. Both are reported as
 * REMAINING repetitions ({@code max(0, n_T − reps)}). Weeks come from the user's own recent rate
 * ({@code repsPerWeek}) — and when that rate is zero there simply are no weeks to report, because
 * dividing by a rate we do not have would be a fabrication.
 *
 * <p><b>Honesty rule.</b> Under {@code minReps} repetitions there is no estimate at all: every
 * derived field is null and only the raw counts stand. This mirrors the existing
 * {@code strengthPct}-under-{@code min-sample} rule in {@code HabitService}.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class HabitFormationEstimator {

    /** Mirrors {@code habit_day.status}; the estimator never sees the entity itself (purity). */
    public enum Status { PENDING, DONE, MISSED }

    /**
     * One lifetime row. {@code doneHour} is the clock hour (0-23) the completion landed on in the
     * USER's zone — resolved by the caller, since a pure class must not own a time zone. Null on
     * a row that carries no {@code done_at} (every non-done row, plus derived rows backfilled
     * without a timestamp).
     */
    public record Day(LocalDate date, Status status, Integer doneHour) {}

    /** The {@code mezo.habit.formation.*} tunables plus the two reused {@code mezo.habit.*} ones. */
    public record Settings(
        double kBase,
        int thresholdPct,
        int minReps,
        double kBand,
        double consistencyRise,
        double consistencyDecay,
        int strengthWindowDays,
        int minSample) {}

    /**
     * Everything the endpoint reports except {@code key}, {@code thresholdPct}/{@code minReps}
     * (echoed config) and {@code days} (the raw rows). Percentages are 0-100 integers; a null is
     * always an honest "we cannot say", never a zero.
     */
    public record Result(
        LocalDate firstDate,
        int reps,
        int missed,
        Integer automaticityPct,
        Double curveK,
        Integer repsToThresholdLo,
        Integer repsToThresholdHi,
        Double weeksToThresholdLo,
        Double weeksToThresholdHi,
        Double repsPerWeek,
        Integer consistencyPct,
        Integer timeConstancyPct,
        Integer anchorConstancyPct) {}

    /**
     * @param days             the habit's whole lifetime; any order, sorted defensively here
     * @param anchorDoneDates  the ANCHOR habit's done dates, or null when the def has no
     *                         {@code anchorHabitKey} — null means "signal absent", and an absent
     *                         signal is omitted from the context mean, never faked as 0
     * @param today            the user's today, for the recent-rate window
     */
    public static Result estimate(
            List<Day> days, Set<LocalDate> anchorDoneDates, LocalDate today, Settings settings) {
        List<Day> ordered = days.stream()
            .sorted(Comparator.comparing(Day::date))
            .toList();
        List<Day> done = ordered.stream().filter(d -> d.status() == Status.DONE).toList();
        int reps = done.size();
        int missed = (int) ordered.stream().filter(d -> d.status() == Status.MISSED).count();
        LocalDate firstDate = ordered.isEmpty() ? null : ordered.getFirst().date();

        if (reps < settings.minReps()) {
            // The honesty rule: counts only, so the FE can say "N repetitions to the estimate".
            return new Result(firstDate, reps, missed,
                null, null, null, null, null, null, null, null, null, null);
        }

        double consistency = consistency(ordered, settings);
        Double timeConstancy = timeConstancy(done, settings.minSample());
        Double anchorConstancy = anchorConstancy(done, anchorDoneDates);
        double context = contextMean(timeConstancy, anchorConstancy);
        double k = settings.kBase()
            * (0.6 + 0.4 * consistency)
            * (0.7 + 0.5 * context);

        double threshold = settings.thresholdPct() / 100.0;
        double toThreshold = Math.log(1 / (1 - threshold));
        // kLo is the SLOWER curve, so it produces the HIGH end of the repetition range.
        int repsHi = remaining(toThreshold / (k * (1 - settings.kBand())), reps);
        int repsLo = remaining(toThreshold / (k * (1 + settings.kBand())), reps);

        Double repsPerWeek = repsPerWeek(done, today, settings.strengthWindowDays());
        Double weeksLo = repsPerWeek == null ? null : repsLo / repsPerWeek;
        Double weeksHi = repsPerWeek == null ? null : repsHi / repsPerWeek;

        return new Result(firstDate, reps, missed,
            pct(1 - Math.exp(-k * reps)), k,
            repsLo, repsHi, weeksLo, weeksHi, repsPerWeek,
            pct(consistency), pct(timeConstancy), pct(anchorConstancy));
    }

    /**
     * Loop Habit Tracker's exponential smoothing: a miss decays the score, it never zeroes it.
     * Seeded at 0.5 so a fresh habit starts neutral rather than at either extreme — the seed only
     * ever matters below {@code minReps}, where nothing is reported anyway.
     */
    private static double consistency(List<Day> ordered, Settings settings) {
        double s = 0.5;
        for (Day day : ordered) {
            if (day.status() == Status.DONE) {
                s += settings.consistencyRise() * (1 - s);
            } else if (day.status() == Status.MISSED) {
                s *= (1 - settings.consistencyDecay());
            }
            // pending rows leave the score alone: the day is not over, nothing happened yet
        }
        return s;
    }

    /**
     * Circular statistics over the completion hours: the mean resultant length R of the hour
     * angles ({@code hour/24 · 2π}). Linear statistics are wrong here — 23:00 and 01:00 are two
     * hours apart, not twenty-two. R is already in [0,1]: 1 = every completion on the same hour,
     * 0 = uniformly scattered around the clock. Null under {@code minSample} timed rows.
     */
    private static Double timeConstancy(List<Day> done, int minSample) {
        List<Integer> hours = done.stream()
            .map(Day::doneHour)
            .filter(h -> h != null)
            .toList();
        if (hours.size() < minSample) {
            return null;
        }
        double cos = 0;
        double sin = 0;
        for (int hour : hours) {
            double angle = hour / 24.0 * 2 * Math.PI;
            cos += Math.cos(angle);
            sin += Math.sin(angle);
        }
        double n = hours.size();
        double r = Math.hypot(cos / n, sin / n);
        return Math.clamp(r, 0.0, 1.0);
    }

    /**
     * Share of THIS habit's done dates on which the anchor habit was also done — how reliably the
     * stack actually fires. Null when there is no anchor (signal absent) and also when there are
     * no done dates to divide by.
     */
    private static Double anchorConstancy(List<Day> done, Set<LocalDate> anchorDoneDates) {
        if (anchorDoneDates == null || done.isEmpty()) {
            return null;
        }
        long together = done.stream().filter(d -> anchorDoneDates.contains(d.date())).count();
        return together / (double) done.size();
    }

    /** Mean of the signals we actually have; 0.5 (neutral) when we have none. */
    private static double contextMean(Double... signals) {
        double sum = 0;
        int n = 0;
        for (Double signal : signals) {
            if (signal != null) {
                sum += signal;
                n++;
            }
        }
        return n == 0 ? 0.5 : sum / n;
    }

    /**
     * The user's own recent pace, from the same trailing window {@code strengthPct} uses. Null at
     * zero: a habit with no completions in the window has no rate, and inventing one (say, the
     * lifetime average) would put an ETA on a habit the user has stopped doing.
     */
    private static Double repsPerWeek(List<Day> done, LocalDate today, int windowDays) {
        LocalDate from = today.minusDays(windowDays - 1L);
        long recent = done.stream()
            .filter(d -> !d.date().isBefore(from) && !d.date().isAfter(today))
            .count();
        return recent == 0 ? null : recent / (windowDays / 7.0);
    }

    private static int remaining(double repsAtThreshold, int reps) {
        return (int) Math.round(Math.max(0, repsAtThreshold - reps));
    }

    private static Integer pct(Double ratio) {
        return ratio == null ? null : (int) Math.round(ratio * 100);
    }
}
