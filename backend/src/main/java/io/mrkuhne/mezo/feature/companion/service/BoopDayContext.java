package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInSnapshotRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInText;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Boop B3 (mezo-r36n9.13, spec §7.6): today as Boop sees it — one deterministic read of the day, rendered
 * three ways from the SAME {@link DayBlock}: the compact "Ma" block pushed into every Boop-channel chat turn
 * ({@link #render}, target under 1 200 tokens), the "Boop látja" chips ({@link #chips}) and the rule-based ready
 * questions ({@link #questions}, no LLM, max 3). So the strip shows exactly what the model sees.
 *
 * <p>Read-only composition of the leaf features (sleep, wearable day metrics, check-ins + their biomarker
 * snapshots, intention foci, gym/sport schedule, fuel day, calendar, sleep anchor, weight goal) — companion
 * depends on them, never the reverse, and never on {@code feature.boop} (boop → companion exists; the
 * ArchUnit cycle rule). The Boop-only workout time override lives in boop and is therefore NOT applied
 * here: a session shows its planned schedule time.
 *
 * <p>Calendar events carry times and durations only — titles are never read into the block, the chips or
 * the tools (B3; B7 decides). The day is always a date passed in; "now" (what is still ahead today) is the
 * owner's {@link OwnerToday#now()}, never the server's local clock.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class BoopDayContext {

    public static final String HEADER = "[Ma — Boop látja]";
    static final String RULE = """
            [Boop válaszszabály] Te Boop vagy; soha ne nevezd magad Mezónak. Magyarul, a saját hangodon \
            válaszolj. Ha számot használsz, ugyanabban a tagmondatban nevezd meg a forrását is (pl. „az órád \
            szerint a HRV-d 38, a szokott 50", „a reggeli kitöltésed szerint az energiád 6/10"). Ne kérd, hogy \
            elmondja a napját: a fenti blokk a mai napja; ami nincs benne, azt a lekérdező eszközökkel nézd meg.""";

    static final String Q_TIRED = "Miért vagyok fáradtabb, mint tegnap?";
    static final String Q_FOCUS = "Mire figyeljek ma az edzésen?";
    static final String Q_TOMORROW = "Mikor és mit egyek, hogy holnap jól menjen?";
    static final String Q_DEFAULT = "Hogy alakul a napom?";

    private static final int MAX_QUESTIONS = 3;
    private static final int BASELINE_DAYS = 14;
    private static final int MAX_CALENDAR_LINES = 6;
    private static final Locale HU = Locale.of("hu");
    private static final String NO_DATA = ToolText.NO_DATA;

    private final SleepLogRepository sleepLogs;
    private final SleepAnchorPort sleepAnchor;
    private final DailyMetricRepository dailyMetrics;
    private final CheckInRepository checkIns;
    private final CheckInSnapshotRepository checkInSnapshots;
    private final ObjectProvider<IntentionService> intentions;
    private final WorkoutService workoutService;
    private final ExerciseRepository exercises;
    private final GymScheduleService gymSchedule;
    private final SportService sportService;
    private final SportSlotSkipService sportSlotSkips;
    private final FuelDayService fuelDays;
    private final CalendarEventRepository calendarEvents;
    private final GoalRepository goals;
    private final OwnerToday ownerToday;

    // ------------------------------------------------------------------ the block

    /** One night of the sleep log; {@code minutes} from the logged duration, else the stage sum. */
    public record Night(int minutes, String bedtime, String wakeup, Integer deepMin) {}

    /** One check-in of the day with its frozen biomarker line ({@code ""} without a snapshot). */
    public record CheckIn(String slotTime, Integer energy, Integer mood, Integer stress, String snapshot) {}

    /** A planned gym or sport session: {@code label} for the chip ("Röpi"), {@code noun} for prose ("röpi"). */
    public record Session(String label, String noun, LocalTime time, Integer minutes, String detail) {}

    /** A calendar block — times and duration only, never the title. */
    public record CalendarBlock(LocalTime start, LocalTime end, int minutes) {}

    public record WeightGoal(String trajectory, BigDecimal startKg, BigDecimal targetKg, LocalDate targetDate) {}

    /**
     * The day, read once. {@code nowTime} is the owner's local time when {@code date} is the owner's today,
     * else null; {@code upcomingToday} are today's sessions not started yet, {@code calendarRemaining} the
     * timed events not over yet.
     */
    public record DayBlock(LocalDate date, LocalTime nowTime,
                           Night lastNight, Night nightBefore,
                           Integer restingHr, Double restingUsual, Integer hrvMs, Double hrvUsual, Integer steps,
                           List<CheckIn> checkIns, List<String> goals,
                           List<Session> today, List<Session> upcomingToday, List<Session> tomorrow,
                           int mealCount, int kcalEaten, int kcalTarget, int proteinEaten, int proteinTarget,
                           List<CalendarBlock> calendarRemaining, int calendarAllDay,
                           LocalTime bedtimeTarget, WeightGoal weightGoal) {}

    /** One "Boop látja" chip: {@code value} is the headline, {@code sub} the small line (may be null). */
    public record DayChip(String key, String label, String value, String sub) {}

    /** The owner's today, read as of now. */
    public DayBlock assembleToday(UUID owner) {
        return assemble(owner, ownerToday.today(), ownerToday.now());
    }

    public DayBlock assemble(UUID owner, LocalDate date) {
        return assemble(owner, date, ownerToday.now());
    }

    /** {@code now} decides only what is still ahead on {@code date} (sessions, calendar). */
    public DayBlock assemble(UUID owner, LocalDate date, Instant now) {
        ZoneId zone = ownerToday.zone();
        LocalDateTime localNow = LocalDateTime.ofInstant(now, zone);
        LocalTime nowTime = localNow.toLocalDate().equals(date) ? localNow.toLocalTime() : null;
        boolean past = localNow.toLocalDate().isAfter(date);

        Map<LocalDate, SleepLogEntity> nights = sleepLogs
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, date.minusDays(1), date).stream()
            .collect(Collectors.toMap(SleepLogEntity::getDate, Function.identity(), (newer, older) -> newer));

        Map<LocalDate, DailyMetricEntity> metrics = dailyMetrics
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(owner, date.minusDays(BASELINE_DAYS), date).stream()
            .collect(Collectors.toMap(DailyMetricEntity::getDate, Function.identity(), (a, b) -> b));
        DailyMetricEntity todayMetric = metrics.get(date);

        List<Session> today = sessions(owner, date);
        List<Session> upcoming = past ? List.of() : today.stream()
            .filter(s -> s.time() == null || nowTime == null || s.time().isAfter(nowTime))
            .toList();

        FuelDayResponse fuel = fuelDays.getDay(owner, date);
        MacroSet consumed = fuel.getConsumed();
        MacroSet targets = fuel.getTargets();

        List<CalendarEventEntity> events = calendarEvents.findByCreatedByAndDeletedFalseAndDateOrderByStartAt(owner, date);
        List<CalendarBlock> remaining = past ? List.of() : events.stream()
            .filter(e -> !e.isAllDay() && e.getStartAt() != null && e.getEndAt() != null)
            .filter(e -> e.getEndAt().isAfter(now))
            .map(e -> new CalendarBlock(LocalTime.ofInstant(e.getStartAt(), zone), LocalTime.ofInstant(e.getEndAt(), zone),
                (int) Duration.between(e.getStartAt(), e.getEndAt()).toMinutes()))
            .toList();
        int allDay = (int) events.stream().filter(CalendarEventEntity::isAllDay).count();

        return new DayBlock(date, nowTime,
            night(nights.get(date)), night(nights.get(date.minusDays(1))),
            todayMetric == null ? null : todayMetric.getRestingHr(),
            baseline(date, metrics, DailyMetricEntity::getRestingHr),
            todayMetric == null || todayMetric.getHrvMs() == null ? null : round(todayMetric.getHrvMs()),
            baseline(date, metrics, m -> m.getHrvMs() == null ? null : round(m.getHrvMs())),
            todayMetric == null ? null : todayMetric.getSteps(),
            checkIns(owner, date), goals(owner, date),
            today, upcoming, sessions(owner, date.plusDays(1)),
            fuel.getMeals() == null ? 0 : fuel.getMeals().size(),
            toInt(consumed == null ? null : consumed.getKcal()), toInt(targets == null ? null : targets.getKcal()),
            toInt(consumed == null ? null : consumed.getP()), toInt(targets == null ? null : targets.getP()),
            remaining, allDay,
            sleepAnchor.resolve(owner).bed(),
            weightGoal(owner));
    }

    // ------------------------------------------------------------------ render

    /** The "Ma" block, Hungarian, deterministic; every line says "nincs adat" rather than guessing. */
    public String render(DayBlock d) {
        StringBuilder b = new StringBuilder("\n\n").append(HEADER).append(' ').append(d.date())
            .append(" (").append(d.date().getDayOfWeek().getDisplayName(TextStyle.FULL, HU)).append(')');
        if (d.nowTime() != null) {
            b.append(", most ").append(hhmm(d.nowTime()));
        }
        b.append(". Az app mai adatai, friss állapot.\n");

        b.append("Alvás ma éjjel: ");
        if (d.lastNight() == null) {
            b.append(NO_DATA);
        } else {
            b.append(hm(d.lastNight().minutes()));
            if (d.lastNight().bedtime() != null && d.lastNight().wakeup() != null) {
                b.append(" (").append(d.lastNight().bedtime()).append('–').append(d.lastNight().wakeup()).append(')');
            }
            if (d.lastNight().deepMin() != null) {
                b.append(", mély ").append(d.lastNight().deepMin()).append(" perc");
            }
        }
        if (d.nightBefore() != null) {
            b.append("; előző éjjel ").append(hm(d.nightBefore().minutes()));
        }
        b.append(".\n");

        b.append("Óra (14 napos szokotthoz): nyugalmi pulzus ")
            .append(d.restingHr() == null ? NO_DATA : d.restingHr() + usual(d.restingUsual()))
            .append("; HRV ")
            .append(d.hrvMs() == null ? NO_DATA : d.hrvMs() + " ms" + usual(d.hrvUsual()))
            .append(".\n");
        b.append("Lépés ma eddig: ").append(d.steps() == null ? NO_DATA : grouped(d.steps())).append(".\n");

        b.append("Kitöltések ma");
        if (d.checkIns().isEmpty()) {
            b.append(": ma még nincs.\n");
        } else {
            b.append(" (").append(d.checkIns().size()).append(" kitöltés): ")
                .append(d.checkIns().stream().map(BoopDayContext::checkInLine).collect(Collectors.joining("; ")))
                .append(".\n");
        }

        b.append("A nap célja: ").append(d.goals().isEmpty() ? "nincs megadva" : String.join("; ", d.goals())).append(".\n");

        b.append("Edzés ma: ").append(sessionsLine(d.today()))
            .append(". Holnap: ").append(sessionsLine(d.tomorrow())).append(".\n");

        b.append("Étkezés eddig: ").append(d.mealCount()).append(" étkezés, ").append(grouped(d.kcalEaten())).append(" kcal");
        if (d.kcalTarget() > 0) {
            b.append(" (cél ").append(grouped(d.kcalTarget())).append(')');
        }
        b.append(", fehérje ").append(d.proteinEaten()).append(" g");
        if (d.proteinTarget() > 0) {
            b.append(" (cél ").append(d.proteinTarget()).append(')');
        }
        b.append(".\n");

        b.append("Naptár: ").append(calendarHeadline(d));
        if (!d.calendarRemaining().isEmpty()) {
            b.append(", következő ").append(hhmm(d.calendarRemaining().getFirst().start())).append(" — ")
                .append(d.calendarRemaining().stream().limit(MAX_CALENDAR_LINES)
                    .map(c -> hhmm(c.start()) + "–" + hhmm(c.end()) + " (" + c.minutes() + " perc)")
                    .collect(Collectors.joining(", ")));
            int more = d.calendarRemaining().size() - MAX_CALENDAR_LINES;
            if (more > 0) {
                b.append(", +").append(more).append(" további");
            }
        }
        if (d.calendarAllDay() > 0) {
            b.append("; egész napos: ").append(d.calendarAllDay());
        }
        b.append(".\n");

        b.append("Lefekvési cél: ").append(d.bedtimeTarget() == null ? NO_DATA : hhmm(d.bedtimeTarget())).append(".\n");

        b.append("Súlycél: ");
        WeightGoal g = d.weightGoal();
        if (g == null) {
            b.append("nincs aktív");
        } else {
            b.append(trajectory(g.trajectory())).append(", ").append(ToolText.huWeight(g.startKg()));
            if (g.targetKg() != null) {
                b.append(" → ").append(ToolText.huWeight(g.targetKg()));
            }
            b.append(" kg, ").append(g.targetDate()).append("-ig");
        }
        b.append(".\n");
        return b.append(RULE).append('\n').toString();
    }

    // ------------------------------------------------------------------ chips

    /** The "Boop látja" strip, in the spike's order; a chip without data is left out, never zero-filled. */
    public List<DayChip> chips(DayBlock d) {
        List<DayChip> out = new ArrayList<>();
        if (d.lastNight() != null) {
            out.add(new DayChip("sleep", "Alvás", hm(d.lastNight().minutes()),
                d.nightBefore() == null ? null : "előző éjjel " + hm(d.nightBefore().minutes())));
        }
        if (d.hrvMs() != null) {
            out.add(new DayChip("hrv", "HRV", Integer.toString(d.hrvMs()),
                d.hrvUsual() == null ? null : "szokott " + Math.round(d.hrvUsual())));
        }
        if (!d.today().isEmpty()) {
            Session s = d.upcomingToday().isEmpty() ? d.today().getFirst() : d.upcomingToday().getFirst();
            out.add(new DayChip("session", s.label(), s.time() == null ? "ma" : hhmm(s.time()),
                s.minutes() == null ? null : s.minutes() + " perc"));
        }
        if (!d.checkIns().isEmpty()) {
            Integer energy = d.checkIns().getLast().energy();
            out.add(new DayChip("checkins", "Kitöltés", d.checkIns().size() + " kitöltés",
                energy == null ? null : "energia " + energy));
        }
        if (d.mealCount() > 0 || d.kcalTarget() > 0) {
            out.add(new DayChip("fuel", "Étkezés", grouped(d.kcalEaten()) + " kcal",
                d.kcalTarget() > 0 ? "cél " + grouped(d.kcalTarget()) : null));
        }
        if (!d.goals().isEmpty()) {
            out.add(new DayChip("goal", "A nap célja", d.goals().getFirst(), null));
        }
        if (!d.calendarRemaining().isEmpty()) {
            out.add(new DayChip("calendar", "Naptár", calendarHeadline(d),
                "következő " + hhmm(d.calendarRemaining().getFirst().start())));
        }
        return List.copyOf(out);
    }

    // ------------------------------------------------------------------ ready questions

    /**
     * Deterministic templates (spec §7.6): HRV below usual or a shorter night than the one before → why
     * tired; a session still ahead today → food before it + focus; a session tomorrow → timing for
     * tomorrow; nothing of these → how the day goes. Max {@value #MAX_QUESTIONS}, in that priority.
     */
    public List<String> questions(DayBlock d) {
        List<String> out = new ArrayList<>();
        boolean lowHrv = d.hrvMs() != null && d.hrvUsual() != null && d.hrvMs() < d.hrvUsual();
        boolean shorterNight = d.lastNight() != null && d.nightBefore() != null
            && d.lastNight().minutes() < d.nightBefore().minutes();
        if (lowHrv || shorterNight) {
            out.add(Q_TIRED);
        }
        if (!d.upcomingToday().isEmpty()) {
            String noun = d.upcomingToday().getFirst().noun();
            out.add("Mennyit egyek " + article(noun) + " " + noun + " előtt?");
            out.add(Q_FOCUS);
        }
        if (!d.tomorrow().isEmpty()) {
            out.add(Q_TOMORROW);
        }
        if (out.isEmpty()) {
            out.add(Q_DEFAULT);
        }
        return List.copyOf(out.subList(0, Math.min(MAX_QUESTIONS, out.size())));
    }

    // ------------------------------------------------------------------ reads

    private static Night night(SleepLogEntity n) {
        if (n == null) {
            return null;
        }
        int minutes = n.getDurationH() != null
            ? n.getDurationH().multiply(BigDecimal.valueOf(60)).setScale(0, RoundingMode.HALF_UP).intValue()
            : sum(n.getLightMin(), n.getRemMin(), n.getDeepMin());
        return new Night(minutes, n.getBedtime(), n.getWakeup(), n.getDeepMin());
    }

    /** Mean over {@code date-14 … date-1} of the non-null values; null when there are none. */
    private static Double baseline(LocalDate date, Map<LocalDate, DailyMetricEntity> metrics,
                                   Function<DailyMetricEntity, Integer> value) {
        OptionalDouble avg = date.minusDays(BASELINE_DAYS).datesUntil(date)
            .map(metrics::get).filter(Objects::nonNull).map(value).filter(Objects::nonNull)
            .mapToInt(Integer::intValue).average();
        return avg.isPresent() ? avg.getAsDouble() : null;
    }

    /** Today's done check-ins in slot order, each with its snapshot line ({@link CheckInText#snapshotLine}). */
    private List<CheckIn> checkIns(UUID owner, LocalDate date) {
        List<CheckInEntity> rows = checkIns.findByCreatedByAndDateOrderBySlotTime(owner, date).stream()
            .filter(c -> "done".equals(c.getState()))
            .toList();
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, CheckInSnapshotEntity> snaps = checkInSnapshots
            .findByCheckInIdIn(rows.stream().map(CheckInEntity::getId).toList()).stream()
            .collect(Collectors.toMap(CheckInSnapshotEntity::getCheckInId, Function.identity(), (a, b) -> a));
        return rows.stream()
            .map(c -> new CheckIn(c.getSlotTime(), c.getEnergy(), c.getMood(), c.getStress(),
                CheckInText.snapshotLine(snaps.get(c.getId()))))
            .toList();
    }

    private List<String> goals(UUID owner, LocalDate date) {
        IntentionService service = intentions.getIfAvailable();
        if (service == null) {
            return List.of();
        }
        var foci = service.getDay(owner, date).getFoci();
        return foci == null ? List.of() : foci.stream().map(IntentionFocusResponse::getText).toList();
    }

    /** The day's planned gym session (non-empty template day) and unskipped sport slots, by time. */
    private List<Session> sessions(UUID owner, LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        List<Session> out = new ArrayList<>();
        Optional<WorkoutSessionEntity> template = workoutService.findPlannedTemplateForDateUnlessSkipped(owner, date);
        if (template.isPresent()) {
            List<ExerciseEntity> planned = exercises.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                owner, List.of(template.get().getId()));
            if (!planned.isEmpty()) { // an empty template day is a rest day (ToolText.gymLine's criterion)
                LocalTime time = gymSchedule.getSchedule(owner).stream()
                    .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == dow && s.getTime() != null)
                    .map(s -> LocalTime.parse(s.getTime()))
                    .sorted().findFirst().orElse(null);
                out.add(new Session("Edzés", "edzés", time, template.get().getDurationEst(),
                    template.get().getDayLabel()));
            }
        }
        for (SportScheduleSlotResponse s : sportService.getSchedule(owner)) {
            if (s.getDayOfWeek() == null || s.getDayOfWeek() != dow
                || sportSlotSkips.isSkipped(owner, dow, s.getTime(), date)) {
                continue;
            }
            String label = sportLabel(s.getSport(), s.getKind() == null ? null : s.getKind().getValue());
            out.add(new Session(label, noun(label), s.getTime() == null ? null : LocalTime.parse(s.getTime()),
                s.getDurationMin(), null));
        }
        out.sort(Comparator.comparing(Session::time, Comparator.nullsLast(Comparator.naturalOrder())));
        return List.copyOf(out);
    }

    private WeightGoal weightGoal(UUID owner) {
        return goals.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream().findFirst()
            .map(g -> new WeightGoal(g.getTrajectory(), g.getStartWeightKg(), g.getTargetWeightKg(), g.getTargetDate()))
            .orElse(null);
    }

    // ------------------------------------------------------------------ text helpers

    private static String checkInLine(CheckIn c) {
        List<String> parts = new ArrayList<>();
        if (c.energy() != null) {
            parts.add("energia " + c.energy() + "/10");
        }
        if (c.mood() != null) {
            parts.add("hangulat " + c.mood() + "/10");
        }
        if (c.stress() != null) {
            parts.add("stressz " + c.stress() + "/10");
        }
        String line = c.slotTime() + " — " + (parts.isEmpty() ? NO_DATA : String.join(", ", parts));
        return c.snapshot().isEmpty() ? line : line + " · óra akkor: " + c.snapshot();
    }

    private static String sessionsLine(List<Session> sessions) {
        if (sessions.isEmpty()) {
            return "pihenőnap";
        }
        return sessions.stream().map(s -> {
            StringBuilder b = new StringBuilder(s.label());
            if (s.detail() != null && !s.detail().isBlank()) {
                b.append(" (").append(s.detail()).append(')');
            }
            if (s.time() != null) {
                b.append(' ').append(hhmm(s.time()));
            }
            if (s.minutes() != null) {
                b.append(", ").append(s.minutes()).append(" perc");
            }
            return b.toString();
        }).collect(Collectors.joining("; "));
    }

    private static String calendarHeadline(DayBlock d) {
        return d.calendarRemaining().isEmpty() ? "ma már nincs több esemény"
            : "még " + d.calendarRemaining().size() + " esemény";
    }

    /** volleyball → "Röpi" / "Röpimeccs"; cross / trx → "Cross edzés" / "TRX meccs". */
    private static String sportLabel(String sport, String kind) {
        boolean match = "match".equals(kind);
        return switch (sport == null ? "" : sport) {
            case "volleyball" -> match ? "Röpimeccs" : "Röpi";
            case "cross" -> match ? "Cross meccs" : "Cross edzés";
            case "trx" -> match ? "TRX meccs" : "TRX edzés";
            default -> match ? "Meccs" : "Sport";
        };
    }

    /** The label as a noun inside a sentence: "Röpi" → "röpi", an acronym stays ("TRX edzés"). */
    private static String noun(String label) {
        return label.length() > 1 && Character.isLowerCase(label.charAt(1))
            ? Character.toLowerCase(label.charAt(0)) + label.substring(1) : label;
    }

    /** Hungarian definite article: "az" before a vowel, else "a". */
    private static String article(String noun) {
        return !noun.isEmpty() && "aáeéiíoóöőuúüű".indexOf(Character.toLowerCase(noun.charAt(0))) >= 0 ? "az" : "a";
    }

    private static String trajectory(String trajectory) {
        return switch (trajectory == null ? "" : trajectory) {
            case "cut" -> "fogyás";
            case "bulk" -> "tömegelés";
            case "maintain" -> "súlytartás";
            default -> trajectory;
        };
    }

    private static String usual(Double usual) {
        return usual == null ? "" : " (szokott " + Math.round(usual) + ")";
    }

    /** 370 → "6ó 10p"; 420 → "7ó"; 45 → "45p". */
    static String hm(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        if (h == 0) {
            return m + "p";
        }
        return m == 0 ? h + "ó" : h + "ó " + m + "p";
    }

    private static String hhmm(LocalTime t) {
        return String.format("%02d:%02d", t.getHour(), t.getMinute());
    }

    /** Hungarian digit grouping with a plain space: 2450 → "2 450". */
    static String grouped(int value) {
        String digits = Integer.toString(Math.abs(value));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                out.append(' ');
            }
            out.append(digits.charAt(i));
        }
        return (value < 0 ? "-" : "") + out;
    }

    private static Integer round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private static int toInt(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private static int sum(Integer... values) {
        int s = 0;
        for (Integer v : values) {
            s += v == null ? 0 : v;
        }
        return s;
    }
}
