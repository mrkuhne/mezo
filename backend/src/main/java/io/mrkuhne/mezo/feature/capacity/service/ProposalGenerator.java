package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.CalendarTodo;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveMealEnergy;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftSessionTime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.DemandItem;
import io.mrkuhne.mezo.feature.capacity.service.DraftWeek.DayLoad;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import io.mrkuhne.mezo.feature.season.service.SleepNeedRule;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The deterministic proposal generator (Boop B7 K3, mezo-r36n9.17, spec §5.5) — pure: a {@link WeekPicture} in, at
 * most {@code mezo.capacity.proposals.max-per-week} drafts out, ranked by expected relief. It only ever looks at days
 * that are {@code szoros} or {@code túl sok}, and it only proposes kinds every reader honours (never
 * {@code SWAP_SESSION_KIND} or {@code LIGHTEN_SESSION}: neither changes the load model's demand, so neither relieves a
 * day). Every draft passes {@link AdjustmentRules} — the accept would never refuse it.
 *
 * <ul>
 *   <li>{@code MOVE_SESSION_DAY}: the session goes to the lightest empty day of the same week whose verdict stays
 *       {@code laza}/{@code rendben} after it, never next to a heavy session of the same region; a target that keeps
 *       at least one rest day before every sport slot wins when there is one.</li>
 *   <li>No such day (or a kímélő week, which never adds load anywhere): {@code SHORTEN_SESSION} to two thirds; on a
 *       {@code túl sok} day that shortening cannot bring under it, {@code SKIP_SESSION}.</li>
 *   <li>{@code SHIFT_BEDTIME} + linked {@code SHIFT_SESSION_TIME}: an event ends after 21:00 and a session starts before
 *       08:00 the next day — bed {@value #WIND_DOWN_MIN} minutes after the event, the session after a full need of
 *       sleep and {@value #READY_MIN} minutes to get going.</li>
 *   <li>{@code MOVE_MEAL_ENERGY} (+200 lunch / −200 dinner, the day total unchanged) on a {@code túl sok} day with an
 *       afternoon block of back-to-back meetings.</li>
 *   <li>{@code CALENDAR_TODO}: a meeting of at most 60 minutes ending right before a session → an hour earlier, when
 *       that hour is free.</li>
 * </ul>
 */
public final class ProposalGenerator {

    static final int WIND_DOWN_MIN = 90;
    static final int READY_MIN = 30;
    static final LocalTime LATE_EVENT_END = LocalTime.of(21, 0);
    static final LocalTime EARLY_SESSION = LocalTime.of(8, 0);
    static final int MEAL_SHIFT_KCAL = 200;
    static final LocalTime AFTERNOON_FROM = LocalTime.NOON;
    static final LocalTime AFTERNOON_TO = LocalTime.of(18, 0);
    static final int TODO_MAX_MEETING_MIN = 60;
    static final int TODO_IMMEDIATE_GAP_MIN = 30;
    static final int TODO_SHIFT_MIN = 60;
    static final LocalTime TODO_EARLIEST = LocalTime.of(8, 0);
    static final double SHORTEN_SHARE = 2.0 / 3.0;
    static final int MIN_SESSION_MIN = 10;
    static final int MAX_SESSION_MIN = 240;

    private ProposalGenerator() {
    }

    /**
     * A learned pattern of his weeks ({@code capacity_pattern}); a pattern whose payload names the draft's weekday
     * ({@code "weekday": "THURSDAY"}) and, optionally, its kind ({@code "kind": "MOVE_SESSION_DAY"}) lifts the draft's
     * rank by its consistency and lends its {@code line} to "Miért javaslom".
     */
    public record Pattern(String key, int evidence, int consistent, Map<String, Object> payload) {
    }

    public static List<ProposalDraft> forWeek(WeekPicture w, List<Pattern> patterns, CapacityProperties p) {
        List<ProposalDraft> out = new ArrayList<>();
        // the heaviest day picks its move target first; no two moves land on the same day
        Set<LocalDate> targets = new HashSet<>();
        List<CapacityDay> worstFirst = w.days().stream()
            .sorted(Comparator.comparingDouble(CapacityDay::ratio).reversed()).toList();
        for (CapacityDay day : worstFirst) {
            if (!tight(day) || !w.open(day.date())) {
                continue;
            }
            for (PlannedSession s : w.sessionsOn(day.date())) {
                if (!s.done() && !s.running()) {
                    session(w, day, s, p, targets).ifPresent(out::add);
                }
            }
            meal(w, day, p).ifPresent(out::add);
            out.addAll(calendarTodos(w, day, p));
        }
        out.addAll(bedtimes(w, p));

        List<ProposalDraft> valid = new ArrayList<>();
        for (ProposalDraft d : out) {
            if (!passesRules(w, d) || (w.recovery() && addsLoad(w, d, p))) {
                continue;
            }
            valid.add(withPatterns(d, patterns));
        }
        // Drafts that would cancel each other out (a move of Thursday's session and a later start of it, or a
        // to-do before it) never stand side by side: one per session, one per set of touched days, the higher relief.
        List<ProposalDraft> kept = new ArrayList<>();
        Set<LocalDate> sessionDays = new HashSet<>();
        Set<List<LocalDate>> touched = new HashSet<>();
        for (ProposalDraft d : valid.stream()
                .sorted(Comparator.comparingDouble(ProposalDraft::relief).reversed()).toList()) {
            Optional<LocalDate> session = sessionDay(d);
            if (session.isPresent() && sessionDays.contains(session.get()) || touched.contains(d.touchedDays())) {
                continue;
            }
            session.ifPresent(sessionDays::add);
            touched.add(d.touchedDays());
            kept.add(d);
        }
        return kept.stream().limit(p.proposals().maxPerWeek()).toList();
    }

    /** The day of the gym session a draft is about (empty for a meal move, which concerns no session). */
    static Optional<LocalDate> sessionDay(ProposalDraft d) {
        Object day = switch (d.kind()) {
            case "MOVE_SESSION_DAY", "SHORTEN_SESSION", "SKIP_SESSION" -> d.facts().get("fromDate");
            case "SHIFT_BEDTIME" -> d.facts().get("nextDate");
            case "CALENDAR_TODO" -> d.facts().get("date");
            default -> null;
        };
        return day == null ? Optional.empty() : Optional.of(LocalDate.parse(day.toString()));
    }

    // ── sessions: move, else shorten, else skip ──────────────────────────────

    private static Optional<ProposalDraft> session(WeekPicture w, CapacityDay day, PlannedSession s,
                                                   CapacityProperties p, Set<LocalDate> targets) {
        if (!w.recovery() && s.templateId() != null) {
            Optional<Target> move = move(w, day, s, p, targets);
            if (move.isPresent()) {
                targets.add(move.get().date());
                return Optional.of(move.get().draft());
            }
        }
        // clamped to the payload's 10–240 bound, so a very long session can never make the week read fail
        int shorter = Math.min(MAX_SESSION_MIN, Math.round((float) (s.minutes() * SHORTEN_SHARE / 5)) * 5);
        if (shorter >= MIN_SESSION_MIN && shorter < s.minutes()) {
            List<AdjustmentDraft> shorten = List.of(AdjustmentDraft.of(new ShortenSession(day.date(), shorter)));
            DraftWeek.Result r = DraftWeek.apply(w, shorten, p);
            boolean stillOver = r.day(day.date()).map(l -> "túl sok".equals(l.verdictAfter())).orElse(false);
            if (!stillOver || !w.plan().rawGymDays().contains(day.date())) {
                return Optional.of(new ProposalDraft(AdjustmentKind.SHORTEN_SESSION.name(), shorten,
                    sessionFacts(s, day, Map.of("minutesAfter", shorter)), relief(r, p)));
            }
        }
        if (w.plan().rawGymDays().contains(day.date())) {
            List<AdjustmentDraft> skip = List.of(AdjustmentDraft.of(new SkipSession(day.date(), null)));
            return Optional.of(new ProposalDraft(AdjustmentKind.SKIP_SESSION.name(), skip,
                sessionFacts(s, day, Map.of()), relief(DraftWeek.apply(w, skip, p), p)));
        }
        return Optional.empty();
    }

    private record Target(LocalDate date, ProposalDraft draft, boolean keepsRest, double ratioBefore) {
    }

    private static Optional<Target> move(WeekPicture w, CapacityDay day, PlannedSession s, CapacityProperties p,
                                         Set<LocalDate> taken) {
        List<Target> targets = new ArrayList<>();
        for (CapacityDay t : w.days()) {
            LocalDate to = t.date();
            if (to.equals(day.date()) || !w.open(to) || !w.sessionsOn(to).isEmpty() || taken.contains(to)) {
                continue;
            }
            if (s.heavy() && heavyNeighbour(w, to, s)) {
                continue;
            }
            if (collides(w, to, s)) {
                continue; // the session keeps its clock time: that hour (± getting ready) must be free there
            }
            List<AdjustmentDraft> bundle =
                List.of(AdjustmentDraft.of(new MoveSessionDay(s.templateId(), day.date(), to)));
            if (!passesRules(w, bundle)) {
                continue; // e.g. the day is already a live move's target: try the next day, never a refused draft
            }
            DraftWeek.Result r = DraftWeek.apply(w, bundle, p);
            Optional<DayLoad> target = r.day(to);
            if (target.isEmpty() || !light(target.get().verdictAfter())) {
                continue;
            }
            boolean keepsRest = r.rest().stream().noneMatch(x -> x.after() == 0);
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("toDate", to.toString());
            extra.put("toEmptyCalendar", w.events().stream().noneMatch(e -> e.date().equals(to) && !e.allDay()));
            extra.put("toPrevLate", w.monday().isBefore(to) && lateEvent(w, to.minusDays(1)).isPresent());
            targets.add(new Target(to, new ProposalDraft(AdjustmentKind.MOVE_SESSION_DAY.name(), bundle,
                sessionFacts(s, day, extra), relief(r, p)), keepsRest, t.ratio()));
        }
        return targets.stream()
            .sorted(Comparator.comparing((Target t) -> !t.keepsRest())
                .thenComparingDouble(Target::ratioBefore)
                .thenComparing(Target::date))
            .findFirst();
    }

    /**
     * On {@code to}, a timed calendar event or a sport slot overlaps the session's window widened by the
     * {@value #READY_MIN} minutes of getting ready on both sides.
     */
    private static boolean collides(WeekPicture w, LocalDate to, PlannedSession s) {
        LocalDateTime from = to.atTime(s.start()).minusMinutes(READY_MIN);
        LocalDateTime until = to.atTime(s.start()).plusMinutes(s.minutes() + READY_MIN);
        Instant a = from.atZone(w.zone()).toInstant();
        Instant b = until.atZone(w.zone()).toInstant();
        boolean event = w.events().stream()
            .filter(e -> !e.allDay() && e.start() != null && e.end() != null)
            .anyMatch(e -> e.start().isBefore(b) && e.end().isAfter(a));
        boolean sport = w.sport().stream()
            .filter(x -> x.date().equals(to))
            .anyMatch(x -> {
                LocalDateTime xs = to.atTime(x.start());
                return xs.isBefore(until) && xs.plusMinutes(x.minutes()).isAfter(from);
            });
        return event || sport;
    }

    /** A heavy session of the same region (the load model knows one: heavy lower body) the day before or after. */
    private static boolean heavyNeighbour(WeekPicture w, LocalDate to, PlannedSession moving) {
        for (LocalDate n : List.of(to.minusDays(1), to.plusDays(1))) {
            if (w.sessionsOn(n).stream().anyMatch(o -> o != moving && o.heavy())) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> sessionFacts(PlannedSession s, CapacityDay day, Map<String, Object> extra) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("fromDate", day.date().toString());
        f.put("reason", day.reasonFacts());
        f.put("sessionLabel", s.label());
        f.put("sessionTime", HuDays.time(s.start()));
        f.put("minutes", s.minutes());
        f.put("heavy", s.heavy());
        f.putAll(extra);
        return f;
    }

    // ── a late evening and an early session: later bed + the morning session later ─

    private static List<ProposalDraft> bedtimes(WeekPicture w, CapacityProperties p) {
        List<ProposalDraft> out = new ArrayList<>();
        for (LocalDate night = w.monday(); night.isBefore(w.sunday()); night = night.plusDays(1)) {
            LocalDate next = night.plusDays(1);
            if (!w.open(night) || !w.open(next) || !(tight(w, night) || tight(w, next))) {
                continue;
            }
            Optional<CalendarEventView> late = lateEvent(w, night);
            Optional<PlannedSession> early = w.sessionsOn(next).stream()
                .filter(s -> !s.done() && !s.running() && s.start().isBefore(EARLY_SESSION))
                .min(Comparator.comparing(PlannedSession::start));
            LocalTime usual = w.sleep().bedtimes().get(night);
            if (late.isEmpty() || early.isEmpty() || usual == null) {
                continue;
            }
            LocalDateTime lateEnd = LocalDateTime.ofInstant(late.get().end(), w.zone());
            LocalDateTime bedNow = night.atTime(usual).plusDays(usual.isBefore(LocalTime.NOON) ? 1 : 0);
            LocalDateTime bed = roundUp15(lateEnd.plusMinutes(WIND_DOWN_MIN));
            if (!bed.isAfter(bedNow)) {
                continue;
            }
            LocalDateTime start = roundUp15(bed.plusMinutes(SleepNeedRule.FALL_ASLEEP_MIN
                + w.sleep().needMin() + READY_MIN));
            PlannedSession s = early.get();
            if (!start.toLocalDate().equals(next) || !start.toLocalTime().isAfter(s.start())) {
                continue;
            }
            Optional<LocalTime> firstNext = firstTimedStart(w, next);
            if (firstNext.isPresent() && firstNext.get().isBefore(start.toLocalTime().plusMinutes(s.minutes()))) {
                continue; // the shifted session would collide with the next day's first event
            }
            List<AdjustmentDraft> bundle = List.of(
                AdjustmentDraft.of(new ShiftBedtime(night, bed.toLocalTime())),
                AdjustmentDraft.of(new ShiftSessionTime(next, start.toLocalTime())));
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("night", night.toString());
            f.put("nextDate", next.toString());
            f.put("eventTitle", late.get().title());
            f.put("eventEnd", HuDays.time(lateEnd.toLocalTime()));
            f.put("bedtimeBefore", HuDays.time(usual));
            f.put("bedtimeAfter", HuDays.time(bed.toLocalTime()));
            f.put("sessionLabel", s.label());
            f.put("sessionBefore", HuDays.time(s.start()));
            f.put("sessionAfter", HuDays.time(start.toLocalTime()));
            f.put("firstEventNext", firstNext.map(HuDays::time).orElse(null));
            long protectedMin = Duration.between(bedNow, bed).toMinutes();
            out.add(new ProposalDraft(AdjustmentKind.SHIFT_BEDTIME.name(), bundle, f,
                0.05 + 0.1 * protectedMin / 60.0));
        }
        return out;
    }

    private static Optional<CalendarEventView> lateEvent(WeekPicture w, LocalDate night) {
        Instant late = night.atTime(LATE_EVENT_END).atZone(w.zone()).toInstant();
        return w.events().stream()
            .filter(e -> e.date().equals(night) && !e.allDay() && e.end() != null && e.end().isAfter(late))
            .max(Comparator.comparing(CalendarEventView::end));
    }

    private static Optional<LocalTime> firstTimedStart(WeekPicture w, LocalDate date) {
        return w.events().stream()
            .filter(e -> e.date().equals(date) && !e.allDay() && e.start() != null)
            .map(e -> LocalDateTime.ofInstant(e.start(), w.zone()))
            .filter(t -> t.toLocalDate().equals(date))
            .map(LocalDateTime::toLocalTime)
            .min(Comparator.naturalOrder());
    }

    /** Up to the next quarter hour (an exact quarter stays). */
    static LocalDateTime roundUp15(LocalDateTime t) {
        LocalDateTime m = t.truncatedTo(ChronoUnit.MINUTES);
        if (m.isBefore(t)) {
            m = m.plusMinutes(1);
        }
        int over = m.getMinute() % 15;
        return over == 0 ? m : m.plusMinutes(15 - over);
    }

    // ── food: a bigger lunch before an afternoon block ──────────────────────

    private static Optional<ProposalDraft> meal(WeekPicture w, CapacityDay day, CapacityProperties p) {
        if (!"túl sok".equals(day.verdict())) {
            return Optional.empty();
        }
        Optional<Instant[]> block = afternoonBlock(w, day, p);
        if (block.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Integer> slots = new LinkedHashMap<>();
        slots.put("lunch", MEAL_SHIFT_KCAL);
        slots.put("dinner", -MEAL_SHIFT_KCAL);
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("date", day.date().toString());
        f.put("reason", day.reasonFacts());
        f.put("blockStart", HuDays.time(LocalDateTime.ofInstant(block.get()[0], w.zone()).toLocalTime()));
        f.put("blockEnd", HuDays.time(LocalDateTime.ofInstant(block.get()[1], w.zone()).toLocalTime()));
        f.put("lunchKcal", MEAL_SHIFT_KCAL);
        f.put("dinnerKcal", -MEAL_SHIFT_KCAL);
        return Optional.of(new ProposalDraft(AdjustmentKind.MOVE_MEAL_ENERGY.name(),
            List.of(AdjustmentDraft.of(new MoveMealEnergy(day.date(), slots))), f, 0.05));
    }

    /** The longest run of back-to-back meetings inside 12:00–18:00, when it reaches the sequence-block length. */
    private static Optional<Instant[]> afternoonBlock(WeekPicture w, CapacityDay day, CapacityProperties p) {
        Instant from = day.date().atTime(AFTERNOON_FROM).atZone(w.zone()).toInstant();
        Instant to = day.date().atTime(AFTERNOON_TO).atZone(w.zone()).toInstant();
        List<DemandItem> meetings = day.demand().items().stream()
            .filter(ProposalGenerator::meeting)
            .filter(i -> i.end().isAfter(from) && i.start().isBefore(to))
            .sorted(Comparator.comparing(DemandItem::start))
            .toList();
        Instant[] best = null;
        Instant runStart = null;
        Instant runEnd = null;
        for (DemandItem m : meetings) {
            Instant s = m.start().isBefore(from) ? from : m.start();
            Instant e = m.end().isAfter(to) ? to : m.end();
            if (runEnd == null || Duration.between(runEnd, s).toMinutes() >= p.gapCreditMin()) {
                runStart = s;
                runEnd = e;
            } else if (e.isAfter(runEnd)) {
                runEnd = e;
            }
            if (Duration.between(runStart, runEnd).toMinutes() >= p.sequenceBlockMin()
                && (best == null || Duration.between(runStart, runEnd).compareTo(Duration.between(best[0], best[1])) > 0)) {
                best = new Instant[] {runStart, runEnd};
            }
        }
        return Optional.ofNullable(best);
    }

    // ── calendar: a short meeting right before a session → an hour earlier ───

    private static List<ProposalDraft> calendarTodos(WeekPicture w, CapacityDay day, CapacityProperties p) {
        List<ProposalDraft> out = new ArrayList<>();
        for (PlannedSession s : w.sessionsOn(day.date())) {
            if (s.done() || s.running()) {
                continue;
            }
            Instant sessionStart = day.date().atTime(s.start()).atZone(w.zone()).toInstant();
            for (DemandItem m : day.demand().items()) {
                if (!meeting(m) || m.eventKey() == null) {
                    continue;
                }
                long length = Duration.between(m.start(), m.end()).toMinutes();
                long gap = Duration.between(m.end(), sessionStart).toMinutes();
                if (length > TODO_MAX_MEETING_MIN || gap < 0 || gap >= TODO_IMMEDIATE_GAP_MIN) {
                    continue;
                }
                Instant newStart = m.start().minus(Duration.ofMinutes(TODO_SHIFT_MIN));
                Instant newEnd = m.end().minus(Duration.ofMinutes(TODO_SHIFT_MIN));
                ZonedDateTime localStart = newStart.atZone(w.zone());
                if (!localStart.toLocalDate().equals(day.date()) || localStart.toLocalTime().isBefore(TODO_EARLIEST)
                    || busy(day, m, newStart, newEnd)) {
                    continue;
                }
                Map<String, Object> f = new LinkedHashMap<>();
                f.put("date", day.date().toString());
                f.put("reason", day.reasonFacts());
                f.put("eventTitle", m.label());
                f.put("fromStart", HuDays.time(m.start().atZone(w.zone()).toLocalTime()));
                f.put("fromEnd", HuDays.time(m.end().atZone(w.zone()).toLocalTime()));
                f.put("toStart", HuDays.time(localStart.toLocalTime()));
                f.put("toEnd", HuDays.time(newEnd.atZone(w.zone()).toLocalTime()));
                f.put("sessionLabel", s.label());
                f.put("sessionTime", HuDays.time(s.start()));
                f.put("gapBeforeMin", gap);
                f.put("gapAfterMin", gap + TODO_SHIFT_MIN);
                out.add(new ProposalDraft(AdjustmentKind.CALENDAR_TODO.name(),
                    List.of(AdjustmentDraft.of(new CalendarTodo(day.date(), m.eventKey(), "move", newStart, newEnd))),
                    f, 0.05 + 0.1 * TODO_SHIFT_MIN / 60.0));
            }
        }
        return out;
    }

    private static boolean busy(CapacityDay day, DemandItem moving, Instant from, Instant to) {
        return day.demand().items().stream()
            .filter(i -> i != moving)
            .anyMatch(i -> i.start().isBefore(to) && i.end().isAfter(from));
    }

    // ── shared ──────────────────────────────────────────────────────────────

    private static boolean meeting(DemandItem i) {
        return "meeting".equals(i.kind()) || "call".equals(i.kind());
    }

    private static boolean tight(CapacityDay day) {
        return "szoros".equals(day.verdict()) || "túl sok".equals(day.verdict());
    }

    private static boolean tight(WeekPicture w, LocalDate date) {
        return w.day(date).map(ProposalGenerator::tight).orElse(false);
    }

    private static boolean light(String verdict) {
        return "laza".equals(verdict) || "rendben".equals(verdict);
    }

    /** Over-load removed: Σ over touched days of (ratio − the rendben line)⁺ before minus after. */
    static double relief(DraftWeek.Result r, CapacityProperties p) {
        double line = p.verdict().rendben();
        double out = 0;
        for (DayLoad d : r.days()) {
            out += Math.max(0, d.ratioBefore() - line) - Math.max(0, d.ratioAfter() - line);
        }
        return out;
    }

    private static boolean passesRules(WeekPicture w, ProposalDraft d) {
        return passesRules(w, d.bundle());
    }

    private static boolean passesRules(WeekPicture w, List<AdjustmentDraft> bundle) {
        Set<LocalDate> claimed = new HashSet<>(w.plan().claimedTargets());
        Set<LocalDate> movedFrom = new HashSet<>(w.plan().movedFrom());
        for (AdjustmentDraft step : bundle) {
            AdjustmentPayload payload = AdjustmentPayload.parse(step.kind(), step.payload());
            if (AdjustmentRules.check(payload, w.today(), w.planView(), claimed, movedFrom).isPresent()) {
                return false;
            }
        }
        return true;
    }

    /** A kímélő week never takes on load: any touched day whose ratio would rise drops the draft. */
    private static boolean addsLoad(WeekPicture w, ProposalDraft d, CapacityProperties p) {
        return DraftWeek.apply(w, d.bundle(), p).days().stream()
            .anyMatch(l -> l.ratioAfter() > l.ratioBefore() + 1e-9);
    }

    private static ProposalDraft withPatterns(ProposalDraft d, List<Pattern> patterns) {
        if (patterns == null || patterns.isEmpty()) {
            return d;
        }
        List<LocalDate> days = d.touchedDays();
        if (days.isEmpty()) {
            return d;
        }
        String weekday = days.get(0).getDayOfWeek().name();
        double boost = 0;
        List<String> lines = new ArrayList<>();
        for (Pattern pt : patterns) {
            Map<String, Object> payload = pt.payload() == null ? Map.of() : pt.payload();
            Object kind = payload.get("kind");
            if (!weekday.equals(payload.get("weekday")) || (kind != null && !d.kind().equals(kind))
                || pt.evidence() <= 0) {
                continue;
            }
            boost += 0.1 * Math.min(1.0, (double) pt.consistent() / pt.evidence());
            if (payload.get("line") instanceof String line && !line.isBlank()) {
                lines.add(line);
            }
        }
        if (boost == 0) {
            return d;
        }
        Map<String, Object> facts = new LinkedHashMap<>(d.facts());
        if (!lines.isEmpty()) {
            facts.put("patternLines", List.copyOf(lines));
        }
        return new ProposalDraft(d.kind(), d.bundle(), facts, d.relief() + boost);
    }
}
