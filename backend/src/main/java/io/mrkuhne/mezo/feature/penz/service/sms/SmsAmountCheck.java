package io.mrkuhne.mezo.feature.penz.service.sms;

import io.mrkuhne.mezo.feature.penz.service.guard.HufAmountGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The amount cross-check of the SMS parse (Boop Pénz L4, mezo-r36n9.102, spec §9): the amount the model read
 * must literally be in the SMS, else the SMS is stored {@code failed/amount_mismatch} and nothing is booked. HUF
 * goes through {@link HufAmountGuard#containsAmount}; for EUR / USD / GBP / CHF the same literal rule is applied
 * with a number next to the currency's code or symbol ({@code 12,50 EUR}, {@code €12.50}, {@code USD 1 234,56}),
 * thousands grouped by a space, NBSP, a dot or a comma and one or two decimals after a comma or a dot.
 */
public final class SmsAmountCheck {

    private static final String SPACES = " \\t\\u00A0\\u202F\\u2009";
    private static final String NUM =
        "(?<int>\\d{1,3}(?:[" + SPACES + ".,]\\d{3})+|\\d+)(?:[.,](?<dec>\\d{1,2}))?(?!\\d)";
    private static final Map<String, String> MARKERS = Map.of(
        "EUR", "EUR|€",
        "USD", "USD|US\\$|\\$",
        "GBP", "GBP|£",
        "CHF", "CHF");

    private SmsAmountCheck() {
    }

    /** True when {@code amountMinor} (magnitude) of {@code currency} is literally written in {@code text}. */
    public static boolean containsAmount(String text, String currency, long amountMinor) {
        if ("HUF".equals(currency)) {
            return HufAmountGuard.containsAmount(text, amountMinor);
        }
        return foreignAmountsMinor(text, currency).contains(Math.abs(amountMinor));
    }

    /** Every figure written next to {@code currency}'s code or symbol, in minor units (1/100). */
    static List<Long> foreignAmountsMinor(String text, String currency) {
        List<Long> out = new ArrayList<>();
        String marker = MARKERS.get(currency);
        if (text == null || marker == null) {
            return out;
        }
        String cur = "(?:" + marker + ")";
        Pattern p = Pattern.compile(
            "(?<![A-Za-z])" + cur + "[" + SPACES + "]?[+\\-−]?" + NUM
                + "|(?<![\\d.,])" + NUM.replace("<int>", "<int2>").replace("<dec>", "<dec2>")
                + "[" + SPACES + "]?" + cur + "(?![A-Za-z])",
            Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        while (m.find()) {
            String intPart = m.group("int") != null ? m.group("int") : m.group("int2");
            String dec = m.group("int") != null ? m.group("dec") : m.group("dec2");
            BigDecimal major = new BigDecimal(intPart.replaceAll("[^0-9]", ""));
            if (dec != null) {
                major = major.add(new BigDecimal("0." + dec));
            }
            out.add(major.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact());
        }
        return out;
    }
}
