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
 *       {@code Ft} / {@code HUF} / {@code %} / {@code százalék} / {@code percent} that does not follow a digit
 *       figure (so a percentage is only ever an allowed digit figure). Digits inside an allowed product name are
 *       skipped.</li>
 *   <li><b>Entity Swap</b>: a sleeve's "why" may name only that sleeve's options; the summary and the uncertainty only
 *       the proposal's options; no other catalog product (suggested, declined, another sleeve's) is ever named — not
 *       by its full name, its ticker (the symbol's root before the dot), its ISIN, nor a distinctive short form of
 *       its name ({@link #shortForms}: "MSCI World", "S&P 500", "LifeStrategy", "All-World"). A short form that also
 *       occurs in a name allowed in that field is ambiguous and left alone. <b>And nothing outside his catalog</b>
 *       (mezo-r36n9.121): Hungarian capitalises only proper nouns and sentence starts, so a capitalised word in
 *       mid-sentence, a word with two or more capitals ({@code OTP}, {@code BUX}) anywhere, or a well-known asset
 *       name ({@link #KNOWN_OUTSIDE_NAMES}, {@code Bitcoin} at a sentence start) is a name — and it must be a word of
 *       a catalog product's name or description ({@code Vanguard}, {@code MBH}, inflected allowed) or one of the few
 *       generic words of {@link #NAME_WORD_ALLOW} ({@code Boop}, {@code ETF}, {@code TER}, {@code EU}).</li>
 *   <li><b>Boundary</b> (spec §6): no buy imperative, sell, urge, countdown or return-promise / forecast wording
 *       (HU + EN, folded stems; letter-spaced words joined first; {@code hozam} only inside the server's own option
 *       wording, {@link #OWN_HOZAM_LINES}), no URL, no markup but {@code *emphasis*}, no prompt-leak marker.</li>
 * </ul>
 *
 * <p>The caller validates {@link ProposalNarration#normalised} text (NFKC, no format characters, one kind of space).
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
    private static final Pattern PERCENT_WORD = Pattern.compile("(?<![\\p{L}\\p{N}])(?:szazalek|percent)|%");
    /** Name words that tell no product apart; a short form never starts or ends on one. */
    private static final Set<String> GENERIC_NAME_WORDS = Set.of("ucits", "etf", "etfs", "etc", "etn", "usd", "eur",
        "huf", "chf", "gbp", "acc", "accumulating", "dist", "distributing", "hedged", "core", "bond", "bonds",
        "equity", "fund", "index", "alap", "the", "of", "and", "a", "az", "es", "inc", "plc", "class", "share",
        "shares", "sicav");
    private static final Pattern NAME_EDGE = Pattern.compile("^[^\\p{L}\\p{N}&]+|[^\\p{L}\\p{N}&%]+$");
    private static final Pattern HYPHENATED = Pattern.compile("\\p{L}-\\p{L}");
    /** A lower-to-upper case step after at least two letters: LifeStrategy, not iShares. */
    private static final Pattern CAMEL = Pattern.compile("^\\p{L}{2,}?\\p{Ll}\\p{Lu}");
    private static final Pattern SPACED_LETTERS = Pattern.compile("(?<!\\p{L})\\p{L}(?: \\p{L}(?!\\p{L}))+");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    /** A word for the outside-the-catalog check: letters, digits and {@code &}, at least one letter; split on hyphens. */
    private static final Pattern NAME_TOKEN = Pattern.compile("[\\p{L}\\p{N}&]*\\p{L}[\\p{L}\\p{N}&]*");
    /** What may stand between a sentence end and the next word: spaces, quotes, brackets, emphasis, dashes. */
    private static final Pattern SENTENCE_GAP = Pattern.compile("[\\s\"'„”“»«()*–—-]*$");
    /** Generic words a narration may capitalise mid-sentence or write in capitals (folded). */
    static final Set<String> NAME_WORD_ALLOW = Set.of("boop", "etf", "etfs", "ucits", "ter", "isin", "eu", "huf",
        "eur", "usd", "ft", "magyar", "magyarorszag", "europa", "europai", "allampapir", "allampapirok");
    /** Well-known names outside any catalog, caught even at a sentence start (folded word-start stems). */
    static final List<String> KNOWN_OUTSIDE_NAMES = List.of("bitcoin", "ethereum", "ether", "btc", "solana",
        "dogecoin", "tether", "kriptovalut", "tesla", "apple", "nvidia", "microsoft", "amazon", "alphabet", "google",
        "facebook", "netflix", "otp", "mol", "richter", "telekom", "4ig", "opus", "bux", "nasdaq", "dow jones");

    /** Folded phrases at a word start: buy imperative / sell / urge / countdown / return promise (HU + EN). */
    static final List<String> BOUNDARY_STEMS = List.of(
        // buy imperative, sell
        "vedd meg", "vegyel", "vegyen", "vasarol", "vasarl", "fektess be", "fektesd", "tedd bele", "rakd bele",
        "add el", "adj el", "adja el", "elad", "megvaln", "megvalj", "valj meg", "realizal",
        "megvenn", "vegye meg", "vegyetek", "ertekesits", "szallj ki", "szalljon ki", "zard le", "zarja le",
        // urge, countdown
        "most kell", "azonnal", "haladektalan", "surgos", "siess", "mielott keso", "ne hagyd ki", "utolso esely",
        "napod van", "napon belul", "hatarido", "visszaszaml", "lepned kell", "lepj", "cselekedj", "venni kell",
        "ne hagyja ki", "ne maradj le", "ne maradjon le", "ne varj", "minel elobb", "most erdemes", "most eri meg",
        // return promise, forecast
        "garantal", "biztos nyereseg", "biztos hozam", "biztosan no", "biztosan nov", "biztosan hoz",
        "biztosan emelk", "biztosan gyarapod", "biztosan megter", "megterul", "kockazatmentes",
        "hozam", "hozhat", "nyereseges lesz", "nyeresegesek lesz", "no majd", "nonek majd", "fog no", "fognak no",
        "noni fog", "novekedni fog", "emelkedni fog", "emelkedik majd", "duplaz", "megduplaz", "varhatoan",
        // English
        "buy", "sell", "invest now", "act now", "urgent", "hurry", "guarantee", "risk-free", "risk free",
        "sure profit", "will grow", "will double", "expected return", "cannot lose", "can't lose");
    /**
     * The only places {@code hozam} may stand (folded, exact): the server's own option lines
     * ({@code ProductOptions} accumulating vs distributing) and the fallback's "no return claim" sentence.
     */
    static final List<String> OWN_HOZAM_LINES = List.of(
        "ujrabefekteti a hozamot", "kifizeti a hozamot", "a jovobeli hozamrol semmit nem allitok");
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
     * Every violation of {@code narration} against the proposal's {@code figures}; {@code catalog} = every product in
     * his catalog (any status). Empty = it may stand.
     */
    public static List<DigestViolation> validate(ProposalNarration narration, ProposalFigures figures,
                                                 List<CatalogProduct> catalog) {
        List<DigestViolation> out = new ArrayList<>();
        List<String> allOffered = figures.sleeves().stream().flatMap(s -> s.names().stream()).distinct().toList();
        Map<String, Field> fields = new LinkedHashMap<>();
        fields.put("summary", new Field(narration.summary(), SUMMARY_MAX, allOffered));
        for (Sleeve s : Sleeve.values()) {
            fields.put("why." + s.wire(), new Field(narration.why(s), WHY_MAX, figures.options(s).names()));
        }
        fields.put("uncertainty", new Field(narration.uncertainty(), UNCERTAINTY_MAX, allOffered));
        Set<String> known = knownNameWords(catalog);

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
            if (namesForbiddenProduct(folded, catalog, f.allowedNames())) {
                out.add(new DigestViolation(Rule.ENTITY_SWAP, field, "names a product that is not offered here"));
            }
            if (namesOutsideTheCatalog(prose, folded, known)) {
                out.add(new DigestViolation(Rule.ENTITY_SWAP, field, "names a product outside his catalog"));
            }
            if (anyStem(withoutOwnHozamLines(folded), BOUNDARY_STEMS)
                || anyStem(withoutOwnHozamLines(joined), BOUNDARY_STEMS)) {
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
        if (spelledNumber(folded) || notAfterDigit(folded, MONEY_ABBR) || notAfterDigit(folded, PERCENT_WORD)) {
            out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number in words or a bare money word"));
        }
    }

    /**
     * A catalog product not allowed here, named by its full name (folded, whole word; 5+ characters may carry a
     * Hungarian ending), a distinctive short form of it (unless that also occurs in an allowed name), its ticker root
     * or its ISIN (whole word, no ending).
     */
    private static boolean namesForbiddenProduct(String folded, List<CatalogProduct> catalog, List<String> allowed) {
        Set<String> allowedFolded = new LinkedHashSet<>();
        allowed.forEach(n -> allowedFolded.add(NewsText.fold(n)));
        for (CatalogProduct p : catalog) {
            String term = NewsText.fold(p.name());
            if (term.isBlank() || allowedFolded.contains(term)) {
                continue;
            }
            if (NewsText.containsTerm(folded, term, term.length() >= 5)) {
                return true;
            }
            for (String form : shortForms(p.name())) {
                boolean ambiguous = allowedFolded.stream().anyMatch(a -> NewsText.containsTerm(a, form, false));
                if (!ambiguous && NewsText.containsTerm(folded, form, form.length() >= 5)) {
                    return true;
                }
            }
            for (String code : codes(p)) {
                if (NewsText.containsTerm(folded, code, false)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * mezo-r36n9.121 — a name that is no word of his catalog: a capitalised word in mid-sentence, a word with two or
     * more capitals anywhere, or a {@link #KNOWN_OUTSIDE_NAMES} stem anywhere, unless it is a {@code known} word
     * (exact, or a known word of 3+ letters carrying a Hungarian ending of up to 7 letters).
     */
    private static boolean namesOutsideTheCatalog(String prose, String folded, Set<String> known) {
        Matcher m = NAME_TOKEN.matcher(prose);
        while (m.find()) {
            for (String part : m.group().split("-")) {
                if (part.isEmpty() || part.codePoints().noneMatch(Character::isLetter)) {
                    continue;
                }
                long capitals = part.codePoints().filter(Character::isUpperCase).count();
                boolean name = capitals >= 2
                    || (Character.isUpperCase(part.codePointAt(0)) && !sentenceStart(prose, m.start()));
                if (name && !knownWord(NewsText.fold(part), known)) {
                    return true;
                }
            }
        }
        Matcher w = NAME_TOKEN.matcher(folded);
        while (w.find()) {
            String word = w.group();
            if (!knownWord(word, known) && KNOWN_OUTSIDE_NAMES.stream().anyMatch(word::startsWith)) {
                return true;
            }
        }
        return KNOWN_OUTSIDE_NAMES.stream().filter(n -> n.contains(" "))
            .anyMatch(n -> NewsText.containsStem(folded, n));
    }

    /** True at the text's start or after a sentence end ({@code . ! ? :} or a line break). */
    private static boolean sentenceStart(String prose, int index) {
        String before = prose.substring(0, index);
        String rest = SENTENCE_GAP.matcher(before).replaceFirst("");
        if (rest.isEmpty()) {
            return true;
        }
        char c = rest.charAt(rest.length() - 1);
        return c == '.' || c == '!' || c == '?' || c == ':' || c == '\n'
            || (before.length() > rest.length() && before.substring(rest.length()).contains("\n"));
    }

    private static boolean knownWord(String folded, Set<String> known) {
        if (known.contains(folded) || NAME_WORD_ALLOW.contains(folded)) {
            return true;
        }
        for (String k : known) {
            if (k.length() >= 3 && folded.startsWith(k) && folded.length() - k.length() <= 7
                && folded.substring(k.length()).codePoints().allMatch(Character::isLetter)) {
                return true;
            }
        }
        return false;
    }

    /** Every folded word of every catalog product's name and description (split on hyphens). */
    private static Set<String> knownNameWords(List<CatalogProduct> catalog) {
        Set<String> out = new LinkedHashSet<>();
        for (CatalogProduct p : catalog) {
            for (String text : new String[] {p.name(), p.whatItIs()}) {
                Matcher m = NAME_TOKEN.matcher(NewsText.fold(text));
                while (m.find()) {
                    for (String part : m.group().split("-")) {
                        if (!part.isEmpty()) {
                            out.add(part);
                        }
                    }
                }
            }
        }
        return out;
    }

    /**
     * The distinctive short forms of a product name, folded: every run of two or more consecutive name words that
     * starts on a distinctive word (not {@link #GENERIC_NAME_WORDS}, has a letter) and does not end on a generic one
     * ("msci world", "s&p 500", "global aggregate"), plus single hyphenated or CamelCase words ("all-world",
     * "lifestrategy"). The full name itself is checked separately.
     */
    static List<String> shortForms(String name) {
        List<String> words = new ArrayList<>();
        Set<String> out = new LinkedHashSet<>();
        for (String raw : (name == null ? "" : name.strip()).split("\\s+")) {
            String w = NAME_EDGE.matcher(raw).replaceAll("");
            if (w.isEmpty()) {
                continue;
            }
            String f = NewsText.fold(w);
            words.add(f);
            if (f.length() >= 5 && (HYPHENATED.matcher(w).find() || CAMEL.matcher(w).find())) {
                out.add(f);
            }
        }
        String full = String.join(" ", words);
        for (int i = 0; i < words.size(); i++) {
            if (!distinctive(words.get(i))) {
                continue;
            }
            for (int j = i + 1; j < words.size(); j++) {
                if (GENERIC_NAME_WORDS.contains(words.get(j))) {
                    continue;
                }
                String run = String.join(" ", words.subList(i, j + 1));
                if (!run.equals(full)) {
                    out.add(run);
                }
            }
        }
        return List.copyOf(out);
    }

    private static boolean distinctive(String word) {
        return !GENERIC_NAME_WORDS.contains(word) && word.codePoints().anyMatch(Character::isLetter);
    }

    /** The ticker's root before the dot (3+ characters) and the ISIN, folded. */
    private static List<String> codes(CatalogProduct p) {
        List<String> out = new ArrayList<>();
        if (p.symbol() != null) {
            String root = NewsText.fold(p.symbol().split("\\.", 2)[0]);
            if (root.length() >= 3) {
                out.add(root);
            }
        }
        if (p.isin() != null && !p.isin().isBlank()) {
            out.add(NewsText.fold(p.isin()));
        }
        return out;
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

    /** A unit word ({@code Ft} / {@code HUF}, {@code %} / {@code százalék} / {@code percent}) not right after a digit. */
    private static boolean notAfterDigit(String folded, Pattern unit) {
        Matcher m = unit.matcher(folded);
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

    private static String withoutOwnHozamLines(String folded) {
        String out = folded;
        for (String line : OWN_HOZAM_LINES) {
            out = out.replace(line, " ");
        }
        return out;
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
