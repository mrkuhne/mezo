package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCheckinPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCheckinPort.DayFeel;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMealPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMetricsPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMetricsPort.DayMetric;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySleepPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.Session;
import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.Capacity;
import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.CapacityInputs;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.Demand;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.TimedDemand;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The capacity of one day or a Monday-Sunday week (Boop B7 K1, mezo-r36n9.17): every signal comes through a
 * consumer-owned port and feeds the pure models. It never calls the scoring model: every event carries its stored
 * score or the rule's, and an upcoming event still waiting for a model score only starts the background run
 * ({@link EventScoringRunner}), which this read never waits for.
 *
 * <p>Base of the day units: the 28-day median over days he rated 4 or better in the day close, else over the full
 * days (a sleep record AND a daily-metric row), else the configured default with {@code tanulo}. Each day counts only
 * the hours its events have on that day (an event crossing midnight is split). A past day counts logged sessions
 * only; from today (his zone) on, the plan counts. A calendar with no rows at all in the two weeks before the day is
 * "unknown": the verdict then comes from the body and the sessions alone.
 */
@Service
public class CapacityDayService {

    static final int HISTORY_DAYS = 28;
    /** A baseline of resting HR / HRV needs at least this many days, else it adds no factor. */
    static final int MIN_BASELINE_DAYS = 5;
    static final int CALENDAR_PROBE_DAYS = 14;
    static final int GOOD_RATING = 4;
    /** Logged kcal below this share of the day's target counts as under-eating. */
    static final double UNDER_ATE_SHARE = 0.85;
    /** Whole words (leg, láb, ...) or word-start stems (alsó-, guggol-): "labda" and "legjobb" are not leg days. */
    private static final Pattern HEAVY_LABEL = Pattern.compile(
        "\\b(?:leg|legs|láb|lab|lower|squats?)\\b|\\b(?:alsó|also|guggol|lábnap|labnap|lábedz|labedz)",
        Pattern.UNICODE_CHARACTER_CLASS);

    private final CapacityCalendarPort calendar;
    private final EventScoringService scoring;
    private final EventScoringRunner scoringRunner;
    private final CapacitySleepPort sleep;
    private final CapacityMetricsPort metrics;
    private final CapacityTrainPort train;
    private final CapacityMealPort meal;
    private final CapacityCheckinPort checkin;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;

    public CapacityDayService(CapacityCalendarPort calendar, EventScoringService scoring,
                              EventScoringRunner scoringRunner, CapacitySleepPort sleep,
                              CapacityMetricsPort metrics, CapacityTrainPort train, CapacityMealPort meal,
                              CapacityCheckinPort checkin, CapacityProperties props, WearableProperties wearable,
                              ObjectProvider<Clock> clock) {
        this.calendar = calendar;
        this.scoring = scoring;
        this.scoringRunner = scoringRunner;
        this.sleep = sleep;
        this.metrics = metrics;
        this.train = train;
        this.meal = meal;
        this.checkin = checkin;
        this.props = props;
        this.wearable = wearable;
        this.clock = clock;
    }

    public CapacityDay day(UUID owner, LocalDate date) {
        return build(owner, date, date, false).get(0).day();
    }

    /** A day with the inputs its recovery came from (the season load reads these); see {@link #history}. */
    public record DayRead(CapacityDay day, double base, Integer sleepMin, Integer needMin, Integer restingHr,
                          Double rhrBaseline) {
    }

    /**
     * The days of {@code first..last} for a history read: the same computation as {@link #day}, but it only ever
     * uses stored or rule scores and never starts the background scoring run (a past range must not spend the model).
     * One batch of reads for the whole range; the only per-day read is yesterday's fuel day.
     */
    public List<DayRead> history(UUID owner, LocalDate first, LocalDate last) {
        return build(owner, first, last, true);
    }

