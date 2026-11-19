package io.mrkuhne.mezo.feature.penz.service.sms;

import io.mrkuhne.mezo.feature.penz.service.money.Money;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/**
 * The pure half of the bank-SMS ingest (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7) — a 1:1 port of the old
 * app's {@code base44/functions/ingest-sms/logic.ts} ({@code validateBody}, {@code dedupeHash},
 * {@code looksLikeMoney}, {@code budapestDate}, {@code normalizeParsed}); its 15 vitest cases are the oracle
 * ({@code SmsIngestLogicTest}). No Spring, no I/O.
 */
public final class SmsIngestLogic {

    /** The longest SMS text accepted (after trimming). */
    public static final int MAX_TEXT = 1000;
    /** The longest sender accepted (after trimming). */
    public static final int MAX_SENDER = 100;
    /** The sender stored when the Shortcut sent none. */
    public static final String UNKNOWN_SENDER = "unknown";

    /** 1 billion major units, in minor units — the old {@code MAX_AMOUNT_MINOR}. */
    static final long MAX_AMOUNT_MINOR = 100_000_000_000L;
    /** An LLM date further than this from the receive date is replaced by the receive date. */
    static final int MAX_DATE_DRIFT_DAYS = 7;
    /** {@code Number.MAX_SAFE_INTEGER} — the old guard against a float amount that lost precision. */
    private static final double MAX_SAFE_INTEGER = 9_007_199_254_740_991d;

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");

    private static final String NUM = "[+\\-−]?\\d[\\d .,]*";
    private static final String CUR = "(?<![A-Za-z])(?:HUF|Ft|EUR|USD|GBP|CHF)(?![A-Za-z])|[€$]";
    private static final Pattern MONEY_RE =
        Pattern.compile(NUM + "\\s*(?:" + CUR + ")|(?:" + CUR + ")\\s*" + NUM, Pattern.CASE_INSENSITIVE);

    private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final DateTimeFormatter STRICT_DATE =
        DateTimeFormatter.ofPattern("uuuu-MM-dd").withResolverStyle(ResolverStyle.STRICT);

    private SmsIngestLogic() {
    }

    // ---- body ----

    /** A validated body: trimmed text, trimmed sender ({@value #UNKNOWN_SENDER} when absent), receive instant. */
    public record ValidBody(String text, String sender, Instant receivedAt) {
    }

    /** {@code value} when valid, else {@code error} (the old error slug) and {@code field}. */
    public record BodyCheck(ValidBody value, String error, String field) {

        public boolean ok() {
            return value != null;
        }

        static BodyCheck fail(String error, String field) {
            return new BodyCheck(null, error, field);
        }
    }

    /**
     * Port of {@code validateBody}: the text is required, trimmed, at most {@value #MAX_TEXT}; the sender is
     * optional, trimmed, blank → {@value #UNKNOWN_SENDER}, at most {@value #MAX_SENDER}; an unparseable or
     * missing {@code receivedAt} falls back to {@code now} (an iOS Shortcut date is not always ISO).
     */
    public static BodyCheck validateBody(String text, String sender, String receivedAt, Instant now) {
        if (text == null) {
            return BodyCheck.fail("text_required", "text");
        }
        String t = text.strip();
        if (t.isEmpty()) {
            return BodyCheck.fail("text_required", "text");
        }
        if (t.length() > MAX_TEXT) {
            return BodyCheck.fail("text_too_long", "text");
        }
        String s = UNKNOWN_SENDER;
        if (sender != null) {
            s = sender.strip().isEmpty() ? UNKNOWN_SENDER : sender.strip();
            if (s.length() > MAX_SENDER) {
                return BodyCheck.fail("sender_too_long", "sender");
            }
        }
        return new BodyCheck(new ValidBody(t, s, parseInstant(receivedAt).orElse(now)), null, null);
    }

    /** An ISO-8601 instant ({@code Z} or offset), or empty. */
    static Optional<Instant> parseInstant(String iso) {
        if (iso == null || iso.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(OffsetDateTime.parse(iso.strip()).toInstant());
        } catch (DateTimeParseException e) {
            try {
                return Optional.of(Instant.parse(iso.strip()));
            } catch (DateTimeParseException e2) {
                return Optional.empty();
            }
        }
    }

    // ---- hashing ----

