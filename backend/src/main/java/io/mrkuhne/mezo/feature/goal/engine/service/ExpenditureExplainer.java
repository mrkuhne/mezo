package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.Day;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.DayTrace;
import io.mrkuhne.mezo.feature.goal.engine.service.IntakeDayClassifier.Status;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson.SeriesPoint;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson.WaterEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the "Hogy tanultam?" explanation (bd mezo-y72o3) of one weekly learned-expenditure run
 * from the window it replayed, the day classification and the filter's per-day trace. Pure: no
 * I/O, no Spring — {@link ExpenditureLearningService} calls it and persists the result, so the
 * request path never re-runs the filter.
 */
public final class ExpenditureExplainer {

    /** The chart window: the last 8 weeks of the replay (the approved prototype's x-axis). */
    static final int SERIES_DAYS = 56;

    private ExpenditureExplainer() {
    }

    /**
     * @param days          the filter input, one per window day, ascending (usable intake, movement, weight)
     * @param status        every window day's classification
     * @param loggedKcal    the logged intake per day (excluded days included), absent when unlogged
     * @param trace         the filter trace from the first weigh-in on; empty when the window had none
     * @param startBaseKcal the base this week's step started from (the previous applied base)
     * @param waterEventKg  a 7-day glycogen-water rise at least this big is a water event
     */
    public record Input(LocalDate windowStart, LocalDate windowEnd, List<Day> days, Map<LocalDate, Status> status,
                        Map<LocalDate, Integer> loggedKcal, List<DayTrace> trace, int startBaseKcal, int kcalPerKg,
                        double waterEventKg) {
    }

    public static ExpenditureExplanationJson explain(Input in) {
        int usable = count(in.status(), in.windowStart(), in.windowEnd(), Status.USABLE);
        int unlogged = count(in.status(), in.windowStart(), in.windowEnd(), Status.UNLOGGED);
        List<Day> weighed = in.days().stream().filter(d -> d.weightKg() != null).toList();
        int historyWeeks = weighed.isEmpty() ? 0
            : (int) Math.ceil((ChronoUnit.DAYS.between(weighed.get(0).date(), in.windowEnd()) + 1) / 7.0);

        Integer avgIntake = usable == 0 ? null : (int) Math.round(in.days().stream()
            .filter(d -> d.intakeKcal() != null).mapToInt(Day::intakeKcal).average().orElseThrow());
        int avgMovement = (int) Math.round(in.days().stream().mapToInt(Day::movementKcal).average().orElse(0));

        BigDecimal rate = null;
        Integer tissueKcal = null;
        List<DayTrace> trace = in.trace();
        if (trace.size() > 1) {
            DayTrace first = trace.get(0);
            DayTrace last = trace.get(trace.size() - 1);
            double perDay = (last.tissueKg() - first.tissueKg()) / ChronoUnit.DAYS.between(first.date(), last.date());
            rate = kg(perDay * 7);
            tissueKcal = (int) Math.round(perDay * in.kcalPerKg());
        }
        Integer simpleBase = avgIntake == null || tissueKcal == null ? null : avgIntake - tissueKcal - avgMovement;

        return new ExpenditureExplanationJson(in.windowStart(), in.windowEnd(), usable, weighed.size(), unlogged,
            historyWeeks, avgIntake, avgMovement, rate, tissueKcal, simpleBase, in.startBaseKcal(),
            excluded(in.status(), in.loggedKcal(), in.windowStart(), in.windowEnd()),
            waterEvents(trace, in.waterEventKg()), series(in));
    }

    /** The excluded logged days (SUSPICIOUS → "suspicious", MARKED_INCOMPLETE → "marked") in [from, to], date-ascending. */
    static List<ExcludedIntakeDayJson> excluded(Map<LocalDate, Status> status, Map<LocalDate, Integer> kcal,
                                                LocalDate from, LocalDate to) {
        List<ExcludedIntakeDayJson> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Status s = status.get(d);
            if (s == Status.SUSPICIOUS || s == Status.MARKED_INCOMPLETE) {
                out.add(new ExcludedIntakeDayJson(d, kcal.get(d), statusName(s)));
            }
        }
        return out;
    }

    static int count(Map<LocalDate, Status> status, LocalDate from, LocalDate to, Status want) {
        return (int) status.entrySet().stream()
            .filter(en -> !en.getKey().isBefore(from) && !en.getKey().isAfter(to))
            .filter(en -> en.getValue() == want).count();
    }

    /** Days whose glycogen-water rose ≥ threshold vs 7 days earlier; a run of such days reports once (first date, max rise). */
    private static List<WaterEvent> waterEvents(List<DayTrace> trace, double threshold) {
        Map<LocalDate, Double> glycogen = new HashMap<>();
        trace.forEach(t -> glycogen.put(t.date(), t.glycogenKg()));
        List<WaterEvent> out = new ArrayList<>();
        LocalDate runStart = null;
        LocalDate lastHit = null;
        double runMax = 0;
        for (DayTrace t : trace) {
            Double before = glycogen.get(t.date().minusDays(7));
            double jump = before == null ? Double.NEGATIVE_INFINITY : t.glycogenKg() - before;
            if (jump >= threshold) {
                if (lastHit != null && lastHit.plusDays(1).equals(t.date())) {
                    runMax = Math.max(runMax, jump);
                } else {
                    if (runStart != null) {
                        out.add(new WaterEvent(runStart, kg(runMax)));
                    }
                    runStart = t.date();
                    runMax = jump;
                }
                lastHit = t.date();
            }
        }
        if (runStart != null) {
            out.add(new WaterEvent(runStart, kg(runMax)));
        }
        return out;
    }

    private static List<SeriesPoint> series(Input in) {
        LocalDate from = in.windowEnd().minusDays(SERIES_DAYS - 1L);
        if (from.isBefore(in.windowStart())) {
            from = in.windowStart();
        }
        Map<LocalDate, Day> byDate = new HashMap<>();
        in.days().forEach(d -> byDate.put(d.date(), d));
        Map<LocalDate, DayTrace> traced = new HashMap<>();
        in.trace().forEach(t -> traced.put(t.date(), t));
        List<SeriesPoint> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(in.windowEnd()); d = d.plusDays(1)) {
            Status s = in.status().getOrDefault(d, Status.UNLOGGED);
            Day day = byDate.get(d);
            DayTrace t = traced.get(d);
            out.add(new SeriesPoint(d, s == Status.UNLOGGED ? null : in.loggedKcal().get(d), statusName(s),
                day == null || day.weightKg() == null ? null : kg(day.weightKg()),
                t == null ? null : kg(t.tissueKg() + t.waterKg() + t.glycogenKg()),
                t == null ? null : kg(t.tissueKg())));
        }
        return out;
    }

    private static String statusName(Status s) {
        return switch (s) {
            case USABLE -> "usable";
            case SUSPICIOUS -> "suspicious";
            case MARKED_INCOMPLETE -> "marked";
            case UNLOGGED -> "unlogged";
        };
    }

    private static BigDecimal kg(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
