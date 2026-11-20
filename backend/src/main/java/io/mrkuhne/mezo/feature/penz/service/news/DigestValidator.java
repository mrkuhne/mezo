package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.service.guard.HufAmountGuard;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The deterministic gate on every narrated digest item (Boop Pénz L6, mezo-r36n9.104, build notes §4) — the real
 * defence against a model that invents, swaps, flips or obeys an injected article. Pure; an item with any violation
 * is replaced by {@link DigestFallbackCopy}. Hardened after the L6 security review (findings #1–#4).
 *
 * <ul>
 *   <li><b>Shape</b>: every text field non-blank and within its cap (title {@value #TITLE_MAX}, verdict
 *       {@value #VERDICT_MAX}, body {@value #BODY_MAX}, uncertainty {@value #UNCERTAINTY_MAX}, noAction
 *       {@value #NO_ACTION_MAX}); confidence 0..2.</li>
 *   <li><b>Numerical Error</b>: every number in the prose is one of the story's figures (effect, %, value —
 *       Hungarian formats normalized); a % only when it is the story's own percentage; no scale word (ezer, millió,
 *       mrd, k…) or other currency (euró, dollár, $, €…) next to a figure; the horizon digits only inside the
 *       story's own horizon phrase ({@code 10+ éves}); {@link HufAmountGuard#verdict} on every field; no spelled-out
 *       number beyond egy..hat (tíz, húsz, száz, ezer, kétmillió…) and no {@code Ft} / {@code HUF} that does not
 *       follow a digit figure. Digits inside the story's own ledger name are skipped.</li>
 *   <li><b>Entity Swap</b>: no other holding's name or match terms; a macro story may name the holdings it moves.</li>
 *   <li><b>Negation Flip</b>: no signed figure at all ({@code +}, {@code −}, {@code -}, {@code –} before a digit —
 *       the card prints the signed effect itself); for a holding story with a non-zero effect, no rise / gain word
 *       with a negative effect and no fall / loss word with a positive one, in <b>every</b> field; for a forint story
 *       the same for the words about his money (nyert, veszített, veszteség…) — not the currency's own words, whose
 *       direction is inverted for foreign holdings.</li>
 *   <li><b>Temporal Confusion</b>: no year and no weekday name.</li>
 *   <li><b>Boundary</b> (spec §6): no buy / sell / urge / promise wording (HU + EN, stems; letter-spaced words are
 *       joined first: {@code a d d  e l} reads {@code add el}), no URL, no markup but {@code *emphasis*}, no
 *       prompt-leak marker.</li>
 * </ul>
 */
public final class DigestValidator {

    public static final int TITLE_MAX = 120;
    public static final int VERDICT_MAX = 220;
    public static final int BODY_MAX = 1_800;
    public static final int UNCERTAINTY_MAX = 500;
    public static final int NO_ACTION_MAX = 300;

    private static final Pattern YEAR = Pattern.compile("(?<!\\d)(?:19|20)\\d{2}(?!\\d)");
    private static final Pattern SIGNED = Pattern.compile("(?<![\\p{L}\\p{N}])[+\\u2212\\u2013-]\\s?\\d");
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

    private static final List<String> WEEKDAYS = List.of(
        "hetfo", "kedd", "szerda", "csutortok", "pentek", "szombat", "vasarnap",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");

    /** Folded word-start stems about his money gaining / losing — checked on forint stories too. */
    private static final List<String> GAIN_STEMS = List.of("nyer", "gyarapod", "gazdagabb", "profit");
    private static final List<String> LOSS_STEMS = List.of("veszit", "veszteseg", "minusz");
    private static final List<String> LOSS_WORDS = List.of("kar", "kart", "karod", "karos", "karral");
    /** Price direction stems / words — checked on holding stories. */
    private static final List<String> RISE_STEMS = List.of(
        "emelked", "nott", "novek", "erosod", "dragul", "szarnyal", "felfut", "ugrott", "javult", "climb");
    private static final List<String> RISE_WORDS = List.of("rose", "rise", "rises", "rising", "gain", "gains",
        "gained", "jump", "jumps", "jumped", "surge", "surges", "surged", "rally", "rallies", "rallied");
    private static final List<String> FALL_STEMS = List.of(
        "esett", "eses", "csokken", "gyengul", "zuhan", "visszaes", "merseklod", "declin", "slump", "plung", "tumbl");
    private static final List<String> FALL_WORDS = List.of("fell", "fall", "falls", "falling", "drop", "drops",
        "dropped", "slid", "slide", "lost", "loses");

    /** Folded phrases at a word start: buy / sell / urge / promise (HU + EN). */
    private static final List<String> BOUNDARY_STEMS = List.of(
        "vedd meg", "vegyel", "vegyen", "vasarol", "vasarl", "add el", "adj el", "adja el", "elad", "megvaln",
        "megvalj", "valj meg",
        "realizal", "poziciod", "noveld", "csokkentsd", "bovitsd", "haladektalan", "mielott keso", "venni kell",
        "most kell", "azonnal", "surgos", "garantal", "biztos nyereseg", "biztos hozam", "lepned kell", "lepj",
        "cselekedj", "ne hagyd ki", "utolso esely",
        "buy", "sell", "trim", "exit", "take profit", "offload", "dump", "reduce your", "increase your",
        "add to your", "urgent", "guarantee", "act now");
    static final List<String> LEAK_STEMS = List.of(
        "boop_penz", "article", "utasitas", "instruction", "ignore", "system", "prompt", "figures");
    private static final Pattern URL = Pattern.compile(
        "https?:|www\\.|\\b[a-z0-9-]+\\.[a-z]{2,24}/"
            + "|\\b[a-z0-9-]+\\.(?:com|hu|net|org|io|eu|uk|co|info|biz|ru|ly|de|me|xyz|example)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern MARKUP = Pattern.compile("[<>`\\[\\]{}|]|\\*\\*|(?m)^\\s*#");

    private DigestValidator() {
    }

    /** Every violation of {@code item} narrating {@code story}, given all of his holdings; empty = it may stand. */
    public static List<DigestViolation> validate(DigestModelItem item, DigestStory story, List<NewsHolding> holdings) {
        List<DigestViolation> out = new ArrayList<>();
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("title", item.title());
        fields.put("verdict", item.verdict());
        fields.put("body", item.body());
        fields.put("uncertainty", item.uncertainty());
        fields.put("noAction", item.noAction());

        checkShape(item, fields, out);
        DigestFigures figures = story.figures();
        List<String> forbiddenTerms = forbiddenTerms(story, holdings);
        StringBuilder allProse = new StringBuilder();

        for (Map.Entry<String, String> f : fields.entrySet()) {
            String field = f.getKey();
            String raw = f.getValue() == null ? "" : f.getValue();
            String prose = withoutOwnName(raw, story.holdingName());
            allProse.append(prose).append(" . ");
            String folded = NewsText.fold(prose);
            String joined = joinSpacedLetters(prose);

            checkTemporal(field, prose, folded, out);
            String noHorizon = withoutHorizon(prose, figures);
            checkNumbers(field, noHorizon, figures.allowedNumbers(), figures.allowedPercent(),
                figures.allowedHufMinor(), out);
            checkSigned(field, noHorizon, out);
            checkEntities(field, folded, forbiddenTerms, out);
            checkBoundary(field, raw, folded, joined, LEAK_STEMS, out);
        }
        checkDirection(story, NewsText.fold(allProse.toString()), out);
        return out;
    }

    /** Temporal Confusion: no year and no weekday name. Shared with {@link WeeklyReviewValidator}. */
    static void checkTemporal(String field, String prose, String folded, List<DigestViolation> out) {
        if (YEAR.matcher(prose).find()) {
            out.add(new DigestViolation(Rule.TEMPORAL_CONFUSION, field, "year"));
        }
        if (WEEKDAYS.stream().anyMatch(w -> NewsText.containsStem(folded, w))) {
            out.add(new DigestViolation(Rule.TEMPORAL_CONFUSION, field, "weekday"));
        }
    }

    /** Negation Flip's sign rule: no signed figure (the text with its horizon phrase already taken out). */
    static void checkSigned(String field, String textWithoutHorizon, List<DigestViolation> out) {
        if (SIGNED.matcher(textWithoutHorizon).find()) {
            out.add(new DigestViolation(Rule.NEGATION_FLIP, field, "signed figure"));
        }
    }

    /** Entity Swap: none of {@code forbiddenTerms} (folded) in the folded prose. */
    static void checkEntities(String field, String folded, List<String> forbiddenTerms, List<DigestViolation> out) {
        if (forbiddenTerms.stream().anyMatch(t -> NewsText.containsTerm(folded, t, t.length() >= 5))) {
            out.add(new DigestViolation(Rule.ENTITY_SWAP, field, "names another holding"));
        }
    }

    /** Boundary (spec §6): buy / sell / urge / promise stems, URL, markup, prompt-leak stems. */
    static void checkBoundary(String field, String raw, String folded, String joined, List<String> leakStems,
                              List<DigestViolation> out) {
        if (anyStem(folded, BOUNDARY_STEMS) || anyStem(joined, BOUNDARY_STEMS)) {
            out.add(new DigestViolation(Rule.BOUNDARY, field, "buy, sell, urge or promise wording"));
        }
        if (URL.matcher(raw).find()) {
            out.add(new DigestViolation(Rule.BOUNDARY, field, "url"));
        }
        if (MARKUP.matcher(raw).find()) {
            out.add(new DigestViolation(Rule.BOUNDARY, field, "markup"));
        }
        if (anyStem(folded, leakStems) || anyStem(joined, leakStems)) {
            out.add(new DigestViolation(Rule.BOUNDARY, field, "prompt-leak marker"));
        }
    }

    /**
     * Numerical Error: figures, %, scale / currency, the amount guard, spelled numbers, bare Ft — on the text with
     * its horizon phrase already taken out (years are blanked here; Temporal Confusion reports them).
     */
    static void checkNumbers(String field, String textWithoutHorizon, Set<String> allowed, String percent,
                             Set<Long> allowedHufMinor, List<DigestViolation> out) {
        String text = YEAR.matcher(textWithoutHorizon).replaceAll(" ");
        boolean bad = false;
        Matcher m = DigestFigures.NUMBER.matcher(text);
        while (m.find() && !bad) {
            String token = DigestFigures.normalizeNumber(m.group());
            String after = NewsText.fold(text.substring(m.end(), Math.min(text.length(), m.end() + 24)));
            String before = text.substring(Math.max(0, m.start() - 3), m.start());
            bad = !allowed.contains(token)
                || (PERCENT_AFTER.matcher(after).find() && !token.equals(percent))
                || SCALE_AFTER.matcher(after).find()
                || CURRENCY_BEFORE.matcher(before).find();
        }
        if (bad) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number not among the figures"));
        }
        if (!HufAmountGuard.verdict(text, allowedHufMinor, Long.MAX_VALUE).isOk()) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "forint amount not among the figures"));
        }
        String folded = NewsText.fold(text);
        if (spelledNumber(folded) || bareMoneyAbbreviation(folded)) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number in words or a bare money word"));
        }
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

    private static void checkShape(DigestModelItem item, Map<String, String> fields, List<DigestViolation> out) {
        Map<String, Integer> caps = Map.of("title", TITLE_MAX, "verdict", VERDICT_MAX, "body", BODY_MAX,
            "uncertainty", UNCERTAINTY_MAX, "noAction", NO_ACTION_MAX);
        for (Map.Entry<String, String> f : fields.entrySet()) {
            String v = f.getValue();
            if (v == null || v.isBlank()) {
                out.add(new DigestViolation(Rule.SHAPE, f.getKey(), "empty"));
            } else if (v.strip().length() > caps.get(f.getKey())) {
                out.add(new DigestViolation(Rule.SHAPE, f.getKey(), "too long"));
            }
        }
        if (item.confidence() == null || item.confidence() < 0 || item.confidence() > 2) {
            out.add(new DigestViolation(Rule.SHAPE, "confidence", "not 0..2"));
        }
    }

    /** Negation Flip over every field (folded, own name removed). */
    private static void checkDirection(DigestStory story, String folded, List<DigestViolation> out) {
        int dir = story.figures().direction();
        if (dir == 0 || story.kind() == DigestKind.RATES) {
            return;
        }
        boolean gain = anyStem(folded, GAIN_STEMS);
        boolean loss = anyStem(folded, LOSS_STEMS) || LOSS_WORDS.stream()
            .anyMatch(w -> NewsText.containsTerm(folded, w, false));
        if (story.kind() == DigestKind.HOLDING) {
            gain = gain || anyStem(folded, RISE_STEMS)
                || RISE_WORDS.stream().anyMatch(w -> NewsText.containsTerm(folded, w, false));
            loss = loss || anyStem(folded, FALL_STEMS)
                || FALL_WORDS.stream().anyMatch(w -> NewsText.containsTerm(folded, w, false));
        }
        if ((dir < 0 && gain) || (dir > 0 && loss)) {
            out.add(new DigestViolation(Rule.NEGATION_FLIP, "prose", "direction contradicts the effect sign"));
        }
    }

    static boolean anyStem(String folded, List<String> stems) {
        return stems.stream().anyMatch(s -> NewsText.containsStem(folded, s));
    }

    /**
     * Folded text with letter-spaced words joined ({@code a d d  e l} → {@code add el}): a run of single letters
     * separated by single spaces becomes one word; a wider gap still separates words.
     */
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

    /** Folded names and match terms of the holdings this story must not name. */
    static List<String> forbiddenTerms(DigestStory story, List<NewsHolding> holdings) {
        return forbiddenTerms(h -> mayName(story, h),
            story.holdingName() == null ? List.of() : List.of(story.holdingName()), holdings);
    }

    /**
     * Folded names and match terms of the holdings {@code mayName} refuses, minus anything an allowed holding (or one
     * of {@code alsoAllowedNames}) already carries. Shared with {@link WeeklyReviewValidator}.
     */
    static List<String> forbiddenTerms(Predicate<NewsHolding> mayName, Collection<String> alsoAllowedNames,
                                       List<NewsHolding> holdings) {
        Set<String> allowed = new LinkedHashSet<>();
        List<NewsHolding> others = new ArrayList<>();
        for (NewsHolding h : holdings) {
            if (mayName.test(h)) {
                allowed.add(NewsText.fold(h.name()));
                NewsMatcher.termsFor(h).forEach(t -> allowed.add(NewsText.fold(t)));
            } else {
                others.add(h);
            }
        }
        alsoAllowedNames.stream().filter(n -> n != null).forEach(n -> allowed.add(NewsText.fold(n)));
        Set<String> out = new LinkedHashSet<>();
        for (NewsHolding h : others) {
            String name = NewsText.fold(h.name());
            if (!name.isBlank() && !allowed.contains(name)) {
                out.add(name);
            }
            for (String t : NewsMatcher.termsFor(h)) {
                String ft = NewsText.fold(t);
                if (!allowed.contains(ft) && allowed.stream().noneMatch(a -> NewsText.containsTerm(a, ft, false))) {
                    out.add(ft);
                }
            }
        }
        return List.copyOf(out);
    }

    private static boolean mayName(DigestStory story, NewsHolding h) {
        return switch (story.kind()) {
            case HOLDING -> h.id().equals(story.story().key().holdingId());
            case FX -> h.isForeignCurrency();
            case RATES -> h.isBond();
        };
    }

    /** The prose with the story's own horizon phrase taken out (its digits are allowed only there). */
    private static String withoutHorizon(String text, DigestFigures figures) {
        Pattern horizon = figures.horizonPhrase();
        return horizon == null ? text : horizon.matcher(text).replaceAll(" ");
    }

    /** The prose with the story's own ledger name taken out (its digits are not figures). */
    static String withoutOwnName(String text, String holdingName) {
        if (holdingName == null || holdingName.isBlank()) {
            return text;
        }
        return Pattern.compile(Pattern.quote(holdingName.strip()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
            .matcher(text).replaceAll(" ");
    }
}
