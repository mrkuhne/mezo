package io.mrkuhne.mezo.feature.mail.service.classify;

import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import io.mrkuhne.mezo.feature.mail.service.rules.Group;
import io.mrkuhne.mezo.feature.mail.service.rules.ParcelState;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The deterministic gate on every model answer of the morning post (Boop Levél, mezo-r36n9.38, spec §5.4 step 5) —
 * the real defence against a model that invents or obeys an injected mail. Pure; never throws on bad model output.
 *
 * <ul>
 *   <li><b>Dates</b>: a model date is kept only when the same calendar date can be read from the mail text in one of
 *       {@code yyyy.MM.dd}, {@code yyyy-MM-dd}, {@code MM.dd.} (month first, Hungarian), {@code d. MMMM} or
 *       {@code MMMM d.} (Hungarian month names); a year-less date resolves to its next occurrence from {@code clock}.
 *       A kept date becomes 23:59 local that day (a due or valid-until day is inclusive); a time the model adds is
 *       ignored.</li>
 *   <li><b>Amounts</b>: kept only when the same value stands next to {@code Ft|HUF|€|EUR} in the text, in the model's
 *       currency; stored as value x 100 minor units.</li>
 *   <li><b>Shape</b>: an unknown group (and {@code sensitive}, which never reaches a model) rejects the whole answer;
 *       a deal without a title is rejected; strings are clamped to their column sizes.</li>
 * </ul>
 */
public final class MailOutputValidator {

    public static final int CATEGORY_MAX = 24;
    public static final int TITLE_MAX = 200;
    public static final int SUMMARY_MAX = 400;
    public static final int CARRIER_MAX = 16;
    public static final int WHY_MAX = 200;

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Locale HU = Locale.forLanguageTag("hu");

    private static final List<String> MONTHS = List.of("január", "február", "március", "április", "május", "június",
        "július", "augusztus", "szeptember", "október", "november", "december");
    private static final String MONTH_ALT = String.join("|", MONTHS);

