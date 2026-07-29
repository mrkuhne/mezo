package io.mrkuhne.mezo.feature.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * Boundary coverage for {@link PushSender#truncateBody}. A pure function, so a plain unit test is
 * the right shape: nothing about it needs a Spring context or a database.
 *
 * <p>The failure this pins is invisible from the outside — a body cut between the two halves of an
 * emoji leaves a lone surrogate, which is not a valid code point, so encoding the payload as UTF-8
 * replaces it with {@code ?} and the user sees a stray question mark on their lock screen. Inert in
 * N1 (the only body is a fixed literal); live the moment N2 generates bodies.
 */
class PushSenderTruncationTest {

    /** U+1F600 GRINNING FACE — a supplementary code point, i.e. a surrogate PAIR in Java. */
    private static final String EMOJI = "😀";

    @Test
    void testTruncateBody_shouldReturnTheBodyUnchanged_whenItFitsTheLimit() {
        assertThat(PushSender.truncateBody("rövid", 300)).isEqualTo("rövid");
        assertThat(PushSender.truncateBody("x".repeat(300), 300)).hasSize(300);
        assertThat(PushSender.truncateBody(null, 300)).isNull();
    }

    @Test
    void testTruncateBody_shouldCutAtTheLimit_whenTheBoundaryIsNotASurrogate() {
        assertThat(PushSender.truncateBody("x".repeat(301), 300)).isEqualTo("x".repeat(300));
    }

    @Test
    void testTruncateBody_shouldDropTheWholeEmoji_whenASurrogatePairStraddlesTheLimit() {
        // 299 plain chars + the pair -> a naive substring(0, 300) would keep the HIGH surrogate
        // only. The pair must be dropped whole instead.
        String body = "x".repeat(299) + EMOJI + "tail";

        String truncated = PushSender.truncateBody(body, 300);

        assertThat(truncated).hasSize(299).isEqualTo("x".repeat(299));
        assertThat(hasUnpairedSurrogate(truncated)).isFalse();
        // The end-to-end symptom: a lone surrogate becomes '?' once the payload is UTF-8 encoded.
        assertThat(new String(truncated.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8))
                .isEqualTo(truncated);
    }

    @Test
    void testTruncateBody_shouldKeepTheWholeEmoji_whenThePairEndsExactlyAtTheLimit() {
        // The accepted side of the same boundary: the pair occupies chars 298-299, so nothing is
        // split and the emoji must survive intact rather than be dropped defensively.
        String body = "x".repeat(298) + EMOJI + "tail";

        String truncated = PushSender.truncateBody(body, 300);

        assertThat(truncated).hasSize(300).endsWith(EMOJI);
        assertThat(hasUnpairedSurrogate(truncated)).isFalse();
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
