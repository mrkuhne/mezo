package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The figures of one weekly review section (mezo-r36n9.120) — computed by the backend, never by the model (spec §6)
 * — and their one spelling (plain digits, thousands grouped like {@link DigestFigures}). These are the only numbers
 * the section's narration may contain ({@link WeeklyReviewValidator}); most sections need none.
 *
 * @param sleeve         short | mid | long
 * @param storyCount     the week's distinct stories in this sleeve
 * @param sourceCount    the distinct source names behind them
 * @param holdingNames   the holdings those stories touch, as his ledger names them
 * @param coverageMonths the long sleeve's coverage of his fixed costs in months (as Pénzem computes it); null for the
 *                       other sleeves and when unknown
 */
public record WeeklyFigures(String sleeve, int storyCount, int sourceCount, List<String> holdingNames,
                            Integer coverageMonths) {

    public WeeklyFigures {
        holdingNames = holdingNames == null ? List.of() : List.copyOf(holdingNames);
    }

    /** {@code 1–3 év} / {@code 5–10 év} / {@code 10+ év}. */
    public String horizonLabel() {
        return DigestFigures.sleeveLabel(sleeve);
    }

    /** The sleeve's own horizon phrase — its digits are allowed only inside it. */
    public Pattern horizonPhrase() {
        return DigestFigures.horizonPhrase(sleeve);
    }

    /** Every number the prose may contain, normalized like {@link DigestFigures#normalizeNumber}. */
    public Set<String> allowedNumbers() {
        Set<String> out = new LinkedHashSet<>();
        out.add(String.valueOf(storyCount));
        out.add(String.valueOf(sourceCount));
        if (coverageMonths != null) {
            out.add(String.valueOf(Math.abs(coverageMonths)));
        }
        return out;
    }

    /** The FIGURES lines of the prompt, Hungarian. */
    public List<String> figureLines() {
        List<String> lines = new ArrayList<>();
        lines.add("Hírek a héten: " + DigestFigures.group(storyCount));
        lines.add("Különböző források: " + DigestFigures.group(sourceCount));
        if (coverageMonths != null) {
            lines.add("Fedezet: " + DigestFigures.group(Math.abs(coverageMonths)) + " hónapnyi fix költség");
        }
        return lines;
    }
}