    /** Seven days, {@code monday} first; a {@code monday} that is not a Monday is rejected (400, field "monday"). */
    public List<CapacityDay> week(UUID owner, LocalDate monday) {
        if (monday.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "monday").build(),
                HttpStatus.BAD_REQUEST);
        }
        return build(owner, monday, monday.plusDays(6), false).stream().map(DayRead::day).toList();
    }

    private List<DayRead> build(UUID owner, LocalDate first, LocalDate last, boolean history) {
        ZoneId zone = ZoneId.of(wearable.zone());
        LocalDate histFrom = first.minusDays(HISTORY_DAYS);
        LocalDate asOf = LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(zone));

        List<CalendarEventView> events = calendar.events(owner, histFrom, last);
        Map<UUID, EventScore> scores = scoring.storedOrRule(owner, histFrom, last);
        if (!history) {
            scoringRunner.requestIfUnscored(owner, events, scores);
        }
        Map<LocalDate, List<CalendarEventView>> eventsByDate = events.stream()
            .collect(Collectors.groupingBy(CalendarEventView::date));

        Map<LocalDate, Integer> sleepMin = sleep.sleepMinutes(owner, histFrom, last);
        Map<LocalDate, DayMetric> metricByDate = metrics.metrics(owner, histFrom, last);
        Map<LocalDate, List<Session>> sessions = train.sessions(owner, histFrom, last);
        Set<LocalDate> recovery = train.recoveryDays(owner, first, last);
        Map<LocalDate, DayFeel> feel = checkin.feel(owner, histFrom, last);
        CapacityTrainPort.SlotCounts slots = train.weeklySlots(owner);
        int needMin = sleep.needMinutes(owner, slots.gym(), slots.sport());

        Map<LocalDate, Demand> demandCache = new HashMap<>();
        java.util.function.Function<LocalDate, Demand> demandOf = d -> demandCache.computeIfAbsent(d,
            k -> demand(eventsByDate.getOrDefault(k, List.of()), scores, sessions.getOrDefault(k, List.of()), k, asOf,
                zone));
        // The base is sampled with the plan as planned (mezo-r36n9.185): a future day counts every planned session, so
        // a past day of the sample must too, or an unlogged training habit drags the base below an ordinary planned
        // day and every gym day reads "szoros" (spec §5.3: an ordinary day reads rendben). The day's own demand (shown,
        // and yesterday's load) stays the logged one.
        Map<LocalDate, Demand> planCache = new HashMap<>();
        java.util.function.Function<LocalDate, Demand> planDemandOf = d -> planCache.computeIfAbsent(d,
            k -> demand(eventsByDate.getOrDefault(k, List.of()), scores, sessions.getOrDefault(k, List.of()), k,
                LocalDate.MIN, zone));

        List<DayRead> out = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            LocalDate winFrom = d.minusDays(HISTORY_DAYS);
            LocalDate winTo = d.minusDays(1);

            int fullDays = 0;
            int labelledDays = 0;
            List<Double> fullUnits = new ArrayList<>();
            List<Double> ratedUnits = new ArrayList<>();
            List<Double> rhr = new ArrayList<>();
            List<Double> hrv = new ArrayList<>();
            for (LocalDate h = winFrom; !h.isAfter(winTo); h = h.plusDays(1)) {
                DayMetric m = metricByDate.get(h);
                DayFeel f = feel.get(h);
                boolean full = sleepMin.containsKey(h) && m != null;
                if (full) {
                    fullDays++;
                    fullUnits.add(planDemandOf.apply(h).units());
                }
                if (f != null && (f.hasClose() || f.hasCheckin())) {
                    labelledDays++;
                }
                if (f != null && f.dayRating() != null && f.dayRating() >= GOOD_RATING) {
                    ratedUnits.add(planDemandOf.apply(h).units());
                }
                if (m != null && m.restingHr() != null) {
                    rhr.add(m.restingHr().doubleValue());
                }
                if (m != null && m.hrvMs() != null) {
                    hrv.add(m.hrvMs());
                }
            }
            double median = !ratedUnits.isEmpty() ? median(ratedUnits) : median(fullUnits);
            boolean haveBase = (!ratedUnits.isEmpty() || !fullUnits.isEmpty()) && median > 0;
            double base = haveBase ? median : props.defaultBaseUnits();

            DayMetric today = metricByDate.get(d);
            DayFeel todayFeel = feel.get(d);
            CapacityInputs inputs = new CapacityInputs(base, sleepMin.get(d), sleepMin.containsKey(d) ? needMin : null,
                today == null ? null : today.restingHr(), baseline(rhr),
                today == null ? null : today.hrvMs(), baseline(hrv), demandOf.apply(d.minusDays(1)).units(),
                underAte(owner, d.minusDays(1)), recovery.contains(d),
                todayFeel == null ? null : todayFeel.energy(), todayFeel == null ? null : todayFeel.mental());
            Capacity capacity = CapacityCalculator.today(inputs, props);
            Demand demand = demandOf.apply(d);
            double ratio = capacity.units() > 0 ? demand.units() / capacity.units() : 0;
            boolean tanulo = !haveBase || LearningState.of(fullDays, labelledDays, props);
            CapacityDay day = new CapacityDay(d, Verdicts.word(ratio, props), ratio, tanulo, fullDays, labelledDays,
                calendarKnown(events, d), demand, capacity, CapacityReasonFacts.of(demand, capacity, zone));
            out.add(new DayRead(day, base, sleepMin.get(d), sleepMin.containsKey(d) ? needMin : null,
                today == null ? null : today.restingHr(), baseline(rhr)));
        }
        return out;
    }

    /** One day's demand: the scored timed events (all-day ones carry no time span) and the day's sessions. */
    private Demand demand(List<CalendarEventView> events, Map<UUID, EventScore> scores, List<Session> sessions,
                          LocalDate date, LocalDate asOf, ZoneId zone) {
        List<TimedDemand> items = new ArrayList<>();
        for (CalendarEventView e : events) {
            EventScore s = scores.get(e.id());
            if (s == null || e.allDay()) {
                continue;
            }
            items.add(new TimedDemand(e.start(), e.end(), s.mental(), s.social(), s.physical(), s.restores(),
                e.title() == null ? "" : e.title(), s.kind(),
                e.externalId() == null ? null : EventScoringService.eventKey(e.externalId()), s.feedback()));
        }
        for (Session s : sessions) {
            // a past planned session that was never logged did not happen; from the asked day on, the plan counts
            if (!s.done() && date.isBefore(asOf)) {
                continue;
            }
            boolean heavy = heavyLabel(s.label());
            items.add(DemandCalculator.training(date.atTime(s.start()).atZone(zone).toInstant(), s.durationMin(),
                heavy, null, null, s.label() == null ? s.kind() : s.label()));
        }
        return DemandCalculator.day(items, props, zone, date);
    }

    /** Whether a session label names a heavy lower-body day (word matches, never a substring like "labda"). */
    static boolean heavyLabel(String label) {
        return label != null && HEAVY_LABEL.matcher(label.toLowerCase(Locale.ROOT)).find();
    }

    private Boolean underAte(UUID owner, LocalDate yesterday) {
        CapacityMealPort.FuelDay f = meal.fuelDay(owner, yesterday);
        if (f.loggedKcal() == null || f.targetKcal() <= 0) {
            return null;
        }
        return f.loggedKcal() < UNDER_ATE_SHARE * f.targetKcal();
    }

    private boolean calendarKnown(List<CalendarEventView> events, LocalDate d) {
        LocalDate from = d.minusDays(CALENDAR_PROBE_DAYS);
        return events.stream().anyMatch(e -> !e.date().isBefore(from) && !e.date().isAfter(d));
    }

    private static Double baseline(List<Double> values) {
        return values.size() < MIN_BASELINE_DAYS ? null
            : values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private static double median(List<Double> values) {
        if (values.isEmpty()) {
            return 0;
        }
        List<Double> sorted = values.stream().sorted().toList();
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
    }
}
