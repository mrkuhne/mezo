package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.guard.HufAmountGuard;
import io.mrkuhne.mezo.feature.penz.service.news.DigestFigures;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import io.mrkuhne.mezo.feature.penz.service.news.NewsText;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The deterministic gate on a proposal's narration (Boop Pénz L7, mezo-r36n9.105, build notes call 13) — a sibling of
 * the digest's {@code DigestValidator}, the same taxonomy (spec §6). Pure. Any violation in any field → the whole
 * narration is replaced by {@link ProposalFallbackCopy} built from the same figures ({@code narratedBy: fallback}).
 *
 * <ul>
 *   <li><b>Shape</b>: every field non-blank and within its cap (summary {@value #SUMMARY_MAX}, why
 *       {@value #WHY_MAX}, uncertainty {@value #UNCERTAINTY_MAX}).</li>
 *   <li><b>Numerical Error</b>: every number is one of the proposal's FIGURES ({@link ProposalFigures#allowedNumbers},
 *       Hungarian formats normalized); a {@code %} only on one of its percentages; no scale word (ezer, millió, k…)
 *       or other currency (euró, $…) next to a figure; the horizon digits only inside a horizon label
 *       ({@code 10+ év}); {@link HufAmountGuard#verdict} on every field; no spelled-out number beyond egy..hat and no
 *       {@code Ft} / {@code HUF} that does not follow a digit figure. Digits inside an allowed product name are
 *       skipped.</li>
 *   <li><b>Entity Swap</b>: a sleeve's "why" may name only that sleeve's options; the summary and the uncertainty only
 *       the proposal's options; no other catalog product (suggested, declined, another sleeve's) is ever named.</li>
 *   <li><b>Boundary</b> (spec §6): no buy imperative, sell, urge, countdown or return-promise wording (HU + EN, folded
 *       stems; letter-spaced words joined first), no URL, no markup but {@code *emphasis*}, no prompt-leak
 *       marker.</li>
 * </ul>
 */
public final class ProposalValidator {

    public static final int SUMMARY_MAX = 600;
    public static final int WHY_MAX = 500;
    public static final int UNCERTAINTY_MAX = 500;

    private static final Pattern NUMBER = Pattern.compile(
        "\\d{1,3}(?:[ \\u00A0\\u202F\\u2009.]\\d{3})+(?:,\\d+)?(?!\\d)|\\d+(?:[.,]\\d+)?");
    private static final Pattern PERCENT_AFTER = Pattern.compile("^\\s?(?:%|szazalek)");
    private static final Pattern SCALE_AFTER = Pattern.compile(
        "^\\s?(?:ezer\\p{L}*|milliard\\p{L}*|millio\\p{L}*|billio\\p{L}*|mrd|mn|bn|eur\\p{L}*|e|m|k"
            + "|dollar\\p{L}*|usd|chf|frank\\p{L}*|gbp|font\\p{L}*|[$€£])(?![\\p{L}\\p{N}])");
    private static final Pattern CURRENCY_BEFORE = Pattern.compile("[$€£]\\s?$");
    private static final Pattern WORD = Pattern.compile("\\p{L}+");
    private static final Pattern SPELLED_TENS = Pattern.compile(
        "(?:tiz|husz|harminc|negyven|otven|hatvan|hetven|nyolcvan|kilencven)\\p{L}*|szaz(?!alek)\\p{L}*");
    private static final Pattern MONEY_ABBR = Pattern.compile("(?<![\\p{L}\\p{N}])(?:ft|huf)(?!\\p{L})");
    private static final Pattern SPACED_LETTERS = Pattern.compile("(?<!\\p{L})\\p{L}(?: \\p{L}(?!\\p{L}))+");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");

    /** Folded phrases at a word start: buy imperative / sell / urge / countdown / return promise (HU + EN). */
    static final List<String> BOUNDARY_STEMS = List.of(
        // buy imperative, sell
        "vedd meg", "vegyel", "vegyen", "vasarol", "vasarl", "fektess be", "fektesd", "tedd bele", "rakd bele",
        "add el", "adj el", "adja el", "elad", "megvaln", "megvalj", "valj meg", "realizal",
        // urge, countdown
        "most kell", "azonnal", "haladektalan", "surgos", "siess", "mielott keso", "ne hagyd ki", "utolso esely",
        "napod van", "napon belul", "hatarido", "visszaszaml", "lepned kell", "lepj", "cselekedj", "venni kell",
        // return promise
        "garantal", "biztos nyereseg", "biztos hozam", "biztosan no", "biztosan nov", "biztosan hoz",
        "biztosan emelk", "biztosan gyarapod", "biztosan megter", "megterul", "kockazatmentes",
        // English
        "buy", "sell", "invest now", "act now", "urgent", "hurry", "guarantee", "risk-free", "risk free",
        "sure profit", "will grow", "cannot lose", "can't lose");
    static final List<String> LEAK_STEMS = List.of(
        "boop_penz", "sleeve", "proposal", "utasitas", "instruction", "ignore", "system", "prompt", "figures");
    private static final Pattern URL = Pattern.compile(
        "https?:|www\\.|\\b[a-z0-9-]+\\.[a-z]{2,24}/"
            + "|\\b[a-z0-9-]+\\.(?:com|hu|net|org|io|eu|uk|co|info|biz|ru|ly|de|me|xyz|example)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern MARKUP = Pattern.compile("[<>`\\[\\]{}|]|\\*\\*|(?m)^\\s*#");

    private ProposalValidator() {
    }

    /**
     * Every violation of {@code narration} against the proposal's {@code figures}; {@code catalogNames} = the names of
     * every product in his catalog (any status). Empty = it may stand.
     */
    public static List<DigestViolation> validate(ProposalNarration narration, ProposalFigures figures,
                                                 List<String> catalogNames) {
        List<DigestViolation> out = new ArrayList<>();
        List<String> allOffered = figures.sleeves().stream().flatMap(s -> s.names().stream()).distinct().toList();
        Map<String, Field> fields = new LinkedHashMap<>();
        fields.put("summary", new Field(narration.summary(), SUMMARY_MAX, allOffered));
        for (Sleeve s : Sleeve.values()) {
            fields.put("why." + s.wire(), new Field(narration.why(s), WHY_MAX, figures.options(s).names()));
        }
        fields.put("uncertainty", new Field(narration.uncertainty(), UNCERTAINTY_MAX, allOffered));

        for (Map.Entry<String, Field> e : fields.entrySet()) {
            String field = e.getKey();
            Field f = e.getValue();
            String raw = f.text() == null ? "" : f.text();
            if (raw.isBlank()) {
                out.add(new DigestViolation(Rule.SHAPE, field, "empty"));
                continue;
            }
            if (raw.strip().length() > f.max()) {
                out.add(new DigestViolation(Rule.SHAPE, field, "too long"));
            }
            String prose = without(raw, f.allowedNames());
            String folded = NewsText.fold(prose);
            String joined = joinSpacedLetters(prose);

            checkNumbers(field, prose, figures, out);
            if (namesForbiddenProduct(folded, catalogNames, f.allowedNames())) {
                out.add(new DigestViolation(Rule.ENTITY_SWAP, field, "names a product that is not offered here"));
            }
            if (anyStem(folded, BOUNDARY_STEMS) || anyStem(joined, BOUNDARY_STEMS)) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "buy, sell, urge or promise wording"));
            }
            if (URL.matcher(raw).find()) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "url"));
            }
            if (MARKUP.matcher(raw).find()) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "markup"));
            }
            if (anyStem(folded, LEAK_STEMS) || anyStem(joined, LEAK_STEMS)) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "prompt-leak marker"));
            }
        }
        return out;
    }

    private record Field(String text, int max, List<String> allowedNames) {
    }

    /** Numerical Error: figures, %, scale / currency, horizon digits, the amount guard, spelled numbers, bare Ft. */
    private static void checkNumbers(String field, String prose, ProposalFigures figures, List<DigestViolation> out) {
        String text = ProposalFigures.HORIZONS.matcher(prose).replaceAll(" ");
        Set<String> allowed = figures.allowedNumbers();
        Set<String> percents = figures.allowedPercents();
        boolean bad = false;
        Matcher m = NUMBER.matcher(text);
        while (m.find() && !bad) {
            String token = DigestFigures.normalizeNumber(m.group());
            String after = NewsText.fold(text.substring(m.end(), Math.min(text.length(), m.end() + 24)));
            String before = text.substring(Math.max(0, m.start() - 3), m.start());
            bad = !allowed.contains(token)
                || (PERCENT_AFTER.matcher(after).find() && !percents.contains(token))
                || SCALE_AFTER.matcher(after).find()
                || CURRENCY_BEFORE.matcher(before).find();
        }
        if (bad) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number not among the figures"));
        }
        if (!HufAmountGuard.verdict(text, figures.allowedHufMinor(), Long.MAX_VALUE).isOk()) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "forint amount not among the figures"));
        }
        String folded = NewsText.fold(text);
        if (spelledNumber(folded) || bareMoneyAbbreviation(folded)) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number in words or a bare money word"));
        }
    }

    /** A catalog name (folded, whole word; 5+ characters may carry a Hungarian ending) that is not allowed here. */
    private static boolean namesForbiddenProduct(String folded, List<String> catalogNames, List<String> allowed) {
        Set<String> allowedFolded = new LinkedHashSet<>();
        allowed.forEach(n -> allowedFolded.add(NewsText.fold(n)));
        for (String name : catalogNames) {
            String term = NewsText.fold(name);
            if (term.isBlank() || allowedFolded.contains(term)) {
                continue;
            }
            if (NewsText.containsTerm(folded, term, term.length() >= 5)) {
                return true;
            }
        }
        return false;
    }

    /** A spelled-out number beyond egy..hat: tens, hundreds, any word built on ezer / millió / milliárd. */
    private static boolean spelledNumber(String folded) {
        Matcher w = WORD.matcher(folded);
        while (w.find()) {
            String word = w.group();
            if (SPELLED_TENS.matcher(word).matches()
                || (word.contains("ezer") && !word.startsWith("ezert") && !word.contains("rezerv"))
                || word.contains("millio") || word.contains("milliard") || word.contains("billio")) {
                return true;
            }
        }
        return false;
    }

    /** {@code Ft} / {@code HUF} not directly after a digit figure. */
    private static boolean bareMoneyAbbreviation(String folded) {
        Matcher m = MONEY_ABBR.matcher(folded);
        while (m.find()) {
            int i = m.start() - 1;
            if (i >= 0 && folded.charAt(i) == ' ') {
                i--;
            }
            if (i < 0 || !Character.isDigit(folded.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static boolean anyStem(String folded, List<String> stems) {
        return stems.stream().anyMatch(s -> NewsText.containsStem(folded, s));
    }

    /** Folded text with letter-spaced words joined ({@code v e d d  m e g} → {@code vedd meg}). */
    static String joinSpacedLetters(String text) {
        String lower = MARKS.matcher(Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)).replaceAll("")
            .toLowerCase(Locale.ROOT);
        Matcher m = SPACED_LETTERS.matcher(lower);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(m.group().replace(" ", "")));
        }
        m.appendTail(sb);
        return sb.toString().replaceAll("\\s+", " ").trim();
    }

    /** The prose with the allowed product names taken out, longest first (their digits are not figures). */
    private static String without(String text, List<String> names) {
        String out = text;
        List<String> sorted = names.stream().filter(n -> n != null && !n.isBlank())
            .sorted(Comparator.comparingInt(String::length).reversed()).toList();
        for (String n : sorted) {
            out = Pattern.compile(Pattern.quote(n.strip()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                .matcher(out).replaceAll(" ");
        }
        return out;
    }
}
