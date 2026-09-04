package io.mrkuhne.mezo.feature.proactive.service;

import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * "The model never invents a number" (spec §5), enforced deterministically. The refs idiom
 * (model selects a candidate BY INDEX) has no analogue for free prose, so the advice card checks
 * the answer instead: every numeral token in the prose must be a token in the grounding text
 * (the facts + suggestions the call was given). The prompt itself asks for number-free prose, so
 * in practice this guard fires only on an actual fabrication.
 *
 * <p>Conservative by design: an ungrounded numeral drops the WHOLE answer in favour of the
 * template prose. A card is never dropped, only its wording downgraded.
 */
public final class ProseNumberGuard {

    private static final Pattern NUMERAL = Pattern.compile("\\d+(?:[.,]\\d+)?");

    private ProseNumberGuard() {
    }

    public static boolean grounded(String prose, String grounding) {
        if (prose == null || prose.isBlank()) {
            return false;
        }
        Set<String> groundedNumerals = extractNumerals(grounding);
        return NUMERAL.matcher(prose).results()
            .map(match -> normalise(match.group()))
            .allMatch(groundedNumerals::contains);
    }

    /** Extract and normalise all numeral tokens from the text. */
    private static Set<String> extractNumerals(String text) {
        if (text == null) {
            return Set.of();
        }
        return NUMERAL.matcher(text).results()
            .map(match -> normalise(match.group()))
            .collect(Collectors.toSet());
    }

    /** Decimal comma and dot mean the same number — the facts render with a comma (Hungarian),
     *  a model may answer with either. */
    private static String normalise(String text) {
        return text.replace(',', '.');
    }
}
