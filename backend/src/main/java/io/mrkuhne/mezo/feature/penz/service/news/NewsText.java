package io.mrkuhne.mezo.feature.penz.service.news;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Text helpers shared by the news pipeline (Boop Pénz L6, mezo-r36n9.104): entity decoding (the old app's
 * {@code decodeEntities}, extended with the named entities Hungarian and English news pages actually use), the
 * case- and diacritic-insensitive normal form every term match runs on, and the whole-word term match.
 */
public final class NewsText {

    private static final Map<String, String> NAMED = Map.ofEntries(
        Map.entry("amp", "&"), Map.entry("lt", "<"), Map.entry("gt", ">"), Map.entry("quot", "\""),
        Map.entry("apos", "'"), Map.entry("nbsp", " "), Map.entry("ndash", "–"), Map.entry("mdash", "—"),
        Map.entry("hellip", "…"), Map.entry("lsquo", "‘"), Map.entry("rsquo", "’"), Map.entry("ldquo", "“"),
        Map.entry("rdquo", "”"), Map.entry("bdquo", "„"), Map.entry("laquo", "«"), Map.entry("raquo", "»"),
        Map.entry("euro", "€"), Map.entry("copy", "©"),
        Map.entry("aacute", "á"), Map.entry("eacute", "é"), Map.entry("iacute", "í"), Map.entry("oacute", "ó"),
        Map.entry("ouml", "ö"), Map.entry("odblac", "ő"), Map.entry("uacute", "ú"), Map.entry("uuml", "ü"),
        Map.entry("udblac", "ű"), Map.entry("Aacute", "Á"), Map.entry("Eacute", "É"), Map.entry("Iacute", "Í"),
        Map.entry("Oacute", "Ó"), Map.entry("Ouml", "Ö"), Map.entry("Odblac", "Ő"), Map.entry("Uacute", "Ú"),
        Map.entry("Uuml", "Ü"), Map.entry("Udblac", "Ű"));

    private static final Pattern ENTITY = Pattern.compile("&(#[xX][0-9a-fA-F]{1,6}|#\\d{1,7}|[A-Za-z]{2,8});");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");

    private NewsText() {
    }

    /** Named + numeric entities decoded; an unknown or invalid entity is left as written. */
    public static String decodeEntities(String s) {
        if (s == null || s.indexOf('&') < 0) {
            return s;
        }
        Matcher m = ENTITY.matcher(s);
        StringBuilder out = new StringBuilder(s.length());
        while (m.find()) {
            String e = m.group(1);
            String replacement = m.group();
            if (e.charAt(0) == '#') {
                try {
                    int code = (e.charAt(1) == 'x' || e.charAt(1) == 'X')
                        ? Integer.parseInt(e.substring(2), 16) : Integer.parseInt(e.substring(1));
                    if (Character.isValidCodePoint(code) && code != 0) {
                        replacement = new String(Character.toChars(code));
                    }
                } catch (NumberFormatException ignored) {
                    // left as written
                }
            } else if (NAMED.containsKey(e)) {
                replacement = NAMED.get(e);
            }
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString();
    }

    /** Lower case, diacritics dropped (ő → o, é → e), whitespace collapsed — the form every match runs on. */
    public static String fold(String s) {
        if (s == null) {
            return "";
        }
        String nfd = Normalizer.normalize(s, Normalizer.Form.NFD);
        return MARKS.matcher(nfd).replaceAll("").toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /**
     * True when the already-{@link #fold folded} {@code term} occurs in the folded {@code text} as a whole word: not
     * preceded or followed by a letter or digit ({@code OTP's}, {@code OTP-nél} match {@code otp}; {@code OTPX} does
     * not). With {@code allowSuffix} a term of 4+ characters may also carry trailing letters (Hungarian case endings:
     * {@code forintot}, {@code alapkamatot}).
     */
    public static boolean containsTerm(String foldedText, String foldedTerm, boolean allowSuffix) {
        if (foldedTerm == null || foldedTerm.isBlank() || foldedText == null || foldedText.isEmpty()) {
            return false;
        }
        int from = 0;
        while (true) {
            int at = foldedText.indexOf(foldedTerm, from);
            if (at < 0) {
                return false;
            }
            int end = at + foldedTerm.length();
            boolean startOk = at == 0 || !Character.isLetterOrDigit(foldedText.codePointBefore(at));
            boolean endOk = end >= foldedText.length() || !Character.isLetterOrDigit(foldedText.codePointAt(end))
                || (allowSuffix && foldedTerm.length() >= 4 && Character.isLetter(foldedText.codePointAt(end)));
            if (startOk && endOk) {
                return true;
            }
            from = at + 1;
        }
    }

    /** A folded stem that starts a word and may run on ({@code csokken} → csökkent, csökkenés). */
    public static boolean containsStem(String foldedText, String foldedStem) {
        if (foldedStem == null || foldedStem.isBlank() || foldedText == null) {
            return false;
        }
        int from = 0;
        while (true) {
            int at = foldedText.indexOf(foldedStem, from);
            if (at < 0) {
                return false;
            }
            if (at == 0 || !Character.isLetterOrDigit(foldedText.codePointBefore(at))) {
                return true;
            }
            from = at + 1;
        }
    }
}
