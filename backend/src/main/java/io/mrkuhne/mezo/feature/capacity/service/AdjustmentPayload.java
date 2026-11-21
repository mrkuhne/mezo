package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The typed body of one ledger step (Boop B7 K3, mezo-r36n9.17, spec §5.5/§5.7). The jsonb column holds the plain map
 * ({@link #toMap()}: dates {@code yyyy-MM-dd}, times {@code HH:mm}, instants ISO-8601); {@link #parse} reads it back and
 * rejects a malformed step with 400 {@code VALIDATION_INVALID_VALUE} (field = the offending key). Shape checks live
 * here; the rules that need the clock or the plan (week, empty day, started day) live in {@link DayAdjustmentService}.
 */
public sealed interface AdjustmentPayload {

    AdjustmentKind kind();

    /** The day the row is filed under ({@code day_adjustment.date}). */
    LocalDate day();

    /** Every day the step changes (a move touches both of its days). */
    default List<LocalDate> touchedDays() {
        return List.of(day());
    }

    Map<String, Object> toMap();

    /** This week's occurrence of a planned gym session re-dated within the same Mon–Sun week, onto a day with no gym. */
    record MoveSessionDay(UUID templateSessionId, LocalDate fromDate, LocalDate toDate) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.MOVE_SESSION_DAY; }
        public LocalDate day() { return fromDate; }
        @Override public List<LocalDate> touchedDays() { return List.of(fromDate, toDate); }
        public Map<String, Object> toMap() {
            return map("templateSessionId", templateSessionId.toString(), "fromDate", fromDate.toString(),
                "toDate", toDate.toString());
        }
    }

    /** The day's session starts at another clock time ({@code HH:mm}). */
    record ShiftSessionTime(LocalDate date, LocalTime time) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.SHIFT_SESSION_TIME; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() { return map("date", date.toString(), "time", hhmm(time)); }
    }

    /** The day's session is cut to {@code minutes} (10–240). */
    record ShortenSession(LocalDate date, int minutes) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.SHORTEN_SESSION; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() { return map("date", date.toString(), "minutes", minutes); }
    }

    /** The day's session keeps {@code setsFactor} of its sets (0.3–0.9). */
    record LightenSession(LocalDate date, double setsFactor) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.LIGHTEN_SESSION; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() { return map("date", date.toString(), "setsFactor", setsFactor); }
    }

    /** The day's session becomes a walk or a mobility session. */
    record SwapSessionKind(LocalDate date, String to) implements AdjustmentPayload {
        static final Set<String> TARGETS = Set.of("walk", "mobility");
        public AdjustmentKind kind() { return AdjustmentKind.SWAP_SESSION_KIND; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() { return map("date", date.toString(), "to", to); }
    }

    /**
     * The day's gym session is skipped through train's planned-skip path (reason {@code KAPACITAS}); {@code skipId} is
     * the planned skip the apply created (null in a draft), so undo removes exactly that one.
     */
    record SkipSession(LocalDate date, UUID skipId) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.SKIP_SESSION; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() {
            return map("date", date.toString(), "skipId", skipId == null ? null : skipId.toString());
        }
    }

    /** Bedtime for one night ({@code night} = the evening's date) moves to {@code bedtime}. */
    record ShiftBedtime(LocalDate night, LocalTime bedtime) implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.SHIFT_BEDTIME; }
        public LocalDate day() { return night; }
        public Map<String, Object> toMap() { return map("night", night.toString(), "bedtime", hhmm(bedtime)); }
    }

    /**
     * Energy moves between the day's meal slots: {@code slotKcal} holds signed kcal deltas per slot
     * (breakfast | lunch | dinner | snack) that must sum to zero — the day total never changes.
     */
    record MoveMealEnergy(LocalDate date, Map<String, Integer> slotKcal) implements AdjustmentPayload {
        static final Set<String> SLOTS = Set.of("breakfast", "lunch", "dinner", "snack");
        public AdjustmentKind kind() { return AdjustmentKind.MOVE_MEAL_ENERGY; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() { return map("date", date.toString(), "slotKcal", new LinkedHashMap<>(slotKcal)); }
    }

    /**
     * A to-do for the owner's own calendar (the server never writes it): move the event to {@code toStart..toEnd}, or
     * cancel it. {@code date} = the event's day. Filed as {@code waiting} until the calendar shows it.
     */
    record CalendarTodo(LocalDate date, String eventKey, String action, Instant toStart, Instant toEnd)
            implements AdjustmentPayload {
        public AdjustmentKind kind() { return AdjustmentKind.CALENDAR_TODO; }
        public LocalDate day() { return date; }
        public Map<String, Object> toMap() {
            return map("date", date.toString(), "eventKey", eventKey, "action", action,
                "toStart", toStart == null ? null : toStart.toString(), "toEnd", toEnd == null ? null : toEnd.toString());
        }
    }

    /** Reads and shape-checks one step; 400 {@code VALIDATION_INVALID_VALUE} on anything malformed. */
    static AdjustmentPayload parse(String kindName, Map<String, Object> raw) {
        AdjustmentKind kind;
        try {
            kind = AdjustmentKind.valueOf(kindName);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw invalid("kind");
        }
        Map<String, Object> p = raw == null ? Map.of() : raw;
        return switch (kind) {
            case MOVE_SESSION_DAY -> {
                var m = new MoveSessionDay(uuid(p, "templateSessionId"), date(p, "fromDate"), date(p, "toDate"));
                if (m.fromDate().equals(m.toDate())) {
                    throw invalid("toDate");
                }
                yield m;
            }
            case SHIFT_SESSION_TIME -> new ShiftSessionTime(date(p, "date"), time(p, "time"));
            case SHORTEN_SESSION -> {
                int minutes = integer(p, "minutes");
                if (minutes < 10 || minutes > 240) {
                    throw invalid("minutes");
                }
                yield new ShortenSession(date(p, "date"), minutes);
            }
            case LIGHTEN_SESSION -> {
                double f = number(p, "setsFactor");
                if (f < 0.3 || f > 0.9) {
                    throw invalid("setsFactor");
                }
                yield new LightenSession(date(p, "date"), f);
            }
            case SWAP_SESSION_KIND -> {
                String to = string(p, "to");
                if (!SwapSessionKind.TARGETS.contains(to)) {
                    throw invalid("to");
                }
                yield new SwapSessionKind(date(p, "date"), to);
            }
            case SKIP_SESSION -> new SkipSession(date(p, "date"), p.get("skipId") == null ? null : uuid(p, "skipId"));
            case SHIFT_BEDTIME -> new ShiftBedtime(date(p, "night"), time(p, "bedtime"));
            case MOVE_MEAL_ENERGY -> new MoveMealEnergy(date(p, "date"), slotKcal(p));
            case CALENDAR_TODO -> calendarTodo(p);
        };
    }

    private static CalendarTodo calendarTodo(Map<String, Object> p) {
        String eventKey = string(p, "eventKey");
        if (eventKey.isBlank() || eventKey.length() > 200) {
            throw invalid("eventKey");
        }
        String action = string(p, "action");
        Instant toStart = p.get("toStart") == null ? null : instant(p, "toStart");
        Instant toEnd = p.get("toEnd") == null ? null : instant(p, "toEnd");
        switch (action) {
            case "move" -> {
                if (toStart == null || toEnd == null || !toEnd.isAfter(toStart)) {
                    throw invalid("toStart");
                }
            }
            case "cancel" -> {
                if (toStart != null || toEnd != null) {
                    throw invalid("toStart");
                }
            }
            default -> throw invalid("action");
        }
        return new CalendarTodo(date(p, "date"), eventKey, action, toStart, toEnd);
    }

    private static Map<String, Integer> slotKcal(Map<String, Object> p) {
        if (!(p.get("slotKcal") instanceof Map<?, ?> raw) || raw.isEmpty()) {
            throw invalid("slotKcal");
        }
        Map<String, Integer> out = new LinkedHashMap<>();
        int sum = 0;
        for (var e : raw.entrySet()) {
            String slot = String.valueOf(e.getKey());
            if (!MoveMealEnergy.SLOTS.contains(slot) || !(e.getValue() instanceof Number n) || n.doubleValue() % 1 != 0) {
                throw invalid("slotKcal");
            }
            out.put(slot, n.intValue());
            sum += n.intValue();
        }
        if (sum != 0) {
            throw invalid("slotKcal"); // the day total never changes
        }
        return out;
    }

    // ── tiny readers over the jsonb map ───────────────────────────────────────

    private static Object required(Map<String, Object> p, String key) {
        Object v = p.get(key);
        if (v == null) {
            throw invalid(key);
        }
        return v;
    }

    private static String string(Map<String, Object> p, String key) {
        if (!(required(p, key) instanceof String s)) {
            throw invalid(key);
        }
        return s;
    }

    private static LocalDate date(Map<String, Object> p, String key) {
        try {
            return LocalDate.parse(string(p, key));
        } catch (DateTimeParseException e) {
            throw invalid(key);
        }
    }

    private static LocalTime time(Map<String, Object> p, String key) {
        String s = string(p, key);
        if (!s.matches("\\d{2}:\\d{2}")) {
            throw invalid(key);
        }
        try {
            return LocalTime.parse(s);
        } catch (DateTimeParseException e) {
            throw invalid(key);
        }
    }

    private static Instant instant(Map<String, Object> p, String key) {
        try {
            return Instant.parse(string(p, key));
        } catch (DateTimeParseException e) {
            throw invalid(key);
        }
    }

    private static UUID uuid(Map<String, Object> p, String key) {
        try {
            return UUID.fromString(string(p, key));
        } catch (IllegalArgumentException e) {
            throw invalid(key);
        }
    }

    private static int integer(Map<String, Object> p, String key) {
        if (!(required(p, key) instanceof Number n) || n.doubleValue() % 1 != 0) {
            throw invalid(key);
        }
        return n.intValue();
    }

    private static double number(Map<String, Object> p, String key) {
        if (!(required(p, key) instanceof Number n)) {
            throw invalid(key);
        }
        return n.doubleValue();
    }

    private static String hhmm(LocalTime t) {
        return String.format("%02d:%02d", t.getHour(), t.getMinute());
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    private static SystemRuntimeErrorException invalid(String field) {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(),
            org.springframework.http.HttpStatus.BAD_REQUEST);
    }
}
