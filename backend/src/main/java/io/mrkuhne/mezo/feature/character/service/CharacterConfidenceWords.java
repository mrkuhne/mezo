package io.mrkuhne.mezo.feature.character.service;

import java.math.BigDecimal;

/**
 * The one shared confidence -> human-word mapping (Karakter spec §4/§8): confidence is NEVER
 * surfaced as a raw decimal, only as {@code biztos}/{@code valószínű}/{@code figyeljük} — the
 * vocabulary {@link PortraitWriter} originated for its portrait-rewrite user message and
 * {@link CharacterPromptAssembler} reuses verbatim for the {@code [Karakter]} prompt block, so the
 * two surfaces can never disagree about what a given confidence "means" in words.
 */
final class CharacterConfidenceWords {

    private static final BigDecimal SURE_THRESHOLD = new BigDecimal("0.75");
    private static final BigDecimal LIKELY_THRESHOLD = new BigDecimal("0.50");

    private CharacterConfidenceWords() {}

    static String word(BigDecimal confidence) {
        if (confidence.compareTo(SURE_THRESHOLD) >= 0) {
            return "biztos";
        }
        if (confidence.compareTo(LIKELY_THRESHOLD) >= 0) {
            return "valószínű";
        }
        return "figyeljük";
    }
}
