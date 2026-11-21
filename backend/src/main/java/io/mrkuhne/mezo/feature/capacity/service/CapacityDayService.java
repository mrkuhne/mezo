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
import org.springframework.stereotype.Service;

/**
 * The capacity of one day or a Monday-Sunday week (Boop B7 K1, mezo-r36n9.17): every signal comes through a
 * consumer-owned port and feeds the pure models. Deliberately not {@code @Transactional}: the event scoring may call
 * the model and must not hold a connection (and swallows unique violations per row, which an outer transaction would
 * poison).
 *
 * <p>Base of the day units: the 28-day median over days he rated 4 or better in the day close, else over the full
 * days (a sleep record AND a daily-metric row), else the configured default with {@code tanulo}. Only the requested
 * days are scored by the model; the baseline history is stored-or-rule scored. A calendar with no rows at all in the
 * two weeks before the day is "unknown": the verdict then comes from the body and the sessions alone.
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
    private static final Pattern HEAVY_LABEL = Pattern.compile("leg|láb|lab|lower|alsó|also|squat|guggol");

    private final CapacityCalendarPort calendar;
    private final EventScoringService scoring;
    private final CapacitySleepPort sleep;
    private final CapacityMetricsPort metrics;
    private final CapacityTrainPort train;
    private final CapacityMealPort meal;
    private final CapacityCheckinPort checkin;
    private final CapacityProperties props;
    private final WearableProperties wearable;

    public CapacityDayService(CapacityCalendarPort calendar, EventScoringService scoring, CapacitySleepPort sleep,
                              CapacityMetricsPort metrics, CapacityTrainPort train, CapacityMealPort meal,
                              CapacityCheckinPort checkin, CapacityProperties props, WearableProperties wearable) {
        this.calendar = calendar;
        this.scoring = scoring;
        this.sleep = sleep;
        this.metrics = metrics;
        this.train = train;
        this.meal = meal;
        this.checkin = checkin;
        this.props = props;
        this.wearable = wearable;
    }

    public CapacityDay day(UUID owner, LocalDate date) {
        return build(owner, date, date).get(0);
    }

    /** Seven days, {@code monday} first. */
    public List<CapacityDay> week(UUID owner, LocalDate monday) {
        return build(owner, monday, monday.plusDays(6));
    }

    private List<CapacityDay> build(UUID owner, LocalDate first, LocalDate last) {
        ZoneId zone = ZoneId.of(wearable.zone());
        LocalDate histFrom = first.minusDays(HISTORY_DAYS);

        List<CalendarEventView> events = calendar.events(owner, histFrom, last);
        Map<UUID, EventScore> scores = new HashMap<>(scoring.storedOrRule(owner, histFrom, first.minusDays(1)));
        scores.putAll(scoring.scoresFor(owner, first, last));
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
            k -> demand(eventsByDate.getOrDefault(k, List.of()), scores, sessions.getOrDefault(k, List.of()), k, first,
                zone));

        List<CapacityDay> out = new ArrayList<>();
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
                    fullUnits.add(demandOf.apply(h).units());
                }
                if (f != null && (f.hasClose() || f.hasCheckin())) {
                    labelledDays++;
                }
                if (f != null && f.dayRating() != null && f.dayRating() >= GOOD_RATING) {
                    ratedUnits.add(demandOf.apply(h).units());
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
            out.add(new CapacityDay(d, Verdicts.word(ratio, props), ratio, tanulo, fullDays, labelledDays,
                calendarKnown(events, d), demand, capacity, CapacityReasonFacts.of(demand, capacity, zone)));
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
                e.title() == null ? "" : e.title(), s.kind()));
        }
        for (Session s : sessions) {
            // a past planned session that was never logged did not happen; from the asked day on, the plan counts
            if (!s.done() && date.isBefore(asOf)) {
                continue;
            }
            boolean heavy = s.label() != null && HEAVY_LABEL.matcher(s.label().toLowerCase(Locale.ROOT)).find();
            items.add(DemandCalculator.training(date.atTime(s.start()).atZone(zone).toInstant(), s.durationMin(),
                heavy, null, null, s.label() == null ? s.kind() : s.label()));
        }
        return DemandCalculator.day(items, props, zone);
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
