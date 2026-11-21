package io.mrkuhne.mezo.techcore.text;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The "the model never brings a number" guard (Boop B7, mezo-r36n9.17), shared from {@code techcore} because both the
 * brief's capacity reason ({@code feature.boop}) and the proposal wording ({@code feature.capacity}) use it and
 * neither may import the other. A model text passes only if every digit run in it also appears in the facts.
 */
public final class DigitGuard {

    private static final Pattern DIGITS = Pattern.compile("\\d+");

    private DigitGuard() {
    }

    /** True when every digit run of {@code text} is one of the digit runs of {@code facts} (null text passes). */
    public static boolean onlyKnownDigits(String text, String facts) {
        if (text == null) {
            return true;
        }
        Set<String> allowed = new HashSet<>();
        if (facts != null) {
            DIGITS.matcher(facts).results().forEach(m -> allowed.add(m.group()));
        }
        return DIGITS.matcher(text).results().allMatch(m -> allowed.contains(m.group()));
    }

    /** {@code modelText} when it is non-blank and brings no new digit run, else {@code facts}. */
    public static String acceptOrFacts(String modelText, String facts) {
        if (modelText == null || modelText.isBlank() || !onlyKnownDigits(modelText, facts)) {
            return facts;
        }
        return modelText;
    }
}
