package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * mezo-q0p5a: the companion has NO write tools (ArchUnit-enforced) — every registered tool is a
 * read — yet in production it answered "Felírtam: taco, fehérjeszelet, banán." and the user
 * believed the food was logged. It was not: silent data loss. Task 1 (mezo-rj214.7) told the live
 * voice not to fabricate action claims; this check is the backstop, because the prompt ALREADY
 * forbade it when that answer shipped — asking nicely has a demonstrated failure rate here.
 *
 * <p>Deterministic (a fixed term list, no LLM), accent-folded like {@link ClinicalOutputCheck}.
 * Precision over recall on purpose: the terms are complete, already-conjugated first-person
 * PAST-tense forms (e.g. "felírtam", not the stem "felír"), matched as whole words (not a raw
 * substring) and excluded when the immediately preceding word is a negator ("nem" / "sem" /
 * "sosem", or the interposed "nem is") — so an offer ("felírhatod"), an instruction ("felírni"),
 * a second-person form, a negation that separates a verb prefix ("nem írtam fel"), and a plain
 * negation in front of a term with no separable prefix ("nem naplóztam") all fail to fire. A
 * bounded list cannot separate every Hungarian inflection from the claim it resembles; when in
 * doubt this check stays silent rather than rewriting an honest answer — see the task-2 report
 * for the cases this trades away.
 */
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
public class ActionClaimCheck {

    static final String CHECK_NAME = "action-claim";

    /**
     * Single-word negators that, as the token immediately before a term, negate it: "nem
     * naplóztam" / "sem törölte" / "sosem rögzítettem". "is" is a special case — it interposes
     * between "nem" and the verb ("nem is naplóztam"), so it is only a negator when the token
     * before IT is "nem" (handled explicitly below, not listed here).
     */
    private static final Set<String> SINGLE_TOKEN_NEGATORS = Set.of("nem", "sem", "sosem");

    /** Word tokens (letter runs) with their start offsets, for whole-word matching. */
    private static final Pattern WORD = Pattern.compile("\\p{L}+");

    private final List<String> actionClaimTerms;

    @Autowired
    public ActionClaimCheck(CompanionProperties properties) {
        this(properties.advisors().actionClaimTerms());
    }

    ActionClaimCheck(List<String> actionClaimTerms) {
        this.actionClaimTerms = actionClaimTerms.stream().map(ActionClaimCheck::fold).toList();
    }

    public Optional<AdvisorViolation> check(String answer) {
        if (answer == null || answer.isBlank()) {
            return Optional.empty();
        }
        String folded = fold(answer);
        if (hasUnnegatedClaim(folded)) {
            return Optional.of(new AdvisorViolation(CHECK_NAME,
                    "A válasz múlt idejű, első személyű cselekvés-állítást tartalmaz (pl. "
                            + "\"felírtam\"), de a companion-nak nincs írási eszköze — nem hajtott "
                            + "végre semmilyen módosítást. Fogalmazd át ajánlásként vagy útmutatásként "
                            + "(pl. \"ezt te tudod felírni\"), ne kész tényként."));
        }
        return Optional.empty();
    }

    /**
     * True if a configured term appears as a whole word in {@code folded} and is NOT immediately
     * preceded by a negator token ("nem" / "sem" / "sosem", or the interposed "nem is"). Four of
     * the nine configured terms have no separable verb prefix (naplóztam, rögzítettem,
     * módosítottam, töröltem), so their negation is a plain "nem " in front rather than a split
     * preverb — a bare {@code contains} would fire on the honest refusal "Nem naplóztam ezt…".
     * Tokenizing catches that case AND doubles as the whole-word check that a naive
     * {@code indexOf} would need separately (no substring-inside-another-word false positive).
     */
    private boolean hasUnnegatedClaim(String folded) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = WORD.matcher(folded);
        while (matcher.find()) {
            tokens.add(matcher.group());
        }
        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);
            if (!actionClaimTerms.contains(token)) {
                continue;
            }
            String prev = i >= 1 ? tokens.get(i - 1) : null;
            String prevPrev = i >= 2 ? tokens.get(i - 2) : null;
            boolean negated = (prev != null && SINGLE_TOKEN_NEGATORS.contains(prev))
                    || ("is".equals(prev) && "nem".equals(prevPrev));
            if (!negated) {
                return true;
            }
        }
        return false;
    }

    /** Lowercase + NFD accent-strip — "Felírtam" -> "felirtam", matches without diacritics. */
    private static String fold(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
