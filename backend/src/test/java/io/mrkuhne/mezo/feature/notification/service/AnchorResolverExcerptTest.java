package io.mrkuhne.mezo.feature.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * Boundary coverage for {@link AnchorResolver#excerptProse(String, int)} (bd mezo-h4wp.6.2) — the
 * prose-excerpt cut every {@code briefing}/{@code midday}/{@code weekly}/{@code memoir} push body
 * goes through. A pure function of its two arguments, so — like {@link PushSenderTruncationTest}
 * next to it — a plain unit test is the right shape: no Spring context, no 12-collaborator
 * {@code AnchorResolver} construction needed.
 *
 * <p>Two properties matter and neither was pinned before this test existed: the cut lands on a
 * <b>word boundary</b> (never mid-word), and it is <b>surrogate-safe</b> (never leaves a lone
 * high/low surrogate — that turns into {@code ?} on the wire once the payload is UTF-8 encoded).
 * A prose body over {@code prose-excerpt-chars} (160) is the normal case in production, so this
 * path runs every day, not just on an edge case.
 */
class AnchorResolverExcerptTest {

    /** U+1F600 GRINNING FACE — a supplementary code point, i.e. a surrogate PAIR in Java. */
    private static final String EMOJI = "😀";

    @Test
    void testExcerptProse_shouldReturnNull_whenTextIsNull() {
        assertThat(AnchorResolver.excerptProse(null, 160)).isNull();
    }

    @Test
    void testExcerptProse_shouldReturnItUnchanged_whenTextIsShorterThanTheLimit() {
        String text = "Rövid mondat, ehhez nem kell vágás.";

        assertThat(AnchorResolver.excerptProse(text, 160)).isEqualTo(text);
    }

    @Test
    void testExcerptProse_shouldReturnItUnchanged_whenTextExactlyFillsTheLimit() {
        String text = "x".repeat(160);

        assertThat(AnchorResolver.excerptProse(text, 160)).isEqualTo(text);
    }

    @Test
    void testExcerptProse_shouldCutAtAWordBoundary_whenTextExceedsTheLimit() {
        String text = "szo ".repeat(10); // "szo szo szo ... szo " — 40 chars, all word-separated

        String excerpt = AnchorResolver.excerptProse(text, 17);

        // A naive substring(0, 17) would be "szo szo szo szo s" — a word chopped mid-"szo".
        // The word-boundary back-off must land one space earlier instead.
        assertThat(excerpt).isEqualTo("szo szo szo szo");
        assertThat(excerpt.length()).isLessThanOrEqualTo(17);
        assertThat(excerpt).doesNotEndWith(" ");
        assertThat(text.charAt(excerpt.length())).as("cuts right before a real word boundary in the source text")
                .isEqualTo(' ');
    }

    @Test
    void testExcerptProse_shouldKeepTheSurrogateSafeCut_whenNoWordBoundaryExistsToBackOffTo() {
        // No spaces at all: the word-boundary back-off has nothing to find (lastIndexOf(' ') < 0),
        // so the result must fall back to PushSender's surrogate-safe cut rather than a raw
        // substring that would split the emoji's pair in half.
        String text = "x".repeat(299) + EMOJI + "tail";

        String excerpt = AnchorResolver.excerptProse(text, 300);

        assertThat(excerpt).hasSize(299).isEqualTo("x".repeat(299));
        assertThat(hasUnpairedSurrogate(excerpt)).isFalse();
    }

    @Test
    void testExcerptProse_shouldCutBeforeTheEmojiAtAWordBoundary_whenASurrogatePairStraddlesTheLimit() {
        // "alfa béta gamma " (16 chars) + EMOJI (a surrogate pair, chars 16-17) + " delta".
        // maxChars=17 lands exactly on the emoji's high surrogate: PushSender.truncateBody backs
        // off to 16 chars (dropping the whole emoji), then the word-boundary cut backs off once
        // more to the space before "gamma" is even reached... no: 16 chars is "alfa béta gamma "
        // itself (trailing space included), so the word-boundary cut trims that trailing space too.
        String text = "alfa béta gamma " + EMOJI + " delta";

        String excerpt = AnchorResolver.excerptProse(text, 17);

        assertThat(excerpt).isEqualTo("alfa béta gamma");
        assertThat(hasUnpairedSurrogate(excerpt)).isFalse();
        // The end-to-end symptom a lone surrogate would cause: a UTF-8 round trip must be lossless.
        assertThat(new String(excerpt.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8))
                .isEqualTo(excerpt);
    }

    /** True if any surrogate in the string lacks its partner — the defect being excluded. */
    private static boolean hasUnpairedSurrogate(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= value.length() || !Character.isLowSurrogate(value.charAt(i + 1))) {
                    return true;
                }
                i++;
            } else if (Character.isLowSurrogate(c)) {
                return true;
            }
        }
        return false;
    }
}
