package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The deterministic gate on every narrated weekly review section (mezo-r36n9.120) — the {@link DigestValidator} rule
 * families, reused through its shared helpers, on the section's four prose fields. Pure; a section with any violation
 * is replaced by {@link WeeklyReviewFallbackCopy}.
 *
 * <ul>
 *   <li><b>Shape</b>: verdict ≤ {@value #VERDICT_MAX}, body ≤ {@value #BODY_MAX}, uncertainty ≤
 *       {@value #UNCERTAINTY_MAX}, noAction ≤ {@value #NO_ACTION_MAX}, all non-blank; {@code matters} a boolean; a
 *       section that says it matters relies on at least one of its own stories (unknown ids are ignored).</li>
 *   <li><b>Numerical Error</b>: every number is one of the section's figures (story count, source count, coverage
 *       months); no % at all; no scale word / other currency next to a figure; the horizon digits only inside the
 *       sleeve's own horizon phrase; {@code HufAmountGuard.verdict} against an EMPTY allowed set (the weekly review
 *       has no forint figure — any forint amount is invented); no spelled-out number beyond egy..hat, no bare
 *       {@code Ft}. Digits inside the section's ledger names are skipped. <b>And a figure only next to its own
 *       label</b> (mezo-r36n9.129): within the next three words a story count is followed by a story word
 *       ({@code hír}, {@code cikk}), a source count by {@code forrás}, the coverage months by {@code hónap} — so a
 *       story count of 12 cannot pose as "12 hónapnyi fedezet".</li>
 *   <li><b>Entity Swap</b>: only holdings of this section (its sleeve's live holdings and the stories' own) may be
 *       named — no other holding's name or match terms.</li>
 *   <li><b>Negation Flip</b>: no figure has a direction, so only the sign rule — no signed figure.</li>
 *   <li><b>Temporal Confusion</b>: no year and no weekday name.</li>
 *   <li><b>Boundary</b> (spec §6): buy / sell / urge / promise stems (also letter-spaced), no URL, no markup but
 *       {@code *emphasis*}, no prompt-leak marker (the digest's plus {@code story}, {@code section}, {@code sleeve}).</li>
 * </ul>
 */
public final class WeeklyReviewValidator {

    public static final int VERDICT_MAX = 220;
    public static final int BODY_MAX = 1_200;
    public static final int UNCERTAINTY_MAX = 500;
    public static final int NO_ACTION_MAX = 300;

    static final List<String> LEAK_STEMS;

    static {
        List<String> stems = new ArrayList<>(DigestValidator.LEAK_STEMS);
        stems.addAll(List.of("story", "section", "sleeve"));
        LEAK_STEMS = List.copyOf(stems);
    }

    private WeeklyReviewValidator() {
    }

    /** Every violation of {@code m} narrating {@code section}, given all of his live holdings; empty = it may stand. */
    public static List<DigestViolation> validate(WeeklyModelSection m, WeeklySection section,
                                                 List<NewsHolding> holdings) {
        List<DigestViolation> out = new ArrayList<>();
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("verdict", m.verdict());
        fields.put("body", m.body());
        fields.put("uncertainty", m.uncertainty());
        fields.put("noAction", m.noAction());
        checkShape(m, section, fields, out);

        WeeklyFigures figures = section.figures();
        Set<String> mayName = new LinkedHashSet<>(section.mayNameNames());
        List<String> forbidden = DigestValidator.forbiddenTerms(
            h -> section.sleeve().equals(h.sleeve()) || mayName.contains(h.name()), mayName, holdings);
        Pattern horizon = figures.horizonPhrase();
        for (Map.Entry<String, String> f : fields.entrySet()) {
            String field = f.getKey();
            String raw = f.getValue() == null ? "" : f.getValue();
            String prose = withoutNames(raw, mayName);
            String folded = NewsText.fold(prose);
            String joined = DigestValidator.joinSpacedLetters(prose);
            String noHorizon = horizon == null ? prose : horizon.matcher(prose).replaceAll(" ");

            DigestValidator.checkTemporal(field, prose, folded, out);
            DigestValidator.checkNumbers(field, noHorizon, figures.allowedNumbers(), null, Set.of(), out);
            checkLabelled(field, noHorizon, figures, out);
            DigestValidator.checkSigned(field, noHorizon, out);
            DigestValidator.checkEntities(field, folded, forbidden, out);
            DigestValidator.checkBoundary(field, raw, folded, joined, LEAK_STEMS, out);
        }
        return out;
    }

    private static final Pattern NEXT_WORDS = Pattern.compile("^[\\s\\p{Punct}–—]*((?:\\p{L}+[\\s\\p{Punct}–—]*){1,3})");
    private static final List<String> STORY_WORDS = List.of("hir", "cikk", "tortenet");
    private static final List<String> SOURCE_WORDS = List.of("forras");
    private static final List<String> COVERAGE_WORDS = List.of("honap");

    /**
     * mezo-r36n9.129 — every digit figure must be followed, within three words, by its own label: a story count by a
     * story word, a source count by a source word, the coverage months by a month word. A value shared by two figures
     * may stand next to either label.
     */
    static void checkLabelled(String field, String text, WeeklyFigures figures, List<DigestViolation> out) {
        Matcher m = DigestFigures.NUMBER.matcher(text);
        while (m.find()) {
            String token = DigestFigures.normalizeNumber(m.group());
            Matcher next = NEXT_WORDS.matcher(text.substring(m.end()));
            String words = next.find() ? NewsText.fold(next.group(1)) : "";
            boolean ok = (token.equals(String.valueOf(figures.storyCount())) && labelled(words, STORY_WORDS))
                || (token.equals(String.valueOf(figures.sourceCount())) && labelled(words, SOURCE_WORDS))
                || (figures.coverageMonths() != null
                    && token.equals(String.valueOf(Math.abs(figures.coverageMonths())))
                    && labelled(words, COVERAGE_WORDS));
            if (!ok) {
                out.add(new DigestViolation(Rule.NUMERICAL_ERROR, field, "figure away from its own label"));
                return;
            }
        }
    }

    private static boolean labelled(String foldedWords, List<String> stems) {
        for (String w : foldedWords.split("[^\\p{L}]+")) {
            if (stems.stream().anyMatch(w::startsWith)) {
                return true;
            }
        }
        return false;
    }

    /** The section's own story ids among {@code storyIds}, in the model's order (unknown ids ignored). */
    public static List<String> knownStoryIds(WeeklyModelSection m, WeeklySection section) {
        Set<String> own = new LinkedHashSet<>();
        section.stories().forEach(i -> own.add(i.id()));
        Set<String> out = new LinkedHashSet<>();
        m.storyIds().stream().filter(own::contains).forEach(out::add);
        return List.copyOf(out);
    }

    private static void checkShape(WeeklyModelSection m, WeeklySection section, Map<String, String> fields,
                                   List<DigestViolation> out) {
        Map<String, Integer> caps = Map.of("verdict", VERDICT_MAX, "body", BODY_MAX, "uncertainty", UNCERTAINTY_MAX,
            "noAction", NO_ACTION_MAX);
        for (Map.Entry<String, String> f : fields.entrySet()) {
            String v = f.getValue();
            if (v == null || v.isBlank()) {
                out.add(new DigestViolation(Rule.SHAPE, f.getKey(), "empty"));
            } else if (v.strip().length() > caps.get(f.getKey())) {
                out.add(new DigestViolation(Rule.SHAPE, f.getKey(), "too long"));
            }
        }
        if (m.matters() == null) {
            out.add(new DigestViolation(Rule.SHAPE, "matters", "not a boolean"));
        } else if (m.matters() && knownStoryIds(m, section).isEmpty()) {
            out.add(new DigestViolation(Rule.SHAPE, "storyIds", "matters without one of its stories"));
        }
    }

    /** The prose with the section's ledger names taken out (their digits are not figures), longest first. */
    private static String withoutNames(String text, Set<String> names) {
        String t = text;
        List<String> sorted = names.stream().filter(n -> n != null && !n.isBlank())
            .sorted((a, b) -> Integer.compare(b.length(), a.length())).toList();
        for (String n : sorted) {
            t = DigestValidator.withoutOwnName(t, n);
        }
        return t;
    }
}
