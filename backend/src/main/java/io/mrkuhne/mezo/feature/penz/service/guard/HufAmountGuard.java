package io.mrkuhne.mezo.feature.penz.service.guard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The Hungarian amount guard of Boop Pénz (mezo-r36n9.102, spec 2026-11-13-boop-penz-design §6): it reads every
 * forint figure out of Hungarian (or English) text and checks it against the figures the engine computed, so a
 * language model can never put an invented amount in front of the owner, and an SMS parse can never book an
 * amount that is not in the SMS. Pure and stateless; ported from the old Finance Tracker app
 * ({@code base44/functions/morningBrief/brief.ts} {@code hufAmountsMinor} / {@code withinLimits},
 * {@code analysis.ts} {@code normalizeAnalysis}) and extended.
 *
 * <h2>What counts as a forint figure</h2>
 * A number with a currency marker: a suffix {@code Ft}, {@code HUF} or {@code forint…} (case-insensitive, any
 * Hungarian case ending: {@code Ft-ot}, {@code Ft-od}, {@code Ft-tal}, {@code HUF-ot}, {@code forintot},
 * {@code forinttal}), or a {@code HUF} prefix ({@code HUF 20 000}, but not {@code EUR/HUF 364.4}). Thousands are
 * grouped by a space, NBSP (U+00A0), narrow NBSP (U+202F), thin space (U+2009), a dot or a comma
 * ({@code 15 500}, {@code 15.500}, {@code 15,000}); one or two digits after a comma or dot are decimals
 * ({@code 99,50 Ft}). A unit word multiplies: {@code ezer}/{@code e} ×1 000, {@code millió}/{@code million}/
 * {@code mill.}/{@code mn}/{@code M} ×1 000 000, {@code milliárd}/{@code mrd} ×1 000 000 000. Extension over the
 * old code: the full words {@code millió} / {@code milliárd} (with any ending, {@code milliót}) count as money
 * even without a currency marker — in a Pénz text "2 milliárd" names money, and reading one figure too many only
 * downgrades; a bare {@code ezer} still does not ({@code 10 ezer lépés}, {@code 10 ezerből}). Dates, times, store
 * numbers and percentages carry no marker and are never read. Signs ({@code -}, {@code +}, U+2212) are dropped:
 * every figure is a magnitude in HUF minor units (1/100 Ft, {@code 15 500 Ft} → {@code 1_550_000}).
 *
 * <h2>The verdict rule ({@link #verdict})</h2>
 * A figure is allowed only when it is one of the computed inputs (compared as magnitudes; an input also matches
 * its value rounded to whole forints, because the app prints whole forints) AND not above the max. <b>Derived
 * sums are NOT tolerated</b>: a sum or difference of two allowed figures is a figure the engine did not compute,
 * so it downgrades — the old code had no notion of derived figures (it only capped every figure at the limit),
 * and the brief fixes the stricter rule "any figure not among the computed inputs downgrades". A caller that
 * wants the model to quote a total puts that total in the allowed set. No known limit (the old {@code stale} /
 * {@code null} limit): pass a negative max and every figure downgrades.
 */
public final class HufAmountGuard {

    /** Space, tab, NBSP (U+00A0), narrow NBSP (U+202F), thin space (U+2009) — never a newline. */
    private static final String SPACES = " \\t\\u00A0\\u202F\\u2009";
    private static final String SEP = "[" + SPACES + "]";
    private static final String LETTER = "[A-Za-z\\u00C0-\\u017F]";
    private static final String HU_ENDING = "[a-z\\u00E1\\u00E9\\u00ED\\u00F3\\u00F6\\u0151\\u00FA\\u00FC\\u0171]*";

    private static final Pattern AMOUNT = Pattern.compile(
        "(?<![/A-Za-z\\u00C0-\\u017F])"
            + "(?<prefix>HUF" + SEP + "?)?"
            + "(?<int>\\d{1,3}(?:[" + SPACES + ".,]\\d{3})+|\\d+)"
            + "(?:[.,](?<dec>\\d{1,2}))?"
            + "(?:" + SEP + "?(?:(?<word>milliárd|milliard|million|millió|millio)" + HU_ENDING
            + "|(?<abbr>mrd|mill\\.?|mn|m|ezer|e)(?!" + LETTER + ")))?"
            + "(?:" + SEP + "?(?<suffix>Ft|HUF|forint" + HU_ENDING + ")(?!" + LETTER + "))?",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final BigDecimal THOUSAND = BigDecimal.valueOf(1_000L);
    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000L);
    private static final BigDecimal BILLION = BigDecimal.valueOf(1_000_000_000L);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100L);
    private static final BigDecimal LONG_MAX = BigDecimal.valueOf(Long.MAX_VALUE);

    private HufAmountGuard() {
    }

    /** Every forint figure in {@code text}, in text order, as HUF minor units (magnitudes). Null text → empty. */
    public static List<Long> hufAmountsMinor(String text) {
        List<Long> out = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return out;
        }
        Matcher m = AMOUNT.matcher(text);
        while (m.find()) {
            String word = m.group("word");
            String abbr = m.group("abbr");
            String unit = word != null ? word : abbr;
            boolean bareBigWord = word != null && !word.toLowerCase(Locale.ROOT).equals("million");
            if (m.group("prefix") == null && m.group("suffix") == null && !bareBigWord) {
                continue;
            }
            BigDecimal major = new BigDecimal(m.group("int").replaceAll("[^0-9]", ""));
            String dec = m.group("dec");
            if (dec != null) {
                major = major.add(new BigDecimal("0." + dec));
            }
            if (unit != null) {
                major = major.multiply(factor(unit.toLowerCase(Locale.ROOT)));
            }
            BigDecimal minor = major.multiply(HUNDRED).setScale(0, RoundingMode.HALF_UP);
            out.add(minor.compareTo(LONG_MAX) > 0 ? Long.MAX_VALUE : minor.longValue());
        }
        return out;
    }

    private static BigDecimal factor(String unit) {
        if (unit.equals("e") || unit.equals("ezer")) {
            return THOUSAND;
        }
        if (unit.equals("mrd") || unit.startsWith("milliárd") || unit.startsWith("milliard")) {
            return BILLION;
        }
        return MILLION;
    }

    /**
     * The guard on generated text: {@link GuardVerdict#ok()} when every figure is one of {@code allowedMinor}
     * (magnitude, or that input rounded to whole forints) and not above {@code maxMinor}; otherwise a downgrade
     * listing each offending figure once, in text order. Derived sums are not tolerated (see the class doc).
     */
    public static GuardVerdict verdict(String generatedText, Set<Long> allowedMinor, long maxMinor) {
        Set<Long> allowed = new LinkedHashSet<>();
        for (Long a : allowedMinor) {
            long abs = Math.abs(a);
            allowed.add(abs);
            allowed.add(roundToWholeForint(abs));
        }
        Set<Long> offending = new LinkedHashSet<>();
        for (long figure : hufAmountsMinor(generatedText)) {
            if (figure > maxMinor || !allowed.contains(figure)) {
                offending.add(figure);
            }
        }
        return offending.isEmpty() ? GuardVerdict.ok() : GuardVerdict.downgrade(List.copyOf(offending));
    }

    /** True when {@code minor} (its magnitude) is literally one of the figures in {@code text} — the SMS cross-check. */
    public static boolean containsAmount(String text, long minor) {
        return hufAmountsMinor(text).contains(Math.abs(minor));
    }

    /**
     * Port of the old {@code withinLimits}: {@code text} unchanged when it may stand, else null. Text without a
     * figure always stands; with a figure it is dropped when the limit is stale or unknown ({@code maxMinor} null),
     * or when any figure is above {@code maxMinor}.
     */
    public static String withinLimits(String text, Long maxMinor, boolean stale) {
        if (text == null) {
            return null;
        }
        List<Long> amounts = hufAmountsMinor(text);
        if (amounts.isEmpty()) {
            return text;
        }
        if (stale || maxMinor == null) {
            return null;
        }
        return amounts.stream().anyMatch(a -> a > maxMinor) ? null : text;
    }

    /**
     * Port of the {@code normalizeAnalysis} reason check: true when, with a known and fresh limit, {@code text}
     * names a figure above it. With a stale or unknown limit the text is left alone (false).
     */
    public static boolean namesAmountAbove(String text, Long maxMinor, boolean stale) {
        if (stale || maxMinor == null) {
            return false;
        }
        return hufAmountsMinor(text).stream().anyMatch(a -> a > maxMinor);
    }

    /**
     * Port of the {@code normalizeAnalysis} recommended-amount check: a positive amount, a fresh known limit, and
     * not above it.
     */
    public static boolean amountAllowed(long minor, Long maxMinor, boolean stale) {
        return minor > 0 && !stale && maxMinor != null && minor <= maxMinor;
    }

    private static long roundToWholeForint(long minor) {
        return BigDecimal.valueOf(minor).divide(HUNDRED, 0, RoundingMode.HALF_UP).longValue() * 100L;
    }
}