    private static final Pattern FULL_DOT = Pattern.compile("(?<!\\d)(\\d{4})\\.\\s?(\\d{1,2})\\.\\s?(\\d{1,2})(?!\\d)");
    private static final Pattern ISO = Pattern.compile("(?<!\\d)(\\d{4})-(\\d{2})-(\\d{2})(?!\\d)");
    private static final Pattern MONTH_DAY_DOT = Pattern.compile("(?<![\\d.])(?<!\\d\\.\\s)(\\d{1,2})\\.\\s?(\\d{1,2})\\.(?!\\d)");
    private static final Pattern DAY_MONTH_NAME = Pattern.compile(
        "(?<!\\d)(\\d{1,2})\\.?\\s?(" + MONTH_ALT + ")(?![\\p{L}])", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern MONTH_NAME_DAY = Pattern.compile(
        "(?<![\\p{L}])(" + MONTH_ALT + ")\\s(\\d{1,2})(?!\\d)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final String NUMBER = "\\d[\\d\\s\\u00a0.,]*\\d|\\d";
    private static final Pattern AMOUNT_AFTER = Pattern.compile(
        "(" + NUMBER + ")\\s?(Ft|HUF|€|EUR)(?![\\p{L}\\p{N}])", Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT_BEFORE = Pattern.compile(
        "(?<![\\p{L}\\p{N}])(€|EUR|HUF|Ft)\\s?(" + NUMBER + ")", Pattern.CASE_INSENSITIVE);

    private MailOutputValidator() {}

    /** {@link #classified(String, RedactedMail, ZoneId, Clock)} with the system clock in {@code zone}. */
    public static Optional<ClassifiedMail> classified(String json, RedactedMail source, ZoneId zone) {
        return classified(json, source, zone, Clock.system(zone));
    }

    /** The validated classification, or empty when the answer is unreadable, has an unknown group or is a title-less deal. */
    public static Optional<ClassifiedMail> classified(String json, RedactedMail source, ZoneId zone, Clock clock) {
        JsonNode root = parse(json, '{', '}');
        if (root == null || !root.isObject()) {
            return Optional.empty();
        }
        Group group = group(str(root.get("group")));
        if (group == null) {
            return Optional.empty();
        }
        String title = clamp(str(root.get("title")), TITLE_MAX);
        if (group == Group.DEAL && (title == null || title.isBlank())) {
            return Optional.empty();
        }
        String text = source.text();
        LocalDate today = LocalDate.now(clock.withZone(zone));
        Set<LocalDate> dates = datesIn(text, today);

        Instant dueAt = date(root.get("dueAt"), dates, zone);
        Instant validUntil = date(root.get("validUntil"), dates, zone);

        Long amountMinor = null;
        String currency = null;
        BigDecimal modelAmount = amount(root.get("amount"));
        if (modelAmount != null && modelAmount.signum() > 0) {
            String modelCurrency = currencyCode(str(root.get("currency")));
            for (Amount a : amountsIn(text)) {
                if (a.value().compareTo(modelAmount) == 0 && (modelCurrency == null || modelCurrency.equals(a.currency()))) {
                    amountMinor = minor(modelAmount);
                    currency = a.currency();
                    break;
                }
            }
        }
        return Optional.of(new ClassifiedMail(group,
            nz(clamp(str(root.get("category")), CATEGORY_MAX)),
            nz(title),
            nz(clamp(str(root.get("summary")), SUMMARY_MAX)),
            dueAt, validUntil, amountMinor, currency,
            clamp(str(root.get("carrier")), CARRIER_MAX),
            parcelState(str(root.get("parcelState")))));
    }

    /** The scores of the asked ids only (first entry per id wins), each 1-10; anything else is dropped. */
    public static List<ScoredDeal> scores(String json, Set<UUID> askedIds) {
        JsonNode root = parse(json, '[', ']');
        if (root == null && json != null) {
            JsonNode obj = parse(json, '{', '}');
            root = obj == null ? null : obj.get("scores");
        }
        if (root == null || !root.isArray()) {
            return List.of();
        }
        List<ScoredDeal> out = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (JsonNode e : root) {
            if (e == null || !e.isObject()) {
                continue;
            }
            UUID id = uuid(str(e.get("id")));
            JsonNode s = e.get("score");
            if (id == null || !askedIds.contains(id) || seen.contains(id) || s == null || !s.isIntegralNumber()
                || !s.canConvertToInt()) {
                continue;
            }
            int score = s.intValue();
            if (score < 1 || score > 10) {
                continue;
            }
            seen.add(id);
            out.add(new ScoredDeal(id, score, nz(clamp(str(e.get("why")), WHY_MAX))));
        }
        return List.copyOf(out);
    }

    /** True when the screen says the mail looks like phishing or an injection; unreadable = not flagged. */
    public static boolean flagged(String json) {
        JsonNode root = parse(json, '{', '}');
        JsonNode f = root == null ? null : root.get("flagged");
        return f != null && f.isBoolean() && f.booleanValue();
    }

    // ---------------------------------------------------------------- dates

    private static Instant date(JsonNode node, Set<LocalDate> inText, ZoneId zone) {
        String s = str(node);
        if (s == null || s.length() < 10) {
            return null;
        }
        LocalDate d;
        try {
            d = LocalDate.parse(s.substring(0, 10));
        } catch (DateTimeException e) {
            return null;
        }
        return inText.contains(d) ? d.atTime(LocalTime.of(23, 59)).atZone(zone).toInstant() : null;
    }

    /** Every calendar date the text states, in the listed formats; year-less ones at their next occurrence. */
    static Set<LocalDate> datesIn(String text, LocalDate today) {
        Set<LocalDate> out = new HashSet<>();
        Matcher m = FULL_DOT.matcher(text);
        while (m.find()) {
            add(out, Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        }
        m = ISO.matcher(text);
        while (m.find()) {
            add(out, Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        }
        m = MONTH_DAY_DOT.matcher(text);
        while (m.find()) {
            addYearless(out, Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), today);
        }
        m = DAY_MONTH_NAME.matcher(text);
        while (m.find()) {
            addYearless(out, month(m.group(2)), Integer.parseInt(m.group(1)), today);
        }
        m = MONTH_NAME_DAY.matcher(text);
        while (m.find()) {
            addYearless(out, month(m.group(1)), Integer.parseInt(m.group(2)), today);
        }
        return out;
    }

    private static int month(String name) {
        return MONTHS.indexOf(name.toLowerCase(HU)) + 1;
    }

    private static void add(Set<LocalDate> out, int y, int mo, int d) {
        try {
            out.add(LocalDate.of(y, mo, d));
        } catch (DateTimeException ignored) {
            // not a date (13th month, 31 February): not a claim the text can back
        }
    }

    private static void addYearless(Set<LocalDate> out, int mo, int d, LocalDate today) {
        for (int y = today.getYear(); y <= today.getYear() + 1; y++) {
            try {
                LocalDate c = LocalDate.of(y, mo, d);
                if (!c.isBefore(today)) {
                    out.add(c);
                    return;
                }
            } catch (DateTimeException ignored) {
                // 29 February in a non-leap year: try the next one
            }
        }
    }

    // -------------------------------------------------------------- amounts

    private record Amount(BigDecimal value, String currency) {}

    private static List<Amount> amountsIn(String text) {
        List<Amount> out = new ArrayList<>();
        Matcher m = AMOUNT_AFTER.matcher(text);
        while (m.find()) {
            BigDecimal v = number(m.group(1));
            if (v != null) {
                out.add(new Amount(v, currencyCode(m.group(2))));
            }
        }
        m = AMOUNT_BEFORE.matcher(text);
        while (m.find()) {
            BigDecimal v = number(m.group(2));
            if (v != null) {
                out.add(new Amount(v, currencyCode(m.group(1))));
            }
        }
        return out;
    }

    /** "12 990", "12.990", "1,234.50", "49,90" -> a value; thousands vs decimal read from the separators. */
    static BigDecimal number(String raw) {
        String s = raw.replace(" ", "").replaceAll("\\s", "");
        int dot = s.lastIndexOf('.');
        int comma = s.lastIndexOf(',');
        try {
            if (dot >= 0 && comma >= 0) {
                boolean commaDecimal = comma > dot;
                return new BigDecimal(commaDecimal ? s.replace(".", "").replace(',', '.') : s.replace(",", ""));
            }
            int sep = Math.max(dot, comma);
            if (sep >= 0) {
                char c = s.charAt(sep);
                boolean repeated = s.indexOf(c) != sep;
                boolean threeDigitsAfter = s.length() - sep - 1 == 3;
                boolean thousands = repeated || threeDigitsAfter;
                return new BigDecimal(thousands ? s.replace(".", "").replace(",", "") : s.replace(',', '.'));
            }
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal amount(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (n.isNumber()) {
            return n.decimalValue();
        }
        if (n.isString()) {
            Matcher m = Pattern.compile(NUMBER).matcher(n.asString());
            return m.find() ? number(m.group()) : null;
        }
        return null;
    }

    private static Long minor(BigDecimal v) {
        try {
            return v.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact();
        } catch (ArithmeticException e) {
            return null;
        }
    }

    private static String currencyCode(String s) {
        if (s == null) {
            return null;
        }
        return switch (s.strip().toUpperCase(Locale.ROOT)) {
            case "FT", "HUF" -> "HUF";
            case "€", "EUR" -> "EUR";
            default -> null;
        };
    }

    // --------------------------------------------------------------- shared

    private static Group group(String s) {
        if (s == null) {
            return null;
        }
        return switch (s.strip().toLowerCase(Locale.ROOT)) {
            case "deadline" -> Group.DEADLINE;
            case "parcel" -> Group.PARCEL;
            case "deal" -> Group.DEAL;
            case "rest" -> Group.REST;
            case "person" -> Group.PERSON;
            default -> null; // incl. "sensitive": sensitive mail never reaches a model
        };
    }

    private static ParcelState parcelState(String s) {
        if (s == null) {
            return null;
        }
        return switch (s.strip().toLowerCase(Locale.ROOT)) {
            case "in_transit" -> ParcelState.IN_TRANSIT;
            case "today" -> ParcelState.TODAY;
            case "pickup" -> ParcelState.PICKUP;
            case "delivered" -> ParcelState.DELIVERED;
            default -> null;
        };
    }

    private static UUID uuid(String s) {
        try {
            return s == null ? null : UUID.fromString(s.strip());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String str(JsonNode n) {
        return n != null && n.isString() ? n.asString() : null;
    }

    private static String clamp(String s, int max) {
        if (s == null) {
            return null;
        }
        String t = s.strip();
        return t.length() > max ? t.substring(0, max).strip() : t;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    /** The outermost {@code open..close} span of the answer parsed (tolerates code fences and chatter); null on failure. */
    private static JsonNode parse(String raw, char open, char close) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.strip();
        int start = s.indexOf(open);
        int end = s.lastIndexOf(close);
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return JSON.readTree(s.substring(start, end + 1));
        } catch (JacksonException | IllegalArgumentException e) {
            return null;
        }
    }
}