    /** Lower-case hex SHA-256 of the UTF-8 bytes — the old {@code sha256Hex}. */
    public static String sha256Hex(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError(e); // SHA-256 is mandatory on every JVM
        }
    }

    /** {@code sha256(trim(sender) + '|' + trim(text))} — the per-owner dedupe key. */
    public static String dedupeHash(String sender, String text) {
        return sha256Hex(sender.strip() + "|" + text.strip());
    }

    // ---- pre-filter ----

    /** The cheap regex pre-filter: a number next to a currency code or symbol. A miss never reaches the LLM. */
    public static boolean looksLikeMoney(String text) {
        return text != null && MONEY_RE.matcher(text).find();
    }

    /** The calendar date of {@code instant} in Budapest — the old {@code budapestDate}. */
    public static LocalDate budapestDate(Instant instant) {
        return localDate(instant, BUDAPEST);
    }

    /** The calendar date of {@code instant} in {@code zone} (the owner's money timezone). */
    public static LocalDate localDate(Instant instant, ZoneId zone) {
        return ZonedDateTime.ofInstant(instant, zone).toLocalDate();
    }

    // ---- normalize ----

    /** The guarded parse: {@code parsed} with its fields, or {@code ignored}/{@code failed} with a reason. */
    public record Normalized(String status, String reason, String kind, long amountMinor, String currency,
                             String merchant, LocalDate date, String categoryName) {

        public static final String PARSED = "parsed";
        public static final String IGNORED = "ignored";
        public static final String FAILED = "failed";

        static Normalized parsed(String kind, long amountMinor, String currency, String merchant, LocalDate date,
                                 String categoryName) {
            return new Normalized(PARSED, null, kind, amountMinor, currency, merchant, date, categoryName);
        }

        public static Normalized ignored(String reason) {
            return new Normalized(IGNORED, reason, null, 0, null, null, null, null);
        }

        public static Normalized failed(String reason) {
            return new Normalized(FAILED, reason, null, 0, null, null, null, null);
        }

        public boolean isParsed() {
            return PARSED.equals(status);
        }
    }

    /**
     * Port of {@code normalizeParsed}: only an explicit {@code is_transaction: false} is {@code ignored}; any
     * other non-true value, a direction other than debit/credit, a non-positive / non-finite / unsafe / over
     * 1 billion amount, or a currency off the whitelist is {@code failed}. Amount = round(major × 100); a date
     * more than {@value #MAX_DATE_DRIFT_DAYS} days from {@code fallbackDate} (or not a real date) becomes the
     * fallback; the category is matched case-insensitively against {@code categoryNames} and canonicalised.
     */
    public static Normalized normalizeParsed(JsonNode raw, LocalDate fallbackDate, List<String> categoryNames) {
        if (raw == null || !raw.isObject()) {
            return Normalized.failed("bad_shape");
        }
        JsonNode isTxn = raw.get("is_transaction");
        if (isTxn != null && isTxn.isBoolean() && !isTxn.booleanValue()) {
            return Normalized.ignored("not_a_transaction");
        }
        if (isTxn == null || !isTxn.isBoolean() || !isTxn.booleanValue()) {
            return Normalized.failed("bad_shape");
        }
        String direction = textOrNull(raw.get("direction"));
        if (!"debit".equals(direction) && !"credit".equals(direction)) {
            return Normalized.failed("bad_direction");
        }
        JsonNode amountNode = raw.get("amount");
        if (amountNode == null || !amountNode.isNumber()) {
            return Normalized.failed("bad_amount");
        }
        double amount = amountNode.doubleValue();
        if (!Double.isFinite(amount) || amount <= 0) {
            return Normalized.failed("bad_amount");
        }
        double scaled = Math.floor(amount * 100 + 0.5); // JS Math.round for positives
        if (!Double.isFinite(scaled) || scaled > MAX_SAFE_INTEGER || scaled <= 0 || scaled > MAX_AMOUNT_MINOR) {
            return Normalized.failed("bad_amount");
        }
        long amountMinor = (long) scaled;
        String currencyRaw = textOrNull(raw.get("currency"));
        String currency = currencyRaw == null ? "" : currencyRaw.strip().toUpperCase(Locale.ROOT);
        if (!Money.SUPPORTED.contains(currency)) {
            return Normalized.failed("bad_currency");
        }
        String merchantRaw = textOrNull(raw.get("merchant"));
        String merchant = merchantRaw == null ? "" : merchantRaw.strip();
        merchant = (merchant.length() > 80 ? merchant.substring(0, 80) : merchant).strip();
        LocalDate date = fallbackDate;
        String dateRaw = textOrNull(raw.get("date"));
        LocalDate llmDate = realDate(dateRaw);
        if (llmDate != null && Math.abs(ChronoUnit.DAYS.between(llmDate, fallbackDate)) <= MAX_DATE_DRIFT_DAYS) {
            date = llmDate;
        }
        String catRaw = textOrNull(raw.get("category"));
        String cat = catRaw == null ? "" : catRaw.strip().toLowerCase(Locale.ROOT);
        String categoryName = null;
        if (!cat.isEmpty()) {
            categoryName = categoryNames.stream().filter(n -> n.toLowerCase(Locale.ROOT).equals(cat)).findFirst()
                .orElse(null);
        }
        return Normalized.parsed("debit".equals(direction) ? "expense" : "income", amountMinor, currency,
            merchant.isEmpty() ? null : merchant, date, categoryName);
    }

    private static LocalDate realDate(String s) {
        if (s == null || !ISO_DATE.matcher(s).matches()) {
            return null;
        }
        try {
            return LocalDate.parse(s, STRICT_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String textOrNull(JsonNode n) {
        return n != null && n.isString() ? n.asString() : null;
    }
}
