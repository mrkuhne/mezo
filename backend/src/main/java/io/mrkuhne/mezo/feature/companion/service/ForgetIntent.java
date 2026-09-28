package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.text.TextFold;
import java.util.regex.Pattern;

/**
 * S8 (mezo-d6ivw.12): "ezt ne jegyezd meg" — a deterministic, deliberately NARROW pre-screen (code
 * decides, the LLM never does). Matched on the {@link TextFold} form (lowercase, accents stripped),
 * so "Ne jegyezd meg" and "ne jegyezd meg" are one phrase. Precision over recall: a missed forget
 * request costs one more sentence from the user; a false positive silently deletes memory.
 *
 * <p>The traps pinned in {@code ForgetIntentTest}: "felejtsd el a tervet" (a plan, not memory),
 * "ne felejtsd el…" (the opposite request), "elfelejtettem" (the user forgot), "jegyezd meg"
 * without the negation.
 */
public final class ForgetIntent {

    /** (1) "ne jegyezd meg" anywhere. */
    private static final Pattern DONT_REMEMBER = Pattern.compile("\\bne\\s+jegyezd\\s+meg\\b");

    /** (2) "felejtsd el" + an explicit memory object — never after "ne". The short pronouns only
     *  count at a clause end ("felejtsd el ezt." yes, "felejtsd el ezt a tervet" no). */
    private static final Pattern FORGET_THAT = Pattern.compile(
            "(?<!\\bne\\s)\\bfelejtsd\\s+el\\s*,?\\s*(?:"
                    + "(?:ezt|azt|ezeket)(?=\\s*(?:[.!?,;]|$))"
                    + "|amit\\s+(?:mondtam|irtam)"
                    + "|az\\s+(?:elozot|elobbit|elobbieket)"
                    + "|mindent)");

    /** (3) the whole message is just the request. */
    private static final Pattern FORGET_ALONE = Pattern.compile(
            "^(?:kerlek\\s*,?\\s*)?felejtsd\\s+el(?:\\s*,?\\s*kerlek)?\\s*[.!]*$");

    /** (4) "ezt ne mentsd / ne tárold", or "ne tárold" anywhere. */
    private static final Pattern DONT_STORE = Pattern.compile(
            "\\b(?:ezt|azt|ezeket)\\s+(?:inkabb\\s+)?ne\\s+(?:mentsd|tarold)\\b|\\bne\\s+tarold\\b");

    private ForgetIntent() {
    }

    public static boolean matches(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String folded = TextFold.fold(text).strip().replaceAll("\\s+", " ");
        return DONT_REMEMBER.matcher(folded).find()
                || FORGET_THAT.matcher(folded).find()
                || FORGET_ALONE.matcher(folded).matches()
                || DONT_STORE.matcher(folded).find();
    }
}
