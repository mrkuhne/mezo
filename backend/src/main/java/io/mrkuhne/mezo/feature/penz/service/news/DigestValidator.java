package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.service.guard.HufAmountGuard;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The deterministic gate on every narrated digest item (Boop Pénz L6, mezo-r36n9.104, build notes §4) — the real
 * defence against a model that invents, swaps, flips or obeys an injected article. Pure; an item with any violation
 * is replaced by {@link DigestFallbackCopy}.
 *
 * <ul>
 *   <li><b>Shape</b>: every text field non-blank and within its cap (title {@value #TITLE_MAX}, verdict
 *       {@value #VERDICT_MAX}, body {@value #BODY_MAX}, uncertainty {@value #UNCERTAINTY_MAX}, noAction
 *       {@value #NO_ACTION_MAX}); confidence 0..2.</li>
 *   <li><b>Numerical Error</b>: every number in the prose (Hungarian formats normalized: {@code 18 400},
 *       {@code 18.400}, {@code 1,1}) is one of the story's {@link DigestFigures#allowedNumbers}, and
 *       {@link HufAmountGuard#verdict} passes every field against {@link DigestFigures#allowedHufMinor}. Numbers inside
 *       the story's own ledger name are not prose and are skipped.</li>
 *   <li><b>Entity Swap</b>: no other holding's name or match terms. A macro story may name the holdings it moves
 *       ({@code fx}: the non-HUF ones, {@code rates}: the bonds).</li>
 *   <li><b>Negation Flip</b> (holding stories, non-zero effect): no rise word in title + verdict when the effect is
 *       negative, no fall word when it is positive (HU + EN).</li>
 *   <li><b>Temporal Confusion</b>: no year and no weekday name — the figures carry no date (other dates are numbers and
 *       fail the number rule).</li>
 *   <li><b>Boundary</b> (spec §6): no buy / sell / urge / return-promise wording (HU + EN), no URL, no markup but
 *       {@code *emphasis*}, no prompt-leak marker.</li>
 * </ul>
 */
public final class DigestValidator {

    public static final int TITLE_MAX = 120;
    public static final int VERDICT_MAX = 220;
    public static final int BODY_MAX = 1_800;
    public static final int UNCERTAINTY_MAX = 500;
    public static final int NO_ACTION_MAX = 300;

    private static final Pattern YEAR = Pattern.compile("(?<!\\d)(?:19|20)\\d{2}(?!\\d)");

    private static final List<String> WEEKDAYS = List.of(
        "hetfo", "kedd", "szerda", "csutortok", "pentek", "szombat", "vasarnap",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");

    /** Word-start stems (folded). */
    private static final List<String> FALL_STEMS = List.of(
        "esett", "eses", "csokken", "gyengul", "zuhan", "visszaes", "merseklod", "veszit", "veszteseg",
        "declin", "slump", "plung", "tumbl");
    private static final List<String> FALL_WORDS = List.of("fell", "fall", "falls", "falling", "drop", "drops",
        "dropped", "slid", "slide", "lost", "loses");
    private static final List<String> RISE_STEMS = List.of(
        "emelked", "nott", "novek", "erosod", "dragul", "szarnyal", "felfut", "ugrott", "javult",
        "climb", "surg", "rall");
    private static final List<String> RISE_WORDS = List.of("rose", "rise", "rises", "rising", "gain", "gains",
        "gained", "jump", "jumps", "jumped");

    /** Folded phrases at a word start: buy / sell / urge / promise. */
    private static final List<String> BOUNDARY_STEMS = List.of(
        "vedd meg", "vegyel", "vegyen", "vasarolj", "add el", "adj el", "adja el", "eladni", "venni kell",
        "most kell", "azonnal", "surgos", "garantal", "biztos nyereseg", "biztos hozam", "lepned kell",
        "lepj", "cselekedj", "ne hagyd ki", "utolso esely");
    private static final List<String> BOUNDARY_WORDS = List.of(
        "buy", "buying", "buys", "sell", "selling", "sells", "urgent", "guaranteed", "act now");
    private static final List<String> LEAK_STEMS = List.of(
        "boop_penz", "article", "utasitas", "instruction", "ignore", "system", "prompt", "figures");
    private static final Pattern URL = Pattern.compile(
        "https?:|www\\.|\\b[a-z0-9-]+\\.(?:com|hu|net|org|io|eu|uk|co|info|biz|example)\\b", Pattern.CASE_INSENSITIVE);
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
        Set<String> allowedNumbers = figures.allowedNumbers();
        List<String> forbiddenTerms = forbiddenTerms(story, holdings);

        for (Map.Entry<String, String> f : fields.entrySet()) {
            String field = f.getKey();
            String raw = f.getValue() == null ? "" : f.getValue();
            String prose = withoutOwnName(raw, story.holdingName());
            String folded = NewsText.fold(prose);

            if (YEAR.matcher(prose).find()) {
                out.add(new DigestViolation(Rule.TEMPORAL_CONFUSION, field, "year"));
            }
            if (WEEKDAYS.stream().anyMatch(w -> NewsText.containsStem(folded, w))) {
                out.add(new DigestViolation(Rule.TEMPORAL_CONFUSION, field, "weekday"));
            }
            String noYears = YEAR.matcher(prose).replaceAll(" ");
            if (DigestFigures.numbersIn(noYears).stream().anyMatch(n -> !allowedNumbers.contains(n))) {
                out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "number not among the figures"));
            }
            if (!HufAmountGuard.verdict(noYears, figures.allowedHufMinor(), Long.MAX_VALUE).isOk()) {
                out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "forint amount not among the figures"));
            }
            if (forbiddenTerms.stream().anyMatch(t -> NewsText.containsTerm(folded, t, t.length() >= 5))) {
                out.add(new DigestViolation(Rule.ENTITY_SWAP, field, "names another holding"));
            }
            if (BOUNDARY_STEMS.stream().anyMatch(s -> NewsText.containsStem(folded, s))
                || BOUNDARY_WORDS.stream().anyMatch(w -> NewsText.containsTerm(folded, w, false))) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "buy, sell, urge or promise wording"));
            }
            if (URL.matcher(raw).find()) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "url"));
            }
            if (MARKUP.matcher(raw).find()) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "markup"));
            }
            if (LEAK_STEMS.stream().anyMatch(s -> NewsText.containsStem(folded, s))) {
                out.add(new DigestViolation(Rule.BOUNDARY, field, "prompt-leak marker"));
            }
        }
        checkDirection(item, story, out);
        return out;
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

    private static void checkDirection(DigestModelItem item, DigestStory story, List<DigestViolation> out) {
        long effect = story.figures().effectHufMinor();
        if (story.kind() != DigestKind.HOLDING || effect == 0) {
            return;
        }
        String folded = NewsText.fold(withoutOwnName(nz(item.title()) + " . " + nz(item.verdict()),
            story.holdingName()));
        boolean rise = RISE_STEMS.stream().anyMatch(s -> NewsText.containsStem(folded, s))
            || RISE_WORDS.stream().anyMatch(w -> NewsText.containsTerm(folded, w, false));
        boolean fall = FALL_STEMS.stream().anyMatch(s -> NewsText.containsStem(folded, s))
            || FALL_WORDS.stream().anyMatch(w -> NewsText.containsTerm(folded, w, false));
        if ((effect < 0 && rise) || (effect > 0 && fall)) {
            out.add(new DigestViolation(Rule.NEGATION_FLIP, "title+verdict", "direction contradicts the effect sign"));
        }
    }

    /** Folded names and match terms of the holdings this story must not name. */
    static List<String> forbiddenTerms(DigestStory story, List<NewsHolding> holdings) {
        Set<String> allowed = new LinkedHashSet<>();
        List<NewsHolding> others = new ArrayList<>();
        for (NewsHolding h : holdings) {
            if (mayName(story, h)) {
                allowed.add(NewsText.fold(h.name()));
                NewsMatcher.termsFor(h).forEach(t -> allowed.add(NewsText.fold(t)));
            } else {
                others.add(h);
            }
        }
        if (story.holdingName() != null) {
            allowed.add(NewsText.fold(story.holdingName()));
        }
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

    /** The prose with the story's own ledger name taken out (its digits are not figures). */
    private static String withoutOwnName(String text, String holdingName) {
        if (holdingName == null || holdingName.isBlank()) {
            return text;
        }
        return Pattern.compile(Pattern.quote(holdingName.strip()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
            .matcher(text).replaceAll(" ");
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
