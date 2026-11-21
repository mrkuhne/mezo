package io.mrkuhne.mezo.feature.penz.service.news;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The figures of one story — computed by the backend from his own positions, never by the model (spec §6, build
 * notes §3.4) — and their one Hungarian spelling. These are the only numbers the narration may contain
 * ({@link DigestValidator}), so the prompt hands them over verbatim in its FIGURES block.
 *
 * <h2>Spelling</h2>
 * Whole forints, thousands grouped by a <b>plain space</b> (U+0020, as the spike prints {@code 18 400}), a real
 * minus sign (U+2212), {@code " Ft"}: {@code −18 400 Ft}, {@code +7 200 Ft}, {@code 0 Ft}. A percentage is a
 * magnitude with one decimal and a decimal comma: {@code 1,1%}. The iOS app prints the effect itself from
 * {@code effectHufMinor} the same way.
 *
 * @param kind                 what the story is about
 * @param sleeve               the holding's horizon (short|mid|long), null for a macro story
 * @param effectHufMinor       the signed effect on his money, HUF minor units
 * @param changePct            the move behind the effect in percent (any scale; printed with one decimal), or null
 * @param holdingValueHufMinor the holding's current HUF value, or null when not given to the model
 */
public record DigestFigures(DigestKind kind, String sleeve, long effectHufMinor, BigDecimal changePct,
                            Long holdingValueHufMinor) {

    private static final char MINUS = '−';
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final Pattern GROUPED = Pattern.compile("\\d{1,3}(?:[ \\u00A0\\u202F\\u2009.]\\d{3})+(?:,\\d+)?");
    /** A number as Hungarian (or English) prose writes it: grouped thousands first, then a plain or decimal one. */
    static final Pattern NUMBER = Pattern.compile(
        "\\d{1,3}(?:[ \\u00A0\\u202F\\u2009.]\\d{3})+(?:,\\d+)?(?!\\d)|\\d+(?:[.,]\\d+)?");

    /**
     * The forint story's figures (security review #14): the summed currency effect and the pair's % — dropped when
     * its sign contradicts the effect's (a rising pair with a falling forint effect would put two opposite directions
     * on one card).
     */
    public static DigestFigures fx(long effectHufMinor, BigDecimal pairChangePct) {
        BigDecimal pct = pairChangePct;
        if (pct != null && effectHufMinor != 0 && pct.signum() != 0 && pct.signum() != Long.signum(effectHufMinor)) {
            pct = null;
        }
        return new DigestFigures(DigestKind.FX, null, effectHufMinor, pct, null);
    }

    /** -1 / 0 / +1 of the effect as printed (whole forints): an effect that rounds to 0 Ft has no direction. */
    public int direction() {
        return Long.signum(wholeForints(effectHufMinor));
    }

    /** {@code −18 400 Ft} / {@code +7 200 Ft} / {@code 0 Ft}: whole forints, signed. */
    public static String huf(long minor) {
        long whole = wholeForints(minor);
        String digits = group(Math.abs(whole));
        return (whole < 0 ? String.valueOf(MINUS) : whole > 0 ? "+" : "") + digits + " Ft";
    }

    /** {@code 18 400 Ft}: the magnitude, whole forints. */
    public static String hufMagnitude(long minor) {
        return group(Math.abs(wholeForints(minor))) + " Ft";
    }

    /** {@code 1,1%}: the magnitude, one decimal, decimal comma. */
    public static String pct(BigDecimal pct) {
        return pct.abs().setScale(1, RoundingMode.HALF_UP).toPlainString().replace('.', ',') + "%";
    }

    /** {@code changePct} rounded to the one decimal the contract carries ({@code PenzDigestItem.changePct}). */
    public BigDecimal changePctRounded() {
        return changePct == null ? null : changePct.setScale(1, RoundingMode.HALF_UP);
    }

    public String effectText() {
        return huf(effectHufMinor);
    }

    public String changePctText() {
        return changePct == null ? null : pct(changePct);
    }

    public String holdingValueText() {
        return holdingValueHufMinor == null ? null : hufMagnitude(holdingValueHufMinor);
    }

    /** {@code 1–3 év} / {@code 5–10 év} / {@code 10+ év}, or null. */
    public String sleeveLabel() {
        return sleeveLabel(sleeve);
    }

    public static String sleeveLabel(String sleeve) {
        if (sleeve == null) {
            return null;
        }
        return switch (sleeve) {
            case "short" -> "1–3 év";
            case "mid" -> "5–10 év";
            case "long" -> "10+ év";
            default -> null;
        };
    }

    /** The forint figures the amount guard accepts (magnitudes, HUF minor units). */
    public Set<Long> allowedHufMinor() {
        Set<Long> out = new LinkedHashSet<>();
        out.add(Math.abs(effectHufMinor));
        if (holdingValueHufMinor != null) {
            out.add(Math.abs(holdingValueHufMinor));
        }
        return out;
    }

    /** Every number the prose may contain, {@link #normalizeNumber normalized}. */
    public Set<String> allowedNumbers() {
        Set<String> out = new LinkedHashSet<>();
        out.add(String.valueOf(Math.abs(wholeForints(effectHufMinor))));
        if (changePct != null) {
            out.add(normalizeNumber(pct(changePct).replace("%", "")));
        }
        if (holdingValueHufMinor != null) {
            out.add(String.valueOf(Math.abs(wholeForints(holdingValueHufMinor))));
        }
        return out;
    }

    /** The percent token the prose may write with {@code %} / {@code százalék}, normalized; null without a %. */
    public String allowedPercent() {
        return changePct == null ? null : normalizeNumber(pct(changePct).replace("%", ""));
    }

    /**
     * The story's own horizon phrase ({@code 10+ év…}, {@code 5–10 év…}, {@code 1–3 év…}, any ending): its digits are
     * allowed only inside it (security review #3). Null without a sleeve.
     */
    public Pattern horizonPhrase() {
        return horizonPhrase(sleeve);
    }

    /** {@link #horizonPhrase()} of any sleeve (short|mid|long); null otherwise. */
    public static Pattern horizonPhrase(String sleeve) {
        if (sleeve == null) {
            return null;
        }
        return switch (sleeve) {
            case "short" -> Pattern.compile("(?<!\\d)1\\s?[–-]\\s?3\\s?év\\p{L}*");
            case "mid" -> Pattern.compile("(?<!\\d)5\\s?[–-]\\s?10\\s?év\\p{L}*");
            case "long" -> Pattern.compile("(?<!\\d)10\\s?\\+\\s?év\\p{L}*");
            default -> null;
        };
    }

    /** The FIGURES lines of the prompt, Hungarian: magnitudes only (no sign — the direction is the Irány line). */
    public List<String> figureLines() {
        List<String> lines = new ArrayList<>();
        lines.add("Hatás: " + hufMagnitude(effectHufMinor) + " (" + DigestFallbackCopy.effectNote(kind, effectHufMinor)
            + ")");
        int dir = direction();
        lines.add("Irány: " + (dir < 0 ? "csökkenés" : dir > 0 ? "emelkedés" : "változatlan"));
        if (changePct != null) {
            lines.add("Elmozdulás: " + changePctText());
        }
        if (holdingValueHufMinor != null) {
            lines.add("A tételed értéke: " + holdingValueText());
        }
        if (sleeveLabel() != null) {
            lines.add("Horizont: " + sleeveLabel());
        }
        return lines;
    }

    /**
     * One number token in canonical form: grouping separators dropped, decimal comma → dot, trailing zeros gone
     * ({@code "18 400"} → {@code 18400}, {@code "1,10"} → {@code 1.1}, {@code "18.400"} → {@code 18400}).
     */
    public static String normalizeNumber(String token) {
        String t = token.strip();
        if (GROUPED.matcher(t).matches()) {
            t = t.replaceAll("[ \\u00A0\\u202F\\u2009.]", "").replace(',', '.');
        } else {
            t = t.replace(',', '.');
        }
        try {
            BigDecimal d = new BigDecimal(t).stripTrailingZeros();
            return d.scale() < 0 ? d.setScale(0).toPlainString() : d.toPlainString();
        } catch (NumberFormatException e) {
            return t;
        }
    }

    /** Every number in {@code text}, normalized, in text order. */
    public static List<String> numbersIn(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) {
            return out;
        }
        Matcher m = NUMBER.matcher(text);
        while (m.find()) {
            out.add(normalizeNumber(m.group()));
        }
        return out;
    }

    private static long wholeForints(long minor) {
        return BigDecimal.valueOf(minor).divide(HUNDRED, 0, RoundingMode.HALF_UP).longValueExact();
    }

    static String group(long n) {
        String s = Long.toString(n);
        StringBuilder sb = new StringBuilder();
        int lead = s.length() % 3;
        for (int i = 0; i < s.length(); i++) {
            if (i > 0 && (i - lead) % 3 == 0) {
                sb.append(' ');
            }
            sb.append(s.charAt(i));
        }
        return sb.toString();
    }
}
