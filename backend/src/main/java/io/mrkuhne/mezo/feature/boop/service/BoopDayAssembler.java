package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendPoint;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.CheckInPlanProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepTargetPort;
import io.mrkuhne.mezo.feature.boop.repository.WorkoutTimeOverrideRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.entity.WearableWorkoutEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Gathers one local day for the Boop morning brief (Boop S3, mezo-r36n9.7) from the features that
 * already own the data. READ-ONLY by contract: no {@code @Transactional} here (the read-path
 * isolation rule), and it never calls {@link WorkoutService#getToday} — that one writes (closes
 * stale instances); the planned session is resolved through
 * {@link WorkoutService#findPlannedTemplateForDateUnlessSkipped}, as the context snapshot does.
 *
 * <p>The day is always the client's LOCAL date passed in — never {@code LocalDate.now()}: a brief
 * asked for at 00:30 Budapest must describe the new day although the server's UTC clock still
 * shows the old one. Instants (calendar, meals) are converted with {@code mezo.wearable.zone}.
 *
 * <p>Feature-switched beans (intention, companion patterns) are optional: without them the day
 * carries an empty intention / no observations instead of failing.
 */
@Service
@RequiredArgsConstructor
public class BoopDayAssembler {

    private static final int WEEK = 7;
    private static final int BASELINE_DAYS = 14;
    private static final int NIGHTS_WINDOW_DAYS = 60;
    private static final int MAX_OBSERVATIONS = 3;
    private static final List<String> SLOT_NAMES = List.of("morning", "midday", "afternoon", "evening");

    private final SleepLogRepository sleepLogs;
    private final SleepAnchorPort sleepAnchor;
    private final SleepTargetPort sleepTarget;
    private final DailyMetricRepository dailyMetrics;
    private final WearableWorkoutRepository wearableWorkouts;
    private final CalendarEventRepository calendarEvents;
    private final WearableProperties wearableProperties;
    private final WorkoutService workoutService;
    private final ExerciseRepository exercises;
    private final WorkoutDayAdjustmentRepository dayAdjustments;
    private final GymScheduleService gymSchedule;
    private final WorkoutTimeOverrideRepository timeOverrides;
    private final FuelDayService fuelDays;
    private final CheckInPlanProperties checkInPlan;
    private final CheckInService checkIns;
    private final ObjectProvider<IntentionService> intentions;
    private final ObjectProvider<PatternService> patternService;
    private final PatternRepository patterns;
    private final RecoveryPeriodService recoveryPeriods;
    private final WeightTrendQuery weightTrend;

    public BoopDay assemble(UUID user, LocalDate date) {
        ZoneId zone = ZoneId.of(wearableProperties.zone());

        // --- sleep: one read covers last night, the 7-day series, the baseline and the count
        List<SleepLogEntity> nights = sleepLogs.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
            user, date.minusDays(NIGHTS_WINDOW_DAYS - 1L), date);
        Map<LocalDate, SleepLogEntity> nightByDate = nights.stream()
            .collect(Collectors.toMap(SleepLogEntity::getDate, Function.identity(), (newer, older) -> newer));
        BoopDay.Sleep sleep = Optional.ofNullable(nightByDate.get(date)).map(BoopDayAssembler::sleep).orElse(null);
        List<Integer> deepWeek = week(date, d -> Optional.ofNullable(nightByDate.get(d))
            .map(SleepLogEntity::getDeepMin).orElse(null));
        Double baselineDeep = baseline(date, d -> Optional.ofNullable(nightByDate.get(d))
            .map(SleepLogEntity::getDeepMin).orElse(null));
        int sleepTargetMin = sleepTarget.targetHours(user).multiply(BigDecimal.valueOf(60))
            .setScale(0, RoundingMode.HALF_UP).intValue();

        // --- wearable day metrics: today, the 7-day resting-HR series and the 14-day baseline
        Map<LocalDate, DailyMetricEntity> metricByDate = dailyMetrics
            .findByCreatedByAndDateBetweenOrderByDate(user, date.minusDays(BASELINE_DAYS), date).stream()
            .collect(Collectors.toMap(DailyMetricEntity::getDate, Function.identity(), (a, b) -> b));
        DailyMetricEntity today = metricByDate.get(date);
        List<Integer> restingWeek = week(date, d -> Optional.ofNullable(metricByDate.get(d))
            .map(DailyMetricEntity::getRestingHr).orElse(null));
        Double baselineResting = baseline(date, d -> Optional.ofNullable(metricByDate.get(d))
            .map(DailyMetricEntity::getRestingHr).orElse(null));

        FuelDayResponse fuel = fuelDays.getDay(user, date);
        MacroSet consumed = fuel.getConsumed();
        MacroSet targets = fuel.getTargets();

        return new BoopDay(
            date,
            sleep,
            sleepTargetMin,
            sleepAnchor.resolve(user).bed(),
            nights.size(),
            deepWeek,
            restingWeek,
            baselineResting,
            baselineDeep,
            today == null ? null : today.getRestingHr(),
            today == null ? null : new BoopDay.HrToday(today.getMinHr(), today.getAvgHr(), today.getMaxHr()),
            today == null ? null : today.getSteps(),
            today == null ? null : today.getActiveKcal(),
            session(user, date),
            yesterdayLoad(user, date),
            meals(fuel, zone),
            toInt(consumed == null ? null : consumed.getKcal()),
            toInt(targets == null ? null : targets.getKcal()),
            toInt(consumed == null ? null : consumed.getP()),
            toInt(targets == null ? null : targets.getP()),
            toInt(consumed == null ? null : consumed.getC()),
            toInt(consumed == null ? null : consumed.getF()),
            checkins(user, date),
            intention(user, date),
            observations(user),
            calendar(user, date, zone),
            weight(user, date),
            recovery(user, date));
    }

    // ------------------------------------------------------------------ sleep

    private static BoopDay.Sleep sleep(SleepLogEntity n) {
        int total = n.getDurationH() != null
            ? n.getDurationH().multiply(BigDecimal.valueOf(60)).setScale(0, RoundingMode.HALF_UP).intValue()
            : sumOrZero(n.getLightMin(), n.getRemMin(), n.getDeepMin());
        return new BoopDay.Sleep(n.getId(), n.getBedtime(), n.getWakeup(), total, n.getDeepMin(), n.getRemMin(),
            n.getLightMin(), n.getAwakeMin(), n.getQuality(), hypnogram(n.getHypnogram()));
    }

    /** Runs of equal stage letters → segments (0 awake, 1 REM, 2 light, 3 deep), minutes = bucket × run. */
    static List<BoopDay.Segment> hypnogram(SleepHypnogram h) {
        if (h == null || h.stages() == null || h.stages().isEmpty() || h.bucketMin() == null) {
            return List.of();
        }
        List<BoopDay.Segment> out = new ArrayList<>();
        String s = h.stages();
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            int j = i;
            while (j < s.length() && s.charAt(j) == c) {
                j++;
            }
            int stage = switch (c) {
                case 'A' -> 0;
                case 'R' -> 1;
                case 'L' -> 2;
                case 'D' -> 3;
                default -> -1;
            };
            if (stage >= 0) {
                out.add(new BoopDay.Segment(stage, (j - i) * h.bucketMin()));
            }
            i = j;
        }
        return List.copyOf(out);
    }

    // ------------------------------------------------------------------ series helpers

    /** {@code date-6 … date}, oldest first; nulls kept (an unmodifiable list may not hold null). */
    private static List<Integer> week(LocalDate date, Function<LocalDate, Integer> value) {
        Integer[] out = new Integer[WEEK];
        for (int i = 0; i < WEEK; i++) {
            out[i] = value.apply(date.minusDays(WEEK - 1L - i));
        }
        return Arrays.asList(out);
    }

    /** Mean over {@code date-14 … date-1} of the non-null values; null when there are none. */
    private static Double baseline(LocalDate date, Function<LocalDate, Integer> value) {
        OptionalDouble avg = date.minusDays(BASELINE_DAYS).datesUntil(date)
            .map(value).filter(Objects::nonNull).mapToInt(Integer::intValue).average();
        return avg.isPresent() ? avg.getAsDouble() : null;
    }

    // ------------------------------------------------------------------ training

    /** The planned session of the day (override applied); null on a rest day. Also the 404 check of
     *  {@link SessionTimeService}. */
    BoopDay.Session session(UUID user, LocalDate date) {
        Optional<WorkoutSessionEntity> template = workoutService.findPlannedTemplateForDateUnlessSkipped(user, date);
        if (template.isEmpty()) {
            return null;
        }
        List<ExerciseEntity> planned = exercises.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
            user, List.of(template.get().getId()));
        if (planned.isEmpty()) {
            return null; // an empty template day is a rest day (ToolText.gymLine's criterion)
        }
        // Same per-date lighten overlay and floor as WorkoutService.getToday / the context snapshot.
        int delta = dayAdjustments.findByCreatedByAndDateAndDeletedFalse(user, date)
            .map(a -> (int) a.getSetDelta()).orElse(0);
        List<BoopDay.Exercise> lines = planned.stream()
            .map(e -> new BoopDay.Exercise(e.getName(),
                Math.max(1, (e.getWorkingSets() == null ? 0 : e.getWorkingSets()) + delta)))
            .toList();
        int dow = date.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        LocalTime plannedTime = gymSchedule.getSchedule(user).stream()
            .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == dow && s.getTime() != null)
            .map(s -> LocalTime.parse(s.getTime()))
            .sorted()
            .findFirst().orElse(null);
        LocalTime time = timeOverrides.findByCreatedByAndDate(user, date)
            .map(o -> o.getTime()).orElse(plannedTime);
        return new BoopDay.Session(template.get().getType(), time, plannedTime,
            template.get().getDurationEst(), lines);
    }

    private BoopDay.WorkoutLoad yesterdayLoad(UUID user, LocalDate date) {
        LocalDate yesterday = date.minusDays(1);
        int minutes = 0;
        int kcal = 0;
        for (WearableWorkoutEntity w : wearableWorkouts.findByCreatedByAndDateBetweenOrderByDate(
                user, yesterday, yesterday)) {
            if (w.getStartAt() != null && w.getEndAt() != null && w.getEndAt().isAfter(w.getStartAt())) {
                minutes += (int) Duration.between(w.getStartAt(), w.getEndAt()).toMinutes();
            }
            kcal += w.getKcal() == null ? 0 : w.getKcal();
        }
        return new BoopDay.WorkoutLoad(minutes, kcal);
    }

    // ------------------------------------------------------------------ fuel

    private static List<BoopDay.Meal> meals(FuelDayResponse fuel, ZoneId zone) {
        if (fuel.getMeals() == null) {
            return List.of();
        }
        return fuel.getMeals().stream().map(m -> meal(m, zone)).toList();
    }

    private static BoopDay.Meal meal(MealResponse m, ZoneId zone) {
        LocalTime time = m.getLoggedAt() == null ? null
            : m.getLoggedAt().atZoneSameInstant(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
        String title = m.getTitle() == null || m.getTitle().isBlank() ? m.getSlot() : m.getTitle();
        return new BoopDay.Meal(time, title, m.getSlot(),
            toInt(m.getMacros() == null ? null : m.getMacros().getKcal()),
            toInt(m.getMacros() == null ? null : m.getMacros().getP()),
            true);
    }

    // ------------------------------------------------------------------ check-ins, intention, observations

    /** The configured slot times in clock order, mapped to morning/midday/afternoon/evening. */
    private List<BoopDay.Checkin> checkins(UUID user, LocalDate date) {
        Map<String, CheckInResponse> bySlot = checkIns.listForDay(user, date).stream()
            .collect(Collectors.toMap(CheckInResponse::getSlotTime, Function.identity(), (a, b) -> b));
        List<String> times = checkInPlan.slots().keySet().stream().sorted().toList();
        List<BoopDay.Checkin> out = new ArrayList<>();
        for (int i = 0; i < times.size() && i < SLOT_NAMES.size(); i++) {
            CheckInResponse row = bySlot.get(times.get(i));
            boolean done = row != null && "done".equals(row.getState());
            out.add(new BoopDay.Checkin(SLOT_NAMES.get(i), LocalTime.parse(times.get(i)), done,
                done ? summary(row) : null));
        }
        return List.copyOf(out);
    }

    private static String summary(CheckInResponse row) {
        List<String> parts = new ArrayList<>();
        if (row.getEnergy() != null) {
            parts.add("energia " + row.getEnergy());
        }
        if (row.getMood() != null) {
            parts.add("hangulat " + row.getMood());
        }
        if (row.getStress() != null) {
            parts.add("stressz " + row.getStress());
        }
        return parts.isEmpty() ? null : String.join(" · ", parts);
    }

    private BoopDay.Intention intention(UUID user, LocalDate date) {
        IntentionService service = intentions.getIfAvailable();
        if (service == null) {
            return new BoopDay.Intention(null, List.of());
        }
        IntentionDayResponse day = service.getDay(user, date);
        List<String> foci = day.getFoci() == null ? List.of()
            : day.getFoci().stream().map(IntentionFocusResponse::getText).toList();
        return new BoopDay.Intention(day.getCreed(), foci);
    }

    /**
     * Patterns still {@code proposed} — the ones the owner has not decided on yet, all accepted by
     * {@code decidePattern} — newest detection first. Only while the companion (which owns that
     * endpoint) is on. lead = the pattern's title; it has no separate key clause, so bold and tail
     * stay empty. strength = belief, else confidence, else |r|, scaled to 0..5.
     */
    private List<BoopDay.Observation> observations(UUID user) {
        if (patternService.getIfAvailable() == null) {
            return List.of();
        }
        return patterns.findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                user, PatternEntity.STATUS_PROPOSED).stream()
            .limit(MAX_OBSERVATIONS)
            .map(p -> new BoopDay.Observation(p.getId().toString(), p.getTitle(), "", "", strength(p)))
            .toList();
    }

    private static int strength(PatternEntity p) {
        BigDecimal signal = p.getBelief() != null ? p.getBelief()
            : p.getConfidence() != null ? p.getConfidence()
            : p.getR() != null ? p.getR().abs() : null;
        if (signal == null) {
            return 0;
        }
        return Math.clamp(Math.round(signal.doubleValue() * 5), 0, 5);
    }

    // ------------------------------------------------------------------ calendar

    private BoopDay.Calendar calendar(UUID user, LocalDate date, ZoneId zone) {
        List<CalendarEventEntity> events = calendarEvents.findByCreatedByAndDateOrderByStartAt(user, date);
        boolean[] busy = new boolean[BoopDay.BUSY_SLOTS];
        LocalDateTime windowStart = date.atTime(BoopDay.BUSY_FROM);
        List<BoopDay.CalendarItem> items = new ArrayList<>();
        for (CalendarEventEntity e : events) {
            if (e.isAllDay() || e.getStartAt() == null || e.getEndAt() == null) {
                items.add(new BoopDay.CalendarItem(e.getTitle(), null, null, true));
                continue;
            }
            LocalDateTime start = LocalDateTime.ofInstant(e.getStartAt(), zone);
            LocalDateTime end = LocalDateTime.ofInstant(e.getEndAt(), zone);
            items.add(new BoopDay.CalendarItem(e.getTitle(), start.toLocalTime(), end.toLocalTime(), false));
            for (int i = 0; i < BoopDay.BUSY_SLOTS; i++) {
                LocalDateTime slotStart = windowStart.plusMinutes((long) i * BoopDay.SLOT_MINUTES);
                LocalDateTime slotEnd = slotStart.plusMinutes(BoopDay.SLOT_MINUTES);
                if (start.isBefore(slotEnd) && end.isAfter(slotStart)) {
                    busy[i] = true;
                }
            }
        }
        List<Boolean> flags = new ArrayList<>(BoopDay.BUSY_SLOTS);
        for (boolean b : busy) {
            flags.add(b);
        }
        return new BoopDay.Calendar(events.size(), List.copyOf(flags), List.copyOf(items));
    }

    // ------------------------------------------------------------------ weight, recovery

    /** The latest weigh-in on/before {@code date} and the EWMA at that point (causal, so later
     *  weigh-ins do not move it); null without one. */
    private BoopDay.Weight weight(UUID user, LocalDate date) {
        var trend = weightTrend.computeTrend(user);
        if (trend.getEwmaSeries() == null) {
            return null;
        }
        WeightTrendPoint point = trend.getEwmaSeries().stream()
            .filter(p -> p.getDate() != null && !p.getDate().isAfter(date))
            .reduce((a, b) -> b).orElse(null);
        if (point == null || point.getTrendKg() == null) {
            return null;
        }
        BigDecimal kg = weightTrend.dailyMeanWeightKg(user, point.getDate(), point.getDate()).get(point.getDate());
        if (kg == null) {
            return null;
        }
        return new BoopDay.Weight(kg.doubleValue(), point.getTrendKg().doubleValue());
    }

    /** The kímélő period protecting {@code date} (released days excluded), as label + day index. */
    private BoopDay.Recovery recovery(UUID user, LocalDate date) {
        RecoveryPeriodEntity period = recoveryPeriods.protectedDays(user, date, date).get(date);
        if (period == null) {
            return null;
        }
        int day = (int) ChronoUnit.DAYS.between(period.getStartDate(), date) + 1;
        return new BoopDay.Recovery(reasonLabel(period.getCategory()), day);
    }

    /** Same labels as the companion snapshot's kímélő line. */
    private static String reasonLabel(PlannedSkipEntity.Reason category) {
        return switch (category) {
            case ILLNESS -> "Beteg";
            case STOMACH -> "Gyomorrontás";
            case INJURY -> "Sérülés";
            case TRAVEL -> "Úton";
            default -> "Pihenés";
        };
    }

    // ------------------------------------------------------------------ numbers

    private static int toInt(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private static int sumOrZero(Integer... values) {
        int sum = 0;
        for (Integer v : values) {
            sum += v == null ? 0 : v;
        }
        return sum;
    }
}
